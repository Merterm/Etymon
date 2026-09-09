// Etymon — the sea, as a chart.
//
// The first version of this was a lattice with random jitter: every word
// placed arbitrarily, every word labelled, every family fully saturated. It
// looked like an ocean and meant nothing, which is a bad trade for a piece
// whose whole subject is that words are related to each other.
//
// Position now carries the argument, at two scales computed in
// pipeline/cartography.py:
//
//   where a territory sits    how much that language family actually exchanges
//                             words with its neighbours, by multidimensional
//                             scaling on the corpus's own edge counts
//   where a word sits in it   resemblance -- character n-grams, SVD, t-SNE --
//                             so spelling neighbourhoods and, emergently,
//                             languages form visible clumps
//   how deep it lies          the era of its language
//
// And the drawing changed to match. A word is a dot; only a few hundred are
// labelled at any moment -- the prominent ones near where you are looking, and
// whatever the cursor is over. That is what makes it a chart you read rather
// than a wall of text you can't.
//
// The wave is still the 2018 one. It is applied to map coordinates instead of
// lattice indices, so the chart breathes without the words drifting away from
// what their position means.

import * as THREE from '../vendor/three.module.js';
import { BACKGROUND } from './palette.js';

const DOT_VERT = /* glsl */`
  precision highp float;
  attribute vec3  aPos;      // x, era-depth, z from the cartography
  attribute vec3  aColor;
  attribute float aEra;
  attribute float aWeight;   // degree, compressed
  attribute float aHi;       // 0 normal, 1 highlighted
  attribute float aTerr;     // which region, 0..11

  uniform float uTime;
  uniform vec2  uWaveScale;
  uniform float uDot;
  uniform float uFade;
  uniform float uPixelRatio;
  uniform float uProj;      // viewportHeight / (2 tan(fov/2)), in pixels
  uniform float uEraFocus;  // -1 none, else the era being read
  uniform float uEraDim;
  uniform float uEraMix;    // 0..1, how far the era focus has faded in
  uniform float uTerrMask;  // bitmask of regions a raised chain touches
  uniform float uTerrDim;
  uniform float uTerrMix;   // 0..1, how far the region lift has faded in

  varying vec3  vColor;
  varying float vAlpha;
  varying float vHi;

  void main() {
    // --- the 2018 wave, on map coordinates ------------------------------
    float wx = sin((aPos.x / uWaveScale.x + uTime) * 0.3);
    float wy = sin((aPos.z / uWaveScale.y + uTime) * 0.5);
    float wave  = wx * 50.0 + wy * 50.0;
    float wsize = (wx + 1.0) * 4.0 + (wy + 1.0) * 4.0;   // 0 .. 16

    vec3 p = vec3(aPos.x, aPos.y + wave * 0.5, aPos.z);
    vec4 mv = viewMatrix * modelMatrix * vec4(p, 1.0);

    // Dots sized by how connected the word is, and by the wave crest. The
    // projection factor has to be the real one -- an invented constant here
    // rendered the whole chart as one-pixel specks.
    float size = uDot * (0.55 + aWeight * 1.7) * (0.72 + wsize * 0.02);
    size *= mix(1.0, 2.4, aHi);
    gl_PointSize = clamp(size * uProj * uPixelRatio / max(-mv.z, 1.0),
                         1.0, 90.0);

    vColor = aColor;
    vHi = aHi;
    float crest = 0.72 + 0.28 * (wsize / 16.0);
    vAlpha = crest * uFade * (1.0 - aEra * 0.04);

    // When a layer is being read, hold the others back so it can be -- and
    // lift the one you are in. Colour is pre-dimmed by era on the way in (deep
    // water takes the red out), which is right for looking down through all
    // five at once and wrong once you are standing in the deepest: the floor
    // was nearly black exactly when it was the subject.
    // Both of these fade. Setting them outright made the whole chart flash --
    // a hard cut in brightness reads as a fault, not as emphasis -- so the
    // strength of each is eased on the CPU and applied through a mix here.
    if (uEraFocus >= 0.0 && uEraMix > 0.001) {
      float off = min(1.0, abs(aEra - uEraFocus));
      float lift = 1.0 + 0.55 * aEra;          // undo the depth dimming
      vAlpha *= mix(1.0, mix(uEraDim, 1.0, 1.0 - off) * mix(1.0, 1.6, 1.0 - off), uEraMix);
      vColor *= mix(1.0, mix(1.0, lift, 1.0 - off), uEraMix);
    }

    // A raised chain touches particular families. Those regions come up a
    // little so you can see where in the world the word has been.
    if (uTerrMask > 0.5 && uTerrMix > 0.001) {
      float bit = mod(floor(uTerrMask / pow(2.0, aTerr)), 2.0);
      float on = step(0.5, bit);
      vAlpha *= mix(1.0, mix(uTerrDim, 1.35, on), uTerrMix);
      vColor *= mix(1.0, mix(1.0, 1.25, on), uTerrMix);
    }
    gl_Position = projectionMatrix * mv;
  }
`;

