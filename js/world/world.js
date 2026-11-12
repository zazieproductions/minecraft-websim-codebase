// World: chunk map, block access, worker-based generation and classic two-channel light propagation
import { Chunk, CH, idx, ckey } from './chunk.js';
import { LOPAC, LIGHT } from './blocks.js';

class Q { // FIFO of xyz(+v) int tuples
  constructor() { this.a = new Int32Array(1 << 20); this.h = 0; this.t = 0; }
  push(x, y, z, v = 0) { if (this.t + 4 > this.a.length) { if (this.h > 0) { this.a.copyWithin(0, this.h, this.t); this.t -= this.h; this.h = 0; } if (this.t + 4 > this.a.length) { const n = new Int32Array(this.a.length * 2); n.set(this.a); this.a = n; } } const a = this.a; a[this.t] = x; a[this.t + 1] = y; a[this.t + 2] = z; a[this.t + 3] = v; this.t += 4; }
  get empty() { if (this.h >= this.t) { this.h = this.t = 0; return true; } return false; }
}
const DIRS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];

export class World {
  constructor(info, store) {
    this.info = info; this.seed = info.seed; this.store = store; this.dim = info.dim || 0; this.ambient = this.dim === -1 ? 0.1 : 0;
    this.chunks = new Map(); this.pending = new Set(); this.addQ = new Q(); this.remQ = new Q();
    this.workers = []; this.wi = 0; this.listeners = []; this.onChunkLoaded = null; this.onBlockChanged = null;
    const n = Math.max(1, Math.min(3, (navigator.hardwareConcurrency || 2) - 1));
    for (let i = 0; i < n; i++) {
      const w = new Worker(new URL('./genworker.js', import.meta.url), { type: 'module' });
      w.postMessage({ type: 'seed', seed: this.seed, dim: this.dim, wtype: info.type || 0, structures: info.structures !== false });
      w.onmessage = e => this._received(e.data); w.busy = 0; this.workers.push(w);
    }
  }
  destroy() { for (const w of this.workers) w.terminate(); this.workers = []; }
  getChunk(cx, cz) { return this.chunks.get(ckey(cx, cz)); }
  getBlock(x, y, z) { if (y < 0 || y >= CH) return 0; const c = this.chunks.get(ckey(x >> 4, z >> 4)); return c ? c.blocks[idx(x & 15, y, z & 15)] : 0; }
  getMeta(x, y, z) { if (y < 0 || y >= CH) return 0; const c = this.chunks.get(ckey(x >> 4, z >> 4)); return c ? c.meta[idx(x & 15, y, z & 15)] : 0; }
  isLoaded(x, z) { return this.chunks.has(ckey(x >> 4, z >> 4)); }
  getSky(x, y, z) { if (y >= CH) return 15; if (y < 0) return 0; const c = this.chunks.get(ckey(x >> 4, z >> 4)); return c ? c.sky[idx(x & 15, y, z & 15)] : 15; }
  getBlockLight(x, y, z) { if (y < 0 || y >= CH) return 0; const c = this.chunks.get(ckey(x >> 4, z >> 4)); return c ? c.blk[idx(x & 15, y, z & 15)] : 0; }
  biomeAt(x, z) { const c = this.chunks.get(ckey(x >> 4, z >> 4)); return c ? c.biomes[(x & 15) | (z & 15) << 4] : 1; }
  topY(x, z) { for (let y = CH - 1; y > 0; y--) { const b = this.getBlock(x, y, z); if (b && LOPAC[b] > 0) return y; } return 0; }

