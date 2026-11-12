// World ticking: scheduled fluid updates, random ticks (growth, spread, decay), furnaces, falling blocks
import * as THREE from 'three';
import { brew, INGREDIENTS } from '../inventory/potions.js';
import { blocks as BL, SOLID, OPAQUE, LIGHT, isWater, isLava, isFluid, isRail } from './blocks.js';
import { Entity, blockCubeGeometry } from '../entity/entity.js';
import { smeltResult } from '../inventory/crafting.js';
import { items } from '../inventory/items.js';
import { CH, idx } from './chunk.js';

const H4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const N6 = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
// classic fire tables: id -> [encouragement (catch from nearby fire), flammability (chance to burn away)]
export const FLAM = { 5: [5, 20], 17: [5, 5], 162: [5, 5], 18: [30, 60], 161: [30, 60], 47: [30, 20], 46: [15, 100], 31: [60, 100], 32: [60, 100], 35: [30, 60], 106: [15, 100], 171: [60, 20], 170: [60, 20], 173: [5, 5], 26: [5, 20], 58: [5, 20], 54: [5, 20], 37: [60, 100], 38: [60, 100] };
class FallingBlock extends Entity {
  constructor(world, x, y, z, id, meta) { super(world, x + 0.5, y, z + 0.5); this.id2 = id; this.meta = meta; this.w = 0.98; this.h = 0.98; this.type = 'falling'; }
  tick(game) { this.baseTick(); this.my -= 0.04; this.move(this.mx, this.my, this.mz); this.my *= 0.98;
    if (this.onGround || this.age > 600) { this.dead = true; const x = Math.floor(this.x), y = Math.floor(this.y + 0.5), z = Math.floor(this.z); const cur = this.world.getBlock(x, y, z);
      if (!cur || BL[cur].replaceable) { this.world.setBlock(x, y, z, this.id2, this.meta); game.ticker.schedule(x, y, z, 2); } else game.spawnDrop(this.x, this.y + 0.5, this.z, { id: this.id2, count: 1, dmg: this.meta || 0 }); } }
  render(r, pt, daySub) { if (!this.obj) { this.obj = new THREE.Mesh(blockCubeGeometry(this.id2, r.opts.rows, 0.98, this.meta || 0), new THREE.MeshBasicMaterial({ map: r.atlasTex, vertexColors: true })); r.scene.add(this.obj); }
    this.obj.position.set(this.px + (this.x - this.px) * pt, this.py + (this.y - this.py) * pt + 0.49, this.pz + (this.z - this.pz) * pt); const l = this.lightAt(daySub); this.obj.material.color.setRGB(l, l, l); }
}

