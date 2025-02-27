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
 **    $INITIAL:     (C) 2006-2022 BSSLAB
 **    $CREATED:     8-2-16 by sbosse.
 **    $VERSION:     1.17.1
 **
 **    $INFO:
 **
 **  JavaScript AIOS Machine Learning API
 **
 ** type algorithm = {'dti','dt','id3','c45','kmeans','knn','knn2','mlp','slp','rl','svm','txt','cnn'}
 **
 **
 ** id3: Symbolic Decision Tree algorithm
 ** -------------------------------------
 **
 ** typeof @options = {
 **   algorithm='id3',
 **   data:{x1:number,x2:number,..,y:*} []
 **   target:string is e.g. 'y'
 **   features: string [] is e.g. ['x1','x2',..]
 ** }
 **
 ** ice: decision tree algorithm supporting numbers with eps intervals (hybrid C45/ID3)
 ** -------------------------------------
 **
 ** General feature variable set:
 **
 ** typeof @options = {
 **   algorithm='dt',
 **   data:{x1:number,x2:number,..,y:*} [],
 **   target:string is e.g. 'y',
 **   features: string [] is e.g. ['x1','x2',..],
 **   eps:number is e.g. '5',
 ** }
 ** 
 ** dti: interval decision tree algorithm
 ** -------------------------------------
 **
 ** General feature variable set:
 **
 ** typeof @options = {
 **   algorithm='dti',
 **   data:{x1:number,x2:number,..,y:*} []
 **   target:string is e.g. 'y'
 **   features: string [] is e.g. ['x1','x2',..]
 **   eps:number is e.g. '5',
 **   maxdepth:number,
 ** }
 ** 
 ** Or vector feature variables (i.e., features=[0,1,2,...n-1], target=n):
 **
 ** typeof @options = {
 **   algorithm='dti',
 **   x:* [] [],
 **   y:* [],
 **   eps:number is e.g. '5',
 **   maxdepth:number,
 ** }
 **
 ** knn: k-Nearest-Neighbour Algorithm
 ** ----------------------------------
 **
 ** typeof @options = {
 **   algorithm='knn',
 **   x: number [][], 
 **   y: * []
 ** }
 **
 ** mlp: multi layer perceptron Algorithm
 ** ----------------------------------
 **
 ** typeof @options = {
 **   algorithm='mlp',
 **   x: number [][], 
 **   y: number [] [] | * [],
 **   hidden_layers?:number [],
 **   lr?:number,
 **   epochs?:number,
 **   labels?:string [], 
 **   features?: string [], 
 **   normalize?, 
 **   verbose?:number
 ** }
 **
 **
 ** cnn: Convolutional Neural Network for numerial (2D) data
 ** -------------------------------------
 **
 ** General feature variable set:
 **
 ** typeof @options = {
 **   algorithm='cnn',
 **   data:{x:[]|[][],y:'a} []
 **   layers: layer [],
 **   trainer:trainer,
 ** }
 ** type layer = 
 **  {type:'input', out_sx:number, out_sy:number, out_depth:number} | // Input Layer
 **  {type:'conv', sx:number, filters:number, stride:number, pad:number, activation:string} | // Convolution Layer
 **  {type:'pool', sx:number, stride:number} | // Pooling Layer
 **  {type:'softmax', num_classes:number} | // Classifier Layers
 **  {type:'svm', num_classes:number| // Classifier Layers
 **  {type:'fc', num_neurons:number, activation:string} // Fully Connected Layer
 **
 ** typeof activation = 'relu'| 'maxout' | 'sigmoid' | 'tanh' ..
 **
 ** type trainer = 
 **  {method: 'sgd', learning_rate:number,  momentum: number, batch_size:number, l2_decay:number} |
 **  {method: 'adadelta', learning_rate:number,  eps: number, ro:number, batch_size:number, l2_decay:number} |
 **  {method: 'adam', learning_rate:number, eps: number, beta1: number, beta2: number, batch_size: number, l2_decay:number} |
 **  ..
 **
 ** text: text analysis (similarity checking)
 ** -----------------------------------------
 **   classify(model,string) -> {match:number [0..1],string:string }
 **   learn({algorithm:ML.TXT, data:string []]) -> model
 **   test({algorithm:ML.TXT,string:string}|model,string) -> number [0..1]
 **   similarity(string,string) -> number [0..1]
 ** 
 **    $ENDOFINFO
 */
var Io = Require('com/io');
var Comp = Require('com/compat');


var ICE = Require('ml/ice'); // ICE ID3/C45 eps
var DTI = Require('ml/dti');
var KNN = Require('ml/knn');
var KMN = Require('ml/kmeans');
var SVM = Require('ml/svm');
var MLP = Require('ml/mlp');
var ID3 = Require('ml/id3');
var C45 = Require('ml/C45');
var TXT = Require('ml/text');
var RF  = Require('ml/rf');
var RL  = Require('ml/rl');
var STAT= Require('ml/stats');
var CNN = Require('ml/cnn');
var ANN = Require('ml/ann');
var PCA = Require('ml/pca');

var current=none;
var Aios=none;

var options = {
  version: '1.17.1'
}

// Some definitions
var ML = {
  // Algorithms
  ANN:'ann',    // neataptic NN 
  C45:'c45',
  CNN:'cnn',
  ICE:'ice',   // ICE ID3/C45 eps
  DTI:'dti',
  ID3:'id3',
  KMN:'kmeans',
  KNN:'knn',
  KNN2:'knn2',
  MLP:'mlp',
  RF:'rf',    // Random Forest
  RL:'rl',    // Reinforcement Leerner
  SLP:'slp',  // Synonym for MLP (but single layer)
  SVM:'svm',
  TXT:'txt',
  // Some Functions
  EUCL:'euclidean',
  PEAR:'pearson',
  
  // RL agents
  DPAgent:'DPAgent',
  TDAgent:'TDAgent',
  DQNAgent:'DQNAgent',
};

/**
 * Computes Log with base-2
 * @private
 */
function log2(n) {
  return Math.log(n) / Math.log(2);
}

function obj2Array(row,features) {
  return features.map(function (attr) { return row[attr] });
}
function objSlice(row,features) {
  var o = {};
  features.forEach(function (attr) { o[attr]=row[attr] });
  return o;
}

// transform [v][] -> v[]
function relax(mat) {
  if (Comp.obj.isMatrix(mat) && mat[0].length==1) return mat.map(function (row) { return row[0]})
  else return mat;
}

// transform v[] -> [v][]
function wrap(mat) {
  if (!Comp.obj.isMatrix(mat)) return mat.map(function (v) { return [v]})
  else return mat
}

/* Common data transformation between different formats
**
** 1a. need='xy':   data={$x:'a,$y:'b}[] -> {x:{$x} [], y:'b[]}
** 1b. need='xy':   data=('a|'b)[][] -> {x:'a [][], y:'b[]}
** 1c. need='xry':  data=('a|'b)[][] -> {x:{$x} [], y:'b[]}
** 1c. need='io':   data=number[][] -> {input:number, output:number} []
** 1d. need='io':   data={$x:number,$y:number}[] -> {input:number, output:number} []
** 2. need='xmy':   data={$x:'a,$y:'b}[] -> {x:'a [][], y:'b[]}
** 3. need='d':     data={x:'a[][],y:'b[]}} -> {data:{$x:'a,$y:'b}[][]}
** 4. need='dm':    data={x:'a[][],y;'b[]} -> {data:('a|'b)[][]}
** 5. need='m':     data={$x:'a}[] -> 'a [][]
** 6. need='a':     data={$x:'a} -> 'a []

** typeof options = {
**   scale:   {k:number, off:number, shift:number} is transformation of input data,
**   xscale:  {k:number, off:number, shift:number} is transformation of input data,
**   yscale:  {k:number, off:number, shift:number} is transformation of output data,
**   features : string [] is feature variable list,
**   target: string is output variable,
**
**/
function scale(vrow,scala) {
  if (!scala) return vrow;
  if (typeof vrow == 'number') {
    if (typeof scala.k == 'number')
      return scala.shift+(vrow-scala.off)*scala.k
    else
      return scala.shift+(vrow-scala.off[0])*scala.k[0];
  }
  if (typeof scala.k == 'number')
    return vrow.map(function (col,i) { 
      return scala.shift+(col-scala.off)*scala.k })
  else
    return vrow.map(function (col,i) { 
      return scala.shift+(col-scala.off[i])*scala.k[i] })
}

function unscale(vrow,scala) {
  if (!scala) return vrow;
  if (typeof vrow == 'number') {
    if (typeof scala.k == 'number')
      return (vrow-scala.shift)/scala.k+scala.off
    else
      return (vrow-scala.shift)/scala.k[0]+scala.off[0]
  }
}

function preprocess(data,need,options) {
  var row,x,y,_data;
  options=options||{};
  var scala=options.scale || options.xscale;
  function array(data) {
    return Comp.obj.isArray(data)?data:[data]
  } 
  if (Comp.obj.isArray(data)) {
    row=data[0];
    switch (need) {
      case 'xy':
      case 'xry':
        if (options.target!=undefined && options.features!=undefined) {
          if (Comp.obj.isArray(row) && need=='xy') {
            if (Number(options.target)==row.length-1) {
              x=data.map(function (row) { return scale(row.slice(0,options.target),scala) });
              y=data.map(function (row) { return row[options.target] })
            }
          } else  if (Comp.obj.isObj(row)) {
            if (typeof options.target == 'string') {
              x=data.map(function (row) { return scale(objSlice(row,options.features),scala) });
              y=data.map(function (row) { return row[options.target] });
            }
          }
        }
        if (x && y) return {x:x,y:y}
        break;
      case 'a':
        if (Comp.obj.isArray(data) && typeof data[0] != 'object') return {data:data};  
        if (Comp.obj.isObject(data) && options.features!=undefined) {
          return { data:data.map(function (row) { 
                    return scale(objSlice(row,options.features),scala) })};
        }
        break;
      case 'm':
       if (Comp.obj.isMatrix(data)) return {data:data};
        if (Comp.obj.isObject(row) && options.features!=undefined) {
          return { data:data.map(function (row) { 
                    return scale(obj2Array(row,options.features),scala) })};
        }
       break;  
      case 'xmy':
        if (Comp.obj.isObject(row) && options.features!=undefined && options.target!=undefined) {
          return { x:data.map(function (row) { 
                      return scale(obj2Array(row,options.features),scala) }),
                   y:data.map(function (row) { return row[options.target]})};
        }
       break;  
      case 'io':
        if (Comp.obj.isArray(row) && options.target!=undefined) {
          // number [][] 
          if (Number(options.target)==row.length-1) {
            _data=data.map(function (row) { return { input:scale(row.slice(0,options.target),scala),
                                                     output:array(row[options.target]) }});
            return _data
          } 
        } else if (Comp.obj.isObject(row) && options.target!=undefined && options.features!=undefined) {
          _data=data.map(function (row) { return { input:scale(obj2Array(row,options.features),scala),
                                                   output:array(row[options.target]) }});
          return _data
        }

        break;
    }
  } else if (data.x && data.y) {
    if (Comp.obj.isArray(data.x) && Comp.obj.isArray(data.y)) {
      row=data.x[0];
      switch (need) {
        case 'io':
        if (Comp.obj.isArray(row)) {
          // number [][] 
          _data=data.x.map(function (row, rowi) { return { input:scale(row,scala),
                                                           output:array(data.y[rowi]) }});
          return _data          
        } 
        if (Comp.obj.isObject(row) && options.features!=undefined) {
          _data=data.x.map(function (row, rowi) { return { input:scale(obj2Array(row,options.features),scala),
                                                           output:array(data.y[rowi]) }});
          return _data          
        }
        break;
        case 'xm':
          if (Comp.obj.isArray(row)) return data.x;
          break;
        case 'xmy':
          if (Comp.obj.isArray(row)) return { x:data.x, y:data.y};
          break;
        case 'xmya':
          if (Comp.obj.isArray(row)) return { x:data.x, y:data.y.map(array)};
          break;
        case 'd':
          return data.x.map(function (row,rowi) {
            var newrow={};
            if (options.features && options.target) {
              options.features.forEach(function (f,coli) {
                newrow[f]=row[coli];
              });
              newrow[options.target]=data.y[rowi];
            } else {
              row.forEach(function (col,f) {
                newrow[String(f)]=col;                
              });
              newrow[String(row.length)]=data.y[rowi];
            }
            return newrow;
          })
          break;
      } 
    }   
  }
}



// Agent AIOS API
var  ml = {
  // only RL
  action : function (model,arg) {
    switch (model.algorithm) {
      // Selects and returns next action from set of actions
      case ML.RL:
        switch (model.kind) {
          case ML.DQNAgent:
            // arg == state array
            return model.actions[RL.DQNAgent.code.act(model,arg)];   
            break;
          case ML.DPAgent:
            // arg == state (integer number)
            return model.actions[RL.DPAgent.code.act(model,arg)];   
            break;
          case ML.TDAgent:
            // arg == state (integer number)
            return model.actions[RL.TDAgent.code.act(model,arg)];   
            break;
        }
        break;   
    }
  },
  /** Classification (prediction): Apply sample data to learned model.
   *  Returns prediction result.
   *
   */ 
  classify: function (model,samples) {
    var x,solutions,result;
    switch (model.algorithm) {
    
      case ML.ANN:
        if (Comp.obj.isArray(samples)) 
          return samples.map(function (sample) { 
            return model.network.activate(sample) 
          });
        else
          return model.network.activate(samples);

      case ML.CNN:
        if (Comp.obj.isMatrix(samples))
          return samples.map(function (sample) {
            return CNN.predict(model,sample);
          });
        else
          return CNN.predict(model,samples);
        break;

      case ML.C45:
        // Sample row format: [x1,x2,..,xn]
        if (Comp.obj.isMatrix(samples)) {
          return samples.map(function (sample) {
            return C45.classify(model,sample);
          });
        } else if (Comp.obj.isArray(samples) && !Comp.obj.isObj(samples[0])) {
          return C45.classify(model,samples);
        } else if (Comp.obj.isArray(samples) &&  Comp.obj.isObj(samples[0])) {
          return samples.map(function (sample) {
            return C45.classify(model,sample); 
          });
        } else if (Comp.obj.isObj(samples)) {
          return C45.classify(model,samples);
        }
        break;

      case ML.DT:
      case ML.ICE:
        if (Comp.obj.isMatrix(samples) ||
            Comp.obj.isArray(samples) && Comp.obj.isObj(samples[0])) 
          return samples.map(function (sample) { 
            return ICE.predict(model,sample) 
          });
        else 
          return ICE.predict(model,samples);

      case ML.DTI:
        if (Comp.obj.isMatrix(samples)) 
          return samples.map(function (sample) { 
            return DTI.predict(model,sample) 
          });
        else
          return DTI.predict(model,samples);

      case ML.ID3:
        if (Comp.obj.isArray(samples)) 
          return samples.map(function (sample) { 
            return ID3.predict(model,sample) 
          });
        else
          return ID3.predict(model,samples);

      case ML.KNN:
        if (Comp.obj.isMatrix(samples))
          return KNN.predict(model,samples);        
        else if (Comp.obj.isArray(samples) && Comp.obj.isObj(samples[0]))
          return KNN.predict(model,samples.map(function (sample) { 
            return obj2Array(sample,model.features)}));
        else if (Comp.obj.isObj(samples))
          return KNN.predict(model,obj2Array(samples,model.features));
        else
          return KNN.predict(model,samples);
        break;

      case ML.KNN2:
        if (Comp.obj.isMatrix(samples))
          return samples.map(function (sample) {
            return KNN.predict2(model,sample);
          });
        else if (Comp.obj.isArray(samples) && Comp.obj.isObj(samples[0]))
          return samples.map(function (sample) {
             return KNN.predict2(model,obj2Array(sample,model.features))
            })
        else if (Comp.obj.isObj(samples))
          return KNN.predict2(model,obj2Array(samples,model.features));
        else
          return KNN.predict2(model,samples);
        break;

      case ML.KMN:
        return model.clusters
        break;

      case ML.RF:
        if (model.labels) {
          if (Comp.obj.isMatrix(samples)) {
            return samples.map(function (sample) {
              return model.rfs.map(function (rf) {
                return RF.code.predictOne(rf,sample);
              }).map(function (v,i) {
                return { value:model.labels[i], prob:v }
              })
            });
          } else if (Comp.obj.isArray(samples) && typeof samples[0] == 'number') {
            return model.rfs.map(function (rf) {
              return RF.code.predictOne(rf,samples);
            }).map(function (v,i) {
                return { value:model.labels[i], prob:v }
            })
          } // TODO
        } else {
          // Sample row format: [x1,x2,..,xn]
          if (Comp.obj.isMatrix(samples)) {
            return samples.map(function (sample) {
              return RF.code.predictOne(model,sample);
            });
          } else if (Comp.obj.isArray(samples) && typeof samples[0] == 'number') {
            return RF.predictOne(model,samples);
          } // TODO
        }
        // preprocess(samples,'m')
        break;
                
      case ML.SVM:
        if (!model._labels) {
          // Single SVM 
          if (Comp.obj.isMatrix(samples))
            return samples.map(function (sample) {
              return SVM.code.predict(model,sample);
            });
          else
            return SVM.code.predict(model,samples);
        } else {
          // Multi SVM
          if (Comp.obj.isMatrix(samples))
            return samples.map(function (sample) {
              solutions=model.svms.map(function (svm,index) { 
                if (svm.threshold==false)
                  return SVM.code.predict(svm,sample)
                else
                  return SVM.code.predict(svm,sample); 
              });
              return solutions.map(function (v,i) { return { value:model._labels[i], prob:v } });
            });
          else {
            solutions=model.svms.map(function (svm,index) { 
                if (svm.threshold==false)
                  return SVM.code.predict(svm,samples)
                else
                  return SVM.code.predict(svm,samples)==1; 
            })
            return solutions.map(function (v,i) { return { value:model._labels[i], prob:v } });
          }
        }
        break;
        
      case ML.SLP:
      case ML.MLP:
        if (Comp.obj.isMatrix(samples)) {
          x=samples;          
          if (model.xscale) 
            x=x.map(function (row) { return scale(row,model.xscale) });
          result = model.labels?MLP.code.predict(model,x).map(function (r) {
            var o={};
            r.forEach(function (v,i) { o[model.labels[i]]=v });
            return o;
          }):relax(MLP.code.predict(model,x));
        } else if (Comp.obj.isArray(samples) && typeof samples[0] == 'number') {
          x=samples;
          if (model.xscale) 
            x=scale(x,model.xscale);
          result = model.labels?MLP.code.predict(model,[x]).map(function (r) {
            var o={};
            r.forEach(function (v,i) { o[model.labels[i]]=v });
            return o;
          })[0]:relax(MLP.code.predict(model,[x])[0]);
        } else if (Comp.obj.isArray(samples) && typeof samples[0] == 'object') {
          x=samples.map(function (sample) { return model.features.map(function (f) { return sample[f] }) });
          if (model.xscale) 
            x=x.map(function (row) { return scale(row,model.xscale) });
          result = model.labels?MLP.code.predict(model,x).map(function (r) {
            var o={};
            r.forEach(function (v,i) { o[model.labels[i]]=v });
            return o;
          }):relax(MLP.code.predict(model,x));
        } else if (Comp.obj.isObj(samples) && model.features) {
          x=model.features.map(function (f) { return samples[f] });
          if (model.xscale) 
            x=scale(x,model.xscale);
          result = model.labels?MLP.code.predict(model,[x]).map(function (r) {
            var o={};
            r.forEach(function (v,i) { o[model.labels[i]]=v });
            return o;
          })[0]:relax(MLP.code.predict(model,[x])[0]); 
        }
        if (Comp.obj.isArray(result)) {
          return model.yscale?result.map(function (y) { return unscale(y,model.yscale) }):result;
        } else {
          return result;
        }
        break;
        
       case ML.TXT:
        // typeof options = {data: string []}
        if (Comp.obj.isArray(samples))
          return samples.map(function (sample) { return TXT.classify(model,sample) });
        else
          return TXT.classify(model,samples);
        break;

   }
  },
  
  compact: function (model) {
    switch (model.algorithm) {
      case ML.DTI:
      default:
        return DTI.compactTree(model);
    }
  },
  
  depth: function (model) {
    switch (model.algorithm) {
      case ML.DTI:
        return DTI.depth(model);
      case ML.DT:
      case ML.ICE:
        return ICE.depth(model);
      case ML.C45:
        return C45.depth(model);
      case ML.ID3:
        return ID3.depth(model);
    }
  },
  
  
  evaluate: function (model,target,samples) {
    switch (model.algorithm) {
      case ML.DTI:
      default:
        return DTI.evaluate(model,target,samples);
    }
  },

  info: function (model) {
    switch (model.algorithm) {
      case ML.C45:
        return C45.info(model);
      case ML.DT:
      case ML.ICE:
        return ICE.info(model);
      case ML.ID3:
        return ID3.info(model);
    }
  },
  /** Learning: Create a classification model from training data (or an empty model that can be updated)
   *
   */
  learn: function (options) {
    var model,data,data2,x,y,features,featureTypes,test,target,
        result,cols,n_ins,n_outs,x,y,xscale,xoffset,xshift,yscale,yoffset,yshift,key,err,
        t0=Io.time();
    if (options==_) options={};
    switch (options.algorithm) {
    
      case ML.ANN:
        // typeof options = { x,y,features?,target?,layers:number [], trainerror:number}
        data = preprocess(options,'io',options);
        model={};
        model.algorithm=options.algorithm
        if (!options.layers) options.layers=[]
        if (data)
          model.network = new ANN.Network(options.layers[0],options.layers[options.layers.length-1]);
        else throw 'ML.learn.ANN: Invalid options';
        model.network.evolve(data,options);
        model.time=Io.time()-t0;
        return model;
        break;      
        

      case ML.CNN:
        // typeof options = {x:[][],y:[],..}
        model = CNN.create(options);
        model.algorithm=options.algorithm;
        model.time=Io.time()-t0;
        return model;
        break;

      case ML.C45:
        // typeof options = {data: {}[], target:string, features: string []} |
        //                  {data: [][], target?:string, features?: string []} |
        //                  {x: number [][], y:[]} |
        //                  {data: {x,y}[] }
        var model = C45.create();
        if (options.x && options.y) {
          features=options.x[0].map(function (col,i) { return String(i) }); 
          featureTypes=options.x[0].map(function (col,i) { return 'number' });
          data=options.x.map(function (row,i) { row=row.slice(); row.push(options.y[i]); return row});
          target='y';
        } else if (options.data && Comp.obj.isMatrix(options.data)) {
          data=options.data;
          features=options.features||options.data[0].slice(0,-1).map(function (col,i) { return String(i) });
          featureTypes=options.data[0].slice(0,-1).map(function (col,i) { return typeof col == 'number'?'number':'category' });
          target=options.target||'y';
        } else if (options.data && Comp.obj.isObj(options.data[0]) && options.data[0].x && options.data[0].y!=undefined) {
          data=options.data.map(function (row) { return row.x.concat(row.y) });
          features=options.features||options.data[0].x.slice(0,-1).map(function (col,i) { return String(i) });
          featureTypes=options.data[0].x.slice(0,-1).map(function (col,i) { return typeof col == 'number'?'number':'category' });
          target=options.target||'y';
        } else if (options.data && Comp.obj.isArray(options.data) && Comp.obj.isObj(options.data[0]) && 
                   options.target && options.features) {
          rowNames=Comp.obj.isArray(options.target)?options.features.concat(options.target):
                                                    options.features.concat([options.target]);
          data=options.data.map(function (row) { return obj2Array(row,rowNames) })
          features=options.features;
          featureTypes=data[0].slice(0,-1).map(function (col,i) { return typeof col == 'number'?'number':'category' });
          target=options.target;
        } else throw 'ML.learn.C45: Invalid options';

        C45.train(model,{
          data: data,
          target: target,
          features: features,
          featureTypes: featureTypes
        });
        model.algorithm=options.algorithm
        model.time=Io.time()-t0;
        return model;
        break;


      case ML.DTI:
        // typeof options = {data: {}[], target:string, features: string [], eps;number, maxdepth} |
        //                   {x: number [][], y:[], eps;number, maxdepth}
        if (options.eps==_) options.eps=0;
        if (options.maxdepth==_) options.maxdepth=20;
        if (options.data && options.target && options.features)
          model = DTI.create(options);
        else if (options.x && options.y) {
          if (options.x.length != options.y.length) throw 'ML.learn.DTI: X and Y vector have different length';
          data=options.x.map(function (row,i) { row=row.slice(); row.push(options.y[i]); return row});
          features=Comp.array.init(data[0].length-1,function (i) { return String(i)});
          target=String(data[0].length-1);
          // console.log(data,features,target)
          model = DTI.create({
            data:data,
            features:features,
            target:target,
            eps:options.eps,
            maxdepth:options.maxdepth
          });
        } else throw 'ML.learn.DTI: Invalid options';
        model.algorithm=options.algorithm;
        model.time=Io.time()-t0;
        return model;


      case ML.ICE:
      case ML.DT:
        if (options.eps==_) options.eps=0;
        if (options.data && options.target && options.features)
          model = ICE.create(options);                  
        else if (options.x && options.y) {
          if (options.x.length != options.y.length) throw 'ML.learn.ICE: X and Y vector have different length';
          data=options.x.map(function (row,i) { row=row.slice(); row.push(options.y[i]); return row});
          features=Comp.array.init(data[0].length-1,function (i) { return String(i)});
          target=String(data[0].length-1);
          model = ICE.create({
            data:data,
            features:features,
            target:target,
            eps:options.eps,
          });
        } else throw 'ML.learn.ICE: Invalid options';
        model.algorithm=options.algorithm;
        model.eps=options.eps;
        model.time=Io.time()-t0;
        return model;
        break;      

      case ML.ID3:
        if (options.data && options.target && options.features)
          model = ID3.createTree(options.data,options.target,
                                 options.features);
        else throw 'ML.learn.ID3: Invalid options';
        model.algorithm=options.algorithm
        model.time=Io.time()-t0;
        return model;
        break;      
          
      case ML.KNN:
        // typeof @options = {data: {}[]|[][], distance?:function|string,k?:number}
        // typeof @options = {x:number [][], y:number [], 
        //                    distance?:function|string,k?:number}
        if (options.features && options.target) target=options.target,features = options.features;
        else {
          features = [];
          if (options.data) {
            for(key in options.data[0]) features.push(key);
            target = features.pop()
          } else if (options.x) {
            for(key in options.x[0]) features.push('x'+key);
            target='y';
          }
        }
        if (options.data && Comp.obj.isObj(options.data[0])) {
          x = options.data.map(function (row) { return obj2Array(row,features) });
          y = options.data.map(function (row) { return row[target] })
        } else if (options.data && Comp.obj.isMatrix(options.data)) {
          x = options.data,map(function (row) { return row.slice(0,row.length-1) });
          y = options.data,map(function (row) { return row[row.length-1] });
        } else if (options.x && options.y) {
          x = options.x;
          y = options.y;
        }
        model = KNN.create(
          x,
          y,
          {
            distance:options.distance,
            k:options.k
          });
        model.algorithm = options.algorithm
        model.features  = features
        model.target    = target
        model.time=Io.time()-t0;
        return model;
        break;

      case ML.KNN2:
        // typeof @options = {data: {}[]|[][], distance?:function|string,k?:number}
        // typeof @options = {x:number [][], y:number [], 
        //                    distance?:function|string,k?:number}
        if (options.features && options.target) target=options.target,features = options.features;
        else {
          features = [];
          if (options.data) {
            for(key in options.data[0]) features.push(key);
            target = features.pop()
          } else if (options.x) {
            for(key in options.x[0]) features.push('x'+key);
            target='y';
          }
        }
        if (options.data && Comp.obj.isObj(options.data[0])) {
          x = options.data.map(function (row) { return obj2Array(row,features) });
          y = options.data.map(function (row) { return row[target] })
        } else if (options.data && Comp.obj.isMatrix(options.data)) {
          x = options.data,map(function (row) { return row.slice(0,row.length-1) });
          y = options.data,map(function (row) { return row[row.length-1] });
        } else if (options.x && options.y) {
          x = options.x;
          y = options.y;
        }
        model = KNN.create2(
          {
            x : x,
            y : y,
            distance:options.distance,
            k:options.k
          });
        model.algorithm=options.algorithm
        model.features = features
        model.target = target
        model.time=Io.time()-t0;
        return model;
        break;
        
      case ML.KMN:
        if (options.data && Comp.obj.isMatrix(options.data)) {
          data=options.data;
        } 
        model = KMN.cluster({
          data:data,
          k:options.k,
          distance:options.distance,
          epochs:options.epochs,
        })
        model.algorithm=options.algorithm
        model.data = data
        model.time=Io.time()-t0;
        return model;
        break;
                
      case ML.RF:
        var model={};
        // Single Binary RF (y={-1,1}) or Multi-RF (y:string is in labels)
        // typeof options = {data: {}[], target:string, features: string []} |
        //                  {data: [][], target?:string, features?: string []} |
        //                  {x: number [][], y: {-1,1} []} |
        //                  {data: {x,y}[] }
        //                  {data: {x,y}[], labels: string [] }
        if (!options.x || !options.y) throw 'ML.learn.RF: Invalid options';
        // data=preprocess(data,'xmy',{features:features,target:target})
        data={x:options.x,y:options.y}; // TODO 
        if (options.labels) {
          // multi-RF
          model.labels = options.labels;
          model.rfs = model.labels.map (function (label) { return RF() });
          model.rfs.forEach (function (rf,i) {
            var y = data.y.map(function (label) { return label==model.labels[i]?1:-1} );
            RF.code.train(rf,options.x,y,{
              numTrees:options.numTrees,
              maxDepth:options.maxDepth,
              numTries:options.numTries,
              type:options.weakType,
            });
          });
        } else {
          model = RF();
          features=options.x[0].map(function (col,i) { return String(i) }); 
          target='y';
        
          RF.code.train(model,
            options.x,
            options.y,
            {
              numTrees:options.numTrees,
              maxDepth:options.maxDepth,
              numTries:options.numTries,
              type:options.weakType,
            });    
        }
        model.algorithm=options.algorithm
        model.time=Io.time()-t0;
        return model;
        break;

      case ML.RL:
        // Create learner instance
        model = {}
        options.environment=checkOptions(options.environment,{});
        options.environment.getMaxNumActions=
          checkOption(options.environment.getMaxNumActions,
                      function () { return options.actions.length })
        options.environment.getNumStates=
          checkOption(options.environment.getNumStates,
                      function () { return options.states.length })
        var allowedActions=checkOption(options.environment.allowedActions, function () { return options.actions });
        options.environment.allowedActions=
          // Ensure that allowedActions return number array!
          function (state) { 
            return allowedActions(state).map(function (a) {
              return options.actions.indexOf(a)
            })
          }  
        var nextState = options.environment.nextState;
        if (nextState) {
          options.environment.nextState = function (state,action) {
            return nextState(state,options.actions[action])
          }
        }
        switch (options.kind) {
          case ML.DQNAgent:                          
            model = RL.DQNAgent(
              options.environment,  
              {
                alpha:options.alpha,gamma:options.gamma,epsilon:options.epsilon,
                experience_add_every:options.experience_add_every,
                experience_size:options.experience_size,
                learning_steps_per_iteration:options.learning_steps_per_iteration,
                tderror_clamp:options.tderror_clamp,
                num_hidden_units:options.num_hidden_units,
                update:options.update,
               }
            )
            break;
          case ML.DPAgent:
            model = RL.DPAgent(
              options.environment,  
              {alpha:options.alpha,beta:options.beta,gamma:options.gamma,
               epsilon:options.epsilon,lambda:options.lambda}
            )
            break;
          case ML.TDAgent:
            model = RL.TDAgent(
              options.environment,  
              // specs
              {alpha:options.alpha,beta:options.beta,gamma:options.gamma,
               epsilon:options.epsilon,lambda:options.lambda,
               replacing_traces:options.replacing_traces,
               smooth_policy_update:options.smooth_policy_update,
               update:options.update,
               planN:options.planN}
            )
            break;
        }
        model.algorithm = options.algorithm;
        model.kind      = options.kind;
        if (options.actions)  model.actions   = options.actions;
        if (options.states)   model.states    = options.states;
        if (options.rewards)  model.rewards   = options.rewards;
        return model;
        break;



      case ML.SLP:
      case ML.MLP:
        // typeof options = {x: number [][], 
        //                   y: number number [][] | string [],
        //                   hidden_layers?:[],epochs?:number,
        //                   labels?:string [], features?: string [], 
        //                   regression?,
        //                   normalize?, bipolar?, eps?:number | number [], verbose?}
        //
        // y and MLP(learn) requires [[p1,p2,..],[p1,p2,..],..] with 0>=p>=1
        //                                                           p:label probability
        x=options.x;
        if (Comp.obj.isArray(options.x) && typeof options.x[0] == 'number') 
          x=wrap(options.x);
        else if (!Comp.obj.isMatrix(options.x) && Comp.obj.isArray(options.x) && typeof options.x[0] == 'object' && options.features) {
          x=options.x.map(function (o) {
            return options.features.map(function (f) { return o[f] }); 
          });
        } 
        if (Comp.obj.isMatrix(options.y)) 
          y=options.y;
        else if (Comp.obj.isArray(options.y) && typeof options.y[0] == 'number') 
          y=wrap(options.y);        
        else if (Comp.obj.isArray(options.y) && options.labels) {
          y=options.y.map(function (l1) {
            return options.labels.map(function (l2) {
              return l1==l2?1:0;
            });
          });
        } else throw 'ML.learn.MLP: invalid options';
        if (options.normalize) {
          // normalize each variable independently!?
          var max=x[0].map(function (col) { return col}),
              min=x[0].map(function (col) { return col});
          x.forEach(function (row) { row.forEach(function (col,i) { 
            max[i]=Math.max(max[i],col);
            min[i]=Math.min(min[i],col) }) });
          xshift=options.bipolar?-1:0;
          xscale=max.map(function (x,i) { return (xshift?2:1)/((x-min[i])==0?1:x-min[i])});
          xoffset=min;
          x=x.map(function (row) { return row.map(function (col,i) { return xshift+(col-xoffset[i])*xscale[i] }) });
          if (options.regression) {
            // scale y, too, [0,1]
            max=y[0].map(function (col) { return col});
            min=y[0].map(function (col) { return col});
            y.forEach(function (row) { row.forEach(function (col,i) { 
              max[i]=Math.max(max[i],col);
              min[i]=Math.min(min[i],col) }) });
          
            yshift=options.bipolar?-1:0;
            yscale=max.map(function (x,i) { return (yshift?2:1)/((x-min[i])==0?1:x-min[i])});
            yoffset=min;
            y=y.map(function (row) { return row.map(function (col,i) { return yshift+(col-yoffset[i])*yscale[i] }) });
          }
        }

        model = MLP({
          input   : x,
          output  : y,
          n_ins   : x[0].length,
          n_outs  : y[0].length,
          hidden_layer_sizes:options.algorithm==ML.SLP?[]:(options.hidden_layers||[])
        });
        model.algorithm=options.algorithm;
        model.labels=options.labels;
        model.features=options.features;
        model.xscale=options.normalize?{k:xscale,off:xoffset,shift:xshift}:undefined;
        model.yscale=options.normalize&&options.regression?{k:yscale,off:yoffset,shift:yshift}:undefined;
        model.nOutputs=y[0].length;
        
        MLP.code.set(model,'log level',options.verbose||0); // 0 : nothing, 1 : info, 2 : warning.
        if (options.epochs) MLP.code.train(model,{
          epochs : options.epochs
        });
        model.time=Io.time()-t0;
        return model;
        break;

      case ML.SVM:
        // typeof options = {x: number [][], 
        //                   y: ({-1,1}|string) [],
        //                   labels?:string|number [],
        //                   threshold?:number|false,
        //                   C?:numer,tol?:number,max_passes?:number,alpha_tol?:number,kernel?:{}}
        
        // If classes then multi-SVM (one for each class to be separated)!
        if (!options.labels) {
          model = SVM({
            x:options.x,
            y:options.y,
            threshold:options.threshold,
          });
          model.algorithm=options.algorithm
          SVM.code.train(model,{
            C:options.C||1.0,
            tol:options.tol||1e-4,
            max_passes:options.max_passes||20,
            alpha_tol:options.alpha_tol||1e-5,
            kernel:options.kernel
          });
        } else {
          model={};
          model.algorithm=options.algorithm;
          model._labels=options.labels;
          model.svms=options.labels.map(function (cl) {
            return SVM({
              x:options.x,
              y:options.y.map(function (y) { return y==cl?1:-1 }),
              threshold:options.threshold,
            });
          });
          
          model.svms.forEach(function (svm) {
            SVM.code.train(svm,{
              C:options.C||1.0,
              tol:options.tol||1e-4,
              max_passes:options.max_passes||20,
              alpha_tol:options.alpha_tol||1e-5,
              kernel:options.kernel
            });
          });
          // Create one SVM for each class
          // Transform y vector          
        }
        model.time=Io.time()-t0;
        return model;
        break;

      case ML.TXT:
        // typeof options = {data: string []}
        model = TXT.create(options.data,{
        });
        model.algorithm=options.algorithm
        return model;
        break;
    }
  },

  // add noise to numerical data to create synthetic data
  noise: function (data,noise) {
    if (Comp.obj.isMatrix(data)) {
      return data.map(function (row) {
        return row.map(function (v,i) {
          if (typeof noise == 'number')
            return v+(Math.random()-0.5)*noise;
          else return v+(Math.random()-0.5)*noise[i]
        })
      })
    } else if (Comp.obj.isArray(data) && Comp.obj.isObject(data[0])) {
      return data.map(function (row) {
        var o={};
        for (var p in row) {
          if (typeof noise == 'number')
            o[p] = row[p]+(Math.random()-0.5)*noise;
          else o[p] = row[p]+(Math.random()-0.5)*noise[p]
        }
        return o;
      })      
    }
  },

  preprocess:preprocess,

  print: function (model,indent,compact) {
    switch (model.algorithm) {
      case ML.DTI:
        return DTI.print(model,indent,compact);
      case ML.DT:
      case ML.ICE:
        return ICE.print(model,indent);
      case ML.C45:
        return C45.print(model,indent);
      case ML.ID3:
        return ID3.print(model,indent);
    }
  },
  
  // Only text module
  similarity : TXT.similarity,
  
  stats : STAT,
  
  // Check model consistency
  test: function (model,samples) {
    var x,y,data,res,p=0.0;
    switch (model.algorithm) {
    
      case ML.ANN:
        data=preprocess(samples,'xmya',{features:model.features,target:model.target});
        // TODO
        break;
        
      case ML.C45:
        // Sample row format: [x1,x2,..,y]
        if (Comp.obj.isMatrix(samples)) {
          samples.forEach(function (sample) {
            x=sample.slice(0,sample.length-1);
            y=sample[sample.length-1];
            res= C45.classify(model,x);
            if (res==y) p += 1;
          });
          return p/samples.length;
        } else if (Comp.obj.isArray(samples)) {
          x=samples.slice(0,samples.length-1);
          y=samples[samples.length-1];
          res = C45.classify(model,x);
          return res==y?1.0:0.0
        } else if (Comp.obj.isObj(samples) && model.features) {
        }
        break;

      case ML.TXT:
        var model = model.string?{ data : [model.string] }:model;
        if (Comp.obj.isArray(samples))
          return samples.map(function (sample) { 
            return TXT.classify(model,sample).match
          });
        else
          return TXT.classify(model,samples).match;
        break;

        
    }
  },
  

  /** Update a learned model
   *
   */
  update: function (model,options) {
    switch (model.algorithm||options.algorithm) {
    
      case ML.CNN:
        break;

      case ML.DTI:
        // typeof @options = {data: number [][], target:string, features: string [], eps?:number, maxdepth?:number} |
        //                   {x: number [][], y:[], eps?:number, maxdepth?:number}
        if (options.eps==_) options.eps=0;
        if (options.maxdepth==_) options.maxdepth=20;
        if (options.data && options.target && options.features)
          model = DTI.update(model,options);
        else if (options.x && options.y) {
          if (options.x.length != options.y.length) throw 'ML.update.DTI: X and Y vector have different length';
          data=options.x.slice();
          data=data.map(function (row,i) {row.push(options.y[i]); return row});
          features=Comp.array.init(data[0].length-1,function (i) { return String(i)});
          target=String(data[0].length-1);
          console.log(data,features,target)
          model = DTI.update(model,{
            data:data,
            features:features,
            target:target,
            eps:options.eps,
            maxdepth:options.maxdepth
          });
        } else throw 'ML.update.DTI: Invalid options';
          
        model.algorithm=options.algorithm;
        return model;
        break;
        
      case ML.MLP:
        return MLP.code.train(model,{
          epochs : options.epochs||1
        });
        break;

      case ML.RL:
        switch (model.kind) {
          case ML.DQNAgent:
            return RL.DQNAgent.code.learn(model,options);
            break;
          case ML.DPAgent:  
            return RL.DPAgent.code.learn(model,options);
            break;
          case ML.TDAgent:
            return RL.TDAgent.code.learn(model,options);
            break;
        }
        break;
        
    }
  },
  ML:ML,
};
  
ICE.ml=ml;
CNN.ml=ml;
ml.predict=ml.classify;
ml.learner=ml.learn;
ml.train=function (model,options) {
  if (model.algorithm) return ml.update(model,options);
  else return ml.learn(model);
}
ml.best=ml.stats.utils.best;

module.exports = {
  agent:ml,
  classify:ml.classify,
  column:ml.column,
  compact:ml.compact,
  depth:ml.depth,
  entropy:STAT.entropy,
  entropyN:STAT.entropyN,
  entropyDep:STAT.entropyDep,
  entropyT:STAT.entropyT,
  evaluate:ml.evaluate,
  info:ml.info,
  learn:ml.learn,
  noise:ml.noise,
  options:options,
  pca:PCA,
  preprocess:preprocess,
  print:ml.print,
  stats:STAT,
  test:ml.test,
  unique:ml.unique,
  update:ml.update,
  ML:ML,
  current:function (module) { current=module.current; Aios=module; }
}
