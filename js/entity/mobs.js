// Mobs (passive animals + night monsters), projectiles, primed TNT and explosions
import * as THREE from 'three';
import { Entity, makeItemObject, blockCubeGeometry } from './entity.js';
import { buildModel } from './models.js';
import { Boat } from './boat.js';
import { Minecart } from './minecart.js';
import { Spawners } from './spawners.js';
import { raycast, rayBox, boxIntersectsBlocks, applyCurrent } from '../engine/physics.js';
import { blocks as BL, SOLID, OPAQUE, isWater, isLava, isFluid } from '../world/blocks.js';
import { BIOMES } from '../world/gen.js';
import { items } from '../inventory/items.js';
import { applyPotion, potionType, tickEffects, P as POT, SPLASH } from '../inventory/potions.js';
import { updateShadow, clearShadow } from '../engine/shadows.js';

const R = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const WOOL = [[234, 234, 234], [219, 125, 62], [179, 80, 188], [107, 138, 201], [177, 166, 39], [65, 174, 56], [208, 132, 153], [64, 64, 64], [154, 161, 161], [46, 110, 137], [126, 61, 181], [46, 56, 141], [79, 50, 31], [53, 70, 27], [150, 52, 48], [25, 22, 22]];
function sheepColor() { const r = Math.random() * 100; return r < 5 ? 15 : r < 10 ? 7 : r < 15 ? 8 : r < 18 ? 12 : Math.random() < 0.002 ? 6 : 0; }

export const TYPES = {
  pig: { w: 0.9, h: 0.9, hp: 10, speed: 0.45, eye: 0.7, food: 296, seat: 0.2, drops: m => [[m.fire > 0 ? 320 : 319, R(0, 2)], ...(m.saddled ? [[329, 1]] : [])], xp: [1, 3] },
  horse: { w: 1.4, h: 1.6, hp: 22, speed: 0.4, eye: 1.55, food: 322, seat: 0.62, step: 1.05, safeFall: 6, drops: m => [[334, R(0, 2)], ...(m.saddled ? [[329, 1]] : []), ...(m.armor ? [[m.armor, 1]] : []), ...(m.chest ? [[54, 1], ...(m.hinv || []).filter(Boolean).map(s => [s.id, s.count, s.dmg || 0])] : [])], xp: [1, 3] },
  cow: { w: 0.9, h: 1.3, hp: 10, speed: 0.4, eye: 1.2, food: 296, drops: m => [[334, R(0, 2)], [m.fire > 0 ? 364 : 363, R(1, 3)]], xp: [1, 3] },
  sheep: { w: 0.9, h: 1.3, hp: 8, speed: 0.4, eye: 1.1, food: 296, drops: m => m.sheared ? [] : [[35, 1, m.color]], xp: [1, 3] },
  chicken: { w: 0.4, h: 0.7, hp: 4, speed: 0.45, eye: 0.6, food: 295, drops: m => [[288, R(0, 2)], [m.fire > 0 ? 366 : 365, 1]], xp: [1, 3] },
  zombie: { w: 0.6, h: 1.8, hp: 20, speed: 0.5, eye: 1.6, hostile: 1, attack: 4, burns: 1, drops: m => [[367, R(0, 2)], ...(m.killedByPlayer && Math.random() < 0.025 ? [[[265, 391, 392][R(0, 2)], 1]] : [])], xp: [5, 5] },
  skeleton: { w: 0.6, h: 1.8, hp: 20, speed: 0.5, eye: 1.6, hostile: 1, ranged: 1, burns: 1, drops: () => [[262, R(0, 2)], [352, R(0, 2)]], xp: [5, 5] },
  creeper: { w: 0.6, h: 1.7, hp: 20, speed: 0.5, eye: 1.5, hostile: 1, drops: () => [[289, R(0, 2)]], xp: [5, 5] },
  villager: { w: 0.6, h: 1.95, hp: 20, speed: 0.4, eye: 1.62, npc: 1, drops: () => [], xp: [0, 0] },
  iron_golem: { w: 1.4, h: 2.7, hp: 100, speed: 0.32, eye: 2.4, npc: 1, heavy: 1, noFall: 1, drops: () => [[265, R(3, 5)], [38, R(0, 2)]], xp: [0, 0] },
  spider: { w: 1.4, h: 0.9, hp: 16, speed: 0.7, eye: 0.65, hostile: 1, attack: 2, climbs: 1, spider: 1, drops: m => [[287, R(0, 2)], ...(m.killedByPlayer && Math.random() < 0.33 ? [[375, 1]] : [])], xp: [5, 5] },
  cave_spider: { w: 0.7, h: 0.5, hp: 12, speed: 0.75, eye: 0.45, hostile: 1, attack: 2, climbs: 1, spider: 1, scale: 0.7, drops: m => [[287, R(0, 2)], ...(m.killedByPlayer && Math.random() < 0.33 ? [[375, 1]] : [])], xp: [5, 5] },
  silverfish: { w: 0.3, h: 0.4, hp: 8, speed: 0.6, eye: 0.2, hostile: 1, attack: 1, drops: () => [], xp: [5, 5] },
  slime: { w: 0.6, h: 0.6, hp: 1, speed: 0, eye: 0.4, hostile: 1, cube: 1, drops: m => m.size === 1 ? [[341, R(0, 2)]] : [], xp: [1, 4] },
  magma_cube: { w: 0.6, h: 0.6, hp: 1, speed: 0, eye: 0.4, hostile: 1, cube: 1, fireproof: 1, bright: 1, drops: m => m.size > 1 && Math.random() < 0.3 ? [[378, 1]] : [], xp: [1, 4] },
  ghast: { w: 4, h: 4, hp: 10, speed: 0, eye: 2.6, hostile: 1, flies: 1, fireproof: 1, scale: 4.5, drops: () => [[289, R(0, 2)], [370, R(0, 1)]], xp: [5, 5] },
  blaze: { w: 0.6, h: 1.8, hp: 20, speed: 0.4, eye: 1.6, hostile: 1, fireproof: 1, noFall: 1, bright: 1, drops: m => m.killedByPlayer ? [[369, R(0, 1)]] : [], xp: [10, 10] },
  zombie_pigman: { w: 0.6, h: 1.8, hp: 20, speed: 0.5, eye: 1.6, neutral: 1, fireproof: 1, attack: 5, drops: () => [[367, R(0, 1)], [371, R(0, 1)]], xp: [5, 5] },
  enderman: { w: 0.6, h: 2.9, hp: 40, speed: 0.55, eye: 2.55, neutral: 1, attack: 7, drops: () => [[368, R(0, 1)]], xp: [5, 5] },
  wolf: { w: 0.6, h: 0.8, hp: 8, speed: 0.55, eye: 0.68, neutral: 1, drops: () => [], xp: [1, 3] },
  squid: { w: 0.95, h: 0.95, hp: 10, speed: 0, eye: 0.5, swims: 1, scale: 0.75, drops: () => [], xp: [1, 3] },
  witch: { w: 0.6, h: 1.95, hp: 26, speed: 0.4, eye: 1.62, hostile: 1, ranged: 1, drops: () => { const pool = [348, 331, 353, 289, 375, 280]; const out = []; for (let i = R(1, 3); i > 0; i--) out.push([pool[R(0, pool.length - 1)], R(1, 2)]); return out; }, xp: [5, 5] },
  ocelot: { w: 0.6, h: 0.8, hp: 10, speed: 0.6, eye: 0.6, drops: () => [], xp: [1, 3] },
  bat: { w: 0.5, h: 0.9, hp: 6, speed: 0, eye: 0.45, flies: 1, bat: 1, scale: 0.35, drops: () => [], xp: [0, 0] },
  snowman: { w: 0.7, h: 1.9, hp: 4, speed: 0.4, eye: 1.7, npc: 1, drops: () => [[332, R(0, 15)]], xp: [0, 0] },
  wither_skeleton: { w: 0.72, h: 2.16, hp: 20, speed: 0.5, eye: 1.9, hostile: 1, attack: 7, fireproof: 1, scale: 1.2, drops: () => [[263, R(-1, 1)], [352, R(0, 2)]], xp: [5, 5] },
  mooshroom: { w: 0.9, h: 1.3, hp: 10, speed: 0.4, eye: 1.2, food: 296, drops: m => [[334, R(0, 2)], [m.fire > 0 ? 364 : 363, R(1, 3)]], xp: [1, 3] },
};
const MEAT = [319, 320, 363, 364, 365, 366, 367];
const PROFS = ['farmer', 'librarian', 'priest', 'villager', 'butcher', 'smith'];
const COATS = [[1, 1, 1], [0.93, 0.8, 0.6], [0.78, 0.48, 0.27], [0.56, 0.37, 0.22], [0.26, 0.23, 0.22], [0.56, 0.56, 0.56], [0.36, 0.23, 0.14]];
const SADDLE_PARTS = ['saddle', 'saddleBack', 'girth', 'stirR', 'stirL', 'bridle', 'saddleStrap'];
const HORSE_FOOD = { 296: [2, 3], 353: [1, 3], 260: [3, 3], 322: [10, 10], 396: [4, 5], 391: [2, 3] }; // [heal, temper]
const HORSE_BREED = new Set([322, 396]);
const FENCES = new Set([85, 113]);
const ROPE_N = 20; const ropeMat = new THREE.LineBasicMaterial({ color: 0x5a3c1e }); const knotMat = new THREE.MeshBasicMaterial({ color: 0x8a6438 }); const knotGeo = new THREE.BoxGeometry(6 / 16, 8 / 16, 6 / 16);
function nameSprite(name) { const c = document.createElement('canvas'); const ctx = c.getContext('2d'); const fs = 32; ctx.font = fs + 'px monospace';
  const w = Math.ceil(ctx.measureText(name).width) + 16; c.width = w; c.height = fs + 12; ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(0, 0, w, c.height); ctx.font = fs + 'px monospace'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff'; ctx.fillText(name, 8, c.height / 2 + 1);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false })); s.scale.set(0.3 * w / c.height, 0.3, 1); s.renderOrder = 2; return s; }
// stats for a new horse (kind h horse, d donkey, m mule); foals average their parents' with some spread
function horseStats(m, kind, a, b) { m.kind = kind; const mix = (k, lo, hi) => a && b ? Math.max(lo, Math.min(hi, (a[k] + b[k]) / 2 + (Math.random() - 0.5) * (hi - lo) * 0.3)) : lo + Math.random() * (hi - lo);
  if (kind === 'h') { m.jumpS = mix('jumpS', 0.45, 0.9); m.speedS = mix('speedS', 2.2, 3.5); m.maxHp = Math.round(mix('maxHp', 15, 30)); } else { m.jumpS = 0.5; m.speedS = kind === 'm' ? mix('speedS', 2.2, 2.9) : 2.1; m.maxHp = kind === 'm' ? Math.round(mix('maxHp', 15, 30)) : Math.round(mix('maxHp', 15, 30)); }
  m.hp = m.maxHp; }
const HORSE_ARMOR = { 417: 0.8, 418: 0.72, 419: 0.56 };
const _coat = new THREE.Color();
const ANIMALS = [['sheep', 12], ['pig', 10], ['chicken', 10], ['cow', 8]];
const MONSTERS = [['zombie', 10], ['skeleton', 10], ['spider', 10], ['creeper', 10], ['witch', 2]];
const NETHER_MOBS = [['zombie_pigman', 10], ['ghast', 3], ['magma_cube', 2], ['wither_skeleton', 2]];
const pick = list => { let t = list.reduce((a, b) => a + b[1], 0) * Math.random(); for (const [k, w] of list) if ((t -= w) < 0) return k; return list[0][0]; };
const angDiff = (a, b) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };

