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
 **    $MODIFIED:    by sbosse (2016-2017)
 **    $REVESIO:     1.2.1
 **
 **    $INFO:
 **
 **    message.js - message element for blessed
 **
 **    $ENDOFINFO
 */

var Comp = Require('com/compat');

/**
 * Modules
 */

var Node = Require('term/widgets/node');
var Box = Require('term/widgets/box');

/**
 * Message / Error
 */

function Message(options) {
  if (!instanceOf(this,Node)) {
    return new Message(options);
  }

  options = options || {};
  options.tags = true;

  Box.call(this, options);
}

//Message.prototype.__proto__ = Box.prototype;
inheritPrototype(Message,Box);

Message.prototype.type = 'message';

Message.prototype.log =
Message.prototype.display = function(text, time, callback) {
  var self = this;

  if (typeof time === 'function') {
    callback = time;
    time = null;
  }

  if (time == null) time = 3;

  // Keep above:
  // var parent = this.parent;
  // this.detach();
  // parent.append(this);

  if (this.scrollable) {
    this.screen.saveFocus();
    this.focus();
    this.scrollTo(0);
  }

  this.show();
  this.setContent(text);
  this.screen.render();

  if (time === Infinity || time === -1 || time === 0) {
    var end = function() {
      if (end.done) return;
      end.done = true;
      if (self.scrollable) {
        try {
          self.screen.restoreFocus();
        } catch (e) {
          ;
        }
      }
      self.hide();
      self.screen.render();
      if (callback) callback();
    };

    setTimeout(function() {
      self.onScreenEvent('keypress', function fn(ch, key) {
        if (key.name === 'mouse') return;
        if (self.scrollable) {
          if ((key.name === 'up' || (self.options.vi && key.name === 'k'))
            || (key.name === 'down' || (self.options.vi && key.name === 'j'))
            || (self.options.vi && key.name === 'u' && key.ctrl)
            || (self.options.vi && key.name === 'd' && key.ctrl)
            || (self.options.vi && key.name === 'b' && key.ctrl)
            || (self.options.vi && key.name === 'f' && key.ctrl)
            || (self.options.vi && key.name === 'g' && !key.shift)
            || (self.options.vi && key.name === 'g' && key.shift)) {
            return;
          }
        }
        if (self.options.ignoreKeys && ~self.options.ignoreKeys.indexOf(key.name)) {
          return;
        }
        self.removeScreenEvent('keypress', fn);
        end();
      });
      // XXX May be affected by new element.options.mouse option.
      if (!self.options.mouse) return;
      self.onScreenEvent('mouse', function fn(data) {
        if (data.action === 'mousemove') return;
        self.removeScreenEvent('mouse', fn);
        end();
      });
    }, 10);

    return;
  }

  setTimeout(function() {
    self.hide();
    self.screen.render();
    if (callback) callback();
  }, time * 1000);
};

Message.prototype.error = function(text, time, callback) {
  return this.display('{red-fg}Error: ' + text + '{/red-fg}', time, callback);
};

/**
 * Expose
 */

module.exports = Message;
