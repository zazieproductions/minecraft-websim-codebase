// AABB collision against the voxel grid (per-axis sweep, like the classic engine)
import { blocks as BL, SOLID, SHAPE, SH, OPAQUE, isWater, doorBox } from '../world/blocks.js';
// fences join other fences, gates and full opaque blocks; returns [west, east, north, south]
export function fenceLinks(world, x, y, z) {
  const id = world.getBlock(x, y, z), nether = id === 113;
  const j = (nx, nz, axis) => { const n = world.getBlock(nx, y, nz); if (n === 85 || n === 113) return nether === (n === 113); if (n === 107) return ((world.getMeta(nx, y, nz) & 1) === 0) === (axis === 0); return !!OPAQUE[n]; };
  return [j(x - 1, z, 0), j(x + 1, z, 0), j(x, z - 1, 1), j(x, z + 1, 1)];
}
function fenceBox(world, x, y, z, h) { const [w, e, n, s] = fenceLinks(world, x, y, z); return [w ? 0 : 0.375, 0, n ? 0 : 0.375, e ? 1 : 0.625, h, s ? 1 : 0.625]; }
const gateBox = (meta, h) => meta & 1 ? [0.375, 0, 0, 0.625, h, 1] : [0, 0, 0.375, 1, h, 0.625];

// Water current: direction water flows at a cell (toward lower levels / drops), normalized; [0,0,0] if still
const FDIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const depth = (world, x, y, z) => { if (!isWater(world.getBlock(x, y, z))) return -1; const m = world.getMeta(x, y, z); return m >= 8 ? 0 : m; };
export function flowVector(world, x, y, z) {
  const d = depth(world, x, y, z); if (d < 0) return [0, 0, 0];
  let vx = 0, vy = 0, vz = 0;
  for (const [dx, dz] of FDIRS) {
    let nd = depth(world, x + dx, y, z + dz), diff;
    if (nd < 0) { if (SOLID[world.getBlock(x + dx, y, z + dz)]) continue; nd = depth(world, x + dx, y - 1, z + dz); if (nd < 0) continue; diff = nd - (d - 8); }
    else diff = nd - d;
    vx += dx * diff; vz += dz * diff;
  }
  if (world.getMeta(x, y, z) >= 8) vy -= 6;
  const l = Math.hypot(vx, vy, vz); return l ? [vx / l, vy / l, vz / l] : [0, 0, 0];
}
// push an entity box along the water current; returns true if any water touched
export function applyCurrent(world, e, x0, y0, z0, x1, y1, z1, k = 0.014) {
  let vx = 0, vy = 0, vz = 0, any = false;
  for (let x = Math.floor(x0); x <= Math.floor(x1); x++) for (let y = Math.floor(y0); y <= Math.floor(y1); y++) for (let z = Math.floor(z0); z <= Math.floor(z1); z++) {
    if (!isWater(world.getBlock(x, y, z))) continue; any = true; const f = flowVector(world, x, y, z); vx += f[0]; vy += f[1]; vz += f[2]; }
  const l = Math.hypot(vx, vy, vz); if (l > 0) { e.mx += vx / l * k; e.my += vy / l * k; e.mz += vz / l * k; }
  return any;
}