export class Mob extends Entity {
  constructor(world, type, x, y, z) {
    super(world, x, y, z); this.type = type; this.T = TYPES[type]; this.w = this.T.w; this.h = this.T.h; this.hp = this.T.hp; this.mob = true; this.hostile = !!this.T.hostile;
    this.hurtTime = 0; this.invuln = 0; this.lastDmg = 0; this.deathTime = 0; this.yaw = this.pyaw = Math.random() * Math.PI * 2; this.headYaw = this.yaw; this.pHeadYaw = this.yaw; this.headPitch = 0;
    this.limb = 0; this.pLimb = 0; this.limbAmt = 0; this.pLimbAmt = 0; this.wander = null; this.wanderT = 0; this.panic = 0; this.fire = 0; this.fuse = 0; this.pFuse = 0; this.attackCD = 0; this.idle = 0; this.love = 0; this.ageT = 0; this.aggro = false;
    this.angry = 0; this.attackAnim = 0; this.pAttackAnim = 0; this.target = null; if (this.T.cube) this.setSize([1, 2, 4][R(0, 2)]); this.squish = 0; this.pSquish = 0; this.jumpDelay = R(10, 30); this.atk = 0; if (type === 'villager') this.prof = PROFS[R(0, PROFS.length - 1)]; if (type === 'sheep') this.color = sheepColor(); if (type === 'horse') { this.color = R(0, COATS.length - 1); this.mark = R(0, 4); this.temper = 0; horseStats(this, Math.random() < 0.12 ? 'd' : 'h'); this.chest = false; this.jumpCharge = 0; } if (type === 'chicken') this.eggT = R(6000, 12000);
  }
  get baby() { return this.ageT < 0; }
  setSize(n) { this.size = n; this.w = this.h = 0.6 * n; this.hp = n * n; }
  toJSON() { return { t: this.type, x: this.x, y: this.y, z: this.z, yaw: this.yaw, hp: this.hp, color: this.color, sheared: this.sheared, saddled: this.saddled, age: this.ageT, prof: this.prof, home: this.home, tame: this.tame, sit: this.sitting, temper: this.temper, jumpS: this.jumpS, speedS: this.speedS, armor: this.armor, maxHp: this.maxHp, kind: this.kind, mark: this.mark, chest: this.chest, hinv: this.hinv, name: this.nameTag, offers: this.offers, lf: this.leash && this.leash.fence ? [this.leash.x, this.leash.y, this.leash.z] : undefined, lp: this.leash && !this.leash.fence ? 1 : undefined }; }
  box() { const hw = this.w / 2; return [this.x - hw, this.y, this.z - hw, this.x + hw, this.y + this.h, this.z + hw]; }
  hurt(n, src, attacker, g) {
    if (this.deathTime) return false;
    if (this.T.fireproof && (src === 'fire' || src === 'lava')) return false;
    if (this.type === 'enderman' && src === 'arrow') { this.teleport(g); return false; }
    if (this.invuln > 10) { if (n <= this.lastDmg) return false; const d = n - this.lastDmg; this.lastDmg = n; n = d; } else { this.lastDmg = n; this.invuln = 20; this.hurtTime = 10; }
    if (this.armor && HORSE_ARMOR[this.armor] && src !== 'fall') n = Math.max(1, Math.round(n * HORSE_ARMOR[this.armor]));
    this.hp -= n; g.sound('mob:' + (this.type === 'horse' ? 'horse_hurt' : this.type), this, 0.8, 1.15);
    if (attacker && attacker.mob && (this.hostile || this.T.neutral) && !(attacker.type === 'wolf' && this.type === 'wolf')) this.target = attacker;
    if (attacker === g.player) this.provoke(g);
    if (this.type === 'enderman' && Math.random() < 0.25) this.teleport(g);
    if (attacker === g.player && this.T.npc) for (const o of g.mobs.mobs) if (o.type === 'iron_golem' && !o.deathTime && Math.abs(o.x - this.x) < 24 && Math.abs(o.z - this.z) < 24) { o.angry = 600; o.target = g.player; }
    if (attacker && !this.T.heavy) { const dx = this.x - attacker.x, dz = this.z - attacker.z, d = Math.hypot(dx, dz) || 1; this.mx = this.mx / 2 + dx / d * 0.4; this.mz = this.mz / 2 + dz / d * 0.4; this.my = Math.min(0.4, this.my / 2 + 0.4); if (attacker === g.player) { this.killedByPlayer = true; this.aggro = true; } } else if (attacker === g.player) this.killedByPlayer = true;
    if (!this.hostile && !this.T.heavy && !this.T.neutral) this.panic = 60;
    if (this.hp <= 0) this.die(g, src);
    return true;
  }
  die(g, src) {
    this.deathTime = 1; this.hp = 0; if (this.rider) this.dismount(); if (this.leash) this.unleash(g, true);
    if (this.T.cube && this.size > 1) for (let i = R(2, 4); i > 0; i--) { const c = g.mobs.spawn(this.type, this.x + (Math.random() - 0.5) * this.size / 2, this.y + 0.5, this.z + (Math.random() - 0.5) * this.size / 2); c.setSize(this.size / 2); }
    if (this.killedByPlayer || src === 'player' || src === 'arrow') {
      for (const [id, n, dmg] of this.T.drops(this)) if (n > 0) g.spawnDrop(this.x, this.y + 0.5, this.z, { id, count: n, dmg: dmg || 0 });
      if (!this.baby && this.T.xp[1] > 0) g.spawnXP(this.x, this.y + 0.5, this.z, R(...this.T.xp)); g.achievements.onKill(this);
      if (src === 'arrow' && this.type === 'skeleton' && Math.hypot(this.x - g.player.x, this.z - g.player.z) > 50) g.achievements.unlock('snipeSkeleton');
    } else for (const [id, n, dmg] of this.T.drops(this)) if (n > 0) g.spawnDrop(this.x, this.y + 0.5, this.z, { id, count: n, dmg: dmg || 0 });
  }
  canSee(p) { const ex = this.x, ey = this.y + this.T.eye, ez = this.z; const dx = p.x - ex, dy = p.eyeY - ey, dz = p.z - ez; const d = Math.hypot(dx, dy, dz); if (d < 0.01) return true; const h = raycast(this.world, ex, ey, ez, dx / d, dy / d, dz / d, d); return !h; }
  tick(g, mgr) {
    this.baseTick(); this.pHeadYaw = this.headYaw; this.pLimb = this.limb; this.pLimbAmt = this.limbAmt; this.pFuse = this.fuse; this.pSquish = this.squish; this.squish *= 0.6; this.pAttackAnim = this.attackAnim; if (this.attackAnim > 0) this.attackAnim--;
    if (this.hurtTime > 0) this.hurtTime--; if (this.invuln > 0) this.invuln--; if (this.attackCD > 0) this.attackCD--;
    if (this.deathTime) { if (++this.deathTime >= 20) { this.dead = true; for (let i = 0; i < 10; i++) g.particles.fx('smoke', this.x + (Math.random() - 0.5) * this.w, this.y + Math.random() * this.h, this.z + (Math.random() - 0.5) * this.w); } this.physics(g, 0, 0, false); return; }
    if (this.ageT < 0) this.ageT++; else if (this.ageT > 0) this.ageT--; if (this.love > 0) { this.love--; if (this.love % 10 === 0) g.particles.fx('heart', this.x, this.y + this.h + 0.3, this.z); }
    if (this.rider && (this.rider.dead || this.rider.riding !== this)) this.rider = null;
    if (this.rider) { this.rideTick(g); return; }
    const pull = this.leash ? this.leashTick(g) : null;
    const p = g.player; const dx = p.x - this.x, dz = p.z - this.z, dist = Math.hypot(dx, p.y - this.y, dz);
    let fx = 0, fz = 0, jump = false, spd = this.T.speed, lookAt = null;
    // daylight burning
    const bx = Math.floor(this.x), by = Math.floor(this.y + this.T.eye), bz = Math.floor(this.z);
    const daySub = g.renderer.uniforms.daySub.value;
    if (this.T.burns && daySub < 4 && this.world.getSky(bx, by, bz) >= 15 && !this.inWater() && Math.random() < 0.3) this.fire = Math.max(this.fire, 160);
    const chase = this.hostile && !p.dead && !p.creative && dist < 16 && (!this.T.spider || this.aggro || Math.max(this.world.getSky(bx, by, bz) - daySub, this.world.getBlockLight(bx, by, bz)) < 8);
    const ai = this.pickAI(g, mgr, p, dist, chase);
    if (ai) { fx = ai[0]; fz = ai[1]; lookAt = ai[2]; spd *= ai[3] ?? 1; }
    else if (chase && (dist < 6 || this.age % 10 === 0 ? (this.seeP = this.canSee(p)) : this.seeP)) {
      lookAt = p; const hd = Math.hypot(dx, dz) || 1;
      if (this.type === 'witch') { // keeps its distance and lobs splash potions of harming
        if (dist > 8) { fx = dx / hd; fz = dz / hd; } else if (dist < 5) { fx = -dx / hd * 0.6; fz = -dz / hd * 0.6; }
        if (this.attackCD <= 0 && dist < 10) { this.attackCD = 60; mgr.throwPotion(this, p, (dist > 6 && !p.effects?.slowness ? POT.slowness : Math.random() < 0.25 && !p.effects?.poison ? POT.poison : POT.harming) | SPLASH); }
      } else if (this.type === 'skeleton') {
        if (dist > 7) { fx = dx / hd; fz = dz / hd; } else if (dist < 4) { fx = -dx / hd * 0.6; fz = -dz / hd * 0.6; }
        if (this.attackCD <= 0 && dist < 10) { this.attackCD = 60; mgr.spawnArrow(this, p.x, p.eyeY - 0.3, p.z, 1.6, 12); g.sound('bow', this, 1, 1 / (Math.random() * 0.4 + 0.8)); }
      } else if (this.type === 'creeper') {
        if (dist < 3) { if (this.fuse === 0) g.sound('fuse', this, 1, 0.5); this.fuse++; } else { fx = dx / hd; fz = dz / hd; if (dist > 7 && this.fuse > 0) this.fuse--; }
        if (this.fuse >= 30) { this.dead = true; mgr.explode(this.x, this.y + 0.5, this.z, 3, this); return; }
      } else {
        fx = dx / hd; fz = dz / hd;
        if (this.T.spider && this.onGround && dist > 2 && dist < 6 && Math.random() < 0.1) { this.mx = dx / hd * 0.4 + this.mx * 0.2; this.mz = dz / hd * 0.4 + this.mz * 0.2; this.my = 0.4; }
        const bb = this.box(); if (this.attackCD <= 0 && p.x + 0.3 > bb[0] - 0.4 && p.x - 0.3 < bb[3] + 0.4 && p.z + 0.3 > bb[2] - 0.4 && p.z - 0.3 < bb[5] + 0.4 && p.y < bb[4] && p.y + p.h > bb[1]) {
          this.attackCD = 20; const diff = g.settings.difficulty; let dmg = this.T.attack; dmg = diff === 1 ? Math.floor(dmg / 2) + 1 : diff === 3 ? Math.floor(dmg * 3 / 2) : dmg;
          if (p.damage(dmg, 'mob')) { const d = hd; p.mx += dx / d * 0.4; p.mz += dz / d * 0.4; p.my = Math.max(p.my, 0.3); mgr.playerHurtBy(this); }
        }
      }
    } else {
      if (this.fuse > 0) this.fuse--;
      if (this.panic > 0) { this.panic--; spd = this.T.speed * 2; if (!this.wander || this.age % 20 === 0) { const a = Math.random() * Math.PI * 2; this.wander = [this.x + Math.sin(a) * 8, this.z + Math.cos(a) * 8]; } }
      else if (this.love > 0 || (this.ageT < 0 && Math.random() < 0.5)) { // seek partner / parent
        const m = mgr.mobs.find(o => o !== this && o.type === this.type && !o.deathTime && (this.love > 0 ? o.love > 0 : o.ageT >= 0) && Math.abs(o.x - this.x) < 8 && Math.abs(o.z - this.z) < 8);
        if (m) { this.wander = [m.x, m.z]; lookAt = m; if (this.love > 0 && Math.hypot(m.x - this.x, m.z - this.z) < 1.5 && this.ageT === 0 && m.ageT === 0) { this.love = m.love = 0; this.ageT = m.ageT = 6000; const b = mgr.spawn(this.type, this.x, this.y, this.z); b.ageT = -24000; if (this.type === 'horse') { horseStats(b, (this.kind || 'h') === (m.kind || 'h') ? this.kind || 'h' : 'm', this, m); b.mark = Math.random() < 0.5 ? this.mark : m.mark; } if (b.color !== undefined) b.color = Math.random() < 0.5 ? this.color : m.color; for (let i = 0; i < 7; i++) g.particles.fx('heart', this.x + Math.random() - 0.5, this.y + 0.8, this.z + Math.random() - 0.5); } }
      }
      else if (!this.wander && Math.random() < 1 / 120) { const a = Math.random() * Math.PI * 2, r = 2 + Math.random() * 8; this.wander = [this.x + Math.sin(a) * r, this.z + Math.cos(a) * r]; this.wanderT = 120; }
      if (!this.hostile && dist < 8 && !this.panic && p.inv.held && p.inv.held.id === this.T.food) { this.wander = [p.x, p.z]; lookAt = p; spd *= 0.8; }
      else if (!lookAt && dist < 6 && Math.random() < 0.02) this.lookP = 40;
      if (this.lookP > 0) { this.lookP--; lookAt = lookAt || p; }
      if (this.wander) { const wx = this.wander[0] - this.x, wz = this.wander[1] - this.z, wd = Math.hypot(wx, wz); if (wd < 1 || --this.wanderT < -200) this.wander = null; else { fx = wx / wd; fz = wz / wd; } if (this.panic <= 0 && this.love <= 0 && --this.wanderT < 0 && wd < 1.5) this.wander = null; }
      if (this.type === 'chicken' && this.ageT >= 0 && --this.eggT <= 0) { this.eggT = R(6000, 12000); g.spawnDrop(this.x, this.y + 0.2, this.z, { id: 344, count: 1, dmg: 0 }); g.sound('pop', this, 1, 1); }
    }
    if (this.fuse > 0) fx = fz = 0;
    if ((fx || fz) && this.hcol && this.onGround) jump = true;
    if ((this.inWater() || this.inLava()) && !this.T.swims) jump = true;
    // ambient noise
    if (Math.random() < 1 / 400) g.sound('mob:' + this.type, this, 0.6, this.baby ? 1.5 : 1);
    // body / head orientation
    if (fx || fz) { const ty = Math.atan2(-fx, -fz); this.yaw += Math.max(-0.35, Math.min(0.35, angDiff(this.yaw, ty))); }
    if (lookAt) { const lx = lookAt.x - this.x, lz = lookAt.z - this.z; const ly = (lookAt.eyeY ?? (lookAt.y + lookAt.h * 0.85)) - (this.y + this.T.eye); this.headYaw = this.headYaw + angDiff(this.headYaw, Math.atan2(-lx, -lz)) * 0.4; this.headPitch = Math.atan2(-ly, Math.hypot(lx, lz)); }
    else { this.headYaw += angDiff(this.headYaw, this.yaw) * 0.3; this.headPitch *= 0.8; }
    const hd = angDiff(this.yaw, this.headYaw); if (Math.abs(hd) > 1.2) this.headYaw = this.yaw + Math.sign(hd) * 1.2;
    this.physics(g, fx * spd, fz * spd, jump);
  }
  // ---- leads: tied to the player or a fence; pulled along past 6 blocks, snapped past 10 ----
  leashHolder() { const l = this.leash; return l.fence ? [l.x + 0.5, l.y + 0.6, l.z + 0.5] : [l.x, l.y + (l.h || 1.8) * 0.55, l.z]; }
  leashTick(g) { const l = this.leash;
    if (l.fence ? !FENCES.has(this.world.getBlock(l.x, l.y, l.z)) : (l.dead || l !== g.player)) { this.unleash(g, true); return null; }
    const [hx, hy, hz] = this.leashHolder(), dx = hx - this.x, dy = hy - this.y, dz = hz - this.z, d = Math.hypot(dx, dy, dz);
    if (d > 10) { this.unleash(g, true); return null; }
    if (d > 6) { const k = (d - 6) * 0.04 / d; this.mx += dx * k; this.mz += dz * k; if (dy > 0) this.my += dy * k * 0.5; }
    if (d > 2.5) { this.wander = [hx, hz]; this.wanderT = 40; this.sitting = false; }
    return d; }
  unleash(g, drop) { const l = this.leash; if (!l) return; this.leash = null; if (drop) g.spawnDrop(this.x, this.y + 0.5, this.z, { id: 420, count: 1, dmg: 0 }); }
  // ---- riding (horses, saddled pigs); same interface as Boat ----
  rideTick(g) {
    const p = this.rider, inp = g.input; this.wander = null; this.panic = 0; this.rear = this.onGround ? 0 : this.rear * 0.9;
    if (inp.sneak) { this.dismount(); this.physics(g, 0, 0, false); return; }
    let fx = 0, fz = 0, spd = this.T.speed;
    if (this.type === 'horse' && !this.tame) { // rodeo: it runs and rears until it accepts you or throws you off
      this.rear = Math.max(0, Math.sin(this.age * 0.3)) * 0.55; const a = this.yaw + Math.sin(this.age * 0.17) * 0.9; fx = -Math.sin(a) * 0.6; fz = -Math.cos(a) * 0.6; spd = 1.6;
      if (--this.buckT <= 0) {
        if (R(0, 99) < (this.temper || 0)) { this.tame = true; this.rear = 0; for (let i = 0; i < 7; i++) g.particles.fx('heart', this.x + Math.random() - 0.5, this.y + this.h + 0.3, this.z + Math.random() - 0.5); g.sound('mob:horse', this, 1, 1.15); }
        else { this.temper = Math.min(100, (this.temper || 0) + 5); for (let i = 0; i < 7; i++) g.particles.fx('smoke', this.x + Math.random() - 0.5, this.y + this.h + 0.3, this.z + Math.random() - 0.5); g.sound('mob:horse', this, 1.2, 0.8); this.dismount(); p.my = 0.35; this.my = 0.35; this.physics(g, 0, 0, false); return; }
      }
    } else if (this.type === 'horse' && this.saddled) { // steered by the rider
      this.yaw += angDiff(this.yaw, p.yaw) * 0.5; const fw = (inp.forward ? 1 : 0) - (inp.back ? 0.25 : 0), st = (inp.left ? 0.5 : 0) - (inp.right ? 0.5 : 0);
      const s = Math.sin(p.yaw), c = Math.cos(p.yaw); fx = -s * fw - c * st; fz = -c * fw + s * st; spd = this.speedS || 2.8;
      // hold jump to charge (the HUD shows the bar), release to leap
      if (inp.jump && this.onGround && !this.inWater()) this.jumpCharge = Math.min(1, (this.jumpCharge || 0) + 0.1);
      else if (this.jumpCharge > 0) { if (this.onGround && !inp.jump) { const pw = Math.max(0.4, this.jumpCharge); this.my = (this.jumpS || 0.6) * pw; const k = 0.3 * fw * pw; this.mx -= s * k; this.mz -= c * k; g.sound('mob:horse', this, 0.25, 1.6); this.rear = 0.25 * pw; } this.jumpCharge = 0; }
    } else if (this.type === 'pig') { // no carrot on a stick: it ambles where it likes
      if (!this.rideDir || Math.random() < 0.02) this.rideDir = Math.random() < 0.3 ? null : this.yaw + (Math.random() - 0.5) * 2;
      if (this.rideDir != null) { fx = -Math.sin(this.rideDir); fz = -Math.cos(this.rideDir); }
    }
    if (fx || fz) { if (this.type !== 'horse' || !this.tame) { const ty = Math.atan2(-fx, -fz); this.yaw += Math.max(-0.35, Math.min(0.35, angDiff(this.yaw, ty))); } }
    this.headYaw += angDiff(this.headYaw, this.yaw) * 0.5; this.headPitch *= 0.8;
    const jump = this.type !== 'horse' && (fx || fz) && this.hcol && this.onGround;
    this.physics(g, fx * spd, fz * spd, jump);
    const hs = Math.hypot(this.mx, this.mz); if (this.type === 'horse' && this.onGround && hs > 0.04 && this.age % (hs > 0.2 ? 5 : 8) === 0) g.sound('mob:gallop', this, 0.4, 1);
    if (this.rider) this.seat(this.rider);
  }
  seat(p) { p.x = this.x; p.y = this.y + (this.T.seat || 0.5) - (this.baby ? 0.3 : 0); p.z = this.z; p.mx = p.my = p.mz = 0; p.fall = 0; p.onGround = false; }
  mount(p) { if (this.rider || this.deathTime) return false; this.rider = p; p.riding = this; p.flying = false; p.sneak = false; this.buckT = R(25, 70); this.seat(p); p.px = p.x; p.py = p.y; p.pz = p.z; return true; }
  dismount() { const p = this.rider; if (!p) return; this.rider = null; p.riding = null; this.rear = 0;
    const c = Math.cos(this.yaw), s = Math.sin(this.yaw), d = this.w / 2 + 0.6;
    for (const [ox, oz] of [[c * d, -s * d], [-c * d, s * d], [-s * d * 1.4, -c * d * 1.4], [s * d * 1.4, c * d * 1.4]]) for (const dy of [0, 1]) { const x = this.x + ox, z = this.z + oz, y = Math.floor(this.y) + dy;
      if (p._fits && p._fits(this.world, x, y + 0.01, z)) { p.x = p.px = x; p.y = p.py = y + 0.01; p.z = p.pz = z; return; } }
    p.y = p.py = this.y + this.h + 0.01; }
  pickAI(g, mgr, p, dist, chase) {
    switch (this.type) {
      case 'iron_golem': return this.golemAI(g, mgr, p, dist);
      case 'villager': return this.villagerAI(g, mgr);
      case 'slime': case 'magma_cube': return this.slimeAI(g, mgr, p, dist);
      case 'ghast': return this.ghastAI(g, mgr, p, dist);
      case 'blaze': return this.blazeAI(g, mgr, p, dist);
      case 'squid': return this.squidAI(g);
      case 'enderman': return this.endermanAI(g, mgr, p, dist);
      case 'zombie_pigman': return this.angerAI(g, mgr, p, dist, 1.6);
      case 'wolf': return this.wolfAI(g, mgr, p, dist);
      case 'ocelot': return this.ocelotAI(g, mgr, p, dist);
      case 'bat': return this.batAI(g, p, dist);
      case 'snowman': return this.snowmanAI(g, mgr);
    }
    return this.T.attack && this.hostile ? this.mobFightAI(g, mgr, p, dist, chase) : null;
  }
  // a player hit this mob: neutral mobs (and their friends) get angry
  provoke(g) {
    const near = (o, r) => o !== this && o.type === this.type && !o.deathTime && Math.abs(o.x - this.x) < r && Math.abs(o.z - this.z) < r;
    if (this.type === 'zombie_pigman') { this.angry = R(400, 800); for (const o of g.mobs.mobs) if (near(o, 32)) o.angry = R(400, 800); }
    if (this.type === 'enderman') this.angry = 1200;
    if (this.type === 'wolf' && !this.tame) { this.angry = 1e9; this.sitting = false; for (const o of g.mobs.mobs) if (near(o, 16) && !o.tame) o.angry = 1e9; }
  }
  teleport(g, tx, tz) {
    const w = this.world, hw = this.w / 2;
    for (let i = 0; i < 24; i++) {
      const x = Math.floor((tx ?? this.x) + (Math.random() - 0.5) * (tx !== undefined ? 8 : 32)), z = Math.floor((tz ?? this.z) + (Math.random() - 0.5) * (tx !== undefined ? 8 : 32)); let y = Math.floor(this.y) + R(-8, 8);
      if (!w.isLoaded(x, z)) continue; while (y > 1 && !SOLID[w.getBlock(x, y - 1, z)]) y--;
      if (!SOLID[w.getBlock(x, y - 1, z)] || isFluid(w.getBlock(x, y, z)) || boxIntersectsBlocks(w, x + 0.5 - hw, y, z + 0.5 - hw, x + 0.5 + hw, y + this.h, z + 0.5 + hw)) continue;
      for (let k = 0; k < 16; k++) g.particles.fx('smoke', this.x + (Math.random() - 0.5), this.y + Math.random() * this.h, this.z + (Math.random() - 0.5));
      this.x = this.px = x + 0.5; this.y = this.py = y; this.z = this.pz = z + 0.5; this.mx = this.my = this.mz = 0; g.sound('mob:enderman', this, 1, 1.4); return true;
    }
    return false;
  }
  melee(g, mgr, t, dmg) {
    if (this.attackCD > 0) return false; const p = g.player; const dx = t.x - this.x, dz = t.z - this.z, hd = Math.hypot(dx, dz) || 1;
    if (hd > this.w / 2 + (t.w || 0.6) / 2 + 0.6 || t.y > this.y + this.h || t.y + (t.h || 1.8) < this.y) return false;
    this.attackCD = 20;
    if (t === p) { const diff = g.settings.difficulty; const d = diff === 0 ? 0 : diff === 1 ? Math.floor(dmg / 2) + 1 : diff === 3 ? Math.floor(dmg * 3 / 2) : dmg; if (d > 0 && p.damage(d, 'mob')) { p.mx += dx / hd * 0.4; p.mz += dz / hd * 0.4; p.my = Math.max(p.my, 0.3); mgr.playerHurtBy(this); } }
    else t.hurt(dmg, 'mob', this, g);
    return true;
  }
  chaseMelee(g, mgr, t, dmg, spd = 1) { const dx = t.x - this.x, dz = t.z - this.z, hd = Math.hypot(dx, dz) || 1; this.melee(g, mgr, t, dmg); return [dx / hd, dz / hd, t, spd]; }
  validTarget(g, t, r = 32) { const p = g.player; if (!t || t.dead || t.deathTime) return false; if (t === p && (p.dead || p.creative)) return false; return Math.hypot(t.x - this.x, t.z - this.z) < r; }
  // neutral fighters (zombie pigmen): attack while angry or when a mob hurt them
  angerAI(g, mgr, p, dist, spd) {
    if (this.angry > 0) this.angry--;
    if (!this.validTarget(g, this.target)) this.target = null;
    const t = this.target || (this.angry > 0 && this.validTarget(g, p) ? p : null); if (!t) return null;
    return this.chaseMelee(g, mgr, t, this.T.attack, spd);
  }
  endermanAI(g, mgr, p, dist) {
    if (this.inWater() && this.age % 10 === 0) { this.hurt(1, 'water', null, g); this.teleport(g); }
    if (this.angry <= 0 && this.age % 5 === 0 && !p.dead && !p.creative && dist < 64) { // being stared at
      const lx = -Math.sin(p.yaw) * Math.cos(p.pitch), ly = Math.sin(p.pitch), lz = -Math.cos(p.yaw) * Math.cos(p.pitch);
      const vx = this.x - p.x, vy = this.y + 2.55 - p.eyeY, vz = this.z - p.z, vl = Math.hypot(vx, vy, vz) || 1;
      if ((lx * vx + ly * vy + lz * vz) / vl > 1 - 0.025 / vl && this.canSee(p)) { this.angry = 1200; g.sound('mob:enderman', this, 1, 0.8); }
    }
    if (this.angry > 0 && this.validTarget(g, p, 48)) {
      this.angry--; if (dist > 16 && Math.random() < 0.03) this.teleport(g, p.x, p.z);
      return this.chaseMelee(g, mgr, p, this.T.attack, 1.5);
    }
    if (this.angry > 0) this.angry--;
    if (Math.random() < 1 / 1200) this.teleport(g);
    return this.angerAI(g, mgr, p, dist, 1.5);
  }
  wolfAI(g, mgr, p, dist) {
    if (!this.validTarget(g, this.target, 24) || (this.tame && this.target === p)) this.target = null;
    if (!this.tame && this.angry > 0 && !this.target && this.validTarget(g, p, 24)) this.target = p;
    if (this.sitting) { this.wander = null; return [0, 0, this.target || (dist < 8 ? p : null), 0]; }
    if (this.target) return this.chaseMelee(g, mgr, this.target, this.tame ? 4 : 2, 1.6);
    if (this.tame && !p.dead) {
      if (dist > 12 && p.onGround) this.teleport(g, p.x, p.z);
      if (dist > 3.5) { const dx = p.x - this.x, dz = p.z - this.z, hd = Math.hypot(dx, dz) || 1; this.wander = null; return [dx / hd, dz / hd, p, 1.5]; }
    }
    if (!this.tame && dist < 8 && p.inv.held && p.inv.held.id === 352) return [0, 0, p, 0];
    return null;
  }
  // wild ocelots shy away unless you creep up holding fish; tamed cats follow and sit like wolves
  ocelotAI(g, mgr, p, dist) {
    if (this.sitting) { this.wander = null; return [0, 0, dist < 8 ? p : null, 0]; }
    if (this.tame && !p.dead) { if (dist > 12 && p.onGround) this.teleport(g, p.x, p.z); if (dist > 3.5) { const dx = p.x - this.x, dz = p.z - this.z, hd = Math.hypot(dx, dz) || 1; this.wander = null; return [dx / hd, dz / hd, p, 1.4]; } return null; }
    const lure = p.inv.held && p.inv.held.id === 349;
    if (lure && dist < 10) { if (!p.sneak) return [0, 0, p, 0]; const dx = p.x - this.x, dz = p.z - this.z, hd = Math.hypot(dx, dz) || 1; return dist > 2 ? [dx / hd, dz / hd, p, 0.7] : [0, 0, p, 0]; }
    if (dist < 6 && !p.sneak && !p.creative) { const dx = this.x - p.x, dz = this.z - p.z, hd = Math.hypot(dx, dz) || 1; return [dx / hd, dz / hd, null, 2]; }
    return null; }
  // bats roost upside down under blocks in the dark and flutter about erratically when disturbed
  batAI(g, p, dist) { const w = this.world, bx = Math.floor(this.x), by = Math.floor(this.y), bz = Math.floor(this.z);
    if (this.hanging) { this.mx = this.my = this.mz = 0;
      if (!SOLID[w.getBlock(bx, Math.floor(this.y + this.h + 0.05), bz)] || (dist < 4 && !p.creative) || Math.random() < 1 / 400) { this.hanging = false; this.my = 0.1; }
      return [0, 0, null, 0]; }
    if (!this.wp || Math.random() < 1 / 30 || Math.hypot(this.wp[0] - this.x, this.wp[1] - this.y, this.wp[2] - this.z) < 2) this.wp = [this.x + R(-7, 7), this.y + R(-2, 3), this.z + R(-7, 7)];
    if (this.wp[1] < 1) this.wp[1] = 1;
    const dx = this.wp[0] + 0.5 - this.x, dy = this.wp[1] + 0.1 - this.y, dz = this.wp[2] + 0.5 - this.z;
    this.mx += (Math.sign(dx) * 0.5 - this.mx) * 0.1; this.my += (Math.sign(dy) * 0.7 - this.my) * 0.1; this.mz += (Math.sign(dz) * 0.5 - this.mz) * 0.1;
    this.yaw = Math.atan2(-this.mx, -this.mz);
    if (Math.random() < 0.01 && SOLID[w.getBlock(bx, Math.floor(this.y + this.h + 0.3), bz)]) { this.hanging = true; this.y = Math.floor(this.y + this.h + 0.3) - this.h; }
    if (Math.random() < 1 / 200) g.sound('mob:bat', this, 0.1, 1 + Math.random() * 0.4);
    return [0, 0, null, 0]; }
  // snow golems wander, pelt hostile mobs with snowballs, leave snow where it's cold and melt where it's hot
  snowmanAI(g, mgr) { const w = this.world, bx = Math.floor(this.x), by = Math.floor(this.y), bz = Math.floor(this.z);
    const temp = w.biomeAt && BIOMES[w.biomeAt(bx, bz)] ? BIOMES[w.biomeAt(bx, bz)].temp : 0.5;
    if ((temp > 1 || this.inWater()) && this.age % 20 === 0) this.hurt(1, 'fire', null, g);
    if (temp < 0.8 && this.onGround && !w.getBlock(bx, by, bz) && SOLID[w.getBlock(bx, by - 1, bz)]) w.setBlock(bx, by, bz, 78, 0);
    if (!this.validTarget(g, this.target, 12) || !this.target.hostile) { this.target = null; if (this.age % 20 === 0) this.target = mgr.mobs.find(o => o.hostile && !o.deathTime && Math.hypot(o.x - this.x, o.z - this.z) < 10 && Math.abs(o.y - this.y) < 6) || null; }
    const t = this.target; if (!t) return null;
    if (--this.attackCD <= 0) { this.attackCD = 20; const e = new Projectile(w, 'snowball', this, this.x, this.y + 1.5, this.z, 0, 0, 0); let dx = t.x - this.x, dy = t.y + t.h * 0.6 - this.y - 1.5, dz = t.z - this.z; const hd = Math.hypot(dx, dz); dy += hd * 0.2; const d = Math.hypot(dx, dy, dz) || 1; e.mx = dx / d * 1.6; e.my = dy / d * 1.6; e.mz = dz / d * 1.6; mgr.misc.push(e); g.sound('bow', this, 0.5, 0.4); }
    return [0, 0, t, 0]; }
  slimeAI(g, mgr, p, dist) {
    const t = !p.dead && !p.creative && dist < 16 ? p : null;
    if (this.onGround) {
      if (this.wasAir) { this.squish = -0.5; for (let i = 0; i < this.size * 4; i++) g.particles.fx('smoke', this.x + (Math.random() - 0.5) * this.w, this.y + 0.1, this.z + (Math.random() - 0.5) * this.w); this.wasAir = false; }
      if (--this.jumpDelay <= 0) {
        this.jumpDelay = R(10, 30) / (t ? 3 : 1); const a = t ? Math.atan2(-(p.x - this.x), -(p.z - this.z)) : this.yaw + (Math.random() - 0.5) * 1.5;
        this.yaw = a; const sp = this.type === 'magma_cube' ? 0.28 : 0.2; this.mx = -Math.sin(a) * sp; this.mz = -Math.cos(a) * sp; this.my = this.type === 'magma_cube' ? 0.42 + this.size * 0.05 : 0.42; this.squish = 1;
        if (this.size > 1) g.sound('mob:slime', this, 0.6, 0.8 / Math.sqrt(this.size));
      }
    } else this.wasAir = true;
    if (t && (this.size > 1 || this.type === 'magma_cube')) this.melee(g, mgr, p, this.type === 'magma_cube' ? this.size + 2 : this.size);
    return [0, 0, t, 0];
  }
  ghastAI(g, mgr, p, dist) {
    const w = this.world;
    if (!this.wp || --this.wpT < 0 || Math.hypot(this.wp[0] - this.x, this.wp[1] - this.y, this.wp[2] - this.z) < 2) {
      const ny = this.y + (Math.random() - 0.5) * 16; const wy = w.dim === -1 ? Math.max(36, Math.min(108, ny)) : Math.max(w.topY(Math.floor(this.x), Math.floor(this.z)) + 6, Math.min(120, ny)); this.wp = [this.x + (Math.random() - 0.5) * 32, wy, this.z + (Math.random() - 0.5) * 32]; this.wpT = R(60, 160);
    }
    const dx = this.wp[0] - this.x, dy = this.wp[1] - this.y, dz = this.wp[2] - this.z, d = Math.hypot(dx, dy, dz) || 1;
    if (!boxIntersectsBlocks(w, this.x - 2 + dx / d, this.y + dy / d, this.z - 2 + dz / d, this.x + 2 + dx / d, this.y + 4 + dy / d, this.z + 2 + dz / d)) { this.mx += dx / d * 0.04; this.my += dy / d * 0.04; this.mz += dz / d * 0.04; } else this.wp = null;
    const see = !p.dead && !p.creative && dist < 64 && (this.age % 10 === 0 ? (this.seeP = this.canSee(p)) : this.seeP);
    if (see) {
      this.yaw = Math.atan2(-(p.x - this.x), -(p.z - this.z));
      if (++this.atk === 10) g.sound('mob:ghast', this, 2, 1);
      if (this.atk === 20) { mgr.spawnFireball(this, p, 'fireball'); this.atk = -40; }
    } else if (this.atk > 0) this.atk--;
    else this.yaw = Math.atan2(-this.mx, -this.mz) || this.yaw;
    if (Math.random() < 1 / 300) g.sound('mob:ghast', this, 2, 0.8);
    return [0, 0, see ? p : null, 0];
  }
  blazeAI(g, mgr, p, dist) {
    if (Math.random() < 0.1) g.particles.fx('smoke', this.x + (Math.random() - 0.5) * 0.6, this.y + Math.random() * 1.8, this.z + (Math.random() - 0.5) * 0.6);
    if (!this.onGround && this.my < 0) this.my *= 0.6;
    const t = !p.dead && !p.creative && dist < 40 && (this.age % 10 === 0 ? (this.seeP = this.canSee(p)) : this.seeP) ? p : null;
    if (!t) { this.atk = 0; return null; }
    if (this.y < p.eyeY + 0.5 + Math.sin(this.age * 0.05)) this.my += (0.3 - this.my) * 0.3;
    const dx = p.x - this.x, dz = p.z - this.z, hd = Math.hypot(dx, dz) || 1;
    if (dist < 2) this.melee(g, mgr, p, 6);
    else if (dist < 30) { this.atk++; if (this.atk >= 60 && this.atk <= 72 && (this.atk - 60) % 6 === 0) { mgr.spawnFireball(this, p, 'smallfire'); g.sound('golem:attack', this, 0.5, 2); } if (this.atk > 140) this.atk = 0; }
    return [dx / hd, dz / hd, p, dist > 8 ? 1 : 0];
  }
  squidAI(g) {
    if (!this.inWater()) return [0, 0, null, 0];
    this.my += 0.018;
    if (--this.jumpDelay <= 0) { this.jumpDelay = R(40, 90); const a = Math.random() * Math.PI * 2, b = (Math.random() - 0.4) * 0.6; this.mx = Math.sin(a) * 0.25; this.mz = Math.cos(a) * 0.25; this.my = b * 0.4; this.yaw = Math.atan2(-this.mx, -this.mz); this.swimT = 0; }
    this.swimT = (this.swimT || 0) + 1; return [0, 0, null, 0];
  }
  // iron golem: guards villagers, smacks monsters (and players who start trouble)
  golemAI(g, mgr, p, dist) {
    if (this.angry > 0) this.angry--;
    let t = this.target; const gone = o => !o || o.dead || o.deathTime || Math.hypot(o.x - this.x, o.z - this.z) > 24;
    if (t === p ? (p.dead || p.creative || this.angry <= 0 || gone(p)) : gone(t)) t = this.target = null;
    if (!t && this.age % 10 === 0) {
      if (this.angry > 0 && !p.dead && !p.creative && dist < 20) t = p;
      else { let best = 16; for (const m of mgr.mobs) if (m.hostile && m.type !== 'creeper' && !m.deathTime) { const d = Math.hypot(m.x - this.x, m.y - this.y, m.z - this.z); if (d < best) { best = d; t = m; } } }
      this.target = t;
    }
    if (!t) { if (!this.wander && this.home && Math.hypot(this.home[0] - this.x, this.home[1] - this.z) > 16) { this.wander = this.home.slice(); this.wanderT = 200; } return null; }
    const dx = t.x - this.x, dz = t.z - this.z, hd = Math.hypot(dx, dz) || 1, reach = this.w / 2 + (t.w || 0.6) / 2 + 1;
    if (this.attackCD <= 0 && hd < reach && Math.abs(t.y - this.y) < 2.5) {
      this.attackCD = 20; this.attackAnim = 10; const dmg = 7 + R(0, 14); g.sound('golem:attack', this, 1, 1);
      if (t === p) { const diff = g.settings.difficulty; const d = diff === 0 ? 0 : diff === 1 ? Math.floor(dmg / 2) + 1 : diff === 3 ? Math.floor(dmg * 3 / 2) : dmg; if (d > 0 && p.damage(d, 'mob')) { p.my = 0.65; p.mx += dx / hd * 0.3; p.mz += dz / hd * 0.3; } }
      else if (t.hurt(dmg, 'golem', this, g)) t.my = 0.65;
    }
    return [dx / hd, dz / hd, t, hd < reach * 0.7 ? 0 : 1.2];
  }
  // villagers keep near home and run from zombies
  villagerAI(g, mgr) {
    if (this.trading) { this.wander = null; return [0, 0, g.player, 0]; }
    if (this.age % 10 === 0) { this.threat = null; let best = 8; for (const m of mgr.mobs) if (m.hostile && !m.deathTime && m.type !== 'creeper') { const d = Math.hypot(m.x - this.x, m.z - this.z); if (d < best) { best = d; this.threat = m; } } }
    const t = this.threat; if (t && !t.deathTime && !t.dead) { const dx = this.x - t.x, dz = this.z - t.z, d = Math.hypot(dx, dz) || 1; return [dx / d, dz / d, t, 1.6]; }
    if (!this.wander && this.home && Math.hypot(this.home[0] - this.x, this.home[1] - this.z) > 14 && Math.random() < 0.05) { this.wander = [this.home[0] + Math.random() * 6 - 3, this.home[1] + Math.random() * 6 - 3]; this.wanderT = 200; }
    return null;
  }
  // melee monsters hunt villagers and fight back against golems
  mobFightAI(g, mgr, p, dist, chase) {
    let t = this.target; if (t && (t.dead || t.deathTime || Math.hypot(t.x - this.x, t.z - this.z) > 20)) t = this.target = null;
    if (!t && this.type === 'zombie' && this.age % 20 === 0) { let best = 12; for (const m of mgr.mobs) if (m.type === 'villager' && !m.deathTime) { const d = Math.hypot(m.x - this.x, m.z - this.z); if (d < best) { best = d; t = m; } } this.target = t; }
    if (!t) return null; const dx = t.x - this.x, dz = t.z - this.z, hd = Math.hypot(dx, dz) || 1;
    if (chase && dist < hd && t.type !== 'iron_golem') return null; // player is the closer meal
    if (this.attackCD <= 0 && hd < this.w / 2 + t.w / 2 + 0.5 && Math.abs(t.y - this.y) < 1.5) { this.attackCD = 20; t.hurt(this.T.attack, 'mob', this, g); }
    return [dx / hd, dz / hd, t, 1];
  }
  physics(g, fx, fz, jump) {
    if (this.T.flies) { this.move(this.mx, this.my, this.mz, 0); this.mx *= 0.91; this.my *= 0.91; this.mz *= 0.91; this.fall = 0; this.fire = 0; if (this.y < -64) this.dead = true; return; }
    if (this.T.fireproof) this.fire = 0;
    const water = this.inWater(), lava = this.inLava();
    if (water || lava) {
      this.mx += fx * 0.02; this.mz += fz * 0.02; if (jump) this.my += 0.04;
      if (water) { const hw = this.w / 2 - 0.001; applyCurrent(this.world, this, this.x - hw, this.y + 0.1, this.z - hw, this.x + hw, this.y + Math.max(0.1, this.h - 0.4), this.z + hw); }
      this.move(this.mx, this.my, this.mz, 0.5); const d = water ? 0.8 : 0.5; this.mx *= d; this.my *= d; this.mz *= d; this.my -= 0.02; this.fall = 0;
      if (this.hcol && jump) this.my = 0.3;
    } else {
      const acc = this.onGround ? 0.1 : 0.02; this.mx += fx * acc; this.mz += fz * acc;
      if (this.T.climbs && this.hcol && (fx || fz)) { this.my = 0.2; this.fall = 0; }
      if (jump && this.onGround) this.my = 0.42;
      const was = this.onGround; const fall0 = this.fall;
      this.move(this.mx, this.my, this.mz, this.T.step || 0.5);
      if (this.onGround) { if (!was && fall0 > (this.T.safeFall || 3) && this.type !== 'chicken' && !this.T.noFall) this.hurt(Math.ceil(fall0 - (this.T.safeFall || 3)), 'fall', null, g); this.fall = 0; }
      this.my -= 0.08; this.my *= 0.98; if (this.type === 'chicken' && !this.onGround && this.my < 0) this.my *= 0.6;
      const fr = this.onGround ? 0.546 : 0.91; this.mx *= fr; this.mz *= fr;
    }
    if (lava && !this.T.fireproof) { this.fire = 300; if (this.age % 10 === 0) this.hurt(4, 'lava', null, g); }
    else if (!this.T.fireproof && this.world.getBlock(Math.floor(this.x), Math.floor(this.y), Math.floor(this.z)) === 51) { this.fire = Math.max(this.fire, 160); if (this.age % 10 === 0) this.hurt(1, 'fire', null, g); }
    if (water) this.fire = 0;
    if (this.effects) tickEffects(this, n => { if (this.hp > 1) this.hurt(n, 'magic', null, g); }, n => { this.hp = Math.min(this.T.hp, this.hp + n); });
    if (this.fire > 0) { this.fire--; if (this.fire % 20 === 0) this.hurt(1, 'fire', null, g); if (Math.random() < 0.3) g.particles.fx('flame', this.x + (Math.random() - 0.5) * this.w, this.y + Math.random() * this.h, this.z + (Math.random() - 0.5) * this.w); }
    if (this.y < -64) this.dead = true;
    const md = Math.hypot(this.x - this.px, this.z - this.pz); this.limbAmt += (Math.min(1, md * 4) - this.limbAmt) * 0.4; this.limb += this.limbAmt;
  }
  skinVariant() { if (this.type === 'villager') return this.prof; if (this.type === 'ocelot') return this.tame ? ['cat_black', 'cat_red', 'cat_siamese'][this.color || 0] : undefined; if (this.type === 'horse') return (this.kind || 'h') + '.' + (this.color || 0) + '.' + (this.mark || 0) + '.' + (this.kind === 'h' || !this.kind ? this.armor || 0 : 0); if (this.type === 'wolf') return this.tame ? 'wolf_tame' : this.angry > 0 ? 'wolf_angry' : undefined; if (this.type === 'ghast') return this.atk >= 10 ? 'ghast_fire' : undefined; }
  render(r, pt, daySub) {
    const variant = this.skinVariant(); if (this.model && this.model.variant !== variant) { r.scene.remove(this.model.root); this.model.mat.dispose(); this.model.woolMat.dispose(); this.model.glassMat.dispose(); this.model = null; }
    if (!this.model) { this.model = buildModel(this.type, variant); this.model.variant = variant; r.scene.add(this.model.root); this.obj = this.model.root;
      if (this.type === 'zombie_pigman') { const sw = makeItemObject(283, r, 0.35); sw.rotation.set(0, Math.PI / 2, -Math.PI / 4); sw.position.set(0, -0.6, -0.08); this.model.parts.armR.add(sw); }
      if (this.type === 'wither_skeleton') { const sw = makeItemObject(272, r, 0.35); sw.rotation.set(0, Math.PI / 2, -Math.PI / 4); sw.position.set(0, -0.6, -0.08); this.model.parts.armR.add(sw); }
      if (this.type === 'skeleton') { const bow = makeItemObject(261, r, 0.35); bow.rotation.set(0, Math.PI / 2, -Math.PI / 4); bow.position.set(0, -0.6, -0.08); this.model.parts.armR.add(bow); } }
    const { root, parts, mat, woolMat, glassMat } = this.model; const L = (a, b) => a + (b - a) * pt;
    root.position.set(L(this.px, this.x), L(this.py, this.y), L(this.pz, this.z)); updateShadow(this, r, this.world, L(this.px, this.x), L(this.py, this.y), L(this.pz, this.z), this.w * 0.65);
    const by = this.pyaw + angDiff(this.pyaw, this.yaw) * pt; root.rotation.set(0, by, 0);
    const s = this.baby ? 0.5 : 1; let sc = s * (this.T.scale || 1) * (this.T.cube ? this.size * 1.15 : 1);
    if (this.type === 'creeper') { const f = (this.pFuse + (this.fuse - this.pFuse) * pt) / 28; const k = 1 + Math.sin(f * 100) * f * 0.01; const ff = Math.min(1, Math.max(0, f)) ** 3; root.scale.set(s * (1 + ff * 0.4) * k, s * (1 + ff * 0.1) / k, s * (1 + ff * 0.4) * k); } else if (this.T.cube) { const f = this.pSquish + (this.squish - this.pSquish) * pt; const k = 1 / (f * 0.5 + 1); root.scale.set(sc * k, sc / k, sc * k); } else root.scale.setScalar(sc);
    if (this.type === 'horse') { if (this.kind === 'd') root.scale.multiplyScalar(0.87); else if (this.kind === 'm') root.scale.multiplyScalar(0.92); root.rotation.order = 'YXZ'; this.rearA = (this.rearA || 0) + ((this.rear || 0) - (this.rearA || 0)) * 0.2; root.rotation.x = this.rearA; }
    if (this.deathTime) { const t = Math.min(1, Math.sqrt((this.deathTime + pt - 1) / 20 * 1.6)); root.rotation.z = t * Math.PI / 2; }
    const hy = angDiff(by, this.pHeadYaw + angDiff(this.pHeadYaw, this.headYaw) * pt);
    if (parts.head) { parts.head.rotation.set(-this.headPitch, hy, 0, 'YXZ'); if (this.baby) parts.head.scale.setScalar(1.4); }
    const sw = this.pLimb + (this.limb - this.pLimb) * pt, amt = this.pLimbAmt + (this.limbAmt - this.pLimbAmt) * pt; const a = Math.cos(sw * 0.6662) * 1.4 * amt;
    if (parts.legFR) { parts.legFR.rotation.x = a; parts.legFL.rotation.x = -a; parts.legBR.rotation.x = -a; parts.legBL.rotation.x = a; }
    if (parts.legR) { parts.legR.rotation.x = a; parts.legL.rotation.x = -a; }
    if (parts.armR) { const t = (this.age + pt) * 0.067; if (this.type === 'zombie' || this.type === 'skeleton' || this.type === 'zombie_pigman') { parts.armR.rotation.set(Math.PI / 2 + Math.sin(t) * 0.05, 0, Math.cos(t * 1.3) * 0.05 + 0.05); parts.armL.rotation.set(this.type === 'zombie' ? Math.PI / 2 - Math.sin(t) * 0.05 : -a * 0.5, 0, -Math.cos(t * 1.3) * 0.05 - 0.05); } else { parts.armR.rotation.x = -a * 0.5; parts.armL.rotation.x = a * 0.5; } }
    if (this.type === 'iron_golem') { const at = this.pAttackAnim > 0 || this.attackAnim > 0 ? Math.max(0, this.attackAnim - pt) / 10 : 0; if (at > 0) { const k = Math.sin(at * Math.PI) * 2; parts.armR.rotation.x = k; parts.armL.rotation.x = k; } else { parts.armR.rotation.x = -a * 0.35; parts.armL.rotation.x = a * 0.35; } parts.legR.rotation.x = a * 0.6; parts.legL.rotation.x = -a * 0.6; }
    if (parts.wingR) { const fl = this.onGround ? 0 : (Math.sin((this.age + pt) * 1.5) + 1) * 0.8; parts.wingR.rotation.z = -fl; parts.wingL.rotation.z = fl; }
    const tt = this.age + pt;
    if (this.type === 'ghast') for (let i = 0; i < 9; i++) parts['tent' + i].rotation.x = 0.2 * Math.sin(tt * 0.3 + i) + 0.4;
    if (this.type === 'blaze') { let k = 0; for (let ring = 0; ring < 3; ring++) for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + tt * [0.08, -0.06, 0.1][ring] + ring * 0.4, rad = [9, 7, 5][ring] / 16; parts['rod' + k].position.set(Math.cos(a) * rad, ([26, 22, 13][ring] + Math.cos((i * 2 + tt) * 0.25)) / 16, Math.sin(a) * rad); k++; } }
    if (this.type === 'silverfish') { const segs = [0, 1, 2, 3, 4, 5, 6]; for (const i of segs) { const ph = tt * 0.9 + i * 0.15 * Math.PI; parts['seg' + i].rotation.y = Math.cos(ph) * Math.PI * 0.05 * (1 + Math.abs(i - 2)); parts['seg' + i].position.x = Math.sin(ph) * Math.PI * 0.2 * Math.abs(i - 2) / 16; }
      [[0, 2], [1, 4], [2, 1]].forEach(([w, i]) => { parts['wing' + w].rotation.y = parts['seg' + i].rotation.y; parts['wing' + w].position.x = parts['seg' + i].position.x; }); }
    if (this.type === 'squid') { const sp = 0.25 + 0.8 * Math.max(0, Math.cos(Math.min(Math.PI, (this.swimT || 99) * 0.12))); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; const tp = parts['tent' + i]; tp.rotation.order = 'YXZ'; tp.rotation.set(-sp, Math.PI / 2 - a, 0); } }
    if (this.type === 'wolf') { parts.tail.rotation.x = this.angry > 0 && !this.tame ? -1.3 : this.tame ? -0.4 - (this.hp / 20) * 0.9 : -0.5; if (this.sitting) { parts.legBR.rotation.x = parts.legBL.rotation.x = 1.45; parts.legFR.rotation.x = parts.legFL.rotation.x = 0; root.position.y -= 0.12; } }
    if (this.type === 'enderman') { parts.armR.rotation.x *= 0.4; parts.armL.rotation.x *= 0.4; parts.legR.rotation.x *= 0.5; parts.legL.rotation.x *= 0.5; }
    if (this.T.spider) for (let i = 0; i < 4; i++) { const sp = (i - 1.5) * 0.45; const wk = Math.sin(sw * 0.6662 * 2 + i * Math.PI / 2) * 0.4 * amt, lift = Math.abs(Math.sin(sw * 0.6662 + i * Math.PI / 2)) * 0.4 * amt; parts['leg' + i + 'R'].rotation.set(0, -sp + wk, -0.75 + lift); parts['leg' + i + 'L'].rotation.set(0, sp - wk, 0.75 - lift); }
    if (this.type === 'ocelot') { parts.tail.rotation.x = -0.9 - amt * 0.3; parts.tail2.rotation.x = -0.5 + Math.sin(tt * 0.1) * 0.15; if (this.sitting) { parts.legBR.rotation.x = parts.legBL.rotation.x = 1.4; parts.legFR.rotation.x = parts.legFL.rotation.x = -0.2; parts.body.rotation.x = -0.6; root.position.y -= 0.1; } else parts.body.rotation.x = 0; }
    if (this.type === 'bat') { if (this.hanging) { root.rotation.z = Math.PI; root.position.y += this.h * 1.05; parts.wingR.rotation.y = -1.4; parts.wingL.rotation.y = 1.4; parts.wingR2.rotation.y = -1.6; parts.wingL2.rotation.y = 1.6; }
      else { const fl = Math.cos(tt * 1.3) * Math.PI * 0.25; parts.wingR.rotation.y = fl; parts.wingL.rotation.y = -fl; parts.wingR2.rotation.y = fl * 0.5; parts.wingL2.rotation.y = -fl * 0.5; root.rotation.x = 0.8; root.rotation.order = 'YXZ'; } }
    if (this.type === 'villager' && parts.arms) parts.arms.rotation.x = 0.75;
    if (this.type === 'snowman') { parts.armR.rotation.z = 0.5 + Math.sin(tt * 0.05) * 0.05; parts.armL.rotation.z = -0.5 - Math.sin(tt * 0.05) * 0.05; }
    if (this.type === 'wither_skeleton') { parts.armR.rotation.x = Math.PI / 2 + (this.attackAnim > 0 ? -0.8 : 0); }
    if (parts.saddle) for (const k of SADDLE_PARTS) if (parts[k]) parts[k].visible = !!this.saddled;
    if (this.type === 'horse') { parts.head.rotation.x = -0.55 - this.headPitch * 0.4; parts.tail.rotation.x = -0.35 - amt * 0.5; parts.tail.rotation.z = Math.sin(tt * 0.08) * 0.1; parts.earR.rotation.z = parts.earL.rotation.z = 0; const long = this.kind === 'd' || this.kind === 'm'; parts.earR.visible = parts.earL.visible = !long; parts.earDR.visible = parts.earDL.visible = long; parts.earDR.rotation.z = -0.15; parts.earDL.rotation.z = 0.15; parts.chestR.visible = parts.chestL.visible = !!this.chest; }
    if (this.type === 'sheep') for (const k of ['wool', 'woolHead', 'woolLegFR', 'woolLegFL', 'woolLegBR', 'woolLegBL']) parts[k].visible = !this.sheared;
    this.renderExtras(r, pt);
    const l = this.T.bright ? 1 : this.lightAt(daySub); const red = this.hurtTime > 0 || this.deathTime;
    if (this.type === 'creeper' && this.fuse > 0 && ((this.fuse >> 1) & 1)) mat.color.setRGB(2, 2, 2); else mat.color.setRGB(l, red ? l * 0.45 : l, red ? l * 0.45 : l); glassMat.color.copy(mat.color);
    if (this.type !== 'sheep') woolMat.color.copy(mat.color);
    if (this.type === 'sheep') { const c = WOOL[this.color || 0]; woolMat.color.setRGB(c[0] / 255 * l, c[1] / 255 * l * (red ? 0.45 : 1), c[2] / 255 * l * (red ? 0.45 : 1)); }
  }
  // the rope to whatever holds the lead (sagging between the two ends) and a name tag above the head
  renderExtras(r, pt) { const L = (a, b) => a + (b - a) * pt, x = L(this.px, this.x), y = L(this.py, this.y), z = L(this.pz, this.z);
    if (this.leash && !this.deathTime) {
      if (!this.rope) { const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(ROPE_N * 3), 3)); this.rope = new THREE.Line(geo, ropeMat); this.rope.frustumCulled = false; r.scene.add(this.rope); }
      const l = this.leash; let hx, hy, hz; if (l.fence) [hx, hy, hz] = this.leashHolder(); else { const yaw = l.yaw || 0; hx = L(l.px ?? l.x, l.x) + Math.cos(yaw) * 0.35 - Math.sin(yaw) * 0.3; hy = L(l.py ?? l.y, l.y) + (l.sneak ? 0.9 : 1.05); hz = L(l.pz ?? l.z, l.z) - Math.sin(yaw) * 0.35 - Math.cos(yaw) * 0.3; }
      const sx = x, sy = y + this.h * (this.type === 'horse' ? 0.75 : 0.6) * (this.baby ? 0.6 : 1), sz = z; const a = this.rope.geometry.attributes.position; const d = Math.hypot(hx - sx, hz - sz), sag = Math.max(0, 1.2 - d * 0.12);
      for (let i = 0; i < ROPE_N; i++) { const t = i / (ROPE_N - 1); a.setXYZ(i, sx + (hx - sx) * t, sy + (hy - sy) * t - Math.sin(t * Math.PI) * sag, sz + (hz - sz) * t); } a.needsUpdate = true;
      if (l.fence && !this.knot) { this.knot = new THREE.Mesh(knotGeo, knotMat); r.scene.add(this.knot); } if (this.knot) { if (l.fence) this.knot.position.set(l.x + 0.5, l.y + 0.6, l.z + 0.5); else { r.scene.remove(this.knot); this.knot = null; } }
    } else this.clearRope(r.scene);
    if (this.nameTag && !this.deathTime) { if (!this.tagSprite || this.tagSprite.userData.name !== this.nameTag) { this.clearTag(r.scene); this.tagSprite = nameSprite(this.nameTag); this.tagSprite.userData.name = this.nameTag; r.scene.add(this.tagSprite); }
      const s = this.baby ? 0.5 : 1; this.tagSprite.position.set(x, y + this.h * s * (this.T.cube ? this.size : 1) + 0.35, z); } else this.clearTag(r.scene); }
  clearRope(scene) { if (this.rope) { scene.remove(this.rope); this.rope.geometry.dispose(); this.rope = null; } if (this.knot) { scene.remove(this.knot); this.knot = null; } }
  clearTag(scene) { if (this.tagSprite) { scene.remove(this.tagSprite); this.tagSprite.material.map.dispose(); this.tagSprite.material.dispose(); this.tagSprite = null; } }
  dispose(scene) { this.clearRope(scene); this.clearTag(scene); if (this.model) { scene.remove(this.model.root); this.model.mat.dispose(); this.model.woolMat.dispose(); this.model.glassMat.dispose(); this.model = null; this.obj = null; } clearShadow(this, scene); }
}

