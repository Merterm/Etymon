// Etymon — the visual system.
//
// Three things are encoded in a word's appearance, and they are meant to be
// readable across a projected room from ten metres away:
//
//   hue        which language family it belongs to (its "current")
//   luminance  how deep in time it sits
//   register   whether it is attested, conjectured, or dreamed
//
// Depth is rendered as water rather than as a scale. Sea water absorbs long
// wavelengths first -- red is gone within a few metres, blue carries furthest
// -- so a word's colour is pushed toward the deep blue-green of the ambient
// water as its era gets older, and dimmed. The Latinate current is warm gold
// at the surface and turns cold and faint by Proto-Indo-European. Nothing has
// to be explained for this to read: it is how depth already looks.

export const BACKGROUND = 0x01060b;      // the deep, behind everything
export const WATER = [0.043, 0.129, 0.180];  // the colour depth pulls toward

// Registers. Kept visually distinct because the whole argument of the piece
// depends on the audience being able to tell -- or notice that they cannot.
export const ATTESTED = 0;
export const CONJECTURE = 1;
export const DREAM = 2;

export const REGISTER_LABEL = {
  0: 'attested',
  1: 'conjectured',
  2: 'dreamed',
};

export const REGISTER_NOTE = {
  0: 'asserted by one of the four source corpora',
  1: 'absent from every corpus — proposed, and drawn as a proposal',
  2: 'invented. no such word has ever existed',
};

function hexToRgb(hex) {
  const h = typeof hex === 'string' ? parseInt(hex.replace('#', ''), 16) : hex;
  return [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
}

// Territory colours. Twelve regions rather than fourteen currents -- Baltic
// and Slavic are folded into one because they are a real clade, and Armenian,
// Albanian, Anatolian and Proto-Indo-European itself share a region instead of
// each taking a hue. The colours sit in a narrow band (L* around 75, chroma
// around 30) so the map reads as one image rather than as confetti; the earlier
// palette was fully saturated and made twelve families look like a hundred.
export const TERRITORY = {
  'romance':      { name: 'Italic and Romance',      color: '#e2b268' },
  'germanic':     { name: 'Germanic',                color: '#7bc6da' },
  'balto-slavic': { name: 'Balto-Slavic',            color: '#de8fa2' },
  'hellenic':     { name: 'Hellenic',                color: '#b7a4de' },
  'celtic':       { name: 'Celtic',                  color: '#86cfa4' },
  'indo-iranian': { name: 'Indo-Iranian',            color: '#e09b7c' },
  'ie-other':     { name: 'Indo-European, other',    color: '#a8a8d8' },
  'turkic':       { name: 'Turkic',                  color: '#79cfc2' },
  'semitic':      { name: 'Semitic and Afro-Asiatic',color: '#c4ce86' },
  'uralic':       { name: 'Uralic',                  color: '#d79bc4' },
  'distant':      { name: 'Distant waters',          color: '#c9c4b6' },
  'constructed':  { name: 'Constructed',             color: '#ede8dc' },
};

export class Palette {
  constructor(doc) {
    this.doc = doc;
    this.rgb = {};
    for (const key of Object.keys(TERRITORY)) {
      this.rgb[key] = hexToRgb(TERRITORY[key].color);
    }
  }

  // The territory a language belongs to. Written into the data by
  // pipeline/cartography.py so the mapping cannot drift from the layout.
  territoryOf(code) {
    const lang = this.doc.languages[code];
    if (!lang) return 'distant';
    return lang.territory || 'distant';
  }

  // era 0 (living) .. 4 (reconstructed) -> colour as seen through that much water
  colorAt(territory, era) {
    const base = this.rgb[territory] || this.rgb.distant;
    const t = Math.min(Math.max(era, 0), 4) / 4;
    const absorb = [1 - 0.72 * t, 1 - 0.5 * t, 1 - 0.22 * t];
    const dim = 1 - 0.34 * t;
    return [
      (base[0] * absorb[0] * (1 - t * 0.55) + WATER[0] * t * 0.55) * dim,
      (base[1] * absorb[1] * (1 - t * 0.55) + WATER[1] * t * 0.55) * dim,
      (base[2] * absorb[2] * (1 - t * 0.55) + WATER[2] * t * 0.55) * dim,
    ];
  }

  colorFor(code, era) {
    return this.colorAt(this.territoryOf(code), era);
  }

  cssAt(territory, era) {
    const c = this.colorAt(territory, era);
    const f = (v) => Math.round(Math.min(1, Math.max(0, v)) * 255);
    return `rgb(${f(c[0])},${f(c[1])},${f(c[2])})`;
  }

  cssFor(code, era) {
    return this.cssAt(this.territoryOf(code), era);
  }

  css(territory) {
    return TERRITORY[territory] ? TERRITORY[territory].color : '#c9c4b6';
  }
}

// Constructed languages are drawn hollow and pinned to the surface: Esperanto
// and Volapuk are inventions with no ancestry to sink into, which makes them
// the one place in the piece where a human-made word and a machine-made one
// are doing the same thing.
export function isHollow(current) {
  return current === 'constructed';
}