  // ---------- loading ----------
  request(cx, cz) {
    const k = ckey(cx, cz); if (this.chunks.has(k) || this.pending.has(k)) return false;
    this.pending.add(k);
    this.store.loadChunk(cx, cz).then(saved => {
      if (!this.pending.has(k)) return;
      if (saved) this._received({ cx, cz, blocks: saved.blocks, meta: saved.meta, biomes: saved.biomes, tiles: saved.tiles, mobs: saved.mobs, saved: true });
      else { let w = this.workers[0]; for (const o of this.workers) if (o.busy < w.busy) w = o; w.busy++; w.postMessage({ type: 'gen', cx, cz }); }
    });
    return true;
  }
  get busy() { return this.pending.size; }
  _received(d) {
    const k = ckey(d.cx, d.cz);
    if (!d.saved) { for (const w of this.workers) if (w.busy > 0) { w.busy--; break; } }
    if (!this.pending.has(k)) return; this.pending.delete(k);
    const c = new Chunk(d.cx, d.cz, d.blocks, d.meta, d.biomes);
    if (d.saved) c.modified = false; else { c.fresh = true; c.villageSpawns = d.spawns || null; }
    c.savedMobs = d.mobs || null;
    if (d.tiles) for (const [kk, v] of Object.entries(d.tiles)) c.tiles.set(Number(kk), v);
    if (!d.saved && c.tiles.size) c.modified = true;
    if (!d.saved && this.patchChunk) this.patchChunk(c);
    this.chunks.set(k, c);
    this.lightChunk(c);
    for (const [dx, dz] of [[1,0],[-1,0],[0,1],[0,-1]]) { const n = this.getChunk(d.cx + dx, d.cz + dz); if (n) n.dirty.fill(1); }
    if (this.onChunkLoaded) this.onChunkLoaded(c);
  }
  unload(c) {
    if (c.modified) this.saveChunk(c);
    this.chunks.delete(ckey(c.cx, c.cz));
  }
  saveChunk(c) { c.modified = false; const tiles = {}; for (const [k, v] of c.tiles) tiles[k] = v; return this.store.saveChunk(c.cx, c.cz, { blocks: c.blocks, meta: c.meta, biomes: c.biomes, tiles, mobs: c.savedMobs || null }); }
  saveAll() { const ps = []; for (const c of this.chunks.values()) if (c.modified) ps.push(this.saveChunk(c)); return Promise.all(ps); }
  cancelPending(keep) { for (const k of [...this.pending]) if (!keep(k)) this.pending.delete(k); }

