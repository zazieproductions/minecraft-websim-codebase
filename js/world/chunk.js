// Chunk storage: 16x16x128 column split into 8 render sections of 16 blocks
export const CH = 128, SECTIONS = 8;
export const idx = (x, y, z) => x | (z << 4) | (y << 8);
export const ckey = (cx, cz) => (cx + 32768) * 65536 + (cz + 32768);
export class Chunk {
  constructor(cx, cz, blocks, meta, biomes) {
    this.cx = cx; this.cz = cz; this.blocks = blocks; this.meta = meta; this.biomes = biomes;
    this.sky = new Uint8Array(16 * 16 * CH); this.blk = new Uint8Array(16 * 16 * CH);
    this.dirty = new Uint8Array(SECTIONS).fill(1); this.meshes = new Array(SECTIONS).fill(null);
    this.lit = false; this.modified = false; this.entities = []; this.tiles = new Map();
  }
}
