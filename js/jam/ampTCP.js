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
 **    $CREATED:     02-11-18 by sbosse.
 **    $RCS:         $Id: ampTCP.js,v 1.1 2020/02/03 09:45:01 sbosse Exp sbosse $
 **    $VERSION:     1.19.1
 **
 **    $INFO:
 **
 **  JAM Agent Management Port (AMP) over TCP
 **  Three modes: 
 **    (A) Pair of ad-hoc connections for each message
 **    (B) Pair of permanent connections with message stream; keepAlive:true
 **    (C) Single permanent connection from "client" to "server", i.e., an AMP handler for each socket, sharedSocket:true
 **        => for client behind NATs?
 **
 **  Supports:
 **
 **   - Unicast link
 **   - Multicast link
 **  
 **  Default mode A: A TCP connection is opened each time a message has to be sent and closed after transfer is finished.
 **  (Workaround for wine+wineserver - WIN32 node.js / nw.js bug, probably a libuv wine bug)
 **
 **  Simplified data transfer: No requirement for data fragmentation!
 **
 **  Events out: 'error','route+','route-'
 **
 **  TODO:  
 **        - Garbage collection
 **
 **  New:
 **     - No size limit of data transfers
 **
 **    $ENDOFINFO
 */
var Io = Require('com/io');
var Lz = Require('os/lz-string');
var Comp = Require('com/compat');
var Buf = Require('dos/buf');
var Net = Require('dos/network');
var Sec = Require('jam/security');
var Command = Net.Command;
var Status = Net.Status;
var current=none;
var Aios=none;
var CBL = Require('com/cbl');

var COM = Require('jam/ampCOM'),
    AMMode=COM.AMMode,
    AMMessageType=COM.AMMessageType,
    AMState=COM.AMState,
    amp=COM.amp,
    options=COM.options,
    url2addr=COM.url2addr,
    addr2url=COM.addr2url,
    obj2url=COM.obj2url,
    addrequal=COM.addrequal,
    resolve=COM.resolve,
    ipequal=COM.ipequal,
    doUntilAck=COM.doUntilAck,
    getNetworkIP=COM.getNetworkIP,
    magic=COM.options.magic;

module.exports.current=function (module) { current=module.current; Aios=module; };

var net = require('net');

var dgram = Require('dgram');



/** AMP port using TCP
 *  ==================
 *
 * type url = string
 * type amp.tcp = function (options:{rcv:address,snd?:address,verbose?,logging?,out?:function,log?:number,broker?:address})
 * type address = {address:string,port:number}
 */
amp.tcp = function (options) {
  var self=this;
  options=checkOptions(options,{});
  this.options=options;
  this.proto = 'tcp';
  // Some sanity checks
  if (options.oneway && options.multicast) this.err('Invalid: Both ONEWAY and MULTICAST modes enabled!');

  this.verbose=checkOption(options.verbose,0);
  if (!options.rcv) options.rcv=url2addr('localhost:*');

  if (this.verbose>2) console.log(options);

  this.dir    = options.dir;                        // attached to JAM port
  this.rcv    = options.rcv;                        // IP (this side) address
  this.broker = options.broker;                     // IP (rendezvous broker) address
  this.node   = options.node;                       // Attached to this node
 
  this.port = options.port||Net.uniqport();               // This AMP Port
  this.secure = this.options.secure;
  this.client = {};

  this.keepAlive    = checkOption(options.keepAlive,false);
  this.sharedSocket = checkOption(options.sharedSocket,false);

  if (this.broker && !this.broker.port) 
    Io.err('[AMP] No broker port specified!');

  this.out = function (msg) {
    Aios.print('[AMP '+Net.Print.port(self.port)+
              (self.dir?(' '+Aios.DIR.print(self.dir)):'')+'] '+msg);
  }
  this.err = function (msg) {
    Aios.print('[AMP '+Net.Print.port(self.port)+
              (self.dir?(' '+Aios.DIR.print(self.dir)):'')+'] Error: '+msg);
    throw 'AMP';
  }
  

  // Virtual link table
  // MULTICAST (P2N) mode: link cache [{addr,live,state}] of all connected links
  // UNICAST (P2P): One link only, remebered by this.url!
  this.links={};
  
  if (options.snd) {
    url=addr2url(options.snd,true);
    this.links[url]={
        snd:options.snd,
        tries:0,
        state:this.broker?AMState.AMS_AWAIT:AMState.AMS_NOTCONNECTED,
        live:COM.AMC_MAXLIVE
      };
    if (this.verbose>0) this.out('Added destiantion route '+url+', '+Io.inspect(this.links[url]));
    if (!options.multicast) this.url=url;  // Remember this link
  } 
  if (this.broker) {
    // Create a root path that handles all brokerag and pairing
    url='*';
    this.links[url]={
        tries:0,
        state:AMState.AMS_RENDEZVOUS,
        live:COM.options.AMC_MAXLIVE,
        queue:{pairing:[],lookup:[]}
      };
    if (this.verbose>0) this.out('Added default registration route '+url);    
  }                                     
  this.rcv.name=options.name;                             // Optional name of this port

  this.mode = options.multicast?AMMode.AMO_MULTICAST:AMMode.AMO_UNICAST;
  if (options.oneway) this.mode |= AMMode.AMO_ONEWAY;       // Oneway: No link negotation; no ack.

  this.sock = undefined;                   // Receiver socket

  this.count={rcv:0,snd:0,lnk:0,png:0};

  this.timer=undefined;
  this.inwatchdog=false;

  this.events = [];
  this.transactions = Comp.hashtbl.create();
  
  this.logs=[];
  this.logging=options.logging||false;
  if (this.logging) {
    setInterval(function () { self.LOG('print') },5000);
  }
};

