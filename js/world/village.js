// NPC villages: deterministic layout per 384-block cell, rasterised into each chunk it touches
import { mulberry, chunkSeed } from './noise.js';
import { BIO } from './gen.js';

const CELL = 384, CH = 128, SEA = 63;
const idx = (x, y, z) => x | (z << 4) | (y << 8);
const TERRAIN = new Set([1, 2, 3, 4, 7, 12, 13, 14, 15, 16, 21, 24, 56, 73, 82]);
const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]]; // E S W N
const doorMeta = (nx, nz) => nx < 0 ? 0 : nz < 0 ? 1 : nx > 0 ? 2 : 3; // closed panel on the road side
const faceMeta = (nx, nz) => nz > 0 ? 0 : nx < 0 ? 1 : nz < 0 ? 2 : 3; // furnace/chest front
const torchMeta = (nx, nz) => nx > 0 ? 1 : nx < 0 ? 2 : nz > 0 ? 3 : 4; // torch on a wall, pointing along n

// building footprints: w along the road, d away from it
const KINDS = {
  house: { w: 5, d: 5, n: 1 }, bighouse: { w: 7, d: 6, n: 2 }, farm: { w: 7, d: 9, n: 1 }, smith: { w: 8, d: 6, n: 1 },
  library: { w: 9, d: 6, n: 1 }, church: { w: 5, d: 5, n: 1 }, hut: { w: 4, d: 4, n: 1 }, lamp: { w: 1, d: 1, n: 0 },
};
const PROF = { house: ['villager', 'farmer', 'butcher'], bighouse: ['villager', 'butcher', 'farmer'], hut: ['villager'], farm: ['farmer'], smith: ['smith'], library: ['librarian'], church: ['priest'] };

export function villageInCell(gen, gx, gz) {
  const key = gx + ',' + gz; const cache = gen.villages || (gen.villages = new Map());
  if (cache.has(key)) return cache.get(key);
  const r = mulberry(chunkSeed(gen.seed, gx, gz, 11)); let v = null;
  if (r() < 0.65) {
    const cx = gx * CELL + 64 + ((r() * (CELL - 128)) | 0), cz = gz * CELL + 64 + ((r() * (CELL - 128)) | 0);
    const bio = gen.biomeAt(cx, cz), gy = gen.surfaceAt(cx, cz);
    if ((bio === BIO.PLAINS || bio === BIO.DESERT) && gy > SEA && gy < 100) v = layout(gen, r, cx, cz, bio === BIO.DESERT);
  }
  cache.set(key, v); return v;
}

function layout(gen, r, cx, cz, desert) {
  const roads = [], builds = [], rects = [[cx - 3, cz - 3, cx + 3, cz + 3]];
  const free = (a) => rects.every(b => a[2] < b[0] || a[0] > b[2] || a[3] < b[1] || a[1] > b[3]);
  for (let di = 0; di < 4; di++) {
    const [ax, az] = DIRS[di]; let L = 14 + ((r() * 16) | 0);
    for (let t = 3; t <= L; t += 2) if (gen.surfaceAt(cx + ax * t, cz + az * t) <= SEA) { L = t - 2; break; }
    if (L < 6) continue;
    // road strip (3 wide)
    for (let t = 3; t <= L; t++) for (let s = -1; s <= 1; s++) roads.push([cx + ax * t - az * s, cz + az * t + ax * s]);
    { const xa = [cx + ax * 3 - az, cx + ax * L + az], za = [cz + az * 3 - ax, cz + az * L + ax]; rects.push([Math.min(...xa), Math.min(...za), Math.max(...xa), Math.max(...za)]); }
    for (const side of [1, -1]) {
      let t = 5 + ((r() * 3) | 0);
      while (t < L) {
        const roll = r(); const kind = roll < 0.12 ? 'lamp' : roll < 0.38 ? 'house' : roll < 0.52 ? 'bighouse' : roll < 0.66 ? 'farm' : roll < 0.76 ? 'hut' : roll < 0.84 ? 'smith' : roll < 0.92 ? 'library' : 'church';
        const K = KINDS[kind]; if (t + K.w > L + 1) { t++; continue; }
        // side normal (pointing from building to road), along-road axis a, inward axis b
        const nx = az * side, nz = -ax * side; const bx = -nx, bz = -nz;
        const gap = kind === 'lamp' ? 2 : 3;
        const ox = cx + ax * t + bx * gap, oz = cz + az * t + bz * gap; // front-left corner
        const xs = [ox, ox + ax * (K.w - 1) + bx * (K.d - 1)], zs = [oz, oz + az * (K.w - 1) + bz * (K.d - 1)];
        const rect = [Math.min(...xs) - 1, Math.min(...zs) - 1, Math.max(...xs) + 1, Math.max(...zs) + 1];
        if (free(rect)) {
          const mx = (xs[0] + xs[1]) >> 1, mz = (zs[0] + zs[1]) >> 1; const fy = gen.surfaceAt(mx, mz);
          if (fy > SEA && Math.abs(fy - gen.surfaceAt(cx, cz)) < 9) { rects.push(rect); builds.push({ kind, ox, oz, ax, az, bx, bz, nx, nz, w: K.w, d: K.d, y: fy, seed: (r() * 4294967296) >>> 0, rect }); }
        }
        t += K.w + 1 + ((r() * 2) | 0);
      }
    }
  }
  const bb = [Infinity, Infinity, -Infinity, -Infinity];
  for (const q of rects) { bb[0] = Math.min(bb[0], q[0] - 2); bb[1] = Math.min(bb[1], q[1] - 2); bb[2] = Math.max(bb[2], q[2] + 2); bb[3] = Math.max(bb[3], q[3] + 2); }
  const houses = builds.filter(b => KINDS[b.kind].n > 0).length;
  if (houses < 3) return null;
  return { cx, cz, y: gen.surfaceAt(cx, cz), desert, roads, builds, bb, golem: houses >= 5 };
}

