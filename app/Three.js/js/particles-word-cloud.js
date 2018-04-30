var container, stats, camera, controls, scene, renderer;
var geometry, group;
var particles, labels;
var WIDTH, HEIGHT;
var mouseX = 0, mouseY = 0, count = 0;
var windowHalfX = window.innerWidth / 2;
var windowHalfY = window.innerHeight / 2;
var firstAnimationTime = 50, startTime, lastRenderTime = 0, acceleration;
var maxZ = 2000, minZ = 10, deltaZ = 0, deltaTime = 0, tCount = 0;

document.addEventListener( 'mousemove', onDocumentMouseMove, false );

window.onload = function (){
    init();
    animate();
}

function init (){
    geometry = new THREE.Geometry();
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

    scene = new THREE.Scene();
    scene.add(camera);

    renderer = new THREE.WebGLRenderer();
	 renderer.setPixelRatio( window.devicePixelRatio );
    renderer.setSize(WIDTH, HEIGHT);


    controls = new THREE.OrbitControls( camera, renderer.domElement );
    controls.enableDamping = true; // an animation loop is required when either damping or auto-rotation are enabled
    controls.dampingFactor = 0.25;
    controls.panningMode = THREE.HorizontalPanning; // default is THREE.ScreenSpacePanning
    controls.minDistance = 100;
    controls.maxDistance = 1600
    controls.maxPolarAngle = Math.PI / 2;

    // Attach the renderer-supplied DOM element
    container.appendChild(renderer.domElement);

    // CREATE SPRITES
    var material = new THREE.SpriteMaterial( {
   	map: new THREE.CanvasTexture( generateSprite() ),
   	blending: THREE.AdditiveBlending
    } );

    particles = new Array();
    labels = new Array();

    var i = 0;

    particle = particles[ i ++ ] = new THREE.Sprite( material );

    particle.position.x = 0;
    particle.position.z = 0;
    particle.rotation.x = Math.random() * 6;
    particle.rotation.y = Math.random() * 6;
    particle.rotation.z = Math.random() * 6;

    scene.add( particle );

/*
    // add event listeners
    document.addEventListener( 'mousemove', onDocumentMouseMove, false );
    document.addEventListener( 'touchstart', onDocumentTouchStart, false );
    document.addEventListener( 'touchmove', onDocumentTouchMove, false );
*/
	 window.addEventListener( 'resize', onWindowResize, false );
}
function animate (){
    stats.update();
    requestAnimationFrame( animate );
	 render();
}

function render(){

   // new stuff
   //var nowTime = Date.now();


   //if (lastRenderTime == 0){
      // set time for startAnimationTime
      //startTime = Date.now();
      //firstAnimationTime = 2000;
      //console.log("Start1");
   //}
   //else {
      //if (deltaTime == 0){
         //console.log("Start2");
         //deltaTime = nowTime - startTime;
         //acceleration = 2*(maxZ-minZ)/(firstAnimationTime*firstAnimationTime);
         //deltaZ = acceleration;
         //console.log("Time delta "+ deltaTime);
         //console.log("Z delta "+ deltaZ);
         //console.log("t square "+ (firstAnimationTime*firstAnimationTime));
      //}
   //}

   //lastRenderTime = nowTime;

   if (camera.position.z > minZ) {
      camera.position.z -= camera.position.z * 0.05;
      //camera.position.z -= deltaZ;
      //console.log("inside " + camera.position.z + " " + deltaZ);
      //deltaZ = acceleration*deltaTime*tCount++;
      //deltaZ = acceleration*(nowTime-startTime);
      camera.lookAt( scene.position );
   }

    // Draw!
    renderer.render(scene, camera);
    count += 0.1;
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
function onDocumentMouseMove( event ) {
    mouseX = event.clientX - windowHalfX;
    mouseY = event.clientY - windowHalfY;
}
function onDocumentTouchStart( event ) {
    if ( event.touches.length === 1 ) {
        event.preventDefault();
        mouseX = event.touches[ 0 ].pageX - windowHalfX;
        mouseY = event.touches[ 0 ].pageY - windowHalfY;
    }
}
function onDocumentTouchMove( event ) {
    if ( event.touches.length === 1 ) {
        event.preventDefault();
        mouseX = event.touches[ 0 ].pageX - windowHalfX;
        mouseY = event.touches[ 0 ].pageY - windowHalfY;
    }
}
