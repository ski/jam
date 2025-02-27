/**
 **      ==============================
 **       O           O      O   OOOO
 **       O           O     O O  O   O
 **       O           O     O O  O   O
 **       OOOO   OOOO O     OOO  OOOO
 **       O   O       O    O   O O   O
 **       O   O       O    O   O O   O
 **       OOOO        OOOO O   O OOOO
 **      ==============================
 **      Dr. Stefan Bosse http://www.bsslab.de
 **
 **      COPYRIGHT: THIS SOFTWARE, EXECUTABLE AND SOURCE CODE IS OWNED
 **                 BY THE AUTHOR(S).
 **                 THIS SOURCE CODE MAY NOT BE COPIED, EXTRACTED,
 **                 MODIFIED, OR OTHERWISE USED IN A CONTEXT
 **                 OUTSIDE OF THE SOFTWARE SYSTEM.
 **
 **    $AUTHORS:     Christopher Jeffrey and contributors, Stefan Bosse
 **    $INITIAL:     (C) 2013-2015, Christopher Jeffrey and contributors
 **    $MODIFIED:    sbosse (2017).
 **    $VERSION:     1.2.2
 **
 **    $INFO:
 *
 * ansiimage.js - render PNGS/GIFS as ANSI
 *
 **    $ENDOFINFO
 */

/**
 * Modules
 */
var Comp = Require('com/compat');

var cp = Require('child_process');

var colors = Require('term/colors');

var Node = Require('term/widgets/node');
var Box = Require('term/widgets/box');

var tng = Require('term/tng');

/**
 * ANSIImage
 */

function ANSIImage(options) {
  var self = this;

  if (!instanceOf(this,Node)) {
    return new ANSIImage(options);
  }

  options = options || {};
  options.shrink = true;

  Box.call(this, options);

  this.scale = this.options.scale || 1.0;
  this.options.animate = this.options.animate !== false;
  this._noFill = true;

  if (this.options.file) {
    this.setImage(this.options.file);
  }

  this.screen.on('prerender', function() {
    var lpos = self.lpos;
    if (!lpos) return;
    // prevent image from blending with itself if there are alpha channels
    self.screen.clearRegion(lpos.xi, lpos.xl, lpos.yi, lpos.yl);
  });

  this.on('destroy', function() {
    self.stop();
  });
}

//ANSIImage.prototype.__proto__ = Box.prototype;
inheritPrototype(ANSIImage,Box);

ANSIImage.prototype.type = 'ansiimage';

ANSIImage.curl = function(url) {
  try {
    return cp.execFileSync('curl',
      ['-s', '-A', '', url],
      { stdio: ['ignore', 'pipe', 'ignore'] });
  } catch (e) {
    ;
  }
  try {
    return cp.execFileSync('wget',
      ['-U', '', '-O', '-', url],
      { stdio: ['ignore', 'pipe', 'ignore'] });
  } catch (e) {
    ;
  }
  throw new Error('curl or wget failed.');
};

ANSIImage.prototype.setImage = function(file) {
  this.file = typeof file === 'string' ? file : null;

  if (/^https?:/.test(file)) {
    file = ANSIImage.curl(file);
  }

  var width = this.position.width;
  var height = this.position.height;

  if (width != null) {
    width = this.width;
  }

  if (height != null) {
    height = this.height;
  }

  try {
    this.setContent('');

    this.img = tng(file, {
      colors: colors,
      width: width,
      height: height,
      scale: this.scale,
      ascii: this.options.ascii,
      speed: this.options.speed,
      filename: this.file
    });

    if (width == null || height == null) {
      this.width = this.img.cellmap[0].length;
      this.height = this.img.cellmap.length;
    }

    if (this.img.frames && this.options.animate) {
      this.play();
    } else {
      this.cellmap = this.img.cellmap;
    }
  } catch (e) {
    this.setContent('Image Error: ' + e.message);
    this.img = null;
    this.cellmap = null;
  }
};

ANSIImage.prototype.play = function() {
  var self = this;
  if (!this.img) return;
  return this.img.play(function(bmp, cellmap) {
    self.cellmap = cellmap;
    self.screen.render();
  });
};

ANSIImage.prototype.pause = function() {
  if (!this.img) return;
  return this.img.pause();
};

ANSIImage.prototype.stop = function() {
  if (!this.img) return;
  return this.img.stop();
};

ANSIImage.prototype.clearImage = function() {
  this.stop();
  this.setContent('');
  this.img = null;
  this.cellmap = null;
};

ANSIImage.prototype.render = function() {
  var coords = this._render();
  if (!coords) return;

  if (this.img && this.cellmap) {
    this.img.renderElement(this.cellmap, this);
  }

  return coords;
};

/**
 * Expose
 */

module.exports = ANSIImage;