export function villagesNear(gen, cx, cz) {
  const out = []; const x0 = cx * 16, z0 = cz * 16;
  const g0x = Math.floor((x0 - 64) / CELL), g1x = Math.floor((x0 + 80) / CELL), g0z = Math.floor((z0 - 64) / CELL), g1z = Math.floor((z0 + 80) / CELL);
  for (let gx = g0x; gx <= g1x; gx++) for (let gz = g0z; gz <= g1z; gz++) { const v = villageInCell(gen, gx, gz); if (v && v.bb[0] <= x0 + 15 && v.bb[2] >= x0 && v.bb[1] <= z0 + 15 && v.bb[3] >= z0) out.push(v); }
  return out;
}

// carve one chunk's share of every nearby village; returns mob spawns that fall inside the chunk
export function buildVillages(gen, cx, cz, blocks, meta) {
  const vs = villagesNear(gen, cx, cz); const spawns = []; if (!vs.length) return spawns;
  const ox = cx * 16, oz = cz * 16;
  const inside = (wx, wz) => wx >= ox && wz >= oz && wx < ox + 16 && wz < oz + 16;
  const set = (wx, y, wz, id, m = 0) => { if (!inside(wx, wz) || y < 1 || y >= CH) return; const k = idx(wx - ox, y, wz - oz); blocks[k] = id; meta[k] = m; };
  const get = (wx, y, wz) => inside(wx, wz) && y >= 0 && y < CH ? blocks[idx(wx - ox, y, wz - oz)] : -1;
  const groundTop = (wx, wz) => { for (let y = CH - 2; y > 1; y--) if (TERRAIN.has(get(wx, y, wz))) return y; return -1; };
  const spawnAt = (type, x, y, z, prof) => { if (inside(Math.floor(x), Math.floor(z))) spawns.push({ t: type, x, y, z, prof }); };
  for (const v of vs) {
    const M = v.desert ? { C: 24, P: 24, L: 24, R: 24, G: 24 } : { C: 4, P: 5, L: 17, R: 5, G: 13 };
    // roads
    for (const [x, z] of v.roads) { if (!inside(x, z)) continue; const y = groundTop(x, z); if (y < 0) continue;
      const above = get(x, y + 1, z); if (above === 9 || above === 8) { for (let yy = y + 1; yy <= SEA; yy++) set(x, yy, z, M.P); continue; }
      set(x, y, z, M.G); if (v.desert) set(x, y - 1, z, 24); else set(x, y - 1, z, 3);
      for (let yy = y + 1; yy < y + 4; yy++) { const b = get(x, yy, z); if (b && b !== 17) set(x, yy, z, 0); } }
    well(v, set, get, M);
    for (const b of v.builds) {
      if (b.rect[2] + 2 < ox || b.rect[0] - 2 > ox + 15 || b.rect[3] + 2 < oz || b.rect[1] - 2 > oz + 15) continue;
      const r = mulberry(b.seed);
      // local -> world: u along road, v into the lot, y above floor
      const W = (u, w) => [b.ox + b.ax * u + b.bx * w, b.oz + b.az * u + b.bz * w];
      const put = (u, w, y, id, m = 0) => { const [x, z] = W(u, w); set(x, b.y + y, z, id, m); };
      // foundation + clearing (one block margin of air)
      for (let u = -1; u <= b.w; u++) for (let w = -1; w <= b.d; w++) { const [x, z] = W(u, w); if (!inside(x, z)) continue;
        const edge = u < 0 || w < 0 || u >= b.w || w >= b.d;
        for (let y = b.y + 1; y < b.y + 12; y++) { const g = get(x, y, z); if (g !== 0) set(x, y, z, 0); }
        if (edge) { const t = groundTop(x, z); if (t >= 0 && t < b.y) for (let y = t + 1; y <= b.y; y++) set(x, y, z, v.desert ? 12 : 3); if (!v.desert && get(x, b.y, z) === 3) set(x, b.y, z, 2); continue; }
        for (let y = b.y - 1; y > b.y - 10 && y > 1; y--) { const g = get(x, y, z); if (TERRAIN.has(g)) break; set(x, y, z, M.C); }
      }
      const sp = BUILD[b.kind](b, put, r, M, v);
      for (const s of sp || []) { const [x, z] = W(s[0], s[1]); spawnAt('villager', x + 0.5, b.y + 1, z + 0.5, s[2]); }
    }
    // villagers that live in the plaza + the village golem
    if (v.golem && inside(v.cx + 4, v.cz)) { const gy = groundTop(v.cx + 4, v.cz); spawnAt('iron_golem', v.cx + 4.5, (gy > 0 ? gy : v.y) + 1, v.cz + 0.5); }
  }
  return spawns;
}

