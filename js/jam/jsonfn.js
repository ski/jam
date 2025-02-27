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
 **    $AUTHORS:     Vadim Kiryukhin, Stefan Bosse
 **    $INITIAL:     (C) 2006-2017 Vadim Kiryukhin
 **    $MODIFIED:    by sbosse.
 **    $RCS:         $Id: jsonfn.js,v 1.1 2017/05/20 15:56:53 sbosse Exp $
 **    $VERSION:     1.3.3X
 **
 **    $INFO:
 **
 ** JSONfn - javascript (both node.js and browser) plugin to stringify, 
 **          parse and clone objects with embedded functions in an optional  masked context (mask).
 **        - supported data types: number, boolean, string, array, buffer, typedarray, function, regex
 **
 **     browser:
 **         JSONfn.stringify(obj);
 **         JSONfn.parse(str[, date2obj]);
 **         JSONfn.clone(obj[, date2obj]);
 **
 **     nodejs:
 **       var JSONfn = require('path/to/json-fn');
 **       JSONfn.stringify(obj);
 **       JSONfn.parse(str[, date2obj]);
 **       JSONfn.clone(obj[, date2obj]);
 **
 **
 **     @obj      -  Object;
 **     @str      -  String, which is returned by JSONfn.stringify() function; 
 **     @mask     -  Environment Mask (optional)
 **
 **    $ENDOFINFO
 */

var current=null;


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
(function (exports) {

  function stringify (obj) {

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

  function parse(str, mask) {
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
              // TODO: arrow function support (missing own this object fix)
              // must be addressed in higher-level code (code.js)
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

  exports.clone = function (obj, date2obj) {
    return exports.parse(exports.stringify(obj), date2obj);
  };
  exports.current         = function (module) { current=module.current; };
  exports.serialize       = stringify;
  exports.stringify       = stringify;
  exports.deserialize     = parse;
  exports.parse           = parse;

  /* Remove any buffer toJSON bindings */
  if (typeof Buffer != 'undefined' && Buffer.prototype.toJSON) delete Buffer.prototype.toJSON;
  if (typeof buffer == 'object' && buffer.Buffer) delete buffer.Buffer.prototype.toJSON;

}(typeof exports === 'undefined' ? (window.JSONfn = {}) : exports));