amp.tcp.prototype.LOG = amp.man.prototype.LOG;  
amp.tcp.prototype.addTransaction = amp.man.prototype.addTransaction;
amp.tcp.prototype.checkState = amp.man.prototype.checkState;
amp.tcp.prototype.deleteTransaction = amp.man.prototype.deleteTransaction;
amp.tcp.prototype.emit = amp.man.prototype.emit;
amp.tcp.prototype.findTransaction = amp.man.prototype.findTransaction;
amp.tcp.prototype.handle = amp.man.prototype.handle;
amp.tcp.prototype.on = amp.man.prototype.on;
amp.tcp.prototype.status = amp.man.prototype.status;



/** Initialize AMP
 *
 */
amp.tcp.prototype.init = function(callback) { 
  if (callback) callback();
};

/** Negotiate (create) a virtual communication link (peer-to-peer).
 *
 *  The link operation can be called externally establishing a connection or internally.
 *
 *  In oneway mode only a destination endpoint is set and it is assumed the endpoint can receive messages a-priori!
 *
 * typeof @snd = address
 * typeof @callback = function
 * typeof @connect = boolean is indicating an initial connect request and not an acknowledge
 * typeof @key = string 
 * +------------+
 * VCMessageType (int16)
 * Connection Port (port)
 * Node ID (string)
 * Receiver IP Port (int32)
 * +------------+
 *
 */
 
amp.tcp.prototype.link=function(snd,connect,key) {
  var self = this,
      url  = addr2url(snd,true), 
      buf = Buf.Buffer();

  if (this.verbose>1) this.out('amp.link: to '+(snd && snd.address) + ':' + ((snd && snd.port) || '*'));
  snd=this.updateLinkTable(snd||(this.url && this.links[this.url].snd) ,connect,key);

  if (snd && snd.parameter && snd.parameter.secure) key=snd.parameter.secure;

  if (!snd) return this.watchdog(true);

  // Create sockets here for permanent TCP sessions
  if ((this.keepAlive || this.sharedSocket) && 
      (!this.client[url] || !this.client[url].socket)) {
    if (!this.client[url]) this.client[url]={busy:false,id:Math.random(),connected:false,queue:[]}
    if (!this.client[url].socket) {
      if (self.verbose>1) console.log('amp.link Creating keepAlive socket for client '+url);
      this.client[url].socket=new net.Socket();
      this.client[url].connected=false;
      this.client[url].socket.on('close', function () {
        console.log('close',url);
        delete self.client[url];
      });
      this.client[url].socket.on('error', function (err) {
        if (self.verbose>1) console.log('error',url,err)
        delete self.client[url];
      });        
    }
    if (this.sharedSocket && !this.rcv.port) {
      // TODO bind receiver
      if (self.verbose>1) console.log('amp.link Creating sharedSocket receiver for client '+url);
      this.receiverSocket(this.client[url].socket);
      if (!this.inwatchdog) {
        this.watchdog(true);
      }
    }
    this.client[url].busy=true;
    console.log('Connecting to client '+url);
    this.client[url].socket.connect(snd.port,snd.address, function () {
      var rcv=self.sharedSocket?self.client[url].socket.address():self.rcv;
      if (self.verbose>1) console.log('amp.link.connect:',url,rcv)
      self.client[url].rcv=rcv;
      self.client[url].busy=false;
      send(self.client[url].rcv.port);
    });  
    this.client[url].connected=true;
    return;
  }
  function send(rcvport) {
    if (self.verbose>1) self.out('amp.link.send: '+url+' rcvport='+rcvport);
    Buf.buf_put_int16(buf, magic);
    Buf.buf_put_int16(buf, AMMessageType.AMMLINK);
    Buf.buf_put_port(buf,self.port);          // This AMP id
    Buf.buf_put_string(buf,self.node?self.node.id:'*');
    Buf.buf_put_string(buf,key?key:'');
    Buf.buf_put_int32(buf, rcvport);
    // Buf.buf_put_int32(buf, this.rcv.port);
    self.count.snd += Buf.length(buf);
    self.count.lnk++;

    self.write(buf.data,0,Buf.length(buf),snd.port,snd.address,function (err) {
        if (err) {
            // self.close();
            self.emit('error',err);
        } 
    });
  }
  send(this.sharedSocket && this.client[url] && this.client[url].rcv?this.client[url].rcv.port:this.rcv.port);
};

