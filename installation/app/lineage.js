// Etymon — the lineage that stands up out of the water.
//
// This is the node-link graph the 2018 project proposed, and the thing the
// original cytoscape.js view was trying to be before the layout engine and the
// per-session random colours made it unreadable. Here it is not a diagram laid
// over the piece; it is the same water, briefly organised.
//
// A lineage is placed so that every word sits at the depth of its own era --
// the same strata the ocean uses -- so "text" hangs near the surface, Latin
// texere is well under, and Proto-Indo-European *teks- is down on the floor.
// The chain therefore reads as a dive. Then the words rotate from lying flat
// in the water to facing the room (uStand), which is what makes surfacing
// legible as an event rather than just a brightening.
//
// Three registers, three lights:
//
//   attested    steady filament
//   conjecture  a travelling pulse along the edge, node ringed
//   dream       hue drifting off its language's colour, rising, evaporating

import * as THREE from '../vendor/three.module.js';
import { ATTESTED, CONJECTURE, DREAM, BACKGROUND } from './palette.js';

// The corpus distinguishes five kinds of relation and the generated registers
// add a sixth. They are not interchangeable -- "waterage" is built out of
// "water", "colour" is the same word as "color", and Sanskrit "pitar" is
// neither an ancestor nor a descendant of Latin "pater" -- so each gets its
// own line, and the frag shader below draws six distinct filaments.
const REL_DESCENDS = 0, REL_CONJECTURE = 1, REL_COGNATE = 2, REL_DREAM = 3,
      REL_DERIVED = 4, REL_VARIANT = 5;
export const RELATIONS = {
  descends: REL_DESCENDS, conjecture: REL_CONJECTURE, cognate: REL_COGNATE,
  dream: REL_DREAM, derived: REL_DERIVED, variant: REL_VARIANT,
};

const NODE_VERT = /* glsl */`
  precision highp float;
  attribute vec3  aPos;
  attribute vec4  aRect;
  attribute vec3  aColor;
  attribute float aKind;
  attribute float aSeed;
  attribute float aAspect;
  attribute float aFam;   // 0 = the chain itself, 1 = a relative of it

  uniform float uTime;
  uniform float uSize;
  uniform float uStand;   // 0 = lying in the water, 1 = facing the room
  uniform float uFade;
  uniform float uProj;    // viewportHeight / (2 tan(fov/2)), in pixels

  varying vec2  vUv;
  varying vec3  vColor;
  varying float vAlpha;
  varying float vKind;

  void main() {
    vec3 p = aPos;

    // a dream is not moored: it lifts and thins out
    float dreamT = step(1.5, aKind);
    p.y += dreamT * (18.0 + 26.0 * sin(uTime * 0.55 + aSeed * 6.2));

    // everything breathes a little, so nothing looks like a chart
    p.y += sin(uTime * 0.7 + aSeed * 9.0) * 3.2;

    // Size the word in screen space, not world space. A chain that runs from
    // English to Sumerian is 5,000 units wide and the camera has to stand well
    // back to frame it; at a fixed world size the words became unreadable
    // specks exactly when the chain was most interesting.
    vec4 mv = viewMatrix * modelMatrix * vec4(p, 1.0);
    // The family is read second. Drawing it smaller as well as dimmer is
    // what keeps a Latin root's twenty-four formations from burying the four
    // words the visitor actually asked about.
    float scale = uSize * clamp(-mv.z / max(uProj, 1.0), 0.6, 7.0)
                * mix(1.0, 0.62, aFam);
    // flat in the water ...
    vec3 flat3 = vec3(position.x * scale * aAspect, 0.0, position.y * scale);
    // ... or turned to face the camera
    vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
    vec3 up    = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
    vec3 face3 = right * (position.x * scale * aAspect) + up * (position.y * scale);

    vec3 local = mix(flat3, face3, uStand);
    vec4 world = modelMatrix * vec4(p + local, 1.0);

    vUv = aRect.xy + vec2(uv.x * aRect.z, (1.0 - uv.y) * aRect.w);
    vColor = aColor;
    vKind = aKind;

    float a = uFade * 1.35 * mix(1.0, 0.58, aFam);
    // conjecture breathes; dream flickers and is always fainter
    a *= mix(1.0, 0.74 + 0.26 * sin(uTime * 2.1 + aSeed), step(0.5, aKind) * (1.0 - dreamT));
    a *= mix(1.0, 0.50 + 0.30 * sin(uTime * 3.3 + aSeed * 3.0), dreamT);

    vAlpha = a;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const NODE_FRAG = /* glsl */`
  precision highp float;
  uniform sampler2D uAtlas;
  uniform float uTime;
  varying vec2  vUv;
  varying vec3  vColor;
  varying float vAlpha;
  varying float vKind;

  void main() {
    float ink = texture2D(uAtlas, vUv).a;
    if (ink < 0.004) discard;
    vec3 c = vColor;

    // a dreamed word will not hold its colour still
    if (vKind > 1.5) {
      float h = sin(uTime * 0.9 + vUv.x * 8.0) * 0.5 + 0.5;
      c = mix(c, c.gbr, h * 0.65);
      c += 0.10 * h;
    }
    gl_FragColor = vec4(c * ink * vAlpha, ink * vAlpha);
  }
