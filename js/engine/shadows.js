// Lightweight soft ground shadows for moving entities
import * as THREE from 'three';
import { blocks as BL, SOLID, SHAPE, SH } from '../world/blocks.js';

let geo;
function geometry() {
  if (geo) return geo;
  const rings = [0, 0.38, 0.72, 1], alpha = [0.25, 0.17, 0.075, 0]; const segs = 20;
  const pos = [], col = [], ind = [];
  for (let r = 0; r < rings.length; r++) for (let i = 0; i <= segs; i++) {
    const a = i / segs * Math.PI * 2, d = rings[r]; pos.push(Math.cos(a) * d, 0, Math.sin(a) * d); col.push(0, 0, 0, alpha[r]);
  }
  for (let r = 0; r < rings.length - 1; r++) for (let i = 0; i < segs; i++) { const a = r * (segs + 1) + i, b = a + segs + 1; ind.push(a, a + 1, b, a + 1, b + 1, b); }
  geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 4)); geo.setIndex(ind); return geo;
}
export function updateShadow(owner, renderer, world, x, y, z, radius = 0.55) {
  if (!owner.shadow) { const mat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }); owner.shadow = new THREE.Mesh(geometry(), mat); owner.shadow.renderOrder = 0.5; renderer.scene.add(owner.shadow); }
  const shadow = owner.shadow; let ground = -Infinity;
  const bx = Math.floor(x), bz = Math.floor(z), feet = Math.floor(y + 0.05);
  for (let by = feet; by >= Math.max(0, feet - 8); by--) {
    const id = world.getBlock(bx, by, bz); if (!SOLID[id]) continue;
    const b = BL[id], h = SHAPE[id] === SH.slab ? 0.5 : SHAPE[id] === SH.layer ? (b.height || 0.125) : 1;
    ground = by + h; break;
  }
  const height = y - ground;
  if (!Number.isFinite(ground) || height < -0.25 || height > 8) { shadow.visible = false; return; }
  const fade = Math.max(0, 1 - Math.max(0, height) / 8);
  shadow.visible = fade > 0.02; shadow.position.set(x, ground + 0.012, z); shadow.scale.set(radius * (0.7 + fade * 0.3), 1, radius * (0.7 + fade * 0.3)); shadow.material.opacity = fade;
}
export function clearShadow(owner, scene) { if (!owner.shadow) return; scene.remove(owner.shadow); owner.shadow.material.dispose(); owner.shadow = null; }
