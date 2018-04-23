var container, stats;
var camera, controls, scene, renderer;
var geometry, group;

var group;

var mouseX = 0, mouseY = 0;
var windowHalfX = window.innerWidth / 2;
var windowHalfY = window.innerHeight / 2;

document.addEventListener( 'mousemove', onDocumentMouseMove, false );


window.onload = function (){

    init();
    animate();
}
function init (){
    // Set the scene size.
    var WIDTH = window.innerWidth;
    var HEIGHT = window.innerHeight;
    // Set some camera attributes.
    var VIEW_ANGLE = 45;
    var ASPECT = WIDTH / HEIGHT;
    var NEAR = 0.1;
    var FAR = 10000;

    geometry = new THREE.Geometry();

    container = document.getElementById('particles-container');
    camera =
        new THREE.PerspectiveCamera(
            VIEW_ANGLE,
            ASPECT,
            NEAR,
            FAR
        );
    camera.position.z = 1600;

	//camera.position.set( 400, 200, 0 );


    scene = new THREE.Scene();
    scene.add(camera);

    renderer = new THREE.WebGLRenderer();
	renderer.setPixelRatio( window.devicePixelRatio );
    renderer.setSize(WIDTH, HEIGHT);

    // controls
    controls = new THREE.OrbitControls( camera, renderer.domElement );
    //controls.addEventListener( 'change', render ); // call this only in static scenes (i.e., if there is no animation loop)
    controls.enableDamping = true; // an animation loop is required when either damping or auto-rotation are enabled
    controls.dampingFactor = 0.25;
    controls.panningMode = THREE.HorizontalPanning; // default is THREE.ScreenSpacePanning
    controls.minDistance = 100;
    controls.maxDistance = 1600
    controls.maxPolarAngle = Math.PI / 2;

    // Attach the renderer-supplied
    // DOM element.
    container.appendChild(renderer.domElement);

    // Working with Sprites, CREATE SPRITES

    var material = new THREE.SpriteMaterial( {
		map: new THREE.CanvasTexture( generateSprite() ),
		blending: THREE.AdditiveBlending
	} );
    for ( var i = 0; i < 4000; i++ ) {
    	particle = new THREE.Sprite( material );

        var pX = Math.random() *1000 - 500,
            pY = Math.random() *1000 - 500,
            pZ = Math.random() *1000 - 500;

    	particle.position.set( pX, pY, pZ );
    	particle.scale.x = particle.scale.y = Math.random() * 32 + 16;

        particle.rotation.x = Math.random() * 6;
		particle.rotation.y = Math.random() * 6;
		particle.rotation.z = Math.random() * 6;

    	scene.add( particle );
    }

    document.addEventListener( 'mousemove', onDocumentMouseMove, false );
	document.addEventListener( 'touchstart', onDocumentTouchStart, false );
	document.addEventListener( 'touchmove', onDocumentTouchMove, false );

	window.addEventListener( 'resize', onWindowResize, false );
}
function animate (){
    requestAnimationFrame( animate );
	render();
}

function render(){

    var rx = Math.sin( time * 0.7 ) * 0.5,
        ry = Math.sin( time * 0.3 ) * 0.5,
        rz = Math.sin( time * 0.2 ) * 0.5;

    var time = Date.now() * 0.00005;
	camera.position.x += ( mouseX - camera.position.x ) * 0.05;
	camera.position.y += ( - mouseY - camera.position.y ) * 0.05;
	camera.lookAt( scene.position );

    for ( i = 0; i < scene.children.length; i ++ ) {
		var object = scene.children[ i ];
		if ( object instanceof THREE.Sprite ) {
			object.rotation.y = time * ( i < 4 ? i + 1 : - ( i + 1 ) );
            //console.log (object.rotation.y);
		}
	}
    // Draw!
    renderer.render(scene, camera);
}

function generateSprite() {
	var canvas = document.createElement( 'canvas' );
	canvas.width = 16;
	canvas.height =16;
	var context = canvas.getContext( '2d' );
	var gradient = context.createRadialGradient( canvas.width / 2, canvas.height / 2, 0, canvas.width / 2, canvas.height / 2, canvas.width / 2 );
	gradient.addColorStop( 0, 'rgba(255,255,255,1)' );
	gradient.addColorStop( 0.2, 'rgba(0,255,255,1)' );
	gradient.addColorStop( 0.4, 'rgba(0,0,64,1)' );
	gradient.addColorStop( 1, 'rgba(0,0,0,1)' );
	context.fillStyle = gradient;
	context.fillRect( 0, 0, canvas.width, canvas.height );
	return canvas;
}

function onWindowResize() {
    windowHalfX = window.innerWidth / 2;
    windowHalfY = window.innerHeight / 2;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize( window.innerWidth, window.innerHeight );
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