// arrows, snowballs, eggs
class Projectile extends Entity {
  constructor(world, kind, owner, x, y, z, mx, my, mz) { super(world, x, y, z); this.kind = kind; this.owner = owner; this.mx = mx; this.my = my; this.mz = mz; this.stuck = false; this.w = this.h = 0.25; this.life = 0; this.yaw = Math.atan2(mx, mz); this.pitch = Math.atan2(my, Math.hypot(mx, mz)); }
  tick(g, mgr) {
    this.baseTick(); this.ppitch = this.pitch;
    if (this.stuck) { this.life++; if (this.life > 1200 || !this.world.getBlock(...this.stuckAt)) { if (this.world.getBlock(...this.stuckAt)) this.dead = true; else this.stuck = false; }
      const p = g.player; if (this.owner === p && !p.dead && Math.abs(p.x - this.x) < 1.3 && Math.abs(p.z - this.z) < 1.3 && this.y > p.y - 0.5 && this.y < p.y + 2.3) { if (p.creative || p.inv.add({ id: 262, count: 1, dmg: 0 }) < 1) { g.sound('pop', this, 0.3, 1.6); this.dead = true; } } return; }
    const sp = Math.hypot(this.mx, this.my, this.mz); if (sp < 1e-4) { this.dead = true; return; }
    const dx = this.mx / sp, dy = this.my / sp, dz = this.mz / sp;
    let hit = raycast(this.world, this.x, this.y, this.z, dx, dy, dz, sp); let ent = null, et = hit ? hit.dist : sp;
    const targets = [...mgr.mobs.filter(m => !m.deathTime), g.player];
    const fireK = this.kind === 'fireball' || this.kind === 'smallfire'; if (fireK && this.age % 2 === 0) g.particles.fx(this.kind === 'fireball' ? 'smoke' : 'flame', this.x, this.y, this.z);
    for (const m of targets) { if (m === this.owner && (this.age < 5 || fireK)) continue; if (m === g.player && (m.dead || this.owner === m)) continue; const hw = m.w / 2 + 0.15; const r = rayBox(this.x, this.y, this.z, dx, dy, dz, m.x - hw, m.y - 0.15, m.z - hw, m.x + hw, m.y + m.h + 0.15, m.z + hw); if (r && r.t <= et) { et = r.t; ent = m; } }
    if (ent && fireK) {
      const dmg = this.kind === 'fireball' ? 6 : 5;
      if (ent === g.player) { if (ent.damage(dmg, 'fireball') && this.kind === 'smallfire') ent.fireTicks = Math.max(ent.fireTicks || 0, 100); }
      else if (ent.hurt(dmg, 'fireball', this.owner && this.owner.mob ? this.owner : null, g) && this.kind === 'smallfire' && !ent.T.fireproof) ent.fire = Math.max(ent.fire, 100);
      this.x += dx * et; this.y += dy * et; this.z += dz * et; this.impact(g, mgr); this.dead = true; return;
    }
    if (ent && this.kind === 'potion') { this.x += dx * et; this.y += dy * et; this.z += dz * et; this.impact(g, mgr); this.dead = true; return; }
    if (ent) {
      const dmg = this.kind === 'arrow' ? Math.ceil(sp * 2) + (this.crit ? R(0, Math.ceil(sp)) : 0) : this.kind === 'snowball' && ent.type === 'blaze' ? 3 : 0;
      if (ent === g.player) { if (dmg > 0) { const diff = g.settings.difficulty; const d = diff === 1 ? Math.floor(dmg / 2) + 1 : diff === 3 ? Math.floor(dmg * 3 / 2) : dmg; if (ent.damage(d, 'arrow')) { ent.mx += dx * 0.3; ent.mz += dz * 0.3; } } }
      else if (ent.hurt(dmg, this.kind === 'arrow' ? 'arrow' : 'thrown', this.owner && this.owner.mob ? null : this.owner, g) || dmg === 0) { if (this.owner === g.player) ent.killedByPlayer = true; ent.mx += dx * 0.3; ent.mz += dz * 0.3; }
      if (this.kind === 'arrow') g.sound('hit:stone', this, 0.5, 1.8);
      this.impact(g, mgr); this.dead = true; return;
    }
    if (hit) {
      this.x += dx * hit.dist; this.y += dy * hit.dist; this.z += dz * hit.dist;
      if (this.kind === 'arrow') { this.stuck = true; this.stuckAt = [hit.x, hit.y, hit.z]; this.x -= dx * 0.05; this.y -= dy * 0.05; this.z -= dz * 0.05; this.mx = this.my = this.mz = 0; g.sound('hit:wood', this, 0.6, 1.4); return; }
      if (this.kind === 'smallfire') { const fx = Math.floor(this.x - dx * 0.2), fy = Math.floor(this.y - dy * 0.2), fz = Math.floor(this.z - dz * 0.2); if (this.world.getBlock(fx, fy, fz) === 0 && SOLID[this.world.getBlock(fx, fy - 1, fz)]) this.world.setBlock(fx, fy, fz, 51, 0); }
      this.impact(g, mgr); this.dead = true; return;
    }
    this.x += this.mx; this.y += this.my; this.z += this.mz;
    const wet = isWater(this.world.getBlock(Math.floor(this.x), Math.floor(this.y), Math.floor(this.z))); const drag = fireK ? 1 : wet ? 0.8 : 0.99;
    this.mx *= drag; this.my *= drag; this.mz *= drag; if (!fireK) this.my -= this.kind === 'arrow' ? 0.05 : 0.03; else if (this.age > 200) this.dead = true;
    this.yaw = Math.atan2(this.mx, this.mz); this.pitch = Math.atan2(this.my, Math.hypot(this.mx, this.mz));
    if (this.age > 1200) this.dead = true;
  }
  impact(g, mgr) {
    if (this.kind === 'potion') { const dmg = this.potion ?? (POT.harming | SPLASH), c = potionType(dmg)[2]; g.sound('dig:glass', this, 1, 1);
      for (let i = 0; i < 24; i++) g.particles.spawn(this.x, this.y, this.z, 'snow', { vx: (Math.random() - 0.5) * 0.3, vy: Math.random() * 0.25, vz: (Math.random() - 0.5) * 0.3, col: [(c >> 16 & 255) / 255, (c >> 8 & 255) / 255, (c & 255) / 255], life: 20, size: 0.1 });
      const hit = (e, isP) => { const d = Math.hypot(e.x - this.x, e.y + e.h / 2 - this.y, e.z - this.z); if (d > 4) return; applyPotion(e, dmg, 1 - d / 4 * 0.75, isP, g); };
      if (!g.player.dead) hit(g.player, true); for (const mb of mgr.mobs) if (!mb.deathTime && !(this.owner && this.owner.type === 'witch' && mb.type === 'witch')) hit(mb, false); return; }
    if (this.kind === 'fireball') { mgr.explode(this.x, this.y, this.z, 1, this); return; }
    if (this.kind === 'smallfire') { for (let i = 0; i < 6; i++) g.particles.fx('flame', this.x, this.y, this.z); return; }
    if (this.kind === 'egg' && Math.random() < 1 / 8) { const n = Math.random() < 1 / 32 ? 4 : 1; for (let i = 0; i < n; i++) { const c = mgr.spawn('chicken', this.x, this.y, this.z); c.ageT = -24000; } }
    if (this.kind !== 'arrow') for (let i = 0; i < 8; i++) g.particles.spawn(this.x, this.y, this.z, this.kind === 'egg' ? 'snow' : 'snow', { vx: (Math.random() - 0.5) * 0.15, vy: Math.random() * 0.15, vz: (Math.random() - 0.5) * 0.15, col: this.kind === 'egg' ? [0.9, 0.85, 0.7] : [1, 1, 1], life: 12, size: 0.08 });
  }
  render(r, pt, daySub) {
    if (!this.obj) {
      if (this.kind === 'arrow') { if (!Projectile.arrowTex) { const cv = document.createElement('canvas'); cv.width = 16; cv.height = 5; const c = cv.getContext('2d'); c.fillStyle = '#6b5233'; c.fillRect(3, 2, 10, 1); c.fillStyle = '#e8e8e8'; c.fillRect(0, 0, 4, 1); c.fillRect(0, 4, 4, 1); c.fillRect(1, 1, 3, 3); c.fillStyle = '#9a9a9a'; c.fillRect(12, 1, 3, 3); c.fillRect(15, 2, 1, 1); const t = new THREE.CanvasTexture(cv); t.magFilter = t.minFilter = THREE.NearestFilter; Projectile.arrowTex = t; }
        const m = new THREE.MeshBasicMaterial({ map: Projectile.arrowTex, alphaTest: 0.5, side: THREE.DoubleSide }); const g1 = new THREE.PlaneGeometry(0.5, 0.16); g1.rotateY(-Math.PI / 2); const g2 = g1.clone(); g2.rotateZ(Math.PI / 2);
        this.obj = new THREE.Group(); this.mat = m; this.obj.add(new THREE.Mesh(g1, m), new THREE.Mesh(g2, m)); this.obj.rotation.order = 'YXZ';
      } else { this.obj = makeItemObject(this.kind === 'potion' ? 373 : this.kind === 'egg' ? 344 : this.kind === 'fireball' || this.kind === 'smallfire' ? 378 : 332, r, this.kind === 'fireball' ? 0.5 : this.kind === 'smallfire' ? 0.2 : this.kind === 'potion' ? 0.25 : 0.125, this.potion || 0); this.mat = this.obj.material; this.billboard = true; }
      r.scene.add(this.obj);
    }
    const L = (a, b) => a + (b - a) * pt; this.obj.position.set(L(this.px, this.x), L(this.py, this.y), L(this.pz, this.z)); updateShadow(this, r, this.world, L(this.px, this.x), L(this.py, this.y), L(this.pz, this.z), 0.18);
    if (this.billboard) this.obj.quaternion.copy(r.camera.quaternion); else this.obj.rotation.set(-this.pitch, this.yaw, 0);
    const l = this.kind === 'fireball' || this.kind === 'smallfire' ? 1.3 : this.lightAt(daySub); this.mat.color.setRGB(l, l, l);
  }
  dispose(scene) { if (this.obj) { scene.remove(this.obj); if (!this.billboard) this.obj.children.forEach(c => c.geometry.dispose()); else this.obj.geometry.dispose(); this.obj = null; } clearShadow(this, scene); }
}

