// Etymon — the microphone.
//
// Optional and always secondary. The piece is built to run for a month in an
// empty room; if speech recognition is missing, denied, or the room is simply
// too loud, nothing here is load-bearing and the ambient score continues.
//
// A visitor says a word. We look it up in the ocean's own vocabulary -- across
// every language in the corpus, not just English -- and if it is found, the
// installation dives for it. If it is not found, that silence is left alone:
// no error, no "not found", nothing that would turn the room into a kiosk.

export class Voice {
  constructor({ languages, onWord, onState }) {
    this.onWord = onWord;
    this.onState = onState || (() => {});
    this.enabled = false;
    this.recog = null;
    this.wantOn = false;

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.supported = !!SR;
    if (!this.supported) return;

    const r = new SR();
    r.continuous = true;
    r.interimResults = false;
    r.maxAlternatives = 3;
    // Recognition is mostly English-trained; the lookup is multilingual, so a
    // roughly-heard token can still land on a Turkish or Latin entry.
    r.lang = 'en-US';

    r.onresult = (ev) => {
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const res = ev.results[i];
        if (!res.isFinal) continue;
        for (let a = 0; a < res.length; a++) {
          const text = res[a].transcript.trim().toLowerCase();
          for (const token of text.split(/[^\p{L}\p{M}'’-]+/u)) {
            if (token.length < 2) continue;
            if (this.onWord(token)) {
              this.onState('heard', token);
              return;
            }
          }
        }
      }
    };

    r.onerror = (ev) => {
      // 'no-speech' and 'aborted' are routine in a gallery; don't thrash.
      if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') {
        this.wantOn = false;
        this.enabled = false;
        this.onState('denied');
      }
    };

    r.onend = () => {
      this.enabled = false;
      if (this.wantOn) {
        // Chrome ends the session periodically; restart with a small delay so
        // a permission failure can't become a hot loop.
        setTimeout(() => { if (this.wantOn) this.start(); }, 700);
      } else {
        this.onState('off');
      }
    };

    this.recog = r;
  }

  start() {
    if (!this.recog) return false;
    this.wantOn = true;
    try {
      this.recog.start();
      this.enabled = true;
      this.onState('on');
      return true;
    } catch (e) {
      return false;      // already started; harmless
    }
  }

  stop() {
    this.wantOn = false;
    if (this.recog) { try { this.recog.stop(); } catch (e) {} }
    this.enabled = false;
  }

  toggle() { return this.wantOn ? (this.stop(), false) : this.start(); }
}

// Build the lookup the microphone and the keyboard both use: every seed word
// in the score, plus every word in any lineage, keyed loosely so that
// "hallucinate" and "Hallucinate" and a stray accent all land.
export function buildIndex(doc) {
  const fold = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const index = new Map();
  doc.movements.forEach((m, mi) => {
    m.lineages.forEach((l, li) => {
      const add = (id) => {
        const key = fold(doc.nodes[id][0]);
        if (!index.has(key)) index.set(key, { movement: mi, lineage: li });
      };
      add(l.seed);
      l.nodes.forEach(add);
    });
  });
  return { index, fold, find: (w) => index.get(fold(w)) || null };
}
