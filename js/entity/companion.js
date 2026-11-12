import * as THREE from 'three';
import { Player } from './player.js';
import { buildModel } from './models.js';
import { pose, lightCurve } from '../engine/playermodel.js';
import { Skins } from '../engine/skin.js';
import { blocks as BL, SOLID, SHAPE, SH } from '../world/blocks.js';
import { items } from '../inventory/items.js';

function makeNameplate(name) {
  const canvas = document.createElement('canvas');
  canvas.width = 192; canvas.height = 40;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(12, 18, 12, .78)'; ctx.fillRect(2, 3, 188, 34);
  ctx.fillStyle = '#78945c'; ctx.fillRect(2, 3, 3, 34);
  ctx.font = 'bold 21px monospace'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#edf3df'; ctx.fillText(name, 12, 20);
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = tex.minFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sprite.scale.set(1.25, 0.27, 1); sprite.position.y = 2.22; sprite.renderOrder = 3;
  return sprite;
}

export class Companion {
  constructor(game, name = 'Moss') {
    this.game = game;
    this.name = name;
    this.body = new Player();
    this.body.creative = true;
    this.body.health = 20;
    this.body.food = 20;
    const p = game.player;
    this.body.x = p.x + Math.sin(p.yaw) * 4.5;
    this.body.y = p.y;
    this.body.z = p.z + Math.cos(p.yaw) * 4.5;
    this.body.yaw = this.body.pyaw = p.yaw + Math.PI;
    this.body.px = this.body.x; this.body.py = this.body.y; this.body.pz = this.body.z;
    this.order = { mode: 'follow' };
    this.miningTicks = 0;
    this.limb = 0;
    this.limbAmount = 0;
    this.model = buildModel('steve');
    Skins.apply(this.model.mat, Skins.current);
    this.removeSkinListener = Skins.onChange(skin => Skins.apply(this.model.mat, skin));
    game.renderer.scene.add(this.model.root);
    this.nameplate = makeNameplate(name);
    game.renderer.scene.add(this.nameplate);
    this.model.root.add(this.nameplate);
  }

  follow() {
    this.order = { mode: 'follow' };
    this.miningTicks = 0;
  }

  goTo(x, z) {
    this.order = { mode: 'wander', x, z };
  }

  mineBlock(x, y, z) {
    const id = this.game.world.getBlock(x, y, z);
    if (!id || !BL[id] || BL[id].hardness < 0) return { ok: false, message: 'That block cannot be mined.' };
    if (Math.abs(y + .5 - this.body.y) > 2.8) return { ok: false, message: 'That block is too high or low for me to reach.' };
    this.order = { mode: 'mine', x, y, z };
    this.miningTicks = 0;
    return { ok: true, block: BL[id].name, message: `Heading to the ${BL[id].name}.` };
  }

  placeBlock(x, y, z, blockId) {
    const g = this.game, w = g.world, p = g.player;
    const stackIndex = this.body.inv.slots.findIndex(s => s?.id === blockId && items[blockId]?.block !== undefined);
    if (stackIndex < 0) return { ok: false, message: `I don't have ${BL[blockId]?.name || 'that block'} to place.` };
    if (Math.hypot(x + .5 - p.x, z + .5 - p.z) > 10) return { ok: false, message: 'That spot is too far from us.' };
    if (Math.hypot(x + .5 - this.body.x, z + .5 - this.body.z) > 10) return { ok: false, message: 'That spot is too far away.' };
    if (y < 1 || y > 126 || !SOLID[w.getBlock(x, y - 1, z)] || (w.getBlock(x, y, z) && !BL[w.getBlock(x, y, z)]?.replaceable)) {
      return { ok: false, message: 'That is not a clear place to build.' };
    }
    if (Math.abs(x + .5 - p.x) < .8 && Math.abs(z + .5 - p.z) < .8 && y < p.y + 2) return { ok: false, message: 'That would block your space.' };
    if (SHAPE[items[blockId].block] !== SH.cube) return { ok: false, message: 'I can only place full blocks right now.' };
    w.setBlock(x, y, z, items[blockId].block, 0);
    g.ticker.notifyNeighbors(x, y, z);
    const stack = this.body.inv.slots[stackIndex];
    stack.count--;
    if (stack.count <= 0) this.body.inv.slots[stackIndex] = null;
    this.body.swing = 6;
    return { ok: true, message: `Placed ${BL[items[blockId].block]?.name || 'a block'}.` };
  }

