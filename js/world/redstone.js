// Redstone: dust networks with signal strength, torches, repeaters, buttons, pressure plates, levers and redstone blocks
// powering pistons, lamps, doors, gates, note blocks and TNT. Block changes mark cells dirty; they are settled once per tick.
import { blocks as BL, OPAQUE, DIR6, isDoor } from './blocks.js';
import { railPowered, railNeighborChanged } from './rails.js';

const HD = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // N E S W (repeater facing / wire directions)
const ATT = { 1: [-1, 0, 0], 2: [1, 0, 0], 3: [0, 0, -1], 4: [0, 0, 1], 5: [0, -1, 0], 0: [0, -1, 0] }; // mount -> attached block (levers, buttons, torches)
const LINKS = new Set([55, 75, 76, 69, 77, 143, 70, 72, 152, 28]);
const key = (x, y, z) => x + ',' + y + ',' + z;
const isRep = id => id === 93 || id === 94;
const isPiston = id => id === 33 || id === 29;
// wire at x,y,z: which horizontal directions it runs (an isolated dot or a single arm points everywhere / straight through, as in vanilla)
export function wireDirs(w, x, y, z) {
  const upOpen = !OPAQUE[w.getBlock(x, y + 1, z)]; const c = [0, 0, 0, 0];
  for (let d = 0; d < 4; d++) { const [dx, dz] = HD[d], nx = x + dx, nz = z + dz, n = w.getBlock(nx, y, nz);
    if (LINKS.has(n) || (isRep(n) && ((w.getMeta(nx, y, nz) & 3) & 1) === (d & 1))) c[d] = 1;
    else if (upOpen && OPAQUE[n] && w.getBlock(nx, y + 1, nz) === 55) c[d] = 1;
    else if (!OPAQUE[n] && w.getBlock(nx, y - 1, nz) === 55) c[d] = 1; }
  const n = c[0] + c[1] + c[2] + c[3];
  if (n === 0) return [1, 1, 1, 1];
  if (n === 1) { if (c[0] || c[2]) c[0] = c[2] = 1; else c[1] = c[3] = 1; }
  return c;
}
const attached = (w, x, y, z) => { const a = ATT[w.getMeta(x, y, z) & 7]; return a ? [x + a[0], y + a[1], z + a[2]] : null; };
const same = (a, x, y, z) => a && a[0] === x && a[1] === y && a[2] === z;
const repOut = (w, x, y, z) => { const d = HD[w.getMeta(x, y, z) & 3]; return [x + d[0], y, z + d[1]]; };
// power a component at (x,y,z) sends straight into the neighbouring cell (tx,ty,tz)
function emit(w, x, y, z, tx, ty, tz) {
  const id = w.getBlock(x, y, z); if (!id) return 0; const m = w.getMeta(x, y, z);
  switch (id) {
    case 152: return 15;
    case 69: case 77: case 143: return m & 8 ? 15 : 0;
    case 70: case 72: return m & 1 ? 15 : 0;
    case 28: return m & 8 ? 15 : 0;
    case 76: return same(attached(w, x, y, z), tx, ty, tz) ? 0 : 15;
    case 94: return same(repOut(w, x, y, z), tx, ty, tz) ? 15 : 0;
    case 55: { if (!m) return 0; if (ty === y - 1) return m; if (ty !== y) return 0; const d = wireDirs(w, x, y, z); for (let i = 0; i < 4; i++) if (d[i] && x + HD[i][0] === tx && z + HD[i][1] === tz) return m; return 0; }
  }
  return 0;
}
// an opaque block is strongly powered by a lever/button on it, a torch under it, a pressed plate on it, or a repeater pointing into it
function strong(w, bx, by, bz) {
  for (let i = 0; i < 6; i++) { const [dx, dy, dz] = DIR6[i]; const x = bx + dx, y = by + dy, z = bz + dz; const id = w.getBlock(x, y, z); if (!id) continue;
    if ((id === 69 || id === 77 || id === 143) && (w.getMeta(x, y, z) & 8) && same(attached(w, x, y, z), bx, by, bz)) return 15;
    if (id === 76 && dy === -1) return 15;
    if ((id === 70 || id === 72) && dy === 1 && (w.getMeta(x, y, z) & 1)) return 15;
    if (id === 28 && dy === 1 && (w.getMeta(x, y, z) & 8)) return 15;
    if (id === 94 && same(repOut(w, x, y, z), bx, by, bz)) return 15; }
  return 0;
}
// weakly powered: strong, or dust on it / pointing into it
function weak(w, bx, by, bz) {
  if (strong(w, bx, by, bz)) return true;
  for (let i = 0; i < 6; i++) { const [dx, dy, dz] = DIR6[i]; const x = bx + dx, y = by + dy, z = bz + dz; if (w.getBlock(x, y, z) === 55 && emit(w, x, y, z, bx, by, bz)) return true; }
  return false;
}
// is the device at x,y,z receiving power (skip = DIR6 index to ignore, e.g. a piston's face)
export function isPowered(w, x, y, z, skip = -1) {
  for (let i = 0; i < 6; i++) { if (i === skip) continue; const [dx, dy, dz] = DIR6[i]; const nx = x + dx, ny = y + dy, nz = z + dz;
    if (emit(w, nx, ny, nz, x, y, z)) return true; if (OPAQUE[w.getBlock(nx, ny, nz)] && weak(w, nx, ny, nz)) return true; }
  return false;
}
function torchShouldBeOn(w, x, y, z) { const a = attached(w, x, y, z); if (!a) return true; return !(OPAQUE[w.getBlock(...a)] && weak(w, ...a)); }
function repeaterInput(w, x, y, z) { const d = HD[w.getMeta(x, y, z) & 3]; const bx = x - d[0], bz = z - d[1]; if (emit(w, bx, y, bz, x, y, z)) return true; return !!(OPAQUE[w.getBlock(bx, y, bz)] && weak(w, bx, y, bz)); }
// a door (either half) / gate counts as powered if any of its cells is
export function doorPowered(w, x, y, z) { if (isDoor(w.getBlock(x, y, z)) && (w.getMeta(x, y, z) & 8)) y--; return isPowered(w, x, y, z) || (isDoor(w.getBlock(x, y + 1, z)) && isPowered(w, x, y + 1, z)); }

