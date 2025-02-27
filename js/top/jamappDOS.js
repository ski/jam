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
 **    $CREATED:     13-12-16 by sbosse.
 **    $VERSION:     1.2.1
 **
 **    $INFO:
 **
 **    JAMDOS APP with terminal blessed UI
 **
 **    $ENDOFINFO
 */
global.config={simulation:false};

var Io = Require('com/io');
var Comp = Require('com/compat');
var Aios = Require('jam/aios');
var Name = Require('com/pwgen');
var current=Aios.current;
var Net = Require('dos/network');
var Buf = Require('dos/buf');
var Sch = Require('dos/scheduler');
var Conn = Require('dos/connection');
var Rpc = Require('dos/rpc');
var Std = Require('dos/std');
var Router = Require('dos/router');
var Obj = Comp.obj;
var Args = Comp.args;
var Status = Net.Status;
var Command = Net.Command;
var Dns = Require('dos/dns');
var Cs = Require('dos/capset');
var Getenv = Require('com/getenv');
var HostSrv = Require('dos/hostsrv');
var Run = Require('dos/run');
var RunSrv = Require('dos/runsrv');
var Esprima = Require('parser/esprima');
var Json = Require('jam/jsonfn');
var satelize = Require('dos/ext/satelize');
var UI = Require('ui/app/app');

var nameopts = {length:8, memorable:true, lowercase:true},
    Nameopts = {length:8, memorable:true, uppercase:true};

// Create top-level App with UI
var appTerm = function (_options) {
  var self=this,
      p;
  this.options = {
    amp:false,
    aport:6000,
    bip:'localhost',
    bport:3001,
    broker:true,
    default:true,
    dip : 'localhost',
    domain: 'default',
    dports : [],
    env:{},
    geo:undefined,
    hostname:Io.hostname(),
    hostport:undefined,
    http:false,
    keepalive:true,
    links:[],
    myip:'localhost',
    monitor:0,
    nodename:Name.generate(nameopts),   // pre-guess
    onexit:false,
    scheduler:none,
    start:false,
    tcpnet:1,
    verbose:0,
    worldname:Name.generate(Nameopts)
  };
  for(p in _options) this.options[p]=_options[p];
  
  this.err=function (msg,err) {
    Aios.aios.log('Error: '+msg); throw (err||'[JAM] Error');
  }
  this.warn=function (msg) {Aios.aios.log('Warning: '+msg);}
  
  this.out=function (msg) {Aios.aios.log(msg);}

  this.events=[];
  this.todo=[];
  this.exit = [];  
  this.netStatus = 'Uninitialized';

  this.scheduler=Sch.TaskScheduler();

  
  var log = function(){
  
    if (!current.node || !current.process) {
      self.print(arguments[0],_,_,self.logWin.log.bind(self.logWin));
    }
    else if (arguments.length==1)
      self.print(arguments[0],'['+current.node.id+':'+current.process.agent.id+':'+
                                  current.process.pid+':'+current.process.agent.ac+'] ',
                                  self.logWin.log.bind(self.logWin));
    else {
      for (var i in arguments) {
        if (i==0) 
          self.print(arguments[i],'['+current.node.id+':'+current.process.agent.id+':'+
                                      current.process.pid+':'+current.process.agent.ac+'] ',
                                      self.logWin.log.bind(self.logWin));
        else
          self.print(arguments[i],_,2,self.logWin.log.bind(self.logWin));
      }
    }
  };
  this.options.log=log;
  Aios.aios0.log=log;
  Aios.aios1.log=log;
  Aios.aios2.log=log;
  Aios.aios0.print=function(msg,depth) {return print(msg,_,depth,false)};
  Aios.aios1.print=function(msg,depth) {return print(msg,_,depth,false)};
  Aios.aios2.print=function(msg,depth) {return print(msg,_,depth,false)};
  Aios.aios0.sprint=function(msg,depth) {return print(msg,_,depth,true)};
  Aios.aios1.sprint=function(msg,depth) {return print(msg,_,depth,true)};
  Aios.aios2.sprint=function(msg,depth) {return print(msg,_,depth,true)};
  
  this.world = Aios.World.World([],{
    id:this.options.worldname,
    classes:this.classes,
    verbose:this.options.verbose
  });
  this.node = Aios.Node.Node({
    id:this.options.nodename,
    out:log,
    position:{x:0,y:0},
    verbose:this.options.verbose
  });
  this.world.addNode(this.node);
  
};

