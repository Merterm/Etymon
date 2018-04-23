window.onload = function (){
    // Set the scene size.
    const WIDTH = window.innerWidth;
    const HEIGHT = window.innerHeight;
    // Set some camera attributes.
    const VIEW_ANGLE = 45;
    const ASPECT = WIDTH / HEIGHT;
    const NEAR = 0.1;
    const FAR = 10000;

    // Get the DOM element to attach to
    const container =
        document.getElementById('particles-container');

    // Create a WebGL renderer, camera
    // and a scene
    const renderer = new THREE.WebGLRenderer();
    const camera =
        new THREE.PerspectiveCamera(
            VIEW_ANGLE,
            ASPECT,
            NEAR,
            FAR
        );

    camera.position.z = 800;

    const scene = new THREE.Scene();

    // Add the camera to the scene.
    scene.add(camera);

    // Start the renderer.
    renderer.setSize(WIDTH, HEIGHT);

    // Attach the renderer-supplied
    // DOM element.
    container.appendChild(renderer.domElement);

    // create the particle variables
    var texture = new THREE.TextureLoader().load( "glowing point4.png" );

    var pointsCount = 5000,
        pointsGeometry = new THREE.Geometry(),
        pointsMaterial = new THREE.PointsMaterial( {
            color: 0xFFFFFF,
            size: 8,

            map: texture,
            blending: THREE.AdditiveBlending,
            transparent: true
        } );

    // now create the individual particles
    for (var p = 0; p < pointsCount; p++) {

      // create a particle with random
      // position values, -250 -> 250
      var pX = Math.random() * 500 - 250,
          pY = Math.random() * 500 - 250,
          pZ = Math.random() * 500 - 250;

      // add it to the geometry
      pointsGeometry.vertices.push(new THREE.Vector3(pX, pY, pZ));
      //scene.add(point);
    }

    // create the particle system
    var points = new THREE.Points(
        pointsGeometry,
        pointsMaterial);

    //points.sortParticles = true;

    // add it to the scene
    scene.add(points);

    // Draw!
    renderer.render(scene, camera);

    function update () {
      // Draw!
      renderer.render(scene, camera);

      // Schedule the next frame.
      requestAnimationFrame(update);
    }

    // Schedule the first frame.
    requestAnimationFrame(update);

}
