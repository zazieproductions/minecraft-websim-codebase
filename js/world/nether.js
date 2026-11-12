// Nether generator: netherrack caverns over a lava sea, bedrock floor and ceiling, glowstone, soul sand and gravel
import { Octaves, mulberry, chunkSeed } from './noise.js';
const CH = 128, LAVA_Y = 31;
const idx = (x, y, z) => x | (z << 4) | (y << 8);
const l = (p, q, t) => p + (q - p) * t;

export class NetherGenerator {
  constructor(seed) {
    this.seed = (seed ^ 0x5eed4e7) >>> 0; const r = mulberry(this.seed);
    this.dens = new Octaves(r, 4); this.shape = new Octaves(r, 3); this.patch = new Octaves(r, 3);
  }
  // coarse density lattice (4x8x4 cells, trilinear) - positive = netherrack
  lattice(cx, cz) {
    const L = new Float32Array(5 * 17 * 5);
    for (let gx = 0; gx <= 4; gx++) for (let gz = 0; gz <= 4; gz++) {
      const x = cx * 16 + gx * 4, z = cz * 16 + gz * 4;
      const roof = 0.5 + 0.5 * this.shape.n2(x / 90 + 50, z / 90), floor = 0.5 + 0.5 * this.shape.n2(x / 70, z / 70 + 50);
      for (let gy = 0; gy <= 16; gy++) { const y = gy * 8;
        let b = -0.12;
        if (y < 40) b += Math.pow((40 - y) / 40, 1.5) * (0.5 + floor * 1.2);
        if (y > 92) b += Math.pow((y - 92) / 36, 1.4) * (0.8 + roof * 1.6);
        L[gx + gz * 5 + gy * 25] = this.dens.n3(x / 26, y / 15, z / 26) * 1.5 + this.dens.n3(x / 9 + 30, y / 7, z / 9) * 0.25 + b;
      }
    }
    return L;
  }
  generate(cx, cz) {
    const blocks = new Uint8Array(16 * 16 * CH), meta = new Uint8Array(16 * 16 * CH), biomes = new Uint8Array(256).fill(1);
    const L = this.lattice(cx, cz); const r = mulberry(chunkSeed(this.seed, cx, cz, 3)); const ox = cx * 16, oz = cz * 16;
    for (let x = 0; x < 16; x++) for (let z = 0; z < 16; z++) {
      const gx = x >> 2, gz = z >> 2, fx = (x & 3) / 4, fz = (z & 3) / 4;
      const soul = this.patch.n2((ox + x) / 24, (oz + z) / 24) > 0.18, grav = this.patch.n2((ox + x) / 20 + 99, (oz + z) / 20) > 0.25;
      for (let y = 0; y < CH; y++) {
        const gy = y >> 3, fy = (y & 7) / 8; const a = gx + gz * 5 + gy * 25;
        const c0 = l(l(L[a], L[a + 1], fx), l(L[a + 5], L[a + 6], fx), fz), c1 = l(l(L[a + 25], L[a + 26], fx), l(L[a + 30], L[a + 31], fx), fz);
        const d = l(c0, c1, fy); const i = idx(x, y, z);
        if (y === 0 || y === CH - 1 || (y < 5 && r() * 5 > y) || (y > CH - 6 && r() * 5 > CH - 1 - y)) blocks[i] = 7;
        else if (d > 0) blocks[i] = 87;
        else if (y <= LAVA_Y) blocks[i] = 11;
      }
      // surface layers near the lava sea: soul sand / gravel shores
      if (soul || grav) for (let y = LAVA_Y + 6; y > LAVA_Y - 6; y--) { const i = idx(x, y, z); if (blocks[i] === 87 && !blocks[i + 256]) { for (let k = 0; k < 3 && y - k > 4; k++) if (blocks[i - k * 256] === 87) blocks[i - k * 256] = soul ? 88 : 13; } }
    }
    this.decorate(r, blocks, meta);
    return { blocks, meta, biomes, spawns: null };
  }
  decorate(r, blocks, meta) {
    const get = (x, y, z) => blocks[idx(x, y, z)];
    const ri = n => (r() * n) | 0;
    // glowstone clusters hanging from the ceiling
    for (let n = ri(ri(10) + 1) + 1; n > 0; n--) {
      const x = 3 + ri(10), z = 3 + ri(10); let y = 120; while (y > 40 && !(get(x, y, z) === 87 && get(x, y - 1, z) === 0)) y--; if (y <= 40) continue;
      blocks[idx(x, y - 1, z)] = 89;
      for (let k = 0; k < 900; k++) { const px = x + ri(6) - ri(6), py = y - 1 - ri(10), pz = z + ri(6) - ri(6); if (px < 0 || pz < 0 || px > 15 || pz > 15 || py < 2 || get(px, py, pz)) continue;
        let c = 0; for (const [dx, dy, dz] of [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]]) { const qx = px + dx, qz = pz + dz; if (qx >= 0 && qz >= 0 && qx < 16 && qz < 16 && get(qx, py + dy, qz) === 89) c++; }
        if (c === 1) blocks[idx(px, py, pz)] = 89; }
    }
    // lava springs in walls, fire patches and mushrooms on netherrack
    for (let n = 0; n < 8; n++) { const x = 1 + ri(14), y = 10 + ri(108), z = 1 + ri(14); if (get(x, y, z) !== 87) continue; let air = 0, rock = 0;
      for (const [dx, dy, dz] of [[1,0,0],[-1,0,0],[0,0,1],[0,0,-1],[0,1,0]]) { const b = get(x + dx, y + dy, z + dz); if (b === 0) air++; else if (b === 87) rock++; } if (air === 1 && rock === 4) blocks[idx(x, y, z)] = 10; }
    for (let n = ri(ri(10) + 1) + 1; n > 0; n--) { const x = ri(16), z = ri(16), y = 4 + ri(120); if (get(x, y, z) === 0 && get(x, y - 1, z) === 87) blocks[idx(x, y, z)] = 51; }
    // nether wart patches on soul sand (stand-in for fortress wart gardens)
    if (ri(4) === 0) for (let n = 0; n < 24; n++) { const x = ri(16), z = ri(16); for (let y = 100; y > 4; y--) if (get(x, y, z) === 0 && get(x, y - 1, z) === 88) { blocks[idx(x, y, z)] = 115; meta[idx(x, y, z)] = 3; break; } }
    for (const id of [39, 40]) if (ri(2) === 0) { const x = ri(16), z = ri(16), y = ri(128); if (y > 1 && y < 127 && get(x, y, z) === 0 && get(x, y - 1, z) === 87) blocks[idx(x, y, z)] = id; }
  }
}