appTerm.prototype.emit=function (event,args) {
  var e;
  for (e in this.events) {
    var ev=this.events[e];
    if (ev[0]==event) ev[1](args);
  }
}

appTerm.prototype.netInit = function () {  
  var self=this;    
  this.out('Network initializing ..');
  this.options.privhostport= Net.uniqport();
  this.options.pubhostport = Net.prv2pub(this.options.privhostport);
  this.scheduler.Init();
  if (this.options.broker) {
    this.network  = Conn.setup(this.options);
    // Event propagation
    this.network.on('connect',function () {self.emit('connect')});
    this.network.on('disconnect',function () {self.emit('disconnect')});
    this.network.on('error',function () {self.emit('error')});
    this.router   = this.network.router;
    this.rpc      = this.network.rpc;
    this.std      = Std.StdInt(this.rpc,this.env);
    this.dns      = Dns.DnsInt(this.rpc,this.env);
    this.cs       = Cs.CsInt(this.rpc,this.env);
    this.hostsrv  = none; // requires router init., created on initialization
    Aios.current.network = this.network;
    this.netStatus = 'Initialized';
    // Register a DOS link-connection for agent migration  
    this.node.connections.dos = {
      send: function (text,dest,context) {
        self.node.connections.dos.count += text.length;
        if (Obj.isObject(dest)) // cap
        {
          var stat;
          // This schedule block must by passed to the global (DOS) scheduler!!
          Sch.B([
            function () {
              self.network.run.ps_migrate(dest,text,function (_stat) {              
                stat=_stat;
              });
            },
            function () {          
              if (stat!=Net.Status.STD_OK) {
                // context???
                context.error='Migration to server '+Net.Print.capability(dest)+' failed: '+Net.Print.status(stat);
                // We're still in the agent process context! Throw an error for this agent ..
                throw 'MOVE';              
              };

              // kill ghost agent
              context.process.finalize();
            }  
          ]);      
        } else if (Obj.isString(dest)) { // path

        }
      },
      status: function () {
        // TODO
        return self.network.status()==Net.Status.STD_OK;
      },
      count:0
    }
  }
}
  
appTerm.prototype.netStart = function () {  
  this.run=true;
  // Start up the network 
  this.network.init(this.network.start.bind(this));
  this.netStatus = 'Started';
  this.out('Network started.');
  this.scheduler.Run();
}

appTerm.prototype.netStop = function () {  
  this.run=false;
  // Start up the network 
  this.network.stop();
  this.netStatus = 'Uninitialized';
  this.out('Network stopped.');
}

