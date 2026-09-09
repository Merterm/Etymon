// The site's masthead is a live, quiet version of the installation's chart.
//
// It imports the same modules the piece runs on -- the same wave function, the
// same word atlas, the same territory palette -- and reads the same graph file,
// including the cartography. Nothing here is a mock-up: it is the installation
// with the score switched off and the camera left drifting over one region.
//
// If WebGL is unavailable, or the graph has not been built, the masthead stays
// a still gradient and the page is unaffected.

import * as THREE from '../installation/vendor/three.module.js';
import { Palette, BACKGROUND } from '../installation/app/palette.js';
import { WordAtlas } from '../installation/app/atlas.js';
import { Ocean } from '../installation/app/ocean.js';

export async function mountHero(el) {
  let doc;
  try {
    const res = await fetch('installation/data/etymon.json');
    if (!res.ok) throw new Error(String(res.status));
    doc = await res.json();
    if (!doc.territories) throw new Error('no cartography');
  } catch (e) {
    el.classList.add('hero-static');
    return null;
  }

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  } catch (e) {
    el.classList.add('hero-static');
    return null;
  }

  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(BACKGROUND, 1);
  el.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(56, 1, 1, 40000);

  const palette = new Palette(doc);
  // A smaller atlas and fewer labels: this is a masthead, not the piece.
  const atlas = new WordAtlas({ width: 2048, height: 1024, fontSize: 28 });
  const ocean = new Ocean({
    atlas, palette, doc,
    words: doc.ocean,
    dot: 26, labelSize: 40, maxLabels: 90,
  });
  scene.add(ocean.group);

  // Drift over the largest territory, which is the densest thing to look at.
  let home = { x: 0, z: 0, r: 2200 };
  let best = 0;
  for (const key of Object.keys(doc.territories)) {
    const t = doc.territories[key];
    if (t.words > best) { best = t.words; home = t; }
  }

  let w = 0, h = 0;
  function resize() {
    w = el.clientWidth; h = el.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    ocean.dotMat.uniforms.uProj.value =
      h * 0.5 / Math.tan(camera.fov * Math.PI / 360);
    ocean.dotMat.uniforms.uPixelRatio.value = Math.min(devicePixelRatio, 2);
  }
  addEventListener('resize', resize);
  resize();

  let fade = 0, t = 0, running = true, frame = 0;
  // Stop the loop when the masthead scrolls away, so reading the page costs
  // nothing.
  const io = new IntersectionObserver(
    (entries) => { running = entries[0].isIntersecting; },
    { threshold: 0.02 });
  io.observe(el);

  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.05);
    if (!running || !w) return;
    t += dt;
    frame++;
    fade += (1 - fade) * (1 - Math.pow(0.25, dt));

    const yaw = 0.2 + t * 0.012;
    const dist = 2400 + Math.sin(t * 0.05) * 320;
    const pitch = 0.34;
    camera.position.set(
      home.x + Math.sin(yaw) * Math.cos(pitch) * dist,
      Math.sin(pitch) * dist,
      home.z + Math.cos(yaw) * Math.cos(pitch) * dist);
    camera.lookAt(home.x, -180, home.z);
    camera.updateMatrixWorld();
    camera.matrixWorldInverse.copy(camera.matrixWorld).invert();

    ocean.update(dt, fade * 0.95, camera, w, h, frame);
    renderer.render(scene, camera);
  });

  return { renderer, ocean, scene, camera };
}