function well(v, set, get, M) {
  const { cx, cz, y } = v;
  for (let dx = -3; dx <= 2; dx++) for (let dz = -3; dz <= 2; dz++) { const x = cx + dx, z = cz + dz;
    for (let yy = y - 4; yy <= y + 6; yy++) set(x, yy, z, yy < y ? M.C : 0);
    set(x, y, z, M.G); const inner = dx >= -2 && dx <= 1 && dz >= -2 && dz <= 1, core = dx >= -1 && dx <= 0 && dz >= -1 && dz <= 0;
    if (inner) { set(x, y + 1, z, core ? 9 : M.C); if (core) for (let yy = y - 3; yy <= y; yy++) set(x, yy, z, 9);
      const corner = (dx === -2 || dx === 1) && (dz === -2 || dz === 1); if (corner) { set(x, y + 2, z, M.C); set(x, y + 3, z, M.C); } set(x, y + 4, z, M.C); } }
}

// each returns [u, v, profession] spawn points
const walls = (b, put, M, h, opts = {}) => {
  for (let u = 0; u < b.w; u++) for (let w = 0; w < b.d; w++) {
    put(u, w, 0, opts.floor || M.C);
    const edge = u === 0 || w === 0 || u === b.w - 1 || w === b.d - 1; if (!edge) continue;
    const corner = (u === 0 || u === b.w - 1) && (w === 0 || w === b.d - 1);
    for (let y = 1; y <= h; y++) put(u, w, y, corner ? M.L : y === 1 && opts.cobbleBase ? M.C : M.P);
  }
};
const windows = (b, put, y) => { for (let u = 2; u < b.w - 2; u += 2) put(u, b.d - 1, y, 20); for (let w = 2; w < b.d - 1; w += 2) { put(0, w, y, 20); put(b.w - 1, w, y, 20); } };
const door = (b, put, u) => { const m = doorMeta(b.nx, b.nz); put(u, 0, 1, 64, m); put(u, 0, 2, 64, m | 8); put(u, -1, 0, b.desert ? 24 : 4); };
const flatRoof = (b, put, M, y) => { for (let u = 0; u < b.w; u++) for (let w = 0; w < b.d; w++) put(u, w, y, M.R); };
const gable = (b, put, M, y0) => { // ridge runs along u
  for (let w = -1; w <= b.d; w++) { const lv = Math.min(w + 1, b.d - w); for (let u = -1; u <= b.w; u++) put(u, w, y0 + lv, w === -1 || w === b.d ? 44 : M.R);
    for (let y = y0 + 1; y < y0 + lv; y++) { put(0, w, y, M.P); put(b.w - 1, w, y, M.P); } }
};
const torchIn = (b, put, u, w, y) => put(u, w, y, 50, torchMeta(b.bx, b.bz));
const BUILD = {
  house(b, put, r, M) { walls(b, put, M, 3, { cobbleBase: true }); windows(b, put, 2); door(b, put, 2); flatRoof(b, put, M, 4); put(2, -1, 3, 50, torchMeta(b.nx, b.nz)); torchIn(b, put, 2, 1, 3); if (r() < 0.5) put(1, 3, 1, 58); return [[2, 2, PROF.house[(r() * 3) | 0]]]; },
  hut(b, put, r, M) { walls(b, put, M, 3, { floor: 3 }); door(b, put, 1); put(0, 2, 2, 20); put(3, 2, 2, 20); for (let u = -1; u <= 4; u++) for (let w = -1; w <= 4; w++) put(u, w, 4, M.L, 0); for (let u = 0; u < 4; u++) for (let w = 0; w < 4; w++) put(u, w, 5, M.L); return [[1, 2, 'villager']]; },
  bighouse(b, put, r, M) { walls(b, put, M, 3, { cobbleBase: true }); windows(b, put, 2); door(b, put, 3); gable(b, put, M, 3); put(3, -1, 3, 50, torchMeta(b.nx, b.nz)); torchIn(b, put, 1, 1, 3); torchIn(b, put, 5, 1, 3); put(1, 4, 1, 54, faceMeta(b.nx, b.nz)); put(5, 4, 1, 58); return [[2, 2, PROF.bighouse[(r() * 3) | 0]], [4, 3, 'villager']]; },
  farm(b, put, r, M) {
    for (let u = 0; u < b.w; u++) for (let w = 0; w < b.d; w++) { const edge = u === 0 || w === 0 || u === b.w - 1 || w === b.d - 1;
      if (edge) { put(u, w, 0, M.L); continue; } if (u === 3) { put(u, w, 0, 9); continue; }
      put(u, w, 0, 60, 7); put(u, w, 1, 59, 2 + ((r() * 6) | 0)); }
    return [[-1, 4, 'farmer']];
  },
  smith(b, put, r, M) {
    const W = b.w - 1, D = b.d - 1;
    for (let u = 0; u <= W; u++) for (let w = 0; w <= D; w++) { put(u, w, 0, M.C); put(u, w, 4, 43);
      const post = (u === 0 || u === 4 || u === W) && (w === 0 || w === D);
      if (post) { for (let y = 1; y <= 3; y++) put(u, w, y, M.L); continue; }
      if (u >= 4 && (u === 4 || u === W || w === 0 || w === D)) for (let y = 1; y <= 3; y++) put(u, w, y, M.C); // shop room
      else if (u < 4 && (u === 0 || w === D)) put(u, w, 1, M.C); } // open forge with a low wall
    for (const w of [2, 3]) { put(4, w, 1, 0); put(4, w, 2, 0); put(W, w, 2, 20); }
    door(b, put, 6);
    put(1, D - 1, 1, 61, faceMeta(b.nx, b.nz)); put(2, D - 1, 1, 61, faceMeta(b.nx, b.nz)); put(1, 1, 1, 42);
    put(5, D - 1, 1, 54, faceMeta(b.nx, b.nz)); put(W - 1, D - 1, 1, 58); torchIn(b, put, 5, 1, 3);
    return [[2, 2, 'smith']];
  },
  church(b, put, r, M) {
    const W = b.w - 1, D = b.d - 1, lm = b.bz > 0 ? 2 : b.bz < 0 ? 3 : b.bx > 0 ? 4 : 5;
    for (let u = 0; u <= W; u++) for (let w = 0; w <= D; w++) { put(u, w, 0, M.C); put(u, w, 11, M.C);
      const edge = u === 0 || w === 0 || u === W || w === D; for (let y = 1; y <= 10; y++) put(u, w, y, edge ? M.C : y === 5 ? M.C : 0); }
    door(b, put, 2); for (let y = 1; y <= 10; y++) put(2, D - 1, y, 65, lm);
    for (const y of [2, 7, 8]) { put(0, 2, y, 20); put(W, 2, y, 20); } put(2, 0, 7, 20); put(2, 0, 8, 20); put(2, D, 8, 20);
    torchIn(b, put, 1, 1, 3); torchIn(b, put, 3, 1, 3); put(1, 2, 6, 50, 5); put(3, 2, 6, 50, 5);
    return [[2, 2, 'priest']];
  },
  library(b, put, r, M) { walls(b, put, M, 3, { cobbleBase: true }); windows(b, put, 2); door(b, put, 4); gable(b, put, M, 3);
    for (let u = 1; u < b.w - 1; u++) if (u !== 4) put(u, b.d - 2, 1, 47); put(1, 1, 1, 58); put(4, -1, 3, 50, torchMeta(b.nx, b.nz)); torchIn(b, put, 2, 1, 3); torchIn(b, put, 6, 1, 3);
    return [[3, 2, 'librarian']]; },
  lamp(b, put, r, M) { for (let y = 1; y <= 3; y++) put(0, 0, y, M.L); put(0, 0, 4, 35, 15); put(1, 0, 4, 50, torchMeta(b.ax, b.az)); put(-1, 0, 4, 50, torchMeta(-b.ax, -b.az)); put(0, 1, 4, 50, torchMeta(b.bx, b.bz)); put(0, -1, 4, 50, torchMeta(-b.bx, -b.bz)); return []; },
};