class PrimedTNT extends Entity {
  constructor(world, x, y, z, fuse = 80) { super(world, x, y, z); this.fuse = fuse; this.w = this.h = 0.98; const a = Math.random() * Math.PI * 2; this.mx = -Math.sin(a) * 0.02; this.my = 0.2; this.mz = -Math.cos(a) * 0.02; }
  tick(g, mgr) { this.baseTick(); this.my -= 0.04; this.move(this.mx, this.my, this.mz); this.mx *= 0.98; this.my *= 0.98; this.mz *= 0.98; if (this.onGround) { this.mx *= 0.7; this.mz *= 0.7; this.my *= -0.5; }
    if (this.age % 2 === 0) g.particles.fx('smoke', this.x, this.y + 1.1, this.z); if (--this.fuse <= 0) { this.dead = true; mgr.explode(this.x, this.y + 0.49, this.z, 4, this); } }
  render(r, pt, daySub) {
    if (!this.obj) { this.mat = new THREE.MeshBasicMaterial({ map: r.atlasTex, vertexColors: true }); this.obj = new THREE.Mesh(blockCubeGeometry(46, r.opts.rows, 1), this.mat); r.scene.add(this.obj); }
    const L = (a, b) => a + (b - a) * pt; let s = 1; if (this.fuse - pt + 1 < 10) { let f = 1 - (this.fuse - pt + 1) / 10; f = Math.min(1, Math.max(0, f)); s = 1 + f * f * f * f * 0.3; }
    this.obj.position.set(L(this.px, this.x), L(this.py, this.y) + 0.49, L(this.pz, this.z)); this.obj.scale.setScalar(s);
    const l = this.lightAt(daySub); const flash = ((this.fuse / 5) | 0) % 2 === 0; this.mat.color.setRGB(flash ? 2.2 : l, flash ? 2.2 : l, flash ? 2.2 : l);
  }
  dispose(scene) { if (this.obj) { scene.remove(this.obj); this.obj.geometry.dispose(); this.mat.dispose(); this.obj = null; } }
}

