// Etymon — the interface.
//
// The 2018 app was explorable, and the first version of this rebuild was not:
// no cursor, no hover, no search, no way to ask about a word. It ran beautifully
// and you could only watch it. That was a real loss, and this file is the
// answer to it.
//
// The piece now has two modes:
//
//   ambient   what a gallery gets. No cursor, no controls, the score running
//             itself forever. Nothing on screen suggests a computer.
//   explore   the moment the mouse moves or a key is pressed. The cursor comes
//             back, words highlight under it, clicking one opens a panel with
//             its ancestry and its Wiktionary entry, and search is available.
//             The score pauses. After a while idle it drifts back to ambient.
//
// The furniture is carried over from the original, which had all of it: the
// expanding magnifier search, the Wiktionary side panel with its "Jump to
// word" button, the "?" modal explaining what the colours mean, and the
// six-bar equalizer toggling the soundtrack.

import { REGISTER_LABEL, REGISTER_NOTE, TERRITORY } from './palette.js';

const WIKTIONARY = 'https://en.wiktionary.org';

// How long a line takes to fade out before the next one is swapped in. Must
// match the CSS transition on .et-overture-text.
export const OVERTURE_FADE = 1400;

export class Hud {
  constructor(root, doc, palette, hooks) {
    this.root = root;
    this.doc = doc;
    this.palette = palette;
    this.hooks = hooks || {};
    this.territoryEls = new Map();
    this.searchOpen = false;
    this.panelOpen = false;

    this.elTitle = root.querySelector('#etTitle');
    this.elOverture = root.querySelector('#etOverture');
    this.elOvertureText = root.querySelector('#etOvertureText');
    this.elBegin = root.querySelector('#etBegin');
    this.elMovement = root.querySelector('#etMovement');
    this.elMovementTitle = root.querySelector('#etMovementTitle');
    this.elMovementSub = root.querySelector('#etMovementSub');
    this.elCaption = root.querySelector('#etCaption');
    this.elListening = root.querySelector('#etListening');
    this.elHeard = root.querySelector('#etHeard');
    this.elTerritories = root.querySelector('#etTerritories');
    this.elTip = root.querySelector('#etTip');

    this.elSearch = root.querySelector('#etSearch');
    this.elSearchInput = root.querySelector('#etSearchInput');
    this.elSuggest = root.querySelector('#etSuggest');
    this.elPanel = root.querySelector('#etPanel');
    this.elHelp = root.querySelector('#etHelp');

    this.elStrata = root.querySelector('#etStrata');
    this.elBack = root.querySelector('#etBack');
    this.elPad = root.querySelector('#etPad');
    this.elSettings = root.querySelector('#etSettings');

    this.buildKey(root.querySelector('#etKey'));
    this.buildStrata();
    this.wireBack();
    this.wirePad();
    this.wireSettings();
    this.buildHelp(root.querySelector('#etHelpBody'));
    this.buildTerritories();
    this.wireSearch();
    this.wirePanel();
    this.wireHelp();
    this.wireAudio();
  }

  // ---------- static furniture ----------------------------------------

  buildKey(el) {
    const rows = [0, 1, 2].map((k) => `
      <div class="et-key-row">
        <span class="et-swatch et-swatch-${k}"></span>
        <span class="et-key-label">${REGISTER_LABEL[k]}</span>
        <span class="et-key-note">${REGISTER_NOTE[k]}</span>
      </div>`).join('');
    el.innerHTML = `
      <div class="et-key-head">Etymøn — ${this.doc.meta.sources}</div>
      ${rows}`;
  }