export class Ticker {
  constructor(game) { this.g = game; this.w = game.world; this.sched = new Map(); this.furnaces = new Set(); this.now = 0; }
  key(x, y, z) { return x + ',' + y + ',' + z; }
  schedule(x, y, z, delay) { const k = this.key(x, y, z); const t = this.now + delay; const old = this.sched.get(k); if (!old || old > t) this.sched.set(k, t); }
  addFurnace(x, y, z) { this.furnaces.add(this.key(x, y, z)); }
  blockChanged(x, y, z, o, n) {
    for (const [dx, dy, dz] of [[0, 0, 0], [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
      const b = this.w.getBlock(x + dx, y + dy, z + dz);
      if (isFluid(b)) this.schedule(x + dx, y + dy, z + dz, isWater(b) ? 5 : 30);
      if (BL[b]?.falls) this.schedule(x + dx, y + dy, z + dz, 2);
    }
  }
  notifyNeighbors(x, y, z) {
    for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
      const nx = x + dx, ny = y + dy, nz = z + dz; const b = this.w.getBlock(nx, ny, nz); if (!b) continue; const bd = BL[b];
      if (bd.needsSupport && !this.stays(b, nx, ny, nz)) { const m = this.w.getMeta(nx, ny, nz); this.w.setBlock(nx, ny, nz, 0); this.g.dropsFor(b, m, null).forEach(s => this.g.spawnDrop(nx + 0.5, ny + 0.3, nz + 0.5, s)); this.notifyNeighbors(nx, ny, nz); }
      if (b === 26) { const m = this.w.getMeta(nx, ny, nz); const d = [[0, -1], [-1, 0], [0, 1], [1, 0]][m & 3]; const s = m & 8 ? -1 : 1; if (this.w.getBlock(nx + d[0] * s, ny, nz + d[1] * s) !== 26) this.w.setBlock(nx, ny, nz, 0); }
    }
  }
  stays(id, x, y, z) {
    const w = this.w; const below = w.getBlock(x, y - 1, z); const m = w.getMeta(x, y, z);
    if (id === 55 || id === 70 || id === 72 || id === 93 || id === 94 || isRail(id)) return !!(OPAQUE[below] || below === 44 || below === 89);
    if (id === 77 || id === 143) id = 69;
    if (id === 75 || id === 76) id = 50;
    if (id === 50) { if (m === 5) return SOLID[below]; const d = { 1: [-1, 0], 2: [1, 0], 3: [0, -1], 4: [0, 1] }[m]; return d ? OPAQUE[w.getBlock(x + d[0], y, z + d[1])] : true; }
    if (id === 63) return SOLID[below] > 0;
    if (id === 68) { const d = { 2: [0, 1], 3: [0, -1], 4: [1, 0], 5: [-1, 0] }[m]; return d ? SOLID[w.getBlock(x + d[0], y, z + d[1])] > 0 : true; }
    if (id === 65) { const d = { 2: [0, 1], 3: [0, -1], 4: [1, 0], 5: [-1, 0] }[m]; return d ? OPAQUE[w.getBlock(x + d[0], y, z + d[1])] : true; }
    if (id === 106) return true;
    if (id === 64 || id === 71) return m & 8 ? w.getBlock(x, y - 1, z) === id : SOLID[below] > 0 && w.getBlock(x, y + 1, z) === id;
    if (id === 69) { const k = m & 7; if (k === 5) return SOLID[below] > 0; const d = { 1: [-1, 0], 2: [1, 0], 3: [0, -1], 4: [0, 1] }[k]; return d ? OPAQUE[w.getBlock(x + d[0], y, z + d[1])] > 0 : true; }
    if (id === 83) return below === 83 || ((below === 2 || below === 3 || below === 12) && H4.some(([dx, dz]) => isWater(w.getBlock(x + dx, y - 1, z + dz))));
    if (id === 81) return (below === 12 || below === 81) && !H4.some(([dx, dz]) => SOLID[w.getBlock(x + dx, y, z + dz)]);
    if (id === 59) return below === 60;
    if (id === 115) return below === 88;
    if (id === 117) return SOLID[below] > 0;
    if (id === 39 || id === 40) return OPAQUE[below];
    if (id === 78) return SOLID[below] && OPAQUE[below];
    if (id === 32) return below === 12;
    return below === 2 || below === 3 || below === 60;
  }
  tick() {
    this.now++; const w = this.w;
    // scheduled updates
    if (this.sched.size) { const due = []; for (const [k, t] of this.sched) if (t <= this.now) due.push(k); for (const k of due) { this.sched.delete(k); const [x, y, z] = k.split(',').map(Number); this.update(x, y, z); } }
    // random ticks around the player
    const p = this.g.player; const pcx = Math.floor(p.x / 16), pcz = Math.floor(p.z / 16); const R = 7;
    for (const c of w.chunks.values()) { if (Math.abs(c.cx - pcx) > R || Math.abs(c.cz - pcz) > R) continue;
      for (let s = 0; s < 8; s++) for (let i = 0; i < 3; i++) { const r = (Math.random() * 4096) | 0; const lx = r & 15, lz = (r >> 4) & 15, ly = s * 16 + (r >> 8); const id = c.blocks[idx(lx, ly, lz)]; if (id) this.randomTick(c.cx * 16 + lx, ly, c.cz * 16 + lz, id); } }
    // furnaces
    for (const k of [...this.furnaces]) { const [x, y, z] = k.split(',').map(Number); const t = w.getTile(x, y, z); if (!t || !t.slots) { this.furnaces.delete(k); continue; } if (!(t.brewing ? this.brewTick(x, y, z, t) : this.furnaceTick(x, y, z, t))) this.furnaces.delete(k); }
    // fire & flame particles nearby
    if (this.now % 4 === 0) this.ambient(p);
  }
  ambient(p) {
    const w = this.w; for (let i = 0; i < 40; i++) { const x = Math.floor(p.x + (Math.random() - 0.5) * 24), y = Math.floor(p.y + (Math.random() - 0.5) * 16), z = Math.floor(p.z + (Math.random() - 0.5) * 24); const b = w.getBlock(x, y, z);
      if (b === 50) { const m = w.getMeta(x, y, z); const o = { 1: [-0.27, 0], 2: [0.27, 0], 3: [0, -0.27], 4: [0, 0.27] }[m] || [0, 0]; const yy = y + (m === 5 ? 0.7 : 0.92); this.g.particles.fx('smoke', x + 0.5 + o[0], yy, z + 0.5 + o[1]); this.g.particles.fx('flame', x + 0.5 + o[0], yy, z + 0.5 + o[1]); }
      else if (b === 62) { this.g.particles.fx('flame', x + 0.5 + (Math.random() - 0.5) * 0.6, y + 0.3, z + 0.5 + (Math.random() - 0.5) * 0.6); }
      else if (b === 51) { this.g.particles.fx('flame', x + 0.2 + Math.random() * 0.6, y + 0.2 + Math.random() * 0.7, z + 0.2 + Math.random() * 0.6); if (Math.random() < 0.2) this.g.particles.fx('smoke', x + Math.random(), y + 0.8, z + Math.random()); }
      else if ((b === 10 || b === 11) && !w.getBlock(x, y + 1, z) && Math.random() < 0.1) { this.g.particles.fx('lava', x + Math.random(), y + 1, z + Math.random()); this.g.sound('lava', { x, y, z }, 0.4); }
    }
  }
  // brewing stand: slots 0-2 bottles, 3 ingredient; 400 ticks per brew
  brewTick(x, y, z, t) {
    const ing = t.slots[3]; const can = !!ing && INGREDIENTS.has(ing.id) && [0, 1, 2].some(i => t.slots[i] && t.slots[i].id === 373 && brew(t.slots[i].dmg, ing.id) !== null);
    if (!can) { t.brew = 0; return false; }
    if (++t.brew >= 400) { t.brew = 0; for (let i = 0; i < 3; i++) { const b = t.slots[i]; if (b && b.id === 373) { const r = brew(b.dmg, ing.id); if (r !== null) t.slots[i] = { id: 373, count: 1, dmg: r }; } }
      ing.count--; if (ing.count <= 0) t.slots[3] = null; this.g.sound('fizz', { x: x + 0.5, y: y + 0.5, z: z + 0.5 }, 0.5, 1.4); }
    this.w.getChunk(x >> 4, z >> 4).modified = true; return true;
  }
  furnaceTick(x, y, z, t) {
    const [inp, fuel, out] = t.slots; const res = inp ? smeltResult(inp) : null;
    const canSmelt = res && (!out || (out.id === res.id && out.dmg === res.dmg && out.count + res.count <= (items[res.id]?.stack || 64)));
    let changed = false; const wasBurning = t.burn > 0;
    if (t.burn > 0) t.burn--;
    if (t.burn === 0 && canSmelt && fuel && items[fuel.id]?.fuel) { t.burn = t.burnMax = items[fuel.id].fuel; fuel.count--; if (fuel.id === 327) t.slots[1] = { id: 325, count: 1, dmg: 0 }; else if (fuel.count <= 0) t.slots[1] = null; changed = true; }
    if (t.burn > 0 && canSmelt) { t.cook++; if (t.cook >= 200) { t.cook = 0; if (out) out.count += res.count; else t.slots[2] = { ...res }; inp.count--; if (inp.count <= 0) t.slots[0] = null; this.g.achievements.onSmelt(res.id); } } else t.cook = 0;
    const burning = t.burn > 0; if (burning !== wasBurning) { const m = this.w.getMeta(x, y, z); const tile = t; this.w.setBlock(x, y, z, burning ? 62 : 61, m, { silent: true }); this.w.setTile(x, y, z, tile); }
    this.w.getChunk(x >> 4, z >> 4).modified = true;
    return burning || canSmelt;
  }
  update(x, y, z) {
    const w = this.w; const id = w.getBlock(x, y, z);
    if (BL[id]?.falls) { const b = w.getBlock(x, y - 1, z); if (!b || isFluid(b) || b === 51) { const m = w.getMeta(x, y, z); w.setBlock(x, y, z, 0); this.g.entities.push(new FallingBlock(w, x, y, z, id, m)); } return; }
    if (id === 51) { this.fireTick(x, y, z); return; }
    if (isFluid(id)) this.flow(x, y, z, id);
  }
  // ---------- fire: ages, burns flammable neighbours away and spreads to nearby air ----------
  encouragement(x, y, z) { const w = this.w; if (w.getBlock(x, y, z)) return 0; let e = 0; for (const [dx, dy, dz] of N6) { const f = FLAM[w.getBlock(x + dx, y + dy, z + dz)]; if (f) e = Math.max(e, f[0]); } return e; }
  canBurnAt(x, y, z) { for (const [dx, dy, dz] of N6) if (FLAM[this.w.getBlock(x + dx, y + dy, z + dz)]) return true; return false; }
  burn(x, y, z, chance, age) { const w = this.w, id = w.getBlock(x, y, z), f = FLAM[id], bm = w.getMeta(x, y, z); if (!f || Math.random() * chance >= f[1]) return;
    if (id === 46) { w.setBlock(x, y, z, 0); this.g.mobs.spawnTNT(x, y, z); return; }
    if (Math.random() * (age + 10) < 5) w.setBlock(x, y, z, 51, Math.min(15, age + ((Math.random() * 5) | 0) / 4 | 0)); else w.setBlock(x, y, z, 0);
    if (id === 26) this.g.breakBedPart(x, y, z, bm); }
  // fire next to lava never runs out of fuel: lava and fire sit side by side
  fueled(x, y, z) { for (const [dx, dy, dz] of N6) { const b = this.w.getBlock(x + dx, y + dy, z + dz); if (FLAM[b] || b === 10 || b === 11) return true; } return false; }
  fireTick(x, y, z) {
    const w = this.w, below = w.getBlock(x, y - 1, z), eternal = below === 87;
    const lavaFed = this.fueled(x, y, z) && !this.canBurnAt(x, y, z);
    if (!SOLID[below] && !this.fueled(x, y, z)) { w.setBlock(x, y, z, 0); return; }
    let age = w.getMeta(x, y, z); if (age < 15) { age = Math.min(15, age + ((Math.random() * 3) | 0)); w.setMeta(x, y, z, age); }
    this.schedule(x, y, z, 30 + ((Math.random() * 10) | 0));
    if (!eternal && !lavaFed && !this.canBurnAt(x, y, z)) { if (!SOLID[below] || age > 3) w.setBlock(x, y, z, 0); return; }
    if (!eternal && !lavaFed && !FLAM[below] && age === 15 && Math.random() < 0.25) { w.setBlock(x, y, z, 0); return; }
    this.burn(x + 1, y, z, 300, age); this.burn(x - 1, y, z, 300, age); this.burn(x, y - 1, z, 250, age); this.burn(x, y + 1, z, 250, age); this.burn(x, y, z + 1, 300, age); this.burn(x, y, z - 1, 300, age);
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) for (let dy = -1; dy <= 4; dy++) { if (!dx && !dy && !dz) continue;
      const nx = x + dx, ny = y + dy, nz = z + dz; if (ny < 1 || ny >= CH) continue; const e = this.encouragement(nx, ny, nz); if (e <= 0) continue;
      const chance = 100 + (dy > 1 ? (dy - 1) * 100 : 0); const ch = ((e + 40) / (age + 30)) | 0; if (ch > 0 && Math.random() * chance <= ch) { w.setBlock(nx, ny, nz, 51, Math.min(15, age + 1 + ((Math.random() * 5) | 0) / 4 | 0)); this.schedule(nx, ny, nz, 30 + ((Math.random() * 10) | 0)); } }
  }
  // lava sets fire to flammable blocks around it (classic stationary-lava random tick)
  lavaIgnite(x, y, z) {
    const w = this.w; const n = (Math.random() * 3) | 0; let cx = x, cy = y, cz = z;
    if (n > 0) { for (let i = 0; i < n; i++) { cx += ((Math.random() * 3) | 0) - 1; cy++; cz += ((Math.random() * 3) | 0) - 1; if (cy >= CH) return; const b = w.getBlock(cx, cy, cz);
        if (!b) { if (this.canBurnAt(cx, cy, cz)) { w.setBlock(cx, cy, cz, 51); this.schedule(cx, cy, cz, 30); return; } } else if (SOLID[b]) return; } }
    else for (let i = 0; i < 3; i++) { const ax = x + ((Math.random() * 3) | 0) - 1, az = z + ((Math.random() * 3) | 0) - 1; if (!w.getBlock(ax, y + 1, az) && FLAM[w.getBlock(ax, y, az)]) { w.setBlock(ax, y + 1, az, 51); this.schedule(ax, y + 1, az, 30); } }
  }
  // ---------- classic fluid flow ----------
  level(x, y, z, water) { const b = this.w.getBlock(x, y, z); if (water ? !isWater(b) : !isLava(b)) return -1; const m = this.w.getMeta(x, y, z); return m >= 8 ? 0 : m; }
  canFlowInto(x, y, z, water) { const b = this.w.getBlock(x, y, z); if (!b) return true; if (water ? isWater(b) : isLava(b)) return false; if (isFluid(b)) return true; const bd = BL[b]; return !bd.solid && (bd.replaceable || bd.shape === 'cross' || bd.shape === 'torch'); }
  flow(x, y, z, id) {
    const w = this.w; const water = isWater(id); const decay = water ? 1 : 2; const delay = water ? 5 : 30;
    // lava vs water
    if (!water) { for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, 0, 1], [0, 0, -1]]) if (isWater(w.getBlock(x + dx, y + dy, z + dz))) { const m = w.getMeta(x, y, z); w.setBlock(x, y, z, m === 0 ? 49 : 4); this.g.sound('fizz', { x, y, z }, 0.5); for (let i = 0; i < 6; i++) this.g.particles.fx('smoke', x + Math.random(), y + 1, z + Math.random()); return; } }
    let meta = w.getMeta(x, y, z); const flowing = water ? 8 : 10, still = water ? 9 : 11;
    if (id === still) { w.setBlock(x, y, z, flowing, meta, { silent: true }); }
    if (meta !== 0) { // non-source: recompute
      let minL = 99, sources = 0;
      for (const [dx, dz] of H4) { const l = this.level(x + dx, y, z + dz, water); if (l >= 0) { if (l === 0 && w.getMeta(x + dx, y, z + dz) === 0) sources++; if (l < minL) minL = l; } }
      let nl = minL + decay; if (nl >= 8 || minL < 0) nl = -1;
      if (this.level(x, y + 1, z, water) >= 0) nl = 8;
      if (sources >= 2 && water) { const bl = w.getBlock(x, y - 1, z); if (SOLID[bl] || (isWater(bl) && w.getMeta(x, y - 1, z) === 0)) nl = 0; }
      if (nl !== meta) { if (nl < 0) { w.setBlock(x, y, z, 0); return; } meta = nl; w.setBlock(x, y, z, flowing, meta, { silent: true }); this.schedule(x, y, z, delay); this.blockChanged(x, y, z); }
      else w.setBlock(x, y, z, still, meta, { silent: true });
    } else w.setBlock(x, y, z, still, 0, { silent: true });
    // spread
    const eff = meta >= 8 ? 0 : meta;
    const bb = w.getBlock(x, y - 1, z);
    if (this.canFlowInto(x, y - 1, z, water)) {
      if (!water && isWater(bb)) { w.setBlock(x, y - 1, z, 1); return; }
      this.replaceFlow(x, y - 1, z, flowing, 8, delay); return;
    }
    // falling onto a thin horizontal sheet of the same fluid turns it into a falling column
    if ((water ? isWater(bb) : isLava(bb))) { const bm = w.getMeta(x, y - 1, z); if (bm !== 0 && bm < 8) { this.replaceFlow(x, y - 1, z, flowing, 8, delay); return; } }
    if (eff + decay >= 8) return;
    if (meta !== 0 && meta < 8 && this.level(x, y - 1, z, water) >= 0) return;
    const dirs = this.optimal(x, y, z, water);
    const nlv = eff + decay;
    for (let i = 0; i < 4; i++) if (dirs[i]) { const [dx, dz] = H4[i]; const nx = x + dx, nz = z + dz;
      const nb = w.getBlock(nx, y, nz);
      if (water ? isWater(nb) : isLava(nb)) { const m = w.getMeta(nx, y, nz); if (m !== 0 && m < 8 && m > nlv) this.replaceFlow(nx, y, nz, flowing, nlv, delay); continue; }
      if (!this.canFlowInto(nx, y, nz, water)) continue;
      if (!water && isWater(nb)) continue;
      this.replaceFlow(nx, y, nz, flowing, nlv, delay); }
  }
  replaceFlow(x, y, z, id, meta, delay) { const w = this.w; const old = w.getBlock(x, y, z); if (old && !isFluid(old)) { const m = w.getMeta(x, y, z); this.g.dropsFor(old, m, null).forEach(s => this.g.spawnDrop(x + 0.5, y + 0.3, z + 0.5, s)); } w.setBlock(x, y, z, id, meta, { silent: true }); this.schedule(x, y, z, delay); }
  optimal(x, y, z, water) {
    const cost = [Infinity, Infinity, Infinity, Infinity];
    const search = (sx, sz, dist, from) => { let best = 1000; for (let i = 0; i < 4; i++) { if (i === (from ^ 1)) continue; const [dx, dz] = H4[i]; const nx = sx + dx, nz = sz + dz; if (!this.canFlowInto(nx, y, nz, water) && !(this.level(nx, y, nz, water) > 0)) continue; if (this.level(nx, y, nz, water) === 0 && this.w.getMeta(nx, y, nz) === 0) continue; if (this.canFlowInto(nx, y - 1, nz, water)) return dist; if (dist < 4) { const c = search(nx, nz, dist + 1, i); if (c < best) best = c; } } return best; };
    for (let i = 0; i < 4; i++) { const [dx, dz] = H4[i]; const nx = x + dx, nz = z + dz; if (!this.canFlowInto(nx, y, nz, water) && !(this.level(nx, y, nz, water) > 0)) continue; if (this.level(nx, y, nz, water) === 0 && this.w.getMeta(nx, y, nz) === 0) continue; cost[i] = this.canFlowInto(nx, y - 1, nz, water) ? 0 : search(nx, nz, 1, i); }
    const m = Math.min(...cost); return cost.map(c => c === m && c !== Infinity);
  }
  // ---------- random ticks ----------
  randomTick(x, y, z, id) {
    const w = this.w; const light = () => Math.max(w.getSky(x, y + 1, z) - Math.round(this.g.renderer.uniforms.daySub.value), w.getBlockLight(x, y + 1, z));
    switch (id) {
      case 2: { const ab = w.getBlock(x, y + 1, z); if (light() < 4 && OPAQUE[ab] || isFluid(ab)) w.setBlock(x, y, z, 3); else if (light() >= 9) { const nx = x + (Math.random() * 3 | 0) - 1, ny = y + (Math.random() * 5 | 0) - 3, nz = z + (Math.random() * 3 | 0) - 1; if (w.getBlock(nx, ny, nz) === 3 && w.getMeta(nx, ny, nz) === 0 && !OPAQUE[w.getBlock(nx, ny + 1, nz)] && Math.max(w.getSky(nx, ny + 1, nz), w.getBlockLight(nx, ny + 1, nz)) >= 4) w.setBlock(nx, ny, nz, 2); } break; }
      case 3: break;
      case 59: { const m = w.getMeta(x, y, z); if (m < 7 && light() >= 9 && Math.random() < (w.getMeta(x, y - 1, z) > 0 ? 0.25 : 0.12)) w.setMeta(x, y, z, m + 1); break; }
      case 60: { let wet = false; for (let dx = -4; dx <= 4 && !wet; dx++) for (let dz = -4; dz <= 4 && !wet; dz++) for (let dy = 0; dy <= 1; dy++) if (isWater(w.getBlock(x + dx, y + dy, z + dz))) { wet = true; break; } w.setMeta(x, y, z, wet ? 7 : 0); if (!wet && w.getBlock(x, y + 1, z) !== 59 && Math.random() < 0.2) w.setBlock(x, y, z, 3); if (OPAQUE[w.getBlock(x, y + 1, z)]) w.setBlock(x, y, z, 3); break; }
      case 6: if (light() >= 9 && Math.random() < 1 / 7) this.growTree(x, y, z, w.getMeta(x, y, z) & 7); break;
      case 81: case 83: { if (w.getBlock(x, y + 1, z)) break; let h = 1; while (w.getBlock(x, y - h, z) === id) h++; if (h < 3 && Math.random() < 1 / 4) { w.setBlock(x, y + 1, z, id); if (!this.stays(id, x, y + 1, z)) { w.setBlock(x, y + 1, z, 0); this.g.spawnDrop(x + 0.5, y + 1.5, z + 0.5, { id: id === 83 ? 338 : 81, count: 1, dmg: 0 }); } } break; }
      case 18: case 161: { const m = w.getMeta(x, y, z); if (m & 4) break; let log = false; for (let dx = -4; dx <= 4 && !log; dx++) for (let dy = -4; dy <= 4 && !log; dy++) for (let dz = -4; dz <= 4; dz++) { const lb = w.getBlock(x + dx, y + dy, z + dz); if (lb === 17 || lb === 162) { log = true; break; } }
        if (!log) { w.setBlock(x, y, z, 0); this.g.dropsFor(id, m, null).forEach(s => this.g.spawnDrop(x + 0.5, y + 0.5, z + 0.5, s)); } break; }
      case 79: case 78: if (w.getBlockLight(x, y, z) > 11 || w.getBlockLight(x, y + 1, z) > 11) w.setBlock(x, y, z, id === 79 ? 9 : 0); break;
      case 74: w.setBlock(x, y, z, 73); break;
      case 115: { const m = w.getMeta(x, y, z); if (m < 3 && Math.random() < 0.1) w.setMeta(x, y, z, m + 1); break; }
      case 51: this.update(x, y, z); break;
      case 10: case 11: this.lavaIgnite(x, y, z); break;
    }
  }
  boneMeal(x, y, z) {
    const w = this.w; const id = w.getBlock(x, y, z);
    if (id === 6) { this.growTree(x, y, z, w.getMeta(x, y, z) & 7); return true; }
    if (id === 59) { w.setMeta(x, y, z, 7); return true; }
    if (id === 2) { for (let i = 0; i < 64; i++) { const nx = x + (Math.random() * 7 | 0) - 3, nz = z + (Math.random() * 7 | 0) - 3; for (let dy = 2; dy >= -2; dy--) { if (w.getBlock(nx, y + dy, nz) === 2 && !w.getBlock(nx, y + dy + 1, nz)) { w.setBlock(nx, y + dy + 1, nz, Math.random() < 0.9 ? 31 : Math.random() < 0.66 ? 37 : 38, 1); break; } } } return true; }
    return false;
  }
  growTree(x, y, z, type) {
    const w = this.w;
    if (type >= 4) return this.growTree2(x, y, z, type - 4); const h = type === 1 ? 7 : type === 2 ? 6 : 4 + (Math.random() * 3 | 0);
    for (let i = 1; i <= h + 1; i++) { const b = w.getBlock(x, y + i, z); if (b && b !== 18) return; }
    if (y + h + 2 >= CH) return;
    const leaf = (lx, ly, lz) => { const b = w.getBlock(lx, ly, lz); if (!b || b === 31 || b === 78) w.setBlock(lx, ly, lz, 18, type); };
    if (type === 1) { let r = 0; for (let ly = y + h; ly >= y + 2; ly--) { for (let lx = -r; lx <= r; lx++) for (let lz = -r; lz <= r; lz++) if (!(r && Math.abs(lx) === r && Math.abs(lz) === r)) leaf(x + lx, ly, z + lz); r = r >= 2 ? 1 : r + 1; } leaf(x, y + h + 1, z); }
    else for (let ly = y + h - 3; ly <= y + h; ly++) { const d = ly - (y + h); const r = 1 - (d >> 1); for (let lx = -r; lx <= r; lx++) for (let lz = -r; lz <= r; lz++) { if (Math.abs(lx) === r && Math.abs(lz) === r && (Math.random() < 0.5 || d === 0)) continue; leaf(x + lx, ly, z + lz); } }
    for (let i = 0; i < h; i++) w.setBlock(x, y + i, z, 17, type);
    if (w.getBlock(x, y - 1, z) === 2) w.setBlock(x, y - 1, z, 3);
  }
  // acacia (0): leaning trunk with a flat canopy; dark oak (1): thick short trunk with a wide canopy
  growTree2(x, y, z, kind) {
    const w = this.w; const h = kind ? 5 + (Math.random() * 2 | 0) : 5 + (Math.random() * 3 | 0);
    for (let i = 1; i <= h + 1; i++) { const b = w.getBlock(x, y + i, z); if (b && b !== 161) return; }
    if (y + h + 3 >= CH) return;
    const leaf = (lx, ly, lz) => { const b = w.getBlock(lx, ly, lz); if (!b || b === 31 || b === 78) w.setBlock(lx, ly, lz, 161, kind); };
    const dir = [[1, 0], [-1, 0], [0, 1], [0, -1]][Math.random() * 4 | 0]; let tx = x, tz = z;
    for (let i = 0; i < h; i++) { if (!kind && i >= h - 2) { tx += dir[0]; tz += dir[1]; } w.setBlock(tx, y + i, tz, 162, kind); }
    const top = y + h, R = kind ? 3 : 3;
    for (let lx = -R; lx <= R; lx++) for (let lz = -R; lz <= R; lz++) { if (Math.abs(lx) + Math.abs(lz) > R + 1) continue; leaf(tx + lx, top - (kind ? 1 : 0), tz + lz); }
    for (let lx = -R + 1; lx <= R - 1; lx++) for (let lz = -R + 1; lz <= R - 1; lz++) if (Math.abs(lx) + Math.abs(lz) <= R) leaf(tx + lx, top, tz + lz);
    if (kind) for (let lx = -1; lx <= 1; lx++) for (let lz = -1; lz <= 1; lz++) leaf(tx + lx, top + 1, tz + lz);
    if (w.getBlock(x, y - 1, z) === 2) w.setBlock(x, y - 1, z, 3);
  }
}