  // ---------- lighting ----------
  _markLight(c, x, y, z) { c.dirty[y >> 4] = 1; const lx = x & 15, lz = z & 15, ly = y & 15;
    if (ly === 0 && y > 0) c.dirty[(y >> 4) - 1] = 1; if (ly === 15 && y < CH - 1) c.dirty[(y >> 4) + 1] = 1;
    if (lx === 0 || lx === 15 || lz === 0 || lz === 15) { const cx = c.cx, cz = c.cz;
      for (let dx = lx === 0 ? -1 : 0; dx <= (lx === 15 ? 1 : 0); dx++) for (let dz = lz === 0 ? -1 : 0; dz <= (lz === 15 ? 1 : 0); dz++) { if (!dx && !dz) continue; const n = this.chunks.get(ckey(cx + dx, cz + dz)); if (n) n.dirty[y >> 4] = 1; } } }
  lightChunk(c) {
    const { blocks, sky, blk } = c; const ox = c.cx * 16, oz = c.cz * 16;
    const top = new Int16Array(256); // lowest y where sky is full 15
    for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
      let v = 15, t = CH;
      for (let y = CH - 1; y >= 0; y--) { const i = idx(x, y, z); const b = blocks[i]; const op = LOPAC[b];
        if (op) { v = Math.max(0, v - op); } if (v === 15) t = y; sky[i] = v;
        const e = LIGHT[b]; if (e) { blk[i] = e; this.addQ.push(ox + x, y, oz + z); } }
      top[x | z << 4] = t;
    }
    const sq = this.addQ;
    for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
      let m = 0;
      for (const [dx, dz] of [[1,0],[-1,0],[0,1],[0,-1]]) { const nx = x + dx, nz = z + dz; const t = (nx < 0 || nz < 0 || nx > 15 || nz > 15) ? CH : top[nx | nz << 4]; if (t > m) m = t; }
      for (let y = Math.min(m, CH - 1); y >= 0; y--) { const i = idx(x, y, z); if (sky[i] > 1) sq.push(ox + x, y, oz + z, 1); }
    }
    // pull light in from already-loaded neighbours
    for (const [dx, dz] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const n = this.getChunk(c.cx + dx, c.cz + dz); if (!n) continue;
      for (let s = 0; s < 16; s++) { const x = dx === 1 ? 0 : dx === -1 ? 15 : s, z = dz === 1 ? 0 : dz === -1 ? 15 : s;
        const wx = n.cx * 16 + x, wz = n.cz * 16 + z;
        for (let y = 0; y < CH; y++) { const i = idx(x, y, z); if (n.sky[i] > 1) sq.push(wx, y, wz, 1); if (n.blk[i] > 1) sq.push(wx, y, wz, 0); } }
    }
    this._propagate();
    c.lit = true; c.dirty.fill(1);
  }
  // queue entries: v=1 sky channel, v=0 block channel
  _propagate() {
    const q = this.addQ; let lc = null, lk = -1;
    while (!q.empty) {
      const a = q.a, h = q.h; const x = a[h], y = a[h + 1], z = a[h + 2], ch = a[h + 3]; q.h += 4;
      let k = ckey(x >> 4, z >> 4); if (k !== lk) { lc = this.chunks.get(k); lk = k; } if (!lc) continue;
      const arr = ch ? lc.sky : lc.blk; const v = arr[idx(x & 15, y, z & 15)]; if (v <= 1) continue;
      for (let d = 0; d < 6; d++) {
        const D = DIRS[d]; const nx = x + D[0], ny = y + D[1], nz = z + D[2]; if (ny < 0 || ny >= CH) continue;
        const nk = ckey(nx >> 4, nz >> 4); const nc = nk === lk ? lc : this.chunks.get(nk); if (!nc) continue;
        const i = idx(nx & 15, ny, nz & 15); const op = LOPAC[nc.blocks[i]]; if (op >= 15) continue;
        const nv = (ch && d === 3 && v === 15 && op === 0) ? 15 : v - Math.max(1, op);
        const na = ch ? nc.sky : nc.blk;
        if (nv > na[i]) { na[i] = nv; this._markLight(nc, nx, ny, nz); q.push(nx, ny, nz, ch); }
      }
    }
  }
  relight(x, y, z) {
    const c = this.getChunk(x >> 4, z >> 4); if (!c) return;
    const i0 = idx(x & 15, y, z & 15); const id = c.blocks[i0];
    for (let ch = 0; ch < 2; ch++) {
      const R = this.remQ; const arr0 = ch ? c.sky : c.blk; const old = arr0[i0];
      arr0[i0] = 0; R.push(x, y, z, old); this._markLight(c, x, y, z);
      while (!R.empty) {
        const a = R.a, h = R.h; const px = a[h], py = a[h + 1], pz = a[h + 2], v = a[h + 3]; R.h += 4;
        for (let d = 0; d < 6; d++) { const D = DIRS[d]; const nx = px + D[0], ny = py + D[1], nz = pz + D[2]; if (ny < 0 || ny >= CH) continue;
          const nc = this.chunks.get(ckey(nx >> 4, nz >> 4)); if (!nc) continue; const i = idx(nx & 15, ny, nz & 15); const na = ch ? nc.sky : nc.blk; const nv = na[i];
          if (nv === 0) continue;
          if (nv < v || (ch && d === 3 && v === 15 && nv === 15)) {
            if (!ch && LIGHT[nc.blocks[i]] === nv) { this.addQ.push(nx, ny, nz, ch); continue; }
            na[i] = 0; this._markLight(nc, nx, ny, nz); R.push(nx, ny, nz, nv);
          } else this.addQ.push(nx, ny, nz, ch);
        }
      }
      if (!ch && LIGHT[id]) { c.blk[i0] = LIGHT[id]; this.addQ.push(x, y, z, 0); }
      if (ch && y === CH - 1 && LOPAC[id] === 0) { c.sky[i0] = 15; this.addQ.push(x, y, z, 1); }
      // neighbours re-flow into this cell
      for (const D of DIRS) { const nx = x + D[0], ny = y + D[1], nz = z + D[2]; if (ny >= 0 && ny < CH) this.addQ.push(nx, ny, nz, ch); }
    }
    this._propagate();
  }

  // ---------- editing ----------
  setBlock(x, y, z, id, meta = 0, opts = {}) {
    if (y < 0 || y >= CH) return false; const c = this.getChunk(x >> 4, z >> 4); if (!c) return false;
    const i = idx(x & 15, y, z & 15); const old = c.blocks[i];
    if (old === id && c.meta[i] === meta) return false;
    c.blocks[i] = id; c.meta[i] = meta; c.modified = true;
    if (old !== id) c.tiles.delete(i);
    this._markLight(c, x, y, z);
    if (LOPAC[old] !== LOPAC[id] || LIGHT[old] !== LIGHT[id]) this.relight(x, y, z);
    if (this.onBlockChanged && !opts.silent) this.onBlockChanged(x, y, z, old, id);
    return true;
  }
  setMeta(x, y, z, meta) { const c = this.getChunk(x >> 4, z >> 4); if (!c) return; const i = idx(x & 15, y, z & 15); if (c.meta[i] === meta) return; c.meta[i] = meta; c.modified = true; this._markLight(c, x, y, z); }
  getTile(x, y, z) { const c = this.getChunk(x >> 4, z >> 4); return c ? c.tiles.get(idx(x & 15, y, z & 15)) : null; }
  setTile(x, y, z, t) { const c = this.getChunk(x >> 4, z >> 4); if (!c) return; c.tiles.set(idx(x & 15, y, z & 15), t); c.modified = true; }
}