  buildHelp(el) {
    const cart = this.doc.cartography || {};
    const terr = Object.keys(this.doc.territories || {}).map((t) => `
      <span class="et-terr-chip">
        <i style="background:${this.palette.css(t)}"></i>
        ${(TERRITORY[t] || {}).name || t}
      </span>`).join('');
    el.innerHTML = `
      <h3>Where things are</h3>
      <p>This is a chart, not a scatter. A word's place on it means something,
         at two scales that mean different things:</p>
      <ul>
        <li><b>Which region a word is in</b> — its language family. The regions
            are arranged by how much they actually exchange words: the affinity
            between two families is the number of connections running between
            them in the corpus, and the map is laid out from those counts. So
            Romance sits against Germanic because that is where the borrowing
            went, and Turkic sits against Semitic and Iranian for the same
            reason. Nobody chose the arrangement.</li>
        <li><b>Where it sits inside that region</b> — resemblance. Words are
            embedded by their character n-grams, so forms that look and sound
            alike cluster, and languages clump because languages share spelling
            conventions. This scale is about how words look, not how they are
            related.</li>
        <li><b>How deep it lies</b> — the age of its language. Living languages
            float; Latin and Ancient Greek lie well under; the reconstructed
            proto-forms rest on the floor.</li>
      </ul>
      <div class="et-terr-chips">${terr}</div>

      <h3>The six kinds of link</h3>
      <p>The corpus makes four different claims about how two words relate,
         and a fifth and sixth are ours. Each is drawn with its own hand, and
         the <b>Family</b> section of a word's panel labels them with the same
         strokes:</p>
      <ul>
        <li><span class="et-fam-line"></span> <b>Descent</b> — a steady line.
            This word comes from that one. 573,526 edges.</li>
        <li><span class="et-fam-line derived"></span> <b>Derivation</b> — fine
            dashes. This word is <i>built out of</i> that one, usually inside
            the same language: "waterage" from "water". 2,261,871 edges, 71% of
            the corpus, and for 2.24 million words it is the only relation
            recorded.</li>
        <li><span class="et-fam-line cognate"></span> <b>Cognate</b> — a dotted
            line, running sideways. Not descent: two words that share an
            ancestor, siblings rather than parent and child. 325,707 edges.</li>
        <li><span class="et-fam-line variant"></span> <b>Variant</b> — a
            doubled hairline. The same word, spelled otherwise: "colour" and
            "color". 15,621 edges, and they were being thrown away as noise
            until recently, which was the wrong call — the corpus's only record
            that two forms are one word.</li>
        <li><b>Conjecture</b> — a pulse travelling down the line. Proposed,
            not recorded.</li>
        <li><b>Dream</b> — shimmering, unstable. Invented.</li>
      </ul>
      <p>Raising a word brings its family with it: everything one hop away,
         from an index of 2,941,432 words and 5.5 million links held locally.
         Where a word is a hub the view keeps the most connected of them and
         says how many it is not showing — click that number and, if this
         machine has the full 332&nbsp;MB graph, it will scan it for the rest.
         English <i>time</i> has 1,271 formations.</p>

      <h3>The three kinds of light</h3>
      <ul>
        <li><b class="et-c0">Attested</b> — asserted by one of the four source
            dictionaries.</li>
        <li><b class="et-c1">Conjectured</b> — absent from all four, and
            proposed. The 2018 scrapes were patchy, so many words stopped one
            step above their real root; these fill the gaps with standard
            etymology, drawn as a proposal rather than a fact.</li>
        <li><b class="et-c2">Dreamed</b> — invented. No such word has ever
            existed. Confined to the closing movement, and built to the right
            shape so that it sits at the same depth as the genuine
            reconstructions. The only thing separating it from the record is
            how it is lit, which is the point.</li>
      </ul>

      <h3>Using it</h3>
      <ul>
        <li>Move the mouse and words light up. <b>Click</b> one — on the chart
            or in a raised chain — to open its ancestry and its Wiktionary
            entry. Clicking an ancestor re-roots the map on it.</li>
        <li><b>Search</b> with <kbd>/</kbd> — 2,790,971 words, held locally,
            so it works with the network unplugged. Type an inflected form and
            it shows you the lemma it belongs to.</li>
        <li><b>The gauge on the left</b> is the five layers. Click one to
            travel down to it; the others dim so you can read the one you are
            in. <kbd>[</kbd> and <kbd>]</kbd> do the same.</li>
        <li><b>Back to the map</b> at the top, or <kbd>esc</kbd>, leaves a
            chain and returns to the whole chart.</li>
        <li>Leave it alone and it goes back to running itself.</li>
      </ul>

      <h3>Getting about</h3>
      <pre>drag           pan             W A S D / arrows   move
scroll         zoom            + -                zoom
[  ]           layer           H                  whole map
/  search      ?  this panel   g  settings        esc  back
space  next    . ,  movement   c  captions        k  key
m  microphone  p  music        f  fullscreen      r  restart</pre>
      <p>If dragging is awkward, the on-screen pad in the bottom corner does
         all of it, and <kbd>g</kbd> opens settings where you can turn it off,
         change the speed, or invert the drag.</p>

      <p class="et-credit">Etymøn was a 2018 senior design project at Bilkent
        University: Nashiha Ahmed, Mert İnan, Cholpon Mambetova, Utku Uçkun,
        supervised by Mehmet Koyutürk. Etymological data belongs to Etymonline,
        Nişanyan Sözlük, Starling and the Etymological Wordnet. Music:
        <i>The Meaning of Words</i> by Savfk, CC&nbsp;BY&nbsp;4.0.</p>`;
  }

