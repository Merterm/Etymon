// Etymon — a word's neighbourhood.
//
// The 2018 app asked its server for a word and the server grepped every line
// of the 332 MB master graph that mentioned it. That is why the old screens
// were busy: everything one hop away arrived at once, whatever kind of
// relation it was.
//
// The search index replaced that with a precomputed chain -- one thread of
// ancestors and nothing else. Accurate, tiny, and much lonelier than the
// original: it dropped 2.26M derivations, 326k cognate links and every
// spelling variant the corpus records.
//
// pipeline/neighbours.py restores the lookup as static shards, keyed the same
// way as the search index. Fetching one is a few kilobytes and works with the
// network unplugged, which is the state a gallery machine should be able to
// be in. Six relations come back, kept apart:
//
//   p parents · c children · g cognates · d bases · f formations · v variants
//
// Where a hub was capped at build time the record carries the number left
// behind, so the panel can say "+1,247 more" rather than pretend it has them,
// and clicking that asks the server for the rest if the server has them.

import { fold } from './search.js';
import { RELATIONS } from './lineage.js';

// build-time caps mean a shard row can say "and this many more"
export const SLOT_LABEL = {
  p: 'from', c: 'gave', g: 'kin to', d: 'built on', f: 'built into',
  v: 'also spelled',
};

const SLOT_REL = {
  p: RELATIONS.descends, c: RELATIONS.descends, g: RELATIONS.cognate,
  d: RELATIONS.derived, f: RELATIONS.derived, v: RELATIONS.variant,
};

// which way the edge runs: a parent is above the word, a child below
const SLOT_UP = { p: true, c: false, g: null, d: true, f: false, v: null };

// Which file holds a word.
//
// Three characters for most of the alphabet, but the dense prefixes are split
// deeper at build time -- "con" alone came to 4.4 MB, and nobody should wait
// on that to be shown eight related words. The manifest lists the keys that
// were actually written, so rather than guessing a depth we take the longest
// written key that prefixes the word. That way the split can be retuned in
// the pipeline without touching this file.
// The *logical* key is a prefix of the folded word: three characters for
// Latin script, one for everything else, and deeper wherever the corpus is
// dense enough that a shard got fat -- "con" alone came to 4.4 MB, and nobody
// should wait on that to be shown eight related words. The manifest lists the
// keys that were actually written, so rather than hard-coding a depth here we
// take the longest written key that prefixes the word.
//
// The *filename* is that key with everything but ASCII alphanumerics encoded,
// which is what lets the Cyrillic and Armenian shards be split as freely as
// the Latin ones. pipeline/neighbours.py has the same two functions.
function baseKey(folded) {
  if (!folded) return '_';
  const a = /[a-z]/i, c = folded[0];
  if (c >= '0' && c <= '9') return '0';
  if (!(c.charCodeAt(0) < 128 && a.test(c))) return c;
  const c2 = folded[1], c3 = folded[2];
  const l2 = c2 && c2.charCodeAt(0) < 128 && a.test(c2);
  const l3 = c3 && c3.charCodeAt(0) < 128 && a.test(c3);
  if (l2 && l3) return folded.slice(0, 3);
  if (l2) return folded.slice(0, 2);
  return c + '_';
}

function fileOf(key) {
  let out = '';
  for (const ch of key) {
    out += /[a-z0-9]/i.test(ch) && ch.charCodeAt(0) < 128
      ? ch : 'u' + ch.charCodeAt(0).toString(16).padStart(4, '0');
  }
  return out;
}

export class Neighbours {
  constructor({ base = 'data/index/nbr', doc = null } = {}) {
    this.base = base;
    // The live lookup answers with a language code and no era; the era is a
    // property of the language, and the graph already carries the table.
    this.doc = doc;
    this.shards = new Map();      // key -> shard | 'missing'
    this.pending = new Map();
    this.available = false;
    this.manifest = null;
  }

  // ---- the uncapped lookup ---------------------------------------------
  //
  // The shards cap a hub -- 24 formations, 24 children -- because no view can
  // show 1,271 of them and no shard should be a megabyte. The rest are still
  // in the master graph, and serve.py will scan it on request if the host has
  // it. That is the 2018 back end, unchanged in kind: one word in, every line
  // that mentions it out.
  //
  // Probed once, lazily, on the first time a visitor asks to see more. A
  // gallery machine without the master graph gets a 503, the offer is
  // withdrawn, and the piece carries on with what the shards hold.
  async full(word, lang) {
    if (this.live === false) return null;
    try {
      const r = await fetch(`lookup?w=${encodeURIComponent(word)}` +
                            `&lang=${encodeURIComponent(lang || '')}`);
      if (!r.ok) { this.live = false; return null; }
      const d = await r.json();
      this.live = true;
      const out = { word, lang, slots: {}, more: {}, total: 0 };
      for (const slot of Object.keys(d.slots || {})) {
        const langs = (this.doc && this.doc.languages) || {};
        const list = d.slots[slot].map(([w, code]) => ({
          word: w, lang: code, slot,
          era: (langs[code] && langs[code].depth) || 0,
        }));
        if (!list.length) continue;
        out.slots[slot] = list;
        out.more[slot] = 0;
        out.total += list.length;
      }
      return out.total ? out : null;
    } catch (e) {
      this.live = false;
      return null;
    }
  }