appTerm.prototype.setupGui = function () {
  var self=this,
      page;
  // Information bar visible on all pages
  this.UI = UI.UI({
    pages:7,
    terminal:this.options.terminal||'xterm-color',
    title:'JAMAPP (C) Stefan Bosse'
  });
  this.UI.init();
  
  this.info = this.UI.info({
    top:this.UI.screen.height-3,
    width:this.UI.screen.width-2,
    label:'Information'
  });
  this.info.setValue('Not connected.');

  /* MENU */
  
  this.UI.pages[1].but1 = this.UI.button({left:1,content:'QUIT'});
  this.UI.pages[1].but1.on('press', function(data) {
    return process.exit(0);  
  });
  this.UI.pages[1].label1 = this.UI.label({center:true,top:1,content:'Menu'});
  this.UI.pages[1].but2 = this.UI.button({right:1,content:'SETUP'});
  this.UI.pages[1].but2.on('press', function(data) {
    self.UI.pages.hide('this');    
    self.UI.pages.show(2);
  });
  this.UI.pages[1].but3 = this.UI.button({top:4,center:true,color:'red',width:'80%',content:'Network'});
  this.UI.pages[1].but3.on('press', function(data) {
    self.UI.pages.hide('this');    
    self.UI.pages.show(4);
  });
  this.UI.pages[1].but4 = this.UI.button({top:8,center:true,width:'80%',content:'JAM'});
  this.UI.pages[1].but4.on('press', function(data) {
    self.UI.pages.hide(1);    
    self.UI.pages.show(5);
    if (self.netStatus != 'Connected') {
      var dia = self.UI.dialog({width:'50%',height:6,center:true,
              okButton     : 'Okay',
              cancelButton : 'Cancel'
      });
      dia.ask('You need to start the network service first!',function () {});
    }
  });
  this.UI.pages[1].but5 = this.UI.button({top:12,center:true,width:'80%',content:'Agents'});
  this.UI.pages[1].but5.on('press', function(data) {
    self.UI.pages.hide('this');    
    self.UI.pages.show(6);
  });
  this.UI.pages[1].but6 = this.UI.button({top:16,center:true,width:'80%',content:'Logging'});
  this.UI.pages[1].but6.on('press', function(data) {
    self.UI.pages.hide('this');    
    self.UI.pages.show(7);
  });
  /* SETUP */
  this.UI.pages[2].but1 = this.UI.button({left:1,content:'<< Menu'});
  this.UI.pages[2].but1.on('press', function(data) {
    self.UI.pages.hide('this');    
    self.UI.pages.show('prev');
  });
  this.UI.pages[2].label1 = this.UI.label({center:true,top:1,content:'Setup'});
  this.UI.pages[2].input1 = this.UI.input({top:4,left:4,label:'Broker IP Address',value:'localhost'});
  this.UI.pages[2].input2 = this.UI.input({top:8,left:4,label:'Broker IP Port',value:'3001'});
  this.UI.pages[2].input3 = this.UI.input({top:12,left:4,label:'Domain',value:'default'});
  
  if (this.UI.screen.height< 34) {
    this.UI.pages[2].but2 = this.UI.button({right:1,content:'More'});
    this.UI.pages[2].but2.on('press', function(data) {
    self.UI.pages.hide('this');    
    self.UI.pages.show('next');
    });
    this.UI.pages[3].but1 = this.UI.button({left:1,content:'<< Less'});
    this.UI.pages[3].but1.on('press', function(data) {
    self.UI.pages.hide('this');    
    self.UI.pages.show('prev');
    });
    this.UI.pages[3].label1 = this.UI.label({center:true,top:1,content:'Setup'});
    this.UI.pages[3].label2 = this.UI.label({left:4,top:4,content:'Protocol'});
    this.UI.pages[3].checkbox21 = this.UI.radiobutton({left:4,top:6,text:'HTTP',value:false,group:2});
    this.UI.pages[3].checkbox22 = this.UI.radiobutton({left:4,top:8,text:'TCPIP',value:true,group:2});
    
    this.UI.pages[3].label3 = this.UI.label({left:4,top:10,content:'Messages'});
    this.UI.pages[3].checkbox31 = this.UI.checkbox({left:4,top:12,text:'Agent ID',value:false});
    this.UI.pages[3].checkbox32 = this.UI.checkbox({left:4,top:14,text:'Parent ID',value:false});
    this.UI.pages[3].checkbox33 = this.UI.checkbox({left:4,top:16,text:'Time',value:false});    
  } else {

    this.UI.pages[2].label2 = this.UI.label({left:4,top:16,content:'Protocol'});
    this.UI.pages[2].checkbox21 = this.UI.radiobutton({left:4,top:18,text:'HTTP',value:false,group:2});
    this.UI.pages[2].checkbox22 = this.UI.radiobutton({left:4,top:20,text:'TCPIP',value:true,group:2});
    
    this.UI.pages[2].label3 = this.UI.label({left:4,top:22,content:'Messages'});
    this.UI.pages[2].checkbox31 = this.UI.checkbox({left:4,top:24,text:'Agent ID',value:false});
    this.UI.pages[2].checkbox32 = this.UI.checkbox({left:4,top:26,text:'Parent ID',value:false});
    this.UI.pages[2].checkbox33 = this.UI.checkbox({left:4,top:28,text:'Time',value:false});    
    
  }
  /* Network */
  this.UI.pages[4].but1 = this.UI.button({left:1,content:'<< Menu'});
  this.UI.pages[4].but1.on('press', function(data) {
    self.UI.pages.hide('this');    
    self.UI.pages.show(1);
  });
  this.UI.pages[4].label1 = this.UI.label({center:true,top:1,content:'Network'});
  this.UI.pages[4].but2 = this.UI.button({top:4,center:true,color:'green',width:'80%',content:'Start'});
  this.UI.pages[4].but2.on('press', function(data) {
    if (self.netStatus == 'Uninitialized') {
      self.netInit();
      self.netStart();
      self.UI.pages[4].info1.setValue('Network starting ..');
    }
  });
  this.UI.pages[4].but3 = this.UI.button({top:8,center:true,color:'red',width:'80%',content:'Stop'});
  this.UI.pages[4].but3.on('press', function(data) {
    if (self.netStatus != 'Uninitialized') {
      self.netStop();
      self.UI.pages[4].info1.setValue('Network stopping ..');
    }
  });

  this.UI.pages[4].info1 = this.UI.info({
    center:true,
    top:12,
    width:'80%',
    label:'Status'
  });  
  
  this.UI.pages[4].info1.setValue('Not connected.');

  /* JAM */
  this.UI.pages[5].but1 = this.UI.button({left:1,content:'<< Menu'});
  this.UI.pages[5].but1.on('press', function(data) {
    self.UI.pages.hide('this');    
    self.UI.pages.show(1);
  });
  this.UI.pages[5].label1 = this.UI.label({center:true,top:1,content:'JAM'});
  
  this.UI.pages[5].info1 = this.UI.info({top:4,left:4,width:self.UI.screen.width-8,label:'JAM World'});
  this.UI.pages[5].info2 = this.UI.info({top:8,left:4,width:self.UI.screen.width-8,label:'JAM Name'});
  this.UI.pages[5].info3 = this.UI.info({top:12,left:4,width:self.UI.screen.width-8,label:'JAM Domain'});
  this.UI.pages[5].info4 = this.UI.info({top:16,left:4,width:self.UI.screen.width-8,label:'JAM Status'});

  this.UI.pages[5].info1.setValue(this.options.worldname);
  this.UI.pages[5].info2.setValue(this.options.nodename);
  this.UI.pages[5].info3.setValue(this.options.domain);
  this.UI.pages[5].info4.setValue('Not started.');

  this.UI.pages[5].but2 = this.UI.button({right:1,content:'Start',color:'green'});
  this.UI.pages[5].but2.on('press', function(data) {
    
  });
  /* Agents */
  
  this.UI.pages[6].but1 = this.UI.button({left:1,content:'<< Menu'});
  this.UI.pages[6].but1.on('press', function(data) {
    self.UI.pages.hide('this');    
    self.UI.pages.show(1);
  });
  this.UI.pages[6].but2 = this.UI.button({right:1,content:'Clear'});
  this.UI.pages[6].but2.on('press', function(data) {
    self.msgWin.clear();
  });
  this.UI.pages[6].label1 = this.UI.label({center:true,top:1,content:'Agents'});
  this.UI.pages[6].log1 = this.UI.log({left:4,top:4,height:'50%',label:'Messages'});
  
  this.msgWin = this.UI.pages[6].log1;
  for(var i=0;i < 20; i++)
    this.msgWin.log('Message '+i);
  
  /* LOGGING */
  this.UI.pages[7].but1 = this.UI.button({left:1,content:'<< Menu'});
  this.UI.pages[7].but1.on('press', function(data) {
    self.UI.pages.hide('this');    
    self.UI.pages.show(1);
  });
  this.UI.pages[7].but2 = this.UI.button({right:1,content:'Clear'});
  this.UI.pages[7].but2.on('press', function(data) {
    self.logWin.clear();
  });
  this.UI.pages[7].label1 = this.UI.label({center:true,top:1,content:'Logging'});
  this.UI.pages[7].log1 = this.UI.log({left:4,top:4,label:'Logging'});
  
  this.logWin = this.UI.pages[7].log1;
  this.logWin.log('Ready.');
  
  this.UI.pages.show(1);
  this.UI.pages.hide(2);
  this.UI.pages.hide(3);
  this.UI.pages.hide(4);
  this.UI.pages.hide(5);
  this.UI.pages.hide(6);
  this.UI.pages.hide(7);

  this.info.setValue('Not connected. Currently: '+this.UI.pages[2].input1.getValue()+':'+this.UI.pages[2].input2.getValue());
  //console.log(this.pages[1]);
  this.update = function (full) {
  };

  this.UI.screen.key(['escape', 'q', 'C-c'], function(ch, key) {
    return process.exit(0);
  });

}
appTerm.prototype.init = function () {
  this.setupGui();
}