export class MobManager {
  constructor(game) { this.g = game; this.mobs = []; this.misc = []; this.spawners = new Spawners(this); }
  get world() { return this.g.world; }
  spawn(type, x, y, z) { const m = new Mob(this.world, type, x, y, z); this.mobs.push(m); return m; }
  chunkLoaded(c) {
    this.spawners.chunkLoaded(c);
    if (c.savedMobs) { for (const d of c.savedMobs) { if (d.t === 'boat') { this.misc.push(new Boat(this.world, d.x, d.y, d.z, d.yaw || 0)); continue; } if (d.t === 'minecart') { const c = new Minecart(this.world, d.x, d.y, d.z, d.yaw || 0); c.mx = d.mx || 0; c.mz = d.mz || 0; this.misc.push(c); continue; } if (!TYPES[d.t]) continue; const m = this.spawn(d.t, d.x, d.y, d.z); m.yaw = m.pyaw = m.headYaw = d.yaw || 0; m.hp = d.hp ?? m.hp; if (d.color !== undefined) m.color = d.color; m.sheared = d.sheared; m.saddled = d.saddled; m.ageT = d.age || 0; if (d.prof) { m.prof = d.prof; } if (d.home) m.home = d.home; if (d.tame) m.tame = true; if (d.sit) m.sitting = true; if (d.name) m.nameTag = d.name; if (d.lf) m.leash = { fence: true, x: d.lf[0], y: d.lf[1], z: d.lf[2] }; else if (d.lp && this.g.player) m.leash = this.g.player; for (const k of ['temper', 'jumpS', 'speedS', 'armor', 'maxHp', 'kind', 'mark', 'chest', 'hinv', 'offers']) if (d[k] !== undefined) m[k] = d[k]; } c.savedMobs = null; return; }
    if (!c.fresh) return; c.fresh = false;
    if (c.villageSpawns) { for (const s of c.villageSpawns) { const m = this.spawn(s.t, s.x, s.y, s.z); if (s.prof) m.prof = s.prof; m.home = [s.x, s.z]; } c.villageSpawns = null; c.modified = true; }
    const squidCount = this.mobs.filter(m => m.type === 'squid').length;
    if (squidCount < 10 && Math.random() < 0.14) {
      const w = this.world, group = Math.min(R(1, 3), 10 - squidCount); let n = 0;
      for (let tries = 0; tries < 24 && n < group; tries++) {
        const x = c.cx * 16 + R(0, 15), z = c.cz * 16 + R(0, 15), biome = c.biomes[(x & 15) | ((z & 15) << 4)];
        if (biome !== 0 && biome !== 13) continue;
        const y = R(45, 60); if (!isWater(w.getBlock(x, y, z)) || !isWater(w.getBlock(x, y + 1, z))) continue;
        const m = this.spawn('squid', x + 0.5, y, z + 0.5); m.chunk = c; n++;
      }
      if (n) c.modified = true;
    }
    if (Math.random() > 0.1) return; let type = pick(ANIMALS); const w = this.world; let n = 0; const cb = c.biomes[8 | (8 << 4)]; if ((cb === 1 || cb === 17) && Math.random() < 0.35) type = 'horse';
    for (let tries = 0; tries < 12 && n < 4; tries++) { const x = c.cx * 16 + R(0, 15), z = c.cz * 16 + R(0, 15); const y = w.topY(x, z); if (w.getBlock(x, y, z) !== 2) continue; const m = this.spawn(type, x + 0.5, y + 1, z + 0.5); m.chunk = c; n++; }
    if (n) c.modified = true;
  }
  _serialize(c) { const list = []; for (const m of this.mobs) if (!m.hostile && !m.deathTime && !m.dead && (Math.floor(m.x) >> 4) === c.cx && (Math.floor(m.z) >> 4) === c.cz) list.push(m); return list; }
  saveToChunks() { const by = new Map(); for (const m of this.mobs) { if (m.hostile || m.deathTime || m.dead) continue; const c = this.world.getChunk(Math.floor(m.x) >> 4, Math.floor(m.z) >> 4); if (!c) continue; if (!by.has(c)) by.set(c, []); by.get(c).push(m.toJSON()); }
    for (const e of this.misc) { if (!e.vehicle || e.dead) continue; const c = this.world.getChunk(Math.floor(e.x) >> 4, Math.floor(e.z) >> 4); if (!c) continue; if (!by.has(c)) by.set(c, []); by.get(c).push(e.toJSON()); }
    for (const c of this.world.chunks.values()) { const l = by.get(c) || null; if (l || c.savedMobsOut) { c.savedMobs = l; c.savedMobsOut = !!l; c.modified = true; } } }
  unloadChunk(c) { this.spawners.unloadChunk(c); const keep = []; const out = []; for (const m of this.mobs) { if ((Math.floor(m.x) >> 4) === c.cx && (Math.floor(m.z) >> 4) === c.cz) { if (m.rider) m.dismount(); if (!m.hostile && !m.deathTime && !m.dead) out.push(m.toJSON()); m.dispose(this.g.renderer.scene); } else keep.push(m); }
    this.misc = this.misc.filter(e => { if ((Math.floor(e.x) >> 4) === c.cx && (Math.floor(e.z) >> 4) === c.cz) { if (e.vehicle && !e.dead) { e.dismount(); out.push(e.toJSON()); } e.dispose(this.g.renderer.scene); return false; } return true; });
    this.mobs = keep; if (out.length || c.savedMobsOut) { c.savedMobs = out.length ? out : null; c.savedMobsOut = !!out.length; c.modified = true; } }
  disposeAll() { this.spawners.disposeAll(); for (const m of this.mobs) m.dispose(this.g.renderer.scene); for (const e of this.misc) e.dispose(this.g.renderer.scene); this.mobs = []; this.misc = []; }
  loadedAround(x, z) { const w = this.world, bx = Math.floor(x), bz = Math.floor(z); return w.isLoaded(bx - 16, bz) && w.isLoaded(bx + 16, bz) && w.isLoaded(bx, bz - 16) && w.isLoaded(bx, bz + 16); }
  tick() {
    const g = this.g, p = g.player, sc = g.renderer.scene;
    if (g.settings.difficulty === 0) for (const m of this.mobs) if (m.hostile) m.dead = true;
    for (const m of this.mobs) { if (m.dead) continue; const d = Math.hypot(m.x - p.x, m.z - p.z);
      if ((m.hostile || m.T.bat) && !m.nameTag && (d > 128 || (d > 32 && Math.random() < 1 / 800))) { m.dead = true; continue; }
      if (d > 112 || !this.loadedAround(m.x, m.z)) continue; m.tick(g, this); }
    for (const e of this.misc) { if (!e.dead && this.world.isLoaded(Math.floor(e.x), Math.floor(e.z))) e.tick(g, this); }
    for (const m of this.mobs) if (m.dead) m.dispose(sc); for (const e of this.misc) if (e.dead) e.dispose(sc);
    this.mobs = this.mobs.filter(m => !m.dead); this.misc = this.misc.filter(e => !e.dead);
    this.spawners.tick();
    this.spawnTick();
  }
  spawnTick() {
    if (this.g && this.g.net && this.g.net.lobby) return;
    const g = this.g, w = this.world, p = g.player; const daySub = g.renderer.uniforms.daySub.value;
    if (w.dim === -1) return this.netherSpawnTick();
    let hostiles = 0, animals = 0, squids = 0, bats = 0; for (const m of this.mobs) { if (m.type === 'squid') squids++; if (m.T.bat) bats++; m.hostile ? hostiles++ : (m.T.npc || m.T.neutral || m.T.swims || m.T.bat) ? 0 : animals++; }
    if (squids < 10 && g.tickCount % 400 === 0) {
      for (let i = 0; i < 8; i++) {
        const a = Math.random() * Math.PI * 2, r = 24 + Math.random() * 40, x = Math.floor(p.x + Math.sin(a) * r), z = Math.floor(p.z + Math.cos(a) * r);
        if (!this.loadedAround(x, z) || ![0, 13].includes(w.biomeAt(x, z))) continue;
        const y = R(45, 60); if (!isWater(w.getBlock(x, y, z)) || !isWater(w.getBlock(x, y + 1, z))) continue;
        const group = Math.min(R(1, 2), 10 - squids); for (let n = 0; n < group; n++) this.spawn('squid', x + 0.3 + Math.random() * 0.4, y, z + 0.3 + Math.random() * 0.4);
        break;
      }
    }
    const attempt = (hostile) => { const a = Math.random() * Math.PI * 2, r = 24 + Math.random() * 40; const x = Math.floor(p.x + Math.sin(a) * r), z = Math.floor(p.z + Math.cos(a) * r);
      if (!this.loadedAround(x, z)) return; const top = w.topY(x, z); const y = hostile ? R(1, top + 1) : top + 1;
      const below = w.getBlock(x, y - 1, z); if (!below || !OPAQUE[below] || below === 7) return; if (SOLID[w.getBlock(x, y, z)] || SOLID[w.getBlock(x, y + 1, z)] || isFluid(w.getBlock(x, y, z)) || isFluid(w.getBlock(x, y + 1, z))) return;
      const light = Math.max(w.getSky(x, y, z) - daySub, w.getBlockLight(x, y, z));
      if (hostile && y < top - 6 && bats < 8 && light < 4 && Math.random() < 0.15) { if (Math.hypot(x - p.x, y - p.y, z - p.z) >= 24) this.spawn('bat', x + 0.5, y + 0.2, z + 0.5); return; }
      if (hostile) { if (light > Math.floor(Math.random() * 8)) return; const type = pick(MONSTERS); const t = TYPES[type]; const hw = t.w / 2;
        if (boxIntersectsBlocks(w, x + 0.5 - hw, y, z + 0.5 - hw, x + 0.5 + hw, y + t.h, z + 0.5 + hw)) return; if (Math.hypot(x - p.x, y - p.y, z - p.z) < 24) return; this.spawn(type, x + 0.5, y, z + 0.5); }
      else { if (below !== 2 || light < 9) return; let type = pick(ANIMALS); const bb = w.biomeAt(x, z); if ((bb === 1 || bb === 17) && Math.random() < 0.3) type = 'horse'; if (bb === 9 && Math.random() < 0.4) type = 'ocelot'; for (let i = 0; i < R(2, 4); i++) this.spawn(type, x + 0.5 + Math.random() - 0.5, y, z + 0.5 + Math.random() - 0.5); } };
    if (g.settings.difficulty > 0 && hostiles < 30) for (let i = 0; i < 3; i++) attempt(true);
    if (animals < 12 && g.tickCount % 400 === 0) attempt(false);
  }
  netherSpawnTick() {
    const g = this.g, w = this.world, p = g.player; if (this.mobs.length >= 25) return;
    for (let n = 0; n < 2; n++) {
      const a = Math.random() * Math.PI * 2, r = 24 + Math.random() * 40; const x = Math.floor(p.x + Math.sin(a) * r), z = Math.floor(p.z + Math.cos(a) * r), y = R(6, 118);
      if (!this.loadedAround(x, z)) continue; const below = w.getBlock(x, y - 1, z); if (!OPAQUE[below] || below === 7 || w.getBlock(x, y, z) !== 0 || w.getBlock(x, y + 1, z) !== 0) continue;
      let type = pick(NETHER_MOBS); if (g.settings.difficulty === 0 && type !== 'zombie_pigman') continue; if (Math.hypot(x - p.x, y - p.y, z - p.z) < 24) continue;
      const t = TYPES[type]; const hw = (type === 'magma_cube' ? 2.4 : t.w) / 2, hh = type === 'magma_cube' ? 2.4 : t.h;
      if (boxIntersectsBlocks(w, x + 0.5 - hw, y, z + 0.5 - hw, x + 0.5 + hw, y + hh, z + 0.5 + hw)) continue;
      if (type === 'ghast') { if (Math.random() < 0.5) continue; this.spawn(type, x + 0.5, y + 0.5, z + 0.5); }
      else { const k = type === 'zombie_pigman' ? R(1, 4) : 1; for (let i = 0; i < k; i++) this.spawn(type, x + 0.5 + (Math.random() - 0.5) * 0.4 * i, y, z + 0.5 + (Math.random() - 0.5) * 0.4 * i); }
    }
  }
  render(pt, daySub) { this.spawners.render(pt); const r = this.g.renderer; for (const m of this.mobs) m.render(r, pt, daySub); for (const e of this.misc) e.render(r, pt, daySub); }
  raycast(ox, oy, oz, dx, dy, dz, max) { let best = null; const own = this.g.player && this.g.player.riding; for (const m of this.mobs) { if (m.deathTime || m === own) continue; const b = m.box(); const hit = rayBox(ox, oy, oz, dx, dy, dz, b[0] - 0.1, b[1] - 0.1, b[2] - 0.1, b[3] + 0.1, b[4] + 0.1, b[5] + 0.1); if (hit && hit.t <= max && (!best || hit.t < best.t)) best = { mob: m, t: hit.t }; }
    for (const e of this.misc) { if (!e.vehicle || e.dead) continue; const b = e.box(); const hit = rayBox(ox, oy, oz, dx, dy, dz, b[0], b[1], b[2], b[3], b[4], b[5]); if (hit && hit.t <= max && (!best || hit.t < best.t)) best = { mob: e, t: hit.t }; }
    return best; }
  // pumpkin on a T of iron blocks becomes an iron golem
  tryBuildGolem(x, y, z) {
    const w = this.world, g = this.g;
    if (w.getBlock(x, y - 1, z) === 80 && w.getBlock(x, y - 2, z) === 80) { // snow golem: two snow blocks under a pumpkin
      for (let k = 0; k < 3; k++) { w.setBlock(x, y - k, z, 0, 0); g.ticker.notifyNeighbors(x, y - k, z); for (let i = 0; i < 6; i++) g.particles.fx('smoke', x + Math.random(), y - k + Math.random(), z + Math.random()); }
      this.spawn('snowman', x + 0.5, y - 2, z + 0.5); return true; }
    if (w.getBlock(x, y - 1, z) !== 42 || w.getBlock(x, y - 2, z) !== 42) return false;
    for (const [ax, az] of [[1, 0], [0, 1]]) {
      if (w.getBlock(x + ax, y - 1, z + az) !== 42 || w.getBlock(x - ax, y - 1, z - az) !== 42) continue;
      const cells = [[x, y, z], [x, y - 1, z], [x, y - 2, z], [x + ax, y - 1, z + az], [x - ax, y - 1, z - az]];
      for (const [cx, cy, cz] of cells) { w.setBlock(cx, cy, cz, 0, 0); g.ticker.notifyNeighbors(cx, cy, cz); for (let i = 0; i < 4; i++) g.particles.fx('smoke', cx + Math.random(), cy + Math.random(), cz + Math.random()); }
      const m = this.spawn('iron_golem', x + 0.5, y - 2, z + 0.5); m.built = true; g.sound('golem:attack', m, 1, 0.7); return true;
    }
    return false;
  }
  placeCart(x, y, z, yaw) { const c = new Minecart(this.world, x, y, z, yaw); this.misc.push(c); return c; }
  placeBoat(x, y, z, yaw) { const b = new Boat(this.world, x, y, z, yaw); this.misc.push(b); return b; }
  blocking(x, y, z) { return this.mobs.some(m => { if (m.deathTime) return false; const b = m.box(); return b[0] < x + 1 && b[3] > x && b[1] < y + 1 && b[4] > y && b[2] < z + 1 && b[5] > z; }) || this.misc.some(e => e instanceof PrimedTNT && e.x + 0.49 > x && e.x - 0.49 < x + 1 && e.y + 0.98 > y && e.y < y + 1 && e.z + 0.49 > z && e.z - 0.49 < z + 1); }
  hostileNear(x, y, z, r) { return this.mobs.some(m => m.hostile && !m.deathTime && Math.abs(m.x - x) < r && Math.abs(m.y - y) < 5 && Math.abs(m.z - z) < r); }
  attack(m, p) {
    const g = this.g; if (m.vehicle) { if (m.rider !== p) m.hit(g, p); return; } const held = p.inv.held; const it = held && items[held.id];
    let dmg = it && it.damage ? it.damage : 1; if (p.effects?.strength) dmg += 3; if (p.effects?.weakness) dmg = Math.max(0, dmg - 4); const crit = p.fall > 0 && !p.onGround && !p.inWater;
    if (crit) { dmg += R(0, Math.floor(dmg / 2) + 1); for (let i = 0; i < 12; i++) g.particles.fx('crit', m.x, m.y + m.h * 0.6, m.z); }
    if (m.hurt(dmg, 'player', p, g)) { if (!(m.type === 'wolf' && m.tame)) this.playerHurtBy(m); if (p.sprint) { const k = 0.5; m.mx += -Math.sin(p.yaw) * k; m.mz += -Math.cos(p.yaw) * k; p.sprint = false; } if (dmg >= 16) g.achievements.unlock('overkill'); if (it && it.tool) g.damageHeld(it.tool === 'sword' ? 1 : 2); p.addExhaustion(0.3); }
  }
  interact(m, p, held) {
    const g = this.g, inv = p.inv; if (m.deathTime || m.vehicle) return false;
    const fx = (k, n = 7) => { for (let i = 0; i < n; i++) g.particles.fx(k, m.x + Math.random() - 0.5, m.y + m.h + 0.2, m.z + Math.random() - 0.5); };
    if (m.leash === p) { m.unleash(g, !p.creative); return true; }
    if (held && held.id === 420 && !m.hostile && !m.leash && m.type !== 'villager' && !m.T.swims && !m.T.flies) { m.leash = p; m.sitting = false; if (!p.creative) inv.consumeHeld(); g.sound('step:cloth', m, 1, 1); return true; }
    if (held && held.id === 421 && g.openNameTag) { g.openNameTag(m, n => { m.nameTag = n; if (!p.creative) { const h = inv.slots[inv.selected]; if (h && h.id === 421) inv.consumeHeld(); } }); return true; }
    if (m.type === 'villager' && !m.baby && !p.sneak && g.openTrade && !(held && held.id === 383)) { g.openTrade(m); return true; }
    if (m.type === 'ocelot') {
      if (m.tame) { if (held && held.id === 349 && m.hp < 10) { m.hp = Math.min(10, m.hp + 2); if (!p.creative) inv.consumeHeld(); fx('heart', 3); return true; } m.sitting = !m.sitting; m.wander = null; return true; }
      if (held && held.id === 349 && Math.hypot(m.x - p.x, m.z - p.z) < 3) { if (!p.creative) inv.consumeHeld(); if (Math.random() < 1 / 3) { m.tame = true; m.color = R(0, 2); m.sitting = true; fx('heart'); } else fx('smoke'); return true; }
      return false;
    }
    if (m.type === 'wolf') {
      if (m.tame) { if (held && MEAT.includes(held.id) && m.hp < 20) { m.hp = Math.min(20, m.hp + (items[held.id].food || 2)); if (!p.creative) inv.consumeHeld(); fx('heart', 3); return true; } m.sitting = !m.sitting; m.target = null; m.wander = null; return true; }
      if (held && held.id === 352 && !(m.angry > 0)) { if (!p.creative) inv.consumeHeld(); if (Math.random() < 1 / 3) { m.tame = true; m.hp = 20; m.sitting = true; m.target = null; fx('heart'); } else fx('smoke'); return true; }
      return false;
    }
    const ride = () => { if (m.rider || m.baby || g.tickCount < (g.rideCD || 0)) return false; m.mount(p); g.rideCD = g.tickCount + 10; return true; };
    if (m.type === 'horse') {
      const food = held && HORSE_FOOD[held.id], max = m.maxHp || m.T.hp;
      if (food && (m.hp < max || !m.tame || m.baby)) { m.hp = Math.min(max, m.hp + food[0]); if (!m.tame) m.temper = Math.min(100, (m.temper || 0) + food[1]); if (m.baby) m.ageT = Math.min(0, m.ageT + 1200); if (!p.creative) inv.consumeHeld(); g.sound('eat', m, 0.6, 1); fx('heart', 2); return true; }
      if (m.tame && held && held.id === 329 && !m.saddled && !m.baby) { m.saddled = true; if (!p.creative) inv.consumeHeld(); g.sound('place:cloth', m, 1, 1); return true; }
      if (m.tame && p.sneak && held && held.id === 54 && !m.chest && m.kind && m.kind !== 'h' && !m.baby) { m.chest = true; m.hinv = new Array(15).fill(null); if (!p.creative) inv.consumeHeld(); g.sound('place:wood', m, 1, 1); return true; }
      if (m.tame && held && HORSE_ARMOR[held.id] && !m.armor && !m.baby && (m.kind || 'h') === 'h') { m.armor = held.id; if (!p.creative) inv.consumeHeld(); g.sound('anvil', m, 0.3, 1.6); return true; }
      if (m.tame && held && HORSE_BREED.has(held.id) && m.ageT === 0 && m.love <= 0 && m.kind !== 'm') { m.love = 600; if (!p.creative) inv.consumeHeld(); return true; }
      if (p.sneak) { if (m.tame && !m.baby && g.openHorse) { g.openHorse(m); return true; } return false; }
      return ride();
    }
    if (m.type === 'pig' && m.saddled && (!held || held.id !== 329)) return ride();
    if (!held) return false;
    if (m.type === 'mooshroom' && held.id === 281) { if (held.count > 1) { held.count--; if (inv.add({ id: 282, count: 1, dmg: 0 }) > 0) g.spawnDrop(p.x, p.y + 1, p.z, { id: 282, count: 1, dmg: 0 }); } else inv.slots[inv.selected] = { id: 282, count: 1, dmg: 0 }; return true; }
    if (m.type === 'mooshroom' && held.id === 359 && !m.baby) { m.dead = true; const c = this.spawn('cow', m.x, m.y, m.z); c.yaw = c.pyaw = m.yaw; c.hp = m.hp; for (let i = 0; i < 5; i++) g.spawnDrop(m.x, m.y + m.h, m.z, { id: 40, count: 1, dmg: 0 }); g.particles.fx('explode', m.x, m.y + m.h / 2, m.z, 4); g.damageHeld(1); return true; }
    if ((m.type === 'cow' || m.type === 'mooshroom') && held.id === 325) { if (p.creative) return true; if (held.count > 1) { held.count--; if (inv.add({ id: 335, count: 1, dmg: 0 }) > 0) g.spawnDrop(p.x, p.y + 1, p.z, { id: 335, count: 1, dmg: 0 }); } else inv.slots[inv.selected] = { id: 335, count: 1, dmg: 0 }; return true; }
    if (m.type === 'sheep' && held.id === 359 && !m.sheared && !m.baby) { m.sheared = true; for (let i = R(1, 3); i > 0; i--) { const e = g.spawnDrop(m.x, m.y + 1, m.z, { id: 35, count: 1, dmg: m.color || 0 }); e.my = Math.random() * 0.05; e.mx += (Math.random() - Math.random()) * 0.1; e.mz += (Math.random() - Math.random()) * 0.1; } g.damageHeld(1); g.sound('step:cloth', m); return true; }
    if (m.type === 'sheep' && held.id === 351 && !m.sheared) { m.color = 15 - (held.dmg || 0); if (!p.creative) inv.consumeHeld(); return true; }
    if (m.type === 'pig' && held.id === 329 && !m.saddled && !m.baby) { m.saddled = true; if (!p.creative) inv.consumeHeld(); return true; }
    if (held.id === m.T.food && m.ageT === 0 && m.love <= 0) { m.love = 600; if (!p.creative) inv.consumeHeld(); return true; }
    return false;
  }
  spawnFireball(src, t, kind) {
    const sy = src.y + (kind === 'fireball' ? 2.2 : 1.4); const fwd = kind === 'fireball' ? 2.5 : 0.6; let dx = t.x - src.x, dy = (t.eyeY ?? t.y + 1) - 0.4 - sy, dz = t.z - src.z; const d = Math.hypot(dx, dy, dz) || 1;
    const sp = kind === 'fireball' ? 0.7 : 0.9, spr = kind === 'smallfire' ? 0.08 : 0.02; dx = dx / d + (Math.random() - 0.5) * spr; dy = dy / d + (Math.random() - 0.5) * spr; dz = dz / d + (Math.random() - 0.5) * spr;
    const e = new Projectile(this.world, kind, src, src.x + dx * fwd, sy, src.z + dz * fwd, dx * sp, dy * sp, dz * sp); this.misc.push(e); return e;
  }
  // tame wolves defend their owner
  playerHurtBy(mob) { if (!mob || !mob.mob) return; for (const w of this.mobs) if (w.type === 'wolf' && w.tame && !w.sitting && !w.deathTime && w !== mob && Math.hypot(w.x - mob.x, w.z - mob.z) < 24) w.target = mob; }
  // right-clicking a fence ties every mob led by the player to it, or takes back the ones tied there
  leashFence(p, x, y, z) { const near = m => !m.deathTime && Math.abs(m.x - x - 0.5) < 7 && Math.abs(m.y - y) < 7 && Math.abs(m.z - z - 0.5) < 7; let n = 0;
    for (const m of this.mobs) if (m.leash === p && near(m)) { m.leash = { fence: true, x, y, z }; n++; }
    if (!n) for (const m of this.mobs) if (m.leash && m.leash.fence && m.leash.x === x && m.leash.y === y && m.leash.z === z) { m.leash = p; n++; }
    if (n) this.g.sound('step:cloth', { x, y, z }, 1, 1); return n > 0; }
  useEgg(type, x, y, z) { if (!TYPES[type]) return false; const m = this.spawn(type, x + 0.5, y, z + 0.5); if (type === 'ghast') m.y += 0.5; m.yaw = m.pyaw = m.headYaw = Math.random() * Math.PI * 2; if (m.T.npc || m.T.neutral || !m.hostile) m.home = [m.x, m.z]; return true; }
  spawnArrow(src, tx, ty, tz, speed, spread) {
    const sx = src.x, sy = src.y + src.T.eye - 0.1, sz = src.z; let dx = tx - sx, dy = ty - sy, dz = tz - sz; const hd = Math.hypot(dx, dz); dy += hd * 0.2; const d = Math.hypot(dx, dy, dz) || 1;
    const s = spread * 0.0075; dx = dx / d + (Math.random() - 0.5) * 2 * s; dy = dy / d + (Math.random() - 0.5) * 2 * s; dz = dz / d + (Math.random() - 0.5) * 2 * s;
    const e = new Projectile(this.world, 'arrow', src, sx + dx / d * 0.5, sy, sz + dz / d * 0.5, dx * speed, dy * speed, dz * speed); this.misc.push(e); return e;
  }
  shootArrow(p) {
    const g = this.g; if (!p.creative && p.inv.count(262) <= 0) return;
    const dx = -Math.sin(p.yaw) * Math.cos(p.pitch), dy = Math.sin(p.pitch), dz = -Math.cos(p.yaw) * Math.cos(p.pitch); const s = 3;
    const e = new Projectile(this.world, 'arrow', p, p.x + dx * 0.4, p.eyeY - 0.1, p.z + dz * 0.4, dx * s + (Math.random() - 0.5) * 0.01, dy * s, dz * s + (Math.random() - 0.5) * 0.01); e.crit = true; this.misc.push(e);
    g.sound('bow', p, 1, 1 / (Math.random() * 0.4 + 1.2) + 0.5); g.damageHeld(1); if (!p.creative) p.inv.remove(262, 1); p.swing = 6;
  }
  // splash potion: a mob (src) lobs it at the player p, or the player (p null) throws it where they look
  throwPotion(src, p, dmg = POT.harming | SPLASH) {
    let sx, sy, sz, vx, vy, vz;
    if (p) { sx = src.x; sy = src.y + src.T.eye - 0.1; sz = src.z; let dx = p.x + p.mx * 4 - sx, dy = p.eyeY - 1.1 - sy, dz = p.z + p.mz * 4 - sz; const hd = Math.hypot(dx, dz) || 1; dy += hd * 0.2; const d = Math.hypot(dx, dy, dz) || 1; vx = dx / d * 0.75; vy = dy / d * 0.75; vz = dz / d * 0.75; }
    else { const dx = -Math.sin(src.yaw) * Math.cos(src.pitch), dy = Math.sin(src.pitch + 0.35), dz = -Math.cos(src.yaw) * Math.cos(src.pitch); sx = src.x + dx * 0.4; sy = src.eyeY - 0.1; sz = src.z + dz * 0.4; vx = dx * 0.5; vy = dy * 0.5; vz = dz * 0.5; }
    const e = new Projectile(this.world, 'potion', src, sx, sy, sz, vx, vy, vz); e.potion = dmg; this.misc.push(e); src.swing = 6; this.g.sound('bow', src, 0.5, 0.4);
  }
  throwItem(p, id) {
    const dx = -Math.sin(p.yaw) * Math.cos(p.pitch), dy = Math.sin(p.pitch), dz = -Math.cos(p.yaw) * Math.cos(p.pitch); const s = 1.5;
    this.misc.push(new Projectile(this.world, id === 344 ? 'egg' : 'snowball', p, p.x + dx * 0.4, p.eyeY - 0.1, p.z + dz * 0.4, dx * s, dy * s, dz * s)); this.g.sound('bow', p, 0.5, 0.4); p.swing = 6;
  }
  spawnTNT(x, y, z, fuse = 80) { this.misc.push(new PrimedTNT(this.world, x + 0.5, y, z + 0.5, fuse)); this.g.sound('fuse', { x, y, z }, 1, 1); }
  // classic ray-based explosion
  explode(x, y, z, power, source) {
    const g = this.g, w = this.world; g.sound('explode', { x, y, z }, 4, (1 + (Math.random() - Math.random()) * 0.2) * 0.7);
    g.particles.fx('explode', x, y, z, 16); for (let i = 0; i < 24; i++) g.particles.fx('smoke', x + (Math.random() - 0.5) * power * 1.5, y + (Math.random() - 0.5) * power, z + (Math.random() - 0.5) * power * 1.5);
    const hit = new Map();
    for (let i = 0; i < 16; i++) for (let j = 0; j < 16; j++) for (let k = 0; k < 16; k++) {
      if (i && i !== 15 && j && j !== 15 && k && k !== 15) continue;
      let dx = i / 15 * 2 - 1, dy = j / 15 * 2 - 1, dz = k / 15 * 2 - 1; const d = Math.hypot(dx, dy, dz); dx /= d; dy /= d; dz /= d;
      let f = power * (0.7 + Math.random() * 0.6), px = x, py = y, pz = z;
      for (; f > 0; f -= 0.225) { const bx = Math.floor(px), by = Math.floor(py), bz = Math.floor(pz); const id = w.getBlock(bx, by, bz);
        if (id) { const res = isFluid(id) ? 100 : BL[id].resistance / 5; f -= (res + 0.3) * 0.3; }
        if (f > 0 && id && by > 0) hit.set(bx + ',' + by + ',' + bz, [bx, by, bz, id]);
        px += dx * 0.3; py += dy * 0.3; pz += dz * 0.3; }
    }
    for (const [bx, by, bz, id] of hit.values()) {
      if (w.getBlock(bx, by, bz) !== id) continue; const meta = w.getMeta(bx, by, bz);
      const tile = w.getTile(bx, by, bz); if (tile) for (const s of [...(tile.items || []), ...(tile.slots || [])]) if (s) g.spawnDrop(bx + 0.5, by + 0.5, bz + 0.5, { ...s });
      w.setBlock(bx, by, bz, 0, 0);
      if (id === 46) { this.spawnTNT(bx, by, bz, R(10, 30)); continue; }
      if (Math.random() < 0.3 && !isFluid(id)) for (const s of g.dropsFor(id, meta, null)) g.spawnDrop(bx + 0.5, by + 0.5, bz + 0.5, s);
      if (Math.random() < 0.2) g.particles.fx('smoke', bx + 0.5, by + 0.5, bz + 0.5);
    }
    for (const [bx, by, bz, id] of hit.values()) { g.ticker.notifyNeighbors(bx, by, bz); if (id === 69) g.updateIronDoors(bx, by, bz); }
    // damage + knockback
    const R2 = power * 2; const ents = [g.player, ...this.mobs.filter(m => !m.deathTime), ...g.entities, ...this.misc.filter(e => e instanceof PrimedTNT)];
    for (const e of ents) { if (e === source) continue; const ey = e.y + (e.h || 0.5) / 2; const ddx = e.x - x, ddy = ey - y, ddz = e.z - z; const dist = Math.hypot(ddx, ddy, ddz); if (dist > R2 || dist < 1e-4) continue;
      const blocked = raycast(w, x, y, z, ddx / dist, ddy / dist, ddz / dist, dist); const exposure = blocked ? 0.35 : 1; const imp = (1 - dist / R2) * exposure;
      const dmg = Math.floor((imp * imp + imp) / 2 * 8 * power + 1);
      if (e === g.player) { if (!e.creative) { const diff = g.settings.difficulty; const d2 = diff === 0 ? 0 : diff === 1 ? Math.floor(dmg / 2) + 1 : diff === 3 ? Math.floor(dmg * 3 / 2) : dmg; if (d2 > 0) e.damage(d2, 'explosion'); } }
      else if (e.mob) e.hurt(dmg, 'explosion', null, g);
      else if (e.type === 'item' && imp > 0.5) e.dead = true;
      e.mx += ddx / dist * imp; e.my += ddy / dist * imp; e.mz += ddz / dist * imp; }
  }
}
