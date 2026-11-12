// First-person player: classic 20 TPS movement physics, survival stats
import { moveEntity, boxIntersectsBlocks, applyCurrent } from '../engine/physics.js';
import { tickEffects, hasEffect } from '../inventory/potions.js';
import { blocks as BL, OPAQUE, isWater, isLava } from '../world/blocks.js';
import { Inventory } from '../inventory/inventory.js';
import { items } from '../inventory/items.js';
import { Sound } from '../engine/audio.js';

export class Player {
  constructor() {
    this.x = 0; this.y = 80; this.z = 0; this.px = 0; this.py = 80; this.pz = 0; this.mx = 0; this.my = 0; this.mz = 0;
    this.yaw = 0; this.pitch = 0; this.w = 0.6; this.h = 1.8; this.eye = 1.62; this.onGround = false;
    this.health = 20; this.food = 20; this.sat = 5; this.exhaust = 0; this.foodTimer = 0; this.air = 300;
    this.xpLevel = 0; this.xp = 0; this.xpTotal = 0; this.fall = 0; this.hurtTime = 0; this.invuln = 0; this.dead = false;
    this.inv = new Inventory(); this.creative = false; this.flying = false; this.sneak = false; this.sprint = false;
    this.walkDist = 0; this.pWalkDist = 0; this.bob = 0; this.pBob = 0; this.stepDist = 0; this.jumpTicks = 0; this.lastSpace = -99; this.lastW = -99; this.ticks = 0;
    this.inWater = false; this.inLava = false; this.eyeInWater = false; this.fireTicks = 0; this.effects = {}; this.spawn = null; this.swing = 0; this.attackCooldown = 0;
  }
  get eyeY() { return this.y + this.eye - (this.sneak ? 0.08 : 0); }
  xpNeeded() { return 7 + (this.xpLevel * 7 >> 1); } // 1.2.5 formula
  addXP(n) { this.xpTotal += n; this.xp += n / this.xpNeeded(); while (this.xp >= 1) { this.xp = (this.xp - 1) * this.xpNeeded(); this.xpLevel++; this.xp /= this.xpNeeded(); if (this.xpLevel % 5 === 0) Sound.play('levelup'); } }
  addExhaustion(v) { if (!this.creative) this.exhaust = Math.min(40, this.exhaust + v); }
  damage(n, src = 'generic') {
    if (this.creative && src !== 'void') return false; if (this.dead) return false;
    if ((src === 'fire' || src === 'lava') && hasEffect(this, 'fire_resistance')) { this.fireTicks = 0; return false; }
    if (this.invuln > 10 && n <= this.lastDmg) return false;
    if (src !== 'fall' && src !== 'drown' && src !== 'starve' && src !== 'suffocate' && src !== 'void' && src !== 'fire' && src !== 'magic') { const ap = this.inv.armorPoints(); const raw = n * (25 - ap) + (this.carry || 0); n = Math.floor(raw / 25); this.carry = raw % 25; this.damageArmor(); }
    this.lastDmg = n; this.invuln = 20; this.hurtTime = 10; this.health -= n; this.addExhaustion(0.3);
    Sound.play('hurt'); if (this.health <= 0) { this.health = 0; this.dead = true; this.deathCause = src; }
    return true;
  }
  damageArmor(n = 1) { for (let i = 0; i < 4; i++) { const a = this.inv.armor[i]; if (!a) continue; const it = items[a.id]; a.dmg = (a.dmg || 0) + Math.max(1, n >> 2); if (it && it.durability && a.dmg >= it.durability) { this.inv.armor[i] = null; Sound.play('dig:wood', 0.8, 0.6); } } }
  heal(n) { this.health = Math.min(20, this.health + n); }