// Ask broker for registered hosts/nodes
amp.tcp.prototype.lookup = function(path,callback) {
  var link=this.links['*'];
  if (!link && callback) return callback([]);
  if (callback) link.queue.lookup[path]=callback;
  this.send(
    {type:'lookup',name: this.rcv.name, linfo: this.rcv, data:path },
    this.broker,
    function () {}
  );

}

// Return link for destination
amp.tcp.prototype.lookupLinkTable=function(snd) {
  if (this.url) return this.links[this.url]; // Unicast mode
  if (!snd) return;
  var url = obj2url(snd);
  return this.links[url];
}



/**
 *
 * typeof @snd = address
 * typeof @callback = function
 *
 * +------------+
 * AMMessageType (int16)
 * Connection Port (port)
 * Receiver IP Port (int32)
 * +------------+
 */
amp.tcp.prototype.ping=function(snd) {
  var self = this,
      buf = Buf.Buffer();

  Buf.buf_put_int16(buf, magic);
  Buf.buf_put_int16(buf, AMMessageType.AMMPING);
  Buf.buf_put_port(buf,this.port);
  if (!this.sharedSocket)
    Buf.buf_put_int32(buf,this.rcv.port);         // For reply
  else // from this.client[url]
  Buf.buf_put_int32(buf,this.client[url] && this.client[url].rcv?this.client[url].rcv.port:this.rcv.port);         // For reply  

  if (this.mode&AMMode.AMO_UNICAST) {
    if (snd==undefined || snd.address==undefined) snd={},snd.address=this.links[this.url].snd.address;
    if (snd.port==undefined) snd.port=this.links[this.url].snd.port;
  } 
  if (snd == undefined) this.err('ping: snd=null');
  
  // Buf.buf_put_int32(buf, self.rcv.port);

  if (this.verbose>1) this.out('amp.ping: to '+addr2url(snd));
  this.count.snd += Buf.length(buf);
  this.count.png++;
  
  this.write(buf.data,0,Buf.length(buf),snd.port,snd.address,function (err) {
      if (err) {
          // self.close();
          self.emit('error',err);
      } 
  });
};

/**
 *
 * typeof @snd = address
 * typeof @callback = function
 * +------------+
 * AMMessageType (int16)
 * Connection Port (port)
 * Receiver IP Port (int32)
 * +------------+
 */
amp.tcp.prototype.pong=function(snd) {
  var self = this,
      buf = Buf.Buffer();

  Buf.buf_put_int16(buf, magic);
  Buf.buf_put_int16(buf, AMMessageType.AMMPONG);
  Buf.buf_put_port(buf,this.port);
  if (!this.sharedSocket)
    Buf.buf_put_int32(buf,this.rcv.port);         // For reply
  else // from this.client[url]
    Buf.buf_put_int32(buf,this.client[url] && this.client[url].rcv?this.client[url].rcv.port:this.rcv.port);         // For reply  

  if (this.mode&AMMode.AMO_UNICAST) {
    if (snd==undefined || snd.address==undefined) snd={},snd.address=this.links[this.url].snd.address;
    if (snd.port==undefined) snd.port=this.links[this.url].snd.port;
  } 
  if (snd == undefined) this.err('pong: snd=null');

  // Buf.buf_put_int32(buf, this.rcv.port);

  if (this.verbose>1) this.out('amp.pong: to '+addr2url(snd));
  this.count.snd += Buf.length(buf);
  this.count.png++;

  this.write(buf.data,0,Buf.length(buf),snd.port,snd.address,function (err) {
      if (err) {
          // self.close();
          self.emit('error',err);
      } 
  });
};


/*
** Set-up a message receiver.
**
** Message structure
**
**  msgtyp            msgtyp            2
**  =AMMRPCHEAD       =AMMRPCDATA
**  tid               tid               2
**  remoteport                          2
**  cmd                                 2
**  size                                2
**  frags                               2
**                    off               4
**                    size              2
**                    more              2
**                    buf               *
**  
**  
*/
/** Message receiver and handler.
 *  typeof @rcv=address|undefined
 */
