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
 **    $AUTHORS:     Stefan Bosse
 **    $INITIAL:     (C) 2006-2022 bLAB
 **    $CREATED:     6-12-17 by sbosse.
 **    $RCS:         $Id: watchdog.js,v 1.1 2020/02/03 09:45:01 sbosse Exp sbosse $
 **    $VERSION:     1.2.1
 **
 **    $INFO:
 **
 **  JavaScript AIOS native platform Watchdog Interface
 **
 **
 **   A watchdog provides a timer and some kind of protected envrionment executing a function.
 **   If the function execution time exceeds the timeout of the timer, an exception is thrown (pre-emptive).
 **   This exception can be handled by a scheduler for round-robinson scheduling.
 **   There are different watchdog functionalities provided by different JS VM platforms:
 **
 **   1A. Full (jvm) {start,stop}
 **   1B. Full (jxcore+,pl3) {start,stop,protect}
 **   2. Protected (Node + watchdog.node module) {start, stop, protect}
 **   3. Partial with injected checkpointing (jxcore) {start, stop, checkpoint}
 **   4. No (generic node, browser) {}
 **
 **    $ENDOFINFO
 */
var version = '1.2.2'
if (typeof process != 'undefined' && process.env && !process.env.BOOTSTRAP) PATH.push('/opt/jam');
function search(index,module) {
  if (PATH.length==index) return module;
  var path=PATH[index];
  if (Fs.existsSync(path+'/'+module)) return path+'/'+module;
  else return search(index+1,module);
}

try {
  var watchdog;
  var Fs = Require('fs');
  try {watchdog = process && process.binding && process.binding && process.binding('watchdog')} catch (e){}; // JX/JX+
  if (!watchdog) watchdog = process && process.watchdog; // JX+
  if (!watchdog && process && process.startWatchdog) watchdog={
    // JVM
    start:process.startWatchdog,
    stop:process.stopWatchdog,
    init:process.initWatchdog,
    tick:process.tick
  };
  if (!watchdog) {
    try  { watchdog = require(search(0,'watchdog.node')) } catch (e) { }
  }
  if (!watchdog && process && process.version && Fs) {
    // NODE
    var nativePath,platformVersion;
    if (process.version.match(/^v0.12/)) platformVersion="0.12";
    else if (process.version.match(/^v3/)) platformVersion="3.x";
    else if (process.version.match(/^v4/)) platformVersion="4.x";
    else if (process.version.match(/^v5/)) platformVersion="5.x";
    else if (process.version.match(/^v6/)) platformVersion="6.x";
    else if (process.version.match(/^v7/)) platformVersion="7.x";
    else if (process.version.match(/^v8/)) platformVersion="8.x";
    else if (process.version.match(/^v9/)) platformVersion="9.x";
    if (platformVersion && process.platform && process.arch)
      nativePath = 'native/'+process.platform+'/'+platformVersion+'/' + process.arch + '/watchdog.node'; 
    if (PATH) 
    if (nativePath) {
      var _watchdog = require(search(0,nativePath));
      watchdog = {
        start : _watchdog.start,
        stop  : _watchdog.clear,
        protect : _watchdog.protect,
        init : function () {},
      }
    }
  }
} catch (e) {
  // console.log(e)
}

if (watchdog) {
  module.exports={
    start:watchdog.start||watchdog.startWatchdog,
    stop:watchdog.stop||watchdog.stopWatchdog,
    init:watchdog.init||watchdog.initWatchdog,
    checkPoint:watchdog.checkPoint,
    tick:watchdog.tick,
    protect:watchdog.protect,
    version : version
  }
} else module=undefined;
