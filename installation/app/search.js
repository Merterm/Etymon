// Etymon — search.
//
// The 2018 app had a search box whose server ran `grep ": <word>\t" etymon.tsv`
// against the 332 MB master graph. That worked and then stopped working, because
// it needed a server and the server went away.
//
// This is the same capability as static files. pipeline/searchindex.py
// precomputes the ancestry of every word in the corpus that has one -- 239,094
// of them -- and shards it by the first one or two letters. Typing fetches one
// shard, around 15 kB, and nothing else. It works with the network unplugged,
// which is the state a gallery machine should be able to be in.
//
// Ancestors repeat enormously, so a shard stores a deduplicated pool of forms
// and each chain is a list of indices into it. Rehydrating is a lookup.

export function fold(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

function shardKey(folded) {
  if (!folded) return '_';
  const c = folded[0];
  if (c >= '0' && c <= '9') return '0';
  const ascii = c.charCodeAt(0) < 128 && /[a-z]/.test(c);
  if (!ascii) return 'u' + c.charCodeAt(0).toString(16).padStart(4, '0');
  const a = /[a-z]/, c2 = folded[1], c3 = folded[2];
  if (c2 && c3 && c2.charCodeAt(0) < 128 && c3.charCodeAt(0) < 128 &&
      a.test(c2) && a.test(c3)) return folded.slice(0, 3);
  if (c2 && c2.charCodeAt(0) < 128 && a.test(c2)) return folded.slice(0, 2);
  return c + '_';
}

// The bucket a *prefix* lives in. Words are sharded three characters deep to
// keep the Latin buckets small, which means a two-character prefix cannot
// reach them -- there is no way to know which third letter to fetch. Prefixes
// get their own two-deep index instead.
function suggestKey(folded) {
  if (!folded) return '_';
  const a = /[a-z]/, c = folded[0];
  if (!(c.charCodeAt(0) < 128 && a.test(c))) {
    return 'u' + c.charCodeAt(0).toString(16).padStart(4, '0');
  }
  const c2 = folded[1];
  if (c2 && c2.charCodeAt(0) < 128 && a.test(c2)) return folded.slice(0, 2);
  return c + '_';
}

export class Search {
  constructor({ base = 'data/index', doc }) {
    this.base = base;
    this.doc = doc;
    this.shards = new Map();     // key -> {pool, index} | 'missing'
    this.pending = new Map();
    this.buckets = new Map();    // prefix key -> rows | 'missing'
    this.manifest = null;
    this.available = false;
  }

  async bucket(key) {
    if (this.buckets.has(key)) return this.buckets.get(key);
    let val = 'missing';
    try {
      const res = await fetch(`${this.base}/suggest/${key}.json`);
      if (res.ok) val = await res.json();
    } catch (e) { /* absent or offline */ }
    this.buckets.set(key, val);
    if (this.buckets.size > 24) {
      const oldest = this.buckets.keys().next().value;
      if (oldest !== key) this.buckets.delete(oldest);
    }
    return val;
  }

  async init() {
    try {
      const res = await fetch(`${this.base}/manifest.json`);
      if (!res.ok) throw new Error(String(res.status));
      this.manifest = await res.json();
      this.available = true;
    } catch (e) {
      // No index built. Search falls back to the composed lineages only.
      this.available = false;
    }
    return this.available;
  }

  async shard(key) {
    if (this.shards.has(key)) return this.shards.get(key);
    if (this.pending.has(key)) return this.pending.get(key);
    const p = (async () => {
      let val = 'missing';
      if (!this.manifest || this.manifest.shards[key]) {
        try {
          const res = await fetch(`${this.base}/${key}.json`);
          if (res.ok) val = await res.json();
        } catch (e) { /* offline or absent: treated as missing */ }
      }
      this.shards.set(key, val);
      this.pending.delete(key);
      // Keep only a handful of shards; a long gallery run must not accumulate.
      if (this.shards.size > 14) {
        const oldest = this.shards.keys().next().value;
        if (oldest !== key) this.shards.delete(oldest);
      }
      return val;
    })();
    this.pending.set(key, p);
    return p;
  }

  // Exact lookup. Returns [{chain:[...], lemmaOf?}] or [].
  //
  // Most of the corpus is inflectional: "transpareamus" is one of fifty forms
  // of the same Latin verb. Those are indexed as a pointer to their lemma
  // rather than as fifty copies of one chain, so looking one up resolves to
  // the headword and reports what it did, which the panel then says out loud.
  async lookup(word, depth) {
    const f = fold(word);
    if (!f) return [];
    const sh = await this.shard(shardKey(f));
    if (!sh || sh === 'missing') return [];

    if (sh.index[f]) return this.hydrate(sh, sh.index[f]);

    if (sh.lemma && sh.lemma[f] !== undefined && !(depth > 1)) {
      const ident = sh.lpool[sh.lemma[f]];
      if (!ident) return [];
      const i = ident.indexOf('|');
      const lemma = ident.slice(i + 1);
      const hits = await this.lookup(lemma, (depth || 0) + 1);
      for (const h of hits) {
        h.lemmaOf = word;              // what was typed
        h.lemma = lemma;               // what is being shown instead
      }
      return hits;
    }
    return [];
  }

  hydrate(sh, chains) {
    return chains.map((chain) => ({
      chain: chain.map((pi) => {
        const [w, lang, era, kind, gloss] = sh.pool[pi];
        return { word: w, lang, era, kind, gloss: gloss || '' };
      }),
    }));
  }

  // What to do when the exact word is not there. Rather than a dead end, look
  // for the nearest thing in the same shard: a prefix, a word this is a prefix
  // of, or a single-character slip. Typing a name or a word the dictionaries
  // never recorded should still land somewhere, or say clearly that it cannot.
  async nearest(word, limit = 8) {
    const f = fold(word);
    if (f.length < 2) return [];
    const sh = await this.shard(shardKey(f));
    if (!sh || sh === 'missing') return [];

    const within1 = (a, b) => {
      if (Math.abs(a.length - b.length) > 1) return false;
      let i = 0, j = 0, slips = 0;
      while (i < a.length && j < b.length) {
        if (a[i] === b[j]) { i++; j++; continue; }
        if (++slips > 1) return false;
        if (a.length > b.length) i++;
        else if (a.length < b.length) j++;
        else { i++; j++; }
      }
      return slips + (a.length - i) + (b.length - j) <= 1;
    };

    const out = [];
    for (const key of Object.keys(sh.index)) {
      let rank = null;
      if (key.startsWith(f)) rank = 0;
      else if (f.startsWith(key) && key.length >= 3) rank = 1;
      else if (within1(f, key)) rank = 2;
      if (rank === null) continue;
      const first = sh.index[key][0];
      out.push({ word: sh.pool[first[0]][0], key, rank,
                 steps: first.length,
                 deepest: first.reduce((acc, pi) => {
                   const e = sh.pool[pi][2];
                   return e > acc.era ? { era: e, lang: sh.pool[pi][1] } : acc;
                 }, { era: -1, lang: '' }) });
      if (out.length > limit * 12) break;
    }
    out.sort((a, b) => a.rank - b.rank ||
                       a.word.length - b.word.length ||
                       b.steps - a.steps);
    return out.slice(0, limit);
  }

  // Prefix suggestions, out of the prefix index.
  async suggest(prefix, limit = 8) {
    const f = fold(prefix);
    if (f.length < 2) return [];
    const rows = await this.bucket(suggestKey(f));
    if (!rows || rows === 'missing') return [];
    const out = [];
    let rank = 0;
    for (const [word, steps, deep] of rows) {
      if (!word.startsWith(f)) continue;
      // The bucket arrives ranked by how connected a word is, which is the
      // best measure of ordinariness the corpus offers. Keep that position.
      out.push({ word, key: word, steps, rank: rank++, inflected: false,
                 deepest: { era: 4, lang: deep || '' } });
      if (out.length >= limit * 6) break;
    }
    // Rank for what someone is actually looking for: the exact word first,
    // then plain words over affixed and hyphenated ones, then the index's own
    // order.
    //
    // This used to sort on word length instead, which discarded the ranking
    // the index had just spent a build computing. Among words beginning
    // "mot" it offered mote, moth, moto, motel and motif before "mother" --
    // six shorter words nobody typed "mot" looking for. Length survives only
    // as a tiebreak between words the corpus finds equally connected.
    const isAffix = (w) => /[-']/.test(w);
    out.sort((a, b) =>
      (a.key === f ? 0 : 1) - (b.key === f ? 0 : 1) ||
      (a.inflected ? 1 : 0) - (b.inflected ? 1 : 0) ||
      (isAffix(a.word) ? 1 : 0) - (isAffix(b.word) ? 1 : 0) ||
      a.rank - b.rank ||
      a.word.length - b.word.length);
    return out.slice(0, limit);
  }
}