  async load() {
    try {
      const r = await fetch(`${this.base}/manifest.json`, { cache: 'force-cache' });
      if (!r.ok) throw new Error(r.status);
      this.manifest = await r.json();
      this.available = true;
    } catch (e) {
      // No index built, or a deployment that ships without it. The piece
      // falls back to the bare ancestor chain, which is what it did before
      // this file existed -- nothing throws, there is just less to see.
      this.available = false;
    }
    return this.available;
  }

  // The longest written key that prefixes this word.
  keyFor(folded) {
    const base = baseKey(folded);
    const have = (this.manifest && this.manifest.shards) || {};
    let best = base;
    for (let n = base.length + 1; n <= folded.length; n++) {
      const k = folded.slice(0, n);
      if (have[k] === undefined) break;
      best = k;
    }
    return best;
  }

  async shard(key) {
    if (this.shards.has(key)) return this.shards.get(key);
    if (this.pending.has(key)) return this.pending.get(key);
    const p = (async () => {
      let out = 'missing';
      try {
        const r = await fetch(`${this.base}/${fileOf(key)}.json`,
                              { cache: 'force-cache' });
        if (r.ok) out = await r.json();
      } catch (e) { /* offline, or no such shard: 'missing' */ }
      this.shards.set(key, out);
      this.pending.delete(key);
      return out;
    })();
    this.pending.set(key, p);
    return p;
  }

  // Everything the corpus records about one word, or null.
  //
  // `lang` disambiguates homographs: the shard holds up to four senses of a
  // folded key -- English "fire" beside Norwegian "fire", the number four --
  // and answering with the wrong language is worse than answering with
  // nothing, because it looks right.
  async of(word, lang) {
    if (!this.available) return null;
    const f = fold(word);
    if (!f) return null;
    const sh = await this.shard(this.keyFor(f));
    if (!sh || sh === 'missing') return null;
    const rows = sh.n && sh.n[f];
    if (!rows || !rows.length) return null;

    let row = rows[0];
    if (lang) {
      const exact = rows.find((r) => r[1] === lang);
      if (exact) row = exact;
      else if (rows.length > 1) {
        // no entry for that language: the folded key belongs to somebody
        // else's word, and its family is not this word's family
        return null;
      }
    }
    const [surface, code, rec] = row;
    const out = { word: surface, lang: code, slots: {}, more: {}, total: 0 };
    for (const slot of Object.keys(rec)) {
      const [ids, more] = rec[slot];
      const list = [];
      for (const i of ids) {
        const p = sh.pool[i];
        if (!p) continue;
        list.push({ word: p[0], lang: p[1], era: p[2], slot });
      }
      if (!list.length) continue;
      out.slots[slot] = list;
      out.more[slot] = more || 0;
      out.total += list.length;
    }
    return out.total ? out : null;
  }

  // Grow a lineage sideways.
  //
  // Takes the chain the search index gave us and the ids it landed on, asks
  // for the neighbourhood of each of the first few links, and folds what
  // comes back into the same node and edge tables the composed lineages use.
  // Every added edge carries its own relation, so the shader draws descent,
  // derivation, cognacy and variance as four different lines rather than
  // flattening them into one grey web.
  //
  // Only the first few links are expanded: the neighbourhood of a
  // Proto-Indo-European root is tens of thousands of words, and a view that
  // tried to hold them would say less than one that does not.
  async expand(doc, chain, ids, { depth = 3, budget = 300, mint, link } = {}) {
    if (!this.available || !chain || !chain.length) return null;
    const added = [];
    const seen = new Set(ids.map((id) => `${doc.nodes[id][1]}|${doc.nodes[id][0]}`));
    const counts = {};
    let more = 0;

    const lookups = await Promise.all(
      chain.slice(0, depth).map((n) => this.of(n.word, n.lang).catch(() => null)));

    for (let i = 0; i < lookups.length; i++) {
      const nb = lookups[i];
      if (!nb) continue;
      const anchor = ids[i];
      for (const slot of ['c', 'f', 'g', 'v', 'd', 'p']) {
        const list = nb.slots[slot];
        if (!list) continue;
        more += nb.more[slot] || 0;
        for (const w of list) {
          if (added.length >= budget) { more += 1; continue; }
          const key = `${w.lang}|${w.word}`;
          if (seen.has(key)) continue;
          seen.add(key);
          // `mint` reuses a node if this word has been raised before, so
          // repeated dives do not grow doc.nodes without bound.
          const id = mint ? mint(w.word, w.lang, w.era, 0)
                          : doc.nodes.push([w.word, w.lang, w.era, 0]) - 1;
          const up = SLOT_UP[slot];
          const rel = SLOT_REL[slot];
          // Direction matters to the drawing: descent runs child -> parent
          // everywhere else in the piece, so a *child* of the anchor is
          // stored the other way round, and the filament leans accordingly.
          const edge = up === false ? [id, anchor, rel] : [anchor, id, rel];
          if (link) link(edge[0], edge[1], edge[2]);
          else doc.edges.push(edge);
          added.push(id);
          counts[slot] = (counts[slot] || 0) + 1;
        }
      }
    }
    // `head` is the seed word's own record, kept so the panel can list the
    // relations by name rather than re-fetching the shard it just read.
    return { added, counts, more, head: lookups[0] || null };
  }
}
