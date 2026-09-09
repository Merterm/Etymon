// Etymøn — an ocean of words.
//
// A projected installation built on the 2018 Bilkent senior design project of
// the same name. The corpus and its interchange format are that project's; the
// sea is its landing-screen animation, repaired and made to mean something; the
// dreaming is its "hallucinate" button on a model that can hold a thought; and
// the search box, the Wiktionary panel, the "?" modal and the six-bar music
// toggle are all restored from it.
//
// Two modes, because the piece has to do two jobs:
//
//   ambient   a gallery. No cursor, no controls, the score running forever.
//   explore   the moment you move the mouse or press a key. The cursor returns,
//             words light under it, clicking opens a panel, search works, and
//             you can drag the map around. Idle for a while and it goes back.

import * as THREE from '../vendor/three.module.js';
import { Palette, BACKGROUND, TERRITORY } from './palette.js';
import { WordAtlas } from './atlas.js';
import { Ocean } from './ocean.js';
import { LineageStage } from './lineage.js';
import { Hud } from './hud.js';
import { Voice, buildIndex } from './voice.js';
import { Search, fold } from './search.js';
import { Neighbours } from './neighbours.js';

const T = {
  overture: 9,
  movement: 6.5,
  settle: 4.5,
  rise: 4.0,
  hold: 11.5,
  sink: 3.4,
};

const IDLE_TO_AMBIENT = 50;     // seconds of no input before the score resumes

// The opening. Each beat is [dwell in seconds, html, css class]. It plays over
// the chart, which is already drifting underneath, so the piece is never a
// blank screen waiting to start.
// [dwell in seconds, html, css class]. The dwell includes the 1.4 s fade out
// and 1.8 s fade in, so a 9 s beat is legible for about six of them.
const OVERTURE = [
  [8.5, 'ETYMØN', 'wordmark'],
  [6.5, 'an ocean of words', 'sub'],
  [8.5, 'Every word you use<br>is a salvaged older word.', 'line'],
  [10.5, 'This is a map of <b>3,161,104</b> connections<br>' +
         'between <b>2,970,656</b> words in <b>255</b> languages,<br>' +
         'assembled from four dictionaries.', 'line'],
  [10.5, 'Where a word lies is where its family lies.<br>' +
         'How deep it lies is how old it is.<br>' +
         'The floor is the reconstructed past.', 'line'],
  [11.0, 'Three kinds of light:<br>' +
         '<span class="et-c0">what the dictionaries record</span>,<br>' +
         '<span class="et-c1">what they lost and we put back</span>,<br>' +
         '<span class="et-c2">and what the machine invents</span>.', 'line'],
  [9.5, 'Watch it dive.<br>Or move the mouse and go looking yourself.', 'line'],
];

