// Rail shapes (vanilla metadata) and auto-connection when rails are placed or removed
import { isRail } from './blocks.js';
export const RD = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // N E S W
// the two directions each shape links, with the end that rises (1) for slopes
export const SHAPE_DIRS = [[[0, 0], [2, 0]], [[1, 0], [3, 0]], [[1, 1], [3, 0]], [[3, 1], [1, 0]], [[0, 1], [2, 0]], [[2, 1], [0, 0]], [[2, 0], [1, 0]], [[2, 0], [3, 0]], [[0, 0], [3, 0]], [[0, 0], [1, 0]]];
export const railShape = (id, m) => id === 66 ? (m > 9 ? 0 : m) : m & 7;
// rail one step in direction d (same level, one up or one down)
function railNear(w, x, y, z, d) { const [dx, dz] = RD[d]; for (const dy of [0, 1, -1]) if (isRail(w.getBlock(x + dx, y + dy, z + dz))) return [x + dx, y + dy, z + dz]; return null; }
// directions the rail at x,y,z actually links to an existing rail
function links(w, x, y, z) { const id = w.getBlock(x, y, z); if (!isRail(id)) return []; return SHAPE_DIRS[railShape(id, w.getMeta(x, y, z))].map(s => s[0]).filter(d => railNear(w, x, y, z, d)); }
const pointsAt = (w, r, x, y, z) => links(w, ...r).some(d => { const q = railNear(w, ...r, d); return q && q[0] === x && q[2] === z; });
// best shape for the rail here given its neighbours
function solve(w, x, y, z) { const id = w.getBlock(x, y, z); const cand = [];
  for (let d = 0; d < 4; d++) { const r = railNear(w, x, y, z, d); if (!r) continue; const o = (d + 2) & 3; const free = pointsAt(w, r, x, y, z) || links(w, ...r).filter(e => e !== o).length < 2; if (free) cand.push([d, r[1] > y]); }
  const has = d => cand.find(c => c[0] === d); let s = null;
  const ns = has(0) || has(2), ew = has(1) || has(3);
  if (id === 66 && ns && ew) { const a = has(2) ? 2 : 0, b = has(1) ? 1 : 3; s = a === 2 ? (b === 1 ? 6 : 7) : (b === 3 ? 8 : 9); }
  else if (ns) s = has(0) && has(0)[1] ? 4 : has(2) && has(2)[1] ? 5 : 0;
  else if (ew) s = has(1) && has(1)[1] ? 2 : has(3) && has(3)[1] ? 3 : 1;
  return [s, cand]; }
function apply(w, x, y, z, s) { const id = w.getBlock(x, y, z), m = w.getMeta(x, y, z); const nm = id === 66 ? s : (m & 8) | s; if (nm !== m) w.setBlock(x, y, z, id, nm); }
// placed: pick our own shape, then let free neighbours turn toward us
export function railPlaced(w, x, y, z, facing) { const [s, cand] = solve(w, x, y, z); apply(w, x, y, z, s ?? (facing === 1 || facing === 3 ? 1 : 0));
  for (const [d] of cand) { const r = railNear(w, x, y, z, d); if (r && !pointsAt(w, r, x, y, z)) { const [s2] = solve(w, ...r); if (s2 !== null) apply(w, ...r, s2); } } }
// rails left without support on a slope go flat
export function railNeighborChanged(w, x, y, z) { const id = w.getBlock(x, y, z); if (!isRail(id)) return; const s = railShape(id, w.getMeta(x, y, z)); if (s >= 2 && s <= 5) { const up = SHAPE_DIRS[s].find(e => e[1])[0]; const [dx, dz] = RD[up]; if (!isRail(w.getBlock(x + dx, y + 1, z + dz))) { const [ns] = solve(w, x, y, z); if (ns !== null && ns !== s) apply(w, x, y, z, ns); } } }
// powered/activator rails: on when powered directly or through up to 8 linked rails of the same kind
export function railPowered(w, x, y, z, isPowered) { const id = w.getBlock(x, y, z); if (isPowered(w, x, y, z) || isPowered(w, x, y - 1, z) && false) return true;
  const s = railShape(id, w.getMeta(x, y, z)); const seen = new Set([x + ',' + y + ',' + z]);
  for (const [d0] of SHAPE_DIRS[s]) { let c = [x, y, z], d = d0; for (let i = 0; i < 8; i++) { const r = railNear(w, ...c, d); if (!r || w.getBlock(...r) !== id) break; const k = r.join(','); if (seen.has(k)) break; seen.add(k); if (isPowered(w, ...r)) return true;
    const rs = railShape(id, w.getMeta(...r)); const nx = SHAPE_DIRS[rs].map(e => e[0]).find(e => e !== ((d + 2) & 3)); if (nx === undefined) break; c = r; d = nx; } }
  return false; }
