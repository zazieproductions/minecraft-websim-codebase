// Base entity + dropped item entity
import * as THREE from 'three';
import { moveEntity, applyCurrent } from '../engine/physics.js';
import { blocks as BL, SHAPE, SH, isWater, isLava } from '../world/blocks.js';
import { items, getIcon } from '../inventory/items.js';
import { tileIndex, COLS } from '../engine/textures.js';
import { updateShadow, clearShadow } from '../engine/shadows.js';

let nextId = 1;
export class Entity {
  constructor(world, x, y, z) { this.id = nextId++; this.world = world; this.x = x; this.y = y; this.z = z; this.px = x; this.py = y; this.pz = z; this.mx = 0; this.my = 0; this.mz = 0; this.w = 0.25; this.h = 0.25; this.onGround = false; this.age = 0; this.dead = false; this.yaw = 0; this.pyaw = 0; this.fall = 0; }
  baseTick() { this.px = this.x; this.py = this.y; this.pz = this.z; this.pyaw = this.yaw; this.age++; }
  move(dx, dy, dz, step = 0) { const r = moveEntity(this.world, this, dx, dy, dz, step); if (r.hx) this.mx = 0; if (r.hz) this.mz = 0; if (r.hy) this.my = 0; this.hcol = r.hx || r.hz; const was = this.onGround; this.onGround = r.onGround; if (!this.onGround && r.dy < 0) this.fall -= r.dy; return r; }
  inWater() { return isWater(this.world.getBlock(Math.floor(this.x), Math.floor(this.y + 0.1), Math.floor(this.z))); }
  inLava() { return isLava(this.world.getBlock(Math.floor(this.x), Math.floor(this.y + 0.1), Math.floor(this.z))); }
  lightAt(daySub) { const x = Math.floor(this.x), y = Math.floor(this.y + this.h / 2), z = Math.floor(this.z); const l = Math.max(this.world.getSky(x, y, z) - daySub, this.world.getBlockLight(x, y, z)); const f = 1 - Math.max(0, l) / 15; const b = (1 - f) / (f * 3 + 1) * 0.95 + 0.05; const a = this.world.ambient || 0; return b * (1 - a) + a; }
  dispose(scene) { if (this.obj) { scene.remove(this.obj); this.obj.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material && o.material.map && o.material.map.isCanvasTexture && !o.material.shared) o.material.map.dispose(); }); this.obj = null; } clearShadow(this, scene); }
}

const iconTexCache = new Map();
function iconTexture(id, meta = 0) { const key = id + ':' + meta; let t = iconTexCache.get(key); if (!t) { t = new THREE.CanvasTexture(getIcon(id, 32, meta)); t.magFilter = t.minFilter = THREE.NearestFilter; t.colorSpace = THREE.NoColorSpace; iconTexCache.set(key, t); } return t; }
export function blockCubeGeometry(id, rows, size = 1, meta = 0) {
  const b = BL[id]; const g = new THREE.BoxGeometry(size, size * (SHAPE[id] === SH.slab ? 0.5 : 1), size); const uv = g.attributes.uv;
  const faces = ['side', 'side', 'top', 'bottom', 'side', b.facing ? 'front' : 'side'];
  for (let f = 0; f < 6; f++) { const t = tileIndex(b.tex(faces[f], meta)) ?? 0; const u0 = (t % COLS) / COLS, v0 = Math.floor(t / COLS) / rows;
    for (let k = 0; k < 4; k++) { const i = f * 4 + k; const u = uv.getX(i), v = uv.getY(i); uv.setXY(i, u0 + u / COLS, v0 + (1 - v) / rows); } }
  // tint grass/leaves
  const col = new Float32Array(24 * 3).fill(1);
  if (id === 2) for (let k = 8; k < 12; k++) col.set([0.49, 0.74, 0.42], k * 3);
  if (id === 18 || id === 161) for (let k = 0; k < 24; k++) col.set([0.3, 0.7, 0.15], k * 3);
  const shade = [0.6, 0.6, 1, 0.5, 0.8, 0.8]; for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) { const i = (f * 4 + k) * 3; col[i] *= shade[f]; col[i + 1] *= shade[f]; col[i + 2] *= shade[f]; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); return g;
}
export function makeItemObject(id, renderer, scale = 0.25, meta = 0) {
  const it = items[id]; const sh = it && it.block !== undefined ? SHAPE[it.block] : -1;
  if (sh === SH.cube || sh === SH.slab || sh === SH.cactus) {
    if (!renderer._itemMat) { renderer._itemMat = new THREE.MeshBasicMaterial({ map: renderer.atlasTex, vertexColors: true, alphaTest: 0.1 }); renderer._itemMat.shared = true; }
    const m = new THREE.Mesh(blockCubeGeometry(it.block, renderer.opts.rows, scale, meta), renderer._itemMat.clone()); m.material.shared = true; m.userData.cube = true; return m;
  }
  const mat = new THREE.MeshBasicMaterial({ map: iconTexture(id, meta), transparent: false, alphaTest: 0.1, side: THREE.DoubleSide }); mat.shared = true;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(scale * 2, scale * 2), mat); return m;
}