// ---- dust networks ----
function wireNeighbors(w, x, y, z, out) {
  out.length = 0; const upOpen = !OPAQUE[w.getBlock(x, y + 1, z)];
  if (w.getBlock(x, y - 1, z) === 55) out.push([x, y - 1, z]); // (vertical stacks never happen; kept for safety)
  for (const [dx, dz] of HD) { const nx = x + dx, nz = z + dz;
    if (w.getBlock(nx, y, nz) === 55) out.push([nx, y, nz]);
    else { if (upOpen && w.getBlock(nx, y + 1, nz) === 55) out.push([nx, y + 1, nz]); if (!OPAQUE[w.getBlock(nx, y, nz)] && w.getBlock(nx, y - 1, nz) === 55) out.push([nx, y - 1, nz]); } }
  return out;
}
function wireInput(w, x, y, z) {
  let best = 0;
  for (let i = 0; i < 6; i++) { const [dx, dy, dz] = DIR6[i]; const nx = x + dx, ny = y + dy, nz = z + dz; const id = w.getBlock(nx, ny, nz);
    if (id === 55) continue; if (id && emit(w, nx, ny, nz, x, y, z)) return 15; if (OPAQUE[id] && strong(w, nx, ny, nz)) return 15; }
  return best;
}
const nb = [];
// recompute every network touching the seed wires; returns positions whose power changed
function settleWires(w, seeds) {
  const changed = [], seen = new Set();
  for (const s of seeds) { const sk = key(...s); if (seen.has(sk) || w.getBlock(...s) !== 55) continue;
    const net = [], idx = new Map(), q = [s]; seen.add(sk);
    while (q.length && net.length < 4096) { const c = q.pop(); idx.set(key(...c), net.length); net.push(c); for (const n of wireNeighbors(w, c[0], c[1], c[2], nb)) { const k = key(...n); if (!seen.has(k)) { seen.add(k); q.push(n); } } }
    const pw = new Uint8Array(net.length), buckets = Array.from({ length: 16 }, () => []);
    net.forEach((c, i) => { const p = wireInput(w, c[0], c[1], c[2]); if (p) { pw[i] = p; buckets[p].push(i); } });
    for (let lv = 15; lv > 1; lv--) for (const i of buckets[lv]) { if (pw[i] !== lv) continue; const c = net[i];
      for (const n of wireNeighbors(w, c[0], c[1], c[2], nb)) { const j = idx.get(key(...n)); if (j !== undefined && pw[j] < lv - 1) { pw[j] = lv - 1; buckets[lv - 1].push(j); } } }
    net.forEach((c, i) => { if ((w.getMeta(...c) & 15) !== pw[i]) { w.setBlock(c[0], c[1], c[2], 55, pw[i], { silent: true }); changed.push(c); } });
  }
  return changed;
}

