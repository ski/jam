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
 **    $CREATED:     4-5-16 by sbosse.
 **    $RCS:         $Id: analyzer.js,v 1.5 2020/02/03 09:45:01 sbosse Exp sbosse $
 **    $VERSION:     1.7.1
 **
 **    $INFO:
 **
 **  JAM AgentJS Analyzer. A branch tree monster! 
 **  Uses esprima parser AST structure.
 **
 ** TODO: Many checks are missing or are incomplete!
 **
 **    $ENDOFINFO
 */
var Io = Require('com/io');
var Comp = Require('com/compat');
var Aios = none;
var current = none;
var util = Require('util');

var options = {
  version:'1.7.1',
}
var out = function (msg) { Io.out('[AJS] '+msg)};

/** All functions with 'this' property pass the agent 'this' object to their bodies or callback functions!
 *  The 'this' property array contains the argument index indicating functions or arrays of functions inheriting the
 *  agent 'this' object.
 */
var corefuncs = {
  act:    {obj:{add:{argn:2},delete:{argn:1},update:{argn:2}}},  // TODO obj handling!
  add:    {argn:2},
  angle:  {argn:[1,2]},
  alt :   {argn:[2,3], obj:{try:{argn:[2,3,4]}}},
  collect:    {argn:2},
  concat: {argn:2},
  connectTo: {argn:1},
  copyto:    {argn:2},
  delta:     {argn:2},
  distance:  {argn:[1,2]},
  empty:  {argn:1},
  equal:  {argn:2},
  Export:  {argn:2},
  exists: {argn:1},
  filter: {argn:2, this:[1]},
  head:   {argn:1},
  iter:   {argn:2, this:[1]},
  Import:  {argn:1},
  inp:    {argn:[2,3], this:[1], obj:{try:{argn:[2,3,4]}}},
  kill:   {argn:[0,1]},
  last:   {argn:1},
  length: {argn:1},
  log:    {argn:[1,2,3,4,5,6,7,8,9,10]},
  mark:   {argn:2},
  map:    {argn:2, this:[1]},
  matrix: {argn:[2,3]},
  max:    {argn:[1,2]},
  me:     {argn:0},
  min:    {argn:[1,2]},
  myClass: {argn:0},
  myNode: {argn:0},
  myParent: {argn:0},
  myPosition: {argn:0},
  Number: {argn:1},
  object:    {argn:1},
  out:    {argn:1},
  opposite:    {argn:1},
  privilege: {argn:0},
  random: {argn:[1,2,3]},
  reduce:  {argn:2, this:[1]},
  reverse: {argn:1,this:[1]},
  rd:     {argn:[2,3], this:[1], obj:{try:{argn:[2,3,4]}}},
  rm:     {argn:[1,2]},
  send:   {argn:[2,3]},
  sendto:   {argn:[2,3]},
  sort:   {argn:2, this:[1]},
  sleep:  {argn:[0,1]},
  store:    {argn:2},
  string: {argn:1},
  sum:    {argn:[1,2]},
  tail:   {argn:1},
  time:   {argn:0}, 
  timer:    {obj:{add:{argn:[2,3]},delete:{argn:1},update:{argn:2}}},  // TODO obj handling!
  try_alt:     {argn:[2,3,4], this:[2]},
  try_inp:     {argn:[2,3,4], this:[2]},
  try_rd:     {argn:[2,3,4], this:[2]},
  ts:     {argn:2},
  zero:   {argn:1},
  B:      {argn:[1,2], this:[0,1]},
  I:      {argn:[3,4], this:[1,2,3]},
  L:      {argn:[4,5], this:[1,2,3,4]},
  Vector: {argn:[1,2,3]}
};

function check_args (arguments,corefun) {
  var len=arguments?arguments.length:0,passed=false;
  if (Comp.obj.isArray(corefun.argn)) Comp.array.iter(corefun.argn,function (n) {
    if (n==len) passed=true;
  });
  else passed=(len==corefun.argn);
  return passed;
}


var jamc = function (options) {
  // Dummy constructor
};

var properties = {
  indexOf:'string.indexOf',
  push:'array.push',
  shift:'array.shift'
}

var literals={
  none:'Literal',
  undefined:'Literal'
}
literals['_']='Literal';

var syntax = {
  find: function (root,typ,name) {
    if (root.type==typ && root.id && root.id.type == 'Identifier' && root.id.name==name) return root;
    switch (root.type) {
        case 'Program': 
          return Comp.array.findmap(root.body,function (el) { return syntax.find(el,typ,name)}); 
          break;
        case 'VariableDeclaration':
          return Comp.array.findmap(root.declarations,function (el) { return syntax.find(el,typ,name)});         
          break;
    }
    return null;
  },
  location: function (elem,short) {
    var str='';
    if (elem.loc) {
      if (elem.loc.start) str='line '+(elem.loc.start.line+syntax.offset)+', position '+elem.loc.start.column;
      if (elem.loc.end) str +=' to line '+(elem.loc.end.line+syntax.offset)+', position '+elem.loc.end.column;
      return str;
    } else return "unknown location";
  },
  name: function (elem) {
    switch (elem.type) {
      case 'ThisExpression': return 'this';
      case 'Identifier': return elem.name;
      case 'MemberExpression':
        return syntax.name(elem.object)+'.'+syntax.name(elem.property);
      default: return elem.toString();
    }
  },
  offset:0
}