export function blockBoxes(id, meta) {
  if (!SOLID[id]) return null;
  const s = SHAPE[id];
  if (id === 26) return [[0, 0, 0, 1, 9 / 16, 1]];
  if (s === SH.slab) return [[0, 0, 0, 1, 0.5, 1]];
  if (s === SH.layer) return [[0, 0, 0, 1, BL[id].height || 1, 1]];
  if (s === SH.cactus) return [[1 / 16, 0, 1 / 16, 15 / 16, 15 / 16, 15 / 16]];
  if (s === SH.door) return [doorBox(meta)];
  if (s === SH.gate) return meta & 4 ? null : [gateBox(meta, 1.5)];
  return [[0, 0, 0, 1, 1, 1]];
}
// selection box for raycast & outline
export function selectBox(id, meta, world, x, y, z) {
  const s = SHAPE[id];
  if (s === SH.fence) return world ? fenceBox(world, x, y, z, 1) : [0.375, 0, 0.375, 0.625, 1, 0.625];
  if (s === SH.gate) return gateBox(meta, 1);
  if (s === SH.wire) return [0, 0, 0, 1, 1 / 16, 1];
  if (s === SH.rail) return [0, 0, 0, 1, 2 / 16, 1];
  if (s === SH.plate) return [1 / 16, 0, 1 / 16, 15 / 16, 1 / 16, 15 / 16];
  if (s === SH.repeater) return [0, 0, 0, 1, 2 / 16, 1];
  if (s === SH.button) { const m = meta & 7, d = meta & 8 ? 1 / 16 : 2 / 16; return m === 1 ? [0, 6 / 16, 5 / 16, d, 10 / 16, 11 / 16] : m === 2 ? [1 - d, 6 / 16, 5 / 16, 1, 10 / 16, 11 / 16] : m === 3 ? [5 / 16, 6 / 16, 0, 11 / 16, 10 / 16, d] : m === 4 ? [5 / 16, 6 / 16, 1 - d, 11 / 16, 10 / 16, 1] : [5 / 16, 0, 6 / 16, 11 / 16, d, 10 / 16]; }
  if (id === 26) return [0, 0, 0, 1, 9 / 16, 1];
  if (s === SH.slab) return [0, 0, 0, 1, 0.5, 1];
  if (s === SH.layer) return [0, 0, 0, 1, BL[id].height, 1];
  if (s === SH.cross) return [0.15, 0, 0.15, 0.85, id === 31 || id === 32 ? 0.8 : id === 59 ? 0.25 : 0.7, 0.85];
  if (id === 83) return [0.125, 0, 0.125, 0.875, 1, 0.875];
  if (s === SH.torch) return [0.4, 0, 0.4, 0.6, 0.6, 0.6];
  if (s === SH.cactus) return [1 / 16, 0, 1 / 16, 15 / 16, 1, 15 / 16];
  if (s === SH.wall) { const e = 0.125; return meta === 2 ? [0, 0, 1 - e, 1, 1, 1] : meta === 3 ? [0, 0, 0, 1, 1, e] : meta === 4 ? [1 - e, 0, 0, 1, 1, 1] : [0, 0, 0, e, 1, 1]; }
  if (s === SH.vine) return [0, 0, 0, 1, 1, 1];
  if (s === SH.door) return doorBox(meta);
  if (s === SH.lever) { const m = meta & 7; return m === 1 ? [0, 0.2, 0.3, 0.4, 0.8, 0.7] : m === 2 ? [0.6, 0.2, 0.3, 1, 0.8, 0.7] : m === 3 ? [0.3, 0.2, 0, 0.7, 0.8, 0.4] : m === 4 ? [0.3, 0.2, 0.6, 0.7, 0.8, 1] : [0.25, 0, 0.25, 0.75, 0.6, 0.75]; }
  if (id === 63) return [0.25, 0, 0.25, 0.75, 1, 0.75];
  if (id === 68) { const e = 0.125, a = 0.28, b = 0.78; return meta === 2 ? [0, a, 1 - e, 1, b, 1] : meta === 3 ? [0, a, 0, 1, b, e] : meta === 4 ? [1 - e, a, 0, 1, b, 1] : [0, a, 0, e, b, 1]; }
  return [0, 0, 0, 1, 1, 1];
}
// collect solid boxes overlapping region
function gather(world, x0, y0, z0, x1, y1, z1, out) {
  out.length = 0;
  for (let x = Math.floor(x0); x <= Math.floor(x1); x++) for (let z = Math.floor(z0); z <= Math.floor(z1); z++) {
    if (!world.isLoaded(x, z)) { out.push([x, -64, z, x + 1, 256, z + 1]); continue; }
    for (let y = Math.floor(y0) - 1; y <= Math.floor(y1); y++) {
      const id = world.getBlock(x, y, z); if (!SOLID[id]) continue; const sh = SHAPE[id];
      if (sh === SH.fence) { const b = fenceBox(world, x, y, z, 1.5); out.push([x + b[0], y + b[1], z + b[2], x + b[3], y + b[4], z + b[5]]); continue; }
      const bx = blockBoxes(id, sh === SH.door || sh === SH.gate ? world.getMeta(x, y, z) : 0); if (!bx) continue;
      for (const b of bx) out.push([x + b[0], y + b[1], z + b[2], x + b[3], y + b[4], z + b[5]]);
    }
  }
  return out;
}
const tmp = [];
// e: {x,y,z (feet center), w, h, mx,my,mz}; returns {onGround, hx, hy, hz}
export function moveEntity(world, e, dx, dy, dz, step = 0) {
  const hw = e.w / 2; const ox = dx, oy = dy, oz = dz;
  const box = [e.x - hw, e.y, e.z - hw, e.x + hw, e.y + e.h, e.z + hw];
  const boxes = gather(world, Math.min(box[0], box[0] + dx), Math.min(box[1], box[1] + dy), Math.min(box[2], box[2] + dz), Math.max(box[3], box[3] + dx), Math.max(box[4], box[4] + dy) + step, Math.max(box[5], box[5] + dz), tmp);
  const sweep = (b, d, ax) => { // ax 0,1,2
    const a0 = ax, a1 = ax + 3; const o1 = (ax + 1) % 3, o2 = (ax + 2) % 3;
    for (const c of boxes) {
      if (c[o1 + 3] <= b[o1] || c[o1] >= b[o1 + 3] || c[o2 + 3] <= b[o2] || c[o2] >= b[o2 + 3]) continue;
      if (d > 0 && c[a0] >= b[a1] - 1e-7) { const m = c[a0] - b[a1]; if (m < d) d = m; }
      else if (d < 0 && c[a1] <= b[a0] + 1e-7) { const m = c[a1] - b[a0]; if (m > d) d = m; }
    }
    return d;
  };
  const apply = (b, d, ax) => { b[ax] += d; b[ax + 3] += d; };
  let b = box.slice();
  dy = sweep(b, dy, 1); apply(b, dy, 1);
  const onGround = oy < 0 && dy !== oy;
  dx = sweep(b, dx, 0); apply(b, dx, 0);
  dz = sweep(b, dz, 2); apply(b, dz, 2);
  // step up (stairs/slabs) when blocked horizontally on the ground
  if (step > 0 && (onGround || e.onGround) && (dx !== ox || dz !== oz)) {
    let s = box.slice(); let sy = sweep(s, step, 1); apply(s, sy, 1);
    let sx = sweep(s, ox, 0); apply(s, sx, 0); let sz = sweep(s, oz, 2); apply(s, sz, 2);
    let down = sweep(s, -sy, 1); apply(s, down, 1);
    if (sx * sx + sz * sz > dx * dx + dz * dz + 1e-9) { b = s; dx = sx; dz = sz; dy = sy + down; }
  }
  e.x = (b[0] + b[3]) / 2; e.y = b[1]; e.z = (b[2] + b[5]) / 2;
  return { onGround: onGround || (e.onGround && oy < 0 && dy > -1e-6 && dy !== oy), hx: dx !== ox, hy: dy !== oy, hz: dz !== oz, dy };
}
export function boxIntersectsBlocks(world, x0, y0, z0, x1, y1, z1) { return gather(world, x0, y0, z0, x1, y1, z1, []).some(c => c[0] < x1 && c[3] > x0 && c[1] < y1 && c[4] > y0 && c[2] < z1 && c[5] > z0); }
// DDA raycast; returns {x,y,z, face:[nx,ny,nz], id, dist}
export function raycast(world, ox, oy, oz, dx, dy, dz, maxD, hitFluids = false) {
  let x = Math.floor(ox), y = Math.floor(oy), z = Math.floor(oz);
  const sx = Math.sign(dx), sy = Math.sign(dy), sz = Math.sign(dz);
  const tdx = Math.abs(1 / dx), tdy = Math.abs(1 / dy), tdz = Math.abs(1 / dz);
  let tx = dx > 0 ? (x + 1 - ox) * tdx : (ox - x) * tdx, ty = dy > 0 ? (y + 1 - oy) * tdy : (oy - y) * tdy, tz = dz > 0 ? (z + 1 - oz) * tdz : (oz - z) * tdz;
  let face = [0, 0, 0], t = 0;
  for (let i = 0; i < 200 && t <= maxD; i++) {
    const id = world.getBlock(x, y, z);
    if (id && (SHAPE[id] !== SH.liquid || (hitFluids && world.getMeta(x, y, z) === 0))) {
      const m = world.getMeta(x, y, z);
      const b = SHAPE[id] === SH.liquid ? [0, 0, 0, 1, 1, 1] : selectBox(id, m, world, x, y, z);
      const hit = rayBox(ox, oy, oz, dx, dy, dz, x + b[0], y + b[1], z + b[2], x + b[3], y + b[4], z + b[5]);
      if (hit && hit.t <= maxD) return { x, y, z, face: hit.n, id, dist: hit.t, meta: m, box: b };
    }
    if (tx < ty && tx < tz) { x += sx; t = tx; tx += tdx; face = [-sx, 0, 0]; }
    else if (ty < tz) { y += sy; t = ty; ty += tdy; face = [0, -sy, 0]; }
    else { z += sz; t = tz; tz += tdz; face = [0, 0, -sz]; }
  }
  return null;
}
export function rayBox(ox, oy, oz, dx, dy, dz, x0, y0, z0, x1, y1, z1) {
  let tmin = -Infinity, tmax = Infinity, n = null;
  const ax = [[ox, dx, x0, x1, [-1, 0, 0], [1, 0, 0]], [oy, dy, y0, y1, [0, -1, 0], [0, 1, 0]], [oz, dz, z0, z1, [0, 0, -1], [0, 0, 1]]];
  for (const [o, d, a, b, na, nb] of ax) {
    if (Math.abs(d) < 1e-9) { if (o < a || o > b) return null; continue; }
    let t1 = (a - o) / d, t2 = (b - o) / d, n1 = na, n2 = nb; if (t1 > t2) { [t1, t2] = [t2, t1]; [n1, n2] = [n2, n1]; }
    if (t1 > tmin) { tmin = t1; n = n1; } if (t2 < tmax) tmax = t2; if (tmin > tmax) return null;
  }
  if (tmax < 0) return null; return { t: Math.max(0, tmin), n: n || [0, 1, 0] };
}