amp.tcp.prototype.receiverHandler = function handler (message,remote) {
  var self=this,handler,dfrags,dlist,msgtyp,tid,ipport,discard,off,size,
      thisnum,transaction,more,port,addr,url,data,msg,
      url0=addr2url(remote,true);
  // console.log('handler',message.length);
  var buf = Buf.Buffer();
  Buf.buf_init(buf);
  Buf.buf_of_str(buf,message);
  self.count.rcv += message.length;
  msg={};

  if (message.length >= 10) {
    msg.magic=Buf.buf_get_int16(buf);
    // consistency check
    if (msg.magic!=magic) return;
    
    msg.type=Buf.buf_get_int16(buf);
    discard=false;
    if (self.verbose>1) {
      url=addr2url(remote,true);
      self.out('receiver: Receiving Message from '+ url + ' [' + message.length+'] '+
               AMMessageType.print(msg.type));
    }
    switch (msg.type) {

      case AMMessageType.AMMRPCHEADDATA:      // single message transfers only
        msg.tid = Buf.buf_get_int16(buf);
        msg.port = Buf.buf_get_port(buf);
        msg.sndport = Buf.buf_get_int32(buf);
        remote.port=msg.sndport;   // reply to this port!
        url=addr2url(remote,true);
        if (self.verbose>1)self.out('receiver: Receiving Message in state '+
                                     (self.mode&AMMode.AMO_MULTICAST?(self.links[url] && AMState.print(self.links[url].state)):
                                     (self.links[self.url] && AMState.print(self.links[self.url].state))));
        if (!self.checkState(AMState.AMS_CONNECTED,remote)) return;
        msg.cmd=Buf.buf_get_int16(buf);
        msg.size=Buf.buf_get_int32(buf);
        msg.data = buf;
        msg.frags=0;
        msg.more=false;
        self.handle(msg,remote);
        break;

      case AMMessageType.AMMPING:
        msg.port = Buf.buf_get_port(buf);
        msg.sndport = Buf.buf_get_int32(buf);
        remote.port=msg.sndport;   // reply to this port!
        url=addr2url(remote,true);
        if (self.verbose>1)self.out('receiver: Receiving Message in state '+
                                     (self.mode&AMMode.AMO_MULTICAST?(self.links[url] && AMState.print(self.links[url].state)):
                                     (self.links[self.url] && AMState.print(self.links[self.url].state))));
        self.handle(msg,remote);
        break;

      case AMMessageType.AMMPONG:
        msg.port = Buf.buf_get_port(buf);
        msg.sndport = Buf.buf_get_int32(buf);
        remote.port=msg.sndport;   // reply to this port!
        url=addr2url(remote,true);
        if (self.verbose>1)self.out('receiver: Receiving Message in state '+
                                     (self.mode&AMMode.AMO_MULTICAST?(self.links[url] && AMState.print(self.links[url].state)):
                                     (self.links[self.url] && AMState.print(self.links[self.url].state))));
        self.handle(msg,remote);
        break;

      case AMMessageType.AMMLINK:
        msg.port = Buf.buf_get_port(buf);
        msg.node = Buf.buf_get_string(buf);
        msg.secure = Buf.buf_get_string(buf);
        if (msg.secure!='') msg.secure=Sec.Port.ofString(msg.secure); 
        msg.sndport = Buf.buf_get_int32(buf);
        
        var oldport = remote.port;
        remote.port=msg.sndport;   // reply to this port!
        url=addr2url(remote,true);

        if (remote.port!=oldport) {
          // client behind NAT? IP port changed
          if (self.verbose>1) console.log('LINK NAT fix',remote.port,oldport,url,url0,typeof self.client[url0])
          if (self.client[url0]) {
            // migrate client entry to new url
            self.client[url]={address:remote.address,port:remote.port,
                              busy:self.client[url0].busy,
                              connected:self.client[url0].connected,
                              queue:self.client[url0].queue,
                              socket:self.client[url0].socket};
          }
        }

        if (self.verbose>1)self.out('receiver: Receiving Message in state '+
                                     (self.mode&AMMode.AMO_MULTICAST?(self.links[url] && AMState.print(self.links[url].state)):
                                     (self.links[self.url] && AMState.print(self.links[self.url].state))));
        self.handle(msg,remote);
        break;

      case AMMessageType.AMMUNLINK:
        msg.port = Buf.buf_get_port(buf);
        msg.sndport = Buf.buf_get_int32(buf);
        remote.port=msg.sndport;   // reply to this port!
        url=addr2url(remote,true);
        self.handle(msg,remote);
        break;

      // optional rendezvous brokerage 
      case AMMessageType.AMMCONTROL:
        // Control message; 
        msg.port = Buf.buf_get_port(buf);
        msg.data = Buf.buf_get_string(buf);
        self.handle(msg,remote);
        break;
    }
  }
};