jamc.prototype.syntax = syntax;


/** The Big Machine: Analyze and check an agent class constructor function.
 * 
 * Checks performed:
 *  - references (top-level this, local this, local variables, no free variable access)
 *  - AIOS function calls, privilege level sensitive
 *  - basic structure (act, trans, on? , next)
 *
 */
 
/*
 * options and evaluation order:
 * 
 *  {left:true,this:true, syms: *[]}
 *  {right:true, this:true, target:elem, syms: *[]}
 *  {funbody:true, this:true, syms: *[]}
 *  {funbody:true, syms: *[]}
 *  {this:true}
 *  {reference:true, syms: *[]}
 *  {funcall:true, external:true, arguments:elem [], syms: *[]}
 *  {trans:true}
 *
 *
 *
 * type Esprima.syntax=object|*;
 * type jamc.prototype.analyze = function(syntax:Esprima.syntax,options:{classname:string,level:number}) ->
 * {
 *   activities:object,
 *   transitions:object,
 *   subclasses:object,
 *   symbols:object,
 *   errors: string []
 * }
 */
 
jamc.prototype.analyze = function (syntax,_options) {
  var self=this,
      classname=_options.classname,
      level=_options.level,
      ep,elem,cp,declarator,ac,val,
      // Pre-defined top-level this.XX symbols
      syms={id:{type:'Literal'},ac:{type:'Literal'}},
      nextVal,
      transObj,
      actObj,
      subclassObj,
      transitions={},
      activities={},
      subclasses,
      aios,
      options={},
      errors=[],
      verbose=_options.verbose||0,
      err=function (msg) { errors.push(msg); (_options.err||this.err||Io.err)(msg)},
      out=_options.out||this.out||Io.out,
      warn=_options.warn||this.warn||Io.warn;
      
  switch (level) {
    case 0: aios=Aios.aios0; break;
    case 1: aios=Aios.aios1; break;
    case 2: aios=Aios.aios2; break;
    case 3: aios=Aios.aios3; break;
  }
  
  function unwrap(elem) {
    switch (elem.type) {
      case 'BlockStatement':
        if (elem.body.length==1) return elem.body[0];
        else return elem;
        break;
      default:
        return elem;
    }
  }
  
  function isThisExpr(elem) {
    switch (elem.type) {
      case 'MemberExpression':
        return isThisExpr(elem.object);
      case 'ThisExpression':
        return true;
    }
    return false;
  }
  
  function isEmpty(o) {
    if (!o) return true;
    for (var p in o) { if (o[p]!=undefined) return false;};
    return true;
  }
  
  /**************************
  ** Iterate Member Expression
  **************************/
  
  function iterMemberExpression (elem,options) {
    var part,corefun,obj;

    switch (elem.type) {
      case 'Identifier':
        if (!aios[elem.name] && !corefuncs[elem.name])
          err('['+classname+'] Call of undefined function: '+
              elem.name+', in level '+level+' ,at '+self.syntax.location(elem));            
        else if (corefuncs[elem.name]) {
          corefun=corefuncs[elem.name];
          if (!check_args(options.arguments,corefun)) {
            err('['+classname+']: Call of AIOS function '+elem.name+' with invalid number of arguments, '+
                '(expecting '+(corefun.argn.toString())+' argument(s), got '+options.arguments.length+
                '), in level '+level+
                ' ,at '+self.syntax.location(elem));
          }         
          return aios[elem.name];
        } else return aios[elem.name];    
        break;

      case 'MemberExpression':
        switch (elem.object.type) {
          case 'ThisExpression':
            if (!syms[elem.property.name] || syms[elem.property.name].context!='ThisExpression') 
                err("['+classname+'] Undefined 'this' reference: "+
                    elem.property.name+', at '+self.syntax.location(elem));
            if(syms[elem.property.name].type=='ObjectExpression') {
              var Osyms={};
              Comp.array.iter(syms[elem.property.name].properties,function (p) {
                Osyms[p.key.name]=p.type;
              });
              if (!isEmpty(Osyms))               
                return Osyms;
              else
                return none;
            } else return none;
            break;

          case 'Identifier':
            if (!aios[elem.object.name] && 
                !corefuncs[elem.object.name] &&
                !options.syms[elem.object.name]) {
              // console.log(elem);
              err('['+classname+'] Access of undefined object variable: '+
                  elem.object.name+', in level '+level+' ,at '+self.syntax.location(elem));
            } 

            if (properties[elem.property.name]) return undefined;
            if (elem.computed) return undefined; // TODO, check property!
            
            if (corefuncs[elem.object.name]) {
              obj=corefuncs[elem.object.name].obj||corefuncs[elem.object.name];
              if (!obj[elem.property.name]) {
                // console.log(corefuncs[elem.object.name])
                err('['+classname+'] Access of unknown AIOS(corefuncs) object attribute: '+
                    elem.object.name+'.'+elem.property.name+', in level '+level+' ,at '+self.syntax.location(elem));
              }
              return obj[elem.property.name];
            } else if (aios[elem.object.name]) {
              // console.log(elem);
              obj=aios[elem.object.name].obj||aios[elem.object.name];
              if (!obj[elem.property.name])
                err('['+classname+'] Access of unknown AIOS object attribute: '+
                    elem.object.name+'.'+elem.property.name+', in level '+level+' ,at '+self.syntax.location(elem));
              return obj[elem.property.name];
            } 
            else if (options.syms[elem.object.name]) {
              // console.log(elem);
              // User defined object, can't be resolved further
              return none;
            }                                   
            return;
            break;

          case 'MemberExpression': 
            part=iterMemberExpression(elem.object,options);
            if (part && part.obj) part=part.obj;
            if (!elem.computed && part && !part[elem.property.name] && !properties[elem.property.name]) {
              err('['+classname+'] Access of unknown object attribute: '+
                  self.syntax.name(elem)+' ('+elem.property.name+'), in level '+
                  level+' ,at '+self.syntax.location(elem));
            }
            if (elem.computed) check(elem.property,{reference:true,syms:options.syms});
            if (part && (typeof part[elem.property.name] == 'object') && !isEmpty(part[elem.property.name])) 
              return part[elem.property.name];
            else 
              return none;
            break;
        }
        break;
    } 
    return;
  }
  
  
  /**********************************
  ** Check for a declaration and add it to the symbol table
  **********************************/
  function addDeclaration(elem,options) {
    var ep,el;
    switch (elem.type) {
      case 'VariableDeclaration':
        for (ep in elem.declarations) {
          el=elem.declarations[ep];           
          if (!options.shadow[el.id.name]) options.shadow[el.id.name]=options.syms[el.id.name];
          if (el.type=='VariableDeclarator') {
            if (el.id.type=='Identifier') {
              options.syms[el.id.name]=el;
            }
          }
        }
        break;
      case 'FunctionDeclaration':
        if (!options.shadow[elem.id.name]) options.shadow[elem.id.name]=options.syms[elem.id.name];
        options.syms[elem.id.name]=elem;
        break;

      case 'ForStatement':
        addDeclaration(elem.init,options);
        break;

    }
  }
  
  /*********************************
  ** Main checker function
  *********************************/
  
  function check(elem,options) {
    var ep,el,name,thismaybe,shadow,locshadow;
/*    
console.log(elem);
console.log(options);    
*/
    /*
    ** Top-level statements 
    */
    if (options.left && options.this) {
      // LHS check of agent class top-level statements
      switch (elem.type) {
      
        case 'Identifier':
          err('['+classname+'] Assignment may not contain free variables: var '+
              elem.name+', at '+self.syntax.location(elem));
          break;
          
        case 'MemberExpression':
          if (elem.object.type != 'ThisExpression')
            err('['+classname+'] Assignment may not contain non-this MemberExpression on left side: '+
                self.syntax.name(elem.object)+', at '+self.syntax.location(elem));
          switch (elem.property.type) {
          
            case 'Identifier':
              if (syms[elem.property.name])
                err('['+classname+'] Found duplicate property definition: '+
                    elem.property.name+' ('+syms[elem.property.name].type+'), at '+self.syntax.location(elem));
              else {
                syms[elem.property.name]=options.target;
                syms[elem.property.name].context=elem.object.type;
              }
              switch (elem.property.name) {
                case 'act':     actObj = options.target; break;
                case 'trans':   transObj = options.target; break;
                case 'subclass':   subclassObj = options.target; break;
              }
              break;
          }
          break;
      }
    }
    else if (options.right && options.this) {
      // RHS check of agent class top-level statements
      switch (elem.type) {
        case 'Literal':
        case 'Identifier':
          switch (options.target.property.name) {
            case 'next':
              val = elem.value||elem.name;
              if (!Comp.obj.isString(val)) 
                  err('['+classname+'] Invalid next property, expected string, got '+
                      val+', at '+self.syntax.location(elem));
              nextVal = val;
              break;
          }
          break;
          
        case 'ObjectExpression':
          switch (options.target.property.name) {        
            case 'trans':
              for (ep in elem.properties) {
                el=elem.properties[ep];
                //console.log(el)
                if (el.type=='Property') {
                  transitions[el.key.name]=el.value;
                }
              }
              break;

            case 'act':
              for (ep in elem.properties) {
                el=elem.properties[ep];
                // console.log(el)
                if (el.type=='Property') {
                  if (aios[el.key.name])
                    err('['+classname+'] Activity name '+el.key.name+
                        ' shadows AIOS function or object, at '+self.syntax.location(elem));
                  
                  
                  activities[el.key.name]=el.value;
                }
              }
              break;

            case 'subclass':
              subclasses={};
              for (ep in elem.properties) {
                el=elem.properties[ep];
                // console.log(el)
                if (el.type=='Property') {
                  subclasses[el.key.name]=el.value;
                }
              }
              break;
          }
          break; 
          
        case 'FunctionExpression':
          // Check and add function parameters
          locshadow={};
          for (ep in elem.params) {
            param=elem.params[ep];
            if (param.type!='Identifier')
              err('['+classname+'] Invalid function parameter type'+param.type+', expected Identifier'+
                  ', at '+self.syntax.location(elem));
            locshadow[param.name]=options.syms[param.name];
            options.syms[param.name]=param.type;
          }
          check(elem.body,{funbody:true,this:true,syms:options.syms});
          // Restore symbol table
          for (ep in locshadow) {
            options.syms[ep]=locshadow[ep];
          }
          break;     
      }
    }
    
    /*
    ** Function body statements that can access the agent object by 'this' 
    */
    else if (options.funbody && options.this) {
      // Activity or transition top- or second level function bodies - 'this' references always the agent object!
      elem=unwrap(elem);
      
      switch (elem.type) {
        case 'BlockStatement':
          // Local symbols 
          if (options.shadow) shadow=options.shadow;
          options.shadow={};
          // First get all function and variable definitions in current scope
          if (!options.syms) options.syms={};
          Comp.array.iter(elem.body,function (el) {
            addDeclaration(el,options);
          });
          // Now check the body statements
          Comp.array.iter(elem.body,function (el) {check(el,options)});
          if (options.syms) for (ep in options.shadow) {
            options.syms[ep]=options.shadow[ep];
          }
          options.shadow=shadow;    
          break;
          
        case 'ExpressionStatement':
          switch (elem.expression.type) {
          
            case 'AssignmentExpression':
              switch (elem.expression.left.type) {
                case 'MemberExpression':  
                  if (isThisExpr(elem.expression.left.object))
                    check(elem.expression.left,{this:true});
                  break;
                case 'Identifier':
                  check(elem.expression.left,{reference:true,syms:options.syms});
                  break;
              }
              check(elem.expression.right,{reference:true,syms:options.syms});              
              break;
              
            case 'CallExpression':
              thismaybe=[]; // for 'this' propagation to arguments
              if (elem.expression.callee.object && isThisExpr(elem.expression.callee.object)) {
                check(elem.expression.callee,{this:true,funcall:true,arguments:elem.expression.arguments});
              } else {
                if (corefuncs[elem.expression.callee.name] && corefuncs[elem.expression.callee.name].this)
                {
                    thismaybe=corefuncs[elem.expression.callee.name].this;           
                }
                if (options.syms[elem.expression.callee.name]) {
                  if (options.syms[elem.expression.callee.name].type != 'FunctionDeclaration')
                    err('['+classname+'] Not a function:'+elem.expression.callee.name+
                        ', at '+self.syntax.location(elem));
// TODO                  
                } else
                  /* AIOS function call */
                  check(elem.expression.callee,{funcall:true,external:true,syms:options.syms,
                                                arguments:elem.expression.arguments});
              }
              // Check arguments
              Comp.array.iter(elem.expression.arguments,function (el,i) {
                var ep,param,shadow;
                if (!Comp.array.member(thismaybe,i)) {
                  check(el,{reference:true,syms:options.syms});                
                } else {
                  // It's a AIOS function call with a function argument. 
                  // Check function body with 'this' referencing the agent object.
                  
                  switch (el.type) {
                    case 'ArrayExpression':
                      // Block of functions ...
                      Comp.array.iter(el.elements,function (el_block,block_i) {
                        if (el_block.type != 'FunctionExpression')
                          err('['+classname+'] Invalid argument '+(i+1)+' of AIOS core function '+
                              elem.expression.callee.name+': Expeceted FunctionExpression array, but got '+
                              el_block.type+ ' element (array index '+(block_i+1)+')'+
                              ', at '+self.syntax.location(elem));
                        check(el_block.body,{funbody:true,this:true,syms:options.syms});                          
                      });
                      break;
                      
                    case 'FunctionExpression':
                      // Check and add function parameters
                      shadow={};
                      for (ep in el.params) {
                        param=el.params[ep];
                        if (param.type!='Identifier')
                          err('['+classname+'] Invalid function parameter type'+param.type+', expected Identifier'+
                              ', at '+self.syntax.location(elem));
                        if (options.syms[param.name]) shadow[param.name]=options.syms[param.name];
                        options.syms[param.name]=param.type;
                      }
                      check(el.body,{funbody:true,this:true,syms:options.syms});
                      // Restore symbol table
                      for (ep in shadow) {
                        options.syms[ep]=shadow[ep];
                      }
                      break;

                    case 'ArrowFunctionExpression':
                      // Check and add function parameters
                      shadow={};
                      for (ep in el.params) {
                        param=el.params[ep];
                        if (param.type!='Identifier')
                          err('['+classname+'] Invalid function parameter type'+param.type+', expected Identifier'+
                              ', at '+self.syntax.location(elem));
                        if (options.syms[param.name]) shadow[param.name]=options.syms[param.name];
                        options.syms[param.name]=param.type;
                      }
                      check(el.body,{funbody:true,this:true,syms:options.syms});
                      // Restore symbol table
                      for (ep in shadow) {
                        options.syms[ep]=shadow[ep];
                      }
                      break;
                      
                    case 'CallExpression':
                      // TODO, check arguments ..
                      break;
                      
                    case 'Identifier':
                      // Nothing to do?
                      break;
                      
                    default:
                      err('['+classname+'] Invalid argument '+(i+1)+' of AIOS core function '+
                          elem.expression.callee.name+': Expeceted FunctionExpression, ArrowFunctionExpression, ArrayExpression, or Identifier, but got '+
                          el.type+
                          ', at '+self.syntax.location(elem));
                  }
                }  
              });
              break;
              
            case 'UpdateExpression':
              check(elem.expression.argument,{reference:true,syms:options.syms});
              break;
          }
          break;
          
        case 'VariableDeclaration':
          // console.log(elem.declarations);
          if (!options.shadow) options.shadow={};
          for (ep in elem.declarations) {
            el=elem.declarations[ep];           
            if (!options.shadow[el.id.name]) options.shadow[el.id.name]=options.syms[el.id.name];
            if (el.type=='VariableDeclarator') {
              if (el.id.type=='Identifier') {
                options.syms[el.id.name]=el;
              }
            }
          }
          break;
          
        case 'IfStatement':
          check(elem.consequent,options);
          if (elem.alternate) check(elem.alternate,options);
          check(elem.test,{reference:true,syms:options.syms});
          break;
          
        case 'ForStatement':
          //console.log(elem)
          check(elem.body,options);
          check(elem.init,{reference:true,syms:options.syms});
          check(elem.test,{reference:true,syms:options.syms});
          check(elem.update,{reference:true,syms:options.syms});
          break;
          
        case 'WhileStatement':
          //console.log(elem)
          check(elem.body,options);
          check(elem.test,{reference:true,syms:options.syms});
          break;

        case 'ReturnStatement':
          if (elem.argument)
            check(elem.argument,{reference:true,syms:options.syms});
          break;
          
        case 'FunctionDeclaration':
          if (!options.shadow[elem.id.name]) options.shadow[elem.id.name]=options.syms[elem.id.name];
          options.syms[elem.id.name]=elem;
          /* agent object not accessible in function body! */
          // Check and add function parameters
          locshadow={};
          for (ep in elem.params) {
            param=elem.params[ep];
            if (param.type!='Identifier')
              err('['+classname+'] Invalid function parameter type'+param.type+', expected Identifier'+
                  ', at '+self.syntax.location(elem));
            locshadow[param.name]=options.syms[param.name];
            options.syms[param.name]=param.type;
          }
          check(elem.body,{funbody:true,syms:options.syms});
          // Restore symbol table
          for (ep in locshadow) {
            options.syms[ep]=locshadow[ep];
          }
          
          break;
      }
    }
    /*
    ** Funcion body that cannot access the agent object (local functions) 
    */
    else if (options.funbody) {
// TODO    
      elem=unwrap(elem);
      
      switch (elem.type) {
        case 'BlockStatement':
          // Local symbols 
          if (options.shadow) shadow=options.shadow;
          options.shadow={};
          // First get all function and variable definitions in current scope
          if (!options.syms) options.syms={};
          Comp.array.iter(elem.body,function (el) {
            addDeclaration(el,options);
          });
          Comp.array.iter(elem.body,function (el) {check(el,options)});
          if (options.syms) for (ep in options.shadow) {
            options.syms[ep]=options.shadow[ep];
          }
          options.shadow=shadow;    
          break;

        case 'ExpressionStatement':
          switch (elem.expression.type) {
          
            case 'AssignmentExpression':
              switch (elem.expression.left.type) {
                case 'MemberExpression':  
                  if (elem.expression.left.object && isThisExpr(elem.expression.left.object))
                    check(elem.expression.left,{syms:options.syms});
                  break;
                case 'Identifier':
                  check(elem.expression.left,{reference:true,syms:options.syms});
                  break;
              }
              check(elem.expression.right,{reference:true,syms:options.syms});              
              break;
              
            case 'CallExpression':
              thismaybe=[]; // for 'this' propagation to arguments
              if (elem.expression.callee.object && isThisExpr(elem.expression.callee.object)) {
                check(elem.expression.callee,{this:true,funcall:true,arguments:elem.expression.arguments});
              } else {
                if (corefuncs[elem.expression.callee.name] && corefuncs[elem.expression.callee.name].this)
                {
                    thismaybe=corefuncs[elem.expression.callee.name].this;           
                }
                if (options.syms[elem.expression.callee.name]) {
                  if (options.syms[elem.expression.callee.name].type != 'FunctionDeclaration')
                    err('['+classname+'] Not a function:'+elem.expression.callee.name+
                        ', at '+self.syntax.location(elem));
// TODO                  
                } else
                  /* AIOS function call */
                  check(elem.expression.callee,{funcall:true,external:true,syms:options.syms,
                                                arguments:elem.expression.arguments});
              }
              // Check arguments
              Comp.array.iter(elem.expression.arguments,function (el,i) {
                var ep,param,shadow;
                if (!Comp.array.member(thismaybe,i)) {
                  check(el,{reference:true,syms:options.syms});                
                } else {
                  // It's a AIOS function call with a function argument. 
                  // Check function body with 'this' referencing the agent object.
                  
                  switch (el.type) {
                    case 'ArrayExpression':
                      // Block of functions ...
                      Comp.array.iter(el.elements,function (el_block,block_i) {
                        if (el_block.type != 'FunctionExpression')
                          err('['+classname+'] Invalid argument '+(i+1)+' of AIOS core function '+
                              elem.expression.callee.name+': Expeceted FunctionExpression array, but got '+
                              el_block.type+ ' element (array index '+(block_i+1)+')'+
                              ', at '+self.syntax.location(elem));
                        check(el_block.body,{funbody:true,this:true,syms:options.syms});                          
                      });
                      break;
                      
                    case 'FunctionExpression':
                      // Check and add function parameters
                      shadow={};
                      for (ep in el.params) {
                        param=el.params[ep];
                        if (param.type!='Identifier')
                          err('['+classname+'] Invalid function parameter type'+param.type+', expected Identifier'+
                              ', at '+self.syntax.location(elem));
                        if (options.syms[param.name]) shadow[param.name]=options.syms[param.name];
                        options.syms[param.name]=param.type;
                      }
                      check(el.body,{funbody:true,this:true,syms:options.syms});
                      // Restore symbol table
                      for (ep in shadow) {
                        options.syms[ep]=shadow[ep];
                      }
                      break;

                    case 'ArrowFunctionExpression':
                      // Check and add function parameters
                      shadow={};
                      for (ep in el.params) {
                        param=el.params[ep];
                        if (param.type!='Identifier')
                          err('['+classname+'] Invalid function parameter type'+param.type+', expected Identifier'+
                              ', at '+self.syntax.location(elem));
                        if (options.syms[param.name]) shadow[param.name]=options.syms[param.name];
                        options.syms[param.name]=param.type;
                      }
                      check(el.body,{funbody:true,this:true,syms:options.syms});
                      // Restore symbol table
                      for (ep in shadow) {
                        options.syms[ep]=shadow[ep];
                      }
                      break;

                    case 'CallExpression':
                      // TODO, check arguments ..
                      break;
                      
                    case 'Identifier':
                      // Nothing to do?
                      break;
                      
                     default:
                      err('['+classname+'] Invalid argument '+(i+1)+' of AIOS core function '+
                          elem.expression.callee.name+': Expeceted FunctionExpression, ArrowFunctionExpression, ArrayExpression, or Identifier, but got '+
                          el.type+
                          ', at '+self.syntax.location(elem));
                  }
                }  
              });
              break;
              
            case 'UpdateExpression':
              check(elem.expression.argument,{reference:true,syms:options.syms});
              break;
          }
          break;
          
        case 'VariableDeclaration':
          for (ep in elem.declarations) {
            el=elem.declarations[ep];
            if (!options.shadow[el.id.name]) options.shadow[el.id.name]=options.syms[el.id.name];
            if (el.type=='VariableDeclarator') {
              if (el.id.type=='Identifier') {
                options.syms[el.id.name]=el;
              }
            }
          }
          break;
          
        case 'IfStatement':
          check(elem.consequent,options);
          if (elem.alternate) check(elem.alternate,options);
          check(elem.test,{reference:true,syms:options.syms});
          break;
          
        case 'ForStatement':
          //console.log(elem)
          check(elem.body,options);
          check(elem.init,{reference:true,syms:options.syms});
          check(elem.test,{reference:true,syms:options.syms});
          check(elem.update,{reference:true,syms:options.syms});
          break;
          
        case 'WhileStatement':
          //console.log(elem)
          check(elem.body,options);
          check(elem.test,{reference:true,syms:options.syms});
          break;

        case 'ReturnStatement':
          if (elem.argument)
            check(elem.argument,{reference:true,syms:options.syms});
          break;

        case 'FunctionDeclaration':
          if (!options.shadow[elem.id.name]) options.shadow[elem.id.name]=options.syms[elem.id.name];
          options.syms[elem.id.name]=elem;
          /* agent object not accessible in function body! */
          // Check and add function parameters
          locshadow={};
          for (ep in elem.params) {
            param=elem.params[ep];
            if (param.type!='Identifier')
              err('['+classname+'] Invalid function parameter type '+param.type+', expected Identifier'+
                  ', at '+self.syntax.location(elem));
            locshadow[param.name]=options.syms[param.name];
            options.syms[param.name]=param.type;
          }
          check(elem.body,{funbody:true,syms:options.syms});
          // Restore symbol table
          for (ep in locshadow) {
            options.syms[ep]=locshadow[ep];
          }
          
          break;
      }      
    } 
    /*
    ** Check agent object 'this' reference
    */
    else if (options.this) {
      // Check symbol reference for ThisExpression only
      switch (elem.object.type) {
        case 'MemberExpression':
          check(elem.object,{this:true});
          break;
        case 'ThisExpression':
          if (!syms[elem.property.name]) 
            err('['+classname+"] Undefined 'this' reference: "+
                elem.property.name+', at '+self.syntax.location(elem));
          if(options.funcall && syms[elem.property.name].type != 'FunctionExpression')
            err('['+classname+"] Not a function: this."+
                elem.property.name+', at '+self.syntax.location(elem));
      }
    }
    /*
    ** Check generic references
    */
    else if (options.reference) {
      // Check symbol reference for local symbols only
      switch (elem.type) {
        case 'Identifier':
          if (!options.syms[elem.name] && !literals[elem.name] && !aios[elem.name] && !activities[elem.name]) 
            err('['+classname+'] Undefined variable reference: '+
                elem.name+', at '+self.syntax.location(elem));
          break;
          
        case 'BinaryExpression':
          check(elem.left,options);
          check(elem.right,options);
          break;

        case 'AssignmentExpression':
          switch (elem.left.type) {
            case 'MemberExpression':
              if (elem.left.object && isThisExpr(elem.left.object))
                check(elem.left,{this:true});
              break;
            case 'Identifier':
              check(elem.left,{reference:true,syms:options.syms});
              break;
          }
          check(elem.right,options);
          break;

        case 'UpdateExpression':
          check(elem.argument,options);
          break;
          
        case 'MemberExpression':
          switch (elem.object.type) {
            case 'ThisExpression':
              check(elem,{this:true,syms:options.syms});
              break;
            case 'Identifier':
              check(elem.object,{reference:true,syms:options.syms});
              if (elem.computed) switch (elem.property.type) {
                case 'Identifier':
                  check(elem.property,{reference:true,syms:options.syms});
                  break;            
              }
              break;
            case 'MemberExpression':
              iterMemberExpression(elem,options);

              //if (isThisExpr(elem.object))
              //    check(elem.object,{this:true,syms:options.syms});                
          }
          break;

        case 'ArrayExpression':
          Comp.array.iter(elem.elements, function (el2,i) {
            if (el2) check(el2,{reference:true,syms:options.syms});          
          });
          break;
          
        case 'CallExpression':         
          if (elem.callee.object && isThisExpr(elem.callee.object)) {
            check(elem.callee,{this:true,funobj:true,arguments:elem.arguments});
          } else {
            if (options.syms[elem.callee.name]) {
              if (options.syms[elem.callee.name].type != 'FunctionDeclaration')
                err('['+classname+'] Not a function:'+elem.callee.name+
                    ', at '+self.syntax.location(elem));
              /* Internal function call, nothing to do */
            } else 
              check(elem.callee,{funcall:true,external:true,syms:options.syms,
                                 arguments:elem.arguments});
          }
          Comp.array.iter(elem.arguments,function (el) {
            check(el,{reference:true,syms:options.syms,arguments:elem.arguments})
          });          
          break;
      }
    }
    /*
    ** AIOS function calls and objects
    */
    else if (options.funcall && options.external) {
      // Check external AIOS function references
      switch (elem.type) {
        case 'Identifier':
        case 'MemberExpression':
          iterMemberExpression(elem,options);
          break;
      }      
    } 
    /*
    ** Check transition function body statements
    */
    else if (options.trans) {
      switch (elem.type) {
        case 'BlockStatement': 
          Comp.array.iter(elem.body,function (el) {check(el,options)});
          break;     
               
        case 'IfStatement':
          check(elem.consequent,options);
          if (elem.alternate) check(elem.alternate,options);
          break;
          
        case 'ReturnStatement':
          options.ret++;
          if (elem.argument) 
            check(elem.argument,options);
          else
            if (verbose) warn('['+classname+'] Returns undefined in transition '+
                              options.trans+', at '+self.syntax.location(elem)+'.');
          break;
          
        case 'Literal':
          if (!activities[elem.value])
            err('['+classname+'] Returns unknown activity reference '+
                elem.value+' in transition '+options.trans+', at '+self.syntax.location(elem)+'.');
          break;
          
        case 'Identifier':
          if (!activities[elem.name])
            err('['+classname+'] Returns unknown activity reference '+
                elem.name+' in transition '+options.trans+', at '+self.syntax.location(elem)+'.');
          break;
      }      
    }
    
  } /* End of check */
  
  /************************
  ** Analyzer
  ************************/
  
  if (verbose) out('Analyzing agent class "'+classname+'" ..');
  if (syntax.type!='Program') 
    err('Syntax is not a program: '+syntax.type);
    
  // Phase 1 
  loop1: for (ep in syntax.body) {
    var elem=syntax.body[ep];
    if (elem.type!='VariableDeclaration') 
      err('Body element is not a variable declaration: '+elem.type);
    for(cp in elem.declarations) {
      var declarator=elem.declarations[cp];
      if (declarator.type!='VariableDeclarator') {
        err('VariableDeclaration element is not a variable declarator: '+declarator.type);
      }
      if (declarator.id.name!='ac') 
        err('['+classname+'] Entry not found, expected ac, got: '+declarator.id.name);
      else { ac=declarator; break loop1;};
    }
  }
  if (!ac)
    err('No agent class template found.');
  if (!ac.init || ac.init.type != 'FunctionExpression')
    err('['+classname+'] Entry is invalid, expected function, got: '+ac.init.type);
  if (ac.init.type != 'FunctionExpression')
    err('['+classname+'] Entry is invalid, expected function, got: '+ac.init.type);

  if (ac.init.body.type != 'BlockStatement')
    err('['+classname+'] Entry is invalid, expected function body, got: '+ac.init.body.type);
    
  // Phase 2 Agent Class Pre-check / Top-level / Top symbol table creation
  loop2: for (ep in ac.init.body.body) {
    var elem=ac.init.body.body[ep];

    switch (elem.type) {
      case 'VariableDeclaration':
        err('['+classname+'] May not contain free variable declarations: '+
            Comp.printf.list(Comp.array.map(elem.declarations,function (decl) {
                  if (decl.type!='VariableDeclarator') return '?'; 
                    else return 'var '+self.syntax.name(decl.id)
                }))+', at '+self.syntax.location(elem));
        break;
      case 'ExpressionStatement': 
        switch (elem.expression.type) {
          case 'AssignmentExpression':
            check(elem.expression.left,{left:true,this:true,target:elem.expression.right});
            check(elem.expression.right,{right:true,this:true,target:elem.expression.left,syms:syms});
            break;
          case 'MemberExpression':          
            if (elem.expression.object && elem.expression.object.type=='ThisExpression')
              check(elem.expression,{left:true,this:true,target:{type:'undefined'}});
            break;
        }
        break;
      default:
        err('['+classname+'] Invalid top-level '+elem.type+
            ', at '+self.syntax.location(elem));
        break;
    }
  }
  
  if (!syms['act'] || syms['act'].type != 'ObjectExpression') 
    err('['+classname+'] Found no or no valid activity section, expecting this.act={..}.');
  if (!syms['trans'] || syms['trans'].type != 'ObjectExpression') 
    err('['+classname+'] Found no or no valid transition section, expecting this.trans={..}.');
  if (syms['on'] && syms['on'].type != 'ObjectExpression') 
    err('['+classname+'] Found invalid handler section, expecting this.on={..}.');
  if (!syms['on'] && verbose) 
    warn('['+classname+'] Found no handler section, expecting this.on={..}.');
  if (!nextVal) 
    err('['+classname+'] Found no next attribute, expecting  this.next="<nextact>".');
  if (!activities[nextVal])
    err('['+classname+'] Found invalid next attribute pointing to undefined activity '+nextVal+'.');
  
  // Phase 3 Function, Activity, and Transition properties check
  loop3A: for (ep in activities) {
    var elem=activities[ep];
    if (!transitions[ep] && verbose) warn('['+classname+'] No transition entry found for activity '+ep);
    switch (elem.type) {
      case 'FunctionExpression':
        options={funbody:true,this:true,syms:{}};
        check(elem.body,options); 
        elem.syms=syms;
        break;
      case 'ArrowFunctionExpression':
        options={funbody:true,this:true,syms:{}};
        check(elem.body,options); 
        elem.syms=syms;
        break;
      default:
        err('['+classname+'] Found invalid activity entry, expecting FunctionExpression or ArrowFunctionExpression, got '+
            elem.type+', at '+self.syntax.location(elem));
        
    }  
  }
  loop3B: for (ep in transitions) {
    var elem=transitions[ep],opt;
    if (!activities[ep])
        err('['+classname+'] Transition entry found referencing unknown activity: '+
            ep+', at '+self.syntax.location(elem));
    switch (elem.type) {
      case 'Identifier': 
        if (!activities[elem.name])
          err('['+classname+'] Unknown transition found: '+
            elem.name+', at '+self.syntax.location(elem));
        
        break;
      case 'Literal': 
        if (!activities[elem.value])
          err('['+classname+'] Unknown transition found: '+
            elem.value+', at '+self.syntax.location(elem));
        
        break;
      case 'FunctionExpression': 
        opt={trans:ep,ret:0};
        check(elem.body,opt);
        if (opt.ret==0 && verbose) 
           warn('['+classname+'] Missing return (undefined) in transition '+
                 opt.trans+', at '+self.syntax.location(elem)+'.');
        break;
      case 'ArrowFunctionExpression': 
        opt={trans:ep,ret:0};
        check(elem.body,opt);
        if (opt.ret==0 && verbose) 
           warn('['+classname+'] Missing return (undefined) in transition '+
                 opt.trans+', at '+self.syntax.location(elem)+'.');
        break;
      default:
        err('['+classname+'] Found invalid transition entry, expecting FunctionExpression or ArrowFunctionExpression, Identifier, or String Literal, got '+
            elem.type+', at '+self.syntax.location(elem));
        
    }  
  }

  if (verbose) out(classname+' passed check.');
  if (verbose) {
    out(classname+' has the following top-level object properties:');
    for (ep in syms) {
      var sym=syms[ep];
      if (!sym) continue;
      out('       '+ep+' : '+sym.type);
    }
    out(classname+' has the following activities:');
    for (ep in activities) {
      var elem=activities[ep];
      out('       '+ep);
    }
    out(classname+' next activity: '+nextVal);
    out(classname+' has the following transition entries:');
    for (ep in transitions) {
      var elem=transitions[ep];
      out('       '+ep);
    }
    if (subclasses) {
      out(classname+' has the following subclass entries:');
      for (ep in subclasses) {
        var elem=subclasses[ep];
        out('       '+ep);
      }
    }
  }
  if (verbose>1) {
    out(classname+' has the following top-level symbols:');
    for (ep in syms) {
      if (!syms[ep]) continue;
      out('       '+ep+':'+(verbose>2?Io.inspect(syms[ep]):syms[ep].type));
    }
  }
  return {
    activities:activities,
    transitions:transitions,
    subclasses:subclasses,
    symbols:syms,
    errors: errors
  }
}


module.exports = {
  corefuncs:corefuncs,
  /* Extend corefuncs */
  extend: function (funcs) {
    var p;
    for(p in funcs) {
      corefuncs[p]=funcs[p];
    }
  },
  jamc:jamc,
  options:options,
  current:function (module) { current=module.current; Aios=module; }
};