  // Territory names float over their own region, projected each frame.
  buildTerritories() {
    const t = this.doc.territories || {};
    for (const key of Object.keys(t)) {
      const el = document.createElement('div');
      el.className = 'et-terr';
      el.textContent = ((TERRITORY[key] || {}).name || key).toUpperCase();
      el.style.color = this.palette.css(key);
      this.elTerritories.appendChild(el);
      this.territoryEls.set(key, el);
    }
  }

  // Called per frame with screen positions worked out by the caller.
  placeTerritories(positions) {
    for (const [key, el] of this.territoryEls) {
      const p = positions.get(key);
      if (!p || p.depth <= 0 || p.behind) { el.style.opacity = 0; continue; }
      el.style.transform = `translate(-50%,-50%) translate(${p.x}px,${p.y}px)`;
      el.style.opacity = p.alpha;
    }
  }

  // ---------- the strata gauge -----------------------------------------
  //
  // The chart always had five layers and no way to reach any but the top one.
  // This draws each era as a length of the same wave the sea runs on -- so the
  // gauge is made of the piece's own motion -- and clicking one travels there.

  buildStrata() {
    const eras = [
      [0, 'Living'],
      [1, 'Early modern'],
      [2, 'Medieval'],
      [3, 'Ancient'],
      [4, 'Reconstructed'],
    ];
    const counts = {};
    for (const [, code] of (this.doc.ocean || []).map((o) => [0, o[1]])) {
      const l = this.doc.languages[code];
      if (l) counts[l.depth] = (counts[l.depth] || 0) + 1;
    }
    this.strata = [];
    this.elStrata.innerHTML = '';
    for (const [era, name] of eras) {
      const el = document.createElement('div');
      el.className = 'et-stratum';
      el.dataset.era = era;
      el.innerHTML = `
        <svg viewBox="0 0 200 24" preserveAspectRatio="none">
          <path fill="none" stroke="currentColor" stroke-width="1.1"
                vector-effect="non-scaling-stroke" d=""></path>
        </svg>
        <div class="et-stratum-label">
          <span>${name}</span>
          <span class="et-stratum-n">${(counts[era] || 0).toLocaleString('en-US')}</span>
        </div>`;
      el.style.color = era === 4 ? 'var(--dream)' : 'var(--ink)';
      el.addEventListener('click', () => {
        if (this.hooks.onEra) this.hooks.onEra(era);
      });
      this.elStrata.appendChild(el);
      this.strata.push({ era, el, path: el.querySelector('path') });
    }
  }