  nearbyLogs(radius = 10) {
    const g = this.game, p = g.player, found = [];
    const cx = Math.floor(p.x), cy = Math.floor(p.y), cz = Math.floor(p.z);
    for (let x = cx - radius; x <= cx + radius; x++) for (let z = cz - radius; z <= cz + radius; z++) {
      if (Math.hypot(x + .5 - p.x, z + .5 - p.z) > radius) continue;
      for (let y = Math.max(1, cy - 2); y <= Math.min(126, cy + 3); y++) {
        const id = g.world.getBlock(x, y, z);
        if (id === 17 || id === 162) found.push({ x, y, z, name: BL[id].name, distance: Math.hypot(x + .5 - p.x, y + .5 - p.y, z + .5 - p.z) });
      }
    }
    return found.sort((a, b) => a.distance - b.distance).slice(0, 6);
  }

  tick() {
    const g = this.game, player = g.player, a = this.body, order = this.order;
    if (!player || player.dead || !g.world) return;
    let tx, tz, working = false;
    if (order.mode === 'mine') { tx = order.x + .5; tz = order.z + .5; working = true; }
    else if (order.mode === 'wander') { tx = order.x; tz = order.z; }
    else {
      const behindX = Math.sin(player.yaw) * 4.5;
      const behindZ = Math.cos(player.yaw) * 4.5;
      tx = player.x + behindX; tz = player.z + behindZ;
    }
    const dx = tx - a.x, dz = tz - a.z, distance = Math.hypot(dx, dz);
    const closeEnough = working ? distance < 2.55 && Math.abs(a.y - order.y) < 2.4 : distance < 1.1;
    const input = { forward: !closeEnough, back: false, left: false, right: false, jump: false, sneak: false, sprint: distance > 5 };
    if (!closeEnough) {
      a.yaw = Math.atan2(-dx, -dz);
      input.jump = !!(a.onGround && a.hcol);
    } else {
      const lookX = player.x - a.x, lookZ = player.z - a.z;
      if (Math.hypot(lookX, lookZ) > .05) a.yaw = Math.atan2(-lookX, -lookZ);
    }
    a.tick(g.world, input, g.settings.difficulty);
    this.collectDrops();
    const speed = Math.hypot(a.x - a.px, a.z - a.pz);
    this.limbAmount += (Math.min(1, speed * 4) - this.limbAmount) * .18;
    this.limb += speed * 6.7;

    if (order.mode === 'mine') {
      if (g.world.getBlock(order.x, order.y, order.z) === 0) {
        this.follow();
      } else if (closeEnough) {
        this.miningTicks++;
        if (this.miningTicks % 9 === 1) a.swing = 6;
        if (this.miningTicks >= 26) this.finishMining();
      } else this.miningTicks = 0;
    } else if (order.mode === 'wander' && closeEnough) this.follow();
  }

  collectDrops() {
    const g = this.game, a = this.body;
    for (const drop of g.entities) {
      if (drop.type !== 'item' || drop.dead || drop.pickupDelay > 0 ||
          Math.hypot(drop.x - a.x, drop.y - a.y, drop.z - a.z) > 1.35) continue;
      const count = drop.stack.count, left = a.inv.add(drop.stack);
      if (left < count) {
        if (left <= 0) drop.dead = true;
        else drop.stack.count = left;
      }
    }
  }

  finishMining() {
    const g = this.game, task = this.order, oldPlayer = g.player;
    const block = BL[g.world.getBlock(task.x, task.y, task.z)];
    if (!block) { this.follow(); return; }
    g.player = this.body;
    try { g.breakBlock(task.x, task.y, task.z, true); }
    finally { g.player = oldPlayer; }
    this.game.companionChat?.say(`I got the ${block.name}.`);
    this.follow();
  }

  render(pt, daySub) {
    const g = this.game, a = this.body, root = this.model.root;
    const x = a.px + (a.x - a.px) * pt, y = a.py + (a.y - a.py) * pt, z = a.pz + (a.z - a.pz) * pt;
    root.position.set(x, y - (a.sneak ? .125 : 0), z);
    root.rotation.set(0, a.yaw, 0);
    pose(this.model, {
      headYaw: 0, pitch: 0, limb: this.limb, amt: this.limbAmount,
      sneak: false, swing: a.swing > 0 ? 1 - (a.swing - pt) / 6 : 0,
      holding: false, sitting: false,
    });
    const light = lightCurve(g.world, Math.floor(x), Math.floor(y + 1), Math.floor(z), daySub);
    this.model.mat.color.setRGB(light, light, light);
  }

  dispose(scene) {
    this.removeSkinListener?.();
    if (this.model) {
      scene.remove(this.model.root);
      this.model.root.traverse(o => {
        if (o.geometry) o.geometry.dispose();
        if (o.material && !o.material.map) o.material.dispose();
      });
    }
    if (this.nameplate?.material?.map) this.nameplate.material.map.dispose();
  }
}
