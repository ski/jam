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
 **    $CREATED:     25-12-16 by sbosse.
 **    $RCS:         $Id: jamlib.js,v 1.5 2020/02/03 09:45:01 sbosse Exp sbosse $
 **    $VERSION:     1.35.1
 **
 **    $INFO:
 **
 **  JAM library API that can be embedded in any host application.
 **
 **
 ** New: Embedded auto setup (e.g., for clusters) using command line arguments
 ** 
 **      jamlib autosetup:"{options}"
 **
 **
 **    $ENDOFINFO
 */
var onexit=false;
var start=false;
var options = {
  geo:undefined,
  verbose:0,
  version:'1.35.1'  // public version
};

global.config={simulation:false,nonetwork:false};

var Io = Require('com/io');
var Comp = Require('com/compat');
var Aios = Require('jam/aios');
var Esprima = Require('parser/esprima');
var Json = Require('jam/jsonfn');
var fs = Require('fs');
var Sat = Require('dos/ext/satelize');
var GPS5 = Require('geoip/gps5');
var GeoLoc5 = Require('geoip/geoloc5');
var CBL = Require('com/cbl');
var platform = Require('os/platform');

var DIR = Aios.DIR;

// Parse command line arguments; extract a:v attributes
var environment = process.env; process.argv.slice(2).forEach(function (arg) { 
  var tokens=arg.match(/([a-zA-Z]+):(['"0-9a-zA-Z_:\->\.\{\},;]+)/);
  if (tokens && tokens.length==3) environment[tokens[1]]=tokens[2];
});

function locationEvalError(e) {
  return (e.lineNumber?(' at line '+e.lineNumber+
                       (e.columnNumber?(' column '+e.columnNumber):'')):'')
}

if (typeof setImmediate == 'undefined') {
  function setImmediate(callback) {return setTimeout(callback,0)};
}

// Extend DIR with IP capabilities of NORTH, ..
DIR.North= function (ip) { return {tag:DIR.NORTH,ip:ip}}
DIR.South= function (ip) { return {tag:DIR.SOUTH,ip:ip}}
DIR.West = function (ip) { return {tag:DIR.WEST ,ip:ip}}
DIR.East = function (ip) { return {tag:DIR.EAST ,ip:ip}}
DIR.Up   = function (ip) { return {tag:DIR.UP ,ip:ip}}
DIR.Down = function (ip) { return {tag:DIR.DOWN ,ip:ip}}

/**
 *  typeof options = { 
 *                     connections?, 
 *                     print? is agent and control message output function,
 *                     printAgent? is agent message only output function,
 *                     printAsync? async (callback) output function,
 *                     fork?,
 *                     provider?, consumer?, 
 *                     classes?, 
 *                     id?:string is JAM and JAM root node id,
 *                     world?:string is JAM world id,
 *                     position?:{x,y}, 
 *                     cluster?:boolean|[] is an attached cluster node,
 *                     nowatch:boolean is a disable flag for agent watchdog checking,
 *                     checkpoint:boolean is a flag forcing code checkpointing (even if watchdog is available),
 *                     nolimits:boolean is a disable flag for agent resource monitoring,
 *                     log?:{class?:boolean,node?,agent?,parent?,host?,time?,Time?,pid?},
 *                     logJam?:{host?,time?,pid?,node?,world?},
 *                     scheduler?:scheduler is an external scheduler, singlestep?,
 *                     network?:{cluster?,rows,columns,connect?:function},
 *                     verbose?, TMO? }
 *  with typeof connections = { 
 *    @kind : {from:string,to?:string,proto:string='udp'|'tcp'|'http'|'stream',num?:number,on?,range?:number[]},
 *    @kind : {send:function, status:function, register?:function(@link)} , 
 *    @kind : .. }
 *  with @kind = {north,south,west,east,ip, ..}
 *
 * Connecting JAM nodes (IP)
 * -------------------------
 *   
 *  .. Jam({
 *    connections: {
 *      // Generic, P2PN
 *      ip?: {from:string,to?:string,proto:string='udp'|'tcp'|'http',num?:number} // AMP link (UDP) or set of AMP links (num>1)
 *      // Assigned to a logical direction, P2P
 *      north?: {                                                             
 *        from:string,to?:string,proto?='udp'|'tcp'|'http'|'device',device?:string // device is a hardware P2P stream device 
 *      }, ..
 *
 * Integration of host program streams
 * ------------------------------------
 *
 *  var chan = Some Stream Channel Object;
 *  
 *  .. Jam({
 *    connections: {
 *      north?: {
 *        register: function (link) {
 *          // register channel data handler with link handler 
 *          chan.on('data',function (data) {
 *            // process raw data, extract msg={agent:string,to?,from?,..} or {signal:string,to?,from?,..}
 *            if (msg.agent) link.emit('agent',msg.agent);
 *            if (msg.signal) link.emit('signal',msg.signal);
 *          });
 *        }
 *        send: function (msg) {
 *          chan.send(msg);
 *        },
 *        status: function (to) {
 *          return true;
 *        }
 *      }
 *    }, ..
 *  } 
 *  
 * Cluster
 * --------
 *
 * A forked cluster consists of a master node (0) and up to 8 child ndoes connected around the root node
 * by streams in directions {E,S,SE,W,SW,N,NW,NE}. Each node is executed physically in a different JAM process. 
 * Ex. network: {cluster:true, rows:2, columns:2},
 *
 */
 
var jam = function (options) {
  var self=this,
      p,conn,node;
  this.options = options||{};
  this.environment=environment;
  if (this.setup)           this.setup(); // overwrite options
  if (this.options.world && !this.options.id) this.options.id=this.options.world;
  if (!this.options.id)     this.options.id=Aios.aidgen();
  if (!this.options.log)    this.options.log={};
  if (!this.options.logJam) this.options.logJam={pid:false,host:false,time:false};
  this.verbose =  this.options.verbose || 0;
  this.Aios =     Aios;
  this.DIR =      Aios.aios.DIR;

  Aios.options.verbose=this.verbose;
  if (options.scheduler) Aios.current.scheduler=scheduler;
  if (options.nolimits||options.nowatch||options.checkpoint) 
    Aios.config({nolimits:options.nolimits,nowatch:options.nowatch,checkpoint:options.checkpoint});

  // out=function (msg) { Io.print('[JAM '+self.options.id+'] '+msg)};
  if (this.options.print)  Aios.print=Aios.printAgent=this.options.print;
  if (this.options.print2) Aios.printAgent=this.options.print2;
  if (this.options.printAgent) Aios.printAgent=this.options.printAgent;
  if (this.options.printAsync) Aios.printAsync=this.options.printAsync;
  
  // JAM messages
  this.log=function (msg) { 
    var s='[JAM',sep=' ';
    if (self.options.logJam.pid && process) s += (' '+process.pid),sep=':';
    if (self.options.logJam.world && Aios.current.world) s += (sep+Aios.current.world.id),sep=':';
    if (self.options.logJam.node && Aios.current.node) s += (sep+Aios.current.node.id),sep=':';
    if (self.options.logJam.time) s += (sep+Aios.time());
    Aios.print(s+'] '+msg);
  };
  
  
  this.err=function (msg,err) {
    self.log('Error: '+msg);
    throw (err||'JAMLIB');
  }
  this.warn=function (msg) {
    self.log('Warning: '+msg);
  }
  
  this.error=undefined;
  
  // Create a world
  this.world = Aios.World.World([],{
    id:this.options.world||this.options.id.toUpperCase(),
    classes:options.classes||[],
    scheduler:options.scheduler,
    verbose:options.verbose
  });
  if (this.verbose) this.log('Created world '+this.world.id+'.');
  
  this.node=none;
  this.run=false;
  
  
  // Service loop executing the AIOS scheduler
  // NOT USED if there is an external scheduler supplied (world will create JAM scheduling loop)
  

  this.ticks=0;       // schedule loop execution counter!
  this.steps=0;       // Number of schedule loop execution steps
  this.loop=none;     // Schedule loop function
  this.looping=none;  // Current schedule loop run (or none); can be waiting for a timeout
      
  Aios.config({fastcopy:this.options.fastcopy,
               verbose:this.options.verbose});
  
  if (this.options.log) 
    for(p in this.options.log) Aios.config(this.options.log[p]?{"log+":p}:{"log-":p});

  this.process = Aios.Proc.Proc();
  this.process.agent={id:'jamlib'};
    
  this.events={};
}

// Import analyzer class...
var JamAnal = Require('jam/analyzer');
JamAnal.current(Aios);
jam.prototype.analyzeSyntax=JamAnal.jamc.prototype.analyze;
jam.prototype.syntax=JamAnal.jamc.prototype.syntax;



/** Add agent class to the JAM world and create sandboxed constructors.
 *  type constructor = function|string
 */
jam.prototype.addClass = function (name,constructor,env) {
  this.world.addClass(name,constructor,env);
  if (this.verbose) this.log('Agent class '+name+' added to world library.');
};

/** Add a new node to the world.
 *  Assumption: 2d meshgrid network with (x,y) coordinates.
 *  The root node has position {x=0,y=0}.
 *  type of nodeDesc = {x:number,y:number,id?}
 *
 */
jam.prototype.addNode = function (nodeDesc) {
  var node,x,y;
  x=nodeDesc.x;
  y=nodeDesc.y;
  if (Comp.array.find(this.world.nodes,function (node) {
    return node.position.x==x && node.position.y==y;
  })) {
    this.err('addNodes: Node at positition ('+x+','+y+') exists already.');
    return;
  }
  node=Aios.Node.Node({id:nodeDesc.id||Aios.aidgen(),position:{x:x,y:y}},true);
  if (this.verbose) this.log('Created node '+node.id+' ('+x+','+y+').');
  // Add node to world
  this.world.addNode(node);    
  return node.id;
}

/** Add logical nodes.
 *  The root node has position {x=0,y=0}.
 *  type of nodes = [{x:number,y:number,id?},..]
 */
jam.prototype.addNodes = function (nodes) {  
  var n,node,x,y,nodeids=[];
  for(n in nodes) {
    nodeids.push(this.addNode(nodes[n]));
  }
  return nodeids;
}

/** Analyze agent class template in text or object form
 ** typeof @options = {..,classname?:string}
 *  Returns {report:string,interface}
 */
jam.prototype.analyze = function (ac,options) {
  var source,name,syntax,content,report,interface;
  if (Comp.obj.isString(ac)) {
    // TODO
  } else if (Comp.obj.isObject(ac)) {
    // TODO
  } else if (Comp.obj.isFunction(ac)) {
    source = ac.toString();
    if (!options.classname) { 
      name=source.match(/^ *function *([^\s\(]*)\(/);
      if (name && name[1]!='') options.classname=name[1];
    }
    content = 'var ac ='+source;
    syntax = Esprima.parse(content, { tolerant: true, loc:true });
    try {
      interface=this.analyzeSyntax(syntax,{
        classname:options.classname||'anonymous',
        level:options.level==undefined?2:options.level,
        verbose:options.verbose,
        err:function (msg){throw msg},
        out:function (msg){if (!report) report=msg; else report=report+'\n'+msg;},
        warn:function (msg){if (!report) report=msg; else report=report+'\n'+msg;}
      });
      return {report:report||'OK',interface:interface};
    } catch (e) {
      return {report:e,interface:interface};
    }
  }
}
jam.prototype.clock = Aios.clock;

/** Compile (analyze) an agent class constructor function and add it to the world class library.
 ** Can be used after an open statement.
 ** Usage: compileClass(name,constructor,options?)
 **        compileClass(constructor,options?)
 **
 **  typeof @name=string|undefined
 **  typeof @constructor=function|string
 **  typeof @options={verbose:number|boolean)|verbose:number|undefined
*/ 
jam.prototype.compileClass = function (name,constructor,options) {
  var ac,p,verbose,content,syntax,report,text,env={ac:undefined},self=this,ac;

  if (typeof name == 'function') constructor=name,name=undefined,options=constructor;
  if (typeof options == 'object') verbose=options.verbose||0; 
  else if (options!=undefined) verbose=options; else verbose=this.verbose;
  // if (typeof constructor != 'function') throw 'compileClass: second constructor argument not a function';

  if (typeof constructor == 'function') text = constructor.toString();
  else text = constructor;
  
  if (!name) {
    // try to find name in function definition
    name=text.match(/[\s]*function[\s]*([A-Za-z0-9_]+)[\s]*\(/);
    if (!name) throw ('compileClass: No class name provided and no name found in constructor '+
                      text.substring(0,80));
    name=name[1];
    
  }
  content = 'var ac = '+text;
  try { syntax = Esprima.parse(content, { tolerant: true, loc:true }) }
  catch (e) { throw 'compileClass('+name+'): Parsing failed with '+e }
  report = this.analyzeSyntax(syntax,
    {
      classname:name,
      level:2,
      verbose:verbose||0,
      err:  function (msg){self.log(msg)},
      out:  function (msg){self.log(msg)},
      warn: function (msg){self.log(msg)}
    });
  if (report.errors.length) { throw 'compileClass('+name+'): failed with '+report.errors.join('; ')};
  for (p in report.activities) env[p]=p;
  try { with (env) { eval(content) } }
  catch (e) { throw ('compileClass('+name+'): failed with '+e+locationEvalError(e)) };
  ac=env.ac; env.ac=undefined;
  this.addClass(name,ac,env);
  return name;
}

/** Connect logical nodes (virtual link).
 *  The root node has position {x=0,y=0}.
 *  type of links = [{x1:number,y1:number,x2:number,x2:number},..]|[{x,y},{x,y}]
 */
jam.prototype.connectNodes = function (connections) {  
  var c,node1,node2,x1,y1,x2,y2,dir;
  if (connections[0].x != undefined && connections[0].y != undefined) {
    if (connections.length!=2) throw 'INVALID'; // invalid
    // simple style
    connections=[{x1:connections[0].x,x2:connections[1].x,
                  y1:connections[0].y,y2:connections[1].y}];
  }
  for(c in connections) {
    x1=connections[c].x1;
    y1=connections[c].y1;
    x2=connections[c].x2;
    y2=connections[c].y2;
    if (this.verbose) this.log('Connecting ('+x1+','+y1+') -> ('+x2+','+y2+')');
    node1=Comp.array.find(this.world.nodes,function (node) {
      return node.position.x==x1 && node.position.y==y1;
    });
    node2=Comp.array.find(this.world.nodes,function (node) {
      return node.position.x==x2 && node.position.y==y2;
    });
    if (!node1) this.err('connectNodes: Node at positition ('+x1+','+y1+') does not exist.');
    if (!node2) this.err('connectNodes: Node at positition ('+x2+','+y2+') does not exist.');
    if ((x2-x1)==0) {
      if ((y2-y1) > 0) dir=Aios.DIR.SOUTH;
      else dir=Aios.DIR.NORTH;
    } else if ((x2-x1)>0) dir=Aios.DIR.EAST;
    else dir=Aios.DIR.WEST;
    this.world.connect(dir,node1,node2);
    this.world.connect(Aios.DIR.opposite(dir),node2,node1);
  }
}

/** Dynamically connect remote endpoint at run-time
  * typeof @to = string <dir->url>|<url>
  */
jam.prototype.connectTo = function (to,nodeid) {
  var node=this.getNode(nodeid),
      tokens=(typeof to=='string')?to.split('->'):null,
      dir;
  // console.log(tokens)
  if (!node) return;
  if (to.tag) dir=to;
  else if (tokens.length==2) {
    dir=Aios.DIR.from(tokens[0]);
    if (dir) dir.ip=tokens[1];
  } else dir={tag:'DIR.IP',ip:to};
  if (dir) this.world.connectTo(dir,node);
}

/** Check connection status of a link
 *
 */
jam.prototype.connected = function (dir,nodeid) {
  var node=this.getNode(nodeid);
  if (!node) return;
  return this.world.connected(dir,node);
}

/** Create and start an agent from class ac with arguments. 
 *  Ac is either already loaded (i.e., ac specifies the class name) or 
 *  AC is supplied as a constructor function (ac), a class name, or a sandboxed constructor
 *  {fun:function,mask:{}} object for a specific level.
 *
 *  type of ac = string|object|function
 *  type of args = * []
 *  level = {0,1,2,3}
 *
 */
jam.prototype.createAgent = function (ac,args,level,className,parent) {
  var node=this.world.nodes[this.node],
      process=none,sac;
  if (level==undefined) level=Aios.options.LEVEL;
  if (!className && typeof ac == 'string') className=ac;
  if (!className && typeof ac == 'function') className=Aios.Code.className(ac);
  if (Comp.obj.isFunction(ac) || Comp.obj.isObject(ac)) {
    // Create an agent process from a constructor function or sandboxed constructor object
    process = Aios.Code.createOn(node,ac,args,level,className);
    if (process && !process.agent.parent) process.agent.parent=parent;
    if (process) return process.agent.id;   
  } else {
    // It is a class name. Find an already sandboxed constructor from world classes pool
    if (this.world.classes[ac])
      process = Aios.Code.createOn(node,this.world.classes[ac][level],args,level,className);
    else {
      this.error='createAgent: Cannot find agent class '+ac;
      this.log(this.error);
      return;
    }
    if (process) {
      if (!process.agent.parent) process.agent.parent=parent;
      process.agent.ac=ac;
      return process.agent.id; 
    } else return none;
  }
}

/** Create agent on specified (logical or physical) node.
 *  typeof node = number|string|{x,y}
 */
jam.prototype.createAgentOn = function (node,ac,args,level,className,parent) {
  var res,_currentNode=this.node,found=this.getNode(node);

  if (found) {
    this.setCurrentNode();
    res=this.createAgent(ac,args,level,className,parent);
    this.setCurrentNode(_currentNode);
  }
  return res;
}

/** Create a physical communication port
 *
 */
jam.prototype.createPort = function (dir,options,nodeid) {
  if (!options) options={};
  var multicast=options.multicast;
  switch (dir.tag) { 
    case Aios.DIR.NORTH: 
    case Aios.DIR.SOUTH: 
    case Aios.DIR.WEST: 
    case Aios.DIR.EAST: 
    case Aios.DIR.UP: 
    case Aios.DIR.DOWN: 
      multicast=false;
      break;
  }
  if (dir.ip && typeof dir.ip == 'string' && dir.ip.indexOf('//')>0) {
        // extract proto from url
        var addr = Aios.Amp.url2addr(dir.ip);
        if (!options.proto && addr.proto) options.proto=addr.proto;
        dir.ip=Aios.Amp.addr2url(addr);
  }
  if (options.from==undefined && dir.ip) options.from=dir.ip.toString();
  var  chan=this.world.connectPhy(
            dir,
            this.getNode(nodeid),
            {
              broker  :   options.broker,
              keepAlive : options.keepAlive,
              multicast : multicast,
              name  :     options.name,
              on    :     options.on,
              oneway  :   options.oneway,
              pem    :    options.pem,
              proto :     options.proto||'udp',
              rcv   :     options.from,
              secure :    options.secure,
              sharedSocket:options.sharedSocket,
              snd   :     options.to,
              verbose:(options.verbose!=undefined?options.verbose:this.verbose)
            });
  chan.init();
  chan.start();
  return chan;
}
/** Dynamically disconnect remote endpoint at run-time
 *
 */
jam.prototype.disconnect = function (to,nodeid) {
  var node=this.getNode(nodeid);
  if (node) {
    this.world.disconnect(to,node);
  }
}

/** Emit an event
 ** function emit(@event,@arg1,..)
 */
jam.prototype.emit = function () {
  Aios.emit.apply(this,arguments);
}


/** Execute an agent snapshot on current node delivered in JSON+ text format or read from a file. 
 */
jam.prototype.execute = function (data,file) {
  if (!data && file && fs) 
    try {
      data=fs.readFileSync(file,'utf8');
    } catch (e) {
      this.log('Error: Reading file '+file+' failed: '+e);
      return undefined;
    }
  if (data) return this.world.nodes[this.node].receive(data,true);
}

/** Execute an agent snapshot on node @node delivered in JSON+ text format or read from a file.
 */
jam.prototype.executeOn = function (data,node,file) {
  node=this.getNode(node);
  if (!node) return;
  if (!data && file && fs) 
    try {
      data=fs.readFileSync(file,'utf8');
    } catch (e) {
      this.log('Error: Reading file '+file+' failed: '+e);
      return undefined;
    }
  if (data) return node.receive(data,true);
}

/** Extend AIOS of specific privilege level. The added functions can be accessed by agents.
 *
 * function extend(level:number [],name:string,func:function,argn?:number|number []);
 */
jam.prototype.extend = function (level,name,funcOrObj,argn) {
  var self=this;
  if (Comp.obj.isArray(level)) {
    Comp.array.iter(level,function (l) {self.extend(l,name,funcOrObj,argn)});
    return;
  }
  function range(n) {
    var l=[];
    for(var i=0;i<n+1;i++) l.push(i);
    return l;
  }
  switch (level) {
    case 0: 
      if (Aios.aios0[name]) throw Error('JAM: Cannot extend AIOS(0) with '+name+', existst already!');
      Aios.aios0[name]=funcOrObj; break;
    case 1: 
      if (Aios.aios1[name]) throw Error('JAM: Cannot extend AIOS(1) with '+name+', existst already!');
      Aios.aios1[name]=funcOrObj; break;
    case 2: 
      if (Aios.aios2[name]) throw Error('JAM: Cannot extend AIOS(2) with '+name+', existst already!');
      Aios.aios2[name]=funcOrObj; break;
    case 3: 
      if (Aios.aios3[name]) throw Error('JAM: Cannot extend AIOS(3) with '+name+', existst already!');
      Aios.aios3[name]=funcOrObj; break;
    default:
      throw Error('JAM: Extend: Invalid privilige level argument ([0,1,2,3])');
  }
  if (!JamAnal.corefuncs[name]) {
    if (typeof funcOrObj == 'function')
      JamAnal.corefuncs[name]={argn:Comp.obj.isArray(argn)?argn:argn!=undefined?range(argn):range(funcOrObj.length)}; 
    else {
      // extend an object (may not be nested to get the type signature)
      var obj = {};
      Object.keys(funcOrObj).forEach(function (attr) {
        obj[attr]={argn:range(funcOrObj[attr].length)}; 
      });
      JamAnal.corefuncs[name]={obj:obj}; 
    }
  }
}

jam.prototype.getCurrentNode=function (asname) {
  if (!asname) return this.node;
  else return this.world.nodes[this.node].id;
}

/** Return node object referenced by logical node number, position, or name
 *  If @id is undefined return current node object.
 */
jam.prototype.getNode = function (id) {
  var node;
  if (id==undefined) return this.world.nodes[this.node];
  if (typeof id == 'number') 
    node=this.world.nodes[id];
  else if (typeof id == 'string') {
    // Search node identifier or position;
    loop: for(var i in this.world.nodes) {
      if (this.world.nodes[i] && this.world.nodes[i].id==id) {
        node = this.world.nodes[i];
        break loop;
      } 
    }
  } else if (id.x != undefined && 
             id.y != undefined) {
    // Search node position;
    loop: for(var i in this.world.nodes) {
      if (this.world.nodes[i] && Comp.obj.equal(this.world.nodes[i].position,id)) {
        node = this.world.nodes[i];
        break loop;
      } 
    }
  }
  
  return node;
} 

/** Return node name from logical node number or position
 *
 */
jam.prototype.getNodeName = function (nodeNumberorPosition) {
  var node=this.getNode(nodeNumberorPosition);  
  if (node) return node.id;
} 

/** Get current agent process or search for agent process
 *
 */
jam.prototype.getProcess = function (agent) {
  if (!agent)
    return Aios.current.process;
  else {
    var node = this.getNode();  // current node
    if (node) return node.getAgentProcess(agent);
  }
}


/** Return node name from logical node number or position
 *
 */
jam.prototype.getWorldName = function () {
  return this.world.id;
} 

/** Get info about node, agents, plattform
 *
 */
jam.prototype.info = function (kind,id) {
  switch (kind) {
    case 'node':
      var node=this.getNode(id);
      if (!node) return;
      return { 
        id:node.id, 
        position: node.position, 
        location:node.location,
        type:node.type 
      }
      break;
    case 'agent':
      var agent = this.getProcess(id);
      if (!agent) return;
      var code = Aios.Code.print(agent.agent,true);
      return {
        id:id,
        pid:agent.pid,
        level:agent.level,
        blocked:agent.blocked,
        suspended:agent.suspended,
        resources:agent.resources,
        code:code
      }
      break;
    case 'agent-data':
      var agent = this.getProcess(id);
      if (!agent) return;
      else return agent.agent;
      break;
    case 'version': return Aios.options.version;
    case 'host': return { 
      type:global.TARGET,
      watchdog:Aios.watchdog?true:false,
      protect: Aios.watchdog&&Aios.watchdog.protect?true:false,
      jsonify:Aios.options.json,
      minify:!Aios.Code.options.compactit,
    };
    case 'platform': return platform;     
  }
}

/** INITIALIZE
 *  1. Create and initialize node(s)/world
 *  2. Add optional TS provider/consumer
 *  3. Create physical network conenctions
 */
jam.prototype.init = function (callback) {
  var i=0,j=0, n, p, id, node, connect=[], chan, dir, dirs, pos,
      self=this;
  
  // Current node == root node
  this.node=0;

  ///////////// CREATE NODES /////////
  if (!this.options.network) {
    if (this.options.position) i=this.options.position.x,j=this.options.position.y;
    // Create one (root) node if not already existing
    if (!this.getNode({x:i,y:j})) {
      node = Aios.Node.Node({
          id:this.options.id,
          position:{x:i,y:j},
          TMO:this.options.TMO,
          type:this.options.type
        },true);
      // Add node to world
      if (this.verbose) this.log('Created '+(i==0&&j==0?'root ':'')+'node '+node.id+' ('+i+','+j+').');
      this.world.addNode(node);
    }
    // Register jamlib event handler for the root node
    this.register(node);
  } else if (!this.options.network.cluster) {
    // Create a virtual network of logical nodes. Default: grid
    if (this.options.network.rows && this.options.network.columns) {
      for(j=0;j<this.options.network.rows;j++) 
        for(i=0;i<this.options.network.columns;i++) {
          node = Aios.Node.Node({id:Aios.aidgen(),position:{x:i,y:j},TMO:this.options.TMO},true);
          if (this.verbose) this.log('Created node '+node.id+' at ('+i+','+j+').');
          if (i==0&&j==0) {
            // Register jamlib event handler for the root node
            this.register(node);
          }
          this.world.addNode(node);
        }
      // Connect nodes with virtual links
      for(j=0;j<this.options.network.rows;j++) 
        for(i=0;i<this.options.network.columns;i++) {
          if (i+1<this.options.network.columns)  connect.push({x1:i,y1:j,x2:i+1,y2:j});
          if (j+1<this.options.network.rows)  connect.push({x1:i,y1:j,x2:i,y2:j+1});
        }
      if (this.options.network.connect) connect=connect.filter(this.options.network.connect);
      this.connectNodes(connect);
    }
  } else if (this.options.network.cluster && this.options.fork) {
      // Physical network cluster; each node is executed in a process on this host
      dirs=[DIR.ORIGIN,DIR.EAST,DIR.SOUTH,DIR.SE,DIR.WEST,DIR.SW,DIR.NORTH,DIR.NW,DIR.NE];
      pos={x:[0,1,0,1,-1,-1,0,-1,1],
           y:[0,0,1,1,0,1,-1,-1,-1]};
      // Create a physical network of nodes. Here create only the root node (0,0)
      this.cluster=[]; this.master=true;
      for(j=0;j<this.options.network.rows;j++) 
        for(i=0;i<this.options.network.columns;i++) {
          id=Aios.aidgen();
          if (i==0 && j==0) {
            dir=undefined;
            node = Aios.Node.Node({id:id,position:{x:i,y:j},TMO:this.options.TMO},true);
            if (this.verbose) this.log('Created root node '+node.id+' at ('+i+','+j+').');
            // Register jamlib event handler for the root node
            this.register(node);
            this.world.addNode(node); 
            this.setCurrentNode(id);
          } else {
            n=i+j*this.options.network.columns;
            dir=dirs[n];
            if (this.verbose) this.log('Started cluster node '+id+' at ('+i+','+j+'). with link '+DIR.print(dir));
            this.cluster[id]=this.options.fork(process.argv[1],['autosetup:'+JSON.stringify({
              id:id,
              world:this.world.id,
              cluster:true,
              network:null,
              position:{x:pos.x[n],y:pos.y[n]},
              dir:dir,
              connections:{
                stream:{
                  dir:DIR.opposite(dir)
                }
              }
            })]);
            this.cluster[id].dir=dir;
            // Clustered forked nodes communicate via process.send, receive message via process.on('message') handler
          }
        }
      // Create physical stream links to all child nodes
      for(p in this.cluster) {
        chan=this.world.connectPhy(
            this.cluster[p].dir,
            this.getNode(),
            {
              proto:'stream',
              sock:this.cluster[p],
              mode:'object',
              verbose:this.verbose
            });
        chan.init();                
      }
  }

  //////////// Install host platform tuple provider and consumer //////////
  
  /*
  ** Each time a tuple of a specific dimension is requested by an agent (rd) 
  ** the provider function can return (provide) a mathcing tuple (returning the tuple).
  ** IO gate between agents/JAM and host application.
  */
  if (this.options.provider) this.world.nodes[this.node].ts.register(function (pat) {
    // Caching?
    return self.options.provider(pat);
  });

  /*
  ** Each time a tuple of a specific dimension is stored by an agent (out) 
  ** the consumer function can return consume the tuple (returning true).
  ** IO gate between agents/JAM and host application.
  */
  if (this.options.consumer) this.world.nodes[this.node].ts.register(function (tuple) {
    // Caching?
    return self.options.consumer(tuple);
  },true);
  
  ///////////// CREATE NETWORK CONNECTIVITY /////////

  // Register host application connections {send,status,count,register?} using host app. streams or
  // create physical conenction ports (using the AMP P2P protocol over IP/RS232) {from:*,proto:'udp'|..}
  if (this.options.connections) {
    for (p in this.options.connections) {
      conn=this.options.connections[p];
      if (!conn) continue;
      
      if (p=='ip' || conn.proto) {
        // 1. IP
        // Attach AMP port to root node, actually not linked with endpoint
        n=1;
        switch (p) {
          case 'ip': 
            dir=this.DIR.IP(this.options.connections.ip.from||'*');
                                                        // actually not linked with endpoint
            n = (conn.range && conn.range.length==2 && (conn.range[1]-conn.range[0]+1))||
                conn.num||
                1; // multiple interface are allowed
            break;
          case 'north': dir=this.DIR.NORTH; break;
          case 'south': dir=this.DIR.SOUTH; break;
          case 'west': dir=this.DIR.WEST; break;
          case 'east': dir=this.DIR.EAST; break;
          case 'up': dir=this.DIR.UP; break;
          case 'down': dir=this.DIR.DOWN; break;
        }
        function makeAddr(ip,i) {
          if (!conn.range) return ip;
          else return ip+':'+(conn.range[0]+i);
        }
        for(i=0;i<n;i++) {
          chan=this.world.connectPhy(
            dir,
            this.getNode(),
            {
              broker:conn.broker,
              multicast:conn.multicast,
              name:conn.name,
              on:conn.on,
              oneway:conn.oneway,
              proto:conn.proto||'udp',
              rcv:makeAddr(conn.from,i),
              snd:conn.to,
              verbose:this.verbose
            });
          chan.init();
        }
      } else if (conn.send) {
        // 2. Host stream interface
        node=this.world.nodes[this.node]; // TODO: connections.node -> world node#
        function makeconn (p,conn) {
          var link = { 
            _handler:[],
            emit: function (event,msg) {
              if (link._handler[event]) link._handler[event](msg);
            },
            on: function (event,callback) {
              link._handler[event]=callback;
            },
            send: function (data,dest,context) {
              var res;
              self.world.nodes[self.node].connections[p]._count += data.length;
              res=conn.send(data,dest);
              if (!res) {
                context.error='Migration to destination '+dest+' failed';
                // We're still in the agent process context! Throw an error for this agent ..
                throw 'MOVE';              
              };

              // kill ghost agent
              context.process.finalize();
            },
            status : conn.status?conn.status:(function () {return true}),
            count: conn.count?conn.count:function () {return link._count},
            _count:0
          };
          if (conn.register) conn.register(link);
          return link;       
        }
        node.connections[p] = makeconn(p,conn);
        // register agent receiver and signal handler
        node.connections[p].on('agent',node.receive.bind(node));
        node.connections[p].on('signal',node.handle.bind(node));
      } else if (p=='stream') {
        // 3. Physical process stream interface (cluster); child->parent proecss connection
        chan=this.world.connectPhy(
            conn.dir,
            this.getNode(),
            {
              proto:'stream',
              sock:process,
              mode:'object',
              verbose:this.verbose
            });
        chan.init();
      }    
    } 
  }
  if (callback) callback();

}


/** Tuple space input operation - non blocking, i.e., equiv. to inp(pat,_,0)
 */
jam.prototype.inp = function (pat,all) {
  return this.world.nodes[this.node].ts.extern.inp(pat,all);
}


/** Kill agent with specified id ('*': kill all agents on node or current node)
 */
jam.prototype.kill = function (id,node) {
  if (id=='*') {
    this.world.nodes[this.node].processes.table.forEach(function (p) {
      if (p) Aios.kill(p.agent.id);
    });
  } else
    return Aios.kill(id);
}

/** Try to locate this node (based on network connectivity)
 *  Any geospatial information is attached to current (node=undefined) or specific node
 */
 
jam.prototype.locate = function (nodeid,cb,options) {
  if (typeof nodeid == 'function') { options=cb;cb=nodeid;nodeid=0};
  if (typeof nodeid == 'object') { options=nodeid;cb=null;nodeid=0};
  var node=this.getNode(nodeid);
  if (!node) return;
  return GeoLoc5.locate(function (location,errors) {
    node.location=node.location||{};
    Object.assign(node.location,location);
    if (cb) cb(location,errors);
  },options);
}
/** Lookup nodes and get connection info (more general as connected and broker support)
 *
 */
jam.prototype.lookup = function (dir,callback,nodeid) {
  var node=this.getNode(nodeid);
  if (!node) return;
  return this.world.lookup(dir,callback,node);
}

/** Tuple space output operation with timeout 
 */
jam.prototype.mark = function (tuple,tmo) {
  return this.world.nodes[this.node].ts.extern.mark(tuple,tmo);
}


/** Execute an agent snapshot in JSON+ text form after migration provided from host application
 */
jam.prototype.migrate = function (data) {
  return this.world.nodes[this.node].receive(data,false);
}

/** Install event handler
*
*   typeof @event = {'agent','agent+','agent-','signal+','signal','link+','link-',..}
*   agent+/agent-: Agent creation and destruction event
*   agent: Agent receive event
*   signal+: Signal raise event
*   signal: Signal receive (handle) event
*   route+: A new link was established
*   route-: A link is broken
*/

jam.prototype.on = function (event,handler) {
  Aios.on(event,handler);
}

/** Remove event handler
 */
jam.prototype.off = function (ev) {
  Aios.off(event); 
}



/** Read and parse one agent class from file. Can contain nested open statements.
 *  Browser (no fs module): @file parameter contains source text.
 *  File/source text format: function [ac] (p1,p2,..) { this.x; .. ; this.act = {..}; ..}
 *  open(file:string,options?:{verbose?:number|boolean,classname?:string}) -> function | object
 *  
 *  Output can be processed by method compileClass
 */
jam.prototype.open = function (file,options) {
  var self=this,
      res,
      text,
      name,
      ast=null;
  if (!options) options={};
  name=options.classname||'<unknown>';
  if (options.verbose>0) this.log('Reading agent class template '+name+' from '+file);
  
  function parseModel (text) {
    var modu={},more,module={exports:{}},name=text.match(/[\s]*function[\s]*([a-z0-9]+)[\s]*\(/);
    if (name) name=name[1];
    function open(filename) {
      var text;
      try {
        text=fs?fs.readFileSync(filename,'utf8'):null;
        return parseModel(text);
      } catch (e) {
        self.log('Error: Opening of '+(fs?file:'text')+' failed: '+e); 
      }
    }
    try {
      with (module) {eval('res = '+text)};
      if (name) { modu[name]=res; return modu} 
      else if (module.exports) return module.exports; 
      else return res;
    } catch (e) {
      try {
        ast = Esprima.parse(text, { tolerant: true, loc:true });
        if (ast.errors && ast.errors.length>0) more = ', '+ast.errors[0];
      } catch (e) {
        if (e.lineNumber) more = ', in line '+e.lineNumber; 
      } 
      self.log(e.name+(e.message?': '+e.message:'')+(more?more:''));
    }
  }
  try {
    text=fs?fs.readFileSync(file,'utf8'):file;    // Browser: file parameter contains already source text
    return parseModel(text);
  } catch (e) {
    this.log('Error: Opening of '+(fs?file:'text')+' failed: '+e); 
  }  
};

/** Tuple space output operation 
 */
jam.prototype.out = function (tuple) {
  return this.world.nodes[this.node].ts.extern.out(tuple);
}

/** Tuple space read operation - non blocking, i.e., equiv. to rd(pat,_,0)
 */
jam.prototype.rd = function (pat,all) {
  return this.world.nodes[this.node].ts.extern.rd(pat,all);
}

/** 1. Read agent template classes from file and compile (analyze) agent constructor functions.
 *     Expected file format: module.exports = { ac1: function (p1,p2,..) {}, ac2:.. }
 *  2. Read single agent constructor function from file
 *
 * typeof @options={verbose,error:function}
 */
// TODO: clean up, split fs interface, no require caching ..
if (fs) jam.prototype.readClass = function (file,options) {
  var self=this,
      ac,
      name,
      env,
      interface,
      text,
      modu,
      path,
      p,m,
      regex1,
      ast=null,
      fileText=null,
      off=null;
  this.error=_;
  function errLoc(ast) {
    var err;
    if (ast && ast.errors && ast.errors.length) {
      err=ast.errors[0];
      if (err.lineNumber != undefined) return 'line '+err.lineNumber;
    }
    return 'unknown'
  }
  try {
    if (!options) options={};
    if (options.verbose>0) this.log('Looking up agent class template(s) from '+file);
    //modu=Require(file);
    if (Comp.obj.isEmpty(modu)) {
      if (options.verbose>0) this.log('Reading agent class template(s) from file '+file);
      if (Comp.string.get(file,0)!='/') 
        path = (process.cwd?process.cwd()+'/':'./')+file;
      else
        path = file;
      fileText=fs.readFileSync(path,'utf8');
      ast=Esprima.parse(fileText, { tolerant: true, loc:true });
      if (require.cache) delete require.cache[file]; // force reload of file by require
      modu=require(path);
      if(Comp.obj.isEmpty(modu)) {
        modu={};
        // Try evaluation of fileText containing one single function definition
        if (!fileText) throw 'No such file!';
        name=fileText.match(/[\s]*function[\s]*([a-z0-9]+)[\s]*\(/);
        if (!name) throw ('Export interface of module is empty and file contains no valid function definition!');
        name=name[1];
        eval('(function () {'+fileText+' modu["'+name+'"]='+name+'})()');        
      }
    }
    if (!modu || Comp.obj.isEmpty(modu)) throw 'Empty module.';
    
    for (m in modu) {
      ac=modu[m];
      env={};

      if (fileText)       off=this.syntax.find(fileText,'VariableDeclarator',m);
      if (off && off.loc) this.syntax.offset=off.loc.start.line-1;

      content = 'var ac = '+ac;
      syntax = Esprima.parse(content, { tolerant: true, loc:true });
      interface = this.analyzeSyntax(syntax,
        {
          classname:m,
          level:2,
          verbose:  options.verbose||0,
          err:      options.error||function (msg){throw(msg)},
          out:      function (msg){self.log(msg)},
          warn:     function (msg){self.log(msg)}
        });
      // text=Json.stringify(ac);
      for (var p in interface.activities) env[p]=p;
      with (env) { eval(content) };

      if (options.verbose>0) this.log('Adding agent class constructor '+m+' ('+(typeof ac)+').');
      this.addClass(m,ac,env);
      this.syntax.offset=0;
    }
    this.error=undefined;
    return true;
  } catch (e) {
    this.error='Compiling agent class file "'+file+'" failed: '+e+
               (ast && ast.errors.length?', in '+errLoc(ast):'');
    if (options.error) 
      options.error(e+(ast && ast.errors.length?', in '+errLoc(ast):''));
    else {
      this.log(this.error);
    }
    return false;
  }
};

/** Register jamlib event handler for the (root) node
*/
jam.prototype.register = function (node) {
  this.on('agent', function (msg) { node.receive(msg) });
  this.on('signal', function (msg) { node.handle(msg) });
}

/** Disconnect and remove a virtual node from the world
 *
 */
jam.prototype.removeNode = function (nodeid) {
  this.world.removeNode(nodeid);  
}

/** Tuple space remove operation 
 */
jam.prototype.rm = function (pat,all) {
  return this.world.nodes[this.node].ts.extern.rm(pat,all);
}


/** Take an agent process snapshot executed currently on given node @node:number|string|undefined.
 *  If @file:string is not specified, a string containing the snapshot is
 *  returned, otehrwise it is saved to the file (text format. JSON+).
 *  If @node is undefined, the current node is used.
 *  If @kill is set, the agent is killed after taken the snapshot.
 */
jam.prototype.saveSnapshotOn = function (aid,node,file,kill) {
  var snapshot,pro;
  node=this.getNode(node);
  if (!node) return;
  // Look-up agent process ..
  pro=node.getAgentProcess(aid);
  if (!pro) return;
  // Take snapshot od the process ..
  snapshot=Aios.Code.ofCode(pro,false);
  if (kill) Aios.killOn(aid,node);
  // Save it ..
  if (!file) return snapshot;
  else if (fs) return fs.writeFileSync(file, snapshot, 'utf8');
}

jam.prototype.saveSnapshot = function (aid,file,kill) {
  return this.saveSnapshotOn(aid,_,file,kill);
}

/** Force a scheduler run immediately normally executed by the
 *  jam service loop. Required if there were externeal agent 
 *  management, e.g., by sending signals.
 */
jam.prototype.schedule = function () {
  if (this.loop) {
    clearTimeout(this.loop);
    setImmediate(this.looping);
  } else if (!this.run) setImmediate(this.looping);
}


/** Access to JAM security module
 *
 */
jam.prototype.security = Aios.Sec;

/** Set current node (by index number or node name)
 *
 */
jam.prototype.setCurrentNode=function (n) {
  if (typeof n == 'number') {
    if (n>=0 && n < this.world.nodes.length) this.node=n;
  } else if (typeof n == 'string') {
    this.node=this.world.nodes.indexOf(this.world.getNode(n))
  }
  current.node=this.world.nodes[this.node];
}

/** Send a signal to a specific agent 'to'.
 *
 */
jam.prototype.signal=function (to,sig,arg,broadcast) {
  var node=this.getNode(),
      _process=Aios.current.process;
  Aios.current.process=this.process;
  if (!broadcast)
    Aios.aios.send(to,sig,arg);
  else  
    Aios.aios.broadcast(to,sig,arg);    
    
  Aios.current.process=_process;
  this.schedule();
}


/** Set-up connections, start the JAM, but not the scheduler (used in single-step mode)
 *
 */
jam.prototype.start0=function (callback) {
  if (this.run) return;
  var self=this,cbl=CBL(callback);
  // Start all connections if not already done
  
  this.world.nodes.forEach(function (node) {
    node.connections.forEach(function (chan,kind) {
      if (!chan) return;
      if (chan.start) cbl.push(function (next) {chan.start(next)});
    });
  });
  cbl.start();
  
  Aios.on('schedule',function () {
    self.schedule();
  });

  this.world.start();
  if (this.verbose) this.log('Starting JAM .. ');
  return;
}

/** Set-up connections,  start the JAM scheduler
 *
 */
jam.prototype.start=function (callback) {
  if (this.run) return;
  var self=this,
      current=Aios.current,
      cbl=CBL(callback);
  // Start all connections if not already done
  
  this.world.nodes.forEach(function (node) {
    node.connections.forEach(function (chan,kind) {
      if (!chan) return;
      if (chan.start) cbl.push(function (next) {chan.start(next)});
    });
  });
  cbl.start();
  
  Aios.on('schedule',function () {
    self.schedule();
  });

  function loop() {
    var loop = function () {
      var nexttime,curtime;
      if (self.verbose>3) self.log('loop: Entering scheduler #'+self.ticks);
      self.ticks++;

      nexttime=Aios.scheduler();
      curtime=Aios.time();
      if (self.verbose>3) self.log('loop: Scheduler returned nexttime='+nexttime+
                                           ' ('+(nexttime>0?nexttime-curtime:0)+')');
      if (!self.run) return;
      if (nexttime>0) 
        self.loop=setTimeout(loop,nexttime-curtime);
      else if (nexttime==0) 
        self.loop=setTimeout(loop,1000);
      else setImmediate(loop);
      // else setTimeout(loop,10);
    };
    self.loop = setTimeout(loop,1);
  };
  this.looping=loop;
  
  Aios.config({iterations:100});

  this.run=true;
  this.world.start();
  if (this.verbose) this.log('Starting JAM loop .. ');
  if (!this.options.scheduler) loop(); // Start internal scheduling loop
}

/** Get agent process table info and other statistics
 *
 *  type kind = 'process'|'agent'|'node'|'vm'|'conn'
 */
 
 
jam.prototype.stats = function (kind,id) {
  var p,n,sys,conn,pro,agent,state,stats,allstats={},signals,node;
  switch (kind) {
    case 'process':      
    case 'agent':      
      for(n in this.world.nodes) {        
        stats={};
        node=this.world.nodes[n];
        for (p in node.processes.table) {
          if (node.processes.table[p]) {
            pro=node.processes.table[p];
            if (pro.signals.length == 0) signals=[];
            else signals = pro.signals.map(function (sig)  {return sig[0] });
            agent=pro.agent;
            if (pro.suspended) state='SUSPENDED';
            else if (pro.blocked) state='BLOCKED';
            else if (pro.dead) state='DEAD';
            else if (pro.kill) state='KILL';
            else if (pro.move) state='MOVE';
            else state='READY';
            stats[agent.id]={
              pid:pro.pid,
              gid:pro.gid,
              state:state,
              parent:pro.agent.parent,
              class:pro.agent.ac,
              next:agent.next,
              resources:Comp.obj.copy(pro.resources)
            };
            if (signals.length) stats[agent.id].signals=signals;
          }
        }
        allstats[node.id]=stats;
      }
    break;
    case 'node':
      return Comp.obj.copy(this.getNode(id).stats);
    break;
    case 'conn':
      for(n in this.world.nodes) {        
        stats={};
        node=this.world.nodes[n];
        for (p in node.connections) {
          conn=node.connections[p];
          if (conn) {
            stats[p]={count:conn.count(),conn:conn.status('%')};
          }
        }
        allstats[node.id]=stats;
      }
    break;
    case 'vm':
      // Return VM memory usage in kB units and VM system information
      if (process && process.memoryUsage) {
        sys=process.memoryUsage();
        for ( p in sys) sys[p] = (sys[p]/1024)|0;
        sys.v8 = process.versions && process.versions.v8;
        sys.node = process.versions && process.versions.node;
        sys.arch = process.arch;
        sys.platform = process.platform;
        sys.watchdog = Aios.watchdog?(Aios.watchdog.checkPoint?'semi':'full'):'none'; 
        return sys;
      }
    break;
  }
  if (this.world.nodes.length==1) return stats;
  else return allstats;
}

/** Stepping the scheduler loop 
 */
jam.prototype.step = function (steps,callback) {
  // TODO: accurate timing
  var self=this,
      sync=callback===true,
      milliTime=function () {return Math.ceil(Date.now())},
      current=Aios.current,
      curtime=Aios.time(),// Aios.time();
      lasttime=curtime;

      
  function loop () {
    var loop = function () {
      var nexttime,curtime;
      if (self.verbose>1) self.log('loop: Entering scheduler #'+self.ticks);
      self.ticks++,self.steps--;
      self.time=curtime=Aios.time();

      // Execute scheduler loop
      nexttime=Aios.scheduler();
      
      curtime=Aios.time();
      if (self.verbose>3) self.log('loop: Scheduler returned nexttime='+nexttime+
                                           ' ('+(nexttime>0?nexttime-curtime:0)+')');
      if (sync) {
        self.time=curtime;
        return;
      }
      if (self.steps==0 || !self.run) {
        self.loop=none;
        self.run=false;
        self.time=curtime;
        if (callback) callback();
        return;              
      }
      if (nexttime>0) 
        self.loop=setTimeout(loop,nexttime-curtime);
      else if (nexttime < 0) self.loop=setImmediate(loop);
      else {
        self.loop=none;
        self.run=false;
        self.time=curtime;
        if (callback) callback();        
      }
    };
    if (sync) loop();
    else self.loop = setTimeout(loop,1);
  };
  this.looping=loop;
  
  Aios.config({iterations:1});
  this.steps=steps;
  this.run=true;
  if (this.time>0) current.world.lag=current.world.lag+(curtime-this.time);
  this.time=curtime;
  if (!this.options.scheduler) {
    if (sync) {
      this.run=true;
      for(var step=0;step<steps;step++) loop();
      this.run=false;
    } else 
      loop(); // Start internal scheduling loop
  }
}


/** Stop the JAM scheduler and all network connections
 * 
 */
jam.prototype.stop=function (callback) {
  if (!this.run) return;
  this.run=false,cbl=CBL(callback);
  this.log('Stopping JAM ..');
  Aios.off('schedule');
  if (this.loop)
    clearTimeout(this.loop);
  this.world.nodes.forEach(function (node) {
    node.connections.forEach(function (chan,kind) {
      if (!chan) return;
      if (chan.stop) cbl.push(function (next) {chan.stop(next)});
    });
  });
  cbl.start();
}
/** Tuple space test operation - non blocking
 */
jam.prototype.test = function (pat) {
  return this.world.nodes[this.node].ts.extern.exists(pat);
}

/** Tuple space testandset operation 
 */
jam.prototype.ts = function (pat,callback) {
  return this.world.nodes[this.node].ts.extern.ts(pat,callback);
}

/** Get JAM time
 */
jam.prototype.time=function () {
  return Aios.time();
}

/** Get JAMLIB version
 */
jam.prototype.version=function () {
  return options.version;
}



var Jam = function(options) {
  var obj = new jam(options);
  return obj;
};

/** Embedded cluster setup and start; 
 * Provided by process arguments
 */
if (environment.autosetup) {
  try {
    var _options=JSON.parse(environment.autosetup);
    // console.log('['+process.pid+'] JAM cluster setup with options:',process.argv[_index+1]);
    jam.prototype.setup=function () {
      for(var p in _options) this.options[p]=_options[p];
    }
  } catch (e) {
    console.log('['+process.pid+'] JAM auto setup failed: '+e);
  }
}


module.exports = {
  Aios:Aios,
  Comp:Comp,
  Esprima:Esprima,
  Io:Io,
  Jam:Jam,
  Json:Json,
  environment:environment,
  options:options
}
