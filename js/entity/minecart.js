// Minecart: follows rails (straight, sloped and curved), boosted/braked by powered rails, trips detector rails,
// ejects its rider on a powered activator rail; rideable like the boat
import * as THREE from 'three';
import { Entity } from './entity.js';
import { updateShadow, clearShadow } from '../engine/shadows.js';
import { isRail, SOLID, isLava } from '../world/blocks.js';
import { RD, SHAPE_DIRS, railShape } from '../world/rails.js';
import { PACK } from '../engine/pack.js';
import { sheetTexture, texBoxGeometry } from './texbox.js';

const SKIN = { floor: { top: [2, 12, 20, 16], side: [0, 10, 2, 16], end: [2, 10, 20, 2] }, long: { side: [2, 2, 16, 8], top: [2, 0, 16, 2], end: [0, 2, 2, 8] }, end: { end: [2, 2, 16, 8], top: [2, 0, 16, 2], side: [0, 2, 2, 8] } };
const PARTS = [['floor', 0, 0.12, 0, 0.8, 0.1, 1.1], ['long', -0.4, 0.4, 0, 0.1, 0.5, 1.1], ['long', 0.4, 0.4, 0, 0.1, 0.5, 1.1], ['end', 0, 0.4, -0.5, 0.7, 0.5, 0.1], ['end', 0, 0.4, 0.5, 0.7, 0.5, 0.1]];
const MAX = 0.4;