`;

const EDGE_VERT = /* glsl */`
  precision highp float;
  attribute float aRel;
  attribute float aT;      // 0..1 along the edge
  attribute float aSeed;
  attribute vec3  aColor;

  uniform float uTime;
  uniform float uFade;
  uniform float uGrow;     // filaments draw themselves in

  varying vec3  vColor;
  varying float vAlpha;
  varying float vRel;
  varying float vT;

  void main() {
    vColor = aColor;
    vRel = aRel;
    vT = aT;
    // a soft edge to the growth front rather than a hard cut
    float a = uFade * smoothstep(uGrow + 0.06, uGrow - 0.02, aT);
    vAlpha = a;
    gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
  }
`;

const EDGE_FRAG = /* glsl */`
  precision highp float;
  uniform float uTime;
  varying vec3  vColor;
  varying float vAlpha;
  varying float vRel;
  varying float vT;

  void main() {
    float a = vAlpha;
    vec3 c = vColor;
    float rel = floor(vRel + 0.5);

    if (rel < 0.5) {                        // descent — solid, the spine
      a *= 0.88;
    } else if (rel < 1.5) {                 // conjecture — a pulse climbs it
      float pulse = fract(vT * 2.0 - uTime * 0.42);
      a *= 0.24 + 0.76 * smoothstep(0.86, 1.0, pulse);
    } else if (rel < 2.5) {                 // cognate — dotted, sideways
      a *= 0.42 * step(0.45, fract(vT * 34.0));
    } else if (rel < 3.5) {                 // dream — shimmers, hue drifts
      a *= 0.30 + 0.26 * sin(uTime * 3.0 + vT * 22.0);
      c = mix(c, c.gbr, 0.5);
    } else if (rel < 4.5) {                 // derived — a fine dashed line
      // Morphology, not descent, and by far the commonest relation in the
      // corpus, so it has to read as secondary at a glance or it swamps the
      // spine it hangs off: finer dashes, dimmer, and no motion.
      a *= 0.40 * step(0.62, fract(vT * 64.0));
    } else {                                // variant — the same word, twice
      // Two spellings of one word: a doubled hairline, barely there.
      a *= 0.30 * step(0.80, fract(vT * 96.0));
      c = mix(c, vec3(1.0), 0.35);
    }
    gl_FragColor = vec4(c * a, a);
  }
