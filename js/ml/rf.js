// MIT License
// Random Forest Trees (only binary classifier)
// Andrej Karpathy
// @blab+ 
// https://github.com/karpathy/forestjs


var RandomForest = function(options) {
  var L = {};
  return L
}

RandomForest.code = {

  /*
  data is 2D array of size N x D of examples
  labels is a 1D array of labels (only -1 or 1 for now). In future will support multiclass or maybe even regression
  options.numTrees can be used to customize number of trees to train (default = 100)
  options.maxDepth is the maximum depth of each tree in the forest (default = 4)
  options.numTries is the number of random hypotheses generated at each node during training (default = 10)
  options.trainFun is a function with signature "function myWeakTrain(data, labels, ix, options)". Here, ix is a list of 
                   indeces into data of the instances that should be payed attention to. Everything not in the list 
                   should be ignored. This is done for efficiency. The function should return a model where you store 
                   variables. (i.e. model = {}; model.myvar = 5;) This will be passed to testFun.
  options.testFun is a function with signature "funtion myWeakTest(inst, model)" where inst is 1D array specifying an example,
                   and model will be the same model that you return in options.trainFun. For example, model.myvar will be 5.
                   see decisionStumpTrain() and decisionStumpTest() downstairs for example.
  */
  train: function(L, data, labels, options) {
    options = options || {};
    L.options = options;
    
    L.numTrees = options.numTrees || 100;

    // initialize many trees and train them all independently
    L.trees= new Array(L.numTrees);
    for(var i=0;i<L.numTrees;i++) {
      L.trees[i] = DecisionTree();
      DecisionTree.code.train(L.trees[i],data, labels, options);
    }
  },

  /*
  inst is a 1D array of length D of an example. 
  returns the probability of label 1, i.e. a number in range [0, 1]
  */
  predictOne: function(L, inst) {

    // have each tree predict and average out all votes
    var dec=0;
    for(var i=0;i<L.numTrees;i++) {
      dec += DecisionTree.code.predictOne(L.trees[i],inst);
    }
    dec /= L.numTrees;
    return dec;
  },

  // convenience function. Here, data is NxD array. 
  // returns probabilities of being 1 for all data in an array.
  predict: function(L, data) {

    var probabilities= new Array(data.length);
    for(var i=0;i<data.length;i++) {
      probabilities[i]= RandomForest.code.predictOne(L,data[i]);
    }
    return probabilities;

  }

}

// represents a single decision tree
var DecisionTree = function(options) {
  var L = {};
  return L
}

