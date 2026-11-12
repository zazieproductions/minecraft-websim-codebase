// 1.2.5-style terrain generator: biome-blended 3D density, surface rules, worm caves, ores, decoration
import { Octaves, mulberry, chunkSeed } from './noise.js';
import { buildVillages } from './village.js';
export const CH = 128, SEA = 63;
export const idx = (x, y, z) => x | (z << 4) | (y << 8);

// id, name, base, var, top, filler, temp, rain, grass rgb, foliage rgb
export const BIOMES = [
  { name: 'Ocean', base: -1.0, vari: 0.1, top: 13, fill: 13, temp: 0.5, rain: 0.5 },
  { name: 'Plains', base: 0.1, vari: 0.3, top: 2, fill: 3, temp: 0.8, rain: 0.4 },
  { name: 'Desert', base: 0.1, vari: 0.2, top: 12, fill: 12, temp: 2.0, rain: 0.0 },
  { name: 'Extreme Hills', base: 0.3, vari: 1.5, top: 2, fill: 3, temp: 0.2, rain: 0.3 },
  { name: 'Forest', base: 0.1, vari: 0.3, top: 2, fill: 3, temp: 0.7, rain: 0.8 },
  { name: 'Taiga', base: 0.1, vari: 0.4, top: 2, fill: 3, temp: 0.05, rain: 0.8, snow: true },
  { name: 'Swampland', base: -0.2, vari: 0.1, top: 2, fill: 3, temp: 0.8, rain: 0.9 },
  { name: 'River', base: -0.5, vari: 0.0, top: 2, fill: 3, temp: 0.5, rain: 0.5 },
  { name: 'Ice Plains', base: 0.1, vari: 0.3, top: 2, fill: 3, temp: 0.0, rain: 0.5, snow: true },
  { name: 'Jungle', base: 0.2, vari: 0.4, top: 2, fill: 3, temp: 1.2, rain: 0.9 },
  { name: 'Frozen River', base: -0.5, vari: 0.0, top: 2, fill: 3, temp: 0.0, rain: 0.5, snow: true },
  { name: 'Frozen Ocean', base: -1.0, vari: 0.1, top: 13, fill: 13, temp: 0.0, rain: 0.5, snow: true },
  // 1.7 "Update that Changed the World" biomes
  { name: 'Beach', base: 0.0, vari: 0.05, top: 12, fill: 12, temp: 0.8, rain: 0.4 },
  { name: 'Deep Ocean', base: -1.8, vari: 0.1, top: 13, fill: 13, temp: 0.5, rain: 0.5 },
  { name: 'Birch Forest', base: 0.1, vari: 0.3, top: 2, fill: 3, temp: 0.6, rain: 0.6 },
  { name: 'Roofed Forest', base: 0.1, vari: 0.3, top: 2, fill: 3, temp: 0.7, rain: 0.8 },
  { name: 'Flower Forest', base: 0.1, vari: 0.4, top: 2, fill: 3, temp: 0.7, rain: 0.8 },
  { name: 'Savanna', base: 0.125, vari: 0.05, top: 2, fill: 3, temp: 1.2, rain: 0.0 },
  { name: 'Mesa', base: 0.3, vari: 0.15, top: 12, topMeta: 1, fill: 172, temp: 2.0, rain: 0.0, mesa: true },
  { name: 'Mega Taiga', base: 0.2, vari: 0.2, top: 2, fill: 3, temp: 0.3, rain: 0.8 },
];
export const BIO = { OCEAN: 0, PLAINS: 1, DESERT: 2, HILLS: 3, FOREST: 4, TAIGA: 5, SWAMP: 6, RIVER: 7, ICE: 8, JUNGLE: 9, FRIVER: 10, FOCEAN: 11, BEACH: 12, DEEP: 13, BIRCH: 14, ROOFED: 15, FLOWER: 16, SAVANNA: 17, MESA: 18, MEGA_TAIGA: 19 };
// classic colormap lookup (approximation of grass/foliage colormaps)
function colormap(t, r, isFoliage) {
  t = Math.max(0, Math.min(1, t)); r = Math.max(0, Math.min(1, r)) * t;
  const c00 = isFoliage ? [26, 191, 0] : [71, 205, 51];   // hot+wet
  const c10 = isFoliage ? [174, 164, 42] : [191, 183, 85]; // hot+dry
  const c01 = isFoliage ? [96, 161, 123] : [128, 180, 151]; // cold
  const a = [0, 1, 2].map(i => c10[i] + (c00[i] - c10[i]) * (r / Math.max(t, 0.001)));
  return [0, 1, 2].map(i => (c01[i] + (a[i] - c01[i]) * t) | 0);
}
for (const b of BIOMES) { b.grass = colormap(Math.min(b.temp, 1), b.rain, false); b.foliage = colormap(Math.min(b.temp, 1), b.rain, true); }
BIOMES[BIO.SWAMP].grass = [106, 112, 57]; BIOMES[BIO.SWAMP].foliage = [106, 112, 57];
{ const r = BIOMES[BIO.ROOFED]; r.grass = r.grass.map((v, i) => (v + [40, 52, 10][i]) >> 1); }
BIOMES[BIO.MESA].grass = [144, 129, 77]; BIOMES[BIO.MESA].foliage = [158, 129, 77];
// mesa clay strata: hardened clay with stained bands (orange, yellow, brown, red, white, light gray)
const MESA_BANDS = (() => { const r = mulberry(1907); const b = new Int8Array(64).fill(-1); for (let i = 0; i < 64; i++) { const v = r(); if (v < 0.42) b[i] = [1, 4, 12, 14, 0, 8, 1, 1][(r() * 8) | 0]; } return b; })();
export const mesaBand = y => MESA_BANDS[((y % 64) + 64) % 64];