const DOT_FRAG = /* glsl */`
  precision highp float;
  varying vec3  vColor;
  varying float vAlpha;
  varying float vHi;

  void main() {
    // a soft round point, drawn procedurally -- no texture, no atlas
    vec2 d = gl_PointCoord - 0.5;
    float r = length(d) * 2.0;
    if (r > 1.0) discard;
    float core = 1.0 - smoothstep(0.0, 0.55, r);
    float halo = (1.0 - smoothstep(0.2, 1.0, r)) * 0.42;
    float a = (core + halo) * vAlpha;
    vec3 c = mix(vColor, vColor * 0.5 + 0.5, vHi * 0.7);
    gl_FragColor = vec4(c * a, a);
  }
`;

const LABEL_VERT = /* glsl */`
  precision highp float;
  attribute vec3  aPos;
  attribute vec4  aRect;
  attribute vec3  aColor;
  attribute float aAspect;
  attribute float aAlpha;

  uniform float uTime;
  uniform vec2  uWaveScale;
  uniform float uSize;
  uniform float uFade;

  varying vec2  vUv;
  varying vec3  vColor;
  varying float vAlpha;

  void main() {
    float wx = sin((aPos.x / uWaveScale.x + uTime) * 0.3);
    float wy = sin((aPos.z / uWaveScale.y + uTime) * 0.5);
    vec3 p = vec3(aPos.x, aPos.y + (wx * 50.0 + wy * 50.0) * 0.5, aPos.z);

    // labels face the room; the dots are the map, the labels are the reading
    vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
    vec3 up    = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
    vec3 local = right * (position.x * uSize * aAspect) + up * (position.y * uSize);

    vUv = aRect.xy + vec2(uv.x * aRect.z, (1.0 - uv.y) * aRect.w);
    vColor = aColor;
    vAlpha = aAlpha * uFade;
    gl_Position = projectionMatrix * viewMatrix * modelMatrix
                * vec4(p + local + up * uSize * 0.85, 1.0);
  }
`;

const LABEL_FRAG = /* glsl */`
  precision highp float;
  uniform sampler2D uAtlas;
  varying vec2  vUv;
  varying vec3  vColor;
  varying float vAlpha;
  void main() {
    float ink = texture2D(uAtlas, vUv).a;
    if (ink < 0.004) discard;
    gl_FragColor = vec4(vColor * ink * vAlpha, ink * vAlpha);
  }
`;