amp.tcp.prototype.receiverSocket = function (sock) {
  var self=this,chunks,remote,expect=0,url;
  // Remote connect and request
  sock.on('data', function (data) {
    var pending;
    // console.log(data);
    if (!remote) {
      remote = {address:sock.remoteAddress.replace(/^::ffff:/,''),port:sock.remotePort};
      url = addr2url(remote);
      // console.log(remote,url)
      if (self.sharedSocket && !self.client[url]) {
        self.client[url]={busy:false,connected:true,socket:sock,queue:[]};
      }
    }
    if (self.keepAlive || self.sharedSocket) {
      // still broken
      do {
        if (pending) { data=pending; pending=null };
        if (data.length==0) process.exit();
        // message stream connectioN; first 4 bytes: length of message
        if (data.length==4) { expect=data.readInt32LE(0); return; }
        else if (expect==0) {
          if (data.length<4) return console.log('uff',data.length);
          var dataLength = data.slice(0,4);
          data=data.slice(4);
          expect=dataLength.readInt32LE(0);
        }
        if (expect) {
          if (chunks && (data.length+chunks.length) > expect ||
              data.length > expect) {
            var diff = (data.length+(chunks?chunks.length:0)) - expect,
                need = expect-(chunks?chunks.length:0);
            // console.log('mess',expect,diff,need,chunks && chunks.length,data.length)
            pending=data.slice(need);
            data=data.slice(0,need);
            // console.log(data.length,pending.length);
          }
        }
         
        if (!chunks) chunks=data;
        else chunks=Buffer.concat([chunks,data]);
        if (expect && chunks.length == expect) {
          // console.log(chunks)
          self.receiverHandler(Buffer(chunks),remote);
          expect=0;
          chunks=null;
        }
      } while (pending && pending.length)
    } else {
      if (!chunks) chunks=data;
      else chunks=Buffer.concat([chunks,data]);      
    }
   });
  sock.on('end', function () {
    if (chunks) self.receiverHandler(Buffer(chunks),remote);
  });
  if (!this.sharedSocket) {
    // Add a 'close' event handler to this instance of socket
    sock.on('close', function(data) {
      // console.log('CLOSED: ' + sock.remoteAddress +' '+ sock.remotePort);
      if (self.sharedSocket && self.client[url]) delete self.client[url];
    });
    sock.on('error', function(data) {
      // console.log('CLOSED: ' + sock.remoteAddress +' '+ sock.remotePort);
      if (self.sharedSocket && self.client[url]) delete self.client[url];
    });
  }
}
amp.tcp.prototype.receiver = function (callback,rcv) {
  var self = this;

  if (rcv == undefined || rcv.address==undefined) rcv={},rcv.address=this.rcv.address;
  if (rcv.port==undefined) rcv.port=this.rcv.port;
  if (callback) this.callback=callback;

  if (this.sharedSocket && rcv.port==undefined) {
    if (this.verbose) this.out('IP port * (proto '+this.options.proto+') SS');
    return; // client side socket receiver, installed later on each link request
  }
  this.sock=net.createServer({keepAlive:this.keepAlive,noDelay:true},this.receiverSocket.bind(this));

  this.sock.on('listening', function () {
    var address = self.sock.address();
    if (!rcv.port) self.rcv.port=rcv.port=address.port;
    if (self.verbose>1) self.out('TCP receiver listening on ' + addr2url(rcv));
    if (self.dir.ip=='*') self.dir=Aios.DIR.IP(self.rcv.port); 
    // Try to get network IP address of this host 
    getNetworkIP(undefined,function (err,ip) {
      if (!err) self.rcv.address=ip;
      if (self.verbose) self.out('IP port '+addr2url(self.rcv)+ ' (proto '+self.options.proto+') '+
                                 (self.keepAlive?'KA ':'')+
                                 (self.sharedSocket?'SS':''));
      if (err) return self.out("! Unable to obtain network connection information: "+err);
    });
  });
  this.sock.on('error', function (err) {
    Io.out('[AMP] TCP error: '+err);
    self.sock.close();
  });    
};



/** Send a request message to a remote node endpoint
 *
 * function (cmd:integer,msg:Buffer,snd?:address)
 */

amp.tcp.prototype.request = function (cmd,msg,snd) {
  var self=this,
      buf = Buf.Buffer(),
      size = msg.data.length,
      url = snd?addr2url(snd,true):'',
      tid = msg.tid||Comp.random.int(65536/2);

  if (this.mode&AMMode.AMO_UNICAST) {
    if (snd==undefined || snd.address==undefined) snd={},snd.address=this.links[this.url].snd.address;
    if (snd.port==undefined) snd.port=this.links[this.url].snd.port;
  } 
  if (snd == undefined) this.err('request: request=null');

  Buf.buf_put_int16(buf,magic);
  Buf.buf_put_int16(buf,AMMessageType.AMMRPCHEADDATA);
  Buf.buf_put_int16(buf,tid);                   // Transaction Message ID
  Buf.buf_put_port(buf,this.port);
  if (!this.sharedSocket)
    Buf.buf_put_int32(buf,this.rcv.port);         // For reply
  else // from this.client[url]
    Buf.buf_put_int32(buf,this.client[url] && this.client[url].rcv?this.client[url].rcv.port:this.rcv.port);         // For reply  
  Buf.buf_put_int16(buf,cmd);
  Buf.buf_put_int32(buf,size);
  Buf.buf_put_buf(buf, msg, 0, size);

  if (self.verbose>1) self.out('Send AMMRPCHEAD tid='+tid+' @'+Comp.pervasives.mtime());
  this.count.snd += Buf.length(buf);
  
  this.write(buf.data,0,Buf.length(buf),snd.port,snd.address,function (err) {
    if (self.verbose>1) self.out('Send AMMRPCHEADDATA tid='+tid+'. Done @'+Comp.pervasives.mtime());
    if (err) {
      if (self.verbose>1) self.out('AMMRPCHEADDATA Error: '+err);
      if (callback) callback(Status.STD_IOERR,err);
    } 
  });
};
/** Reply to a request (msg.tid contains request tid)
 */
amp.tcp.prototype.reply = function (cmd,msg,snd) {
  this.request(cmd,msg,snd);
}