DecisionTree.code = {

  train: function(L, data, labels, options) {

    options = options || {};
    var maxDepth = options.maxDepth || 4;
    var weakType = options.type || 0;

    
    var trainFun= decisionStumpTrain;
    var testFun= decisionStumpTest;

    if(options.trainFun) trainFun = options.trainFun;
    if(options.testFun) testFun = options.testFun;

    if(weakType == 0) {
      // Default
      trainFun  = decisionStumpTrain;
      testFun   = decisionStumpTest;
    }
    if(weakType) {
      trainFun  = decision2DStumpTrain;
      L.testFun = testFun = decision2DStumpTest;
    }

    // initialize various helper variables
    var numInternals= Math.pow(2, maxDepth)-1;
    var numNodes= Math.pow(2, maxDepth + 1)-1;
    var ixs= new Array(numNodes);
    for(var i=1;i<ixs.length;i++) ixs[i]=[];
    ixs[0]= new Array(labels.length);
    for(var i=0;i<labels.length;i++) ixs[0][i]= i; // root node starts out with all nodes as relevant
    var models = new Array(numInternals);

    // train
    for(var n=0; n < numInternals; n++) {

      // few base cases
      var ixhere= ixs[n];
      if(ixhere.length == 0) { continue; }
      if(ixhere.length == 1) { ixs[n*2+1] = [ixhere[0]]; continue; } // arbitrary send it down left

      // learn a weak model on relevant data for this node
      var model= trainFun(data, labels, ixhere);
      models[n]= model; // back it up model

      // split the data according to the learned model
      var ixleft=[];
      var ixright=[];
      for(var i=0; i<ixhere.length;i++) {
          var label= testFun(data[ixhere[i]], model);
          if(label === 1) ixleft.push(ixhere[i]);
          else ixright.push(ixhere[i]);
      }
      ixs[n*2+1]= ixleft;
      ixs[n*2+2]= ixright;
    }

    // compute data distributions at the leafs
    var leafPositives = new Array(numNodes);
    var leafNegatives = new Array(numNodes);
    for(var n=numInternals; n < numNodes; n++) {
      var numones= 0;
      for(var i=0;i<ixs[n].length;i++) {
          if(labels[ixs[n][i]] === 1) numones+=1;
      }
      leafPositives[n]= numones;
      leafNegatives[n]= ixs[n].length-numones;
    }

    // back up important prediction variables for predicting later
    L.models= models;
    L.leafPositives = leafPositives;
    L.leafNegatives = leafNegatives;
    L.maxDepth= maxDepth;
    // L.trainFun= trainFun;
    // L.testFun= testFun;
  }, 

  // returns probability that example inst is 1.
  predictOne: function(L, inst) { 
      var testFun = L.testFun||decisionStumpTest;
      var n=0;
      for(var i=0;i<L.maxDepth;i++) {
          var dir= testFun(inst, L.models[n]);
          if(dir === 1) n= n*2+1; // descend left
          else n= n*2+2; // descend right
      }

      return (L.leafPositives[n] + 0.5) / (L.leafNegatives[n] + 1.0); // bayesian smoothing!
  }
}

// returns model
function decisionStumpTrain(data, labels, ix, options) {

  options = options || {};
  var numtries = options.numTries || 10;

  // choose a dimension at random and pick a best split
  var ri= randi(0, data[0].length);
  var N= ix.length;

  // evaluate class entropy of incoming data
  var H= entropy(labels, ix);
  var bestGain=0; 
  var bestThr= 0;
  for(var i=0;i<numtries;i++) {

      // pick a random splitting threshold
      var ix1= ix[randi(0, N)];
      var ix2= ix[randi(0, N)];
      while(ix2==ix1) ix2= ix[randi(0, N)]; // enforce distinctness of ix2

      var a= Math.random();
      var thr= data[ix1][ri]*a + data[ix2][ri]*(1-a);

      // measure information gain we'd get from split with thr
      var l1=1, r1=1, lm1=1, rm1=1; //counts for Left and label 1, right and label 1, left and minus 1, right and minus 1
      for(var j=0;j<ix.length;j++) {
          if(data[ix[j]][ri] < thr) {
            if(labels[ix[j]]==1) l1++;
            else lm1++;
          } else {
            if(labels[ix[j]]==1) r1++;
            else rm1++;
          }
      }
      var t= l1+lm1;  // normalize the counts to obtain probability estimates
      l1=l1/t;
      lm1=lm1/t;
      t= r1+rm1;
      r1=r1/t;
      rm1= rm1/t;

      var LH= -l1*Math.log(l1) -lm1*Math.log(lm1); // left and right entropy
      var RH= -r1*Math.log(r1) -rm1*Math.log(rm1);

      var informationGain= H - LH - RH;
      //console.log("Considering split %f, entropy %f -> %f, %f. Gain %f", thr, H, LH, RH, informationGain);
      if(informationGain > bestGain || i === 0) {
          bestGain= informationGain;
          bestThr= thr;
      }
  }

  model= {};
  model.thr= bestThr;
  model.ri= ri;
  return model;
}

// returns a decision for a single data instance
function decisionStumpTest(inst, model) {
  if(!model) {
      // this is a leaf that never received any data... 
      return 1;
  }
  return inst[model.ri] < model.thr ? 1 : -1;

}