export class Ocean {
  constructor({ atlas, palette, doc, words,
                dot = 30.0, labelSize = 46, eraDepth = 300,
                maxLabels = 200, waveScale = 185 } = {}) {
    this.palette = palette;
    this.doc = doc;
    this.atlas = atlas;
    this.words = words;
    this.eraDepth = eraDepth;
    this.maxLabels = maxLabels;
    this.time = 0;
    this.hover = -1;

    const n = words.length;
    this.count = n;

    // ---- CPU-side positions, kept for picking and for label choice ----
    this.pos = new Float32Array(n * 3);
    this.weight = new Float32Array(n);
    this.era = new Float32Array(n);
    const color = new Float32Array(n * 3);
    const hi = new Float32Array(n);
    const terr = new Float32Array(n);

    // a stable index per region, so the shader can test a bitmask
    this.territoryIndex = {};
    Object.keys(doc.territories || {}).forEach((t, i) => {
      this.territoryIndex[t] = i;
    });

    let maxDeg = 1;
    for (const w of words) maxDeg = Math.max(maxDeg, w[5] || 0);
    const logMax = Math.log1p(maxDeg);

    for (let i = 0; i < n; i++) {
      const [word, code, era, x, z, deg] = words[i];
      this.pos[i * 3] = x;
      this.pos[i * 3 + 1] = -era * eraDepth;
      this.pos[i * 3 + 2] = z;
      this.era[i] = era;
      this.weight[i] = Math.log1p(deg || 0) / logMax;
      const c = palette.colorFor(code, era);
      color[i * 3] = c[0]; color[i * 3 + 1] = c[1]; color[i * 3 + 2] = c[2];
      terr[i] = this.territoryIndex[palette.territoryOf(code)] || 0;
    }

    // ---- dots ----------------------------------------------------------
    const dg = new THREE.BufferGeometry();
    dg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    dg.setAttribute('aPos', new THREE.BufferAttribute(this.pos, 3));
    dg.setAttribute('aColor', new THREE.BufferAttribute(color, 3));
    dg.setAttribute('aEra', new THREE.BufferAttribute(this.era, 1));
    dg.setAttribute('aWeight', new THREE.BufferAttribute(this.weight, 1));
    dg.setAttribute('aHi', new THREE.BufferAttribute(hi, 1));
    dg.setAttribute('aTerr', new THREE.BufferAttribute(terr, 1));
    this.hiAttr = dg.getAttribute('aHi');
    this.dotGeo = dg;
    this.dotMat = new THREE.ShaderMaterial({
      vertexShader: DOT_VERT, fragmentShader: DOT_FRAG,
      uniforms: {
        uTime: { value: 0 }, uFade: { value: 0 }, uDot: { value: dot },
        uWaveScale: { value: new THREE.Vector2(waveScale, waveScale * 0.7) },
        uPixelRatio: { value: Math.min(devicePixelRatio, 2) },
        uProj: { value: 800 },
        uEraFocus: { value: -1 },
        uEraDim: { value: 0.12 },
        uEraMix: { value: 0 },
        uTerrMask: { value: 0 },
        uTerrDim: { value: 0.42 },
        uTerrMix: { value: 0 },
      },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.dots = new THREE.Points(dg, this.dotMat);
    this.dots.frustumCulled = false;

    // ---- labels (a small, changing subset) -----------------------------
    const M = maxLabels;
    const lg = new THREE.InstancedBufferGeometry();
    lg.setAttribute('position', new THREE.Float32BufferAttribute(
      [-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3));
    lg.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
    lg.setIndex([0, 1, 2, 0, 2, 3]);
    lg.instanceCount = 0;
    lg.setAttribute('aPos', new THREE.InstancedBufferAttribute(new Float32Array(M * 3), 3));
    lg.setAttribute('aRect', new THREE.InstancedBufferAttribute(new Float32Array(M * 4), 4));
    lg.setAttribute('aColor', new THREE.InstancedBufferAttribute(new Float32Array(M * 3), 3));
    lg.setAttribute('aAspect', new THREE.InstancedBufferAttribute(new Float32Array(M), 1));
    lg.setAttribute('aAlpha', new THREE.InstancedBufferAttribute(new Float32Array(M), 1));
    this.labelGeo = lg;
    this.labelMat = new THREE.ShaderMaterial({
      vertexShader: LABEL_VERT, fragmentShader: LABEL_FRAG,
      uniforms: {
        uAtlas: { value: atlas.texture }, uTime: { value: 0 },
        uSize: { value: labelSize }, uFade: { value: 0 },
        uWaveScale: { value: this.dotMat.uniforms.uWaveScale.value },
      },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    this.labels = new THREE.Mesh(lg, this.labelMat);
    this.labels.frustumCulled = false;

    this.group = new THREE.Group();
    this.group.add(this.dots);
    this.group.add(this.labels);

    // Prominence order: the most connected words are the ones a chart names.
    this.byWeight = Array.from({ length: n }, (_, i) => i)
      .sort((a, b) => this.weight[b] - this.weight[a]);

    // The same order, split by region, so the piece can wander evenly over the
    // map instead of always landing in the largest language.
    this.byTerritory = {};
    for (const i of this.byWeight) {
      const t = palette.territoryOf(words[i][1]);
      (this.byTerritory[t] || (this.byTerritory[t] = [])).push(i);
    }

    this._labels = [];
    this._v = new THREE.Vector3();
    this._screen = new Float32Array(n * 3);   // x, y, depth
    this._screenAge = -1;
  }

  wordAt(i) { return this.words[i]; }

  // Focus changes are *requests*; updateFocus eases toward them. Switching
  // directly from one era to another ramps down through zero first, so the
  // change is a dissolve rather than a jump between two lit layers.
  setEraFocus(era) {
    const want = (era === undefined || era === null) ? -1 : era;
    if (want === this.eraWant) return;
    this.eraWant = want;
    this.eraFocus = want;                 // picking follows immediately
  }

  setTerritoryFocus(territories) {
    let mask = 0;
    for (const t of territories || []) {
      const i = this.territoryIndex[t];
      if (i !== undefined) mask += Math.pow(2, i);
    }
    this.terrWant = mask;
    this.terrFocus = territories || [];
  }

  updateFocus(dt) {
    const u = this.dotMat.uniforms;
    // About 0.8 s of time constant, so a little over two seconds end to end.
    // The first attempt used 0.004 here, which is a 0.19 s ramp -- technically
    // eased and still read as a flash.
    const k = 1 - Math.pow(0.3, dt);

    if (this.eraWant === undefined) this.eraWant = -1;
    const eraTargetOn = this.eraWant >= 0;
    // Switching straight from one layer to another dips through a low mix
    // before swapping, so it dissolves; waiting for a true zero would take
    // twice as long for no more effect.
    if (u.uEraFocus.value !== this.eraWant && u.uEraMix.value > 0.2) {
      u.uEraMix.value += (0 - u.uEraMix.value) * k;      // fade the old out
    } else {
      u.uEraFocus.value = this.eraWant;
      u.uEraMix.value += ((eraTargetOn ? 1 : 0) - u.uEraMix.value) * k;
    }

    if (this.terrWant === undefined) this.terrWant = 0;
    const terrTargetOn = this.terrWant > 0;
    if (u.uTerrMask.value !== this.terrWant && u.uTerrMix.value > 0.2) {
      u.uTerrMix.value += (0 - u.uTerrMix.value) * k;
    } else {
      u.uTerrMask.value = this.terrWant;
      u.uTerrMix.value += ((terrTargetOn ? 1 : 0) - u.uTerrMix.value) * k;
    }
  }



  eraY(era) { return -era * this.eraDepth; }

  // Where a word actually sits, so a lineage can rise out of its own territory.
  homeOf(code) {
    const t = this.palette.territoryOf(code);
    const home = this.doc.territories && this.doc.territories[t];
    return home ? { x: home.x, z: home.z, r: home.r } : { x: 0, z: 0, r: 1200 };
  }

  // ---- screen projection, shared by picking and by label choice --------
  project(camera, w, h, frame) {
    if (this._screenAge === frame) return;
    this._screenAge = frame;
    const m = new THREE.Matrix4().multiplyMatrices(
      camera.projectionMatrix, camera.matrixWorldInverse);
    const e = m.elements;
    const s = this._screen;
    const p = this.pos;
    const hw = w * 0.5, hh = h * 0.5;
    const t = this.time;
    for (let i = 0; i < this.count; i++) {
      const x = p[i * 3], z = p[i * 3 + 2];
      const wx = Math.sin((x / 185 + t) * 0.3);
      const wy = Math.sin((z / 129.5 + t) * 0.5);
      const y = p[i * 3 + 1] + (wx * 50 + wy * 50) * 0.5;
      const cw = e[3] * x + e[7] * y + e[11] * z + e[15];
      if (cw <= 0.0001) { s[i * 3 + 2] = -1; continue; }
      const cx = e[0] * x + e[4] * y + e[8] * z + e[12];
      const cy = e[1] * x + e[5] * y + e[9] * z + e[13];
      s[i * 3] = (cx / cw) * hw + hw;
      s[i * 3 + 1] = -(cy / cw) * hh + hh;
      s[i * 3 + 2] = cw;
    }
  }

  // Nearest word to a screen point, or -1.
  //
  // Dots are a few pixels across, so aiming at one was needlessly hard. Two
  // things fix it: the labels are hit targets in their own right -- if a word
  // is named on the chart, its text is what the eye is aiming at, and it sits
  // above the dot rather than on it -- and the dot radius scales with how
  // close the word is, since near dots are drawn bigger.
  pick(mx, my, radius = 34) {
    // labels first: they are what you can actually see and read
    let best = -1, bestScore = Infinity;
    for (const L of this._labels) {
      if (mx < L.x0 || mx > L.x1 || my < L.y0 || my > L.y1) continue;
      const cx = (L.x0 + L.x1) * 0.5, cy = (L.y0 + L.y1) * 0.5;
      const score = Math.hypot(mx - cx, my - cy) * 0.35;   // labels win ties
      if (score < bestScore) { bestScore = score; best = L.i; }
    }
    if (best >= 0) return best;

    const s = this._screen;
    for (let i = 0; i < this.count; i++) {
      const d = s[i * 3 + 2];
      if (d <= 0) continue;
      // while a layer is being read, the dimmed layers are not targets --
      // hovering a faint word from another era while standing on the
      // reconstructed floor was just confusing
      if (this.eraFocus >= 0 && Math.abs(this.era[i] - this.eraFocus) > 0.5) continue;
      const dx = s[i * 3] - mx, dy = s[i * 3 + 1] - my;
      const dd = Math.sqrt(dx * dx + dy * dy);
      // a nearer word is drawn larger, so it deserves a larger catchment
      const r = radius * (0.55 + 0.45 * (1 - Math.min(1, d / 6000)));
      if (dd > r) continue;
      const score = dd + d * 0.004;      // break ties toward the closer word
      if (score < bestScore) { bestScore = score; best = i; }
    }
    return best;
  }

  setHover(i) {
    if (i === this.hover) return;
    if (this.hover >= 0) this.hiAttr.setX(this.hover, 0);
    this.hover = i;
    if (i >= 0) this.hiAttr.setX(i, 1);
    this.hiAttr.needsUpdate = true;
  }

  // ---- choose which words get named -----------------------------------
  // Prominent words first, then anything the cursor is on, rejected if it
  // would collide with a label already placed. A chart names what it has room
  // for; this is the same rule.
  chooseLabels(w, h) {
    const s = this._screen;
    const geo = this.labelGeo;
    const aPos = geo.getAttribute('aPos');
    const aRect = geo.getAttribute('aRect');
    const aColor = geo.getAttribute('aColor');
    const aAspect = geo.getAttribute('aAspect');
    const aAlpha = geo.getAttribute('aAlpha');

    const placed = [];
    this._labels.length = 0;
    let k = 0;
    const tryPlace = (i, alphaBoost) => {
      if (k >= this.maxLabels) return;
      const d = s[i * 3 + 2];
      if (d <= 0) return;
      const x = s[i * 3], y = s[i * 3 + 1];
      if (x < -80 || y < -40 || x > w + 80 || y > h + 40) return;
      if (d > 6200) return;
      for (let j = 0; j < placed.length; j++) {
        if (Math.abs(placed[j][0] - x) < 130 && Math.abs(placed[j][1] - y) < 30) return;
      }
      const entry = this.words[i];
      const cell = this.atlas.claim(entry[0]);
      if (!cell) return;
      placed.push([x, y]);
      // remember where the text lands, so it can be clicked
      const halfW = Math.max(34, cell.aspect * 26);
      this._labels.push({ i, x0: x - halfW, x1: x + halfW,
                          y0: y - 34, y1: y - 2 });

      aPos.setXYZ(k, this.pos[i * 3], this.pos[i * 3 + 1], this.pos[i * 3 + 2]);
      aRect.setXYZW(k, cell.rect[0], cell.rect[1], cell.rect[2], cell.rect[3]);
      const c = this.palette.colorFor(entry[1], Math.max(0, entry[2] - 1.2));
      aColor.setXYZ(k, c[0], c[1], c[2]);
      aAspect.setX(k, cell.aspect);
      // near labels are brighter; the far ones fade into the chart
      const near = 1.0 - Math.min(1, d / 6200);
      aAlpha.setX(k, Math.min(1, (0.40 + near * 0.85) * alphaBoost));
      k++;
    };

    if (this.showLabels !== false) {
      if (this.hover >= 0) tryPlace(this.hover, 1.6);
      for (const i of this.byWeight) {
        if (k >= this.maxLabels) break;
        // a focused layer names only its own words
        if (this.eraFocus >= 0 && Math.abs(this.era[i] - this.eraFocus) > 0.5) continue;
        tryPlace(i, 1.0);
      }
    }

    this.atlas.commit();
    geo.instanceCount = k;
    for (const a of [aPos, aRect, aColor, aAspect, aAlpha]) a.needsUpdate = true;
  }

  update(dt, fade, camera, w, h, frame) {
    this.updateFocus(dt);
    this.time += dt * 6.0;                    // the original's count += 0.1
    this.dotMat.uniforms.uTime.value = this.time;
    this.dotMat.uniforms.uFade.value = fade;
    this.labelMat.uniforms.uTime.value = this.time;
    this.labelMat.uniforms.uFade.value = fade;
    if (camera) {
      this.project(camera, w, h, frame);
      this.chooseLabels(w, h);
    }
  }

  dispose() {
    this.dotGeo.dispose(); this.dotMat.dispose();
    this.labelGeo.dispose(); this.labelMat.dispose();
  }
}