// Send a short control message
// typeof @msg : {type:string,..}
// typeof @snd : address
amp.tcp.prototype.send = function (msg, snd) {
  var buf = Buf.Buffer(),
      data = JSON.stringify(msg);
  this.LOG('snd',msg);
  if (this.mode&AMMode.AMO_UNICAST) {
    if (snd==undefined || snd.address==undefined) snd={},snd.address=this.links[this.url].snd.address;
    if (snd.port==undefined) snd.port=this.links[this.url].snd.port;
  } 
  if (snd == undefined) this.err('send: snd=null');
  
  if (this.verbose>1) this.out('amp.send: to '+addr2url(snd)+': '+data);
  Buf.buf_put_int16(buf,magic);
  Buf.buf_put_int16(buf,AMMessageType.AMMCONTROL);
  Buf.buf_put_port(buf,this.port);
  Buf.buf_put_string(buf,data);
  this.count.snd += Buf.length(buf);

  this.write(buf.data,0,Buf.length(buf),snd.port,snd.address,function (err) {
    if (err) self.emit('error',err);
  });
};



// Start AMP watchdog and receiver
amp.tcp.prototype.start = function(callback) {
  var self=this,link,startwatch=false,
       s=this.secure?' (security port '+Sec.Port.toString(this.secure)+')':'';

  if (this.verbose>0) this.out('Starting ' + (this.rcv.name?(this.rcv.name+' '):'')+ addr2url(this.rcv)+
                               (this.mode&AMMode.AMO_UNICAST && this.url?(' -> '+this.url):'')+
                               ' ['+AMMode.print(this.mode)+'] (proto '+this.proto+') '+s);
  if (this.mode&AMMode.AMO_UNICAST) {
    if (this.url) {
      link=this.links[this.url];
      link.state = this.broker?AMState.AMS_AWAIT:AMState.AMS_NOTCONNECTED;
      if (link.snd && !(this.mode&AMMode.AMO_ONEWAY))
        startwatch=true;
      if (link.snd && (this.mode&AMMode.AMO_ONEWAY)) 
        this.emit('route+',addr2url(link.snd,true));
      if (this.broker) this.pairing(link);
    }
  }
  
  if (startwatch) this.watchdog(true);
    
  if (!this.sock && !this.sharedSocket && this.rcv.port) {
    // restart listener
    this.receiver();
  } 
  if (this.sock) {
    this.sock.listen(this.rcv.port, undefined /*this.rcv.address*/);
  }
  if (callback) callback();
}

// Stop AMP
amp.tcp.prototype.stop = function(callback) {
  if (this.mode&AMMode.AMO_MULTICAST) 
    for(var p in this.links) {
      if (this.links[p]) {
        // Try to unlink remote endpoint
        this.unlink(this.links[p].snd);
        this.links[p].state=AMState.AMS_NOTCONNECTED;
      }
    }
  else
    this.links.state = AMState.AMS_NOTCONNECTED;
  if (this.timer) clearTimeout(this.timer),this.timer=undefined;
  // TODO
  if (this.sock) this.sock.close(),this.sock=undefined;
  for (var p in this.client) {
    if (this.client[p] && this.client[p].socket) {
      this.client[p].socket.destroy();
      delete this.client[p];
    }
  }

  if (callback) callback();
}



// Unlink remote endpoint
amp.tcp.prototype.unlink=function(snd) {
  var self = this,
      buf = Buf.Buffer(),
      url = snd?addr2url(snd,true):null;

  if (!this.links[url||this.url] || this.links[url||this.url].state!=AMState.AMS_CONNECTED) return;
  this.emit('route-',addr2url(snd,true));
  if (this.mode&AMMode.AMO_ONEWAY) return;

  Buf.buf_put_int16(buf, magic);
  Buf.buf_put_int16(buf, AMMessageType.AMMUNLINK);
  Buf.buf_put_port(buf,this.port);
  if (!this.sharedSocket)
    Buf.buf_put_int32(buf,this.rcv.port);         // For reply
  else // from this.client[url]
    Buf.buf_put_int32(buf,this.client[url] && this.client[url].rcv?this.client[url].rcv.port:this.rcv.port);         // For reply  

  if (this.mode&AMMode.AMO_UNICAST) {
    if (snd==undefined || snd.address==undefined) snd={},snd.address=this.links[this.url].snd.address;
    if (snd.port==undefined) snd.port=this.links[this.url].snd.port;
    url=this.url;
  } 
  if (snd == undefined) this.err('unlink: no destination');

  // Buf.buf_put_int32(buf, this.rcv.port);

  if (this.verbose>1) this.out('amp.unlink: to '+addr2url(snd));
  this.count.snd += Buf.length(buf);

  this.write(buf.data,0,Buf.length(buf),snd.port,snd.address,function (err) {
      if (err) {
          self.emit('error',err)
      } 
  });
  this.links[url].state=AMState.AMS_NOTCONNECTED;

  if (!this.links[url].snd.connect) this.links[url].snd={};   // Invalidate link - or remove it from table?
  if (this.broker) {
    // Special case: brokerage! Remove link entry entirely!?
    this.links[url]=undefined;
    if (this.url) this.url=undefined;
  }
  if (this.client[url]) { this.client[url].socket.destroy(); delete this.client[url] };
  if (this.verbose) this.out('Unlinked ' + url);
};


