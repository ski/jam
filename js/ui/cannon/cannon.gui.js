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
 **    $AUTHORS:     (Stefan Bosse)
 **    $INITIAL:     (C) schteppe, http://www.cannonjs.org/
 **    $VERSION:     1.2.4
 **
 **    $INFO:
 **
 **  CANNON.js GUI
 **
 **    $ENDOFINFO
 */

/* global CANNON,THREE,Detector */

CANNON = CANNON || {};

/**
 * GUI framework class. If you want to learn how to connect Cannon.js with Three.js, please look at the examples/ instead.
 * @class Gui
 * @constructor
 * @param {Object} options
 */
CANNON.Gui = function(options){

    var that = this;

    // API
    this.addScene = addScene;
    this.restartCurrentScene = restartCurrentScene;
    this.changeScene = changeScene;
    this.scenePicker = {};
    this.disable = disable;
    this.enable = enable;
    this.start = start;
    this.step = step;
    this.stepPhyOnly = stepPhyOnly;
    this.stop = stop;
    this.init = init;
    this.animate = animate;
    this.animate1 = animate1;
    this.checkRender = checkRender;
    this.setMaterial = setMaterial;
    this.exportImage = exportImage;
    this.display = options.display; // Upper level GUI display options (lazy) 
    
    var sceneFolder;
    this.log = options.log || console.log;
    
    // Global settings
    var settings = this.settings = {
        stepFrequency: 60,
        quatNormalizeSkip: 2,
        quatNormalizeFast: true,
        gx: 0,
        gy: 0,
        gz: 0,
        iterations: 3,
        tolerance: 0.0001,
        k: 1e6,
        d: 3,
        scene: 0,
        paused: true,
        render: false,
        renderInterval: 20,
        steps: 0,
        rendermode: "wireframe",
        constraints: false,
        springs: false,
        contacts: false,  // Contact points
        cm2contact: false, // center of mass to contact points
        normals: false, // contact normals
        axes: false, // "local" frame axes
        particleSize: 0.1,
        forces: 0,
        strain: false,
        aabbs: false,
        profiling: false,
        maxSubSteps:3,
        gridSphere: 10,
        gridPlane:10,
        gridBox:1,
        zoom:1,
    };

    // Extend settings with options
    options = options || {};
    for(var key in options){
        if(key in settings){
            settings[key] = options[key];
        }
    }

    if(settings.stepFrequency % 60 !== 0){
        throw new Error("stepFrequency must be a multiple of 60.");
    }

    var bodies = this.bodies = [];
    var visuals = this.visuals = [];
    var scenes = [];
    var gui = null;
    var smoothie = null;
    var smoothieCanvas = null;

    var three_contactpoint_geo = new THREE.SphereGeometry( 0.1, 6, 6);
    var particleGeo = this.particleGeo = new THREE.SphereGeometry( 1, 16, 8 );

    // Cache of all materials associated with the material color
    this.materials={};
    // Material
    var materialColor = 0xffffff;
    /* Not supported
    var solidMaterial = new THREE.MeshBasicMaterial( { color: materialColor } );
    // THREE.ColorUtils.adjustHSV( solidMaterial.color, 0, 0, 0.9 );
    */
    var wireframeMaterial = new THREE.MeshBasicMaterial( { color: 0xffffff, wireframe:true } );
    // Only supported render mode
    this.currentMaterial = wireframeMaterial;
    this.materials[0xffffff]=wireframeMaterial;
    var contactDotMaterial = new THREE.MeshBasicMaterial( { color: 0xff00ff, wireframe:true } );
    var particleMaterial = this.particleMaterial = new THREE.MeshBasicMaterial( { color: 0xff0000, wireframe:true } );

    // Geometry caches
    var contactMeshCache = new GeometryCache(function(){
        return new THREE.Mesh( three_contactpoint_geo, contactDotMaterial );
    });
    var cm2contactMeshCache = new GeometryCache(function(){
        var geometry = new THREE.Geometry();
        geometry.vertices.push(new THREE.Vector3(0,0,0));
        geometry.vertices.push(new THREE.Vector3(1,1,1));
        return new THREE.Line( geometry, new THREE.LineBasicMaterial( { color: 0xff0000 } ) );
    });
    var bboxGeometry = new THREE.BoxGeometry(1,1,1);
    var bboxMaterial = new THREE.MeshBasicMaterial({
        color: materialColor,
        wireframe:true
    });
    var bboxMeshCache = new GeometryCache(function(){
        return new THREE.Mesh(bboxGeometry,bboxMaterial);
    });
    var distanceConstraintMeshCache = new GeometryCache(function(){
        var geometry = new THREE.Geometry();
        geometry.vertices.push(new THREE.Vector3(0,0,0));
        geometry.vertices.push(new THREE.Vector3(1,1,1));
        return new THREE.Line( geometry, new THREE.LineBasicMaterial( { color: 0xff0000 } ) );
    });
    var p2pConstraintMeshCache = new GeometryCache(function(){
        var geometry = new THREE.Geometry();
        geometry.vertices.push(new THREE.Vector3(0,0,0));
        geometry.vertices.push(new THREE.Vector3(1,1,1));
        return new THREE.Line( geometry, new THREE.LineDashedMaterial( { color: 0xffb0b0, linewidth:2, scale:1, dashSize:10, gapSize:10 } ) );
    });
    var normalMeshCache = new GeometryCache(function(){
        var geometry = new THREE.Geometry();
        geometry.vertices.push(new THREE.Vector3(0,0,0));
        geometry.vertices.push(new THREE.Vector3(1,1,1));
        return new THREE.Line( geometry, new THREE.LineBasicMaterial({color:0x00ff00}));
    });
    var forceMeshCache = new GeometryCache(function(){
        var geometry = new THREE.Geometry();
        geometry.vertices.push(new THREE.Vector3(0,0,0));
        geometry.vertices.push(new THREE.Vector3(1,1,1));
        return new THREE.Line( geometry, new THREE.LineBasicMaterial({color:0xff0000, linewidth:2}));
    });
    var forceNegMeshCache = new GeometryCache(function(){
        var geometry = new THREE.Geometry();
        geometry.vertices.push(new THREE.Vector3(0,0,0));
        geometry.vertices.push(new THREE.Vector3(1,1,1));
        return new THREE.Line( geometry, new THREE.LineBasicMaterial({color:0x0000ff, linewidth:2}));
    });
    var springMeshCache = new GeometryCache(function(){
        var geometry = new THREE.Geometry();
        geometry.vertices.push(new THREE.Vector3(0,0,0));
        geometry.vertices.push(new THREE.Vector3(1,1,1));
        return new THREE.Line( geometry, new THREE.LineBasicMaterial({color:0x00ff00, linewidth:2}));
    });
    var axesMeshCache = new GeometryCache(function(){
        var mesh = new THREE.Object3D();
        //mesh.useQuaternion = true;
        var origin = new THREE.Vector3(0,0,0);
        var gX = new THREE.Geometry();
        var gY = new THREE.Geometry();
        var gZ = new THREE.Geometry();
        gX.vertices.push(origin);
        gY.vertices.push(origin);
        gZ.vertices.push(origin);
        gX.vertices.push(new THREE.Vector3(1,0,0));
        gY.vertices.push(new THREE.Vector3(0,1,0));
        gZ.vertices.push(new THREE.Vector3(0,0,1));
        var lineX = new THREE.Line( gX, new THREE.LineBasicMaterial({color:0xff0000}));
        var lineY = new THREE.Line( gY, new THREE.LineBasicMaterial({color:0x00ff00}));
        var lineZ = new THREE.Line( gZ, new THREE.LineBasicMaterial({color:0x0000ff}));
        mesh.add(lineX);
        mesh.add(lineY);
        mesh.add(lineZ);
        return mesh;
    });
    function restartGeometryCaches(){
        contactMeshCache.restart();
        contactMeshCache.hideCached();

        cm2contactMeshCache.restart();
        cm2contactMeshCache.hideCached();

        distanceConstraintMeshCache.restart();
        distanceConstraintMeshCache.hideCached();

        normalMeshCache.restart();
        normalMeshCache.hideCached();
    }

    // Create physics world
    var world = this.world = new CANNON.World();
    world.broadphase = new CANNON.NaiveBroadphase();
    world.log=options.log||console.log;

    var renderModes = ["wireframe"];

    function updategui(){
        if(gui){
            // First level
            for (var i in gui.__controllers){
                gui.__controllers[i].updateDisplay();
            }

            // Second level
            for (var f in gui.__folders){
                for (var i in gui.__folders[f].__controllers){
                    gui.__folders[f].__controllers[i].updateDisplay();
                }
            }
        }
    }

    var light, scene, ambient, stats, info;

    function setMaterial(node){
        if(node.material){
            if (node.color) {
              if (!that.materials[node.color]) {
                that.materials[node.color]=new THREE.MeshBasicMaterial( { color: node.color, wireframe:true } );
              }
              node.material = that.materials[node.color];
            } else
              node.material = that.currentMaterial;
        }
        for(var i=0; i<node.children.length; i++){
            setMaterial(node.children[i]);
        }
    }

    function setRenderMode(mode){
        if(renderModes.indexOf(mode) === -1){
            throw new Error("Render mode "+mode+" not found!");
        }

        switch(mode){
          case "wireframe":
            // Default model
            that.currentMaterial = wireframeMaterial;
            light.intensity = 0;
            ambient.color.setHex(0xffffff);
            break;
/* Not supported            
          case "solid":
            that.currentMaterial = solidMaterial;
            light.intensity = 1;
            ambient.color.setHex(0x222222);
            break;
*/            
        }

/*
        for(var i=0; i<visuals.length; i++){
            setMaterial(visuals[i]);
        }
*/        
        settings.rendermode = mode;
    }

    /**
     * Add a scene to the demo app
     * @method addScene
     * @param {String} title Title of the scene
     * @param {Function} initfunc A function that takes one argument, app, and initializes a physics scene. The function runs app.setWorld(body), app.addVisual(body), app.removeVisual(body) etc.
     */
    function addScene(title,initfunc){
        if(typeof(title) !== "string"){
            throw new Error("1st argument of Gui.addScene(title,initfunc) must be a string!");
        }
        if(typeof(initfunc)!=="function"){
            throw new Error("2nd argument of Gui.addScene(title,initfunc) must be a function!");
        }
        that.log('[PHY] Adding scene '+title);
        
        scenes.push(initfunc);
        var idx = scenes.length-1;
        that.scenePicker[title] = function(options){
            changeScene(idx,options);
        };
        sceneFolder.add(that.scenePicker,title);
    }

    /**
     * Restarts the current scene
     * @method restartCurrentScene
     */
    function restartCurrentScene(){
        var N = bodies.length;
        for(var i=0; i<N; i++){
            var b = bodies[i];
            b.position.copy(b.initPosition);
            b.velocity.copy(b.initVelocity);
            if(b.initAngularVelocity){
                b.angularVelocity.copy(b.initAngularVelocity);
                b.quaternion.copy(b.initQuaternion);
            }
        }
    }

    function makeSureNotZero(vec){
        if(vec.x===0.0){
            vec.x = 1e-6;
        }
        if(vec.y===0.0){
            vec.y = 1e-6;
        }
        if(vec.z===0.0){
            vec.z = 1e-6;
        }
    }


    function updateVisuals(){
        var N = bodies.length,
            i,j,n,b,bi,d,v,vecA,vecB,c,ci,ij,r,line,mesh;

        // Read position data into visuals
        for(i=0; i<N; i++){
            b = bodies[i], visual = visuals[i];
            visual.position.copy(b.position);
            if(b.quaternion){
                visual.quaternion.copy(b.quaternion);
            }
        }

        // Render contacts
        contactMeshCache.restart();
        if(settings.contacts){
            // if ci is even - use body i, else j
            for(ci=0; ci < world.contacts.length; ci++){
                for(ij=0; ij < 2; ij++){
                    mesh = contactMeshCache.request(),
                    c = world.contacts[ci],
                    b = ij===0 ? c.bi : c.bj,
                    r = ij===0 ? c.ri : c.rj;
                    mesh.position.set( b.position.x + r.x , b.position.y + r.y , b.position.z + r.z );
                }
            }
        }
        contactMeshCache.hideCached();

        // Lines from center of mass to contact point
        cm2contactMeshCache.restart();
        if(settings.cm2contact){
            for(ci=0; ci<world.contacts.length; ci++){
                for(ij=0; ij < 2; ij++){
                    line = cm2contactMeshCache.request(),
                        c = world.contacts[ci],
                        b = ij===0 ? c.bi : c.bj,
                        r = ij===0 ? c.ri : c.rj;
                    line.scale.set( r.x, r.y, r.z);
                    makeSureNotZero(line.scale);
                    line.position.copy(b.position);
                }
            }
        }
        cm2contactMeshCache.hideCached();

        distanceConstraintMeshCache.restart();
        p2pConstraintMeshCache.restart();
        forceMeshCache.restart();
        forceNegMeshCache.restart();
        springMeshCache.restart();
        // Show spring connections only if forces is not selected
        if(settings.springs && !settings.forces){
            for(ci=0; ci<world.springs.length; ci++){
                c = world.springs[ci];
                line = springMeshCache.request();
                line.geometry.vertices=[c.bodyA.position,c.bodyB.position];
             }
        }
        // Show body forces if springs is not selected
        if(settings.forces && !settings.springs){
          for(i=0; i<N; i++){
            b = bodies[i],
            v = new CANNON.Vec3();
            if (!b.force) continue;
            b.position.vadd(b.force.scale(1/settings.forces),v);
            var line = forceMeshCache.request();
            line.geometry.vertices=[b.position,v];            
          }
        }

        // Show spring forces or strain if springs (+strain) is selected
        if(settings.forces && settings.springs){
          for(i=0; i<N; i++){
            b = bodies[i];
            if (!b.springs) continue;
            for (ci in b.springs) {
              c = b.springs[ci];
              v = new CANNON.Vec3();
              d = 0;
              if (!c.force) continue; 
              c.bodyB.position.vsub(c.bodyA.position,v);
              if (!settings.strain) {
                d = c.force*(1/settings.forces);
                v.scale(Math.abs(d),v);
              } else {
                d=c.length-c.restLength;
                v.scale(1/c.restLength,v);
                v.scale(Math.abs(d),v);
                v.scale(settings.forces,v);
              }              
              c.bodyA.position.vadd(v,v);
              if (d<0)
                line = forceNegMeshCache.request();
              else
                line = forceMeshCache.request();
              line.geometry.vertices=[c.bodyA.position,v];
            }       
          }
        }
        
        if(settings.constraints){
            // Lines for distance constraints
            for(ci=0; ci<world.constraints.length; ci++){
                c = world.constraints[ci];
                if(!(c instanceof CANNON.DistanceConstraint)) {
                    continue;
                }
                line = p2pConstraintMeshCache.request();
                line.geometry.vertices=[c.bodyA.position,c.bodyB.position];
             }
            for(ci=0; ci<world.constraints.length; ci++){
                c = world.constraints[ci];
                    
                    
                if(!(c instanceof CANNON.PointToPointConstraint)) {
                    continue;
                }
                vecA=new CANNON.Vec3(c.bodyA.position.x,c.bodyA.position.y,c.bodyA.position.z)
                               .vadd(c.pivotA);
                vecB=new CANNON.Vec3(c.bodyB.position.x,c.bodyB.position.y,c.bodyB.position.z)
                               .vadd(c.pivotB);
                line = p2pConstraintMeshCache.request();
                line.geometry.vertices=[vecA,vecB];
             }

/*
            for(var ci=0; ci<world.constraints.length; ci++){
                var c = world.constraints[ci];
                if(!(c instanceof CANNON.DistanceConstraint)){
                    continue;
                }
                var nc = c.equations.normal;
                if (!nc) continue;

                var bi=nc.bi, bj=nc.bj, line = distanceConstraintMeshCache.request();
                var i=bi.id, j=bj.id;

                // Remember, bj is either a Vec3 or a Body.
                var v;
                if(bj.position){
                    v = bj.position;
                } else {
                    v = bj;
                }
                line.scale.set( v.x-bi.position.x,
                                v.y-bi.position.y,
                                v.z-bi.position.z );
                makeSureNotZero(line.scale);
                line.position.copy(bi.position);
                //
                var line = p2pConstraintMeshCache.request();
                line.geometry.vertices=[c.bodyA.position,c.bodyB.position];
            }


            // Lines for p2p constraints
            for(var ci=0; ci<world.constraints.length; ci++){
                var c = world.constraints[ci];
                if(!(c instanceof CANNON.PointToPointConstraint)){
                    continue;
                }
                var n = c.equations.normal;
                if (!nc) continue;
                var bi=n.bi, bj=n.bj, relLine1 = p2pConstraintMeshCache.request(), relLine2 = p2pConstraintMeshCache.request(), 
                    diffLine = p2pConstraintMeshCache.request();
                var i=bi.id, j=bj.id;

                relLine1.scale.set( n.ri.x, n.ri.y, n.ri.z );
                relLine2.scale.set( n.rj.x, n.rj.y, n.rj.z );
                diffLine.scale.set( -n.penetrationVec.x, -n.penetrationVec.y, -n.penetrationVec.z );
                makeSureNotZero(relLine1.scale);
                makeSureNotZero(relLine2.scale);
                makeSureNotZero(diffLine.scale);
                relLine1.position.copy(bi.position);
                relLine2.position.copy(bj.position);
                n.bj.position.vadd(n.rj,diffLine.position);
                //
                var line = p2pConstraintMeshCache.request();
                line.geometry.vertices=[c.bodyA.position,c.bodyB.position];
                                
            }
*/
        }
        forceMeshCache.hideCached();
        forceNegMeshCache.hideCached();
        springMeshCache.hideCached();
        p2pConstraintMeshCache.hideCached();
        distanceConstraintMeshCache.hideCached();

        // Normal lines
        normalMeshCache.restart();
        if(settings.normals){
            for(ci=0; ci<world.contacts.length; ci++){
                c = world.contacts[ci];
                bi=c.bi, bj=c.bj, line=normalMeshCache.request();
                i=bi.id, j=bj.id;
                n = c.ni;
                b = bi;
                line.scale.set(n.x,n.y,n.z);
                makeSureNotZero(line.scale);
                line.position.copy(b.position);
                c.ri.vadd(line.position,line.position);
            }
        }
        normalMeshCache.hideCached();

        // Frame axes for each body
        axesMeshCache.restart();
        if(settings.axes){
            for(bi=0; bi<bodies.length; bi++){
                b = bodies[bi], mesh=axesMeshCache.request();
                mesh.position.copy(b.position);
                if(b.quaternion){
                    mesh.quaternion.copy(b.quaternion);
                }
            }
        }
        axesMeshCache.hideCached();

        // AABBs
        bboxMeshCache.restart();
        if(settings.aabbs){
            for(i=0; i<bodies.length; i++){
                b = bodies[i];
                if(b.computeAABB){

                    if(b.aabbNeedsUpdate){
                        b.computeAABB();
                    }

                    // Todo: cap the infinite AABB to scene AABB, for now just dont render
                    if( isFinite(b.aabb.lowerBound.x) &&
                        isFinite(b.aabb.lowerBound.y) &&
                        isFinite(b.aabb.lowerBound.z) &&
                        isFinite(b.aabb.upperBound.x) &&
                        isFinite(b.aabb.upperBound.y) &&
                        isFinite(b.aabb.upperBound.z) &&
                        b.aabb.lowerBound.x - b.aabb.upperBound.x != 0 &&
                        b.aabb.lowerBound.y - b.aabb.upperBound.y != 0 &&
                        b.aabb.lowerBound.z - b.aabb.upperBound.z != 0){
                            var mesh = bboxMeshCache.request();
                            mesh.scale.set( b.aabb.lowerBound.x - b.aabb.upperBound.x,
                                            b.aabb.lowerBound.y - b.aabb.upperBound.y,
                                            b.aabb.lowerBound.z - b.aabb.upperBound.z);
                            mesh.position.set(  (b.aabb.lowerBound.x + b.aabb.upperBound.x)*0.5,
                                                (b.aabb.lowerBound.y + b.aabb.upperBound.y)*0.5,
                                                (b.aabb.lowerBound.z + b.aabb.upperBound.z)*0.5);
                        }
                }
            }
        }
        bboxMeshCache.hideCached();
    }
/*
    if (!Detector.webgl){
        Detector.addGetWebGLMessage();
    }
*/
    var SHADOW_MAP_WIDTH = 512;
    var SHADOW_MAP_HEIGHT = 512;
    var MARGIN = 0;
    var SCREEN_WIDTH = options.width || window.innerWidth;
    var SCREEN_HEIGHT = options.height || window.innerHeight - 2 * MARGIN;
    var camera, controls, renderer;
    var container;
    var NEAR = 5, FAR = 2000;
    var sceneHUD, cameraOrtho, hudMaterial;

    var mouseX = 0, mouseY = 0;

    var windowHalfX = window.innerWidth / 2;
    var windowHalfY = window.innerHeight / 2;


    // init();
    // animate();

    function init() {

        if (document.getElementById('CANNON')) {
          container = document.getElementById('CANNON');
        } else {
          container = document.createElement( 'div' );
          document.body.appendChild( container );
        } 
        // Camera
        camera = new THREE.PerspectiveCamera( 24, SCREEN_WIDTH / SCREEN_HEIGHT, NEAR, FAR );
        world.camera=camera;
        camera.up.set(0,0,1);
        camera.position.set(0,50,30);
        settings.zoom = camera.fov;
        
        // SCENE
        scene = that.scene = new THREE.Scene();
        scene.fog = new THREE.Fog( 0x222222, 1000, FAR );

        // LIGHTS
        ambient = new THREE.AmbientLight( 0x222222 );
        // scene.add( ambient );

        light = new THREE.SpotLight( 0xffffff );
        light.position.set( 30, 30, 40 );
        light.target.position.set( 0, 0, 0 );

        light.castShadow = true;

        light.shadowCameraNear = 10;
        light.shadowCameraFar = 100;//camera.far;
        light.shadowCameraFov = 30;

        light.shadowMapBias = 0.0039;
        light.shadowMapDarkness = 0.5;
        light.shadowMapWidth = SHADOW_MAP_WIDTH;
        light.shadowMapHeight = SHADOW_MAP_HEIGHT;

        //light.shadowCameraVisible = true;

        // scene.add( light );
        scene.add( camera );

        // RENDERER
        renderer = new THREE.CanvasRenderer( { clearColor: 0x000000, clearAlpha: 1, antialias: false } );
        if (!renderer || !renderer.setSize) return; // No Renderer support!
        
        renderer.setSize( SCREEN_WIDTH, SCREEN_HEIGHT );
        renderer.domElement.style.position = "relative";
        renderer.domElement.style.top = MARGIN + 'px';
        container.appendChild( renderer.domElement );

        // Add info
/*
        info = document.createElement( 'div' );
        info.style.position = 'absolute';
        info.style.top = '10px';
        info.style.width = '100%';
        info.style.textAlign = 'center';
        info.innerHTML = '<a href="http://github.com/schteppe/cannon.js">cannon.js</a> - javascript 3d physics';
        container.appendChild( info );
*/
        container.addEventListener('mousemove',onDocumentMouseMove);
        // window.addEventListener('resize',onWindowResize);

        renderer.setClearColor( scene.fog.color, 1 );

        renderer.autoClear = false;

        renderer.shadowMapEnabled = true;
        renderer.shadowMapSoft = true;

        // Smoothie
        smoothieCanvas = document.createElement("canvas");
        smoothieCanvas.width = SCREEN_WIDTH;
        smoothieCanvas.height = SCREEN_HEIGHT;
        smoothieCanvas.style.opacity = 0.5;
        smoothieCanvas.style.position = 'absolute';
        smoothieCanvas.style.top = '0px';
        smoothieCanvas.style.zIndex = 90;
        container.appendChild( smoothieCanvas );
        smoothie = new SmoothieChart({
            labelOffsetY:50,
            maxDataSetLength:100,
            millisPerPixel:2,
            grid: {
                strokeStyle:'none',
                fillStyle:'none',
                lineWidth: 1,
                millisPerLine: 250,
                verticalSections: 6
            },
            labels: {
                fillStyle:'rgb(180, 180, 180)'
            }
        });
        smoothie.streamTo(smoothieCanvas);
        // Create time series for each profile label
        var lines = {};
        var colors = [[255, 0, 0],[0, 255, 0],[0, 0, 255],[255,255,0],[255,0,255],[0,255,255]];
        var i=0;
        for(var label in world.profile){
            var c = colors[i%colors.length];
            lines[label] = new TimeSeries({
                label : label,
                fillStyle : "rgb("+c[0]+","+c[1]+","+c[2]+")",
                maxDataLength : 500,
            });
            i++;
        }

        // Add a random value to each line every second
        world.addEventListener("postStep",function(evt) {
            for(var label in world.profile)
                lines[label].append(world.time * 1000, world.profile[label]);
        });

        // Add to SmoothieChart
        var i=0;
        for(var label in world.profile){
            var c = colors[i%colors.length];
            smoothie.addTimeSeries(lines[label],{
                strokeStyle : "rgb("+c[0]+","+c[1]+","+c[2]+")",
                //fillStyle:"rgba("+c[0]+","+c[1]+","+c[2]+",0.3)",
                lineWidth:2
            });
            i++;
        }
        world.doProfiling = false;
        smoothie.stop();
        smoothieCanvas.style.display = "none";

        // STATS
        /*
        stats = new Stats();
        stats.domElement.style.position = 'absolute';
        stats.domElement.style.top = '0px';
        stats.domElement.style.zIndex = 100;
        container.appendChild( stats.domElement );
        */
        if(window.dat!=undefined){
            gui = new dat.GUI();

            gui.domElement.parentNode.style.zIndex=120;

            // Render mode
            var rf = gui.addFolder('Rendering');
            rf.add(settings,'rendermode',{/*Solid:"solid",*/Wireframe:"wireframe"}).onChange(function(mode){
                setRenderMode(mode);
                checkRender();
            });
            rf.add(settings,'renderInterval').min(0).max(1000).onChange(checkRender);
            rf.add(settings,'contacts').onChange(checkRender);
            rf.add(settings,'cm2contact').onChange(checkRender);
            rf.add(settings,'normals').onChange(checkRender);
            rf.add(settings,'constraints').onChange(checkRender);
            rf.add(settings,'forces').min(0).max(100).onChange(checkRender);
            rf.add(settings,'strain').onChange(checkRender);
            rf.add(settings,'springs').onChange(checkRender);
            rf.add(settings,'axes').onChange(checkRender);
            rf.add(settings,'particleSize').min(0).max(1).onChange(function(size){
                for(var i=0; i<visuals.length; i++){
                    if(bodies[i] instanceof CANNON.Particle)
                        visuals[i].scale.set(size,size,size);
                }
                checkRender();
            });
/*            
            rf.add(settings,'shadows').onChange(function(shadows){
                if (settings.rendermode!='solid') {
                  settings.shadows=false;
                  return;
                }
                if(shadows){
                    renderer.shadowMapAutoUpdate = true;
                } else {
                    renderer.shadowMapAutoUpdate = false;
                    renderer.clearTarget( light.shadowMap );
                }
                checkRender();
            });
*/
            
            rf.add(settings,'aabbs').onChange(checkRender);
            rf.add(settings,'profiling').onChange(function(profiling){
                if(profiling){
                    world.doProfiling = true;
                    smoothie.start();
                    smoothieCanvas.style.display = "block";
                } else {
                    world.doProfiling = false;
                    smoothie.stop();
                    smoothieCanvas.style.display = "none";
                }
                checkRender();
            });
            // Grid folder
            var gf = gui.addFolder('Grid');
            gf.add(settings,'gridSphere').min(0).max(100).onChange(function(i){
              settings.gridSphere=settings.gridSphere|0;
              checkRender();
            });
            gf.add(settings,'gridPlane').min(0).max(100).onChange(function(i){
              settings.gridPlane=settings.gridPlane|0;
              checkRender();
            });
            gf.add(settings,'gridBox').min(0).max(100).onChange(function(i){
              settings.gridBox=settings.gridBox|0;
              checkRender();
            });
            
            // World folder
            var wf = gui.addFolder('World');
            // Pause
            wf.add(settings, 'paused').onChange(function(p){
                /*if(p){
                    smoothie.stop();
                } else {
                    smoothie.start();
                }*/
                checkRender();
            });
            wf.add(settings, 'stepFrequency',60,60*10).step(60);
            var maxg = 100;
            wf.add(settings, 'gx',-maxg,maxg).onChange(function(gx){
                if(!isNaN(gx)){
                    world.gravity.set(gx,settings.gy,settings.gz);
                }
            });
            wf.add(settings, 'gy',-maxg,maxg).onChange(function(gy){
                if(!isNaN(gy))
                    world.gravity.set(settings.gx,gy,settings.gz);
            });
            wf.add(settings, 'gz',-maxg,maxg).onChange(function(gz){
                if(!isNaN(gz))
                    world.gravity.set(settings.gx,settings.gy,gz);
            });
            wf.add(settings, 'quatNormalizeSkip',0,50).step(1).onChange(function(skip){
                if(!isNaN(skip)){
                    world.quatNormalizeSkip = skip;
                }
            });
            wf.add(settings, 'quatNormalizeFast').onChange(function(fast){
                world.quatNormalizeFast = !!fast;
            });
            wf.add(settings,'zoom').min(1).max(100).onChange(function(i){
              settings.zoom=settings.zoom|0;
              camera.fov = settings.zoom;
              camera.updateProjectionMatrix ();
              checkRender();
            });

            // Solver folder
            var sf = gui.addFolder('Solver');
            sf.add(settings, 'iterations',1,50).step(1).onChange(function(it){
                world.solver.iterations = it;
            });
            sf.add(settings, 'k',10,10000000).onChange(function(k){
                that.setGlobalSpookParams(settings.k,settings.d,1/settings.stepFrequency);
            });
            sf.add(settings, 'd',0,20).step(0.1).onChange(function(d){
                that.setGlobalSpookParams(settings.k,settings.d,1/settings.stepFrequency);
            });
            sf.add(settings, 'tolerance',0.0,10.0).step(0.01).onChange(function(t){
                world.solver.tolerance = t;
            });

            // Scene picker
            sceneFolder = gui.addFolder('Scenes');
            sceneFolder.open();
            
            gui.close();
        }

        // Trackball controls
        controls = new THREE.TrackballControls( camera, renderer.domElement );
        controls.rotateSpeed = 1.0;
        controls.zoomSpeed = 1.2;
        controls.panSpeed = 0.2;
        controls.noZoom = false;
        controls.noPan = false;
        controls.staticMoving = false;
        controls.dynamicDampingFactor = 0.3;
        var radius = 100;
        controls.minDistance = 0.0;
        controls.maxDistance = radius * 1000;
        //controls.keys = [ 65, 83, 68 ]; // [ rotateKey, zoomKey, panKey ]
        controls.screen.width = SCREEN_WIDTH;
        controls.screen.height = SCREEN_HEIGHT;

        container.addEventListener('keypress',function(e){
            if (!gui) return;
            if(e.keyCode){
                switch(e.keyCode){
                case 32: // Space - restart
                    restartCurrentScene();
                    break;
/*                    
                case 104: // h - toggle widgets
                    if(stats.domElement.style.display=="none"){
                        stats.domElement.style.display = "block";
                        info.style.display = "block";
                    } else {
                        stats.domElement.style.display = "none";
                        info.style.display = "none";
                    }
                    break;
*/
                case 97: // a - AABBs
                    settings.aabbs = !settings.aabbs;
                    updategui();
                    break;

                case 99: // c - constraints
                    settings.constraints = !settings.constraints;
                    updategui();
                    break;

                case 112: // p
                    settings.paused = !settings.paused;
                    updategui();
                    break;

                case 115: // s
                    var timeStep = 1 / settings.stepFrequency;
                    world.step(timeStep);
                    updateVisuals();
                    break;

                case 109: // m - toggle materials
                    var idx = renderModes.indexOf(settings.rendermode);
                    idx++;
                    idx = idx % renderModes.length; // begin at 0 if we exceeded number of modes
                    setRenderMode(renderModes[idx]);
                    updategui();
                    break;

               case 122: // z
                    camera.fov *= 1.1;
                    camera.updateProjectionMatrix ();
                    checkRender();
                    break;
               case 90: // Z
                    camera.fov /= 1.1;
                    camera.updateProjectionMatrix ();
                    checkRender();
                    break;

                case 49:
                case 50:
                case 51:
                case 52:
                case 53:
                case 54:
                case 55:
                case 56:
                case 57:
                    // Change scene
                    // Only for numbers 1-9 and if no input field is active
                    if(scenes.length > e.keyCode-49 && !document.activeElement.localName.match(/input/)){
                        changeScene(e.keyCode-49);
                    }
                    break;
                }
            }
        });

        that.log('[PHY] Initialized! Axes: (x,y,z) -> (red,blue,green)');

    }

    var t = 0, newTime, delta, onemore=0, frame, timer;

    function animate(callback){
      var f = function () {
        var _steps=settings.steps;
        timer=null;
        if(!settings.render && !onemore) return;

        if (settings.renderInterval<1) frame=requestAnimationFrame( animate );
        updateVisuals();
        if (_steps>0) {
          while (settings.steps) {
            updatePhysics();
            settings.steps--;
          }
        }
        else if(!settings.paused) {
          updatePhysics();
        }
                
        if (!that.display.lazy) render();
        if (onemore>0) onemore--;
        if (_steps>0) {
          if (callback) cont=callback(); else cont=false;
          if (!cont) {
            // stop
            settings.render=false;
            settings.steps=0;
            onemore=1;
          } else // continue
            settings.steps=_steps;
        } 
        // stats.update();
        if(settings.renderInterval>0) animate(callback);
      };
      if (settings.renderInterval<1) f(); else timer=setTimeout(f,settings.renderInterval);
      return timer?false:true;
    }

    function animate1(more){
      var f = function () {
        timer=null;
        if (!gui) return;
        // requestAnimationFrame( function () {} );
        updateVisuals();                
        render();
        // stats.update();
        if (more) {
          more--;
          timer=setTimeout(f,10);
        }
      };
      timer=setTimeout(f,10);
    }

    function checkRender() {
      if (!settings.render || that.display.lazy) animate1(); 
    }
    
    this.destroy = function () {
      function empty(elem) {
         while (elem.lastChild) elem.removeChild(elem.lastChild);
      }
      settings.paused=true;
      settings.steps=0;
      settings.render=false;
      nomore=false;
      if (timer) clearTimeout(timer);
      container.addEventListener('keypress', null, false); //remove listener to render
      container.addEventListener('mousemove', null, false); //remove listener to render
      gui.destroy();
      gui=null;
      if (frame) cancelAnimationFrame(frame);
      scene = null;
      light = null;
      controls = null;
      //this.projector = null;
      camera = null;
      controls = null;
      empty(container);
    }
    
    var lastCallTime = 0;
    function updatePhysics(){
        // Step world
        var timeStep = 1 / settings.stepFrequency;

        var now = Date.now() / 1000;

        if(!lastCallTime){
            // last call time not saved, cant guess elapsed time. Take a simple step.
            world.step(timeStep);
            lastCallTime = now;
            return;
        }

        var timeSinceLastCall = now - lastCallTime;

        world.step(timeStep, timeSinceLastCall, settings.maxSubSteps);

        lastCallTime = now;
    }

    function onDocumentMouseMove( event ) {
        mouseX = ( event.clientX - windowHalfX );
        mouseY = ( event.clientY - windowHalfY );
        if (!settings.render) animate1(3);
    }

    this.resize = function( options ) {
        SCREEN_WIDTH = options.width;
        SCREEN_HEIGHT = options.height;

        renderer.setSize( SCREEN_WIDTH, SCREEN_HEIGHT );

        camera.aspect = SCREEN_WIDTH / SCREEN_HEIGHT;
        camera.updateProjectionMatrix();

        controls.screen.width = SCREEN_WIDTH;
        controls.screen.height = SCREEN_HEIGHT;

        camera.radius = ( SCREEN_WIDTH + SCREEN_HEIGHT ) / 4;
    }

    function render(){
        controls.update();
        renderer.clear();
        renderer.render( that.scene, camera );
    }



    function changeScene(n,options){
        that.dispatchEvent({ type: 'destroy' });
        setRenderMode(settings.rendermode);
        updategui();
        buildScene(n,options);
        settings.zoom = camera.fov;
        animate1();
    }

    function disable () {
        settings.render = false;      
    }

    function enable () {
        settings.render = true;      
    }

    function start(){
        settings.render = true;      
        settings.paused = false;
        settings.steps = 0;
        setRenderMode(settings.rendermode);
        // buildScene(0);
        animate();
    }

    function stop(){
        onemore=1;
        settings.paused = true;
        settings.steps = 0;
        updategui();
    }

    function step(n,callback){
        if (!settings.paused) return;

        settings.steps=n;
        setRenderMode(settings.rendermode);
        updategui();
        return animate(callback);
    }

    function stepPhyOnly(n,callback) {
      var _steps=n,cont;
      while (_steps) {
        updatePhysics();
        _steps--;
        if (_steps==0 && callback && callback()) _steps=n; 
      }
    }

    function exportImage () {
      var image;
      if (renderer) image = renderer.domElement.toDataURL('image/png',1.0);
      return image;
    }

    function buildScene(n,options){
        // Remove current bodies and visuals
        var num = visuals.length;
        for(var i=0; i<num; i++){
            world.remove(bodies.pop());
            var mesh = visuals.pop();
            that.scene.remove(mesh);
        }
        // Remove all constraints
        while(world.constraints.length){
            world.removeConstraint(world.constraints[0]);
        }
        while(world.springs.length){
            world.removeSpring(world.springs[0]);
        }
        if (that.scene) that.scene.reset();
        // Run the user defined "build scene" function
        try {scenes[n](options)}
        catch (e) {
          that.log('[CANNON] Error: Creating of scene '+n+' failed: '+e); 
        };

        // Read the newly set data to the gui
        settings.iterations = world.solver.iterations;
        settings.gx = world.gravity.x+0.0;
        settings.gy = world.gravity.y+0.0;
        settings.gz = world.gravity.z+0.0;
        settings.quatNormalizeSkip = world.quatNormalizeSkip;
        settings.quatNormalizeFast = world.quatNormalizeFast;
        updategui();

        restartGeometryCaches();
    }


    function GeometryCache(createFunc){
        var that=this, geometries=[], gone=[];
        this.request = function(){
            if(geometries.length){
                geo = geometries.pop();
            } else{
                geo = createFunc();
            }
            scene.add(geo);
            gone.push(geo);
            return geo;
        };

        this.restart = function(){
            while(gone.length){
                geometries.push(gone.pop());
            }
        };

        this.hideCached = function(){
            for(var i=0; i<geometries.length; i++){
                scene.remove(geometries[i]);
            }
        };
    }
};
CANNON.Gui.prototype = new CANNON.EventTarget();
CANNON.Gui.constructor = CANNON.Gui;