// returns model. Code duplication with decisionStumpTrain :(
function decision2DStumpTrain(data, labels, ix, options) {

  options = options || {};
  var numtries = options.numTries || 10;

  // choose a dimension at random and pick a best split
  var N= ix.length;

  var ri1= 0;
  var ri2= 1;
  if(data[0].length > 2) {
    // more than 2D data. Pick 2 random dimensions
    ri1= randi(0, data[0].length);
    ri2= randi(0, data[0].length);
    while(ri2 == ri1) ri2= randi(0, data[0].length); // must be distinct!
  }

  // evaluate class entropy of incoming data
  var H= entropy(labels, ix);
  var bestGain=0; 
  var bestw1, bestw2, bestthr;
  var dots= new Array(ix.length);
  for(var i=0;i<numtries;i++) {

      // pick random line parameters
      var alpha= randf(0, 2*Math.PI);
      var w1= Math.cos(alpha);
      var w2= Math.sin(alpha);

      // project data on this line and get the dot products
      for(var j=0;j<ix.length;j++) {
        dots[j]= w1*data[ix[j]][ri1] + w2*data[ix[j]][ri2];
      }

      // we are in a tricky situation because data dot product distribution
      // can be skewed. So we don't want to select just randomly between
      // min and max. But we also don't want to sort as that is too expensive
      // let's pick two random points and make the threshold be somewhere between them.
      // for skewed datasets, the selected points will with relatively high likelihood
      // be in the high-desnity regions, so the thresholds will make sense
      var ix1= ix[randi(0, N)];
      var ix2= ix[randi(0, N)];
      while(ix2==ix1) ix2= ix[randi(0, N)]; // enforce distinctness of ix2
      var a= Math.random();
      var dotthr= dots[ix1]*a + dots[ix2]*(1-a);

      // measure information gain we'd get from split with thr
      var l1=1, r1=1, lm1=1, rm1=1; //counts for Left and label 1, right and label 1, left and minus 1, right and minus 1
      for(var j=0;j<ix.length;j++) {
          if(dots[j] < dotthr) {
            if(labels[ix[j]]==1) l1++;
            else lm1++;
          } else {
            if(labels[ix[j]]==1) r1++;
            else rm1++;
          }
      }
      var t= l1+lm1; 
      l1=l1/t;
      lm1=lm1/t;
      t= r1+rm1;
      r1=r1/t;
      rm1= rm1/t;

      var LH= -l1*Math.log(l1) -lm1*Math.log(lm1); // left and right entropy
      var RH= -r1*Math.log(r1) -rm1*Math.log(rm1);

      var informationGain= H - LH - RH;
      //console.log("Considering split %f, entropy %f -> %f, %f. Gain %f", thr, H, LH, RH, informationGain);
      if(informationGain > bestGain || i === 0) {
          bestGain= informationGain;
          bestw1= w1;
          bestw2= w2;
          bestthr= dotthr;
      }
  }

  model= {};
  model.w1= bestw1;
  model.w2= bestw2;
  model.dotthr= bestthr;
  return model;
}

// returns label for a single data instance
function decision2DStumpTest(inst, model) {
  if(!model) {
      // this is a leaf that never received any data... 
      return 1;
  }
  return inst[0]*model.w1 + inst[1]*model.w2 < model.dotthr ? 1 : -1;

}

// Misc utility functions
function entropy(labels, ix) {
  var N= ix.length;
  var p=0.0;
  for(var i=0;i<N;i++) {
      if(labels[ix[i]]==1) p+=1;
  }
  p=(1+p)/(N+2); // let's be bayesian about this
  q=(1+N-p)/(N+2);
  return (-p*Math.log(p) -q*Math.log(q));
}

// generate random floating point number between a and b
function randf(a, b) {
  return Math.random()*(b-a)+a;
}

// generate random integer between a and b (b excluded)
function randi(a, b) {
   return Math.floor(Math.random()*(b-a)+a);
}

module.exports = RandomForest