// Update link table, add new entry, and return snd address (or none if the watchdog should handle the messaging)
amp.tcp.prototype.updateLinkTable=function(snd,connect) {
  var link;
  if (!snd) this.err('link: no destinataion set'); 
  url=addr2url(snd,true);

  // Add new link to link table if not already existing
  if (this.broker && !snd.port && !this.links[url]) {
    // Initial broker rendezvous delivering endpoint ip address and port
    link=this.links[url]={
      state:AMState.AMS_AWAIT,
      tries:0,
      connect:connect,
      live:options.AMC_MAXLIVE,
      snd:{name:snd.address}      // Watchdog will send link messages initially to broker if address is resolved
    };
    if (connect) link.snd.connect=true;
    if (this.mode&AMMode.AMO_UNICAST) this.url=url;   // Remember this link
    
    this.pairing(link);
    
    // Let watchdog handle rendezvous and connect request messages
    return;
  } else if (this.mode&AMMode.AMO_UNICAST) {
    // UNICAST mode
    if (!this.links[url]) link=this.links[url]={state:AMState.AMS_NOTCONNECTED};
    else link=this.links[url];
    
    if (snd != undefined && snd.address!=undefined && snd.port!=undefined && !link.snd)
      link.snd=snd;

    if (snd != undefined && snd.address!=undefined && snd.port!=undefined && snd.port!='*' && link.snd.address==undefined) 
      link.snd.address=snd.address;
      
    if (snd != undefined && snd.port!=undefined && link.snd.port==undefined) 
      link.snd.port=snd.port;

    if (connect) link.snd.connect=true;  

    // Nothing to do or let watchdog handle link messages?
    if ((link.state && link.state!=AMState.AMS_NOTCONNECTED && link.state!=AMState.AMS_PAIRED) || 
         this.mode&AMMode.AMO_ONEWAY) return;

    // Random port range p0-p1? Let watchdog do the work
    if (typeof link.snd.port == 'string') return;

    // Send link message
    if (snd==undefined || snd.address==undefined) snd={},snd.address=link.snd.address;
    if (snd.port==undefined) snd.port=link.snd.port;
    
    this.url=url;   // Remember this link
  } else {
    // MULTICAST mode
    url=addr2url(snd,true);
    if (!this.links[url] || !this.links[url].snd.address) 
      this.links[url]={
        snd:snd,
        state:AMState.AMS_NOTCONNECTED,
        tries:0,
        connect:connect,
        live:options.AMC_MAXLIVE
      };
    // Let watchdog handle connect request link messages
    if (!this.inwatchdog && connect && !this.sharedSocket) {
      this.watchdog(true);
      return;
    }
    // if (this.verbose>1) this.out('send link '+Io.inspect(snd));
  }
  return snd;
}



/** Install a watchdog timer.
 *
 * 1. If link state is AMS_NOTCONNECTED, retry link request if this.links[].snd is set.
 * 2. If link state is AMS_CONNECTED, check link end point.
 * 3, If link state is AMS_RENDEZVOUS, get remote endpoint connectivity via broker
 *
 * @param run
 */