const MAX_PUSH = 12;
function mobility(w, x, y, z) {
  if (y < 0 || y >= 128) return 'no'; const id = w.getBlock(x, y, z); if (!id) return 'air'; const b = BL[id];
  if (b.fluid || b.replaceable || b.shape === 'cross' || b.shape === 'torch') return 'break';
  if (b.hardness < 0 || id === 49 || id === 7 || b.container || id === 52 || id === 34 || id === 26 || id === 84 || b.sign) return 'no';
  if (b.piston && (w.getMeta(x, y, z) & 8)) return 'no';
  if (b.needsSupport || isDoor(id)) return 'break';
  return 'push';
}
function breakDrop(g, x, y, z) { const w = g.world, id = w.getBlock(x, y, z), m = w.getMeta(x, y, z); if (!id) return; w.setBlock(x, y, z, 0, 0); if (!BL[id].fluid) g.dropsFor(id, m, null).forEach(s => g.spawnDrop(x + 0.5, y + 0.5, z + 0.5, s)); }
function shove(g, cells, d) { // move entities standing in pushed cells along with them
  const inCell = e => cells.some(([cx, cy, cz]) => e.x + (e.w || 0.6) / 2 > cx && e.x - (e.w || 0.6) / 2 < cx + 1 && e.y + (e.h || 1) > cy && e.y < cy + 1.01 && e.z + (e.w || 0.6) / 2 > cz && e.z - (e.w || 0.6) / 2 < cz + 1);
  const list = [g.player, ...g.mobs.mobs, ...g.mobs.misc, ...g.entities]; for (const e of list) if (e && !e.dead && inCell(e)) { e.x += d[0]; e.y += d[1] + (d[1] > 0 ? 0.01 : 0); e.z += d[2]; if (d[1] > 0 && e.my < 0) e.my = 0; }
}
function extend(g, x, y, z) {
  const w = g.world, id = w.getBlock(x, y, z), m = w.getMeta(x, y, z), f = m & 7, d = DIR6[f]; if (!d) return;
  const line = []; let cx = x + d[0], cy = y + d[1], cz = z + d[2], brk = null;
  for (let i = 0; ; i++) { const k = mobility(w, cx, cy, cz); if (k === 'air') break; if (k === 'break') { brk = [cx, cy, cz]; break; } if (k === 'no' || i >= MAX_PUSH) return;
    line.push([cx, cy, cz, w.getBlock(cx, cy, cz), w.getMeta(cx, cy, cz)]); cx += d[0]; cy += d[1]; cz += d[2]; }
  if (brk) breakDrop(g, ...brk);
  const cells = [[x + d[0], y + d[1], z + d[2]], ...line.map(l => [l[0], l[1], l[2]])];
  for (let i = line.length - 1; i >= 0; i--) { const [bx, by, bz, bid, bm] = line[i]; w.setBlock(bx + d[0], by + d[1], bz + d[2], bid, bm); if (BL[bid].falls) g.ticker.schedule(bx + d[0], by + d[1], bz + d[2], 2); }
  w.setBlock(x, y, z, id, m | 8); w.setBlock(x + d[0], y + d[1], z + d[2], 34, f | (BL[id].sticky ? 8 : 0));
  shove(g, cells, d); g.sound('piston:out', { x, y, z }, 0.6, 0.75 + Math.random() * 0.25);
  for (const [a, b, c] of cells) g.ticker.notifyNeighbors(a + d[0], b + d[1], c + d[2]);
}
function retract(g, x, y, z) {
  const w = g.world, id = w.getBlock(x, y, z), m = w.getMeta(x, y, z), f = m & 7, d = DIR6[f]; if (!d) return;
  const hx = x + d[0], hy = y + d[1], hz = z + d[2];
  w.setBlock(x, y, z, id, f); if (w.getBlock(hx, hy, hz) === 34) w.setBlock(hx, hy, hz, 0, 0);
  if (BL[id].sticky) { const px = hx + d[0], py = hy + d[1], pz = hz + d[2]; if (mobility(w, px, py, pz) === 'push') { const bid = w.getBlock(px, py, pz), bm = w.getMeta(px, py, pz); w.setBlock(px, py, pz, 0, 0); w.setBlock(hx, hy, hz, bid, bm); if (BL[bid].falls) g.ticker.schedule(hx, hy, hz, 2); g.ticker.notifyNeighbors(px, py, pz); } }
  g.ticker.notifyNeighbors(hx, hy, hz);
  g.sound('piston:in', { x, y, z }, 0.6, 0.65 + Math.random() * 0.25);
}
export function playNote(g, x, y, z) {
  const w = g.world; if (w.getBlock(x, y + 1, z)) return; const m = w.getMeta(x, y, z) % 25; const below = w.getBlock(x, y - 1, z), b = BL[below];
  const inst = !below ? 'harp' : below === 41 ? 'pling' : b.sound === 'wood' ? 'bass' : b.sound === 'sand' || b.sound === 'gravel' ? 'snare' : b.sound === 'glass' ? 'hat' : b.sound === 'stone' || b.sound === 'metal' ? 'bd' : 'harp';
  g.sound('note:' + inst, { x, y, z }, 1.5, Math.pow(2, (m - 12) / 12));
  g.particles.fx('note', x + 0.5, y + 1.2, z + 0.5, 1, m / 24);
}

