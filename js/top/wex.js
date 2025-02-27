// some annoying nodejs fixes
process.noDeprecation = true;
process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;
module.paths.push(process.env.HOME+'/node_modules')

var proc    = require('child_process');
var http    = require('http')
var https
var fs      = require('fs')
var Path    = require('path')
var execSync  = require("child_process").execSync;

// Optional websocket interface
var WebSocket;
try { WebSocket = require('ws') } catch (e) { /* no ws module installed */ }
try { https = require('https') } catch (e) { /* no https module installed */ }

process.argv.shift();
process.argv.shift();

var config = {
  version     : "1.7.1",
  TIMEOUT     : 100000,
  PORT        : 11111,
  PORTWS      : 11112,
  verbose     : 0,
  handleIndex : 1000,
  commands    : process.argv,
}

if (process.argv.indexOf('-v')!=-1) {
  config.verbose++;
}

var time = function () { return Math.floor(Date.now()/1000) }
print = console.log;

function log(msg) {
  console.log('[WEX] '+msg);
}

var Consoles = [];
function GET(url,params, cb) {
  var ishttps= url.match(/https:/)!=null;
  if (ishttps && !https) {
    if (cb) return cb(new Error('ENOTSUPPORTED'));
  }
  url=url.replace(/http[s]?:\/\//,'');
  var parts = url.split(':'),
      host  = parts[0].split('/')[0],
      path  = parts[parts.length-1].split('/').slice(1).join('/'),
      port  = (parts[1]||(ishttps?'443':'80')).split('/')[0];
  if (params) {
        var o=params,sep='';
        params='/?';
        for(var p in o) {
          params = params + sep + p + '='+o[p];
          sep='&';
        } 
  } else params='';
  path += params; 
  // print(host,path,port,ishttps)
  var get_options = {
      host: host,
      port: port,
      path: path,
      method: 'GET',
      keepAlive: true,
      headers: {
          // 'Content-Type': 'application/x-www-form-urlencoded',
      }
  };
  // console.log('GET', post_options,post_data)
  var get_req = (ishttps?https:http).request(get_options, function(res) {
      res.setEncoding('utf8');
      
      var data='';
      res.on('data', function (chunk) {
        data += chunk;
        // console.log('Response: ' + chunk);
      });
      res.on('end', function () {
        try {
          var result=JSONfn.parse(data);
          // console.log('GET: ',result);
        } catch (e) { print(data.slice(0,100)); result=new Error(e.toString()+' ['+data.slice(0,200)+']'); }
        if (cb) cb(result);
      });
  });
  get_req.on('error',function (err) {
    // console.log(err)
    if (cb) cb(err); else console.log(url,err);
  });
  get_req.setNoDelay();
  // get_req.write();
  get_req.end();
}
function get(url, cb) {
  var ishttps= url.match(/https:/)!=null;
  if (ishttps && !https) {
    if (cb) return cb(new Error('ENOTSUPPORTED'));
  }
  url=url.replace(/http[s]?:\/\//,'');
  var parts = url.split(':'),
      host  = parts[0].split('/')[0],
      path  = parts[parts.length-1].split('/').slice(1).join('/'),
      port  = (parts[1]||(ishttps?'443':'80')).split('/')[0];
  // print(host,path,port,ishttps)
  var get_options = {
      host: host,
      port: port,
      path: path[0]=='/'?path:'/'+path,
      method: 'GET',
      keepAlive: true,
      headers: {
        // 'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent':'Mozilla/5.0 (X11; Linux i686; rv:52.0) Gecko/20100101 Firefox/52.0',
        'Accept':"text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      }
  };
  // console.log('GET', get_options)
  var get_req = (ishttps?https:http).request(get_options, function(res) {
    res.setEncoding('binary');
    // res.setEncoding('utf8');
    var data = [];
    res.on('data', function (chunk) {
      data.push(Buffer.from(chunk, 'binary'));
      // console.log('Response: ' + chunk);
    });
    res.on('end', function () {
      var buffer = Buffer.concat(data);
      cb(buffer,res.headers)
    });
  });
  get_req.on('error',function (err) {
    // console.log(err)
    if (cb) cb(err); else console.log(url,err);
  });
  get_req.setNoDelay();
  // get_req.write();
  get_req.end();
}
function POST(url, data, cb) {
  var params,headers;
  if (data && data.params && data.data != undefined) {
    params=data.params;
    headers=data.headers;
    data=data.data;
  }
  var ishttps= url.match(/https:/);
  if (ishttps && !https) {
    if (cb) return cb(new Error('ENOTSUPPORTED'));
  }
  url=url.replace(/http[s]?:\/\//,'');
  var parts = url.split(':'),
      host  = parts[0].split('/')[0],
      path  = parts[parts.length-1].split('/').slice(1).join('/'),
      port  = (parts[1]||(ishttps?'443':'80')).split('/')[0];
  if (params) {
        var o=params,sep='';
        params='/?';
        for(var p in o) {
          params = params + sep + p + '='+o[p];
          sep='&';
        } 
  } else params='';
  var post_data = typeof data == 'string'?data:JSON.stringify(data);
  var post_options = {
      host: host,
      port: port,
      path: '/'+path+params,
      method: 'POST',
      keepAlive: true,
      headers: headers || {
          'Content-Type': 'application/json', // ?? 'application/x-www-form-urlencoded',
          // 'Content-Length': Buffer.byteLength(post_data)
          'Content-Length': post_data.length,
      }
  };
  // console.log('POST', post_options,post_data)
  var post_req = (ishttps?https:http).request(post_options, function(res) {
      res.setEncoding('utf8');
      
      var data='';
      res.on('data', function (chunk) {
        data += chunk;
        // console.log('Response: ' + chunk);
      });
      res.on('end', function () {
        try {
          var result=JSON.parse(data);
          // console.log('POST: ',result);
        } catch (e) { print(data.slice(0,100)); result=new Error(e.toString()+' ['+data.slice(0,200)+']'); }
        if (cb) cb(result);
      });
  });
  post_req.on('error',function (err) {
    if (cb) cb(err); else console.log(url,err)
  });
  post_req.setNoDelay();
  // console.log('POST: ',post_data);
  // post the data
  post_req.write(post_data);
  post_req.end();
}
function Post(url, data, cb) {
  var params,headers;
  if (data && data.params && data.data != undefined) {
    params=data.params;
    headers=data.headers;
    data=data.data;
  }
  var ishttps= url.match(/https:/);
  if (ishttps && !https) {
    if (cb) return cb(new Error('ENOTSUPPORTED'));
  }
  url=url.replace(/http[s]?:\/\//,'');
  var parts = url.split(':'),
      host  = parts[0].split('/')[0],
      path  = parts[parts.length-1].split('/').slice(1).join('/'),
      port  = (parts[1]||(ishttps?'443':'80')).split('/')[0];
  if (params) {
        var o=params,sep='';
        params='/?';
        for(var p in o) {
          params = params + sep + p + '='+o[p];
          sep='&';
        } 
  } else params='';
  var text=[];
  for(var p in data) {
    text.push(p+'='+encodeURI(data[p]));
  }
  text=text.join('&');
  var post_data = typeof data == 'string'?data:JSON.stringify(data);
  var post_options = {
      host: host,
      port: port,
      path: '/'+path+params,
      method: 'POST',
      keepAlive: true,
      headers: headers || {
          'Content-Type': 'application/x-www-form-urlencoded',
          // 'Content-Length': Buffer.byteLength(post_data)
          'Content-Length': text.length,
      }
  };
  // console.log('Post', post_options,post_data)
  var post_req = (ishttps?https:http).request(post_options, function(res) {
      res.setEncoding('utf8');
      
      var data='';
      res.on('data', function (chunk) {
        data += chunk;
        // console.log('Response: ' + chunk);
      });
      res.on('end', function () {
        try {
          var result=JSON.parse(data);
          // console.log('POST: ',result);
        } catch (e) { print(data.slice(0,100)); result=new Error(e.toString()+' ['+data.slice(0,200)+']'); }
        if (cb) cb(result);
      });
  });
  post_req.on('error',function (err) {
    if (cb) cb(err); else console.log(url,err)
  });
  post_req.setNoDelay();
  // console.log('POST: ',post_data);
  // post the data
  // console.log(text)
  post_req.write(text);
  post_req.end();
}


function typedarrayTObase64(ta,ftyp) {
  var b,i;
  if (ta.buffer instanceof ArrayBuffer) {
    b=Buffer(ta.buffer);
    if (b.length>0) return b.toString('base64');
  }
  // Fall-back conversion
  switch (ftyp) {
    case Float32Array: 
      b = Buffer(ta.length*4);
      for(i=0;i<ta.length;i++) b.writeFloatLE(ta[i],i*4);
      return b.toString('base64');
    case Float64Array: 
      b = Buffer(ta.length*8);
      for(i=0;i<ta.length;i++) b.writeDoubleLE(ta[i],i*8);
      return b.toString('base64');
    case Int16Array: 
      b = Buffer(ta.length*2);
      for(i=0;i<ta.length;i++) b.writeInt16LE(ta[i],i*2);
      return b.toString('base64');
    case Int32Array: 
      b = Buffer(ta.length*4);
      for(i=0;i<ta.length;i++) b.writeInt32LE(ta[i],i*4);
      return b.toString('base64');
  }
  return ta.toString();
}
function base64TOtypedarray(buff,ftyp) {
  var i,ta;
  if (buff.buffer instanceof ArrayBuffer) {
    switch (ftyp) {
      case Float32Array: return new Float32Array((new Uint8Array(buff)).buffer);
      case Float64Array: return new Float64Array((new Uint8Array(buff)).buffer);
      case Int16Array:   return new Int16Array((new Uint8Array(buff)).buffer);
      case Int32Array:   return new Int32Array((new Uint8Array(buff)).buffer);
    }
  } else if (typeof Uint8Array.from != 'undefined') {
    switch (ftyp) {
      case Float32Array: return new Float32Array(Uint8Array.from(buff).buffer);
      case Float64Array: return new Float64Array(Uint8Array.from(buff).buffer);
      case Int16Array:   return new Int16Array(Uint8Array.from(buff).buffer);
      case Int32Array:   return new Int32Array(Uint8Array.from(buff).buffer);
    }
  } else {
    // Fall-back conversion
    switch (ftyp) {
      case Float32Array: 
        ta=new Float32Array(buff.length/4);
        for(i=0;i<ta.length;i++) 
          ta[i]=buff.readFloatLE(i*4);
        return ta;
      case Float64Array: 
        ta=new Float64Array(buff.length/8);
        for(i=0;i<ta.length;i++) 
          ta[i]=buff.readDoubleLE(i*8);
        return ta;
      case Int16Array: 
        ta=new Int16Array(buff.length/2);
        for(i=0;i<ta.length;i++) 
          ta[i]=buff.readInt16LE(i*2);
        return ta;
      case Int32Array: 
        ta=new Int32Array(buff.length/4);
        for(i=0;i<ta.length;i++) 
          ta[i]=buff.readInt32LE(i*4);
        return ta;
    }
  }
}
var JSONfn = {}

  JSONfn.stringify = function (obj) {

    return JSON.stringify(obj, function (key, value) {
      if (value instanceof Function || typeof value == 'function')
        return '_PxEnUf_' +Buffer(value.toString(true)).toString('base64');  // try minification (true) if supported
      if (value instanceof Buffer)
        return '_PxEfUb_' +value.toString('base64');
      if (typeof Float64Array != 'undefined' && value instanceof Float64Array)
        return '_PxE6Lf_' + typedarrayTObase64(value,Float64Array);
      if (typeof Float32Array != 'undefined' && value instanceof Float32Array)
        return '_PxE3Lf_' + typedarrayTObase64(value,Float32Array);
      if (typeof Int16Array != 'undefined' && value instanceof Int16Array)
        return '_PxE1Ni_' + typedarrayTObase64(value,Int16Array);
      if (typeof Int32Array != 'undefined' && value instanceof Int32Array)
        return '_PxE3Ni_' + typedarrayTObase64(value,Int32Array);
      if (value instanceof RegExp)
        return '_PxEgEr_' + value;
      
      return value;
    });
  };

  JSONfn.parse = function (str, mask) {
    var code;
    try {
      with (mask||{}) {
        code= JSON.parse(str, function (key, value) {
          var prefix;

          try {
            if (typeof value != 'string') {
              return value;
            }
            if (value.length < 8) {
              return value;
            }
            prefix = value.substring(0, 8);

            if (prefix === '_PxEnUf_') {
              var code = value.slice(8);
              if (code.indexOf('function')==0)  // Backward comp.
                return eval('(' + code + ')');
              else
                return eval('(' + Buffer(code,'base64').toString() + ')');
            }
            if (prefix === '_PxEfUb_')
              return Buffer(value.slice(8),'base64');
            if (prefix === '_PxE6Lf_')
              return base64TOtypedarray(Buffer(value.slice(8),'base64'),Float64Array);
            if (prefix === '_PxE3Lf_')
              return base64TOtypedarray(Buffer(value.slice(8),'base64'),Float32Array);
            if (prefix === '_PxE1Ni_')
              return base64TOtypedarray(Buffer(value.slice(8),'base64'),Int16Array);
            if (prefix === '_PxE3Ni_')
              return base64TOtypedarray(Buffer(value.slice(8),'base64'),Int32Array);
            if (prefix === '_PxEgEr_')
              return eval(value.slice(8));
           
            return value;
          } catch (e) {
            throw {error:e,value:value};
          }
        });
     };
    } catch (e) {
      throw e.error||e;
    }
   return code;
  };

  JSONfn.clone = function (obj, date2obj) {
    return exports.parse(exports.stringify(obj), date2obj);
  };
  JSONfn.current =function (module) { current=module.current; };

  /* Remove any buffer toJSON bindings */
  if (typeof Buffer != 'undefined' && Buffer.prototype.toJSON) delete Buffer.prototype.toJSON;
  if (typeof buffer == 'object' && buffer.Buffer) delete buffer.Buffer.prototype.toJSON;
  // Alias
  JSONfn.serialize   = exports.stringify;
  JSONfn.deserialize = exports.parse;
  


function mkdtemp (index) {
  rmdtemp(index);
  fs.mkdirSync('/tmp/webx-'+index);
  return '/tmp/webx-'+index
}

function rmdir(path) {
  if( fs.existsSync(path) ) {
    fs.readdirSync(path).forEach(function(file,index){
      var curPath = path + "/" + file;
      if(fs.lstatSync(curPath).isDirectory()) { // recurse
        rmdir(curPath);
      } else { // delete file
        fs.unlinkSync(curPath);
      }
    });
    fs.rmdirSync(path);
  }
};

function rmdtemp (index) {
  rmdir('/tmp/webx-'+index)
}

/*
** Parse query string '?attr=val&attr=val... and return parameter record
*/
function parseQueryString( url ) {
    var queryString = url.substring( url.indexOf('?') + 1 );
    if (queryString == url) return [];
    var params = {}, queries, temp, i, l;
    // Split into key/value pairs
    queries = queryString.split("&");
    // Convert the array of strings into an object
    for ( i = 0, l = queries.length; i < l; i++ ) {
        temp = queries[i].split('=');
        if (temp[1]==undefined) temp[1]='true';
        params[temp[0]] = temp[1].replace('%20',' ');
    }
    return params;
}
function reply(response,body,headers) {
  header={'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Credentials': 'true',
          'Content-Type': 'text/plain'};
  if (headers) { header={}; for(var p in headers) header[p]=headers[p] };
  response.writeHead(200,header);
  response.write(body);
  response.end();
}

function execute(options) {
  if (commands.indexOf(options.command)==-1) return;

  var stdoutBroken,stderrBroken;
  var tmp=mkdtemp(options.handle);
  
  Consoles[options.handle]={stdout:[],stderr:[],output:{},exit:false,status:0,tid:0};
  
  if (options.input) {
    for (var p in options.input) {
      fs.writeFileSync(tmp+'/'+p,Buffer(options.input[p],'base64'),'binary');
    }    
  }
  var pro = proc.spawn(options.command, options.arguments, {
    cwd:tmp
  });

  if (config.verbose) print(options)
  else print('[PRO '+options.handle+']',options.command,options.arguments);

  pro.stdout.on('data', function (data) {
    var msg = data.toString(),
        lines = msg.split('\n');
    if (config.verbose) print('['+options.handle+'] stdout:<'+msg+'>');
    if (stdoutBroken) lines[0] = stdoutBroken+lines[0]; stdoutBroken=null;
    if (lines[lines.length-1]!='') stdoutBroken=lines.pop();
    else lines.pop();
    Consoles[options.handle].stdout=Consoles[options.handle].stdout.concat(lines);
  });

  pro.stderr.on('data', function (data) {
    var msg = data.toString(),
        lines = msg.split('\n');
    if (config.verbose) print('['+options.handle+'] stderr:<'+msg+'>');
    if (stderrBroken) lines[0] = stderrBroken+lines[0]; stderrBroken=null;
    if (lines[lines.length-1]!='') stderrBroken=lines.pop();
    else lines.pop();
    Consoles[options.handle].stderr=Consoles[options.handle].stderr.concat(lines);
  });

  pro.on('exit', function (code) {
    print('[PRO '+options.handle+'] child process exited with code ' + String(code));
    if (options.output) {
      // All files will be base64 encoded (handling binary and text data the same way)
      options.output.forEach(function (file) {
        try {
          var data = fs.readFileSync(tmp+'/'+file,'binary');
          Consoles[options.handle].stdout.push('[PRO] Saving '+file+' ['+data.length+'] ..');
          if (data && data.length) Consoles[options.handle].output[file]=
            Buffer(data,'binary').toString('base64');
          // print(Consoles[options.handle].output[file].substring(0,16));
        } catch (e) {
          print(e)
        }
      })
    }
    Consoles[options.handle].exit=code;
    rmdtemp(options.handle)
  });
  
  return 'OK';
}

function rpc(request,response) {
  var status=0,data='',files;
  if (config.verbose) print(request.command,request.dir,request.file,request.mimetype,request.data && request.data.length)
  try {
    switch (request.command) {
      case 'GET': 
        console.log(request)
        GET(request.url,request.params, function (result) {
          // console.log('result',result)
          if (result instanceof Error) {status=result.toString(); result=''};
          reply(response,JSONfn.stringify({status:status,reply:result,handle:request.handle}))
        })
        return;
        break;
      case 'Post': 
        console.log(request)
        Post(request.url,request.data, function (result) {
          // console.log('result',result)
          if (result instanceof Error) {status=result.toString(); result=''};
          reply(response,JSONfn.stringify({status:status,reply:result,handle:request.handle}))
        })
        return;
        break;
      case 'POST': 
        console.log(request)
        POST(request.url,request.data, function (result) {
          // console.log('result',result)
          if (result instanceof Error) {status=result.toString(); result=''};
          reply(response,JSONfn.stringify({status:status,reply:result,handle:request.handle}))
        })
        return;
        break;
      case 'list':
        request.dir=request.dir.replace(/^~/,process.env.HOME);
        files = fs.readdirSync(request.dir);
        files = files.map(function (entry) {
          try {
            var stat=fs.statSync(request.dir+'/'+entry);
            return {name:entry,dir:stat.isDirectory(),size:stat.size,time:stat.mtime};
          } catch (e)  {};
        }).filter(function (entry) { return entry });
        data = [{name:'..',dir:true}].concat(files);
        break;
      case 'load':
        request.dir=request.dir.replace(/^~/,process.env.HOME);
        if (request.mimetype.indexOf('text')==0) {
          data=fs.readFileSync(request.dir+'/'+request.file,'utf8');
        } else if (request.mimetype.indexOf('binary')!=-1) {
          data=fs.readFileSync(request.dir+'/'+request.file,'binary');
        }
        break;
      case 'lookup':
        var stat=fs.statSync(request.path);
        data={name:request.path,dir:stat.isDirectory(),size:stat.size,time:stat.mtime};
        break;
      case 'save':
        request.dir=request.dir.replace(/^~/,process.env.HOME);
        if (request.mimetype.indexOf('text')==0) {
          fs.writeFileSync(request.dir+'/'+request.file,request.data,'utf8',{});
        } else if (request.mimetype.indexOf('binary')!=-1) {
          fs.writeFileSync(request.dir+'/'+request.file,Buffer(request.data),'binary',{});
        }
        break;
      case 'shell':
        status=null;data=null;
        var pro = proc.exec('cd '+request.dir+';'+request.exec, function (err,stdout,stderr) {
          data=stdout;
          if (stderr) date = data + '\n' + stderr;
          print(data)
          if (status!=null) 
            reply(response,JSON.stringify({status:status,reply:data,handle:request.handle}))        
        });
        pro.on('exit', function (code) {
          if (data==null) status=code;
          else
            reply(response,JSON.stringify({status:code,reply:data,handle:request.handle}))        
        });
        return;  // reply send on exit or error
        break;
      dedault:
        status=execute(request,response);
    }
  } catch (e) {
    status=e.toString();
  }
  // print(status)
  reply(response,JSONfn.stringify({status:status,reply:data,handle:request.handle}))
}

function isThisLocalhost(ip) {
  return ip.indexOf("127.0.0.1")==0 || 
         ip.indexOf("::ffff:127.0.0.1") == 0 || 
         ip.indexOf("::1") == 0 || 
         ip.indexOf("localhost") == 0;
}

function proxy(method,headers,path,response) {
  // console.log(method,headers,path);
  // TODO: curreltly assumes binary requests...
  if (config.verbose) print('proxy '+path);
  if (method=='GET') get(path,function (data,headers) {
    // console.log(headers,data.length);
    headers['access-control-allow-origin']='*';
    response.writeHead(200,headers||{});
    response.write(data);
    response.end();
  })
}

function server () {
  var dirCache=[];
  var webSrv = http.createServer(function (request,response) {
    // only local requests are accepted
    if (!isThisLocalhost(request.headers.host)) return;
  
    var body,header,sep,query,res,now,path,
        rid = request.connection.remoteAddress+':'+request.connection.remotePort;
    
    if (config.verbose) print(request.url,request.connection.remoteAddress,request.connection.remotePort);
    if (request.url.length) 
      query=parseQueryString(request.url);
    else 
      query={}

    path=request.url.match(/\/([^?]+)/);
    if (path) path=path[1];
    if (config.verbose) print(query,path);
    now=time()
    if (/^http[s]*/.test(path)) {
      // proxy service
      return proxy(request.method,request.headers,path,response);
    }
    switch (request.method) {
      case 'GET':
        if (query.handle && Consoles[query.handle]) {
          reply(response,JSONfn.stringify({
            handle:query.handle,
            stdout:Consoles[query.handle].stdout,
            stderr:Consoles[query.handle].stderr,
            output:Consoles[query.handle].output,
            tid:Consoles[query.handle].tid++,
            exit:Consoles[query.handle].exit,
          }));
          Consoles[query.handle].stdout=[];
          Consoles[query.handle].stderr=[];
        } else if (path) {
          try {
            if (path[0]!='/' && dirCache[rid]) path=dirCache[rid]+'/'+path;
            else dirCache[rid]=Path.dirname(path);
            var data=fs.readFileSync(path,'utf8');
            if (config.verbose) print('Loading '+path);
            reply(response,data,{
              'Content-Type': 'text/html; charset=UTF-8',
              'Cross-Origin-Opener-Policy': 'same-origin',
              'Cross-Origin-Embedder-Policy': 'require-corp',
            });
          } catch (e) {
            if (config.verbose) print(e.toString())
            reply(response,e.toString());
          }
        }
        break;
        
      case 'POST':
        body = '';
        request.on('data', function (chunk) {
          body = body + chunk;
        });
        request.on('end', function () {
          var cmd,stat;
          // handle copy request {id:string,data:string}
          try {
            // print(body)
            cmd=JSONfn.parse(body)
            cmd.handle=config.handleIndex++;
            rpc(cmd,response)  
          } catch (err) {
            log(err.toString())
            reply(response,JSONfn.stringify({err:err.toString()}));
          }
        });
        break;
    }
  })
  
  webSrv.on("connection", function (socket) {
      // socket.setNoDelay(true);
  });

  webSrv.on("error", function (err) {
    log(err)
    process.exit();
  });

  webSrv.listen(config.PORT,function (err) {
    log('HTTP Service started (http://localhost:'+config.PORT+')');
  });
 
  
  // Start garbage collector
  gc=setInterval(function () {
    var now = time();
  },1000);
  
  if (WebSocket) {
    // Start a connection-based WebSocket Server
    var wss = new WebSocket.Server({ port: config.PORTWS })

    wss.on('connection', function (ws) {
      log('ws.connection.open')
      ws.on('message', function (message) {
        var cmd, response = {
          write     : function (data) { ws.send (data) },
          writeHead : function () {},
          end       : function () {}
        };
        try {
            // print(body)
            cmd=JSONfn.parse(message)
            cmd.handle=config.handleIndex++;
            rpc(cmd,response)            
        } catch (err) {
            log(err.toString())
            reply(response,JSONfn.stringify({err:err.toString()}));
        }
      })
      ws.on('error', function (err) {
        console.log(err);
      })
      ws.on('close', function () {
        console.log('ws.connection.close')
      });
    })
    wss.on('error', function (error) {
      console.log(error)
    }) 
    log('WebSocket Service started (ws://localhost:'+config.PORTWS+')');
  }
  log('WEB Processor Ver. '+config.version+' started.');
  return webSrv;
}

server()
