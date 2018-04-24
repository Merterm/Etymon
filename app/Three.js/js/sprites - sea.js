//import { SpriteText2D, textAlign } from 'three-text2d'



var SEPARATION = 50, AMOUNTX = 20, AMOUNTY = 20;

var container, stats;
var camera, controls, scene, renderer;
var geometry, group;

var particles, labels;

var mouseX = 0, mouseY = 0, count = 0;
var windowHalfX = window.innerWidth / 2;
var windowHalfY = window.innerHeight / 2;

var particleWidth, particleHeight;

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

    var radius = 100;

    geometry = new THREE.Geometry();
    //var radius = geometry.boundingSphere.radius;

    container = document.getElementById('particles-container');

    stats = new Stats();
	 container.appendChild( stats.dom );

    camera =
        new THREE.PerspectiveCamera(
            VIEW_ANGLE,
            ASPECT,
            NEAR,
            FAR
        );
    camera.position.z = 700;

	//camera.position.set( 400, 200, 0 );
    //camera.position.set( 0.0, radius, radius * 3.5 );


    scene = new THREE.Scene();
    scene.add(camera);

    renderer = new THREE.WebGLRenderer();
	renderer.setPixelRatio( window.devicePixelRatio );
    renderer.setSize(WIDTH, HEIGHT);

    // Initialize camera controls
	controls = new THREE.OrbitControls( camera, renderer.domElement );
	controls.target.set( 0, radius, 0 );
	controls.update();

/*    // controls
    controls = new THREE.OrbitControls( camera, renderer.domElement );
    //controls.addEventListener( 'change', render ); // call this only in static scenes (i.e., if there is no animation loop)
    controls.enableDamping = true; // an animation loop is required when either damping or auto-rotation are enabled
    controls.dampingFactor = 0.25;
    controls.panningMode = THREE.HorizontalPanning; // default is THREE.ScreenSpacePanning
    controls.minDistance = 100;
    controls.maxDistance = 1600
    controls.maxPolarAngle = Math.PI / 2;
*/
    // Attach the renderer-supplied
    // DOM element.
    container.appendChild(renderer.domElement);

    // Working with Sprites, CREATE SPRITES

    var material = new THREE.SpriteMaterial( {
		map: new THREE.CanvasTexture( generateSprite() ),
		blending: THREE.AdditiveBlending
	} );

    particleWidth = material.map.image.width;
    particleHeight = material.map.image.height;

    particles = new Array();
    labels = new Array();

    var i = 0;
	for ( var ix = 0; ix < AMOUNTX; ix ++ ) {
		for ( var iy = 0; iy < AMOUNTY; iy ++ ) {
            label = labels [i] = makeTextSprite('word');
			particle = particles[ i ++ ] = new THREE.Sprite( material );
			particle.position.x = label.position.x = ix * SEPARATION - ( ( AMOUNTX * SEPARATION ) / 2 );
			particle.position.z = label.position.z = iy * SEPARATION - ( ( AMOUNTY * SEPARATION ) / 2 );
            particle.rotation.x = label.rotation.x = Math.random() * 6;
    		particle.rotation.y = label.rotation.y = Math.random() * 6;
    		particle.rotation.z = label.rotation.z = Math.random() * 6;

            scene.add( particle );
            scene.add(label);
		}
	}


//  document.addEventListener( 'mousemove', onDocumentMouseMove, false );
//	document.addEventListener( 'touchstart', onDocumentTouchStart, false );
//	document.addEventListener( 'touchmove', onDocumentTouchMove, false );

	window.addEventListener( 'resize', onWindowResize, false );
}
function animate (){
    stats.update();
    requestAnimationFrame( animate );
	render();
}

function render(){

    var time = Date.now() * 0.00005;
	//camera.position.x += ( mouseX - camera.position.x ) * 0.05;
	//camera.position.y += ( - mouseY - camera.position.y ) * 0.05;
	//camera.lookAt( scene.position );

    for ( i = 0; i < scene.children.length; i ++ ) {
		var object = scene.children[ i ];
		if ( object instanceof THREE.Sprite ) {
			object.rotation.y = time * ( i < 4 ? i + 1 : - ( i + 1 ) );
            //console.log (object.rotation.y);
		}
	}

    var i = 0;
	for ( var ix = 0; ix < AMOUNTX; ix ++ ) {
		for ( var iy = 0; iy < AMOUNTY; iy ++ ) {
            label = labels [i];
            particle = particles[ i++ ];
			particle.position.y = ( Math.sin( ( ix + count ) * 0.2 ) * 30 ) +
				( Math.sin( ( iy + count ) * 0.5 ) * 30 );
            particle.scale.x = particle.scale.y = ( Math.sin( ( ix + count ) * 0.2 ) + 1 ) * 4 +
				( Math.sin( ( iy + count ) * 0.5 ) + 1 ) * 4;

            label.position.y = particle.position.y - 7;
            label.position.x = particle.position.x + 5;

		}
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


function makeTextSprite( message, parameters )
{
    if ( parameters === undefined ) parameters = {};
    var fontface = parameters.hasOwnProperty("fontface") ? parameters["fontface"] : "Lucida Sans Unicode";
    var fontsize = parameters.hasOwnProperty("fontsize") ? parameters["fontsize"] : 40;
    var borderThickness = parameters.hasOwnProperty("borderThickness") ? parameters["borderThickness"] : 0;
    var borderColor = parameters.hasOwnProperty("borderColor") ?parameters["borderColor"] : { r:0, g:0, b:0, a:0.0 };
    var backgroundColor = parameters.hasOwnProperty("backgroundColor") ?parameters["backgroundColor"] : { r:0, g:0, b:0, a:0.0 };
    var textColor = parameters.hasOwnProperty("textColor") ?parameters["textColor"] : { r:200, g:200, b:255, a:0.8 };

    var canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    var context = canvas.getContext('2d');
    context.font = "Bold " + fontsize + "px " + fontface;
    var metrics = context.measureText( message );
    var textHeight = metrics.height;
    var textWidth = metrics.width;

    context.fillStyle   = "rgba(" + backgroundColor.r + "," + backgroundColor.g + "," + backgroundColor.b + "," + backgroundColor.a + ")";
    context.strokeStyle = "rgba(" + borderColor.r + "," + borderColor.g + "," + borderColor.b + "," + borderColor.a + ")";

    context.lineWidth = borderThickness;



    context.fillStyle = "rgba("+textColor.r+", "+textColor.g+", "+textColor.b+", 1.0)";
    context.fillText( message, borderThickness, fontsize + borderThickness);

    var texture = new THREE.Texture(canvas)
    texture.needsUpdate = true;

    var spriteMaterial = new THREE.SpriteMaterial( { map: texture} );

    var sprite = new THREE.Sprite( spriteMaterial );
    sprite.scale.set(0.5 * fontsize, 0.25 * fontsize, 0.75 * fontsize);
    return sprite;
}