export class ItemEntity extends Entity {
  constructor(world, x, y, z, stack) { super(world, x, y, z); this.stack = stack; this.pickupDelay = 10; this.bobOff = Math.random() * Math.PI * 2; this.mx = (Math.random() - 0.5) * 0.2; this.my = 0.2; this.mz = (Math.random() - 0.5) * 0.2; this.type = 'item'; }
  tick(game) {
    this.baseTick(); if (this.pickupDelay > 0) this.pickupDelay--;
    this.my -= 0.04; if (this.inWater()) { this.my += 0.05; this.my *= 0.9; applyCurrent(this.world, this, this.x, this.y + 0.1, this.z, this.x, this.y + 0.1, this.z, 0.03); }
    if (this.inLava()) { this.dead = true; game.sound('fizz', this); return; }
    this.move(this.mx, this.my, this.mz);
    const f = this.onGround ? 0.588 : 0.98; this.mx *= f; this.mz *= f; this.my *= 0.98; if (this.onGround) this.my *= -0.5;
    if (this.age > 6000) this.dead = true;
    // merge with nearby stacks
    if (!this.netId && this.age % 10 === 0) for (const e of game.entities) if (e !== this && e.type === 'item' && !e.dead && e.stack.id === this.stack.id && e.stack.dmg === this.stack.dmg && Math.abs(e.x - this.x) < 0.5 && Math.abs(e.y - this.y) < 0.5 && Math.abs(e.z - this.z) < 0.5 && !items[this.stack.id]?.durability) { const ms = items[this.stack.id]?.stack || 64; if (this.stack.count + e.stack.count <= ms) { this.stack.count += e.stack.count; e.dead = true; } }
  }
  render(r, pt, daySub) {
    if (!this.obj) { this.obj = new THREE.Group(); this.inner = makeItemObject(this.stack.id, r, 0.125, this.stack.dmg || 0); this.obj.add(this.inner); r.scene.add(this.obj); this.cube = !!this.inner.userData.cube; }
    const x = this.px + (this.x - this.px) * pt, y = this.py + (this.y - this.py) * pt, z = this.pz + (this.z - this.pz) * pt;
    const t = this.age + pt; const bob = Math.sin(t / 10 + this.bobOff) * 0.1 + 0.1;
    this.obj.position.set(x, y + bob + 0.1, z); updateShadow(this, r, this.world, x, y, z, 0.28);
    if (this.cube) this.inner.rotation.y = (t / 20 + this.bobOff); else { this.inner.rotation.y = 0; this.obj.quaternion.copy(r.camera.quaternion); }
    const l = this.lightAt(daySub); this.inner.material.color.setRGB(l, l, l);
    const n = this.stack.count > 20 ? 3 : this.stack.count > 5 ? 2 : 1;
    if (this.obj.children.length !== n) { while (this.obj.children.length > 1) this.obj.remove(this.obj.children[1]); for (let i = 1; i < n; i++) { const c = this.inner.clone(); c.position.set(i * 0.05, i * 0.04, i * 0.03); this.obj.add(c); } }
  }
}
export class XPOrb extends Entity {
  constructor(world, x, y, z, value) { super(world, x, y, z); this.value = value; this.type = 'xp'; this.mx = (Math.random() - 0.5) * 0.2; this.my = Math.random() * 0.2; this.mz = (Math.random() - 0.5) * 0.2; this.w = this.h = 0.5; }
  tick(game) { this.baseTick(); const p = game.player; const dx = p.x - this.x, dy = p.y + 0.8 - this.y, dz = p.z - this.z; const d = Math.sqrt(dx * dx + dy * dy + dz * dz) / 8;
    if (d < 1) { const f = (1 - d) * (1 - d) * 0.1; this.mx += dx / d / 8 * f; this.my += dy / d / 8 * f; this.mz += dz / d / 8 * f; }
    this.my -= 0.03; this.move(this.mx, this.my, this.mz); const fr = this.onGround ? 0.588 : 0.98; this.mx *= fr; this.mz *= fr; this.my *= 0.98; if (this.age > 6000) this.dead = true; }
  render(r, pt) {
    if (!this.obj) { const cv = document.createElement('canvas'); cv.width = cv.height = 8; const c = cv.getContext('2d'); c.fillStyle = '#204000'; c.fillRect(2, 1, 4, 6); c.fillRect(1, 2, 6, 4); c.fillStyle = '#a0ff20'; c.fillRect(2, 2, 4, 4); c.fillStyle = '#f0ff90'; c.fillRect(3, 3, 1, 1); const t = new THREE.CanvasTexture(cv); t.magFilter = t.minFilter = THREE.NearestFilter;
      this.obj = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 0.25), new THREE.MeshBasicMaterial({ map: t, alphaTest: 0.1 })); r.scene.add(this.obj); }
    this.obj.position.set(this.px + (this.x - this.px) * pt, this.py + (this.y - this.py) * pt + 0.15, this.pz + (this.z - this.pz) * pt); this.obj.quaternion.copy(r.camera.quaternion);
    const s = 0.8 + Math.sin((this.age + pt) / 3) * 0.2; this.obj.material.color.setRGB(s, 1, s * 0.5);
  }
}
