// The player's own Steve model: drawn in the world in third person (F5) and as the 3D preview in the inventory
import * as THREE from 'three';
import { buildModel } from '../entity/models.js';
import { makeItemObject } from '../entity/entity.js';
import { items } from '../inventory/items.js';
import { Skins } from './skin.js';
import { updateShadow } from './shadows.js';

const angDiff = (a, b) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };
const BASE = {}; // rest positions of the parts, so sneaking can offset them

export function updateDeadmau5Ears(model, visible) {
  if (!model.deadmau5Ears) {
    const mat = new THREE.MeshBasicMaterial({ color: 0x171717 });
    model.deadmau5Ears = [-1, 1].map(side => {
      const ear = new THREE.Mesh(new THREE.BoxGeometry(2 / 16, 5 / 16, 1 / 16), mat);
      ear.position.set(side * 5 / 16, 6.25 / 16, -0.25 / 16);
      model.parts.head.add(ear); return ear;
    });
  }
  for (const ear of model.deadmau5Ears) ear.visible = !!visible;
}

// ---------- worn armor: shells around the body parts, textured from vanilla-layout 64x32 armor sheets ----------
// per-material vanilla 1.7 sheets (textures/armor/<mat>_layer_<n>.png); chain has none, so it tints the shared grey sheet.
// leather is dyed (default brown) and gets an undyed overlay layer on top
const ARMOR_FILES = { leather: 1, iron: 1, gold: 1, diamond: 1 };
// armor slot (0 helmet, 1 chestplate, 2 leggings, 3 boots) -> parts it covers, sheet layer, inflation in pixels
const ARMOR_SLOTS = [
  [['head', 1, 1]],
  [['body', 1, 1], ['armR', 1, 1], ['armL', 1, 1]],
  [['body', 2, 0.5], ['legR', 2, 0.5], ['legL', 2, 0.5]],
  [['legR', 1, 1], ['legL', 1, 1]],
];
const CHAIN_TINT = [0.72, 0.73, 0.75], LEATHER = [160 / 255, 101 / 255, 64 / 255];
const ARMOR_UV = { head: [0, 0, 8, 8, 8], body: [16, 16, 8, 12, 4], armR: [40, 16, 4, 12, 4], armL: [40, 16, 4, 12, 4], legR: [0, 16, 4, 12, 4], legL: [0, 16, 4, 12, 4] };
const armorTex = {};
function armorTexture(file) {
  if (armorTex[file]) return armorTex[file];
  const t = new THREE.TextureLoader().load('textures/armor/' + file + '.png'); t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.colorSpace = THREE.NoColorSpace;
  return armorTex[file] = t;
}
function armorGeometry(base, part, pad) {
  const geo = base.clone(); geo.computeBoundingBox(); const b = geo.boundingBox, c = b.getCenter(new THREE.Vector3()), s = b.getSize(new THREE.Vector3());
  const k = new THREE.Vector3((s.x + pad / 8) / s.x, (s.y + pad / 8) / s.y, (s.z + pad / 8) / s.z); const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setXYZ(i, c.x + (pos.getX(i) - c.x) * k.x, c.y + (pos.getY(i) - c.y) * k.y, c.z + (pos.getZ(i) - c.z) * k.z);
  const [u, v, w, h, d] = ARMOR_UV[part]; const mirror = part === 'armL' || part === 'legL';
  // BoxGeometry face order: +x, -x, +y, -y, +z, -z (same layout the skin uses); left limbs use the right-limb art mirrored, like vanilla
  let R = [[u, v + d, d, h], [u + d + w, v + d, d, h], [u + d, v, w, d], [u + d + w, v, w, d], [u + 2 * d + w, v + d, w, h], [u + d, v + d, w, h]];
  if (mirror) R = [R[1], R[0], R[2], R[3], R[4], R[5]];
  const uv = geo.attributes.uv;
  for (let f = 0; f < 6; f++) { const [rx, ry, rw, rh] = R[f]; for (let q = 0; q < 4; q++) { const i = f * 4 + q, uu = mirror ? 1 - uv.getX(i) : uv.getX(i), vv = uv.getY(i); uv.setXY(i, (rx + uu * rw) / 64, 1 - (ry + (1 - vv) * rh) / 32); } }
  return geo;
}
function ensureArmor(model) {
  if (model.armor) return model.armor; model.armor = [];
  ARMOR_SLOTS.forEach((list, slot) => { for (const [part, layer, pad] of list) {
    const grp = model.parts[part]; const base = grp.children[0].geometry; const geo = armorGeometry(base, part, pad);
    for (const overlay of [false, true]) {
      const mat = new THREE.MeshBasicMaterial({ vertexColors: true, alphaTest: 0.5, side: THREE.DoubleSide, polygonOffset: overlay, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
      const mesh = new THREE.Mesh(geo, mat); mesh.visible = false; mesh.userData = { slot, layer, overlay }; grp.add(mesh); model.armor.push(mesh);
    }
  } });
  return model.armor;
}
// show the pieces in inv.armor; l = light level, red = hurt flash
export function updateArmor(model, inv, l = 1, red = false) {
  for (const mesh of ensureArmor(model)) {
    const { slot, layer, overlay } = mesh.userData;
    const st = inv && inv.armor && inv.armor[slot]; const it = st && items[st.id]; const mat = it && it.armor === slot ? it.key.split('_')[0] : null;
    mesh.visible = !!mat && (!overlay || mat === 'leather'); if (!mesh.visible) continue;
    const file = ARMOR_FILES[mat] ? mat + '_layer_' + layer + (overlay ? '_overlay' : '') : 'layer_' + layer;
    const map = armorTexture(file); if (mesh.material.map !== map) { mesh.material.map = map; mesh.material.needsUpdate = true; }
    const t = overlay ? [1, 1, 1] : mat === 'leather' ? (st.color ? [(st.color >> 16 & 255) / 255, (st.color >> 8 & 255) / 255, (st.color & 255) / 255] : LEATHER) : mat === 'chain' ? CHAIN_TINT : [1, 1, 1];
    mesh.material.color.setRGB(t[0] * l, t[1] * l * (red ? 0.45 : 1), t[2] * l * (red ? 0.45 : 1));
  }
}
// o: { headYaw (relative to body), pitch, limb, amt, sneak, swing 0..1, holding, flying }
export function pose(model, o) {
  const P = model.parts; if (!BASE.head) for (const k in P) BASE[k] = P[k].position.clone();
  for (const k in P) P[k].position.copy(BASE[k]);
  P.head.rotation.set(o.pitch, o.headYaw, 0, 'YXZ');
  const a = Math.cos(o.limb * 0.6662) * 1.4 * o.amt, b = Math.cos(o.limb * 0.6662 + Math.PI) * o.amt;
  P.legR.rotation.set(a, 0, 0); P.legL.rotation.set(-a, 0, 0);
  P.armR.rotation.set(b, 0, 0.05); P.armL.rotation.set(-b, 0, -0.05);
  if (o.holding) P.armR.rotation.x = P.armR.rotation.x * 0.5 + 0.31;
  if (o.swing > 0) { const s = Math.sin(o.swing * Math.PI), s2 = Math.sin(Math.sqrt(o.swing) * Math.PI);
    P.armR.rotation.x += s * 1.2 + s2 * 0.4; P.armR.rotation.y = -s2 * 0.4; P.body.rotation.y = -s2 * 0.2; } else P.body.rotation.y = 0;
  if (o.sneak) { // lean forward: body tips, head/arms move forward and down, legs back
    P.body.rotation.x = -0.5; for (const k of ['head', 'armR', 'armL']) { P[k].position.z -= 5 / 16; P[k].position.y -= 1.5 / 16; }
    P.armR.rotation.x += 0.4; P.armL.rotation.x += 0.4; for (const k of ['legR', 'legL']) P[k].position.z += 1 / 16;
  } else P.body.rotation.x = 0;
  if (o.sitting) { P.legR.rotation.set(1.4, 0.3, 0); P.legL.rotation.set(1.4, -0.3, 0); if (!o.swing) { P.armR.rotation.x = 0.6; P.armL.rotation.x = 0.6; } }
}
export function lightCurve(w, x, y, z, daySub) { const l = Math.max(w.getSky(x, y, z) - daySub, w.getBlockLight(x, y, z)); const f = 1 - Math.max(0, l) / 15; return (1 - f) / (f * 3 + 1) * 0.95 + 0.05; }

export class PlayerModel {
  constructor(game) { this.g = game; this.model = null; this.bodyYaw = 0; this.amt = 0; this.heldId = -1; this.item = null; }
  _ensure() { if (this.model) return this.model; this.model = buildModel('steve'); this.g.renderer.scene.add(this.model.root); const mat = this.model.mat; Skins.apply(mat, Skins.current); updateDeadmau5Ears(this.model, Skins.hasDeadmau5Ears); Skins.onChange((s, ears) => { Skins.apply(mat, s); updateDeadmau5Ears(this.model, ears); }); return this.model; }
  _held(m, holder, id, renderer) { // attach the held item to the right hand
    if (holder.heldId === id) return; if (holder.item) holder.item.parent.remove(holder.item); holder.item = null; holder.heldId = id;
    if (id < 0 || !items[id]) return; const obj = makeItemObject(id, renderer, 0.3);
    const grp = new THREE.Group(); grp.add(obj); grp.position.set(-1 / 16, -10 / 16, -2 / 16);
    if (obj.userData.cube) { obj.scale.setScalar(0.75); grp.rotation.set(0.35, 0.78, 0); grp.position.y -= 1 / 16; } else { grp.rotation.set(0, Math.PI / 2, -Math.PI / 4 - 0.5); grp.position.z -= 2 / 16; }
    m.parts.armR.add(grp); holder.item = grp;
  }
  update(pt, daySub) {
    const g = this.g, p = g.player; const show = !!(p && g.thirdPerson && !p.dead);
    if (!show) { if (this.model) this.model.root.visible = false; if (this.shadow) this.shadow.visible = false; return; }
    const m = this._ensure(); m.root.visible = true; const L = (a, b) => a + (b - a) * pt;
    const x = L(p.px, p.x), y = L(p.py, p.y), z = L(p.pz, p.z); m.root.position.set(x, y - (p.sneak ? 0.125 : 0), z); updateShadow(this, g.renderer, g.world, x, y, z, 0.4);
    // body turns toward where you walk and never lags more than ~50 degrees behind the head
    const sp = Math.hypot(p.x - p.px, p.z - p.pz); this.amt += (Math.min(1, sp * 4) - this.amt) * 0.15;
    if (p.riding) this.bodyYaw = p.riding.yaw; else if (sp > 0.01) this.bodyYaw += angDiff(this.bodyYaw, p.yaw) * 0.25;
    let d = angDiff(this.bodyYaw, p.yaw); if (Math.abs(d) > 0.87) { this.bodyYaw = p.yaw - Math.sign(d) * 0.87; d = angDiff(this.bodyYaw, p.yaw); }
    m.root.rotation.set(0, this.bodyYaw, 0);
    const held = p.inv.held; this._held(m, this, held ? held.id : -1, g.renderer);
    pose(m, { headYaw: d, pitch: p.pitch, limb: L(p.pWalkDist, p.walkDist) * 6.7, amt: p.flying || p.riding ? 0 : this.amt, sitting: !!p.riding, sneak: p.sneak && !p.flying, swing: p.swing > 0 ? 1 - (p.swing - pt) / 6 : 0, holding: !!held });
    const l = lightCurve(g.world, Math.floor(x), Math.floor(y + 1), Math.floor(z), daySub); const red = p.hurtTime > 0;
    m.mat.color.setRGB(l, red ? l * 0.45 : l, red ? l * 0.45 : l); updateArmor(m, p.inv, l, red);
  }
  clear() { if (this.model) this.model.root.visible = false; }
}

// ---------- inventory preview: a tiny separate WebGL canvas drawn into the GUI ----------
let prev = null;
function preview() {
  if (prev) return prev;
  const cv = document.createElement('canvas'); const gl = new THREE.WebGLRenderer({ canvas: cv, alpha: true, antialias: false, preserveDrawingBuffer: true });
  gl.setClearColor(0x000000, 0); const scene = new THREE.Scene(); const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, -10, 10);
  const model = buildModel('steve'); scene.add(model.root); Skins.apply(model.mat, Skins.current); updateDeadmau5Ears(model, Skins.hasDeadmau5Ears); Skins.onChange((s, ears) => { Skins.apply(model.mat, s); updateDeadmau5Ears(model, ears); });
  return prev = { cv, gl, scene, cam, model, heldId: -1, item: null };
}
// draws the player in a w x h GUI-pixel box at (x, y); feet sit at the box bottom, model faces the mouse
export function drawPlayerPreview(ctx, game, x, y, w, h, mx, my, scale) {
  const v = preview(); const p = game.player;
  const S = 30; // GUI pixels per block, like the classic inventory
  const px = Math.max(1, Math.round(w * scale)), py = Math.max(1, Math.round(h * scale));
  if (v.cv.width !== px || v.cv.height !== py) v.gl.setSize(px, py, false);
  const cy = (h - 3) / S; v.cam.left = -w / 2 / S; v.cam.right = w / 2 / S; v.cam.top = cy; v.cam.bottom = cy - h / S; v.cam.position.set(0, 0, 5); v.cam.updateProjectionMatrix();
  const dx = (x + w / 2) - mx, dy = (y + h - 3 - 50) - my;
  updateDeadmau5Ears(v.model, Skins.hasDeadmau5Ears);
  v.model.root.rotation.set(0, Math.PI - Math.atan(dx / 40) * 0.35, 0); // face the viewer
  const held = p ? p.inv.held : null; PlayerModel.prototype._held(v.model, v, held ? held.id : -1, game.renderer);
  pose(v.model, { headYaw: -Math.atan(dx / 40) * 0.35, pitch: Math.atan(dy / 40) * 0.35, limb: 0, amt: 0, sneak: false, swing: 0, holding: !!held });
  v.model.mat.color.setRGB(1, 1, 1); updateArmor(v.model, p && p.inv);
  v.gl.render(v.scene, v.cam);
  ctx.save(); ctx.imageSmoothingEnabled = false; ctx.drawImage(v.cv, x, y, w, h); ctx.restore();
}