class Installation {
  constructor(doc, mount) {
    this.doc = doc;
    this.palette = new Palette(doc);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true, powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setClearColor(BACKGROUND, 1);
    mount.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(58, 1, 1, 40000);

    this.seaAtlas = new WordAtlas({ width: 4096, height: 2048, fontSize: 30 });
    // The atlas the raised words are drawn from. 2048x1024 at 54px held about
    // 120 cells, which was ample for a chain of five ancestors and nowhere
    // near enough for a word's family: the surplus was dropped in show()
    // without a word of complaint. Four times the area at a slightly smaller
    // face gives ~700, and it recycles when it fills.
    this.readAtlas = new WordAtlas({ width: 4096, height: 2048, fontSize: 44 });

    this.ocean = new Ocean({
      atlas: this.seaAtlas,
      palette: this.palette,
      doc,
      words: doc.ocean,
    });
    this.scene.add(this.ocean.group);

    this.stage = new LineageStage({
      atlas: this.readAtlas, palette: this.palette, doc, ocean: this.ocean,
    });
    this.scene.add(this.stage.group);

    // ---- camera rig ---------------------------------------------------
    // A survey of the chart: a target on the map, an orbit angle, a height.
    const ext = (doc.cartography && doc.cartography.extent) || 5200;
    this.extent = ext;
    // Close enough that a dot is a dot. Showing the whole chart at once needs
    // ~12,000 units of standoff, at which every word is a single pixel; the
    // survey works region by region instead.
    this.rig = { x: 0, z: 0, dist: 2600, yaw: 0.25, pitch: 0.42 };
    this.rigWant = Object.assign({}, this.rig);
    this.lookY = -260;
    // Where the camera is looking, as a standing choice rather than a
    // per-frame constant. Without this the idle branch pulled the view back to
    // the surface the instant a flight landed, so travelling to a deep layer
    // appeared to do nothing at all.
    this.lookTarget = -160;

    this.hud = new Hud(document.getElementById('hud'), doc, this.palette, {
      onSearch: (w) => this.dive(w),
      onJump: (w, lang) => this.jump(w, lang),
      onSuggest: (q) => this.suggest(q),
      onEra: (era) => this.goToEra(era),
      onExit: () => this.exitFocus(),
      onNudge: (act) => this.nudge(act),
      onSetting: (k, v) => this.applySetting(k, v),
      // "+1,247 more": ask the host to scan the master graph, if it has it.
      onMore: (head) => head
        ? this.neighbours.full(head.word, head.lang) : null,
    });

    this.search = new Search({ doc });
    this.search.init().then((ok) => { this.searchReady = ok; });

    // The neighbourhood index: everything the corpus records one hop from a
    // word, with the six relations kept apart. The search index alone gives a
    // single thread of ancestors, which is a true answer to a much smaller
    // question than the one a visitor is asking.
    this.neighbours = new Neighbours({ base: 'data/index/nbr', doc });
    this.neighbours.load().then((ok) => {
      this.familyReady = ok;
      if (!ok) console.info('[etymon] no neighbourhood index; showing chains only');
    });

    this.lookup = buildIndex(doc);
    this.voice = new Voice({
      languages: doc.languages,
      onWord: (w) => this.dive(w),
      onState: (s, heard) => {
        if (s === 'on') this.hud.listening(true, 'listening');
        else if (s === 'heard') this.hud.listening(true, heard);
        else this.hud.listening(false);
      },
    });

    this.live = { on: true, pending: false, added: 0, failures: 0 };

    // ---- score --------------------------------------------------------
    this.mi = 0; this.li = -1;
    this.phase = 'overture'; this.t = 0; this.beat = 0;
    this.oceanFade = 0; this.reading = 0;
    this.queued = null;
    this.follow = false;
    this.wandering = false;
    this.hud.showOverture(OVERTURE[0][1], OVERTURE[0][2]);
    this.hud.armAudio();

    this.mode = 'ambient';
    this.lastInput = -1e9;
    this.captions = true;
    this.stats = false;
    this.frameN = 0;
    this.mouse = { x: -1, y: -1, inside: false, down: false, moved: 0 };
    this.territoryScreen = new Map();

    this.eraFocus = -1;
    this.bindInput(mount);
    this.resize();
    addEventListener('resize', () => this.resize());

    this.clock = new THREE.Clock();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  resize() {
    this.w = innerWidth; this.h = innerHeight;
    this.renderer.setSize(this.w, this.h);
    this.camera.aspect = this.w / this.h;
    this.camera.updateProjectionMatrix();
    this.ocean.dotMat.uniforms.uPixelRatio.value =
      Math.min(devicePixelRatio, 2);
    const proj = this.h * 0.5 / Math.tan(this.camera.fov * Math.PI / 360);
    this.ocean.dotMat.uniforms.uProj.value = proj;
    this.stage.nodeMat.uniforms.uProj.value = proj;
  }

  // ---- modes -----------------------------------------------------------

  touch() {
    this.lastInput = this.clock ? this.clock.elapsedTime : 0;
    // The opening plays through. Switching to explore mid-overture used to
    // freeze it outright: the beat timer only advanced in ambient mode, so a
    // single click stopped the sequence and nothing ever happened again.
    if (this.phase === 'overture') return;
    if (this.mode !== 'explore') this.enterExplore();
  }

  enterExplore() {
    this.mode = 'explore';
    this.surveyAt = undefined;
    // Stop the survey dead. Otherwise the chart keeps drifting under the
    // cursor and you click a word next to the one you were pointing at.
    // A flight already in progress is left alone to finish.
    if (!this.flight) this.rigWant = Object.assign({}, this.rig);
    document.body.classList.add('exploring');
    this.hud.closeTitle();
    this.hud.hideMovement();
    this.hud.resumeAudioIfWanted();
  }

  enterAmbient() {
    this.mode = 'ambient';
    this.lastInput = -1e9;
    this.follow = false;
    this.surveyAt = undefined;
    this.anchor = null;
    document.body.classList.remove('exploring');
    this.hud.closeSearch();
    this.hud.closePanel();
    this.hud.closeHelp();
    this.hud.tip(null);
    this.ocean.setHover(-1);
    this.rigWant = { x: this.rig.x, z: this.rig.z, dist: 2600,
                     yaw: this.rig.yaw, pitch: 0.42 };
  }

  bindInput(mount) {
    const el = this.renderer.domElement;

    el.addEventListener('pointermove', (e) => {
      const dx = e.movementX || 0, dy = e.movementY || 0;
      this.mouse.x = e.clientX; this.mouse.y = e.clientY;
      this.mouse.inside = true;
      // A projector nudge shouldn't wake the piece; a real hand will.
      this.mouse.moved += Math.abs(dx) + Math.abs(dy);
      if (this.mouse.moved > 24) this.touch();

      if (this.mouse.down && this.mode === 'explore') {
        // drag pans across the chart, in the plane you are looking at
        this.follow = false;
        this.cancelFlight();
        this.anchor = null;
        this.dragged = (this.dragged || 0) + Math.abs(dx) + Math.abs(dy);
        const st = this.hud.settings || { speed: 1, invert: false };
        const k = this.rig.dist * 0.0016 * (st.speed || 1) * (st.invert ? -1 : 1);
        const cy = Math.cos(this.rig.yaw), sy = Math.sin(this.rig.yaw);
        this.rigWant.x -= (dx * cy - dy * sy) * k;
        this.rigWant.z -= (dx * sy + dy * cy) * k;
      }
    });

    el.addEventListener('pointerdown', (e) => {
      this.mouse.down = true; this.dragged = 0; this.touch();
      el.setPointerCapture(e.pointerId);
    });

    el.addEventListener('pointerup', (e) => {
      this.mouse.down = false;
      if (this.phase === 'overture') {
        // skip to the next line of the opening
        if (this.dragged < 6) this.t = this.duration();
        return;
      }
      if (this.mode === 'explore' && this.dragged < 6) this.clickAt(e.clientX, e.clientY);
    });

    el.addEventListener('pointerleave', () => {
      this.mouse.inside = false;
      this.ocean.setHover(-1);
      this.hud.tip(null);
    });

    el.addEventListener('wheel', (e) => {
      this.touch();
      e.preventDefault();
      this.follow = false;
      this.cancelFlight();
      this.anchor = null;
      const f = Math.exp(Math.sign(e.deltaY) * 0.12);
      this.rigWant.dist = Math.min(this.extent * 2.6,
                                   Math.max(600, this.rigWant.dist * f));
    }, { passive: false });

    addEventListener('keydown', (e) => this.onKey(e));
  }

  // ---- getting about ---------------------------------------------------

  // Travel to one of the five layers. Depth existed from the first version and
  // was unreachable: the camera only ever surveyed the surface, so the ancient
  // and reconstructed strata -- the whole point of stacking them -- could not
  // be visited.
  goToEra(era) {
    this.touch();
    this.follow = false;
    this.stage.clear();
    this.hud.hideLineage();
    this.hud.closePanel();
    this.eraFocus = era;
    this.ocean.setTerritoryFocus([]);
    this.ocean.setEraFocus(this.hud.settings && this.hud.settings.focus ? era : -1);
    const y = this.ocean.eraY(era);
    this.lookTarget = y;
    this.cancelFlight();
    this.flyTo({ x: this.rig.x, z: this.rig.z, dist: 2300,
                 pitch: 0.13, lookY: y }, 3.0);
    this.anchor = null;
  }

  // Back out to the whole chart.
  exitFocus() {
    this.touch();
    this.follow = false;
    this.stage.clear();
    this.hud.hideLineage();
    this.hud.closePanel();
    this.hud.closeSearch();
    this.eraFocus = -1;
    this.ocean.setEraFocus(-1);
    this.ocean.setTerritoryFocus([]);
    this.lookTarget = -420;
    this.cancelFlight();
    this.flyTo({ x: 0, z: 0, dist: this.extent * 1.15,
                 pitch: 0.52, lookY: -420 }, 3.4);
    this.anchor = null;
  }

  // One press of a movement control, from the pad or the keyboard.
  nudge(act, mult) {
    this.touch();
    this.follow = false;
    this.cancelFlight();
    const sp = (this.hud.settings ? this.hud.settings.speed : 1) * (mult || 1);
    const step = this.rig.dist * 0.06 * sp;
    const cy = Math.cos(this.rig.yaw), sy = Math.sin(this.rig.yaw);
    switch (act) {
      case 'up':    this.rigWant.x -= sy * step; this.rigWant.z -= cy * step; break;
      case 'down':  this.rigWant.x += sy * step; this.rigWant.z += cy * step; break;
      case 'left':  this.rigWant.x -= cy * step; this.rigWant.z += sy * step; break;
      case 'right': this.rigWant.x += cy * step; this.rigWant.z -= sy * step; break;
      case 'in':    this.rigWant.dist = Math.max(500, this.rigWant.dist * (1 - 0.09 * sp)); break;
      case 'out':   this.rigWant.dist = Math.min(this.extent * 2.6, this.rigWant.dist * (1 + 0.09 * sp)); break;
      case 'deeper':    this.goToEra(Math.min(4, (this.eraFocus < 0 ? 0 : this.eraFocus) + 1)); return;
      case 'shallower': this.goToEra(Math.max(0, (this.eraFocus < 0 ? 1 : this.eraFocus) - 1)); return;
      case 'home':  this.exitFocus(); return;
    }
    this.anchor = null;
  }

  applySetting(k, v) {
    if (k === 'focus') this.ocean.setEraFocus(v ? this.eraFocus : -1);
    if (k === 'labels') this.ocean.showLabels = v;
    if (k === 'captions') {
      this.captions = v;
      if (v && this.stage.active) this.hud.showLineage(this.stage.active.lineage);
    }
  }

  // ---- picking ---------------------------------------------------------

  async clickAt(mx, my) {
    // the chain in front is picked before the chart behind it
    const nid = this.stage.pick(mx, my);
    if (nid >= 0) {
      const [w, lang, era, kind] = this.doc.nodes[nid];
      this.follow = true;
      // A reconstructed or dreamed form is the end of its line -- there is
      // nothing under Proto-Indo-European to dive to, and an invented word has
      // no record at all. Opening the search box at someone who just clicked a
      // node would be a non-sequitur, so show what is known about it instead.
      const ok = await this.dive(w, { lang, quiet: true });
      if (!ok) {
        this.hud.showWord([{ word: w, lang, era, kind,
                             gloss: this.doc.glosses[String(nid)] || '' }],
                          { source: 'node' });
      }
      return;
    }
    const i = this.ocean.pick(mx, my, 34);
    if (i < 0) { this.hud.closePanel(); return; }
    const [word, code, era] = this.ocean.wordAt(i);
    // Clicking used to open the panel only. The 2018 loop was: click a node,
    // read it, jump to it -- so a click raises the word's graph too, and the
    // camera goes to it.
    this.follow = true;
    await this.dive(word, { lang: code, era });
  }

  // Click a word -> its chain, from the same local index search uses.
  async openWord(word, code, era) {
    let chain = null;
    if (this.searchReady) {
      const hits = await this.search.lookup(word);
      if (hits.length) {
        // prefer the sense in the language you actually clicked
        const best = hits.find((h) => h.chain[0].lang === code) || hits[0];
        chain = best.chain;
        this._lemmaOf = best.lemmaOf;
      }
    }
    if (!chain) {
      chain = [{ word, lang: code, era, kind: 0, gloss: '' }];
    }
    this.hud.showWord(chain, { source: 'click', lemmaOf: this._lemmaOf });
  }

  // ---- search ----------------------------------------------------------

  async suggest(q) {
    if (!q || q.length < 2) { this.hud.showSuggestions([]); return; }
    if (!this.searchReady) {
      this.hud.showSuggestions([], 'search index not built — run build.sh');
      return;
    }
    let list = await this.search.suggest(q, 8);
    if (!list.length) list = await this.search.nearest(q, 8);
    this.hud.showSuggestions(
      list, list.length ? '' : `nothing in the corpus matching “${q}”`);
  }

  // Raise a word: from the composed score if it is there, otherwise from the
  // local index, which covers 239,094 words.
  async dive(word, opts) {
    if (!word) return false;
    this.touch();
    this.hud.closeSearch();
    this.follow = true;

    const hit = this.lookup.find(word);
    if (hit) {
      this.mi = hit.movement; this.li = hit.lineage;
      const composed = this.doc.movements[this.mi].lineages[this.li];
      // The composed lineage is curated -- more paths, glosses, and the
      // conjecture and dream registers -- so it is preferred over re-querying
      // the generic index. But curated is not the same as complete: the
      // family comes from the corpus either way.
      const { lineage, summary } = await this.grown(composed);
      this.showLineage(lineage);
      this.hud.showWord(this.chainOf(composed),
                        { source: 'score', family: summary });
      return true;
    }

    if (this.searchReady) {
      const hits = await this.search.lookup(word);
      if (hits.length) {
        // if the click named a language, show that sense of the word
        const best = (opts && opts.lang &&
                      hits.find((h) => h.chain[0].lang === opts.lang)) || hits[0];
        // Fetch the family before the layout runs, so the camera frames the
        // whole thing once instead of settling on a bare chain and then
        // having every word move under it.
        const family = await this.family(best.chain);
        const active = this.stage.showChain(best.chain,
                                            (l) => this.attachDreams(l),
                                            family && family.added);
        if (active) {
          this.current = active;
          if (this.captions) this.hud.showLineage(active.lineage);
          this.markTerritories();
          this.phase = 'rise'; this.t = 0;
          this.flyToLineage();
          this.hud.showWord(best.chain,
                            { source: 'search', lemmaOf: best.lemmaOf,
                              family: family && family.summary });
          return true;
        }
      }
      // A word the index knows but could not raise: no ancestry, and no
      // family either. There is still an entry to show -- the word, its
      // language, and its Wiktionary page -- and showing it beats answering a
      // word that is plainly in the corpus with a list of near misses.
      if (hits.length) {
        const best = (opts && opts.lang &&
                      hits.find((h) => h.chain[0].lang === opts.lang)) || hits[0];
        this.hud.showWord(best.chain, { source: 'search',
                                        lemmaOf: best.lemmaOf });
        return true;
      }
      if (opts && opts.lang) {
        this.hud.showWord([{ word, lang: opts.lang, era: opts.era || 0,
                             kind: 0, gloss: '' }], { source: 'click' });
      }
    }
    if (opts && opts.quiet) return false;
    // Not found: offer the nearest things rather than a dead end.
    const near = this.searchReady ? await this.search.nearest(word, 8) : [];
    this.hud.openSearch();
    this.hud.elSearchInput.value = word;
    this.hud.showSuggestions(
      near,
      near.length
        ? `no ancestry recorded for “${word}” — nearest in the corpus:`
        : `“${word}” is not in any of the four dictionaries`);
    return false;
  }

  // A composed lineage as a flat chain the panel can render.
  // ---- a word's family -------------------------------------------------
  //
  // The corpus knows far more about a word than its line of ancestors. It
  // knows what descended from it, what was built out of it, which words in
  // other languages are its cousins, and how else it has been spelled. All of
  // that was being computed in stage 1 and dropped before it reached the
  // screen; this fetches it back and hands the added nodes to the stage so
  // they are laid out with the chain rather than after it.
  //
  // Only the first few links are expanded. The neighbourhood of a
  // Proto-Indo-European root is tens of thousands of words, and a view that
  // tried to hold them all would say less than one that does not.
  async family(chain, { depth = 3, budget = 240 } = {}) {
    if (!this.familyReady || !chain || !chain.length) return null;
    let r = null;
    try {
      const ids = this.stage.chainIds(chain);
      if (!ids) return null;
      r = await this.neighbours.expand(
        this.doc, chain, ids.ids,
        { depth, budget,
          mint: (w, l, e, k) => this.stage.idFor(w, l, e, k),
          link: (a, b, rel) => this.stage.linkAdhoc(a, b, rel) });
    } catch (e) {
      // A missing shard must never cost the visitor the dive itself.
      console.warn('[etymon] family lookup failed', e);
      return null;
    }
    if (!r || !r.added.length) return null;
    // The panel lists the seed's own relations by name; the graph shows the
    // whole expansion. Same fetch serves both.
    r.summary = r.head;
    return r;
  }

  // The same, for a lineage already composed into the score: its nodes exist,
  // so the family hangs off them without rebuilding anything. The lineage
  // itself is not mutated -- it belongs to the score and will be shown again.
  async grown(lineage) {
    if (!this.familyReady) return { lineage, summary: null };
    const chain = this.chainOf(lineage);
    const ids = lineage.paths[0] || lineage.nodes || [];
    let r = null;
    try {
      r = await this.neighbours.expand(
        this.doc, chain, ids,
        { depth: 3, budget: 240,
          mint: (w, l, e, k) => this.stage.idFor(w, l, e, k),
          link: (a, b, rel) => this.stage.linkAdhoc(a, b, rel) });
    } catch (e) {
      return { lineage, summary: null };
    }
    if (!r || !r.added.length) return { lineage, summary: null };
    const nodes = lineage.nodes.concat(
      r.added.filter((id) => !lineage.nodes.includes(id)));
    return {
      lineage: Object.assign({}, lineage, { nodes, family: r.added.length }),
      summary: r.head,
    };
  }

  chainOf(lineage) {
    const path = lineage.paths[0] || [];
    const kinds = (lineage.kinds && lineage.kinds[0]) || [];
    const chain = path.map((id, i) => {
      const [word, lang, era, kind] = this.doc.nodes[id];
      return {
        word, lang, era,
        kind: i && kinds[i - 1] === 1 ? 1 : kind,
        gloss: this.doc.glosses[String(id)] || '',
      };
    });
    for (const id of lineage.dreams || []) {
      const [word, lang, era] = this.doc.nodes[id];
      chain.push({ word, lang, era, kind: 2,
                   gloss: this.doc.glosses[String(id)] || '' });
    }
    return chain;
  }

  // Pick a word off the chart and raise it. Prefers well-connected words,
  // which are the ones with something to show.
  async wander() {
    if (this.wandering || !this.searchReady) { this.phase = 'settle'; this.t = 1e9; return; }
    this.wandering = true;
    try {
      // Wander the whole map, not one corner of it. Sampling the best-
      // connected words alone kept landing in English, because the score is
      // English-seeded and the biggest languages dominate degree. Pick a
      // region first -- in rotation, so every family gets its turn -- then a
      // well-connected word inside it.
      const pool = this.ocean.byTerritory;
      const keys = Object.keys(pool).filter((k) => pool[k].length > 20);
      if (!keys.length) { this.phase = 'settle'; this.t = 1e9; return; }
      this.wanderIdx = ((this.wanderIdx === undefined ? -1 : this.wanderIdx) + 1)
                        % keys.length;
      for (let tries = 0; tries < 26; tries++) {
        // every few tries, move on to the next region so one sparse family
        // cannot stall the wandering
        if (tries && tries % 6 === 0) {
          this.wanderIdx = (this.wanderIdx + 1) % keys.length;
        }
        const list = pool[keys[this.wanderIdx]];
        const idx = list[(Math.random() * Math.min(list.length,
                          Math.max(40, list.length * 0.6))) | 0];
        const [word, code] = this.ocean.wordAt(idx);
        const hits = await this.search.lookup(word);
        if (!hits.length) continue;
        const best = hits.find((h) => h.chain[0].lang === code) || hits[0];
        if (best.chain.length < 3) continue;      // want a real dive
        const active = this.stage.showChain(best.chain, (l) => this.attachDreams(l));
        if (!active) continue;
        this.current = active;
        if (this.captions) this.hud.showLineage(active.lineage);
        this.markTerritories();
        this.phase = 'rise'; this.t = 0;
        this.flyToLineage();
        return;
      }
      this.phase = 'settle'; this.t = 1e9;        // nothing found; use the score
    } catch (e) {
      this.phase = 'settle'; this.t = 1e9;
    } finally {
      this.wandering = false;
    }
  }

  // Attach any dreamed ancestors this chain's words have. The score only
  // dreams in its closing movement, but a word looked up by hand should show
  // its invention if it has one.
  attachDreams(lineage) {
    const idx = this.doc.dreamIndex;
    if (!idx) return lineage;
    const found = [];
    for (const id of lineage.nodes || []) {
      const [w, lang] = this.doc.nodes[id];
      for (const d of idx[lang + '|' + w] || []) {
        if (!found.includes(d)) {
          found.push(d);
          if (!this.doc.edges.some((e) => e[0] === id && e[1] === d && e[2] === 3)) {
            this.doc.edges.push([id, d, 3]);
          }
        }
      }
    }
    if (found.length) {
      lineage.dreams = found;
      lineage.nodes = lineage.nodes.concat(found.filter(
        (d) => !lineage.nodes.includes(d)));
    }
    return lineage;
  }

  // "Jump to X" has to do something visible in every case. Re-root the map on
  // the word if it has an ancestry of its own; if it has none -- which is true
  // of every Proto-Indo-European root, and of every dreamed form -- then send
  // the camera to it where it stands and open it. The button used to call
  // dive() blindly, so on exactly the words it most often named, it silently
  // did nothing.
  async jump(word, lang) {
    if (await this.dive(word, { lang, quiet: true })) return true;

    const nid = this.stage.findNode(word, lang);
    if (nid >= 0) {
      const w = this.stage.nodeWorld(nid);
      if (w) {
        this.follow = false;
        this.cancelFlight();
        this.flyTo({ x: w.x - 120, z: w.z + 420, dist: 780,
                     pitch: 0.16, lookY: w.y }, 2.2);
      }
      const [nw, nl, era, kind] = this.doc.nodes[nid];
      this.hud.showWord([{ word: nw, lang: nl, era, kind,
                           gloss: this.doc.glosses[String(nid)] || '' }],
                        { source: 'jump' });
      return true;
    }
    return this.dive(word, { lang });     // last resort: the search fallback
  }

  // Which regions the raised chain belongs to, so the chart can lift them.
  markTerritories() {
    if (!this.stage.active) { this.ocean.setTerritoryFocus([]); return; }
    const seen = new Set();
    for (const p of this.stage.pickable || []) {
      const code = this.doc.nodes[p.id][1];
      seen.add(this.palette.territoryOf(code));
    }
    this.ocean.setTerritoryFocus([...seen]);
  }

  showLineage(lineage) {
    this.current = this.stage.show(lineage);
    if (this.captions) this.hud.showLineage(lineage);
    this.maybeDream(lineage);
    this.markTerritories();
    this.phase = 'rise'; this.t = 0;
    this.flyToLineage();
  }

  // ---- the score -------------------------------------------------------

  get movement() { return this.doc.movements[this.mi]; }

  nextLineage() {
    this.li++;
    let guard = 0;
    while (guard++ < this.doc.movements.length + 1) {
      const m = this.doc.movements[this.mi];
      if (m && this.li < m.lineages.length) return m.lineages[this.li];
      this.mi = (this.mi + 1) % this.doc.movements.length;
      this.li = 0;
      this.pendingMovement = true;
    }
    return null;
  }

  advance() {
    switch (this.phase) {
      case 'overture': {
        this.beat++;
        if (this.beat < OVERTURE.length) {
          this.hud.showOverture(OVERTURE[this.beat][1], OVERTURE[this.beat][2]);
          this.t = 0;
          return;
        }
        this.hud.hideOverture();
        this.pendingMovement = true;
        this.phase = 'movement';
        break;
      }
      case 'movement':
        // titles belong to the unattended performance, not to someone
        // driving the map
        if (this.mode === 'ambient') {
          this.hud.showMovement(this.movement.title, this.movement.subtitle);
        }
        this.phase = 'movement-hold';
        break;
      case 'movement-hold':
        this.hud.hideMovement();
        this.phase = 'settle';
        break;
      case 'settle': {
        // Between scored lineages the piece wanders: it picks a word out of the
        // chart at random and dives that instead. The composition is still the
        // spine, but this is what makes it feel like the map is being explored
        // rather than a playlist being played, and it reaches the whole
        // 239,094-word index rather than only the 319 scored seeds.
        if (this.mode === 'ambient' && Math.random() < 0.6) {
          this.phase = 'wander';
          this.t = 0;
          this.wander();
          return;
        }
        const lineage = this.nextLineage();
        if (this.pendingMovement) { this.pendingMovement = false; this.phase = 'movement'; break; }
        if (!lineage) { this.phase = 'settle'; break; }
        this.showLineage(lineage);
        return;                            // showLineage sets phase and t
      }
      case 'wander':
        // the dive never arrived; fall through to the score
        this.phase = 'settle';
        break;
      case 'rise': this.phase = 'hold'; break;
      case 'hold': this.phase = 'sink'; break;
      case 'sink':
        this.hud.hideLineage();
        this.stage.clear();
        this.ocean.setTerritoryFocus([]);
        this.follow = false;
        // lift away from the chain rather than cutting to wherever the survey
        // wants to be next
        this.flyTo({ dist: this.rig.dist + 850, pitch: 0.34,
                     lookY: this.lookTarget }, T.settle * 0.9);
        this.surveyAt = (this.clock ? this.clock.elapsedTime : 0) + T.settle + 6;
        this.phase = 'settle';
        break;
    }
    this.t = 0;
  }

  duration() {
    switch (this.phase) {
      case 'overture':
        return OVERTURE[Math.min(this.beat, OVERTURE.length - 1)][0];
      case 'wander': return 6;
      case 'movement': return 0.35;
      case 'movement-hold': return T.movement;
      case 'settle': return T.settle;
      case 'rise': return T.rise;
      case 'hold': return T.hold;
      case 'sink': return T.sink;
      default: return 3;
    }
  }

  // ---- live dreaming (optional) ---------------------------------------

  async maybeDream(lineage) {
    if (!this.live.on || this.live.pending || this.live.failures > 2) return;
    // only the dreaming movement asks for dreams
    if (!/dreams itself/i.test(this.movement.title || '')) return;
    const seedId = lineage.seed;
    const [word, code] = this.doc.nodes[seedId];
    this.live.pending = true;
    try {
      const res = await fetch('dream', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word, lang: code, count: 1 }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      for (const d of data.dreams || []) this.injectDream(seedId, d);
      this.live.added += (data.dreams || []).length;
    } catch (e) {
      this.live.failures++;
      this.live.on = this.live.failures <= 2;
    } finally {
      this.live.pending = false;
    }
  }

  injectDream(childId, d) {
    const doc = this.doc;
    if (!d.word || !d.lang || !doc.languages[d.lang]) return;
    const era = doc.languages[d.lang].depth;
    const id = doc.nodes.length;
    doc.nodes.push([d.word, d.lang, era, 2]);
    doc.edges.push([childId, id, 3]);
    if (d.gloss) doc.glosses[String(id)] = d.gloss;
    for (const m of doc.movements) {
      for (const l of m.lineages) {
        if (l.seed === childId) {
          l.dreams = (l.dreams || []).concat([id]);
          l.nodes = l.nodes.concat([id]);
        }
      }
    }
  }

  // ---- camera ----------------------------------------------------------

  // ---- camera ----------------------------------------------------------
  //
  // Scripted moves are *flights*: a fixed start, a fixed end, and an eased
  // curve between them. The first version instead pulled a moving target
  // toward the destination every frame by a factor that reached 1.0 at the end
  // of the rise -- so the target snapped home exactly when the camera was
  // travelling fastest, and every dive ended in a lunge. Nothing chases
  // anything now; a flight is decided once and then simply played.

  flyTo(to, dur, hold) {
    const from = {};
    for (const k of ['x', 'z', 'dist', 'yaw', 'pitch']) from[k] = this.rig[k];
    from.lookY = this.lookY;
    const target = Object.assign({}, from, to);
    // Take the short way round: yaw is unwrapped, so a survey that crosses the
    // seam would otherwise spin the long way about.
    while (target.yaw - from.yaw > Math.PI) target.yaw -= Math.PI * 2;
    while (target.yaw - from.yaw < -Math.PI) target.yaw += Math.PI * 2;
    // Carry the camera's current velocity into the new curve. Starting every
    // flight from rest is fine from a standstill, but when one interrupts
    // another -- a dive called while a survey is still crossing the map -- the
    // camera stops dead and sets off again, which is felt as a jolt even
    // though the position never jumps.
    this.flight = { from, to: target, t: 0, dur: Math.max(dur, 0.25),
                    v0: Object.assign({}, this.vel || {}), hold: hold || 0 };
  }

  cancelFlight() {
    if (!this.flight) return;
    this.flight = null;
    for (const k of ['x', 'z', 'dist', 'yaw', 'pitch']) this.rigWant[k] = this.rig[k];
    this.anchor = null;          // the idle drift re-anchors where we landed
  }

  captureAnchor() {
    return { x: this.rig.x, z: this.rig.z, dist: this.rig.dist,
             yaw: this.rig.yaw, pitch: this.rig.pitch,
             at: this.clock ? this.clock.elapsedTime : 0 };
  }

  // Where the camera should sit to read the chain that is currently up.
  // A chain can now stretch right across the map -- an English word borrowed
  // from Arabic puts its nodes in two different regions -- so the view is
  // computed from the chain's actual extent instead of a fixed standoff.
  lineageView() {
    const b = this.stage.bounds();
    if (!b) {
      return { x: this.rig.x, z: this.rig.z, dist: 1600,
               pitch: 0.2, yaw: this.rig.yaw, lookY: -300 };
    }
    const half = Math.max(b.span * 0.62, 520);
    const dist = Math.min(half / Math.tan(this.camera.fov * Math.PI / 360) + 420,
                          this.extent * 2.2);
    return {
      x: b.cx - dist * 0.16,
      z: b.cz + dist * 0.20,
      dist,
      pitch: 0.22,
      yaw: this.rig.yaw,
      lookY: b.cy,
    };
  }

  // A chain has been raised: fly to it over the length of the rise, so the
  // camera settles as the words finish standing up.
  flyToLineage() {
    if (!this.stage.active) return;
    this.follow = true;
    this.flyTo(this.lineageView(), T.rise * 1.05);
  }

  // Pick the next region to survey and take a long, slow way there.
  surveyNext(elapsed) {
    const keys = Object.keys(this.doc.territories || {});
    if (!keys.length) return;
    this.surveyIdx = (this.surveyIdx === undefined)
      ? 0 : (this.surveyIdx + 1) % keys.length;
    const home = this.doc.territories[keys[this.surveyIdx]];
    const a = Math.random() * Math.PI * 2;
    this.flyTo({
      x: home.x + Math.cos(a) * home.r * 0.32,
      z: home.z + Math.sin(a) * home.r * 0.32,
      dist: 2000 + Math.random() * 700,
      yaw: this.rig.yaw + 0.5 + Math.random() * 0.7,
      pitch: 0.33 + Math.random() * 0.12,
      lookY: this.lookTarget,
    }, 20 + Math.random() * 8);
    this.surveyAt = elapsed + 34 + Math.random() * 14;
  }

  updateCamera(dt, elapsed) {
    // velocity of the previous frame, for continuity when a flight begins
    const prev = {};
    for (const k of ['x', 'z', 'dist', 'yaw', 'pitch']) prev[k] = this.rig[k];

    if (this.flight) {
      const f = this.flight;
      f.t += dt;
      const p = Math.min(f.t / f.dur, 1);
      // Cubic Hermite: leaves at whatever speed the camera already had and
      // arrives at a dead stop.
      const p2 = p * p, p3 = p2 * p;
      const h00 = 2 * p3 - 3 * p2 + 1;
      const h10 = p3 - 2 * p2 + p;
      const h01 = -2 * p3 + 3 * p2;
      for (const k of ['x', 'z', 'dist', 'yaw', 'pitch']) {
        const m0 = (f.v0[k] || 0) * f.dur;
        this.rig[k] = h00 * f.from[k] + h10 * m0 + h01 * f.to[k];
      }
      this.lookY = f.from.lookY + (f.to.lookY - f.from.lookY) * this.easeInOut(p);
      if (f.t >= f.dur) {
        this.cancelFlight();
      }
    } else {
      if (this.mode === 'ambient') {
        if (this.surveyAt === undefined) this.surveyAt = elapsed + 12;
        // don't start a survey over the top of a chain being read
        if (elapsed > this.surveyAt && !this.stage.active) {
          this.surveyNext(elapsed);
        } else {
          // A slow breath in place, so the chart is never quite still.
          //
          // This has to be anchored. Writing `rigWant = rig + delta` every
          // frame is an integrator, not an oscillation: the offset is applied
          // afresh to wherever the camera has already drifted to, so the
          // motion accelerates without bound. The first version of this drift
          // was still speeding up seconds after a dive had finished.
          if (!this.anchor) this.anchor = this.captureAnchor();
          const a = this.anchor;
          this.rigWant.x = a.x;
          this.rigWant.z = a.z;
          this.rigWant.yaw = a.yaw + (elapsed - a.at) * 0.012;
          this.rigWant.pitch = a.pitch + Math.sin(elapsed * 0.06) * 0.02;
          this.rigWant.dist = a.dist + Math.sin(elapsed * 0.045) * 90;
        }
      }

      // Ease toward whatever the visitor (or the drift) is asking for. Time
      // constant of about a third of a second: quick enough to feel direct
      // under the hand, slow enough that nothing snaps.
      const k = 1 - Math.pow(0.045, dt);
      for (const p of ['x', 'z', 'dist', 'yaw', 'pitch']) {
        this.rig[p] += (this.rigWant[p] - this.rig[p]) * k;
      }
      const wantY = this.stage.active ? this.lineageView().lookY
                                      : this.lookTarget;
      this.lookY += (wantY - this.lookY) * k;
    }

    // record velocity for the next flight to inherit
    if (!this.vel) this.vel = {};
    const inv = dt > 1e-4 ? 1 / dt : 0;
    for (const k of ['x', 'z', 'dist', 'yaw', 'pitch']) {
      this.vel[k] = (this.rig[k] - prev[k]) * inv;
    }

    const { x, z, dist, yaw, pitch } = this.rig;
    this.camera.position.set(
      x + Math.sin(yaw) * Math.cos(pitch) * dist,
      Math.sin(pitch) * dist,
      z + Math.cos(yaw) * Math.cos(pitch) * dist);
    this.camera.lookAt(x, this.lookY, z);
  }

  // smootherstep: zero velocity AND zero acceleration at both ends, which is
  // what stops a move from arriving with a jolt.
  easeInOut(x) {
    const t = Math.min(Math.max(x, 0), 1);
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  ease(x) { const t = Math.min(Math.max(x, 0), 1); return t * t * (3 - 2 * t); }

  // ---- territory labels ------------------------------------------------

  placeTerritories() {
    const m = new THREE.Matrix4().multiplyMatrices(
      this.camera.projectionMatrix, this.camera.matrixWorldInverse);
    const v = new THREE.Vector3();
    const out = this.territoryScreen;
    out.clear();
    const t = this.doc.territories || {};
    for (const key of Object.keys(t)) {
      const home = t[key];
      v.set(home.x, 40, home.z).applyMatrix4(m);
      const w = v.w !== undefined ? v.w : 1;
      const clip = new THREE.Vector4(home.x, 40, home.z, 1).applyMatrix4(m);
      const cw = clip.w;
      if (cw <= 1) { out.set(key, { behind: true }); continue; }
      const sx = (clip.x / cw) * this.w * 0.5 + this.w * 0.5;
      const sy = -(clip.y / cw) * this.h * 0.5 + this.h * 0.5;
      // fade with distance and while reading a chain
      const near = 1 - Math.min(1, cw / (this.extent * 2.2));
      const alpha = Math.max(0, 0.16 + near * 0.5) * (1 - this.reading * 0.85);
      out.set(key, { x: sx, y: sy, depth: cw, alpha, behind: false });
    }
    this.hud.placeTerritories(out);
  }

  // ---- frame -----------------------------------------------------------

  frame() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const elapsed = this.clock.elapsedTime;
    this.frameN++;

    // explore -> ambient after a long enough silence
    // A panel left open used to pin the piece in explore mode forever, so it
    // never went back to running itself. Idle wins now; the panel is closed
    // for us on the way out.
    if (this.mode === 'explore' &&
        elapsed - this.lastInput > IDLE_TO_AMBIENT &&
        !this.hud.searchOpen && !this.hud.helpOpen) {
      this.enterAmbient();
    }

    // The score only advances on its own in ambient mode; in explore the
    // visitor is driving and a chain must not be yanked away mid-read. The
    // overture is exempt -- it always runs to the end.
    if (this.phase === 'overture' || this.mode === 'ambient' ||
        this.phase === 'rise' || this.phase === 'hold') {
      this.t += dt;
      if (this.t >= this.duration()) {
        if (this.mode === 'explore' && this.phase === 'hold') {
          this.t = 0;                        // hold indefinitely while exploring
        } else {
          this.advance();
        }
      }
    }

    let fade = 0, grow = 0, stand = 0, reading = 0;
    if (this.phase === 'rise') {
      const p = this.t / T.rise;
      // The filament runs ahead and the words follow it up, which reads as the
      // chain being drawn rather than everything appearing together.
      grow = this.easeInOut(p * 1.25);
      fade = this.easeInOut((p - 0.12) / 0.88);
      stand = this.easeInOut((p - 0.2) / 0.8);
      reading = this.easeInOut(p);
    } else if (this.phase === 'hold') {
      fade = 1; grow = 1; stand = 1; reading = 1;
    } else if (this.phase === 'sink') {
      const p = 1 - this.easeInOut(this.t / T.sink);
      fade = p; grow = 1; stand = p; reading = p;
    }
    this.reading = reading;

    const want = 1 - 0.5 * reading;
    this.oceanFade += (want - this.oceanFade) * (1 - Math.pow(0.12, dt));

    this.updateCamera(dt, elapsed);
    this.camera.updateMatrixWorld();
    this.camera.matrixWorldInverse.copy(this.camera.matrixWorld).invert();

    this.ocean.update(dt, this.oceanFade, this.camera, this.w, this.h, this.frameN);
    this.stage.update(dt, { fade, stand, grow });
    this.stage.group.updateMatrixWorld();
    this.stage.project(this.camera, this.w, this.h);
    this.placeTerritories();

    // which layer the camera is looking at, for the gauge
    const eraNow = Math.max(0, Math.min(4,
      Math.round(-this.lookY / Math.max(this.ocean.eraDepth, 1))));
    this.hud.updateStrata(this.ocean.time * 0.25, eraNow);
    this.hud.showBack(this.mode === 'explore' &&
                      (!!this.stage.active || this.hud.panelOpen ||
                       this.eraFocus >= 0));

    // hover, in explore mode only
    if (this.mode === 'explore' && this.mouse.inside && !this.mouse.down) {
      const nid = this.stage.pick(this.mouse.x, this.mouse.y);
      if (nid >= 0) {
        this.ocean.setHover(-1);
        const [w, lang] = this.doc.nodes[nid];
        const l = this.doc.languages[lang];
        this.hud.tip(w, this.mouse.x, this.mouse.y,
                     (l ? l.name : lang) + ' · click to follow');
        document.body.classList.add('over-node');
      } else {
        document.body.classList.remove('over-node');
        const i = this.ocean.pick(this.mouse.x, this.mouse.y, 34);
        this.ocean.setHover(i);
        if (i >= 0) {
          const [word, code] = this.ocean.wordAt(i);
          const lang = this.doc.languages[code];
          this.hud.tip(word, this.mouse.x, this.mouse.y,
                       lang ? lang.name : code);
        } else {
          this.hud.tip(null);
        }
      }
    }

    this.renderer.render(this.scene, this.camera);

    if (this.stats && this.frameN % 60 === 0) {
      const info = this.renderer.info;
      console.log(`mode=${this.mode} phase=${this.phase} ` +
        `calls=${info.render.calls} pts=${this.ocean.count} ` +
        `labels=${this.ocean.labelGeo.instanceCount} ` +
        `sea=${this.seaAtlas.count} shards=${this.search.shards.size}`);
    }
  }

  onKey(e) {
    // typing in the search field belongs to the search field
    if (this.hud.searchOpen && e.target === this.hud.elSearchInput) {
      this.lastInput = this.clock.elapsedTime;
      return;
    }
    if (this.phase === 'overture') {
      this.lastInput = this.clock.elapsedTime;
      if (e.key === 'Escape') {                 // skip the whole opening
        this.beat = OVERTURE.length;
        this.t = this.duration();
        return;
      }
      if (e.key === ' ') {                      // skip one line
        e.preventDefault();
        this.t = this.duration();
        return;
      }
    }
    const nudgeKeys = {
      w: 'up', W: 'up', ArrowUp: 'up',
      s: 'down', S: 'down', ArrowDown: 'down',
      a: 'left', A: 'left', ArrowLeft: 'left',
      d: 'right', D: 'right', ArrowRight: 'right',
      '+': 'in', '=': 'in', '-': 'out', '_': 'out',
      ']': 'deeper', '[': 'shallower',
      h: 'home', H: 'home',
    };
    if (nudgeKeys[e.key] && !this.hud.searchOpen) {
      e.preventDefault();
      this.nudge(nudgeKeys[e.key], e.shiftKey ? 2.5 : 1);
      return;
    }
    this.touch();
    switch (e.key) {
      case '/': e.preventDefault(); this.hud.toggleSearch(); break;
      case 'g': e.preventDefault(); this.hud.toggleSettings(); break;
      case '?': e.preventDefault(); this.hud.toggleHelp(); break;
      case 'Escape':
        if (this.hud.helpOpen) this.hud.closeHelp();
        else if (this.hud.settingsOpen) this.hud.closeSettings();
        else if (this.hud.searchOpen) this.hud.closeSearch();
        // being down in a layer counts as being focused on something, so
        // escape has to lift you out of it too
        else if (this.hud.panelOpen || this.stage.active || this.eraFocus >= 0) {
          this.exitFocus();
        } else this.enterAmbient();
        break;
      case ' ':
        e.preventDefault();
        if (this.phase === 'hold' || this.phase === 'rise') { this.phase = 'sink'; this.t = 0; }
        else this.t = this.duration();
        break;
      case '.': this.mi = (this.mi + 1) % this.doc.movements.length;
                this.li = -1; this.pendingMovement = true;
                this.phase = 'sink'; this.t = T.sink; break;
      case ',': this.mi = (this.mi - 1 + this.doc.movements.length) % this.doc.movements.length;
                this.li = -1; this.pendingMovement = true;
                this.phase = 'sink'; this.t = T.sink; break;
      case 'm': this.voice.toggle(); break;
      case 'p': this.hud.toggleAudio(); break;
      case 'c': this.captions = !this.captions;
                if (!this.captions) this.hud.hideLineage();
                else if (this.stage.active) this.hud.showLineage(this.stage.active.lineage);
                break;
      case 'k': document.getElementById('etKey').classList.toggle('off'); break;
      case 'f': if (!document.fullscreenElement) document.documentElement.requestFullscreen();
                else document.exitFullscreen(); break;
      case 'r': this.mi = 0; this.li = -1; this.phase = 'overture';
                this.t = 0; this.beat = 0;
                this.stage.clear(); this.hud.hideLineage();
                this.hud.closePanel();
                this.hud.showOverture(OVERTURE[0][1], OVERTURE[0][2]);
                this.enterAmbient(); break;
      case 'F': this.stats = !this.stats; break;
    }
  }
}

async function boot() {
  const mount = document.getElementById('stage');
  const note = document.getElementById('boot');
  try {
    const res = await fetch('data/etymon.json');
    if (!res.ok) throw new Error(`data/etymon.json — HTTP ${res.status}`);
    const doc = await res.json();
    if (!doc.territories) {
      throw new Error('this graph has no cartography — run ./build.sh');
    }
    note.remove();
    window.etymon = new Installation(doc, mount);
  } catch (err) {
    note.innerHTML =
      `<div class="boot-err"><b>Etymøn could not start.</b><br>${err.message}` +
      `<br><br>The data is loaded over HTTP, so it needs a server:` +
      `<br><code>python3 serve.py</code><br>then open ` +
      `<code>http://localhost:8000</code></div>`;
    throw err;
  }
}

boot();