appTerm.prototype.io = function () {

}

appTerm.prototype.on=function (event,callback) {
  this.events.push([event,callback]);
}

// PRINT: Smart print function
appTerm.prototype.print = function (msg,header,depth,logger) {
  var self = this;
  var lines=[],
      line='';
  if (depth==_) depth=1;
  function isvec(obj) {return(Comp.obj.isArray(obj) && (obj.length == 0 || !Comp.obj.isArray(obj[0])))}
  function ismat(obj) {return(Comp.obj.isArray(obj) && obj.length > 0 && Comp.obj.isArray(obj[0]))}
  function mat(o,depth) {
      // matrix
      var lines=[];
      var line = '';
      if (header) {line=header; header=_};
      for (var j in o) {
        var row=o[j];
        line += Comp.printf.list(row,function (v) {
          return (Comp.obj.isArray(v)?(depth>0?'['+vec(v,depth-1)+']':'[..]'):
                                       Comp.obj.isObj(v)?(depth>0?obj(v,depth-1):'{..}'):v);
        });
        lines.push(line);
        line='';
      }    
      return lines;
  }
  function vec(v,depth) {
      // vector
      var lines=[];
      var line = '';
      if (header) {line=header; header=_};
      if (v.length==0) return(line+'[]');
      else {
        // can still contain matrix elements that must bes separated
        var sep='',sepi='';
        for (var p in v) {
          if (ismat(v[p])) {              
            //self.log.log(line); line='  ';
            if (depth>0) {
              lines = mat(v[p],depth-1);
              line += sep+'['; sepi='';
              Comp.array.iter(lines,function (line2) {
                line += sepi+'['+line2+']';
                sepi=',';
              });
              line += ']';
              sep=',';
            } else {
              line += sep+'[[..]]';
              sep=',';
            }
          }
          else if (isvec(v[p])) {
            //self.log.log(line); line='  ';
            line += sep+vec(v[p],depth-1);
            sep=',';
          }
          else {
            line += sep+(Comp.obj.isArray(v[p])?(depth>0?vec(v[p],depth-1):'[..]'):
                                                Comp.obj.isObj(v[p])?(depth>0?obj(v[p],depth-1):'{..}'):v[p]);
            sep=',';
          }
        }
        if (line!='') return line;
      }
  }
  function obj(o,depth) {
    var line='';
    var sep='';
    if (header) {line=header; header=_};
    line += '{';
    for (var p in o) {
      if (!Comp.obj.isFunction(o[p])) {
        line += sep + p+':'+
          (Comp.obj.isArray(o[p])?(depth>0?vec(o[p],depth-1):'[..]'):
                                  Comp.obj.isObj(o[p])?(depth>0?obj(o[p],depth-1):'{..}'):o[p]);
        sep=',';
      } else {
        line += sep + p+':'+'function()';
        sep=',';
      }
    }      
    return line+'}';
  }

  function str(s) {
    var line='';
    var lines=[];
    var lines2 = Comp.string.split('\n',msg);
    if (header) {line=header; header=_};
    if (lines2.length==1)
      lines.push(line+msg);
    else {
      Comp.array.iter(lines2,function (line2,i) {
        if (i==0) lines.push(line+line2);
        else lines.push(line2);
      });
    } 
    return lines;
  }

  if (ismat(msg)) lines = Comp.array.concat(lines,
                                            Comp.array.map(mat(msg,depth-1),function (line){
                                                return '    '+line}));
  else if (Comp.obj.isString(msg)) lines = Comp.array.concat(lines,str(msg));
  else if (isvec(msg)) lines.push(vec(msg,depth-1));
  else if (Comp.obj.isObj(msg)) lines.push(obj(msg,depth-1));
  else {
    if (header) {line=header; header=_};
    line += msg;
    lines.push(line);      
  }

  if (logger==undefined) return lines; else 
    Comp.array.iter(lines,function (line) {logger(line)});    
}

appTerm.prototype.start = function () {
  this.UI.start(); 
  this.out('Initializing ..');
  //setTimeout(function (){process.exit(0)},10000);
}

var App = function(options) {
  var obj=none;
  obj = new appTerm(options);
  return obj;
}

var JA = App();
JA.init ();
JA.start ();

