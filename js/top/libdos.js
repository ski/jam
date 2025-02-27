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
 **    $INITIAL:     (C) 2006-2017 bLAB
 **    $CREATED:     1-10-17 by sbosse.
 **    $VERSION:     1.1.3
 **
 **    $INFO:
 **
 **  DOS library - can be embedded in any application
 **
 **    $ENDOFINFO
 */
var Io = Require('com/io');
var Comp = Require('com/compat');
var Name = Require('com/pwgen');

var Buf = Require('dos/buf');
var Conn = Require('dos/connection');
var Cs = Require('dos/capset');
var Dios = Require('dos/dios');
var Dns = Require('dos/dns');
var HostSrv = Require('dos/hostsrv');
var Net = Require('dos/network');
var Sch = Require('dos/scheduler');
var Rpc = Require('dos/rpc');
var Run = Require('dos/run');
var RunSrv = Require('dos/runsrv');
var Std = Require('dos/std');
var Router = Require('dos/router');
var util =  require('util');

function dos(options) {
  if (!(this instanceof dos)) return new dos(options);  
  this.options  = options||{};
  this.env      = options.env||{};
  this.verbose  = options.verbose||0;

  this.run      = false;
  this.looprun  = none;

  this.broker   = options.http||options.tcpnet;
  this.bport    = options.bport||3001;
  this.bip      = options.bip;
  
  this.privhostport = Net.uniqport();
  this.pubhostport  = Net.prv2pub(this.privhostport);
  
  if (this.verbose>1) Io.out('[DOS] public port: '+Net.Print.port(this.pubhostport));
  options.pubhostport = this.pubhostport;
  this.scheduler  = options.scheduler || Sch.TaskScheduler();
  this.network    = options.network   || Conn.setup(options,1);

  this.router     = this.network.router;
  // this.router.log(2);
  // network.XX uses global scheduler
  this.rpc  = this.network.rpc;
  this.std  = this.network.std;
  this.dns  = this.network.dns;
  this.cs   = this.network.cs;
  this.dios = Dios.Dios(this.network.rpc,this.network.env);
}
dos.prototype.init = function() {
  this.scheduler.Init();
  this.network.init();
}
dos.prototype.start = function(callback) {
  this.scheduler.Run();
  this.network.start(callback);
}

module.exports = {
  dos:dos,
  Buffer:Buf,
  Connection:Conn,
  Cs:Cs,
  Dios:Dios,
  Network:Net,
  Rpc:Rpc,
  Router:Router,
  Run:Run,
  Scheduler:Sch,
  Std:Std
}

