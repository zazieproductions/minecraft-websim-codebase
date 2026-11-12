// Seeded Perlin noise (2D/3D) with octave helpers
export class Perlin {
  constructor(rand) {
    const p = new Uint8Array(256); for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) { const j = (rand() * (i + 1)) | 0; const t = p[i]; p[i] = p[j]; p[j] = t; }
    this.p = new Uint8Array(512); for (let i = 0; i < 512; i++) this.p[i] = p[i & 255];
    this.ox = rand() * 256; this.oy = rand() * 256; this.oz = rand() * 256;
  }
  n3(x, y, z) {
    x += this.ox; y += this.oy; z += this.oz;
    const X = Math.floor(x), Y = Math.floor(y), Z = Math.floor(z);
    x -= X; y -= Y; z -= Z; const xi = X & 255, yi = Y & 255, zi = Z & 255;
    const u = x * x * x * (x * (x * 6 - 15) + 10), v = y * y * y * (y * (y * 6 - 15) + 10), w = z * z * z * (z * (z * 6 - 15) + 10);
    const p = this.p;
    const A = p[xi] + yi, AA = p[A] + zi, AB = p[A + 1] + zi, B_ = p[xi + 1] + yi, BA = p[B_] + zi, BB = p[B_ + 1] + zi;
    const g = (h, x, y, z) => { h &= 15; const u = h < 8 ? x : y, v = h < 4 ? y : (h === 12 || h === 14) ? x : z; return ((h & 1) ? -u : u) + ((h & 2) ? -v : v); };
    const l = (t, a, b) => a + t * (b - a);
    return l(w, l(v, l(u, g(p[AA], x, y, z), g(p[BA], x - 1, y, z)), l(u, g(p[AB], x, y - 1, z), g(p[BB], x - 1, y - 1, z))),
      l(v, l(u, g(p[AA + 1], x, y, z - 1), g(p[BA + 1], x - 1, y, z - 1)), l(u, g(p[AB + 1], x, y - 1, z - 1), g(p[BB + 1], x - 1, y - 1, z - 1))));
  }
  n2(x, y) { return this.n3(x, y, 0.5); }
}
export class Octaves {
  constructor(rand, n) { this.o = []; for (let i = 0; i < n; i++) this.o.push(new Perlin(rand)); }
  n2(x, y) { let s = 0, f = 1, a = 1, t = 0; for (const o of this.o) { s += o.n2(x * f, y * f) * a; t += a; f *= 2; a *= 0.5; } return s / t; }
  n3(x, y, z) { let s = 0, f = 1, a = 1, t = 0; for (const o of this.o) { s += o.n3(x * f, y * f, z * f) * a; t += a; f *= 2; a *= 0.5; } return s / t; }
}
export function mulberry(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function seedHash(str) { if (/^-?\d+$/.test(String(str))) return Number(BigInt.asUintN(32, BigInt(str))); let h = 0; for (const c of String(str)) h = (Math.imul(31, h) + c.charCodeAt(0)) | 0; return h >>> 0; }
export function chunkSeed(seed, cx, cz, salt = 0) { let h = seed ^ Math.imul(cx, 341873128) ^ Math.imul(cz, 132897987) ^ Math.imul(salt, 2654435761); h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return (h ^ (h >>> 16)) >>> 0; }
