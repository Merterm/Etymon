var container, stats, camera, controls, scene, renderer;
var geometry, group, material;
var word, connectedWords, points;
var numConnectedWords = 7, numConnectingLines = numConnectedWords;
var particles, labels;
var WIDTH, HEIGHT;
var mouseX = 0, mouseY = 0, count = 0;
var windowHalfX = window.innerWidth / 2;
var windowHalfY = window.innerHeight / 2;
var firstAnimationTime = 50, startTime, lastRenderTime = 0, acceleration;
var maxZ = 2000, minZ = 10, optimalZ = 20, state = 0;
var c;

// state 0: start
// state 1: first zoom in animation
// state 2: lines
// state 3: words

//document.addEventListener( 'mousemove', onDocumentMouseMove, false );

window.onload = function (){
    init();
    animate();
}

function init (){
    //geometry = new THREE.Geometry();
    container = document.getElementById('particles-container');
    // Set the scene size.
    WIDTH = window.innerWidth;
    HEIGHT = window.innerHeight;

    //console.log (WIDTH + " " + HEIGHT);
    // stats
    stats = new Stats();
	 container.appendChild( stats.dom );

    camera = new THREE.PerspectiveCamera(45, WIDTH / HEIGHT, 0.1, 10000);
    camera.position.z = maxZ;
    //camera.position.x = 0;
    //camera.position.y = 0;

    scene = new THREE.Scene();
    scene.add(camera);

    renderer = new THREE.WebGLRenderer();
	 renderer.setPixelRatio( window.devicePixelRatio );
    renderer.setSize(WIDTH, HEIGHT);


    controls = new THREE.OrbitControls( camera, renderer.domElement );
    controls.enableDamping = true; // an animation loop is required when either damping or auto-rotation are enabled
    controls.dampingFactor = 0.25;
    //controls.panningMode = THREE.HorizontalPanning; // default is THREE.ScreenSpacePanning
    //controls.panningMode = THREE.VerticalPanning;
    controls.minDistance = minZ;
    controls.maxDistance = maxZ;
    controls.maxPolarAngle = Math.PI / 2;

    // Attach the renderer-supplied DOM element
    container.appendChild(renderer.domElement);

    // CREATE SPRITES
    material = new THREE.SpriteMaterial( {
   	map: new THREE.CanvasTexture( generateSprite() ),
   	blending: THREE.AdditiveBlending
    } );

    points = new Array ();

    // add the word
    word = addWord(0,0);
    scene.add( word );

    //addConnectedWords(8);
	 window.addEventListener( 'resize', onWindowResize, false );
    //startTime = Date.now();
}
function animate (){
    stats.update();
    requestAnimationFrame( animate );
	 render();
}

function render(){

   // zoom in animation
   if (state === 0 && (camera.position.z - camera.position.z * 0.03) > minZ) {
      camera.position.z -= camera.position.z * 0.03;
      camera.lookAt( scene.position );

      if ((camera.position.z - camera.position.z * 0.03) <= minZ){
         c = count;
         state++;
      }
   }

   if (state === 1){
      var d = count - c;
      if (d > 0.6){
         c = Math.round(count);
         state ++;
         addConnectedWords(numConnectedWords);
         for (var i = 0; i < numConnectedWords; i ++){
            scene.add(connectedWords[i]);
         }
      }
   }

   if (state === 2  && (camera.position.z + camera.position.z * 0.01) < optimalZ){
      camera.position.z += camera.position.z * 0.01;
      camera.lookAt( scene.position );
      if ((camera.position.z + camera.position.z * 0.01) >= optimalZ)
         state++;
   }

   if (state === 3){
      addConnectingLines(numConnectingLines);
      for (var i = 0; i < numConnectingLines; i ++){
         scene.add(connectingLines[i]);
      }
      state++;
   }

   if (state === 4){
      for (var i = 0; i < numConnectingLines; i ++){
         console.log(points[i*2+1]);
         points[i*2+1] = {x: points[i*2+1].x*2, y: points[i*2+1].y*2, z: 0}
      }
      state++;
   }
    // Draw!
    renderer.render(scene, camera);
    count += 0.1;
    //console.log ("count: " + count);
}

function addWord(x, y, z){
   var word = new THREE.Sprite( material );
   word.position.x = x;
   word.position.y = y;
   if (z !== undefined)  word.position.z = z;
   //word.rotation.x = Math.random() * 6;
   //word.rotation.y = Math.random() * 6;
   //word.rotation.z = Math.random() * 6;
   return word;
}

function generateSprite() {
	var canvas = document.createElement( 'canvas' );
	canvas.width = 64;
	canvas.height =64;
	var context = canvas.getContext( '2d' );
	var gradient = context.createRadialGradient( canvas.width / 2, canvas.height / 2, 0, canvas.width / 2, canvas.height / 2, canvas.width / 2 );
	gradient.addColorStop( 0, 'rgba(255,255,255,1)' );
	gradient.addColorStop( 0.2, 'rgba(255,255,255,1)' );
	gradient.addColorStop( 0.4, 'rgba(255,255,255,1)' );
	gradient.addColorStop( 1, 'rgba(0,0,0,1)' );
	context.fillStyle = gradient;
	context.fillRect( 0, 0, canvas.width, canvas.height );
	return canvas;
}

function onWindowResize() {
    windowHalfX = WIDTH / 2;
    windowHalfY = HEIGHT / 2;
    camera.aspect = WIDTH / HEIGHT;
    camera.updateProjectionMatrix();
    renderer.setSize( WIDTH, HEIGHT );
}

function addConnectedWords( numWords ){
   var l = 5; // line length
   if (numWords === undefined) numWords = 8;
   var angle = 360/numWords;
   connectedWords = new Array();

   var index = 0;

   for (var i = 0; i < numWords; i ++){
      var a = angle*i;
      var x = l * Math.cos(a*Math.PI/180);
      var y = l * Math.sin(a*Math.PI/180);
      var newWord = connectedWords [index++]= addWord(x, y, 0);
      points.push(word.position);
      points.push(newWord.position);
   }

}

function addConnectingLines (numLines) {
   var l = 5; // line length
   if (numLines === undefined) numLines = 8;
   var angle = 360/numLines;
   connectingLines = new Array();

   geometry = new THREE.BufferGeometry().setFromPoints( points );

   var index = 0;

   for (var i = 0; i < numLines; i ++){
      var a = angle*i;
      var x = l * Math.cos(a*Math.PI/180);
      var y = l * Math.sin(a*Math.PI/180);
      var line = connectingLines [index++] = new THREE.Line( geometry, new THREE.LineBasicMaterial( { color: 0xffffff, opacity: 0.5 } ) );
   }
}
