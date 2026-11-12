// Nether portals: lighting obsidian frames, breaking them, finding / building the exit portal
import { SOLID, isFluid } from './blocks.js';
const OBS = 49, PORTAL = 90;
const inner = b => b === 0 || b === 51;

// flint & steel on the air cell (x,y,z): fill a valid obsidian frame (interior 2..21 wide, 3..21 tall)
export function lightPortal(w, x, y, z) {
  if (!inner(w.getBlock(x, y, z))) return false;
  for (const ax of [0, 1]) {
    const dx = ax ? 0 : 1, dz = ax ? 1 : 0; const at = (i, yy) => w.getBlock(x + dx * i, yy, z + dz * i);
    let by = y; while (y - by < 21 && inner(w.getBlock(x, by - 1, z))) by--; if (w.getBlock(x, by - 1, z) !== OBS) continue;
    let l = 0; while (l < 21 && inner(at(-l - 1, by))) l++; if (at(-l - 1, by) !== OBS) continue;
    let wid = 0, ok = true; while (wid < 22 && inner(at(wid - l, by))) { if (at(wid - l, by - 1) !== OBS) { ok = false; break; } wid++; }
    if (!ok || wid < 2 || wid > 21 || at(wid - l, by) !== OBS) continue;
    let h = 0;
    for (; h < 22; h++) { const yy = by + h; let all = true; for (let i = -l; i < wid - l; i++) if (!inner(at(i, yy))) { all = false; break; } if (!all) break; if (at(-l - 1, yy) !== OBS || at(wid - l, yy) !== OBS) { h = -1; break; } }
    if (h < 3 || h > 21) continue;
    let top = true; for (let i = -l; i < wid - l; i++) if (at(i, by + h) !== OBS) { top = false; break; } if (!top) continue;
    for (let yy = by; yy < by + h; yy++) for (let i = -l; i < wid - l; i++) w.setBlock(x + dx * i, yy, z + dz * i, PORTAL, ax);
    return true;
  }
  return false;
}

// a frame block (or portal block) went away: collapse every portal block touching it
let busy = false;
export function portalBroken(w, x, y, z) {
  if (busy) return; busy = true;
  try {
    const q = []; const seen = new Set(); const K = (a, b, c) => a + ',' + b + ',' + c;
    for (const [dx, dy, dz] of [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]]) if (w.getBlock(x + dx, y + dy, z + dz) === PORTAL) { q.push([x + dx, y + dy, z + dz]); seen.add(K(x + dx, y + dy, z + dz)); }
    while (q.length && seen.size < 2000) { const [a, b, c] = q.pop(); for (const [dx, dy, dz] of [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]]) { const k = K(a + dx, b + dy, c + dz); if (!seen.has(k) && w.getBlock(a + dx, b + dy, c + dz) === PORTAL) { seen.add(k); q.push([a + dx, b + dy, c + dz]); } } }
    for (const k of seen) { const [a, b, c] = k.split(',').map(Number); if (w.getBlock(a, b, c) === PORTAL) w.setBlock(a, b, c, 0, 0); }
  } finally { busy = false; }
}

// nearest existing portal within r blocks (loaded chunks only): returns a standing spot inside it
export function findPortal(w, tx, tz, ty, r = 24) {
  let best = null, bd = Infinity;
  for (let x = tx - r; x <= tx + r; x++) for (let z = tz - r; z <= tz + r; z++) { if (!w.isLoaded(x, z)) continue;
    for (let y = 1; y < 127; y++) if (w.getBlock(x, y, z) === PORTAL && w.getBlock(x, y - 1, z) !== PORTAL) { const d = (x - tx) ** 2 + (z - tz) ** 2 + ((y - ty) * 0.5) ** 2; if (d < bd) { bd = d; best = [x, y, z]; } } }
  return best;
}

// build a 2x3 portal near the target, preferring a flat clear spot
export function buildPortal(w, tx, tz, ty, nether) {
  const air = b => b === 0 || (!SOLID[b] && !isFluid(b) && b !== PORTAL);
  const fits = (x, y, z) => { for (let i = 0; i < 4; i++) for (let k = -1; k <= 1; k++) { if (!SOLID[w.getBlock(x + i, y - 1, z + k)]) return false; for (let j = 0; j < 4; j++) if (!air(w.getBlock(x + i, y + j, z + k))) return false; } return true; };
  let best = null, bd = Infinity;
  for (let x = tx - 16; x <= tx + 16; x++) for (let z = tz - 16; z <= tz + 16; z++) { if (!w.isLoaded(x - 1, z - 1) || !w.isLoaded(x + 4, z + 1)) continue;
    const ys = []; if (nether) { for (let y = 120; y > 32; y--) if (w.getBlock(x, y, z) === 0 && SOLID[w.getBlock(x, y - 1, z)]) ys.push(y); } else ys.push(w.topY(x, z) + 1);
    for (const y of ys) { const d = (x - tx) ** 2 + (z - tz) ** 2 + ((y - ty) * 1.5) ** 2; if (d < bd && y > 1 && y < 122 && fits(x, y, z)) { bd = d; best = [x, y, z]; } } }
  let x, y, z;
  if (best) [x, y, z] = best;
  else { x = tx - 1; z = tz; y = nether ? Math.max(34, Math.min(100, ty)) : Math.max(64, Math.min(118, w.topY(tx, tz) + 1));
    for (let i = -1; i <= 4; i++) for (let k = -1; k <= 1; k++) { for (let j = 0; j < 4; j++) w.setBlock(x + i, y + j, z + k, 0, 0); if (i >= 0 && i <= 3) w.setBlock(x + i, y - 1, z + k, OBS, 0); } }
  for (let i = 0; i < 4; i++) { w.setBlock(x + i, y - 1, z, OBS, 0); w.setBlock(x + i, y + 3, z, OBS, 0); }
  for (let j = 0; j < 3; j++) { w.setBlock(x, y + j, z, OBS, 0); w.setBlock(x + 3, y + j, z, OBS, 0); }
  for (let j = 0; j < 3; j++) for (let i = 1; i <= 2; i++) w.setBlock(x + i, y + j, z, PORTAL, 0);
  return [x + 1, y, z];
}
