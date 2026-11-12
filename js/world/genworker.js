import { Generator } from './gen.js';
import { NetherGenerator } from './nether.js';
let gen = null;
self.onmessage = e => {
  const m = e.data;
  if (m.type === 'seed') { gen = m.dim === -1 ? new NetherGenerator(m.seed) : new Generator(m.seed, { wtype: m.wtype, structures: m.structures }); return; }
  if (m.type === 'gen') {
    const r = gen.generate(m.cx, m.cz);
    self.postMessage({ type: 'chunk', cx: m.cx, cz: m.cz, blocks: r.blocks, meta: r.meta, biomes: r.biomes, spawns: r.spawns, tiles: r.tiles }, [r.blocks.buffer, r.meta.buffer, r.biomes.buffer]);
  }
};
