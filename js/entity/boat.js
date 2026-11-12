// Boat: floats on water, rideable (use to board, sneak or use again to leave), steered by the rider's look + movement keys
import * as THREE from 'three';
import { Entity, blockCubeGeometry } from './entity.js';
import { applyCurrent } from '../engine/physics.js';
import { updateShadow, clearShadow } from '../engine/shadows.js';
import { blocks as BL, isWater, isLava } from '../world/blocks.js';
import { PACK } from '../engine/pack.js';
import { sheetTexture, texBoxGeometry } from './texbox.js';
const SKIN = [{ side: [4, 12, 24, 4], top: [4, 12, 24, 16], end: [4, 12, 24, 4] }, { side: [2, 2, 16, 6], top: [2, 0, 16, 2], end: [0, 2, 2, 6] }]; // hull floor, walls (boat.png)

const PARTS = [ // [x, y, z, w, h, d] in boat-local space (length along z)
  [0, 0.05, 0, 1.1, 0.1, 1.5], [-0.5, 0.3, 0, 0.1, 0.4, 1.5], [0.5, 0.3, 0, 0.1, 0.4, 1.5], [0, 0.3, -0.7, 0.9, 0.4, 0.1], [0, 0.3, 0.7, 0.9, 0.4, 0.1]];

