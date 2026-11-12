// Multiplayer client: joins a named server hosted by server.js through the websim realtime room,
// syncs player-made block edits, positions, swings and chat, and renders other players.
import * as THREE from 'three';
import { buildModel } from '../entity/models.js';
import { pose, lightCurve, PlayerModel, updateDeadmau5Ears } from '../engine/playermodel.js';
import { idx } from '../world/chunk.js';
import { rayBox } from '../engine/physics.js';
import { blocks as BL } from '../world/blocks.js';
import { ItemEntity } from '../entity/entity.js';
import { items, maxStack } from '../inventory/items.js';
import { buildTown, patchTown } from './town.js';
import { Lobby, patchLobby, PVP, textSprite } from './lowvoxel.js';
import { Skins } from '../engine/skin.js';

const angDiff = (a, b) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };
export function parseAddress(ip) { return String(ip || '').trim().toLowerCase().replace(/^[a-z]+:\/\//, '').replace(/:\d+$/, '').replace(/\/.*$/, ''); }

// ping for the server list: { motd, online, max } or throws
export async function status(ip) {
  const r = await fetch('/api/status?server=' + encodeURIComponent(parseAddress(ip)));
  const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || "Can't reach server"); return j;
}

let joining = null;
export async function connect(ip, game) {
  const server = parseAddress(ip); if (!server) throw new Error('Unknown host');
  if (typeof WebsimSocket === 'undefined') throw new Error('Multiplayer is unavailable here');
  const net = new Net(game, server); joining = net;
  try { await net.join(); } catch (e) { net.close(); throw e; }
  if (joining !== net) { net.close(); return; } // cancelled
  await new Promise(r => setTimeout(r, 30)); if (net.lobby) net.town = net.lobby.town; else net.town = buildTown(net.welcome.seed); net.spawn = net.town.spawn;
  if (joining !== net) { net.close(); return; }
  joining = null; game.startWorld(net.worldInfo(), net); net.syncDrops();
  if (net.lobby) { game.addChat('§e§m-----------------------------'); game.addChat('§bWelcome to the §eLowVoxel Network§b!'); game.addChat('§7Right-click the §ecompass §7to pick a game. §7/help for commands.'); game.addChat('§e§m-----------------------------'); return; }
  game.addChat('Welcome to ' + (net.welcome.serverName || 'the server') + '!', '#55ff55');
  game.addChat(net.welcome.motd || 'Build, explore, and have fun.', '#ffffff');
  game.addChat('Be kind to other players. Type /help for commands.', '#aaaaaa');
  if (net.welcome.hosted) game.addChat('Share this server address: ' + net.server, '#ffff55');
}
export function cancelConnect() { if (joining) { joining.close(); joining = null; } }

class Net {
  constructor(game, server) { this.g = game; this.server = server; this.edits = new Map(); this.drops = new Map(); this.pendingPickups = new Map(); this.pendingRemovals = new Set(); this.others = new Map(); this.closed = false; this.lastSent = ''; this.sendT = 0; this.lastFrame = performance.now(); }
  async join() {
    this.room = await WebsimSocket.joinRoom();
    return new Promise((res, rej) => {
      const to = setTimeout(() => rej(new Error('Timed out')), 15000);
      this._ready = () => { clearTimeout(to); res(); }; this._fail = r => { clearTimeout(to); rej(new Error(r)); };
      this.room.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch { return; } this.handle(m); };
      this.room.onreconnect = () => { if (this.closed) return; this.clearOthers(); this.room.send({ type: 'hello', server: this.server, skin: Skins.current, deadmau5Ears: Skins.hasDeadmau5Ears }); this.rejoin = true; };
      this.offSkin = Skins.onChange((s, ears) => this.send({ type: 'skin', skin: s, deadmau5Ears: ears }));
      this.room.onclose = e => { if (this.closed) return; const r = (e && e.reason) || 'End of stream'; if (this._fail) this._fail(r); else this.disconnected(r); };
      this.room.send({ type: 'hello', server: this.server, skin: Skins.current, deadmau5Ears: Skins.hasDeadmau5Ears });
    });
  }
  worldInfo() {
    const saved = JSON.parse(localStorage.getItem('mc125.mp.' + this.server) || 'null');
    return { id: 'mp:' + this.server, name: this.server, folder: this.server, seed: this.welcome.seed, gamemode: this.welcome.gamemode ?? 0, hardcore: false, structures: true, type: 0, multiplayer: true, player: this.lobby ? null : saved && saved.player, achievements: saved && saved.achievements };
  }
  store() { return { loadChunk: async () => null, saveChunk: async () => {} }; }
  handle(m) {
    const g = this.g;
    if (this.lobby && this.lobby.handle(m)) return;
    switch (m.type) {
      case 'kick': if (this._fail) this._fail(m.reason); else this.disconnected(m.reason); break;
      case 'welcome': this.welcome = m; if (m.network === 'lowvoxel' && !this.lobby) this.lobby = new Lobby(this); this.myId = m.id; this.name = m.name; this.pvp = !!m.pvp; this.offset = m.now - Date.now();
        for (const p of m.players) this.addOther(p);
        if (this.rejoin) { this.edits.clear(); this.clearDrops(); }
        break;
      case 'edits': for (const e of m.list) this.edits.set(e[0] + ',' + e[1] + ',' + e[2], e); if (this.rejoin) for (const e of m.list) this.applyLoaded(e); break;
      case 'drops': for (const d of m.list) this.syncDrop(d); break;
      case 'drop': case 'drop_state': this.syncDrop(m.e); break;
      case 'drop_remove': this.forgetDrop(m.dropId); break;
      case 'pickup': this.applyPickup(m); break;
      case 'pickup_result': this.pendingPickups.delete(m.dropId); break;
      case 'pvp_hit': this.applyPvpHit(m); break;
      case 'ready': if (this._ready) { const r = this._ready; this._ready = this._fail = null; r(); } this.rejoin = false; this.lastSent = ''; break;
      case 'join': this.addOther(m.player); if (g.world) g.addChat(m.player.name + ' joined the game', '#ffff55'); break;
      case 'left': this.removeOther(m.id); if (g.world) g.addChat(m.name + ' left the game', '#ffff55'); break;
      case 'chat': if (this.lobby) { this.lobby.chat(m); break; } if (g.world) g.addChat(m.me ? '* ' + m.from + ' ' + m.text : '<' + m.from + '> ' + m.text); break;
      case 'skin': { const o = this.others.get(m.id); if (o) { o.skin = m.skin; o.deadmau5Ears = !!m.deadmau5Ears || String(o.name).toLowerCase() === 'deadmau5'; if (o.model) { Skins.apply(o.model.mat, o.skin); updateDeadmau5Ears(o.model, o.deadmau5Ears); } } break; }
      case 'swing': { const o = this.others.get(m.id); if (o) o.swing = 6; break; }
      case 'block': this.edits.set(m.e[0] + ',' + m.e[1] + ',' + m.e[2], m.e); this.applyLoaded(m.e); break;
      case 'snap': for (const [id, x, y, z, yaw, pitch, sneak, held] of m.list) { const o = this.others.get(id); if (!o) continue;
        if (!o.seen) { o.x = x; o.y = y; o.z = z; o.yaw = o.bodyYaw = yaw; o.pitch = pitch; o.seen = true; }
        Object.assign(o.t, { x, y, z, yaw, pitch }); o.sneak = !!sneak; o.held = held; } break;
    }
  }
  raycastPlayers(ox, oy, oz, dx, dy, dz, max) {
    if (!this.pvp || this.g.player?.creative) return null;
    if (this.lobby && !this.lobby.inPvp()) return null;
    let best = null;
    for (const p of this.others.values()) {
      if (!p.seen) continue;
      const hit = rayBox(ox, oy, oz, dx, dy, dz, p.x - 0.3, p.y, p.z - 0.3, p.x + 0.3, p.y + 1.8, p.z + 0.3);
      if (hit && hit.t <= max && (!best || hit.t < best.t)) best = { player: p, t: hit.t };
    }
    return best;
  }
  attackPlayer(id) { if (this.pvp && !this.g.player.creative) this.send({ type: 'hit', id }); }
  respawn() { this.send({ type: 'respawn' }); }
  applyPvpHit(m) {
    if (m.target === this.myId) {
      const p = this.g.player; if (!p) return;
      p.health = Math.max(0, m.hp); p.dead = p.health <= 0; if (p.dead) p.deathCause = 'player';
      p.hurtTime = 10; p.invuln = 10; p.damageArmor(); p.mx += m.kx; p.mz += m.kz;
      this.g.sound('hurt', p);
    } else {
      const p = this.others.get(m.target); if (p) { p.health = m.hp; p.hurtTime = 10; }
      if (m.attacker === this.myId) this.g.sound('hit:stone', this.g.player, 0.7, 1);
    }
  }
  syncDrops() { for (const d of this.drops.values()) this.spawnDropEntity(d); }
  chunkLoaded(c) { for (const d of this.drops.values()) if ((Math.floor(d.x) >> 4) === c.cx && (Math.floor(d.z) >> 4) === c.cz) this.spawnDropEntity(d); }
  syncDrop(d) {
    if (!d || typeof d.dropId !== 'string' || !Number.isInteger(d.itemId) || !Number.isInteger(d.count) || d.count < 1) return;
    this.drops.set(d.dropId, { ...d }); this.pendingRemovals.delete(d.dropId); this.spawnDropEntity(d);
  }
  spawnDropEntity(d) {
    const g = this.g, w = g.world; if (!w || !w.isLoaded(Math.floor(d.x), Math.floor(d.z))) return;
    let e = g.entities.find(o => o.netId === d.dropId);
    if (e) { e.stack = { id: d.itemId, count: d.count, dmg: d.dmg }; e.dead = false; e.netRemoved = false; e.x = d.x; e.y = d.y; e.z = d.z; e.px = d.x; e.py = d.y; e.pz = d.z; e.mx = d.mx; e.my = d.my; e.mz = d.mz; return; }
    e = new ItemEntity(w, d.x, d.y, d.z, { id: d.itemId, count: d.count, dmg: d.dmg });
    e.netId = d.dropId; e.mx = d.mx; e.my = d.my; e.mz = d.mz;
    e.age = Math.min(5999, Math.max(0, Math.floor((Date.now() + (this.offset || 0) - d.created) / 50)));
    e.pickupDelay = Math.max(0, 10 - e.age);
    let h = 0; for (const ch of d.dropId) h = (Math.imul(h, 31) + ch.charCodeAt(0)) | 0;
    e.bobOff = (h >>> 0) / 4294967296 * Math.PI * 2;
    e.px = e.x; e.py = e.y; e.pz = e.z; g.entities.push(e);
  }
  requestPickup(e) {
    if (!e.netId || this.pendingPickups.has(e.netId)) return;
    const inv = this.g.player.inv, stack = e.stack, limit = maxStack(stack.id); let room = 0;
    for (const slot of inv.slots) {
      if (slot && slot.id === stack.id && slot.dmg === stack.dmg && !items[stack.id]?.durability) room += Math.max(0, limit - slot.count);
      else if (!slot) room += limit;
    }
    const count = Math.min(stack.count, room); if (!count) return;
    this.pendingPickups.set(e.netId, Date.now());
    this.send({ type: 'pickup', dropId: e.netId, count, x: e.x, y: e.y, z: e.z });
  }
  applyPickup(m) {
    this.pendingPickups.delete(m.dropId);
    const d = this.drops.get(m.dropId); if (!d) return;
    if (m.by === this.myId && m.accepted > 0) {
      const rest = this.g.player.inv.add({ id: m.itemId, count: m.accepted, dmg: m.dmg });
      if (rest) this.drop(this.g.player.x, this.g.player.eyeY - 0.3, this.g.player.z, { id: m.itemId, count: rest, dmg: m.dmg }, { mx: 0, my: 0.1, mz: 0 });
      this.g.achievements.onPickup(m.itemId); this.g.sound('pop', this.g.player, 0.3, 1.6);
    }
    if (m.remaining <= 0) this.forgetDrop(m.dropId);
    else { d.count = m.remaining; const e = this.g.entities.find(o => o.netId === m.dropId); if (e) e.stack.count = m.remaining; }
  }
  forgetDrop(dropId) {
    this.drops.delete(dropId); this.pendingPickups.delete(dropId); this.pendingRemovals.delete(dropId);
    const e = this.g.entities.find(o => o.netId === dropId); if (e) { e.netRemoved = true; e.dead = true; }
  }
  clearDrops() {
    for (const e of this.g.entities) if (e.netId) { e.netRemoved = true; e.dead = true; }
    this.drops.clear(); this.pendingPickups.clear(); this.pendingRemovals.clear();
  }
  drop(x, y, z, stack, velocity) {
    if (!stack || stack.count <= 0) return;
    this.send({ type: 'drop', x, y, z, itemId: stack.id, count: stack.count, dmg: stack.dmg || 0, mx: velocity.mx, my: velocity.my, mz: velocity.mz });
  }
  removeDrop(e) {
    if (!e.netId || e.netRemoved || this.pendingRemovals.has(e.netId)) return;
    this.pendingRemovals.add(e.netId);
    this.send({ type: 'drop_remove', dropId: e.netId, x: e.x, y: e.y, z: e.z });
  }
  // ---------- world ----------
  patchChunk(c) { // apply known edits to a freshly generated chunk before it is lit
    if (this.lobby) patchLobby(this.town, c); else if (this.town) patchTown(this.town, c);
    const x0 = c.cx * 16, z0 = c.cz * 16;
    for (const e of this.edits.values()) { if (e[0] >> 4 !== c.cx || e[2] >> 4 !== c.cz) continue; const i = idx(e[0] - x0, e[1], e[2] - z0); if (c.blocks[i] !== e[3]) c.tiles.delete(i); c.blocks[i] = e[3]; c.meta[i] = e[4]; }
  }
  applyLoaded(e) {
    const g = this.g, w = g.world; if (!w || !w.isLoaded(e[0], e[2])) return; const [x, y, z, id, meta] = e;
    if (w.getBlock(x, y, z) === id && w.getMeta(x, y, z) === meta) return;
    const old = w.getBlock(x, y, z);
    if (old && !id && g.particles) { try { g.particles.blockBreak(w, x, y, z, BL[old].tex('side', w.getMeta(x, y, z)), g.tintOf(old, w.getMeta(x, y, z), x, z)); g.sound('dig:' + g.matSound(old), { x, y, z }); } catch {} }
    else if (id && g.sound) g.sound('place:' + g.matSound(id), { x, y, z }, 1, 0.8);
    w.setBlock(x, y, z, id, meta);
    const b = BL[id]; if (b && (b.fluid || b.falls)) g.ticker.schedule(x, y, z, 2);
    g.ticker.notifyNeighbors(x, y, z);
  }
  sendBlock(x, y, z, id, meta) { const e = [x, y, z, id, meta]; this.edits.set(x + ',' + y + ',' + z, e); this.send({ type: 'block', x, y, z, id, meta }); }
  // ---------- per tick ----------
  get time() { return Math.floor((Date.now() + (this.offset || 0)) / 50); }
  tick() {
    const p = this.g.player; if (!p || this.closed) return;
    const now = Date.now(); for (const [id, t] of this.pendingPickups) if (now - t > 2500) this.pendingPickups.delete(id);
    const held = p.inv.held ? p.inv.held.id : -1, armor = p.inv.armorPoints();
    const s = [p.x, p.y, p.z, p.yaw, p.pitch].map(v => Math.round(v * 100) / 100); const key = s.join() + (p.sneak ? 1 : 0) + ',' + held + ',' + armor;
    if (++this.sendT >= 2 && key !== this.lastSent) { this.sendT = 0; this.lastSent = key; this.send({ type: 'pos', x: s[0], y: s[1], z: s[2], yaw: s[3], pitch: s[4], sneak: !!p.sneak, held, armor }); }
    if (p.swing === 6 && this.lastSwing !== 6) this.send({ type: 'swing' }); this.lastSwing = p.swing;
    for (const o of this.others.values()) if (o.swing > 0) o.swing--;
    if (this.lobby) this.lobby.tick();
  }
  chat(text, me) { this.send({ type: 'chat', text, me }); }
  send(m) { if (!this.closed && this.room) try { this.room.send(m); } catch {} }
  // ---------- other players ----------
  addOther(p) { if (p.id === this.myId || this.others.has(p.id)) return; this.others.set(p.id, { ...p, deadmau5Ears: !!p.deadmau5Ears || String(p.name).toLowerCase() === 'deadmau5', t: { x: p.x, y: p.y, z: p.z, yaw: p.yaw, pitch: p.pitch }, bodyYaw: p.yaw, amt: 0, limb: 0, swing: 0, hurtTime: 0, seen: p.y > -50, heldId: -1, item: null }); }
  removeOther(id) { const o = this.others.get(id); if (!o) return; if (o.model) { this.g.renderer.scene.remove(o.model.root); o.model.mat.dispose(); } this.others.delete(id); }
  clearOthers() { for (const id of [...this.others.keys()]) this.removeOther(id); }
  render(pt, daySub) {
    if (this.lobby) this.lobby.render(pt, daySub);
    const now = performance.now(), dt = Math.min(0.1, (now - this.lastFrame) / 1000); this.lastFrame = now; const g = this.g; const k = 1 - Math.exp(-dt * 12);
    for (const o of this.others.values()) o.hurtTime = Math.max(0, o.hurtTime - dt * 20);
    for (const o of this.others.values()) {
      if (!o.seen) continue;
      if (!o.model) { o.model = buildModel('steve'); Skins.apply(o.model.mat, o.skin); updateDeadmau5Ears(o.model, o.deadmau5Ears); g.renderer.scene.add(o.model.root); o.tag = this.lobby ? textSprite([this.lobby.tagFor(o)], 'rgba(0,0,0,0.25)', 0.3) : nameTag(o.name); o.tag.position.y = 2.15; o.model.root.add(o.tag); }
      const px = o.x, pz = o.z;
      o.x += (o.t.x - o.x) * k; o.y += (o.t.y - o.y) * k; o.z += (o.t.z - o.z) * k; o.yaw += angDiff(o.yaw, o.t.yaw) * k; o.pitch += (o.t.pitch - o.pitch) * k;
      const sp = Math.hypot(o.x - px, o.z - pz) / Math.max(dt, 1e-3) / 20; o.limb += sp * dt * 20 * 6.7; o.amt += (Math.min(1, sp * 4) - o.amt) * Math.min(1, dt * 6);
      if (sp > 0.01) o.bodyYaw += angDiff(o.bodyYaw, o.yaw) * Math.min(1, dt * 5);
      let d = angDiff(o.bodyYaw, o.yaw); if (Math.abs(d) > 0.87) { o.bodyYaw = o.yaw - Math.sign(d) * 0.87; d = angDiff(o.bodyYaw, o.yaw); }
      const m = o.model; m.root.position.set(o.x, o.y - (o.sneak ? 0.125 : 0), o.z); m.root.rotation.set(0, o.bodyYaw, 0);
      PlayerModel.prototype._held(m, o, o.held, g.renderer);
      pose(m, { headYaw: d, pitch: o.pitch, limb: o.limb, amt: o.amt, sneak: o.sneak, swing: o.swing > 0 ? 1 - (o.swing - pt) / 6 : 0, holding: o.held >= 0 });
      const l = lightCurve(g.world, Math.floor(o.x), Math.floor(o.y + 1), Math.floor(o.z), daySub), red = o.hurtTime > 0; m.mat.color.setRGB(l, red ? l * 0.45 : l, red ? l * 0.45 : l);
      o.tag.material.opacity = o.sneak ? 0.35 : 1; o.tag.material.depthTest = !!o.sneak;
    }
  }
  disconnected(reason) { if (this.closed) return; const g = this.g; this.close(); if (g.world && g.net === this) g.disconnect(reason); }
  close() { this.closed = true; if (this.lobby) this.lobby.dispose(); if (this.offSkin) this.offSkin(); this.clearOthers(); try { this.room && this.room.close && this.room.close(); } catch {} }
}

function nameTag(name) {
  const c = document.createElement('canvas'); const ctx = c.getContext('2d'); const fs = 32; ctx.font = fs + 'px monospace';
  const w = Math.ceil(ctx.measureText(name).width) + 16; c.width = w; c.height = fs + 12;
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(0, 0, w, c.height); ctx.font = fs + 'px monospace'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff'; ctx.fillText(name, 8, c.height / 2 + 1);
  const tex = new THREE.CanvasTexture(c); tex.magFilter = THREE.LinearFilter; tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false })); const h = 0.3; s.scale.set(h * w / c.height, h, 1); return s;
}