export class Generator {
  constructor(seed, opts = {}) {
    this.seed = seed >>> 0; this.wtype = opts.wtype || 0; this.structures = opts.structures !== false; this.bs = this.wtype === 2 ? 4 : 1;
    const r = mulberry(this.seed);
    this.dens = new Octaves(r, 5); this.detail = new Octaves(r, 3); this.hnoise = new Octaves(r, 4);
    this.temp = new Octaves(r, 3); this.rain = new Octaves(r, 3); this.cont = new Octaves(r, 4); this.river = new Octaves(r, 4); this.mount = new Octaves(r, 3);
    this.surf = new Octaves(r, 3); this.beach = new Octaves(r, 3); this.place = new Octaves(r, 2);
    this.colCache = new Map(); this.bioCache = new Map();
  }
  biomeAt(x, z) {
    const k = x * 73856093 ^ z * 19349663; const key = x + ',' + z;
    let b = this.bioCache.get(key); if (b !== undefined) return b;
    if (this.wtype === 1) return BIO.PLAINS;
    const S = this.bs;
    const c = this.cont.n2(x / 700 / S, z / 700 / S) + 0.12;
    const t = this.temp.n2(x / 420 / S, z / 420 / S) * 1.6 + this.detail.n2(x / 30, z / 30) * 0.05;
    const h = this.rain.n2(x / 380 / S + 50, z / 380 / S) * 1.6;
    const v = this.mount.n2(x / 210 / S + 100, z / 210 / S - 50);
    const cold = t < -0.32;
    // 1.7-like land/sea split: roughly a third of the world is ocean, the deepest parts deep ocean
    if (c < -0.11) b = cold ? BIO.FOCEAN : BIO.DEEP;
    else if (c < 0.02) b = cold ? BIO.FOCEAN : BIO.OCEAN;
    else if (c < 0.034 && !cold && this.mount.n2(x / 260 / S, z / 260 / S) <= 0.28) b = BIO.BEACH;
    else if (Math.abs(this.river.n2(x / 330 / S, z / 330 / S)) < 0.022 && c > 0.05) b = cold ? BIO.FRIVER : BIO.RIVER;
    else if (this.mount.n2(x / 260 / S, z / 260 / S) > 0.28) b = BIO.HILLS;
    else if (cold) b = h < -0.05 ? BIO.ICE : BIO.TAIGA;
    else if (t < -0.18 && h > 0.05 && v > 0.15) b = BIO.MEGA_TAIGA;
    else if (t > 0.3 && h < -0.05) b = t > 0.45 && v > 0.05 ? BIO.MESA : BIO.DESERT;
    else if (t > 0.3 && h < 0.14) b = BIO.SAVANNA;
    else if (t > 0.22 && h > 0.2) b = BIO.JUNGLE;
    else if (h > 0.32) b = BIO.SWAMP;
    else if (h > -0.02) b = v > 0.3 ? BIO.ROOFED : v < -0.3 ? BIO.BIRCH : Math.abs(v) < 0.03 ? BIO.FLOWER : BIO.FOREST;
    else b = BIO.PLAINS;
    if (this.bioCache.size > 60000) this.bioCache.clear();
    this.bioCache.set(key, b); return b;
  }
  // density column at a 4-block grid point (gx,gz in grid units)
  column(gx, gz) {
    const key = gx + ',' + gz; let col = this.colCache.get(key); if (col) return col;
    let bs = 0, vs = 0, ws = 0;
    for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
      const bio = BIOMES[this.biomeAt((gx + dx) * 4, (gz + dz) * 4)];
      const w = 10 / Math.sqrt(dx * dx + dz * dz + 0.2) / (bio.base + 2);
      bs += bio.base * w; vs += bio.vari * w; ws += w;
    }
    const base = bs / ws, vari = vs / ws;
    const wx = gx * 4, wz = gz * 4;
    const hn = this.hnoise.n2(wx / 200, wz / 200) * 0.25;
    const h = this.wtype === 3 && base > -0.3 ? 70 + (base + hn) * 20 : 67 + (base + hn) * 17;
    const spread = this.wtype === 3 ? 1.5 + vari * 22 + Math.max(0, base + 0.2) * 60 * (1 + vari * 2) : 1.5 + vari * 22;
    col = new Float32Array(17);
    for (let gy = 0; gy < 17; gy++) {
      const y = gy * 8;
      const n = this.dens.n3(wx / 90, y / 70, wz / 90) * 1.6 + this.detail.n3(wx / 24, y / 18, wz / 24) * 0.25;
      let d = (h - y) / spread + n;
      if (y > 120) d -= (y - 120) / 3;
      col[gy] = d;
    }
    if (this.colCache.size > 30000) this.colCache.clear();
    this.colCache.set(key, col); return col;
  }
  densityAt(x, y, z) {
    const gx = Math.floor(x / 4), gz = Math.floor(z / 4), fx = (x - gx * 4) / 4, fz = (z - gz * 4) / 4;
    const gy = Math.min(15, y >> 3), fy = (y - gy * 8) / 8;
    const a = this.column(gx, gz), b = this.column(gx + 1, gz), c = this.column(gx, gz + 1), d = this.column(gx + 1, gz + 1);
    const l = (p, q, t) => p + (q - p) * t;
    const v0 = l(l(a[gy], b[gy], fx), l(c[gy], d[gy], fx), fz), v1 = l(l(a[gy + 1], b[gy + 1], fx), l(c[gy + 1], d[gy + 1], fx), fz);
    return l(v0, v1, fy);
  }
  surfaceAt(x, z) { for (let y = CH - 2; y > 1; y--) if (this.densityAt(x, y, z) > 0) return y; return 0; }

  generate(cx, cz) {
    const blocks = new Uint8Array(16 * 16 * CH), meta = new Uint8Array(16 * 16 * CH), biomes = new Uint8Array(256);
    const ox = cx * 16, oz = cz * 16;
    for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) biomes[x | z << 4] = this.biomeAt(ox + x, oz + z);
    if (this.wtype === 1) { // superflat: bedrock, two dirt, grass
      for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) { blocks[idx(x, 0, z)] = 7; blocks[idx(x, 1, z)] = 3; blocks[idx(x, 2, z)] = 3; blocks[idx(x, 3, z)] = 2; }
      return { blocks, meta, biomes, spawns: null, tiles: {} };
    }
    // terrain density, interpolated from 4x8x4 grid
    const g = [];
    for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) g.push(this.column(cx * 4 + i, cz * 4 + j));
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      const a = g[i * 5 + j], b = g[(i + 1) * 5 + j], c = g[i * 5 + j + 1], d = g[(i + 1) * 5 + j + 1];
      for (let gy = 0; gy < 16; gy++) for (let sy = 0; sy < 8; sy++) {
        const fy = sy / 8, y = gy * 8 + sy;
        const A = a[gy] + (a[gy + 1] - a[gy]) * fy, Bv = b[gy] + (b[gy + 1] - b[gy]) * fy, C = c[gy] + (c[gy + 1] - c[gy]) * fy, D = d[gy] + (d[gy + 1] - d[gy]) * fy;
        for (let sx = 0; sx < 4; sx++) { const fx = sx / 4; const e = A + (Bv - A) * fx, f = C + (D - C) * fx;
          for (let sz = 0; sz < 4; sz++) { const v = e + (f - e) * (sz / 4); const x = i * 4 + sx, z = j * 4 + sz; const k = idx(x, y, z);
            if (v > 0) blocks[k] = 1; else if (y <= SEA) blocks[k] = 9; } }
      }
    }
    const rand = mulberry(chunkSeed(this.seed, cx, cz, 1));
    // surface replacement
    for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
      const bio = BIOMES[biomes[x | z << 4]];
      const wx = ox + x, wz = oz + z;
      const sn = this.surf.n2(wx / 12, wz / 12);
      const depth = (3 + sn * 3 + rand() * 0.5) | 0;
      const sandBeach = this.beach.n2(wx / 40, wz / 40) + rand() * 0.15 > 0.0;
      const gravelBeach = this.beach.n2(wz / 40 + 30, wx / 40) + rand() * 0.15 > 0.35;
      let run = -1, top = bio.top, fill = bio.fill;
      for (let y = CH - 1; y >= 0; y--) {
        const k = idx(x, y, z);
        if (y <= (rand() * 5) | 0) { blocks[k] = 7; continue; }
        const b = blocks[k];
        if (b === 0) { run = -1; continue; }
        if (b !== 1) continue;
        if (run === -1) {
          if (depth <= 0) { top = 0; fill = 1; }
          else if (y >= SEA - 4 && y <= SEA + 1) {
            top = bio.top; fill = bio.fill;
            if (gravelBeach) { top = 0; fill = 13; }
            if (sandBeach) { top = 12; fill = 12; }
          } else { top = bio.top; fill = bio.fill; }
          if (y < SEA && top === 0) top = 9;
          run = depth;
          if (y >= SEA) { blocks[k] = top || 0; if (top === bio.top && bio.topMeta) meta[k] = bio.topMeta; } else blocks[k] = top === 2 ? (bio.top === 12 ? 12 : 3) : (top === 9 ? 9 : top === 0 ? fill : top);
          if (blocks[k] === 0) blocks[k] = fill;
        } else if (run > 0) {
          run--; blocks[k] = fill;
          if (run === 0 && fill === 12) { run = (rand() * 4) | 0; fill = 24; }
        }
      }
      if (bio.mesa) { // clay strata from the surface down to near sea level
        let y = CH - 1; while (y > 0 && !blocks[idx(x, y, z)]) y--; const top = y;
        for (; y > SEA - 8 && y > top - 40; y--) { const k = idx(x, y, z), b = blocks[k]; if (b === 1 || b === 172 || (b === 3 && y < top)) { const c = mesaBand(y); if (c < 0) { blocks[k] = 172; meta[k] = 0; } else { blocks[k] = 159; meta[k] = c; } } }
      } else if (biomes[x | z << 4] === BIO.MEGA_TAIGA) { // podzol and coarse dirt patches
        const n = this.surf.n2(wx / 9 + 40, wz / 9); if (n > 0.08 || n < -0.3) { for (let y = CH - 1; y > SEA; y--) { const k = idx(x, y, z); if (blocks[k] === 2) { blocks[k] = 3; meta[k] = n > 0.08 ? 2 : 1; break; } if (blocks[k]) break; } }
      }
    }
    this.caves(cx, cz, blocks);
    this.ravines(cx, cz, blocks);
    this.ores(rand, blocks);
    const tiles = this.dungeons(cx, cz, blocks, meta);
    this.decorate(cx, cz, blocks, meta, biomes);
    const spawns = this.structures ? buildVillages(this, cx, cz, blocks, meta) : null;
    // snow & ice on cold biomes
    for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
      if (!BIOMES[biomes[x | z << 4]].snow) continue;
      for (let y = CH - 2; y > 0; y--) { const b = blocks[idx(x, y, z)]; if (b === 0) continue;
        if (b === 9) blocks[idx(x, y, z)] = 79;
        else if (b !== 79 && b !== 78 && (b === 2 || b === 1 || b === 3 || b === 18 || b === 161 || b === 12 || b === 13 || b === 4)) blocks[idx(x, y + 1, z)] = 78;
        break; }
    }
    return { blocks, meta, biomes, spawns, tiles };
  }

  caves(cx, cz, blocks) {
    const R = 8;
    for (let ax = cx - R; ax <= cx + R; ax++) for (let az = cz - R; az <= cz + R; az++) {
      const r = mulberry(chunkSeed(this.seed, ax, az, 7));
      const ri = n => (r() * n) | 0;
      let n = ri(ri(ri(40) + 1) + 1); if (ri(15) !== 0) n = 0;
      for (let i = 0; i < n; i++) {
        const x = ax * 16 + ri(16), y = ri(ri(120) + 8), z = az * 16 + ri(16);
        let tunnels = 1;
        if (ri(4) === 0) { this.tunnel(cx, cz, blocks, r, x, y, z, 1 + r() * 6, 0, 0, -1, -1, 0.5); tunnels += ri(4); }
        for (let j = 0; j < tunnels; j++) {
          let w = r() * 2 + r(); if (ri(10) === 0) w *= r() * r() * 3 + 1;
          this.tunnel(cx, cz, blocks, mulberry((r() * 4294967296) >>> 0), x, y, z, w, r() * Math.PI * 2, (r() - 0.5) * 2 / 8, 0, 0, 1);
        }
      }
    }
  }
  tunnel(cx, cz, blocks, r, x, y, z, width, yaw, pitch, step, len, vscale) {
    const cxm = cx * 16 + 8, czm = cz * 16 + 8; let dyaw = 0, dpitch = 0;
    if (len <= 0) { len = 112 - ((r() * 28) | 0); }
    let room = false; if (step === -1) { step = len / 2; room = true; }
    const split = ((r() * len / 2) | 0) + len / 4; const steep = r() * 6 === 0;
    for (; step < len; step++) {
      const hr = 1.5 + Math.sin(step * Math.PI / len) * width, vr = hr * vscale;
      const cp = Math.cos(pitch); x += Math.cos(yaw) * cp; y += Math.sin(pitch); z += Math.sin(yaw) * cp;
      pitch *= steep ? 0.92 : 0.7; pitch += dpitch * 0.1; yaw += dyaw * 0.1; dpitch *= 0.9; dyaw *= 0.75;
      dpitch += (r() - r()) * r() * 2; dyaw += (r() - r()) * r() * 4;
      if (!room && step === split && width > 1) {
        this.tunnel(cx, cz, blocks, mulberry((r() * 4294967296) >>> 0), x, y, z, r() * 0.5 + 0.5, yaw - Math.PI / 2, pitch / 3, step, len, 1);
        this.tunnel(cx, cz, blocks, mulberry((r() * 4294967296) >>> 0), x, y, z, r() * 0.5 + 0.5, yaw + Math.PI / 2, pitch / 3, step, len, 1);
        return;
      }
      if (!room && ((r() * 4) | 0) === 0) continue;
      const ddx = x - cxm, ddz = z - czm, rem = len - step, lim = width + 18;
      if (ddx * ddx + ddz * ddz - rem * rem > lim * lim) return;
      if (x < cxm - 16 - hr * 2 || z < czm - 16 - hr * 2 || x > cxm + 16 + hr * 2 || z > czm + 16 + hr * 2) continue;
      const x0 = Math.max(0, Math.floor(x - hr) - cx * 16 - 1), x1 = Math.min(16, Math.floor(x + hr) - cx * 16 + 1);
      const y0 = Math.max(1, Math.floor(y - vr) - 1), y1 = Math.min(CH - 8, Math.floor(y + vr) + 1);
      const z0 = Math.max(0, Math.floor(z - hr) - cz * 16 - 1), z1 = Math.min(16, Math.floor(z + hr) - cz * 16 + 1);
      // avoid breaching water
      let water = false;
      for (let bx = x0; bx < x1 && !water; bx++) for (let bz = z0; bz < z1 && !water; bz++) for (let by = y1 + 1; by >= y0 - 1; by--) {
        if (by < 0 || by >= CH) continue; const b = blocks[idx(bx, by, bz)]; if (b === 9 || b === 8) { water = true; break; }
        if (by !== y0 - 1 && bx !== x0 && bx !== x1 - 1 && bz !== z0 && bz !== z1 - 1) by = y0;
      }
      if (water) continue;
      for (let bx = x0; bx < x1; bx++) { const fx = (bx + cx * 16 + 0.5 - x) / hr;
        for (let bz = z0; bz < z1; bz++) { const fz = (bz + cz * 16 + 0.5 - z) / hr; if (fx * fx + fz * fz >= 1) continue;
          let grass = false;
          for (let by = y1 - 1; by >= y0; by--) { const fy = (by + 0.5 - y) / vr;
            if (fy > -0.7 && fx * fx + fy * fy + fz * fz < 1) { const k = idx(bx, by, bz); const b = blocks[k];
              if (b === 2) grass = true;
              if (b === 1 || b === 2 || b === 3 || b === 13 || b === 24 || b === 12 && by < 50) {
                if (by < 10) blocks[k] = 11; else { blocks[k] = 0; if (grass && by > 0 && blocks[idx(bx, by - 1, bz)] === 3) blocks[idx(bx, by - 1, bz)] = 2; }
              } } }
        } }
      if (room) break;
    }
  }

  // ravines: rare, long, very tall narrow cuts (classic MapGenRavine)
  ravines(cx, cz, blocks) {
    const R = 8;
    for (let ax = cx - R; ax <= cx + R; ax++) for (let az = cz - R; az <= cz + R; az++) {
      const r = mulberry(chunkSeed(this.seed, ax, az, 11)); if (((r() * 50) | 0) !== 0) continue;
      const x = ax * 16 + r() * 16, y = 28 + ((r() * 30) | 0), z = az * 16 + r() * 16;
      const yaw = r() * Math.PI * 2, pitch = (r() - 0.5) * 2 / 8, width = (r() * 2 + r()) * 2.6 + 1;
      this.ravine(cx, cz, blocks, mulberry((r() * 4294967296) >>> 0), x, y, z, width, yaw, pitch, 112 - ((r() * 28) | 0));
    }
  }
  ravine(cx, cz, blocks, r, x, y, z, width, yaw, pitch, len) {
    const cxm = cx * 16 + 8, czm = cz * 16 + 8; let dyaw = 0, dpitch = 0;
    const mul = new Float32Array(CH); let m = 1; for (let i = 0; i < CH; i++) { if (i === 0 || ((r() * 3) | 0) === 0) m = 1 + r() * r(); mul[i] = m * m; }
    for (let step = 0; step < len; step++) {
      let hr = 1.5 + Math.sin(step * Math.PI / len) * width; let vr = hr * 3.5;
      hr *= r() * 0.25 + 0.75; vr *= r() * 0.25 + 0.75;
      const cp = Math.cos(pitch); x += Math.cos(yaw) * cp; y += Math.sin(pitch); z += Math.sin(yaw) * cp;
      pitch *= 0.7; pitch += dpitch * 0.05; yaw += dyaw * 0.05; dpitch *= 0.8; dyaw *= 0.5;
      dpitch += (r() - r()) * r() * 2; dyaw += (r() - r()) * r() * 4;
      if (((r() * 4) | 0) === 0) continue;
      const ddx = x - cxm, ddz = z - czm, rem = len - step, lim = width + 18;
      if (ddx * ddx + ddz * ddz - rem * rem > lim * lim) return;
      if (x < cxm - 16 - hr * 2 || z < czm - 16 - hr * 2 || x > cxm + 16 + hr * 2 || z > czm + 16 + hr * 2) continue;
      const x0 = Math.max(0, Math.floor(x - hr) - cx * 16 - 1), x1 = Math.min(16, Math.floor(x + hr) - cx * 16 + 1);
      const y0 = Math.max(1, Math.floor(y - vr) - 1), y1 = Math.min(CH - 8, Math.floor(y + vr) + 1);
      const z0 = Math.max(0, Math.floor(z - hr) - cz * 16 - 1), z1 = Math.min(16, Math.floor(z + hr) - cz * 16 + 1);
      let water = false;
      for (let bx = x0; bx < x1 && !water; bx++) for (let bz = z0; bz < z1 && !water; bz++) for (let by = y1 + 1; by >= y0 - 1; by--) {
        if (by < 0 || by >= CH) continue; const b = blocks[idx(bx, by, bz)]; if (b === 9 || b === 8) { water = true; break; }
        if (by !== y0 - 1 && bx !== x0 && bx !== x1 - 1 && bz !== z0 && bz !== z1 - 1) by = y0;
      }
      if (water) continue;
      for (let bx = x0; bx < x1; bx++) { const fx = (bx + cx * 16 + 0.5 - x) / hr;
        for (let bz = z0; bz < z1; bz++) { const fz = (bz + cz * 16 + 0.5 - z) / hr; if (fx * fx + fz * fz >= 1) continue; let grass = false;
          for (let by = y1 - 1; by >= y0; by--) { const fy = (by + 0.5 - y) / vr;
            if ((fx * fx + fz * fz) * mul[by] + fy * fy / 6 < 1) { const k = idx(bx, by, bz); const b = blocks[k]; if (b === 2) grass = true;
              if (b === 1 || b === 2 || b === 3 || b === 13 || b === 24 || b === 12 || (b >= 14 && b <= 16) || b === 21 || b === 56 || b === 73) {
                if (by < 10) blocks[k] = 11; else { blocks[k] = 0; if (grass && blocks[idx(bx, by - 1, bz)] === 3) blocks[idx(bx, by - 1, bz)] = 2; } } } }
        } }
    }
  }
  // dungeons: cobblestone rooms carved into caves with a mob spawner and loot chests
  dungeons(cx, cz, blocks, meta) {
    const r = mulberry(chunkSeed(this.seed, cx, cz, 13)); const ri = n => (r() * n) | 0; const tiles = {};
    const solid = b => b !== 0 && !(b >= 8 && b <= 11) && b !== 18 && b !== 31 && b !== 106 && b !== 78;
    for (let n = 0; n < 8; n++) {
      const rx = ri(2) + 2, rz = ri(2) + 2; const x = rx + 1 + ri(14 - 2 * (rx + 1) + 1), z = rz + 1 + ri(14 - 2 * (rz + 1) + 1), y = 6 + ri(48);
      let ok = true, open = 0;
      for (let i = x - rx - 1; i <= x + rx + 1 && ok; i++) for (let k = z - rz - 1; k <= z + rz + 1 && ok; k++) {
        if (!solid(blocks[idx(i, y - 1, k)]) || !solid(blocks[idx(i, y + 4, k)])) ok = false;
        const edge = i === x - rx - 1 || i === x + rx + 1 || k === z - rz - 1 || k === z + rz + 1;
        if (edge && blocks[idx(i, y, k)] === 0 && blocks[idx(i, y + 1, k)] === 0) open++;
      }
      if (!ok || open < 1 || open > 5) continue;
      for (let i = x - rx - 1; i <= x + rx + 1; i++) for (let k = z - rz - 1; k <= z + rz + 1; k++) for (let j = y + 3; j >= y - 1; j--) {
        const q = idx(i, j, k); const edge = i === x - rx - 1 || i === x + rx + 1 || k === z - rz - 1 || k === z + rz + 1;
        if (j >= y && !edge) { blocks[q] = 0; meta[q] = 0; }
        else if (j === y - 1 && solid(blocks[q])) blocks[q] = ri(4) ? 48 : 4;
        else if (solid(blocks[q])) blocks[q] = 4;
      }
      for (let i = x - rx - 1; i <= x + rx + 1; i++) for (let k = z - rz - 1; k <= z + rz + 1; k++) blocks[idx(i, y + 4, k)] = 4;
      // chests against a single wall
      for (let c = 0; c < 2; c++) for (let t = 0; t < 3; t++) {
        const i = x + ri(rx * 2 + 1) - rx, k = z + ri(rz * 2 + 1) - rz; const q = idx(i, y, k); if (blocks[q]) continue;
        const wN = blocks[idx(i, y, k - 1)] === 4 || blocks[idx(i, y, k - 1)] === 48, wS = blocks[idx(i, y, k + 1)] === 4 || blocks[idx(i, y, k + 1)] === 48;
        const wW = blocks[idx(i - 1, y, k)] === 4 || blocks[idx(i - 1, y, k)] === 48, wE = blocks[idx(i + 1, y, k)] === 4 || blocks[idx(i + 1, y, k)] === 48;
        if (wN + wS + wW + wE !== 1) continue;
        blocks[q] = 54; meta[q] = wN ? 0 : wS ? 2 : wW ? 3 : 1; tiles[q] = { items: this.dungeonLoot(r) }; break;
      }
      const sq = idx(x, y, z); blocks[sq] = 52; meta[sq] = 0; const roll = ri(4);
      tiles[sq] = { spawner: roll === 0 ? 'skeleton' : roll === 3 ? 'spider' : 'zombie', delay: 20 };
    }
    return tiles;
  }
  dungeonLoot(r) {
    const ri = n => (r() * n) | 0; const items = new Array(27).fill(null);
    for (let n = 0; n < 8; n++) {
      const k = ri(11); let s = null;
      if (k === 0) s = [329, 1]; else if (k === 1) s = [265, ri(4) + 1]; else if (k === 2) s = [297, 1]; else if (k === 3) s = [296, ri(4) + 1]; else if (k === 4) s = [289, ri(4) + 1];
      else if (k === 5) s = [287, ri(4) + 1]; else if (k === 6) s = [325, 1]; else if (k === 7 && ri(100) === 0) s = [322, 1]; else if (k === 8 && ri(2) === 0) s = [331, ri(4) + 1]; else if (k === 9) s = [352, ri(4) + 1]; else if (k === 10 && ri(10) === 0) s = [264, ri(2) + 1];
      if (s) items[ri(27)] = { id: s[0], count: s[1], dmg: 0 };
    }
    return items;
  }
  ores(r, blocks) {
    const vein = (id, size, count, maxY, minY = 0) => {
      for (let i = 0; i < count; i++) {
        const x = r() * 16, y = minY + r() * (maxY - minY), z = r() * 16;
        const a = r() * Math.PI, dx = Math.sin(a) * size / 8, dz = Math.cos(a) * size / 8;
        for (let s = 0; s <= size; s++) {
          const t = s / size, px = x - dx + 2 * dx * t, pz = z - dz + 2 * dz * t, py = y + (r() - 0.5) * 2;
          const rad = (Math.sin(t * Math.PI) + 1) * (r() * size / 16) / 2 + 0.5;
          for (let bx = Math.floor(px - rad); bx <= px + rad; bx++) for (let by = Math.floor(py - rad); by <= py + rad; by++) for (let bz = Math.floor(pz - rad); bz <= pz + rad; bz++) {
            if (bx < 0 || bz < 0 || bx > 15 || bz > 15 || by < 1 || by >= CH) continue;
            const fx = (bx + 0.5 - px) / rad, fy = (by + 0.5 - py) / rad, fz = (bz + 0.5 - pz) / rad;
            if (fx * fx + fy * fy + fz * fz < 1) { const k = idx(bx, by, bz); if (blocks[k] === 1) blocks[k] = id; }
          }
        }
      }
    };
    vein(3, 32, 20, 128); vein(13, 32, 10, 128); vein(16, 16, 20, 128); vein(15, 8, 20, 64); vein(14, 8, 2, 32); vein(73, 7, 8, 16); vein(56, 7, 1, 16);
    for (let i = 0; i < 1; i++) vein(21, 6, 1, 16 + r() * 16 + r() * 16 - 16, Math.max(0, 16 - 16 + r() * 16 - 8));
  }

  // ---------- decoration (trees may cross chunk borders) ----------
  decorate(cx, cz, blocks, meta, biomes) {
    const ox = cx * 16, oz = cz * 16;
    const set = (wx, y, wz, id, m = 0, over = false) => {
      const x = wx - ox, z = wz - oz; if (x < 0 || z < 0 || x > 15 || z > 15 || y < 1 || y >= CH) return;
      const k = idx(x, y, z); const b = blocks[k];
      if (over || b === 0 || b === 18 || b === 161 || b === 31 || b === 78 || b === 106 || b === 37 || b === 38) { blocks[k] = id; meta[k] = m; }
    };
    const get = (wx, y, wz) => { const x = wx - ox, z = wz - oz; if (x < 0 || z < 0 || x > 15 || z > 15 || y < 0 || y >= CH) return -1; return blocks[idx(x, y, z)]; };
    // trees from this and neighbouring chunks
    for (let ax = cx - 1; ax <= cx + 1; ax++) for (let az = cz - 1; az <= cz + 1; az++) {
      const r = mulberry(chunkSeed(this.seed, ax, az, 3));
      const bio = this.biomeAt(ax * 16 + 8, az * 16 + 8);
      let n = [0, 0, 0, 1, 7, 6, 2, 0, 0, 14, 0, 0, 0, 0, 8, 20, 6, 1, 0, 9][bio] ?? 0;
      if (bio === BIO.PLAINS && r() < 0.15) n = 1;
      if (bio === BIO.HILLS && r() < 0.6) n = 0;
      n += (r() * 3 | 0) - 1; if (r() < 0.1) n += 1;
      for (let i = 0; i < n; i++) {
        const wx = ax * 16 + ((r() * 16) | 0), wz = az * 16 + ((r() * 16) | 0);
        const tr = mulberry((r() * 4294967296) >>> 0);
        const lb = this.biomeAt(wx, wz);
        if (lb === BIO.OCEAN || lb === BIO.RIVER || lb === BIO.DESERT || lb === BIO.FOCEAN || lb === BIO.FRIVER || lb === BIO.BEACH || lb === BIO.DEEP || lb === BIO.MESA) continue;
        // only compute surface if the tree can touch this chunk
        if (wx < ox - 6 || wx > ox + 21 || wz < oz - 6 || wz > oz + 21) continue;
        const y = this.surfaceAt(wx, wz) + 1;
        if (y <= SEA + 1 || y > CH - 24) continue;
        const inside = get(wx, y - 1, wz); if (inside !== -1 && inside !== 2 && inside !== 3) continue;
        if (inside !== -1 && get(wx, y, wz) !== 0 && get(wx, y, wz) !== 31) continue;
        set(wx, y - 1, wz, 3, 0, true);
        if (y > CH - 30) continue;
        if (lb === BIO.TAIGA || lb === BIO.ICE) this.spruce(set, tr, wx, y, wz);
        else if (lb === BIO.MEGA_TAIGA) { if (tr() < 0.35) { for (const [dx, dz] of [[1, 0], [0, 1], [1, 1]]) set(wx + dx, y - 1, wz + dz, 3, 2, true); this.megaSpruce(set, tr, wx, y, wz); } else this.spruce(set, tr, wx, y, wz); }
        else if (lb === BIO.BIRCH) this.oak(set, get, tr, wx, y, wz, 2, 5 + ((tr() * 2) | 0), false);
        else if (lb === BIO.ROOFED) { if (tr() < 0.85) this.darkOak(set, tr, wx, y, wz); else this.oak(set, get, tr, wx, y, wz, 0, 4 + ((tr() * 3) | 0), false); }
        else if (lb === BIO.SAVANNA) { if (tr() < 0.8) this.acacia(set, tr, wx, y, wz); else this.oak(set, get, tr, wx, y, wz, 0, 4 + ((tr() * 3) | 0), false); }
        else if (lb === BIO.FLOWER && tr() < 0.3) this.oak(set, get, tr, wx, y, wz, 2, 5 + ((tr() * 2) | 0), false);
        else if (lb === BIO.JUNGLE) { const v = tr(); if (v < 0.1) this.bigJungle(set, get, tr, wx, y, wz); else if (v < 0.5) this.bush(set, tr, wx, y, wz); else this.oak(set, get, tr, wx, y, wz, 3, 4 + ((tr() * 7) | 0), true); }
        else if (lb === BIO.FOREST && tr() < 0.2) this.oak(set, get, tr, wx, y, wz, 2, 5 + ((tr() * 2) | 0), false);
        else if (lb === BIO.SWAMP) this.oak(set, get, tr, wx, y, wz, 0, 5 + ((tr() * 3) | 0), true, true);
        else if (tr() < 0.1) this.bigOak(set, tr, wx, y, wz);
        else this.oak(set, get, tr, wx, y, wz, 0, 4 + ((tr() * 3) | 0), false);
      }
    }
    // small plants (inside this chunk only)
    const r = mulberry(chunkSeed(this.seed, cx, cz, 5));
    const top = (x, z) => { for (let y = CH - 2; y > 0; y--) { const b = blocks[idx(x, y, z)]; if (b !== 0 && b !== 18 && b !== 161) return y; } return -1; };
    const plantAt = (id, m, need) => { const x = (r() * 16) | 0, z = (r() * 16) | 0; const y = top(x, z); if (y < 1) return; const b = blocks[idx(x, y, z)]; if (!need.includes(b)) return; if (blocks[idx(x, y + 1, z)] !== 0) return; blocks[idx(x, y + 1, z)] = id; meta[idx(x, y + 1, z)] = m; return [x, y + 1, z]; };
    const bio = biomes[8 | 8 << 4];
    const grassN = [0, 20, 0, 1, 2, 1, 5, 0, 0, 25, 0, 0, 0, 0, 2, 2, 2, 20, 0, 7][bio] ?? 0, flowersN = [0, 4, 0, 2, 2, 2, 1, 0, 0, 4, 0, 0, 0, 0, 2, 1, 12, 1, 0, 0][bio] ?? 0;
    const flower = () => bio === BIO.SWAMP ? [38, 1] : bio === BIO.FLOWER ? (r() < 0.15 ? [37, 0] : [38, [0, 2, 3, 4, 5, 6, 7, 8][(r() * 8) | 0]]) : bio === BIO.PLAINS && r() < 0.4 ? [38, [3, 4, 5, 6, 7, 8][(r() * 6) | 0]] : r() < 0.66 ? [37, 0] : [38, 0];
    for (let i = 0; i < grassN * 2; i++) plantAt(31, (bio === BIO.JUNGLE || bio === BIO.MEGA_TAIGA) && r() < 0.25 ? 2 : 1, [2, 3]);
    for (let i = 0; i < flowersN; i++) { const x = (r() * 16) | 0, z = (r() * 16) | 0; const [id, fm] = flower(); for (let k = 0; k < 10; k++) { const px = Math.max(0, Math.min(15, x + ((r() * 7) | 0) - 3)), pz = Math.max(0, Math.min(15, z + ((r() * 7) | 0) - 3)); const y = top(px, pz); if (y > 0 && blocks[idx(px, y, pz)] === 2 && blocks[idx(px, y + 1, pz)] === 0) { blocks[idx(px, y + 1, pz)] = id; meta[idx(px, y + 1, pz)] = fm; } } }
    if (r() < (bio === BIO.SWAMP ? 0.6 : 0.12)) for (let i = 0; i < 4; i++) plantAt(r() < 0.5 ? 39 : 40, 0, [2, 3]);
    if (bio === BIO.MESA) { for (let i = 0; i < 6; i++) plantAt(32, 0, [12, 172, 159]); for (let i = 0; i < 3; i++) { const p = plantAt(81, 0, [12]); if (p) { const h = (r() * 3) | 0; for (let k = 1; k <= h; k++) if (blocks[idx(p[0], p[1] + k, p[2])] === 0) blocks[idx(p[0], p[1] + k, p[2])] = 81; } } }
    if (bio === BIO.DESERT) {
      for (let i = 0; i < 4; i++) plantAt(32, 0, [12]);
      for (let i = 0; i < 6; i++) { const p = plantAt(81, 0, [12]); if (p) { const h = (r() * 3) | 0; for (let k = 1; k <= h; k++) if (blocks[idx(p[0], p[1] + k, p[2])] === 0) blocks[idx(p[0], p[1] + k, p[2])] = 81; } }
    }
    // remove cacti touching other blocks (classic cactus rule)
    for (let i = 0; i < blocks.length; i++) if (blocks[i] === 81) { const x = i & 15, z = (i >> 4) & 15, y = i >> 8; for (const [dx, dz] of [[1,0],[-1,0],[0,1],[0,-1]]) { const nx = x + dx, nz = z + dz; if (nx < 0 || nz < 0 || nx > 15 || nz > 15) continue; const nb = blocks[idx(nx, y, nz)]; if (nb !== 0) { blocks[i] = 0; break; } } }
    // sugar cane next to water
    for (let i = 0; i < 20; i++) { const x = (r() * 16) | 0, z = (r() * 16) | 0; const y = top(x, z); if (y !== SEA && y !== SEA + 1) continue; const b = blocks[idx(x, y, z)]; if (b !== 2 && b !== 12 && b !== 3) continue; let w = false; for (const [dx, dz] of [[1,0],[-1,0],[0,1],[0,-1]]) { const nx = x + dx, nz = z + dz; if (nx >= 0 && nz >= 0 && nx < 16 && nz < 16 && blocks[idx(nx, y, nz)] === 9) w = true; } if (!w) continue; const h = 2 + ((r() * 2) | 0); for (let k = 1; k <= h; k++) if (blocks[idx(x, y + k, z)] === 0) blocks[idx(x, y + k, z)] = 83; }
    if (r() < 1 / 32 && bio !== BIO.DESERT) for (let i = 0; i < 6; i++) plantAt(86, 0, [2]);
    if (bio === BIO.JUNGLE && r() < 0.25) for (let i = 0; i < 5; i++) plantAt(103, 0, [2]);
  }
  leafBlob(set, cx, y0, cz, y1, wood) {
    for (let y = y0; y <= y1; y++) { const d = y - y1, rad = 1 - (d >> 1) ; for (let x = cx - rad; x <= cx + rad; x++) for (let z = cz - rad; z <= cz + rad; z++) { if (Math.abs(x - cx) === rad && Math.abs(z - cz) === rad && (this._r() < 0.5 || d === 0)) continue; set(x, y, z, 18, wood); } }
  }
  oak(set, get, r, x, y, z, wood, h, vines, swamp) {
    this._r = r;
    const top = y + h - 1;
    if (swamp) { for (let ly = top - 3; ly <= top; ly++) { const rad = ly >= top - 1 ? 2 : 3; for (let lx = x - rad; lx <= x + rad; lx++) for (let lz = z - rad; lz <= z + rad; lz++) { if (Math.abs(lx - x) === rad && Math.abs(lz - z) === rad && r() < 0.5) continue; set(lx, ly, lz, 18, 0); if (Math.abs(lx - x) === rad || Math.abs(lz - z) === rad) if (r() < 0.25) this.vineDown(set, get, lx + Math.sign(lx - x), ly, lz + Math.sign(lz - z), lx - x === rad ? 2 : lx - x === -rad ? 8 : lz - z === rad ? 4 : 1); } } }
    else this.leafBlob(set, x, top - 3, z, top + 1, wood);
    for (let i = 0; i < h; i++) set(x, y + i, z, 17, wood, true);
    if (vines) for (let i = 1; i < h; i++) for (const [dx, dz, m] of [[-1, 0, 8], [1, 0, 2], [0, -1, 1], [0, 1, 4]]) if (r() < 0.6) set(x + dx, y + i, z + dz, 106, m);
  }
  vineDown(set, get, x, y, z, m) { for (let i = 0; i < 4; i++) { const g = get(x, y - i, z); if (g !== 0 && g !== -1) break; set(x, y - i, z, 106, m); } }
  bigOak(set, r, x, y, z) {
    const h = 8 + ((r() * 5) | 0);
    for (let i = 0; i < h; i++) set(x, y + i, z, 17, 0, true);
    const blobs = 2 + ((r() * 3) | 0);
    for (let b = 0; b < blobs; b++) {
      const by = y + h - 2 - ((r() * 4) | 0), a = r() * Math.PI * 2, d = 1 + r() * 3, bx = Math.round(x + Math.cos(a) * d), bz = Math.round(z + Math.sin(a) * d);
      for (let t = 0; t <= d; t++) set(Math.round(x + Math.cos(a) * t), by - 2 + Math.round(t / 2), Math.round(z + Math.sin(a) * t), 17, 0, true);
      for (let ly = -1; ly <= 2; ly++) { const rad = ly === -1 || ly === 2 ? 1.6 : 2.6; for (let lx = -3; lx <= 3; lx++) for (let lz = -3; lz <= 3; lz++) if (lx * lx + lz * lz <= rad * rad) set(bx + lx, by + ly, bz + lz, 18, 0); }
    }
  }
  spruce(set, r, x, y, z) {
    const h = 6 + ((r() * 4) | 0), bare = 1 + ((r() * 2) | 0);
    let rad = 0, maxR = 2 + ((r() * 2) | 0) - 1, step = 1;
    for (let ly = y + h; ly >= y + bare; ly--) {
      for (let lx = x - rad; lx <= x + rad; lx++) for (let lz = z - rad; lz <= z + rad; lz++) { if (rad > 0 && Math.abs(lx - x) === rad && Math.abs(lz - z) === rad) continue; set(lx, ly, lz, 18, 1); }
      if (rad >= step) { rad = 0; step = Math.min(maxR, step + 1); } else rad++;
    }
    set(x, y + h + 1, z, 18, 1);
    for (let i = 0; i < h; i++) set(x, y + i, z, 17, 1, true);
  }
  acacia(set, r, x, y, z) {
    const h = 5 + ((r() * 3) | 0), bend = h - 1 - ((r() * 3) | 0), d = [[1, 0], [-1, 0], [0, 1], [0, -1]][(r() * 4) | 0];
    let tx = x, tz = z, ty = y;
    for (let i = 0; i < h; i++) { if (i >= bend) { tx += d[0]; tz += d[1]; } set(tx, ty, tz, 162, 0, true); ty++; }
    const canopy = (cx, cy, cz) => { for (let lx = -3; lx <= 3; lx++) for (let lz = -3; lz <= 3; lz++) if (Math.abs(lx) + Math.abs(lz) <= 4 && !(Math.abs(lx) === 3 && Math.abs(lz) === 3)) set(cx + lx, cy, cz + lz, 161, 0);
      for (let lx = -1; lx <= 1; lx++) for (let lz = -1; lz <= 1; lz++) set(cx + lx, cy + 1, cz + lz, 161, 0); set(cx + 2, cy + 1, cz, 161, 0); set(cx - 2, cy + 1, cz, 161, 0); set(cx, cy + 1, cz + 2, 161, 0); set(cx, cy + 1, cz - 2, 161, 0); };
    canopy(tx, ty, tz);
    if (r() < 0.6) { const e = [-d[1], d[0]]; let bx = x, bz = z, by = y + bend - 1; const n = 2 + ((r() * 2) | 0); for (let i = 0; i < n; i++) { bx -= e[0]; bz -= e[1]; set(bx, by, bz, 162, 0, true); by++; } canopy(bx, by - 1, bz); }
  }
  darkOak(set, r, x, y, z) {
    const h = 6 + ((r() * 3) | 0);
    for (let i = 0; i < h; i++) for (const [dx, dz] of [[0, 0], [1, 0], [0, 1], [1, 1]]) set(x + dx, y + i, z + dz, 162, 1, true);
    const top = y + h;
    for (let ly = top - 2; ly <= top + 1; ly++) { const R = ly === top + 1 ? 2 : ly === top - 2 ? 3 : 4;
      for (let lx = -R; lx <= R + 1; lx++) for (let lz = -R; lz <= R + 1; lz++) { const ddx = lx - 0.5, ddz = lz - 0.5; if (ddx * ddx + ddz * ddz <= R * R + 0.5 && (ly < top + 1 || r() < 0.85)) set(x + lx, ly, z + lz, 161, 1); } }
    if (r() < 0.5) { const a = r() * Math.PI * 2; for (let t = 1; t <= 3; t++) set(Math.round(x + 0.5 + Math.cos(a) * t), top - 3 + (t >> 1), Math.round(z + 0.5 + Math.sin(a) * t), 162, 1, true); }
  }
  megaSpruce(set, r, x, y, z) {
    const h = 14 + ((r() * 10) | 0), crown = 5 + ((r() * 5) | 0);
    for (let i = 0; i < h; i++) for (const [dx, dz] of [[0, 0], [1, 0], [0, 1], [1, 1]]) set(x + dx, y + i, z + dz, 17, 1, true);
    for (let ly = y + h + 1; ly >= y + h - crown; ly--) { const k = y + h + 1 - ly; const R = Math.min(3, (k >> 1) + (k % 3 === 2 ? 1 : 0));
      for (let lx = -R; lx <= R + 1; lx++) for (let lz = -R; lz <= R + 1; lz++) { const ddx = lx - 0.5, ddz = lz - 0.5; if (ddx * ddx + ddz * ddz <= R * R + 0.6) set(x + lx, ly, z + lz, 18, 1); } }
  }
  bush(set, r, x, y, z) { set(x, y, z, 17, 3, true); for (let ly = y; ly <= y + 2; ly++) { const rad = 2 - (ly - y); for (let lx = x - rad; lx <= x + rad; lx++) for (let lz = z - rad; lz <= z + rad; lz++) if (Math.abs(lx - x) + Math.abs(lz - z) <= rad + 1 && !(lx === x && lz === z && ly === y)) set(lx, ly, lz, 18, 0); } }
  bigJungle(set, get, r, x, y, z) {
    const h = 10 + ((r() * 15) | 0);
    for (let i = 0; i < h; i++) for (const [dx, dz] of [[0,0],[1,0],[0,1],[1,1]]) set(x + dx, y + i, z + dz, 17, 3, true);
    for (let i = 2; i < h; i++) for (const [dx, dz, m] of [[-1,0,8],[2,0,2],[-1,1,8],[2,1,2],[0,-1,1],[1,-1,1],[0,2,4],[1,2,4]]) if (r() < 0.6) set(x + dx, y + i, z + dz, 106, m);
    const canopy = (cx, cy, cz, R) => { for (let ly = cy - 1; ly <= cy + 1; ly++) { const rr = ly === cy + 1 ? R - 1 : R; for (let lx = -rr; lx <= rr + 1; lx++) for (let lz = -rr; lz <= rr + 1; lz++) if ((lx - 0.5) ** 2 + (lz - 0.5) ** 2 <= rr * rr + 1) set(cx + lx, ly, cz + lz, 18, 3); } };
    canopy(x, y + h, z, 4);
    for (let b = y + h - 3; b > y + h / 2; b -= 2 + ((r() * 4) | 0)) {
      const a = r() * Math.PI * 2, bx = Math.round(x + 0.5 + Math.cos(a) * 4), bz = Math.round(z + 0.5 + Math.sin(a) * 4);
      for (let t = 0; t <= 4; t++) set(Math.round(x + 0.5 + Math.cos(a) * t), b + (t >> 1), Math.round(z + 0.5 + Math.sin(a) * t), 17, 3, true);
      for (let lx = -2; lx <= 2; lx++) for (let lz = -2; lz <= 2; lz++) if (lx * lx + lz * lz <= 5) { set(bx + lx, b + 2, bz + lz, 18, 3); if (lx * lx + lz * lz <= 2) set(bx + lx, b + 3, bz + lz, 18, 3); }
    }
  }
}