export class Boat extends Entity {
  constructor(world, x, y, z, yaw = 0) { super(world, x, y, z); this.type = 'boat'; this.w = 1.5; this.h = 0.6; this.yaw = this.pyaw = yaw; this.rider = null; this.damage = 0; this.hurtT = 0; }
  toJSON() { return { t: 'boat', x: this.x, y: this.y, z: this.z, yaw: this.yaw }; }
  box() { const hw = this.w / 2; return [this.x - hw, this.y, this.z - hw, this.x + hw, this.y + this.h, this.z + hw]; }
  // fraction of the hull below the water surface (5 slices)
  submerged() { const w = this.world; let n = 0; const hw = 0.6;
    for (let i = 0; i < 5; i++) { const sy = this.y + (i + 0.5) * this.h / 5; let wet = false;
      for (const [ox, oz] of [[-hw, -hw], [hw, -hw], [-hw, hw], [hw, hw], [0, 0]]) { const bx = Math.floor(this.x + ox), by = Math.floor(sy), bz = Math.floor(this.z + oz); const b = w.getBlock(bx, by, bz); if (!isWater(b)) continue;
        const m = w.getMeta(bx, by, bz); const top = isWater(w.getBlock(bx, by + 1, bz)) ? 1 : m >= 8 ? 1 : (8 - m) / 9; if (sy < by + top) { wet = true; break; } }
      if (wet) n++; }
    return n / 5; }
  tick(g) {
    this.baseTick(); if (this.hurtT > 0) this.hurtT--; if (this.damage > 0) this.damage = Math.max(0, this.damage - 0.05);
    const frac = this.submerged(); const r = this.rider;
    if (r && (r.dead || r.riding !== this)) this.rider = null;
    // buoyancy: settle with the hull half under the surface
    if (frac > 0) { this.my += 0.04 * (frac * 2 - 1); this.my *= 0.9; } else this.my -= 0.04;
    if (frac > 0) { const hw = 0.6; applyCurrent(this.world, this, this.x - hw, this.y, this.z - hw, this.x + hw, this.y + 0.4, this.z + hw, 0.006); }
    // steering
    const u0 = BL[this.world.getBlock(Math.floor(this.x), Math.floor(this.y - 0.1), Math.floor(this.z))]; const ice0 = this.onGround && u0 && u0.slippery;
    if (this.rider) { const inp = g.input, p = this.rider; const fw = (inp.forward ? 1 : 0) - (inp.back ? 0.5 : 0), st = (inp.left ? 1 : 0) - (inp.right ? 1 : 0);
      if (inp.sneak) { this.dismount(); }
      else { const s = Math.sin(p.yaw), c = Math.cos(p.yaw); const a = frac > 0 ? 0.035 : ice0 ? 0.03 : 0.01;
        this.mx += (-s * fw - c * st * 0.6) * a; this.mz += (-c * fw + s * st * 0.6) * a; } }
    const under = BL[this.world.getBlock(Math.floor(this.x), Math.floor(this.y - 0.1), Math.floor(this.z))]; const ice = this.onGround && under && under.slippery;
    const max = frac > 0 ? 0.4 : ice ? 0.6 : 0.12; const hs = Math.hypot(this.mx, this.mz); if (hs > max) { this.mx *= max / hs; this.mz *= max / hs; }
    this.move(this.mx, this.my, this.mz, frac > 0 ? 0.6 : 0.5);
    const drag = frac > 0 ? 0.96 : ice ? 0.98 : this.onGround ? 0.5 : 0.95; this.mx *= drag; this.mz *= drag; this.my *= 0.95;
    // turn the hull toward travel direction
    const sp = Math.hypot(this.mx, this.mz); if (sp > 0.01) { const ty = Math.atan2(-this.mx, -this.mz); let d = ty - this.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); this.yaw += d * Math.min(1, sp * 2.5); }
    if (isLava(this.world.getBlock(Math.floor(this.x), Math.floor(this.y + 0.2), Math.floor(this.z)))) this.breakApart(g, false);
    if (this.rider) this.seat(this.rider);
  }
  seat(p) { p.x = this.x; p.y = this.y + 0.05; p.z = this.z; p.mx = p.my = p.mz = 0; p.fall = 0; p.onGround = false; }
  mount(p) { if (this.rider) return; this.rider = p; p.riding = this; p.flying = false; p.px = p.x; p.py = p.y; p.pz = p.z; this.seat(p); p.px = p.x; p.py = p.y; p.pz = p.z; }
  dismount() { const p = this.rider; if (!p) return; this.rider = null; p.riding = null;
    // step off onto the nearest free spot beside the boat, else on top
    const c = Math.cos(this.yaw), s = Math.sin(this.yaw);
    for (const [ox, oz] of [[c * 1.2, -s * 1.2], [-c * 1.2, s * 1.2], [-s * 1.3, -c * 1.3], [s * 1.3, c * 1.3]]) { for (const dy of [0, 1]) { const x = this.x + ox, z = this.z + oz, y = Math.floor(this.y) + dy;
      if (p._fits && p._fits(this.world, x, y + 0.01, z)) { p.x = x; p.y = y + 0.01; p.z = z; p.px = x; p.py = p.y; p.pz = z; return; } } }
    p.y = this.y + this.h + 0.01; p.py = p.y; }
  hit(g, p) { this.hurtT = 10; this.damage += p.creative ? 100 : 1.5; g.sound('hit:wood', this, 0.8, 1); if (this.damage > 4) this.breakApart(g, !p.creative); }
  breakApart(g, drop) { if (this.dead) return; this.dismount(); this.dead = true; g.sound('dig:wood', this); if (drop) g.spawnDrop(this.x, this.y + 0.5, this.z, { id: 333, count: 1, dmg: 0 }); }
  render(r, pt, daySub) {
    if (!this.obj) { const img = PACK['mob:boat']; this.obj = new THREE.Group();
      if (img) { this.mat = new THREE.MeshBasicMaterial({ map: sheetTexture(img) }); this.geos = SKIN.map(s => texBoxGeometry(img, s)); }
      else { this.mat = new THREE.MeshBasicMaterial({ map: r.atlasTex, vertexColors: true }); const g = blockCubeGeometry(5, r.opts.rows, 1); this.geos = [g, g]; }
      PARTS.forEach(([x, y, z, w, h, d], i) => { const m = new THREE.Mesh(this.geos[i ? 1 : 0], this.mat); m.position.set(x, y, z); m.scale.set(w, h, d); this.obj.add(m); }); r.scene.add(this.obj); }
    const L = (a, b) => a + (b - a) * pt; let dy = this.yaw - this.pyaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    this.obj.position.set(L(this.px, this.x), L(this.py, this.y), L(this.pz, this.z)); this.obj.rotation.set(0, this.pyaw + dy * pt, this.hurtT > 0 ? Math.sin(this.hurtT) * 0.08 : 0); updateShadow(this, r, this.world, L(this.px, this.x), L(this.py, this.y), L(this.pz, this.z), 0.9);
    const l = this.lightAt(daySub); this.mat.color.setRGB(l, l, l);
  }
  dispose(scene) { if (this.obj) { scene.remove(this.obj); new Set(this.geos).forEach(g => g.dispose()); this.mat.dispose(); this.obj = null; } clearShadow(this, scene); }
}