`;

export class LineageStage {
  constructor({ atlas, palette, doc, ocean, size = 62 }) {
    this.atlas = atlas;
    this.palette = palette;
    this.doc = doc;
    this.ocean = ocean;
    this.size = size;
    this.time = 0;
    this.active = null;

    this.group = new THREE.Group();

    // --- nodes ---------------------------------------------------------
    // 96 was enough for a chain of ancestors and nothing else. A word's
    // neighbourhood -- children, cognates, formations, variants, fetched from
    // data/index/nbr -- routinely runs to a couple of hundred words, and the
    // point of looking a word up is to see them.
    this.MAX_NODES = 340;
    const ng = new THREE.InstancedBufferGeometry();
    ng.setAttribute('position', new THREE.Float32BufferAttribute(
      [-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3));
    ng.setAttribute('uv', new THREE.Float32BufferAttribute(
      [0, 0, 1, 0, 1, 1, 0, 1], 2));
    ng.setIndex([0, 1, 2, 0, 2, 3]);
    ng.instanceCount = 0;
    const N = this.MAX_NODES;
    ng.setAttribute('aPos', new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3));
    ng.setAttribute('aRect', new THREE.InstancedBufferAttribute(new Float32Array(N * 4), 4));
    ng.setAttribute('aColor', new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3));
    ng.setAttribute('aKind', new THREE.InstancedBufferAttribute(new Float32Array(N), 1));
    ng.setAttribute('aSeed', new THREE.InstancedBufferAttribute(new Float32Array(N), 1));
    ng.setAttribute('aAspect', new THREE.InstancedBufferAttribute(new Float32Array(N), 1));
    ng.setAttribute('aFam', new THREE.InstancedBufferAttribute(new Float32Array(N), 1));
    this.nodeGeo = ng;
    this.nodeMat = new THREE.ShaderMaterial({
      vertexShader: NODE_VERT, fragmentShader: NODE_FRAG,
      uniforms: {
        uAtlas: { value: atlas.texture },
        uTime: { value: 0 }, uSize: { value: size },
        uStand: { value: 0 }, uFade: { value: 0 },
        uProj: { value: 800 },
      },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      // uStand rotates these from flat-in-the-water to facing the room, so
      // they are seen from both sides over the course of a rise.
      side: THREE.DoubleSide,
    });
    this.nodeMesh = new THREE.Mesh(ng, this.nodeMat);
    this.nodeMesh.frustumCulled = false;
    this.group.add(this.nodeMesh);

    // --- edges ---------------------------------------------------------
    this.MAX_EDGES = 1200;
    const eg = new THREE.BufferGeometry();
    eg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.MAX_EDGES * 2 * 3), 3));
    eg.setAttribute('aColor', new THREE.BufferAttribute(new Float32Array(this.MAX_EDGES * 2 * 3), 3));
    eg.setAttribute('aRel', new THREE.BufferAttribute(new Float32Array(this.MAX_EDGES * 2), 1));
    eg.setAttribute('aT', new THREE.BufferAttribute(new Float32Array(this.MAX_EDGES * 2), 1));
    eg.setAttribute('aSeed', new THREE.BufferAttribute(new Float32Array(this.MAX_EDGES * 2), 1));
    eg.setDrawRange(0, 0);
    this.edgeGeo = eg;
    this.edgeMat = new THREE.ShaderMaterial({
      vertexShader: EDGE_VERT, fragmentShader: EDGE_FRAG,
      uniforms: { uTime: { value: 0 }, uFade: { value: 0 }, uGrow: { value: 0 } },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.edgeMesh = new THREE.LineSegments(eg, this.edgeMat);
    this.edgeMesh.frustumCulled = false;
    this.group.add(this.edgeMesh);
  }

  // Lay a lineage out on the map.
  //
  // This used to be a column: every node stacked at the seed's own region,
  // spread sideways by era. It was legible but it was a lie -- an English
  // word's Old Norse ancestor was drawn in the middle of the English words,
  // and the chain said nothing about where those languages sit. Since the
  // chart's whole claim is that position means something, the graph has to
  // obey it.
  //
  // Each node now stands over its own language: at the coordinates
  // pipeline/cartography.py computed for it, at the depth of its era. So a
  // borrowing is a long filament between two islands, descent within a family
  // is a short steep one, and the shape of a chain tells you which it was.
  layout(lineage) {
    const doc = this.doc;
    const nodes = doc.nodes;
    const pos = new Map();
    const members = new Set(lineage.nodes);

    // where each language sits on the chart
    const homeOf = (code) => {
      const lang = doc.languages[code];
      if (lang && lang.pos) return { x: lang.pos[0], z: lang.pos[1] };
      const t = this.ocean.homeOf(code);
      return { x: t.x, z: t.z };
    };

    // The spine: the chain of ancestors, one word per step, each at its own
    // language's place on the chart. Successive words of one language fan
    // around its centroid -- two Latin steps in a chain share a home, and at
    // the standoff a cross-map chain needs, 120 units is a few pixels.
    const spine = lineage.paths[0] || [];
    const isSpine = new Set(spine);
    const perLang = new Map();
    for (const id of spine) {
      if (!members.has(id) || pos.has(id)) continue;
      const [, code, era] = nodes[id];
      const home = homeOf(code);
      const n = perLang.get(code) || 0;
      perLang.set(code, n + 1);
      const a = n * 2.39996;                       // golden angle
      const r = n === 0 ? 0 : 340 + 210 * Math.sqrt(n);
      pos.set(id, {
        x: home.x + Math.cos(a) * r,
        y: this.ocean.eraY(era) + 60,
        z: home.z + Math.sin(a) * r,
      });
    }

    // The family hangs off whichever spine word it is related to, not off the
    // centroid of its language. Almost every relative of an English word is
    // also English, so placing them by language piled sixty-five words onto
    // one spot and drew them as a single white smear. Around their anchor
    // they read as what they are: a crowd standing near one word.
    //
    // Height still comes from each word's own era, so a family reaching back
    // into Old English visibly hangs below one that does not.
    const anchorOf = new Map();
    for (const [a, b] of doc.edges) {
      if (!members.has(a) || !members.has(b)) continue;
      if (isSpine.has(a) && !isSpine.has(b) && !anchorOf.has(b)) anchorOf.set(b, a);
      if (isSpine.has(b) && !isSpine.has(a) && !anchorOf.has(a)) anchorOf.set(a, b);
    }
    const perAnchor = new Map();
    const rest = [...members].filter((id) => !pos.has(id));
    for (const id of rest) {
      const [, code, era] = nodes[id];
      const anchor = anchorOf.get(id);
      const base = anchor !== undefined && pos.has(anchor)
        ? pos.get(anchor) : homeOf(code);
      const key = anchor !== undefined ? `a${anchor}` : `l${code}`;
      const n = perAnchor.get(key) || 0;
      perAnchor.set(key, n + 1);
      // Spacing is set by how wide these words are drawn rather than by
      // taste: at 0.62 of the spine's size a word still covers hundreds of
      // units at a reading distance, so the first ring stands well off.
      const a = 1.1 + n * 2.39996;
      const r = 1150 + 460 * Math.sqrt(n);
      pos.set(id, {
        x: base.x + Math.cos(a) * r,
        y: this.ocean.eraY(era) + 60,
        z: base.z + Math.sin(a) * r,
      });
    }
    this._family = new Set(rest);

    const edges = [];
    for (const [a, b, rel] of doc.edges) {
      if (pos.has(a) && pos.has(b)) edges.push([a, b, rel]);
    }
    return { pos, edges };
  }

  // The box the raised chain occupies, so the camera can frame all of it.
  bounds() {
    if (!this.pickable || !this.pickable.length) return null;
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity,
        z0 = Infinity, z1 = -Infinity;
    for (const p of this.pickable) {
      x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x);
      y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y);
      z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z);
    }
    return {
      cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, cz: (z0 + z1) / 2,
      w: x1 - x0, h: y1 - y0, d: z1 - z0,
      span: Math.max(x1 - x0, y1 - y0, z1 - z0),
    };
  }

  // Raise a lineage: place every word over its own language, wire the edges,
  // and remember where each node landed so it can be hovered and clicked.
  show(lineage) {
    const { pos, edges } = this.layout(lineage);
    const doc = this.doc;
    const ids = [...pos.keys()].slice(0, this.MAX_NODES);

    // The reading atlas holds a few hundred cells and a word's family is a
    // few hundred words, so it fills. A full atlas returns null from claim()
    // and the loop below drops the word -- which is how a lineage of 46
    // words came to be drawn as 14. Clear it and start the shelf over: this
    // view is about to re-claim everything it needs anyway.
    if (this.atlas.full) this.atlas.reset();

    const aPos = this.nodeGeo.getAttribute('aPos');
    const aRect = this.nodeGeo.getAttribute('aRect');
    const aColor = this.nodeGeo.getAttribute('aColor');
    const aKind = this.nodeGeo.getAttribute('aKind');
    const aSeed = this.nodeGeo.getAttribute('aSeed');
    const aAspect = this.nodeGeo.getAttribute('aAspect');
    const aFam = this.nodeGeo.getAttribute('aFam');

    let n = 0;
    const slotOf = new Map();
    for (const id of ids) {
      const [word, code, era, kind] = doc.nodes[id];
      const cell = this.atlas.claim(word);
      if (!cell) continue;
      const p = pos.get(id);
      aPos.setXYZ(n, p.x, p.y, p.z);
      aRect.setXYZW(n, cell.rect[0], cell.rect[1], cell.rect[2], cell.rect[3]);
      // lineage words are lit brighter than the chart: they are being read
      const c = this.palette.colorFor(code, Math.max(0, era - 1.4));
      aColor.setXYZ(n, c[0], c[1], c[2]);
      aKind.setX(n, kind);
      aSeed.setX(n, Math.random() * 30);
      aAspect.setX(n, cell.aspect);
      aFam.setX(n, this._family && this._family.has(id) ? 1 : 0);
      slotOf.set(id, n);
      n++;
    }
    this.atlas.commit();
    this.nodeGeo.instanceCount = n;
    for (const a of [aPos, aRect, aColor, aKind, aSeed, aAspect, aFam]) {
      a.needsUpdate = true;
    }

    // edges
    let yTop = -Infinity, yBot = Infinity;
    for (const p of pos.values()) {
      if (p.y > yTop) yTop = p.y;
      if (p.y < yBot) yBot = p.y;
    }
    const ySpan = Math.max(yTop - yBot, 1);
    const along = (y) => (yTop - y) / ySpan;

    const ep = this.edgeGeo.getAttribute('position');
    const ec = this.edgeGeo.getAttribute('aColor');
    const er = this.edgeGeo.getAttribute('aRel');
    const et = this.edgeGeo.getAttribute('aT');
    const es = this.edgeGeo.getAttribute('aSeed');
    let e = 0;
    for (const [a, b, rel] of edges) {
      if (e >= this.MAX_EDGES) break;
      if (!slotOf.has(a) || !slotOf.has(b)) continue;
      const pa = pos.get(a), pb = pos.get(b);
      const [, codeA, eraA] = doc.nodes[a];
      const c = this.palette.colorFor(codeA, Math.max(0, eraA - 1.4));
      ep.setXYZ(e * 2, pa.x, pa.y, pa.z);
      ep.setXYZ(e * 2 + 1, pb.x, pb.y, pb.z);
      ec.setXYZ(e * 2, c[0], c[1], c[2]);
      ec.setXYZ(e * 2 + 1, c[0], c[1], c[2]);
      er.setX(e * 2, rel); er.setX(e * 2 + 1, rel);
      et.setX(e * 2, along(pa.y)); et.setX(e * 2 + 1, along(pb.y));
      const sd = Math.random() * 20;
      es.setX(e * 2, sd); es.setX(e * 2 + 1, sd);
      e++;
    }
    this.edgeGeo.setDrawRange(0, e * 2);
    for (const a of [ep, ec, er, et, es]) a.needsUpdate = true;

    // Node coordinates are absolute map positions, so the group itself never
    // moves. It used to be planted at the seed's region and everything drawn
    // relative to it.
    this.group.position.set(0, 0, 0);

    // Keep the raised nodes pickable. The chain standing in front of you is
    // the subject of the piece, and until now it was the one thing on screen
    // you could not click.
    this.pickable = [];
    for (const [id] of slotOf) {
      const p = pos.get(id);
      this.pickable.push({ id, x: p.x, y: p.y, z: p.z });
    }
    this._screen = new Float32Array(this.pickable.length * 3);

    this.active = { lineage, nodeCount: n, edgeCount: e, ids };
    return this.active;
  }

  // Materialise a chain from the search index as nodes and edges in doc,
  // without drawing anything. Split out from showChain so that a word's
  // neighbourhood can be fetched and folded in *before* the layout runs --
  // laying out a bare chain and then adding its family would reposition every
  // word on screen a beat after the camera had settled on it.
  // Mint (or reuse) a node for a word that came from an index rather than
  // from the composed score. Shared with the neighbourhood expansion so that
  // diving the same word twice does not push a second copy of its whole
  // family into doc.nodes -- over an unattended night that grew without
  // bound, and every layout scans doc.edges in full.
  idFor(word, lang, era, kind) {
    const doc = this.doc;
    if (!this._adhoc) this._adhoc = new Map();
    if (!this._base) this._base = { nodes: doc.nodes.length, edges: doc.edges.length };
    const key = `${lang}|${word}`;
    let id = this._adhoc.get(key);
    if (id === undefined) {
      id = doc.nodes.length;
      doc.nodes.push([word, lang, era || 0, kind || 0]);
      this._adhoc.set(key, id);
    }
    return id;
  }

  // Add an edge between two raised nodes, once. The set lives here rather
  // than in the neighbourhood index because it has to be dropped whenever
  // the ad-hoc pool is pruned below -- a stale set would silently swallow
  // edges that no longer exist.
  linkAdhoc(a, b, rel) {
    if (!this._links) this._links = new Set();
    const sig = `${a},${b},${rel}`;
    if (this._links.has(sig)) return false;
    this._links.add(sig);
    this.doc.edges.push([a, b, rel]);
    return true;
  }

  chainIds(chain) {
    const doc = this.doc;
    // A chain of one is legitimate: 465,881 words in the corpus take part in
    // relations without any recorded ancestor of their own. There is nothing
    // to climb, but there is a family to stand in, and refusing the whole
    // word because its origin is unknown is how Chinese 日 came to be
    // unlookuppable despite having eighty relations.
    if (!chain || !chain.length) return null;
    if (!this._adhoc) this._adhoc = new Map();
    // The ad-hoc pool grows for as long as the piece runs. An unattended
    // night is thousands of dives, and doc.edges is scanned in full by every
    // layout, so it is emptied back to the composed score when it gets big.
    if (this._base && doc.nodes.length - this._base.nodes > 6000) {
      doc.nodes.length = this._base.nodes;
      doc.edges.length = this._base.edges;
      this._adhoc = new Map();
      this._links = new Set();
    }
    if (!this._base) this._base = { nodes: doc.nodes.length, edges: doc.edges.length };

    const ids = chain.map((n) => {
      const key = `${n.lang}|${n.word}`;
      let id = this._adhoc.get(key);
      if (id === undefined) {
        id = doc.nodes.length;
        doc.nodes.push([n.word, n.lang, n.era, n.kind || 0]);
        if (n.gloss) doc.glosses[String(id)] = n.gloss;
        this._adhoc.set(key, id);
      }
      return id;
    });

    const kinds = [];
    const have = new Set(doc.edges.map((e) => `${e[0]},${e[1]},${e[2]}`));
    for (let i = 1; i < ids.length; i++) {
      const k = chain[i].kind === 1 ? REL_CONJECTURE : REL_DESCENDS;
      kinds.push(k);
      const sig = `${ids[i - 1]},${ids[i]},${k}`;
      if (!have.has(sig)) { doc.edges.push([ids[i - 1], ids[i], k]); have.add(sig); }
    }
    return { ids, kinds };
  }

  // `extra` is the neighbourhood: ids already pushed into doc by
  // Neighbours.expand, to be drawn alongside the spine rather than as it.
  showChain(chain, decorate, extra) {
    const built = this.chainIds(chain);
    if (!built) return null;
    // one word and no family is not a view; let the caller fall through
    if (chain.length < 2 && !(extra && extra.length)) return null;
    const { ids, kinds } = built;

    const lineage = {
      seed: ids[0],
      nodes: ids.concat(extra && extra.length ? extra : []),
      paths: [ids],
      kinds: [kinds],
      dreams: [],
      depth: Math.max(...chain.map((n) => n.era)),
      conjectured: chain.some((n) => n.kind === 1),
      adhoc: true,
      family: (extra && extra.length) || 0,
    };
    return this.show(decorate ? decorate(lineage) : lineage);
  }

  clear() {
    this.nodeGeo.instanceCount = 0;
    this.edgeGeo.setDrawRange(0, 0);
    this.active = null;
    this.pickable = [];
  }

  // Find a raised node by word and language, so the view can be sent to it.
  findNode(word, lang) {
    if (!this.pickable) return -1;
    for (const p of this.pickable) {
      const n = this.doc.nodes[p.id];
      if (n[0] === word && (!lang || n[1] === lang)) return p.id;
    }
    return -1;
  }

  nodeWorld(id) {
    for (const p of this.pickable || []) {
      if (p.id === id) return { x: p.x, y: p.y, z: p.z };
    }
    return null;
  }

  // Project the raised nodes, in the group's own space.
  project(camera, w, h) {
    if (!this.pickable || !this.pickable.length) return;
    const m = new THREE.Matrix4()
      .multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
      .multiply(this.group.matrixWorld);
    const e = m.elements;
    const s = this._screen;
    const hw = w * 0.5, hh = h * 0.5;
    for (let i = 0; i < this.pickable.length; i++) {
      const { x, y, z } = this.pickable[i];
      const cw = e[3] * x + e[7] * y + e[11] * z + e[15];
      if (cw <= 0.0001) { s[i * 3 + 2] = -1; continue; }
      s[i * 3] = ((e[0] * x + e[4] * y + e[8] * z + e[12]) / cw) * hw + hw;
      s[i * 3 + 1] = -((e[1] * x + e[5] * y + e[9] * z + e[13]) / cw) * hh + hh;
      s[i * 3 + 2] = cw;
    }
  }

  // Returns a node id from doc.nodes, or -1. The words are large and set
  // apart, so the catchment can be generous.
  pick(mx, my, radius = 70) {
    if (!this.pickable || !this.pickable.length) return -1;
    const s = this._screen;
    let best = -1, bestD = radius;
    for (let i = 0; i < this.pickable.length; i++) {
      if (s[i * 3 + 2] <= 0) continue;
      const d = Math.hypot(s[i * 3] - mx, s[i * 3 + 1] - my);
      if (d < bestD) { bestD = d; best = this.pickable[i].id; }
    }
    return best;
  }

  update(dt, { fade, stand, grow }) {
    this.time += dt;
    this.nodeMat.uniforms.uTime.value = this.time;
    this.nodeMat.uniforms.uFade.value = fade;
    this.nodeMat.uniforms.uStand.value = stand;
    this.edgeMat.uniforms.uTime.value = this.time;
    this.edgeMat.uniforms.uFade.value = fade;
    this.edgeMat.uniforms.uGrow.value = grow;
  }

  dispose() {
    this.nodeGeo.dispose(); this.nodeMat.dispose();
    this.edgeGeo.dispose(); this.edgeMat.dispose();
  }
}