CANNON.Gui.prototype.setGlobalSpookParams = function(k,d,h){
    var world = this.world;

    // Set for all constraints
    for(var i=0; i<world.constraints.length; i++){
        var c = world.constraints[i];
        for(var j=0; j<c.equations.length; j++){
            var eq = c.equations[j];
            eq.setSpookParams(k,d,h);
        }
    }

    // Set for all contact materals
    for(var i=0; i<world.contactmaterials.length; i++){
        var cm = world.contactmaterials[i];
        cm.contactEquationStiffness = k;
        cm.frictionEquationStiffness = k;
        cm.contactEquationRelaxation = d;
        cm.frictionEquationRelaxation = d;
    }

    world.defaultContactMaterial.contactEquationStiffness = k;
    world.defaultContactMaterial.frictionEquationStiffness = k;
    world.defaultContactMaterial.contactEquationRelaxation = d;
    world.defaultContactMaterial.frictionEquationRelaxation = d;
};

CANNON.Gui.prototype.getWorld = function(){
    return this.world;
};

CANNON.Gui.prototype.addVisual = function(body){
    var s = this.settings;
    // What geometry should be used?
    var mesh;
    if(body instanceof CANNON.Body){
        mesh = this.shape2mesh(body);
    }
    if(mesh) {
        // Add body
        this.bodies.push(body);
        this.visuals.push(mesh);
        body.visualref = mesh;
        body.visualref.visualId = this.bodies.length - 1;
        //mesh.useQuaternion = true;
        this.scene.add(mesh);
    }
};

