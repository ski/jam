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
 **    $CREATED:     15-1-16 by sbosse.
 **    $RCS:         $Id: proc.js,v 1.2 2020/02/03 09:45:01 sbosse Exp sbosse $
 **    $VERSION:     1.7.2
 **
 **    $INFO:
 **
 **  JavaScript AIOS Agent Process Module
 **
 **    $ENDOFINFO
 */
var Comp = Require('com/compat');
var current=none;
var Aios = none;

var options = {
  debug : {},
  version:'1.7.2'
}

var PRIO = {
  LOW:0,
  NORMAL:1,
  HIGH:2
}
/*
** Agent process - must be compatible with scheduler context process!
*/

var proc = function (properties) {
  // Agent code
  this.agent={};
  
  // Internal scheudling blocks - can'tmigrate - if any
  // Handled by global scheduler (DOS)
  this.block=[];
  // Process execution suspended?
  this.blocked=false;

  // Process blocking timeout (absolute time)
  this.timeout=0;
  
  // For soft checkpointing
  this.runtime=0;
  
  // Ressource control (node constraints)
  this.resources = {
    start:Aios.clock('ms'),      // start time on this host
    consumed:0,   // total processing time consumed
    memory:0,     // total memory (code+data) consumed
    tuples:0,     // total tuple generation
    agents:0,     // total agents created
  }
  
  this.level=undefined;
  
  // Dynamic process priority effecting scheduling order 
  this.priority = PRIO.NORMAL;  
  
  // Agent scheduling blocks - can migrate!
  // Handled by AIOS scheduler only!
  // function []
  this.schedule=[];
  // Agent activity suspended, waiting for an event?
  this.suspended=false;
  this.suspendedIn=undefined;
  
  this.error=none;
  
  // process id
  this.pid=none;
  // process parent id
  this.gid=none;
  this.id='agent';
  this.mask={};
  // [sig,arg,from] []
  this.signals=[];
  
  // Did we moved?
  this.move=none;
  // Killing state
  this.kill=false;
  // Dead state
  this.dead=false;
  // Pending next transition computatuion?
  this.transition=false;
  // Prevent transition
  this.notransition=false;
  
  for (var p in properties) {
    if (properties[p]!=undefined) this[p]=properties[p];
  }

  // Used in simulators only: A geometric shape object
  this.shape=undefined;  

  if (current.world) this.parent = current.world.context;
  this.node=current.node;
}


/** Execute a callback function in this agent process context immediately (should invoke scheduler and CB!)
 *
 */
proc.prototype.callback = function (cb,args) {
  var _process=current.process,_node=current.node, res;
  current.node=this.node;
  current.process=this;
  try {
    res=cb.apply(this.agent,args||[]);
  } catch (e) {
    Aios.aios.log('Caught callback error: '+e);
  }
  current.process=_process;
  current.node=_node;  
  return res;
}

/** Execute this process immediately
 *
 */
proc.prototype.exec = function() {
  var _process=current.process,_node=current.node, res;
  current.node=this.node;
  res = Aios.schedule(this);
  current.process=_process;
  current.node=_node;  
  return res;
}

/** Finalize this process
 *
 */
proc.prototype.finalize = function() {
  this.kill=true;
  this.suspended=false;
  current.node.unregister(this);
}


/** Fork an agent process.
 *  Returns child process. 
 *  If level is not specified, the parent process level is used.
 */ 