  tick(world, input, difficulty = 2) {
    this.ticks++; this.px = this.x; this.py = this.y; this.pz = this.z; this.pWalkDist = this.walkDist; this.pBob = this.bob;
    if (this.hurtTime > 0) this.hurtTime--; if (this.invuln > 0) this.invuln--; if (this.swing > 0) this.swing--;
    if (this.dead) return;
    // fluids
    const feetB = world.getBlock(Math.floor(this.x), Math.floor(this.y + 0.4), Math.floor(this.z));
    this.inWater = this._inFluid(world, isWater); this.inLava = this._inFluid(world, isLava);
    const eb = world.getBlock(Math.floor(this.x), Math.floor(this.eyeY), Math.floor(this.z));
    this.eyeInWater = isWater(eb) ? 'water' : isLava(eb) ? 'lava' : null;
    if (isWater(eb) && this.eyeInWater) { const m = world.getMeta(Math.floor(this.x), Math.floor(this.eyeY), Math.floor(this.z)); const h = m >= 8 ? 1 : (8 - m) / 9; if (this.eyeY - Math.floor(this.eyeY) > h && !isWater(world.getBlock(Math.floor(this.x), Math.floor(this.eyeY) + 1, Math.floor(this.z)))) this.eyeInWater = null; }
    // input vector
    let fw = (input.forward ? 1 : 0) - (input.back ? 1 : 0), st = (input.left ? 1 : 0) - (input.right ? 1 : 0);
    this.sneak = !!input.sneak && !this.flying;
    if (this.sneak) { fw *= 0.3; st *= 0.3; }
    // sprint: double tap W or ctrl
    if (input.forwardPressed) { if (this.ticks - this.lastW < 7 && (this.food > 6 || this.creative)) this.sprint = true; this.lastW = this.ticks; }
    if (input.sprint && fw > 0 && (this.food > 6 || this.creative) && !this.sneak) this.sprint = true;
    if (fw <= 0 || this.sneak || (!this.creative && this.food <= 6) || this.hcol) this.sprint = false;
    // creative flight toggle (double-tap jump)
    if (input.jumpPressed && this.creative) { if (this.ticks - this.lastSpace < 7) { this.flying = !this.flying; this.my = 0; } this.lastSpace = this.ticks; }
    if (!this.creative) this.flying = false;
    const climb = BL[feetB]?.climbable || BL[world.getBlock(Math.floor(this.x), Math.floor(this.y), Math.floor(this.z))]?.climbable;
    const s = Math.sin(this.yaw), c = Math.cos(this.yaw);
    const moveRel = (speed) => { let d = fw * fw + st * st; if (d < 0.0001) return; d = Math.sqrt(d); if (d < 1) d = 1; const f = speed / d; const a = fw * f, b = st * f; this.mx += -s * a - c * b; this.mz += -c * a + s * b; };
    const startY = this.y;
    if (this.riding) {
      // seated: the boat moves us (see Boat.seat)
    } else if (this.flying) {
      if (input.jump) this.my += 0.15; if (input.sneak) this.my -= 0.15;
      moveRel(this.sprint ? 0.1 : 0.05);
      this._move(world, true); this.mx *= 0.91; this.mz *= 0.91; this.my *= 0.6;
      if (this.onGround) this.flying = false;
    } else if (this.inWater || this.inLava) {
      if (input.jump) this.my += 0.04;
      if (this.inWater) { const hw = this.w / 2 - 0.001; applyCurrent(world, this, this.x - hw, this.y + 0.4, this.z - hw, this.x + hw, this.y + this.h - 0.4, this.z + hw); }
      moveRel(0.02); this._move(world, false);
      const k = this.inWater ? 0.8 : 0.5; this.mx *= k; this.my *= k; this.mz *= k; this.my -= 0.02;
      if (this.hcol && this._fits(world, this.x, this.y + 0.6, this.z)) this.my = 0.3;
    } else {
      if (input.jump && this.onGround && this.jumpTicks === 0) { this.my = 0.42; this.jumpTicks = 10; if (this.sprint) { this.mx -= s * 0.2; this.mz -= c * 0.2; } this.addExhaustion(this.sprint ? 0.8 : 0.2); }
      const under = world.getBlock(Math.floor(this.x), Math.floor(this.y - 0.5), Math.floor(this.z));
      const slip = this.onGround ? (BL[under]?.slippery ? 0.98 : 0.6) * 0.91 : 0.91;
      const fxm = (hasEffect(this, 'speed') ? 1.2 : 1) * (hasEffect(this, 'slowness') ? 0.85 : 1);
      const accel = this.onGround ? 0.1 * fxm * (this.sprint ? 1.3 : 1) * (0.16277136 / (slip * slip * slip)) : 0.02 * (this.sprint ? 1.3 : 1);
      moveRel(accel);
      if (climb) { this.mx = Math.max(-0.15, Math.min(0.15, this.mx)); this.mz = Math.max(-0.15, Math.min(0.15, this.mz)); this.fall = 0; if (this.my < -0.15) this.my = -0.15; if (this.sneak && this.my < 0) this.my = 0; }
      this._move(world, false);
      if (climb && this.hcol) this.my = 0.2;
      this.my -= 0.08; this.my *= 0.98; this.mx *= slip; this.mz *= slip;
    }
    if (this.jumpTicks > 0) this.jumpTicks--;
    if (!input.jump) this.jumpTicks = 0;
    // walking distance (footsteps / bobbing)
    const dx = this.x - this.px, dz = this.z - this.pz; const hd = Math.sqrt(dx * dx + dz * dz);
    this.walkDist += hd * 0.6; this.bob += ((this.onGround ? Math.min(0.1, hd) : 0) - this.bob) * 0.4;
    if (this.onGround && !this.sneak) { this.stepDist += hd; if (this.stepDist > 1.6 * 0.6 / 0.6 * 1.0) { this.stepDist = 0; const ub = world.getBlock(Math.floor(this.x), Math.floor(this.y - 0.2), Math.floor(this.z)); const b = BL[ub]; if (b && ub) Sound.play('step:' + (ub === 2 ? 'grass' : b.sound), 0.8); } }
    if (this.inWater && hd > 0.05 && this.ticks % 12 === 0) Sound.play('swim', 0.5);
    if (hd > 0.01) this.addExhaustion((this.inWater ? 0.015 : this.sprint ? 0.1 : 0.01) * hd * 10 / 10);
    this.survivalTick(world, difficulty);
  }
  _inFluid(world, test) { const hw = this.w / 2 - 0.001; for (let x = Math.floor(this.x - hw); x <= Math.floor(this.x + hw); x++) for (let z = Math.floor(this.z - hw); z <= Math.floor(this.z + hw); z++) for (let y = Math.floor(this.y + 0.4); y <= Math.floor(this.y + this.h - 0.4); y++) if (test(world.getBlock(x, y, z))) return true; return false; }
  _fits(world, x, y, z) { const hw = this.w / 2; return !boxIntersectsBlocks(world, x - hw, y, z - hw, x + hw, y + this.h, z + hw); }
  _move(world, flying) {
    let mx = this.mx, mz = this.mz;
    // sneaking: don't walk off edges
    if (this.sneak && this.onGround) {
      const hw = this.w / 2, st = 0.05; const free = (x, z) => !boxIntersectsBlocks(world, x - hw, this.y - 1, z - hw, x + hw, this.y - 0.01, z + hw);
      while (mx !== 0 && free(this.x + mx, this.z)) { if (Math.abs(mx) < st) mx = 0; else mx -= Math.sign(mx) * st; }
      while (mz !== 0 && free(this.x, this.z + mz)) { if (Math.abs(mz) < st) mz = 0; else mz -= Math.sign(mz) * st; }
      while (mx !== 0 && mz !== 0 && free(this.x + mx, this.z + mz)) { if (Math.abs(mx) < st) mx = 0; else mx -= Math.sign(mx) * st; if (Math.abs(mz) < st) mz = 0; else mz -= Math.sign(mz) * st; }
    }
    const wasGround = this.onGround;
    const r = moveEntity(world, this, mx, this.my, mz, 0.5);
    this.hcol = r.hx || r.hz;
    if (r.hx) this.mx = 0; if (r.hz) this.mz = 0;
    if (r.hy) { if (this.my < 0) this._land(); this.my = 0; }
    this.onGround = r.onGround;
    if (!this.onGround && r.dy < 0 && !flying) this.fall -= r.dy;
    if (this.inWater || flying) this.fall = 0;
  }
  _land() {
    if (this.fall > 3 && !this.inWater) { const d = Math.ceil(this.fall - 3); if (!this.creative) { this.damage(d, 'fall'); Sound.play('fall'); } }
    this.fall = 0;
  }
  survivalTick(world, difficulty = 2) {
    if (this.y < -64) this.damage(4, 'void');
    if (this.creative) { this.air = 300; return; }
    tickEffects(this, n => { if (this.health > 1) { const iv = this.invuln; this.invuln = 0; this.damage(1, 'magic'); this.invuln = Math.max(iv, 0); } }, n => { if (this.health < 20) this.health = Math.min(20, this.health + n); });
    // drowning
    if (this.eyeInWater === 'water') { this.air--; if (this.air <= -20) { this.air = 0; this.damage(2, 'drown'); } } else this.air = 300;
    // lava & fire
    if (this.inLava) { this.damage(4, 'lava'); this.fireTicks = 300; }
    else { const fx = Math.floor(this.x), fz = Math.floor(this.z); if (world.getBlock(fx, Math.floor(this.y), fz) === 51 || world.getBlock(fx, Math.floor(this.y + 1), fz) === 51) { this.damage(1, 'fire'); this.fireTicks = Math.max(this.fireTicks, 160); } }
    if (this.fireTicks > 0) { if (this.inWater) this.fireTicks = 0; else { this.fireTicks--; if (this.fireTicks % 20 === 0) this.damage(1, 'fire'); } }
    // cactus
    const hw = this.w / 2 + 0.01; for (const [ox, oz] of [[-hw, 0], [hw, 0], [0, -hw], [0, hw]]) { if (world.getBlock(Math.floor(this.x + ox), Math.floor(this.y + 0.5), Math.floor(this.z + oz)) === 81) { this.damage(1, 'cactus'); break; } }
    // suffocation
    const hb = world.getBlock(Math.floor(this.x), Math.floor(this.eyeY), Math.floor(this.z)); if (OPAQUE[hb] && BL[hb].solid) { if (this.ticks % 10 === 0) this.damage(1, 'suffocate'); }
    // hunger (1.2.5 FoodStats)
    if (this.exhaust > 4) { this.exhaust -= 4; if (this.sat > 0) this.sat = Math.max(0, this.sat - 1); else this.food = Math.max(0, this.food - 1); }
    if (this.food >= 18) { if (++this.foodTimer >= 80) { if (this.health < 20) { this.heal(1); this.addExhaustion(3); } this.foodTimer = 0; } }
    else if (this.food <= 0) { if (++this.foodTimer >= 80) { if (this.health > (difficulty === 3 ? 0 : 10)) this.damage(1, 'starve'); this.foodTimer = 0; } }
    else this.foodTimer = 0;
  }
  eat(item) { this.food = Math.min(20, this.food + item.food); this.sat = Math.min(this.food, this.sat + item.food * item.sat * 2); }
  toJSON() { return { x: this.x, y: this.y, z: this.z, yaw: this.yaw, pitch: this.pitch, health: this.health, food: this.food, sat: this.sat, exhaust: this.exhaust, xpLevel: this.xpLevel, xp: this.xp, xpTotal: this.xpTotal, air: this.air, inv: this.inv.toJSON(), flying: this.flying, spawn: this.spawn, fall: this.fall, effects: this.effects }; }
  load(d) { if (!d) return; for (const k of ['x', 'y', 'z', 'yaw', 'pitch', 'health', 'food', 'sat', 'exhaust', 'xpLevel', 'xp', 'xpTotal', 'air', 'flying', 'spawn', 'fall']) if (d[k] !== undefined) this[k] = d[k]; if (d.effects) this.effects = d.effects; this.inv.load(d.inv); this.px = this.x; this.py = this.y; this.pz = this.z; }
}