  // Animate the gauge with the sea's own wave function, and mark where the
  // camera currently is.
  updateStrata(time, hereEra) {
    if (!this.strata) return;
    for (const s of this.strata) {
      let d = '';
      for (let i = 0; i <= 24; i++) {
        const x = (i / 24) * 200;
        const wx = Math.sin((i * 0.55 + time) * 0.3);
        const wy = Math.sin((i * 0.31 + time + s.era * 2.1) * 0.5);
        const y = 12 + (wx * 4.2 + wy * 4.2) * (1 - s.era * 0.12);
        d += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1) + ' ';
      }
      s.path.setAttribute('d', d);
      s.el.classList.toggle('here', s.era === hereEra);
    }
  }

  // ---------- leaving a chain ------------------------------------------

  wireBack() {
    this.elBack.addEventListener('click', () => {
      if (this.hooks.onExit) this.hooks.onExit();
    });
  }

  showBack(on) { this.elBack.classList.toggle('on', !!on); }

  // ---------- on-screen movement ---------------------------------------

  wirePad() {
    for (const b of this.elPad.querySelectorAll('button')) {
      const act = b.dataset.act;
      let timer = null;
      const fire = () => { if (this.hooks.onNudge) this.hooks.onNudge(act); };
      // press-and-hold repeats, which is what makes a pad usable
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault(); fire();
        timer = setInterval(fire, 90);
      });
      const stop = () => { if (timer) { clearInterval(timer); timer = null; } };
      b.addEventListener('pointerup', stop);
      b.addEventListener('pointerleave', stop);
      addEventListener('pointerup', stop);
    }
  }

  // ---------- settings --------------------------------------------------

  wireSettings() {
    const gear = this.root.querySelector('#etGear');
    gear.addEventListener('click', () => this.toggleSettings());

    this.settings = {
      pad: true, strata: true, focus: true, labels: true,
      terr: true, captions: true, key: true, invert: false, speed: 1,
    };
    const bind = (id, name, apply) => {
      const el = this.root.querySelector(id);
      const read = () => (el.type === 'checkbox' ? el.checked : parseFloat(el.value));
      el.addEventListener('input', () => {
        this.settings[name] = read();
        apply(this.settings[name]);
        if (this.hooks.onSetting) this.hooks.onSetting(name, this.settings[name]);
      });
      apply(read());
    };
    bind('#setPad', 'pad', (v) => this.elPad.classList.toggle('off', !v));
    bind('#setStrata', 'strata', (v) => this.elStrata.classList.toggle('off', !v));
    bind('#setFocus', 'focus', () => {});
    bind('#setLabels', 'labels', () => {});
    bind('#setTerr', 'terr',
         (v) => this.elTerritories.classList.toggle('off', !v));
    bind('#setCaptions', 'captions', (v) => { if (!v) this.hideLineage(); });
    bind('#setKey', 'key',
         (v) => this.root.querySelector('#etKey').classList.toggle('off', !v));
    bind('#setInvert', 'invert', () => {});
    bind('#setSpeed', 'speed', () => {});
  }

  toggleSettings() { this.elSettings.classList.toggle('on'); }
  closeSettings()  { this.elSettings.classList.remove('on'); }
  get settingsOpen() { return this.elSettings.classList.contains('on'); }

  // ---------- search ----------------------------------------------------

  wireSearch() {
    const input = this.elSearchInput;
    input.addEventListener('input', () => {
      const q = input.value.trim();
      if (this.hooks.onSuggest) this.hooks.onSuggest(q);
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        // What was typed wins if it exists. Taking the first suggestion
        // unconditionally meant typing "labyrinth" dived to
        // "labyrinthlike".
        const typed = input.value.trim();
        const sugs = [...this.elSuggest.querySelectorAll('.et-sug')];
        const exact = sugs.find(
          (el) => el.dataset.word.toLowerCase() === typed.toLowerCase());
        const word = exact ? exact.dataset.word
                           : (typed || (sugs[0] && sugs[0].dataset.word));
        if (word && this.hooks.onSearch) this.hooks.onSearch(word);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this.closeSearch();
      }
      e.stopPropagation();
    });
    this.elSearch.querySelector('.et-search-icon')
      .addEventListener('click', () => this.toggleSearch());
  }

  openSearch() {
    this.searchOpen = true;
    this.elSearch.classList.add('on');
    this.elSearchInput.focus();
    this.elSearchInput.select();
  }

  closeSearch() {
    this.searchOpen = false;
    this.elSearch.classList.remove('on');
    this.elSuggest.innerHTML = '';
    this.elSearchInput.blur();
  }

  toggleSearch() { this.searchOpen ? this.closeSearch() : this.openSearch(); }

  showSuggestions(list, note) {
    if (!list.length) {
      this.elSuggest.innerHTML = note
        ? `<div class="et-sug-note">${note}</div>` : '';
      return;
    }
    const head = note ? `<div class="et-sug-note">${note}</div>` : '';
    this.elSuggest.innerHTML = head + list.map((s) => {
      const lang = this.doc.languages[s.deepest.lang];
      const name = lang ? lang.name : s.deepest.lang;
      const meta = s.inflected
        ? 'inflected form'
        : (name ? `${s.steps} steps · to ${name}` : `${s.steps} steps`);
      return `<div class="et-sug"${s.inflected ? ' data-inflected' : ''}
                   data-word="${s.word}">
                <span class="et-sug-word">${s.word}</span>
                <span class="et-sug-meta">${meta}</span>
              </div>`;
    }).join('');
    for (const el of this.elSuggest.querySelectorAll('.et-sug')) {
      el.addEventListener('click', () => {
        if (this.hooks.onSearch) this.hooks.onSearch(el.dataset.word);
      });
    }
  }

  // ---------- the word panel -------------------------------------------

  wirePanel() {
    this.elPanel.querySelector('.et-panel-close')
      .addEventListener('click', () => this.closePanel());
  }

  closePanel() {
    this.panelOpen = false;
    this.elPanel.classList.remove('on');
    document.body.classList.remove('panel-open');
    this.wikiToken = null;
  }

  // chain: [{word, lang, era, kind, gloss}], shallowest first.
  // ---- the family block ------------------------------------------------
  //
  // The ancestry above answers "where did this word come from". The corpus
  // also answers "what came from it", "what is it built out of", "what is it
  // built into", "what are its cousins" and "how else is it spelled" -- five
  // more relations, 5.5M links, all of it computed in stage 1 and, until the
  // neighbourhood index existed, thrown away before it reached the screen.
  //
  // Each group is labelled with the same stroke the edge shader draws for
  // that relation, so what the panel says and what the graph shows agree.
  showFamily(head, family) {
    this._famHead = head;
    const el = this.elPanel.querySelector('#etPanelFamily');
    const hd = this.elPanel.querySelector('#etPanelFamilyHead');
    if (!el) return;
    const nb = family && family.slots ? family : null;
    if (!nb) {
      el.classList.remove('on');
      el.innerHTML = '';
      if (hd) hd.style.display = 'none';
      return;
    }
    if (hd) hd.style.display = '';

    const GROUPS = [
      ['c', 'gave', 'descent'],
      ['g', 'kin to', 'cognate'],
      ['f', 'built into', 'derived'],
      ['d', 'built on', 'derived'],
      ['v', 'also spelled', 'variant'],
      ['p', 'from', 'descent'],
    ];
    let html = '';
    for (const [slot, label, stroke] of GROUPS) {
      const list = nb.slots[slot];
      if (!list || !list.length) continue;
      // "p" duplicates the ancestry above whenever the chain already climbed
      // it, which is nearly always -- only show it where it adds a parent the
      // walk did not take (a second etymology, a competing borrowing).
      const words = list.map((w) => {
        const l = this.doc.languages[w.lang];
        const color = this.palette.cssFor(w.lang, Math.max(0, w.era - 1.4));
        return `<span class="et-fam-word" data-word="${w.word}"
                      data-lang="${w.lang}" style="color:${color}"
                      title="jump to ${w.word}">${w.word}<i>${
                        l ? l.name : w.lang}</i></span>`;
      }).join('');
      // The shards cap a hub, and the record says by how much. If the host
      // has the master graph, that number is a button: the rest of the
      // relation is one scan away. If it does not, it stays a statement of
      // what is not being shown, which is better than silence.
      const more = nb.more && nb.more[slot];
      html += `<div class="et-fam-group" data-slot="${slot}">
                 <div class="et-fam-rel">
                   <span class="et-fam-line ${stroke}"></span>${label}
                   ${more ? `<button class="et-fam-more" data-slot="${slot}"
                              title="ask the corpus for the rest">+${
                     more.toLocaleString()} more</button>` : ''}
                 </div>
                 <div class="et-fam-words">${words}</div>
               </div>`;
    }
    if (!html) {
      el.classList.remove('on');
      el.innerHTML = '';
      if (hd) hd.style.display = 'none';
      return;
    }
    el.innerHTML = html;
    el.classList.add('on');
    for (const w of el.querySelectorAll('.et-fam-word[data-word]')) {
      w.addEventListener('click', () => {
        if (this.hooks.onJump) this.hooks.onJump(w.dataset.word, w.dataset.lang);
      });
    }
    for (const b of el.querySelectorAll('.et-fam-more')) {
      b.addEventListener('click', async (ev) => {
        ev.stopPropagation();
        if (!this.hooks.onMore) return;
        b.textContent = 'asking…';
        b.disabled = true;
        const full = await this.hooks.onMore(this._famHead);
        if (full) this.showFamily(this._famHead, full);
        else { b.textContent = 'not on this host'; }
      });
    }
  }

  showWord(chain, { source, lemmaOf, family } = {}) {
    if (!chain || !chain.length) return;
    const head = chain[0];
    const lang = this.doc.languages[head.lang];
    const langName = lang ? lang.name : head.lang;
    const terr = this.palette.territoryOf(head.lang);

    // Every step is a link. This is what the original's node-clicking gave
    // you: follow the chain upward and re-root the map on any ancestor.
    const steps = chain.map((n, i) => {
      const l = this.doc.languages[n.lang];
      const color = this.palette.cssFor(n.lang, Math.max(0, n.era - 1.4));
      return `<div class="et-p-step et-kind-${n.kind}" data-word="${n.word}"
                   data-lang="${n.lang}" title="jump to ${n.word}">
                ${i ? '<span class="et-p-arrow"></span>' : ''}
                <span class="et-p-lang">${l ? l.name : n.lang}</span>
                <span class="et-p-word" style="color:${color}">${n.word}</span>
                ${n.gloss ? `<span class="et-p-gloss">${n.gloss}</span>` : ''}
              </div>`;
    }).join('');

    const deepest = chain[chain.length - 1];
    this.elPanel.querySelector('#etPanelWord').textContent = head.word;
    this.elPanel.querySelector('#etPanelWord').style.color =
      this.palette.cssFor(head.lang, 0);
    this.elPanel.querySelector('#etPanelLang').textContent = langName;
    const note = this.elPanel.querySelector('#etPanelLemma');
    if (lemmaOf && lemmaOf.toLowerCase() !== head.word.toLowerCase()) {
      note.innerHTML = `you typed <b>${lemmaOf}</b> — an inflected form; ` +
                       `showing its lemma`;
      note.classList.add('on');
    } else {
      note.classList.remove('on');
    }
    this.elPanel.querySelector('#etPanelTerr').textContent =
      (TERRITORY[terr] || {}).name || terr;
    this.elPanel.querySelector('#etPanelTerr').style.color =
      this.palette.css(terr);
    this.elPanel.querySelector('#etPanelChain').innerHTML = steps;
    const reach = this.elPanel.querySelector('#etPanelReach');
    if (chain.length > 1) {
      reach.textContent = `${chain.length} steps, down to ` +
        `${(this.doc.languages[deepest.lang] || {}).name || deepest.lang}`;
      reach.className = 'et-panel-reach';
    } else {
      reach.textContent = head.kind === 2
        ? 'dreamed — no such word has ever existed'
        : (head.kind === 1
            ? 'conjectured — proposed, not recorded in the corpus'
            : 'the deepest form recorded here; nothing lies under it');
      reach.className = 'et-panel-reach et-reach-' + head.kind;
    }

    // The button used to say "Jump to <the word already on screen>" and
    // re-dive it, which did nothing at all -- it looked broken because it was.
    // It now goes to the deepest ancestor in the chain, which is a move you
    // can actually see; individual steps are clickable for the rest.
    const jump = this.elPanel.querySelector('#etPanelJump');
    const root = chain.length > 1 ? chain[chain.length - 1] : null;
    if (root) {
      jump.style.display = '';
      jump.textContent = `Jump to ${root.word}`;
      jump.onclick = () => {
        if (this.hooks.onJump) this.hooks.onJump(root.word, root.lang);
      };
    } else {
      jump.style.display = 'none';
    }

    for (const el of this.elPanel.querySelectorAll('.et-p-step[data-word]')) {
      el.addEventListener('click', () => {
        if (this.hooks.onJump) this.hooks.onJump(el.dataset.word, el.dataset.lang);
      });
    }

    this.showFamily(chain[0], family);

    this.elPanel.classList.add('on');
    this.panelOpen = true;
    document.body.classList.add('panel-open');
    this.loadWiktionary(head.word, langName);
    if (source) this.elPanel.dataset.source = source;
  }

  // The original pulled the Wiktionary entry into its side panel with
  // action=parse, which returns the whole page as HTML. Kept, with three
  // changes: it is https (the old http call is blocked as mixed content on any
  // https page), it uses the REST definition endpoint, and because that
  // endpoint groups definitions by language we can show only the entry for the
  // language the word is actually in -- the original dumped every language on
  // the page. A failure is quiet: the installation is expected to run with no
  // network at all, and the corpus in the panel above is already complete.
  async loadWiktionary(word, langName) {
    const box = this.elPanel.querySelector('#etPanelWiki');
    const token = Symbol('wiki');
    this.wikiToken = token;
    box.innerHTML = '<div class="et-wiki-idle">looking up Wiktionary…</div>';

    const strip = (html) => {
      const d = document.createElement('div');
      d.innerHTML = html;
      for (const n of d.querySelectorAll('script,style,sup')) n.remove();
      return (d.textContent || '').replace(/\s+/g, ' ').trim();
    };

    try {
      const url = `${WIKTIONARY}/api/rest_v1/page/definition/` +
                  encodeURIComponent(word);
      const res = await fetch(url);
      if (this.wikiToken !== token) return;
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();

      // flatten, then prefer the language this word belongs to
      let groups = [];
      for (const key of Object.keys(data)) {
        for (const g of data[key]) groups.push(g);
      }
      const mine = groups.filter(
        (g) => langName && g.language &&
               g.language.toLowerCase() === langName.toLowerCase());
      const chosen = (mine.length ? mine : groups).slice(0, 4);
      if (!chosen.length) throw new Error('empty');

      const html = chosen.map((g) => {
        const defs = (g.definitions || []).slice(0, 3).map((d) => {
          const t = strip(d.definition || '');
          return t ? `<li>${t}</li>` : '';
        }).join('');
        if (!defs) return '';
        return `<div class="et-wiki-group">
                  <div class="et-wiki-pos">
                    ${g.language || ''}${g.partOfSpeech ? ' · ' + g.partOfSpeech : ''}
                  </div>
                  <ol class="et-wiki-defs">${defs}</ol>
                </div>`;
      }).join('');
      if (!html.trim()) throw new Error('empty');

      box.innerHTML = html + `
        <div class="et-wiki-src">
          <a href="${WIKTIONARY}/wiki/${encodeURIComponent(word)}"
             target="_blank" rel="noreferrer">Wiktionary</a> ·
          text under <a href="https://creativecommons.org/licenses/by-sa/3.0/"
             target="_blank" rel="noreferrer">CC BY-SA 3.0</a>
          ${mine.length ? '' : ' · no entry for this language; showing others'}
        </div>`;
    } catch (e) {
      if (this.wikiToken !== token) return;
      box.innerHTML = '<div class="et-wiki-idle">no Wiktionary entry reachable' +
                      ' — the ancestry above is local and complete.</div>';
    }
  }

  // ---------- help ------------------------------------------------------

  wireHelp() {
    const btn = this.root.querySelector('#etHelpBtn');
    if (btn) btn.addEventListener('click', () => this.toggleHelp());
    this.elHelp.querySelector('.et-help-close')
      .addEventListener('click', () => this.closeHelp());
    this.elHelp.addEventListener('click', (e) => {
      if (e.target === this.elHelp) this.closeHelp();
    });
  }

  openHelp()   { this.elHelp.classList.add('on'); }
  closeHelp()  { this.elHelp.classList.remove('on'); }
  toggleHelp() { this.elHelp.classList.toggle('on'); }
  get helpOpen() { return this.elHelp.classList.contains('on'); }

  // ---------- audio -----------------------------------------------------
  //
  // The original autoplayed "The Meaning of Words" by Savfk on a loop, with a
  // six-bar equalizer in the corner to mute it. Browsers no longer allow
  // autoplay with sound before a gesture, so it starts muted-in-effect: the
  // bars sit still until someone presses p or clicks them, and the first
  // gesture of any kind will start it if it was asked for.

  wireAudio() {
    this.audio = document.getElementById('etSong');
    this.bars = this.root.querySelector('#etBars');
    this.audioWanted = false;
    this.bars.addEventListener('click', () => this.toggleAudio());
    this.setBars(false);
  }

  setBars(on) {
    this.bars.classList.toggle('off', !on);
    this.bars.title = on ? 'music on' : 'music off';
  }

  async toggleAudio() {
    if (!this.audio) return false;
    if (this.audioWanted) {
      this.audio.pause();
      this.audioWanted = false;
      this.setBars(false);
      return false;
    }
    this.audioWanted = true;
    try {
      await this.audio.play();
      this.setBars(true);
      return true;
    } catch (e) {
      // Blocked until a gesture; retry on the next one.
      this.setBars(false);
      return false;
    }
  }

  async resumeAudioIfWanted() {
    if (this.audioWanted && this.audio && this.audio.paused) {
      try { await this.audio.play(); this.setBars(true); } catch (e) {}
    }
  }

  // ---------- ambient captions ------------------------------------------

  openTitle()  { this.elTitle.classList.add('on'); }
  closeTitle() { this.elTitle.classList.remove('on'); }

  // ---------- the overture ----------------------------------------------
  //
  // The piece opens slowly: the wordmark surfaces and dissolves, then the
  // chart explains itself in a handful of lines before the score starts. A
  // visitor who walks in halfway through still gets the argument, because the
  // register key and the "?" panel carry it -- but someone who arrives at the
  // start should be told what they are looking at.

  // Each beat crossfades: the previous line fades out, the text and its
  // weight are swapped while nothing is visible, then the new line fades in.
  // Swapping innerHTML directly -- which is what this did at first -- made the
  // lines snap from one to the next, because the container's transition had
  // already finished running on the very first beat.
  showOverture(text, kind) {
    const el = this.elOvertureText;
    clearTimeout(this._otTimer);
    this.elOverture.classList.add('on');
    el.classList.remove('vis');                    // fade the old line out

    const swap = () => {
      el.innerHTML = text;
      this.elOverture.className = 'et-overture on' + (kind ? ' ' + kind : '');
      // two frames, so the browser paints the new text at opacity 0 before
      // the class that fades it in lands
      requestAnimationFrame(() => requestAnimationFrame(() => {
        el.classList.add('vis');
      }));
    };
    // nothing to fade out on the very first beat
    this._otTimer = setTimeout(swap, this._otShown ? OVERTURE_FADE : 260);
    this._otShown = true;
  }

  hideOverture() {
    clearTimeout(this._otTimer);
    this.elOvertureText.classList.remove('vis');
    this._otShown = false;
    this._otTimer = setTimeout(
      () => this.elOverture.classList.remove('on'), OVERTURE_FADE);
  }

  // Browsers will not start audio before a gesture. Try anyway, and if it is
  // refused, arm the next gesture of any kind and put up a quiet prompt --
  // rather than silently never playing, which is what the original's
  // `autoplay` attribute now does.
  async armAudio() {
    this.audioWanted = true;
    try {
      await this.audio.play();
      this.setBars(true);
      return true;
    } catch (e) {
      this.setBars(false);
      this.elBegin.classList.add('on');
      const start = async () => {
        try { await this.audio.play(); this.setBars(true); } catch (err) {}
        this.elBegin.classList.remove('on');
        removeEventListener('pointerdown', start);
        removeEventListener('keydown', start);
      };
      addEventListener('pointerdown', start, { once: false });
      addEventListener('keydown', start, { once: false });
      return false;
    }
  }

  showMovement(title, subtitle) {
    // A title ending in an ellipsis gets animated dots. That is how "The
    // Machine Is Dreaming…" is written in the score, so the score stays the
    // single place the piece's own words live.
    const m = /^(.*?)(\u2026|\.\.\.)\s*$/.exec(title || '');
    if (m) {
      this.elMovementTitle.innerHTML =
        `${m[1]}<span class="et-dots"><i>.</i><i>.</i><i>.</i></span>`;
    } else {
      this.elMovementTitle.textContent = title;
    }
    this.elMovementSub.textContent = subtitle || '';
    this.elMovement.classList.add('on');
  }
  hideMovement() { this.elMovement.classList.remove('on'); }

  showLineage(lineage) {
    const doc = this.doc;
    const path = lineage.paths[0] || [];
    const kinds = (lineage.kinds && lineage.kinds[0]) || [];

    const step = (id, i) => {
      const [word, code, era, kind] = doc.nodes[id];
      const lang = doc.languages[code];
      const gloss = doc.glosses[String(id)];
      const rel = i > 0 ? kinds[i - 1] : null;
      const color = this.palette.cssFor(code, Math.max(0, era - 1.6));
      return `
        <div class="et-step et-kind-${kind}">
          ${i > 0 ? `<span class="et-arrow et-rel-${rel}"></span>` : ''}
          <span class="et-lang">${lang ? lang.name : code}</span>
          <span class="et-word" style="color:${color}">${word}</span>
          ${gloss ? `<span class="et-gloss">${gloss}</span>` : ''}
        </div>`;
    };

    const dreams = (lineage.dreams || []).map((id) => {
      const [word, code] = doc.nodes[id];
      const lang = doc.languages[code];
      const gloss = doc.glosses[String(id)];
      return `
        <div class="et-step et-kind-2">
          <span class="et-arrow et-rel-3"></span>
          <span class="et-lang">${lang ? lang.name : code}</span>
          <span class="et-word">${word}</span>
          ${gloss ? `<span class="et-gloss">${gloss}</span>` : ''}
        </div>`;
    }).join('');

    this.elCaption.innerHTML =
      path.map(step).join('') +
      (dreams ? `<div class="et-dream-head">dreamed</div>${dreams}` : '');
    this.elCaption.classList.add('on');
  }

  hideLineage() { this.elCaption.classList.remove('on'); }

  // the little label that follows the cursor in explore mode
  tip(text, x, y, sub) {
    if (!text) { this.elTip.classList.remove('on'); return; }
    this.elTip.innerHTML = `<b>${text}</b>${sub ? `<i>${sub}</i>` : ''}`;
    this.elTip.style.transform = `translate(${x + 16}px, ${y + 14}px)`;
    this.elTip.classList.add('on');
  }

  listening(on, heard) {
    this.elListening.classList.toggle('on', !!on);
    if (heard !== undefined) this.elHeard.textContent = heard;
  }
}