// ---- the engine: one per game ----
const DIAMOND = []; for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) for (let dz = -2; dz <= 2; dz++) if (Math.abs(dx) + Math.abs(dy) + Math.abs(dz) <= 2) DIAMOND.push([dx, dy, dz]);
export class Redstone {
  constructor(g) { this.g = g; this.dirty = new Map(); this.sched = new Map(); this.now = 0; this.edge = new Set(); this.burn = new Map(); this.plates = new Set(); }
  get w() { return this.g.world; }
  reset() { this.dirty.clear(); this.sched.clear(); this.edge.clear(); this.burn.clear(); this.plates.clear(); }
  mark(x, y, z) { if (this.dirty.size < 4096) this.dirty.set(key(x, y, z), [x, y, z]); }
  schedule(x, y, z, delay) { const k = key(x, y, z); if (!this.sched.has(k)) this.sched.set(k, [x, y, z, this.now + delay]); }
  tick() {
    const w = this.w; if (!w) return; this.now++;
    if (this.sched.size) for (const [k, s] of [...this.sched]) if (s[3] <= this.now) { this.sched.delete(k); this.fire(s[0], s[1], s[2]); }
    this.platesTick();
    if (!this.dirty.size) return;
    const cells = [...this.dirty.values()]; this.dirty.clear();
    const seeds = [], cand = new Map();
    const scan = (x, y, z) => { for (const [dx, dy, dz] of DIAMOND) { const X = x + dx, Y = y + dy, Z = z + dz; const id = w.getBlock(X, Y, Z); if (!id) continue; if (id === 55) seeds.push([X, Y, Z]); else cand.set(key(X, Y, Z), [X, Y, Z]); } };
    for (const c of cells) scan(...c);
    for (const c of settleWires(w, seeds)) for (const [dx, dy, dz] of DIAMOND) { const X = c[0] + dx, Y = c[1] + dy, Z = c[2] + dz; const id = w.getBlock(X, Y, Z); if (id && id !== 55) cand.set(key(X, Y, Z), [X, Y, Z]); }
    let n = 0; for (const c of cand.values()) { if (++n > 2048) break; this.device(...c); }
  }
  // re-evaluate one block that reacts to power
  device(x, y, z) {
    const g = this.g, w = this.w, id = w.getBlock(x, y, z), k = key(x, y, z);
    if (isPiston(id)) { const m = w.getMeta(x, y, z), on = isPowered(w, x, y, z, m & 7), ext = !!(m & 8); if (on && !ext) extend(g, x, y, z); else if (!on && ext) retract(g, x, y, z); }
    else if (id === 76 || id === 75) { if ((id === 76) !== torchShouldBeOn(w, x, y, z)) this.schedule(x, y, z, 2); }
    else if (isRep(id)) { if ((id === 94) !== repeaterInput(w, x, y, z)) this.schedule(x, y, z, (((w.getMeta(x, y, z) >> 2) & 3) + 1) * 2); }
    else if (id === 123) { if (isPowered(w, x, y, z)) w.setBlock(x, y, z, 124, 0); }
    else if (id === 124) { if (!isPowered(w, x, y, z)) this.schedule(x, y, z, 4); }
    else if (id === 46) { if (isPowered(w, x, y, z)) { w.setBlock(x, y, z, 0, 0); g.mobs.spawnTNT(x, y, z); } }
    else if (id === 25) { const on = isPowered(w, x, y, z); if (on && !this.edge.has(k)) { this.edge.add(k); playNote(g, x, y, z); } else if (!on) this.edge.delete(k); }
    else if (isDoor(id)) { if (w.getMeta(x, y, z) & 8) return this.device(x, y - 1, z); const on = doorPowered(w, x, y, z); if (on !== this.edge.has(k)) { if (on) this.edge.add(k); else this.edge.delete(k); g.setDoor(x, y, z, on); } }
    else if (id === 27 || id === 157) { const m = w.getMeta(x, y, z), on = railPowered(w, x, y, z, isPowered); if (!!(m & 8) !== on) w.setBlock(x, y, z, id, on ? m | 8 : m & 7); }
    else if (id === 66) railNeighborChanged(w, x, y, z);
    else if (id === 137) { const on = isPowered(w, x, y, z); if (on && !this.edge.has(k)) { this.edge.add(k); const t = w.getTile(x, y, z); if (t && t.cmd && g.runBlockCommand) g.runBlockCommand(t.cmd, x, y, z); } else if (!on) this.edge.delete(k); }
    else if (id === 107) { const on = isPowered(w, x, y, z); if (on !== this.edge.has(k)) { if (on) this.edge.add(k); else this.edge.delete(k); const m = w.getMeta(x, y, z); if (!!(m & 4) !== on) { w.setBlock(x, y, z, 107, on ? m | 4 : m & ~4); g.sound('door', { x, y, z }, 1, 1.1); } } }
  }
  // a scheduled block tick came due
  fire(x, y, z) {
    const g = this.g, w = this.w, id = w.getBlock(x, y, z), m = w.getMeta(x, y, z), k = key(x, y, z);
    if (id === 76 || id === 75) { const want = torchShouldBeOn(w, x, y, z); if ((id === 76) === want) return;
      if (want) { const b = this.burn.get(k); if (b && b.n >= 8 && this.now - b.t < 100) return this.schedule(x, y, z, 60); } // burnt out: try again later
      else { let b = this.burn.get(k); if (!b || this.now - b.t > 60) { b = { n: 0, t: this.now }; this.burn.set(k, b); } if (++b.n >= 8) { g.sound('fizz', { x: x + 0.5, y: y + 0.5, z: z + 0.5 }, 0.5, 2.6); for (let i = 0; i < 5; i++) g.particles.fx('smoke', x + 0.3 + Math.random() * 0.4, y + 0.7, z + 0.3 + Math.random() * 0.4); } }
      w.setBlock(x, y, z, want ? 76 : 75, m); }
    else if (isRep(id)) { const want = repeaterInput(w, x, y, z); if ((id === 94) !== want) w.setBlock(x, y, z, want ? 94 : 93, m); }
    else if (id === 124) { if (!isPowered(w, x, y, z)) w.setBlock(x, y, z, 123, 0); }
    else if (id === 77 || id === 143) { if (m & 8) { w.setBlock(x, y, z, id, m & 7); g.sound('click', { x: x + 0.5, y: y + 0.5, z: z + 0.5 }, 0.3, 0.5); } }
    else if (id === 28) { if (!(m & 8)) return; if (this.cartAt(x, y, z)) return this.schedule(x, y, z, 20); w.setBlock(x, y, z, 28, m & 7); }
    else if (id === 70 || id === 72) { if (!(m & 1)) return; if (this.occupied(x, y, z, id)) return this.schedule(x, y, z, 20); w.setBlock(x, y, z, id, 0); this.plates.delete(k); g.sound('click', { x: x + 0.5, y: y + 0.1, z: z + 0.5 }, 0.3, 0.5); }
  }
  press(x, y, z) { const w = this.w, id = w.getBlock(x, y, z), m = w.getMeta(x, y, z); if (m & 8) { this.sched.delete(key(x, y, z)); this.schedule(x, y, z, BL[id].button); return; }
    w.setBlock(x, y, z, id, m | 8); this.g.sound('click', { x: x + 0.5, y: y + 0.5, z: z + 0.5 }, 0.3, 0.6); this.schedule(x, y, z, BL[id].button); }
  occupied(x, y, z, id) {
    const g = this.g, all = BL[id].plate === 'all';
    const on = e => e && !e.dead && !e.deathTime && Math.floor(e.x) === x && Math.floor(e.z) === z && e.y >= y - 0.01 && e.y < y + 0.5;
    if (on(g.player) && !g.player.dead) return true; for (const m of g.mobs.mobs) if (on(m)) return true; if (all) for (const e of g.entities) if (on(e)) return true; return false;
  }
  cartAt(x, y, z) { return this.g.mobs.misc.some(e => e.cart && !e.dead && Math.floor(e.x) === x && Math.floor(e.z) === z && Math.abs(e.y - y) < 1); }
  // a minecart rolled onto a detector rail
  cartOn(x, y, z) { const w = this.w, m = w.getMeta(x, y, z); if (w.getBlock(x, y, z) !== 28) return; if (!(m & 8)) w.setBlock(x, y, z, 28, m | 8); this.schedule(x, y, z, 20); }
  // step on plates
  platesTick() {
    const g = this.g, w = this.w; const test = e => { if (!e || e.dead || e.deathTime || e.flying) return; const x = Math.floor(e.x), y = Math.floor(e.y + 0.01), z = Math.floor(e.z); const id = w.getBlock(x, y, z);
      if ((id === 70 || id === 72) && !(w.getMeta(x, y, z) & 1)) { w.setBlock(x, y, z, id, 1); this.plates.add(key(x, y, z)); this.schedule(x, y, z, 20); g.sound('click', { x: x + 0.5, y: y + 0.1, z: z + 0.5 }, 0.3, 0.6); } };
    test(g.player); for (const m of g.mobs.mobs) test(m); if (this.now % 4 === 0) for (const e of g.entities) if (e.stack || e.item) { const id = w.getBlock(Math.floor(e.x), Math.floor(e.y + 0.01), Math.floor(e.z)); if (id === 72) test(e); }
  }
}
// kept for older callers: block changes are now picked up through the world's change hook
export function updateRedstone(g, x, y, z) { if (g.redstone) g.redstone.mark(x, y, z); }
// a piston part was removed: take the other part with it
export function pistonRemoved(g, x, y, z, id, meta, survival) {
  const w = g.world, d = DIR6[meta & 7]; if (!d) return;
  if (id === 34) { const bx = x - d[0], by = y - d[1], bz = z - d[2], b = w.getBlock(bx, by, bz); if ((b === 33 || b === 29) && (w.getMeta(bx, by, bz) & 8)) { w.setBlock(bx, by, bz, 0, 0); if (survival) g.spawnDrop(bx + 0.5, by + 0.5, bz + 0.5, { id: b, count: 1, dmg: 0 }); } }
  else if ((id === 33 || id === 29) && (meta & 8)) { const hx = x + d[0], hy = y + d[1], hz = z + d[2]; if (w.getBlock(hx, hy, hz) === 34) w.setBlock(hx, hy, hz, 0, 0); }
}
// facing for a newly placed piston: its face points back at the player
export function pistonFacing(p) {
  const dy = Math.sin(p.pitch); if (dy < -0.75) return 1; if (dy > 0.75) return 0;
  const dx = -Math.sin(p.yaw), dz = -Math.cos(p.yaw);
  return Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? 4 : 5) : (dz > 0 ? 2 : 3);
}
