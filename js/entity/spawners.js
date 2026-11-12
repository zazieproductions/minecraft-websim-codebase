// Monster spawners (dungeons): spawn their mob near the player, with a tiny spinning mob inside the cage
import { buildModel } from './models.js';
import { boxIntersectsBlocks } from '../engine/physics.js';
import { SOLID, isFluid } from '../world/blocks.js';
import { TYPES } from './mobs.js';
const R = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

export class Spawners {
  constructor(mgr) { this.mgr = mgr; this.list = new Map(); }
  get g() { return this.mgr.g; }
  chunkLoaded(c) { for (const [k, t] of c.tiles) if (t && t.spawner) { const x = c.cx * 16 + (k & 15), z = c.cz * 16 + ((k >> 4) & 15), y = k >> 8; this.list.set(x + ',' + y + ',' + z, { x, y, z, t, c, rot: Math.random() * 6 }); } }
  unloadChunk(c) { for (const [k, s] of this.list) if (s.c === c) { this.drop(s); this.list.delete(k); } }
  disposeAll() { for (const s of this.list.values()) this.drop(s); this.list.clear(); }
  drop(s) { if (!s.model) return; this.g.renderer.scene.remove(s.model.root); s.model.mat.dispose(); s.model.woolMat.dispose(); s.model.glassMat && s.model.glassMat.dispose(); s.model = null; }
  tick() {
    const g = this.g, p = g.player, w = this.mgr.world; const daySub = g.renderer.uniforms.daySub.value;
    for (const [k, s] of this.list) {
      if (w.getBlock(s.x, s.y, s.z) !== 52) { this.drop(s); this.list.delete(k); continue; }
      const near = Math.hypot(s.x + 0.5 - p.x, s.y + 0.5 - p.y, s.z + 0.5 - p.z) < 16; s.active = near; if (!near) continue;
      s.prot = s.rot; s.rot += 0.1 + 1.2 / Math.max(1, s.t.delay ?? 20);
      if (Math.random() < 0.5) g.particles.fx('smoke', s.x + Math.random(), s.y + Math.random(), s.z + Math.random());
      if (Math.random() < 0.3) g.particles.fx('flame', s.x + Math.random(), s.y + Math.random(), s.z + Math.random());
      if (s.t.delay === undefined) s.t.delay = 20;
      if (--s.t.delay > 0) continue;
      s.t.delay = R(200, 800); s.c.modified = true;
      if (g.settings.difficulty === 0 || !TYPES[s.t.spawner]) continue;
      const type = s.t.spawner, T = TYPES[type]; const hw = T.w / 2;
      if (this.mgr.mobs.filter(m => m.type === type && Math.abs(m.x - s.x) < 8 && Math.abs(m.y - s.y) < 4 && Math.abs(m.z - s.z) < 8).length >= 6) continue;
      for (let i = 0; i < 4; i++) {
        const x = s.x + 0.5 + (Math.random() - Math.random()) * 4, y = s.y + R(-1, 1), z = s.z + 0.5 + (Math.random() - Math.random()) * 4;
        const bx = Math.floor(x), bz = Math.floor(z);
        if (!SOLID[w.getBlock(bx, y - 1, bz)] || isFluid(w.getBlock(bx, y, bz)) || boxIntersectsBlocks(w, x - hw, y, z - hw, x + hw, y + T.h, z + hw)) continue;
        if (Math.max(w.getSky(bx, y, bz) - daySub, w.getBlockLight(bx, y, bz)) > 7) continue;
        const m = this.mgr.spawn(type, x, y, z); m.yaw = m.pyaw = m.headYaw = Math.random() * Math.PI * 2;
        for (let j = 0; j < 12; j++) g.particles.fx('smoke', x + (Math.random() - 0.5), y + Math.random() * T.h, z + (Math.random() - 0.5));
      }
    }
  }
  render(pt) {
    const r = this.g.renderer, w = this.mgr.world;
    for (const s of this.list.values()) {
      if (!s.active) { this.drop(s); continue; }
      if (!s.model) { s.model = buildModel(s.t.spawner); r.scene.add(s.model.root); }
      const T = TYPES[s.t.spawner] || { w: 0.6, h: 1.8 }; const sc = 0.4375 / Math.max(1, Math.max(T.w, T.h) / 1.8) * (T.w > 1 ? 0.7 : 1);
      const root = s.model.root; root.scale.setScalar(sc); root.position.set(s.x + 0.5, s.y + 0.1, s.z + 0.5);
      root.rotation.set(0, (s.prot ?? s.rot) + (s.rot - (s.prot ?? s.rot)) * pt, 0);
      const l = Math.max(0.35, w.getBlockLight(s.x, s.y, s.z) / 15); s.model.mat.color.setRGB(l, l, l);
    }
  }
}