amp.tcp.prototype.watchdog = function(run,immed) {
    var self=this;
    if (this.timer) clearTimeout(self.timer),this.timer=undefined;
    if (this.verbose>1) this.out('Starting watchdog run='+run+' immed='+immed);
    if (run) this.timer=setTimeout(function () {
        var con,to,tokens;
        if (!self.timer || (!self.sock && !self.sharedSocket) || self.inwatchdog) return; // stopped or busy?
        self.timer = undefined;
        self.inwatchdog=true;

        function handle(obj,url) {
          if (self.verbose>1) self.out('Watchdog: handle link '+
                                        url+(obj.snd?('('+obj2url(obj.snd)+')'):'')+' in state '+AMState.print(obj.state)+
                                        (obj.tries!=undefined?('[#'+obj.tries+']'):''));
          switch (obj.state) {

            case AMState.AMS_CONNECTED:
                if (obj.live == 0) {
                    // No PING received, disconnect...
                    if (self.verbose>0) 
                      self.out('(TCP) Endpoint ' + addr2url(obj.snd) +
                               ' not responding, propably dead. Unlinking...');
                    // self.emit('route-',addr2url(obj.snd)) .. done in unlink
                    if (self.mode&AMMode.AMO_MULTICAST) self.unlink(obj.snd); 
                    else self.unlink();
                    obj.state = AMState.AMS_NOTCONNECTED;
                    if (!obj.snd.connect) obj.snd={};
                    if (self.broker)  {
                      // Re-register on broker for rendezvous ...
                      self.watchdog(true); 
                      if (self.links['*']) {
                        self.links['*'].state=AMState.AMS_RENDEZVOUS;
                      }
                    }
                } else {
                    obj.tries=0;
                    obj.live--;
                    self.watchdog(true);
                    if (self.mode&AMMode.AMO_MULTICAST) self.ping(obj.snd);
                    else self.ping();
                }
                break;
                
            case AMState.AMS_NOTCONNECTED:
                if (!obj.snd) return;
                if (obj.snd.port && typeof obj.snd.port == 'string') {
                  // Random port connection from a port range p0-p1; save it and start with first
                  // random selection
                  tokens=obj.snd.port.split('-');
                  if (tokens.length==2) obj.range=[Number(tokens[0]),Number(tokens[1])];
                } 
                if (obj.range) {
                  // Get a random port from range
                  obj.snd.port=Comp.random.interval(obj.range[0],obj.range[1]);
                  if (self.verbose>0) 
                    self.out('Trying link to ' + addr2url(obj.snd));
                  if (self.mode&AMMode.AMO_MULTICAST) self.link(obj.snd); 
                  else self.link();
                  obj.tries++;
                  if (obj.tries < options.TRIES) self.watchdog(true);
                  else {
                    obj.snd={},obj.tries=0,obj.range=undefined;   
                  }                 
                } else if (obj.snd.port && typeof obj.snd.port == 'number') {
                  // Try link to specified remote endpoint obj.snd
                  if (self.verbose>0 && obj.tries==0) 
                    self.out('(TCP) Trying link to ' + addr2url(obj.snd));
                  if (self.mode&AMMode.AMO_MULTICAST) self.link(obj.snd); 
                  else self.link();
                  obj.tries++;
                  if (obj.tries < options.TRIES) self.watchdog(true);
                  else {
                    self.out('(TCP) Giving up to link '+addr2url(obj.snd));
                    self.emit('error','link',addr2url(obj.snd,true));
                    obj.snd={},obj.tries=0;
                  }
                }
                break;
                
            // AMP Broker P2P Control and Management
            case AMState.AMS_RENDEZVOUS:
                obj.next=Aios.time()+options.REGTMO;
                obj.interval=options.REGTMO;
                self.send(
                  {type:'register',name: self.rcv.name, linfo: self.rcv },
                  self.broker,
                  function () {}
                );
                self.watchdog(true);
                break;
                
            case AMState.AMS_REGISTERED:
                if (obj.snd && obj.snd.name && obj.tries < options.TRIES) {
                  obj.tries++;
                  self.send(
                    {type:'pair', from:self.rcv.name, to: obj.snd.name },
                    self.broker,
                    function () {}
                  );
                  // self.watchdog(true);
                } else if (options.REGTMO && Aios.time() > obj.next) {
                  // Update registration periodically; messages can be lost
                  obj.interval *= 2;
                  obj.interval = Math.min(obj.interval,options.REGTMO*8);
                  obj.next=Aios.time()+obj.interval;
                  self.send(
                    {type:'register',name: self.rcv.name, linfo: self.rcv },
                    self.broker,
                    function () {}
                  );
                }
                self.watchdog(true);
                break;
          }          
        }
        for(var p in self.links) if (self.links[p]) handle(self.links[p],p);
        self.inwatchdog=false;
    },immed?0:options.TIMER);
};

/** Write message data to remote endpoint address:port over a temporary TCP connection
 *
 */
amp.tcp.prototype.write = function(data,off,len,port,address,cb) {
  var self=this,
      url=addr2url({address:address,port:port});
  if (off!=0) this.err('tpc.socket.write: buffer offset <> 0');
  if (this.keepAlive || this.sharedSocket) {
    // reuse TCP session and connection
    if (!this.client[url]) return; // closed?
    // keep tcp connection alive and send messages as a stream
    // if (!this.client[url]) this.client[url]={busy:false,connected:false,queue:[]}
    if (this.client[url].busy) {
      // console.log('enqueue');
      this.client[address+':'+port].queue.push([data,off,len,port,address,cb]);
      return;
    }
    this.client[url].busy=true;

    function send() {
      if (!self.client[url]) return; // closed?
      // console.log('send',data.length);
      // 1. send data length
      var dataLength = Buffer(4);
      dataLength.writeInt32LE(data.length,0);
      try {
        self.client[url].socket.write(dataLength, function () {
          if (!self.client[url]) return; // closed?
          // 2. send data payload
          self.client[url].socket.write(data, function () {
            if (!self.client[url]) return;
            // console.log('write done',self.client[address+':'+port].queue.length)
            if (cb) cb();
            self.client[url].busy=false;
            if (self.client[url].queue.length) {
              // console.log('dequeue');
              self.client[url].socket.write.apply(self,self.client[url].shift());
            }
          })    
        });
      } catch (e) { if (self.verbose) self.out(url+': '+e); delete self.client[url]; }
    }
    /*
    if (!this.client[url].socket) {
      this.client[url].socket=new net.Socket();
      console.log('write.connect',url);
      this.client[url].socket.connect(port,address, send);
      this.client[url].connected=true;
      this.client[url].socket.on('close', function () {
        console.log('close',url);
        delete self.client[url];
      });
      this.client[url].socket.on('error', function (err) {
        console.log('error',url,err)
        delete self.client[url];
      });
    } else*/
    if (!this.client[url].connected) {
      console.log('write.connect',url);
      this.client[url].busy=true;
      this.client[url].socket.connect(port,address, function () {
        self.client[url].busy=false;
        send();
      });  
      this.client[url].connected=true;   
    } else {
      send();
    }
  } else {
    // for each message a new ad-hoc connection
    var client = new net.Socket();
    client.on('error',function (e) { if (cb) cb(e.toString()) })
    client.connect(port,address, function () {
        client.write(data,function () {
          client.destroy();
          // console.log(len)
          if (cb) cb();      
        });
    });
  }
}
