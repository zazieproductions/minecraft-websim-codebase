// Renders sign blocks (63 standing, 68 wall) as small 3D boards with their text drawn by the bitmap font
import * as THREE from 'three';
import { drawTile } from './textures.js';
import { drawTextCentered } from '../gui/font.js';
import { idx } from '../world/chunk.js';

const W = 96, H = 48; // text canvas: 1 px = 1/96 of the board width
let woodMat = null;
function wood() {
  if (woodMat) return woodMat; const cv = document.createElement('canvas'); cv.width = cv.height = 16; drawTile(cv.getContext('2d'), 'planks', 0, 0, 16);
  const t = new THREE.CanvasTexture(cv); t.magFilter = t.minFilter = THREE.NearestFilter; t.colorSpace = THREE.NoColorSpace; t.generateMipmaps = false;
  return woodMat = t;
}
const BOARD = new THREE.BoxGeometry(1, 0.5, 1 / 12), POST = new THREE.BoxGeometry(1 / 12, 0.5, 1 / 12), TEXT = new THREE.PlaneGeometry(0.94, 0.47);
const ROT = { 2: Math.PI, 3: 0, 4: -Math.PI / 2, 5: Math.PI / 2 };

export class Signs {
  constructor(game) { this.g = game; this.map = new Map(); this.dirty = true; this.n = 0; }
  markDirty() { this.dirty = true; }
  clear() { for (const s of this.map.values()) this._dispose(s); this.map.clear(); this.dirty = true; }
  _dispose(s) { this.g.renderer.scene.remove(s.group); s.tex.dispose(); s.textMat.dispose(); s.mat.dispose(); }
  _drawText(s, lines) {
    const ctx = s.cv.getContext('2d'); ctx.clearRect(0, 0, W, H); ctx.imageSmoothingEnabled = false;
    lines.forEach((l, i) => drawTextCentered(ctx, l, W / 2, 4 + i * 10, '#000000', false)); s.tex.needsUpdate = true; s.key = lines.join('\n');
  }
  _make(x, y, z, id, meta, lines) {
    const group = new THREE.Group(); group.position.set(x + 0.5, y, z + 0.5);
    const mat = new THREE.MeshBasicMaterial({ map: wood() });
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const tex = new THREE.CanvasTexture(cv); tex.magFilter = tex.minFilter = THREE.NearestFilter; tex.colorSpace = THREE.NoColorSpace; tex.generateMipmaps = false;
    const textMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.3, depthWrite: false });
    const board = new THREE.Mesh(BOARD, mat), text = new THREE.Mesh(TEXT, textMat);
    if (id === 63) { group.rotation.y = (meta & 15) * Math.PI / 8; board.position.set(0, 0.75, 0); text.position.set(0, 0.75, 1 / 24 + 0.002); const post = new THREE.Mesh(POST, mat); post.position.set(0, 0.25, 0); group.add(post); }
    else { group.rotation.y = ROT[meta] ?? 0; board.position.set(0, 0.53, -0.5 + 1 / 24); text.position.set(0, 0.53, -0.5 + 1 / 12 + 0.002); }
    group.add(board, text); this.g.renderer.scene.add(group);
    const s = { group, mat, textMat, tex, cv, id, meta, x, y, z }; this._drawText(s, lines); return s;
  }
  // rescan loaded chunks for sign tiles when something changed (and every second as a safety net)
  _sync() {
    const w = this.g.world; if (!w) return; const seen = new Set();
    for (const c of w.chunks.values()) for (const [i, tile] of c.tiles) {
      if (!tile || !tile.text) continue; const lx = i & 15, lz = (i >> 4) & 15, y = i >> 8; const id = c.blocks[idx(lx, y, lz)]; if (id !== 63 && id !== 68) continue;
      const x = c.cx * 16 + lx, z = c.cz * 16 + lz, meta = c.meta[idx(lx, y, lz)]; const k = x + ',' + y + ',' + z; seen.add(k);
      let s = this.map.get(k); if (s && (s.id !== id || s.meta !== meta)) { this._dispose(s); this.map.delete(k); s = null; }
      if (!s) this.map.set(k, this._make(x, y, z, id, meta, tile.text)); else if (s.key !== tile.text.join('\n')) this._drawText(s, tile.text);
    }
    for (const [k, s] of this.map) if (!seen.has(k)) { this._dispose(s); this.map.delete(k); }
  }
  update(daySub) {
    if (this.dirty || ++this.n % 60 === 0) { this.dirty = false; this._sync(); }
    const w = this.g.world; if (!w) return;
    for (const s of this.map.values()) { // classic light curve, same as the held item
      const lv = Math.max(w.getSky(s.x, s.y, s.z) - daySub, w.getBlockLight(s.x, s.y, s.z)); const f = 1 - Math.max(0, lv) / 15; const l = (1 - f) / (f * 3 + 1) * 0.95 + 0.05;
      s.mat.color.setRGB(l, l, l); s.textMat.color.setRGB(l, l, l);
    }
  }
}
