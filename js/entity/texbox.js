// Boxes skinned from a vanilla entity texture: every face of a box shows one pixel rect of the sheet
import * as THREE from 'three';
const texCache = new Map();
export function sheetTexture(img) { if (!img) return null; let t = texCache.get(img); if (!t) { t = new THREE.CanvasTexture(img); t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.colorSpace = THREE.SRGBColorSpace; texCache.set(img, t); } return t; }
// rects: one [u, v, w, h] for all faces, or { side, top, end } (side = ±x, top = ±y, end = ±z)
export function texBoxGeometry(img, rects) { const g = new THREE.BoxGeometry(1, 1, 1); const uv = g.attributes.uv; const W = img.width, H = img.height;
  const pick = f => Array.isArray(rects) ? rects : f < 2 ? rects.side : f < 4 ? rects.top : rects.end;
  for (let f = 0; f < 6; f++) { const [u0, v0, w, h] = pick(f) || rects.side; for (let k = 0; k < 4; k++) { const i = f * 4 + k; const a = uv.getX(i), b = uv.getY(i); uv.setXY(i, (u0 + a * w) / W, 1 - (v0 + (1 - b) * h) / H); } }
  uv.needsUpdate = true; return g; }