CANNON.Gui.prototype.addVisuals = function(bodies){
    for (var i = 0; i < bodies.length; i++) {
        this.addVisual(bodies[i]);
    }
};

CANNON.Gui.prototype.removeVisual = function(body){
    if(body.visualref){
        var bodies = this.bodies,
            visuals = this.visuals,
            old_b = [],
            old_v = [],
            n = bodies.length;

        for(var i=0; i<n; i++){
            old_b.unshift(bodies.pop());
            old_v.unshift(visuals.pop());
        }

        var id = body.visualref.visualId;
        for(var j=0; j<old_b.length; j++){
            if(j !== id){
                var i = j>id ? j-1 : j;
                bodies[i] = old_b[j];
                visuals[i] = old_v[j];
                bodies[i].visualref = old_b[j].visualref;
                bodies[i].visualref.visualId = i;
            }
        }
        body.visualref.visualId = null;
        this.scene.remove(body.visualref);
        body.visualref = null;
    }
};

CANNON.Gui.prototype.removeAllVisuals = function(){
    while(this.bodies.length) {
        this.removeVisual(this.bodies[0]);
    }
};

CANNON.Gui.prototype.shape2mesh = function(body){
    var wireframe = this.settings.rendermode === "wireframe";
    var obj = new THREE.Object3D();

    for (var l = 0; l < body.shapes.length; l++) {
        var shape = body.shapes[l];

        var mesh;
        if (shape.color && !this.materials[shape.color]) 
          this.materials[shape.color]=new THREE.MeshBasicMaterial( { color: shape.color, wireframe:wireframe } );
          
        switch(shape.type){

        case CANNON.Shape.types.SPHERE:
            var sphere_geometry = new THREE.SphereGeometry( shape.radius, 
                                                            shape.grid||this.settings.gridSphere, 
                                                            shape.grid||this.settings.gridSphere);
            mesh = new THREE.Mesh( sphere_geometry, 
                                   shape.color?this.materials[shape.color]:this.currentMaterial );
            break;

        case CANNON.Shape.types.PARTICLE:
            mesh = new THREE.Mesh( this.particleGeo, this.particleMaterial );
            var s = this.settings;
            mesh.scale.set(s.particleSize,s.particleSize,s.particleSize);
            break;

        case CANNON.Shape.types.PLANE:
            var geometry = new THREE.PlaneGeometry(2, 2, shape.grid||this.settings.gridPlane, 
                                                         shape.grid||this.settings.gridPlane);
            mesh = new THREE.Object3D();
            var submesh = new THREE.Object3D();
            var ground = new THREE.Mesh( geometry, 
                                         shape.color?this.materials[shape.color]:this.currentMaterial );
            ground.scale.set(100, 100, 100);
            submesh.add(ground);

            ground.castShadow = true;
            ground.receiveShadow = true;

            mesh.add(submesh);
            break;

        case CANNON.Shape.types.BOX:
            var box_geometry = new THREE.BoxGeometry(  shape.halfExtents.x*2,
                                                       shape.halfExtents.y*2,
                                                       shape.halfExtents.z*2,
                                                       shape.grid||this.settings.gridBox,
                                                       shape.grid||this.settings.gridBox,
                                                       shape.grid||this.settings.gridBox );
            mesh = new THREE.Mesh( box_geometry, 
                                   shape.color?this.materials[shape.color]:this.currentMaterial );
            break;

        case CANNON.Shape.types.CONVEXPOLYHEDRON:
            var geo = new THREE.Geometry();

            // Add vertices
            for (var i = 0; i < shape.vertices.length; i++) {
                var v = shape.vertices[i];
                geo.vertices.push(new THREE.Vector3(v.x, v.y, v.z));
            }

            for(var i=0; i < shape.faces.length; i++){
                var face = shape.faces[i];

                // add triangles
                var a = face[0];
                for (var j = 1; j < face.length - 1; j++) {
                    var b = face[j];
                    var c = face[j + 1];
                    geo.faces.push(new THREE.Face3(a, b, c));
                }
            }
            geo.computeBoundingSphere();
            geo.computeFaceNormals();
            mesh = new THREE.Mesh( geo, 
                                   shape.color?this.materials[shape.color]:this.currentMaterial );
            break;

        case CANNON.Shape.types.HEIGHTFIELD:
            var geometry = new THREE.Geometry();

            var v0 = new CANNON.Vec3();
            var v1 = new CANNON.Vec3();
            var v2 = new CANNON.Vec3();
            for (var xi = 0; xi < shape.data.length - 1; xi++) {
                for (var yi = 0; yi < shape.data[xi].length - 1; yi++) {
                    for (var k = 0; k < 2; k++) {
                        shape.getConvexTrianglePillar(xi, yi, k===0);
                        v0.copy(shape.pillarConvex.vertices[0]);
                        v1.copy(shape.pillarConvex.vertices[1]);
                        v2.copy(shape.pillarConvex.vertices[2]);
                        v0.vadd(shape.pillarOffset, v0);
                        v1.vadd(shape.pillarOffset, v1);
                        v2.vadd(shape.pillarOffset, v2);
                        geometry.vertices.push(
                            new THREE.Vector3(v0.x, v0.y, v0.z),
                            new THREE.Vector3(v1.x, v1.y, v1.z),
                            new THREE.Vector3(v2.x, v2.y, v2.z)
                        );
                        var i = geometry.vertices.length - 3;
                        geometry.faces.push(new THREE.Face3(i, i+1, i+2));
                    }
                }
            }
            geometry.computeBoundingSphere();
            geometry.computeFaceNormals();
            mesh = new THREE.Mesh(geometry, 
                                   shape.color?this.materials[shape.color]:this.currentMaterial );
            break;

        case CANNON.Shape.types.TRIMESH:
            var geometry = new THREE.Geometry();

            var v0 = new CANNON.Vec3();
            var v1 = new CANNON.Vec3();
            var v2 = new CANNON.Vec3();
            for (var i = 0; i < shape.indices.length / 3; i++) {
                shape.getTriangleVertices(i, v0, v1, v2);
                geometry.vertices.push(
                    new THREE.Vector3(v0.x, v0.y, v0.z),
                    new THREE.Vector3(v1.x, v1.y, v1.z),
                    new THREE.Vector3(v2.x, v2.y, v2.z)
                );
                var j = geometry.vertices.length - 3;
                geometry.faces.push(new THREE.Face3(j, j+1, j+2));
            }
            geometry.computeBoundingSphere();
            geometry.computeFaceNormals();
            mesh = new THREE.Mesh( geometry, 
                                   shape.color?this.materials[shape.color]:this.currentMaterial );
            break;

        default:
            throw "Visual type not recognized: "+shape.type;
        }

        mesh.receiveShadow = true;
        mesh.castShadow = true;
        if(mesh.children){
            for(var i=0; i<mesh.children.length; i++){
                mesh.children[i].castShadow = true;
                mesh.children[i].receiveShadow = true;
                if(mesh.children[i]){
                    for(var j=0; j<mesh.children[i].length; j++){
                        mesh.children[i].children[j].castShadow = true;
                        mesh.children[i].children[j].receiveShadow = true;
                    }
                }
            }
        }

        var o = body.shapeOffsets[l];
        var q = body.shapeOrientations[l];
        mesh.position.set(o.x, o.y, o.z);
        mesh.quaternion.set(q.x, q.y, q.z, q.w);
        shape.mesh=mesh;
        obj.add(mesh);
    }

    return obj;
};