proc.prototype.fork = function(parameters,level,dirty) {
  var code,
      _process=current.process,
      agent=current.process.agent,
      process_,
      agent_,
      p;
  parameters=parameters||{};
  current.process.resources.agents++;
  if (dirty && level!=undefined) dirty=false; // Dirty process copy with level change not possible!    
  if (level==undefined) level=current.process.mask.privilege();
  else level=Math.min(current.process.mask.privilege(),level);
  if (!dirty) {
    code = Aios.Code.forkCode(current.process);
    process_ = Aios.Code.toCode(code,level);
  } else {
    process_ = Aios.Code.copyProcess(current.process);
  }
  agent_ = process_.agent
  agent_.id=Aios.aidgen();
  agent_.parent=current.process.agent.id;
  process_.init({gid:current.process.pid});
  current.process=process_;
  current.node.register(process_);
  // Update forked child agent parameters only if they already exist
  // First we have to restore nullified attributes that can be lost on copy!!!
  for (p in agent) {
    if (agent[p]===null) agent_[p]=null;
  }
  for (p in parameters) {
    if (Comp.obj.hasProperty(agent_,p)) agent_[p]=parameters[p];
  }
  // Should next activity computed in scheduler by setting process.transition ???
  // compute next activity after fork if there is no scheduling block,
  // no parameter next set,
  // and forkCode should always discard all current schedule blocks!
  if (!parameters.next) try {
    agent_.next=(typeof agent_.trans[agent_.next] == 'function')?agent_.trans[agent_.next].call(agent_):
                                                                 agent_.trans[agent_.next];
  } catch (e) { /*kill agent?*/ process_.kill=true; };
  this.node.stats.fork++;
  current.process=_process;
  return process_;
}

proc.prototype.init = function (properties) {
  for (var p in properties) {
    if (this[p]!=undefined) this[p]=properties[p];
  }
}

proc.prototype.print = function () {
  var str='',
      agent=this.agent;
  str = 'PID='+this.pid+
              (this.gid?' GID='+this.gid:'')+
              (this.timeout?(' TMO='+this.timeout):'')+
              (this.blocked?' BLOCKED':'')+
              (this.suspended?' SUSP':'')+
              (this.kill?' KILL':'')+
              (this.dead?' DEAD':'');
  if (this.schedule.length>0) str += ' SCHEDULE='+this.schedule.length;
  if (this.block.length>0) str += ' BLOCK='+this.block.length;
  if (this.signals.length>0) str += ' SIGNALS('+this.signals.length+'):'+
                                    Comp.printf.list(this.signals,function (s) {return s[0]});
  if (this.transition) str += ' TRANS';
  if (this.consumed|0) str += ' CONS='+(this.consumed|0);
  if (agent) str += ' AGENT '+agent.id+' next='+agent.next;
  return str;
}


/**
 * Suspend agent activity processing, but not internal block scheduling!
 */
proc.prototype.suspend = function (timeout,transition,suspendedIn){
  if (!this.kill && !this.dead) {
    this.suspended=true;
    if (timeout!=undefined) this.timeout=timeout;
    if (transition) this.transition=true;  // pending next computation    
    this.suspendedIn = suspendedIn;
  }
}


proc.prototype.update = function (properties) {
  for (var p in properties) {
    this[p]=properties[p];
  }
}

// Change the mask environment of an agent process with a new AIOS level API
proc.prototype.upgrade = function (level) {
  var aios;
  switch (level) {
    case undefined:
    case 0: aios=Aios.aios0; break;
    case 1: aios=Aios.aios1; break;
    case 2: aios=Aios.aios2; break;
    case 3: aios=Aios.aios3; break;
    default: aios=Aios.aios0; break;
  }
  for (p in aios) {
    this.mask[p]=aios[p];
  }
}

/**
 * Wakeup agent process from a previous suspend call (sleep)
 */
proc.prototype.wakeup = function (immediate){
  this.suspended=false;
  this.timeout=0;
  if (!this.kill && !this.dead && (immediate || this.schedule.length == 0)) {
    var _process=current.process,_node=current.node;
    current.node=this.node;
    if (this.suspendedIn=='ts') this.node.ts.cleanup(this,true);  // Have to call callback handler to inform about timeout!?
    this.suspendedIn=undefined;
    this.transition=this.schedule.length == 0;
    // Re-entering the scheduler is a bad idea!?
    Aios.schedule(this);
    current.process=_process;
    current.node=_node;
  } else Aios.scheduled++;
}

function Proc(properties) {
  var obj = new proc(properties);
  return obj;
}


module.exports = {
  agent: {
    fork:function fork(parameters) {
            return current.process.fork(parameters);
    }
  },
  isProc: function (o) { return o instanceof Proc }, 
  Proc:Proc,
  PRIO:PRIO,
  current:function (module) { current=module.current; Aios=module; },
  options:options
}