export class Minecart extends Entity {
  constructor(world, x, y, z, yaw = 0) { super(world, x, y, z); this.type = 'minecart'; this.cart = true; this.vehicle = true; this.w = 0.98; this.h = 0.7; this.yaw = this.pyaw = yaw; this.rider = null; this.damage = 0; this.hurtT = 0; this.pitch = 0; }
  toJSON() { return { t: 'minecart', x: this.x, y: this.y, z: this.z, yaw: this.yaw, mx: this.mx, mz: this.mz }; }
  box() { const hw = this.w / 2; return [this.x - hw, this.y, this.z - hw, this.x + hw, this.y + this.h, this.z + hw]; }
  railHere() { const w = this.world, bx = Math.floor(this.x), bz = Math.floor(this.z), by = Math.floor(this.y + 0.01);
    for (const y of [by, by - 1]) { const id = w.getBlock(bx, y, bz); if (isRail(id)) return [bx, y, bz, id, w.getMeta(bx, y, bz)]; } return null; }
  tick(g) {
    this.baseTick(); if (this.hurtT > 0) this.hurtT--; if (this.damage > 0) this.damage = Math.max(0, this.damage - 0.05);
    const r = this.rider; if (r && (r.dead || r.riding !== this)) this.rider = null;
    if (this.rider && g.input.sneak) this.dismount();
    const w = this.world, rail = this.railHere();
    // players walking into the cart shove it
    const p = g.player; if (p && !p.dead && p.riding !== this) { const dx = this.x - p.x, dz = this.z - p.z, d = Math.hypot(dx, dz); if (d < 0.8 && Math.abs(p.y - this.y) < 1) { this.mx += dx / (d || 1) * 0.02; this.mz += dz / (d || 1) * 0.02; } }
    if (!rail) { this.my -= 0.04; this.move(this.mx, this.my, this.mz, 0); const f = this.onGround ? 0.5 : 0.95; this.mx *= f; this.mz *= f; this.my *= 0.98; }
    else this.onRail(g, rail);
    if (isLava(w.getBlock(Math.floor(this.x), Math.floor(this.y + 0.2), Math.floor(this.z)))) this.breakApart(g, true);
    if (this.rider) this.seat(this.rider);
  }
  onRail(g, [bx, by, bz, id, meta]) {
    const w = this.world, sh = railShape(id, meta), [[d1, u1], [d2, u2]] = SHAPE_DIRS[sh];
    const ax = bx + 0.5 + RD[d1][0] * 0.5, az = bz + 0.5 + RD[d1][1] * 0.5, bxx = bx + 0.5 + RD[d2][0] * 0.5, bzz = bz + 0.5 + RD[d2][1] * 0.5;
    let tx = bxx - ax, tz = bzz - az; const tl = Math.hypot(tx, tz); tx /= tl; tz /= tl;
    const slope = sh >= 2 && sh <= 5; const upDir = slope ? (u1 ? d1 : d2) : -1;
    // keep only the velocity along the track
    let v = this.mx * tx + this.mz * tz;
    if (slope) { const ux = RD[upDir][0], uz = RD[upDir][1]; const along = tx * ux + tz * uz; v -= 0.0078 * Math.sign(along); }
    if (this.rider && g.input.forward) { const yw = this.rider.yaw; v += (-Math.sin(yw) * tx - Math.cos(yw) * tz) * 0.006; }
    const powered = !!(meta & 8);
    if (id === 27) { if (powered) { if (Math.abs(v) > 0.01) v += Math.sign(v) * 0.06; else { // kick off a wall at one end
        if (SOLID[w.getBlock(bx + RD[d1][0], by, bz + RD[d1][1])]) v = 0.02; else if (SOLID[w.getBlock(bx + RD[d2][0], by, bz + RD[d2][1])]) v = -0.02; } }
      else { v *= 0.5; if (Math.abs(v) < 0.03) v = 0; } }
    if (id === 28 && g.redstone) g.redstone.cartOn(bx, by, bz);
    if (id === 157 && powered && this.rider) this.dismount();
    v *= this.rider ? 0.997 : 0.96; if (Math.abs(v) > MAX) v = Math.sign(v) * MAX; if (Math.abs(v) < 1e-4) v = 0;
    // snap onto the track line, then advance along it
    const px = this.x - ax, pz = this.z - az, s = px * tx + pz * tz; let nx = ax + tx * s + tx * v, nz = az + tz * s + tz * v;
    // stop at a solid block or the end of the track
    const cx = Math.floor(nx), cz = Math.floor(nz);
    if ((cx !== bx || cz !== bz)) { const ok = isRail(w.getBlock(cx, by, cz)) || isRail(w.getBlock(cx, by + 1, cz)) || isRail(w.getBlock(cx, by - 1, cz));
      if (!ok && SOLID[w.getBlock(cx, by, cz)] && !slope) { v = 0; nx = ax + tx * s; nz = az + tz * s; } }
    this.x = nx; this.z = nz; this.mx = tx * v; this.mz = tz * v; this.my = 0; this.fall = 0;
    let y = by + 1 / 16; if (slope) { const ux = RD[upDir][0], uz = RD[upDir][1]; const f = ux ? (ux > 0 ? nx - bx : bx + 1 - nx) : (uz > 0 ? nz - bz : bz + 1 - nz); y += Math.max(0, Math.min(1, f)); }
    this.y = y; this.onGround = true;
    if (Math.abs(v) > 0.001) { const ty = Math.atan2(-tx * Math.sign(v), -tz * Math.sign(v)); let d = ty - this.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); if (Math.abs(d) > Math.PI / 2) d -= Math.sign(d) * Math.PI; this.yaw += d; }
    this.pitch = slope ? (Math.PI / 4) * ((RD[upDir][0] * -Math.sin(this.yaw) + RD[upDir][1] * -Math.cos(this.yaw)) > 0 ? 1 : -1) : 0;
    if (Math.abs(v) > 0.2 && Math.random() < 0.02) g.sound('step:metal', this, 0.15, 0.6);
  }
  seat(p) { p.x = this.x; p.y = this.y + 0.25; p.z = this.z; p.mx = p.my = p.mz = 0; p.fall = 0; p.onGround = false; }
  mount(p) { if (this.rider) return; this.rider = p; p.riding = this; p.flying = false; this.seat(p); p.px = p.x; p.py = p.y; p.pz = p.z; }
  dismount() { const p = this.rider; if (!p) return; this.rider = null; p.riding = null;
    for (const [ox, oz] of [[1.1, 0], [-1.1, 0], [0, 1.1], [0, -1.1]]) { const x = this.x + ox, z = this.z + oz, y = Math.floor(this.y + 0.1);
      if (p._fits && p._fits(this.world, x, y + 0.01, z)) { p.x = x; p.y = y + 0.01; p.z = z; p.px = x; p.py = p.y; p.pz = z; return; } }
    p.y = this.y + this.h + 0.01; p.py = p.y; }
  hit(g, p) { this.hurtT = 10; this.damage += p.creative ? 100 : 1.5; g.sound('hit:metal', this, 0.8, 1); if (this.damage > 4) this.breakApart(g, !p.creative); else { const d = Math.hypot(this.x - p.x, this.z - p.z) || 1; this.mx += (this.x - p.x) / d * 0.1; this.mz += (this.z - p.z) / d * 0.1; } }
  breakApart(g, drop) { if (this.dead) return; this.dismount(); this.dead = true; g.sound('dig:metal', this); if (drop) g.spawnDrop(this.x, this.y + 0.5, this.z, { id: 328, count: 1, dmg: 0 }); }
  render(r, pt, daySub) {
    if (!this.obj) { const img = PACK['mob:minecart']; this.obj = new THREE.Group(); this.body = new THREE.Group(); this.obj.add(this.body);
      this.mat = new THREE.MeshBasicMaterial(img ? { map: sheetTexture(img) } : { color: 0x888888 }); this.geos = {};
      for (const [k, x, y, z, w, h, d] of PARTS) { const g = this.geos[k] ||= img ? texBoxGeometry(img, SKIN[k]) : new THREE.BoxGeometry(1, 1, 1); const m = new THREE.Mesh(g, this.mat); m.position.set(x, y, z); m.scale.set(w, h, d); this.body.add(m); }
      r.scene.add(this.obj); }
    const L = (a, b) => a + (b - a) * pt; let dy = this.yaw - this.pyaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    const x = L(this.px, this.x), y = L(this.py, this.y), z = L(this.pz, this.z);
    this.obj.position.set(x, y, z); this.obj.rotation.set(0, this.pyaw + dy * pt, 0); this.body.rotation.set(this.pitch, 0, this.hurtT > 0 ? Math.sin(this.hurtT) * 0.1 : 0);
    updateShadow(this, r, this.world, x, y, z, 0.7); const l = this.lightAt(daySub); this.mat.color.setRGB(l, l, l);
  }
  dispose(scene) { if (this.obj) { scene.remove(this.obj); Object.values(this.geos).forEach(g => g.dispose()); this.mat.dispose(); this.obj = null; } clearShadow(this, scene); }
}
