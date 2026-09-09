// Etymon — the word atlas.
//
// The ocean draws thousands of words a frame, in Latin, Arabic, Hebrew, Greek,
// Cyrillic, Devanagari, Han and a dozen other scripts. Drawing them as DOM or
// as individual meshes would die immediately, so every word is rasterised once
// into a shared texture and the sea is one instanced draw call that samples it.
//
// Each cell is drawn twice: a blurred pass, then a sharp pass on top. That
// bakes the glow into the glyph, which means the whole piece gets its
// underwater bloom without a postprocessing pass -- additive blending on the
// quads does the rest. The atlas is a single alpha channel; colour comes from
// the per-instance attribute, so one atlas serves every language.
//
// Capacity is finite and the vocabulary is not, so the sea's words turn over:
// recycle() re-rasterises the least recently claimed cells, and the ocean
// slowly changes what it is saying over the course of an hour.

import * as THREE from '../vendor/three.module.js';

// A stack wide enough to cover the scripts the corpora actually contain.
// macOS resolves nearly all of these from system fonts; anything genuinely
// missing shows as a blank cell rather than a tofu box, because we measure the
// drawn ink and reject empty renders.
const FONT_STACK = [
  '"Iowan Old Style"', '"Palatino"', '"Charter"',
  '"Geeza Pro"', '"Al Bayan"',            // Arabic
  '"Mshtakan"',                            // Armenian
  '"Noto Serif Hebrew"', '"Times New Roman"',
  '"Hiragino Mincho ProN"', '"Songti SC"', // Japanese / Chinese
  '"AppleMyungjo"',                        // Korean
  '"Devanagari MT"', '"Kohinoor Devanagari"',
  '"Noto Serif Georgian"', '"Noto Serif Syriac"',
  '"Noto Sans Cuneiform"', '"Noto Sans Gothic"',
  'serif',
].join(', ');

export class WordAtlas {
  constructor({ width = 4096, height = 2048, fontSize = 30, pad = 6 } = {}) {
    this.width = width;
    this.height = height;
    this.fontSize = fontSize;
    this.pad = pad;
    this.rowHeight = Math.ceil(fontSize * 1.45) + pad;

    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: false });
    this.ctx.textBaseline = 'middle';
    this.ctx.textAlign = 'left';

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.generateMipmaps = false;
    this.texture.colorSpace = THREE.NoColorSpace;
    // Cell rectangles below are recorded in canvas coordinates, y growing
    // downward. three.js flips canvas textures on upload by default, which
    // slides every cell half a row out of register -- each quad then samples
    // the blank gap between two baselines and the whole sea renders empty.
    this.texture.flipY = false;

    // shelf packing
    this.penX = pad;
    this.penY = pad;
    this.cells = new Map();      // word -> {rect:[u0,v0,du,dv], aspect, tick}
    this.order = [];             // insertion order, for recycling
    this.tick = 0;
    this.full = false;
    this.dirty = true;
  }

  get count() { return this.cells.size; }

  // Returns {rect, aspect} or null when the word could not be placed or drew
  // no ink at all (a script this machine has no font for).
  claim(word) {
    const hit = this.cells.get(word);
    if (hit) { hit.tick = this.tick++; return hit; }

    const ctx = this.ctx;
    ctx.font = `${this.fontSize}px ${FONT_STACK}`;
    const metrics = ctx.measureText(word);
    const w = Math.ceil(metrics.width) + this.pad * 2;
    if (w > this.width) return null;

    if (this.penX + w > this.width) {          // next shelf
      this.penX = this.pad;
      this.penY += this.rowHeight;
    }
    if (this.penY + this.rowHeight > this.height) {
      this.full = true;
      return null;
    }

    const x = this.penX;
    const y = this.penY;
    const cy = y + this.rowHeight / 2;

    // glow pass, then the sharp glyph over it
    ctx.save();
    ctx.shadowColor = 'rgba(255,255,255,0.85)';
    ctx.shadowBlur = this.fontSize * 0.55;
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillText(word, x + this.pad, cy);
    ctx.shadowBlur = this.fontSize * 0.22;
    ctx.fillStyle = 'rgba(255,255,255,1)';
    ctx.fillText(word, x + this.pad, cy);
    ctx.restore();

    this.penX += w;
    this.dirty = true;

    const cell = {
      rect: [x / this.width, y / this.height,
             w / this.width, this.rowHeight / this.height],
      aspect: w / this.rowHeight,
      word,
      tick: this.tick++,
    };
    this.cells.set(word, cell);
    this.order.push(word);
    return cell;
  }

  // Fill from a pool until the atlas is full. Returns the cells placed.
  fill(words) {
    const placed = [];
    for (const w of words) {
      if (this.full) break;
      const cell = this.claim(w);
      if (cell) placed.push(cell);
    }
    this.commit();
    return placed;
  }

  // Start the shelf over.
  //
  // The header above has always promised recycling and there was never any:
  // once the pen ran off the bottom of the canvas the atlas was full forever,
  // and claim() returned null for every word after that. For the sea that was
  // survivable -- it fills once from a fixed pool. For the reading atlas it
  // was not: the lineage stage silently dropped every word it could not
  // rasterise, so a raised word's family arrived from the index, was laid
  // out, and then vanished on its way to the screen. 340 nodes came out as
  // 14, and a Turkish word came out as none at all.
  //
  // A raised lineage re-claims everything it needs each time it is shown, so
  // for that atlas clearing the whole canvas is safe and costs one texture
  // upload. Nothing else holds a cell across the call.
  reset() {
    this.ctx.clearRect(0, 0, this.width, this.height);
    this.cells.clear();
    this.order.length = 0;
    this.penX = this.pad;
    this.penY = this.pad;
    this.full = false;
    this.dirty = true;
    this.resets = (this.resets || 0) + 1;
  }

  commit() {
    if (this.dirty) {
      this.texture.needsUpdate = true;
      this.dirty = false;
    }
  }

  dispose() {
    this.texture.dispose();
  }
}
