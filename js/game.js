// Game core: state machine, 20 TPS tick loop, input, block interaction, saving
import * as THREE from 'three';
import { Renderer } from './engine/renderer.js';
import { Particles } from './engine/particles.js';
import { Sound, Music } from './engine/audio.js';
import { updateRedstone, pistonRemoved, pistonFacing, playNote, Redstone, doorPowered as rsDoorPowered } from './world/redstone.js';
import { raycast, rayBox, boxIntersectsBlocks } from './engine/physics.js';
import { drawTile } from './engine/textures.js';
import { World } from './world/world.js';
import { ckey } from './world/chunk.js';
import { blocks as BL, SOLID, OPAQUE, SHAPE, SH, isWater, isLava, isFluid, isDoor, isRail } from './world/blocks.js';
import { BIOMES, BIO, Generator } from './world/gen.js';
import { Ticker } from './world/ticks.js';
import { lightPortal, portalBroken, findPortal, buildPortal } from './world/portal.js';
import { Player } from './entity/player.js';
import { Companion } from './entity/companion.js';
import { ItemEntity, XPOrb } from './entity/entity.js';
import { MobManager } from './entity/mobs.js';
import { items, I, EGG, itemName } from './inventory/items.js';
import { railPlaced } from './world/rails.js';
import { applyPotion, isSplash, SPLASH, P as POT } from './inventory/potions.js';
import { Saves } from './save/saves.js';
import { GUI } from './gui/gui.js';
import { HUD } from './gui/hud.js';
import { Hand } from './engine/hand.js';
import { Signs } from './engine/signs.js';
import { PlayerModel } from './engine/playermodel.js';
import { Achievements } from './gui/achievements.js';
import * as Screens from './gui/screens.js';
import { setLanguage } from './gui/lang.js';
import * as Keys from './gui/keys.js';
import { TouchControls } from './gui/touch.js';
import { CompanionChat } from './companion-chat.js';

const DEFAULTS = { sound: 1, music: 1, records: 1, invert: false, sensitivity: 0.5, fov: 0, difficulty: 2, renderDist: 1, rdChunks: 8, chat: 0, chatOpacity: 1, secret: 0, fancy: true, smooth: true, bobbing: true, guiScale: 0, brightness: 0, anaglyph: false, clouds: true, lang: 'English (US)', texturePack: 'Default', keys: {} };
export const RENDER_DISTS = [12, 8, 5, 3]; // legacy presets (pre-1.7 saves); 1.7 uses settings.rdChunks (2-16)
// "Super Secret Settings" post-process looks (1.7 shader easter egg), applied as CSS filters on the world canvas
export const SECRET = ['', 'invert(1)', 'grayscale(1)', 'sepia(1)', 'hue-rotate(180deg)', 'saturate(4)', 'contrast(2.2)', 'blur(2px)', 'hue-rotate(90deg) saturate(2)'];
export const RD_NAMES = ['Far', 'Normal', 'Short', 'Tiny'];

export class Game {
  constructor() {
    const saved = JSON.parse(localStorage.getItem('mc125.options') || '{}');
    this.settings = Object.assign({}, DEFAULTS, saved); if (saved.rdChunks === undefined && saved.renderDist !== undefined) this.settings.rdChunks = RENDER_DISTS[saved.renderDist] ?? 8;
    this.canvas = document.getElementById('game'); this.canvas.tabIndex = 0; this.canvas.style.outline = 'none'; this.guiCanvas = document.getElementById('gui');
    this.renderer = new Renderer(this.canvas); this.particles = new Particles(this.renderer); this.hand = new Hand(this); this.signs = new Signs(this); this.playerModel = new PlayerModel(this); this.thirdPerson = 0;
    this.gui = new GUI(this, this.guiCanvas); this.hud = null;
    this.world = null; this.player = null; this.entities = []; this.keys = {}; this.mouse = { left: false, right: false };
    this.input = {}; this.acc = 0; this.last = performance.now(); this.tickCount = 0; this.fps = 0; this.frames = 0; this.fpsT = 0; this.chat = [];
    this.achievements = new Achievements(this);
    this.companion = null;
    this.companionChat = new CompanionChat(this);
    this.applySettings();
    this._bindInput(); this.touch = new TouchControls(this);
    this.gui.open(new Screens.MainMenu());
    this.username = 'Player'; window.websim?.getUser?.().then(u => { if (u && u.username && u.username !== 'anonymous') this.username = u.username; }).catch(() => {});
    requestAnimationFrame(t => this.frame(t));
  }
  saveSettings() { localStorage.setItem('mc125.options', JSON.stringify(this.settings)); this.applySettings(); }
  toggleCompanionChat() {
    if (this.world && !this.loadingWorld && this.companion) this.companionChat.toggle();
  }
  applySettings() {
    const s = this.settings; Sound.setVolume(s.sound, s.music, s.records); setLanguage(s.lang); Keys.setBindings(s.keys);
    this.renderer.setOptions({ smooth: s.smooth, fancy: s.fancy, renderDist: s.rdChunks, brightness: s.brightness, fov: 70 + s.fov * 40, clouds: s.clouds });
    this.gui.setScale(s.guiScale);
    this.canvas.style.filter = SECRET[s.secret] || '';
  }
  get renderDist() { return this.settings.rdChunks; }

  // ---------------- world lifecycle ----------------
  async startWorld(info, net = null) {
    this.gui.open(new Screens.Progress(net ? 'Logging in...' : 'Loading level', net ? 'Downloading terrain' : 'Building terrain'));
    this.companion?.dispose(this.renderer.scene); this.companion = null; this.companionChat.leaveWorld();
    info.lastPlayed = Date.now(); if (!net) await Saves.put(info);
    this.net = net;
    this.info = info; if (net) info.dim = 0; this._makeWorld(info, net);
    const p = new Player(); this.player = p; p.creative = info.gamemode === 1;
    this.entities = []; this.time = info.time ?? 0; this.tickCount = 0; this.chat = [];
    if (info.player) p.load(info.player); else { const [ox, oz] = net || (info.dim || 0) !== 0 ? [0, 0] : this.landOrigin(info); this.spawnOrigin = [ox, oz]; p.x = ox + 0.5; p.z = oz + 0.5; p.y = -1; this.needSpawn = true; }
    this.hud = new HUD(this);
    this.achievements.load(info.achievements);
    this.loadingWorld = true; this.needPortal = false; this.portalT = 0; this.portalLock = true;
    this._loadStart = performance.now();
  }
  _makeWorld(info, net) {
    const world = new World(info, net ? net.store() : Saves.chunkStore(info.id, info.dim || 0)); this.world = world;
    if (net) world.patchChunk = c => net.patchChunk(c);
    this.renderer.attach(world); this.particles.clear(); this.signs.clear();
    world.onChunkLoaded = c => { this._chunkLoaded(c); if (c.tiles.size) this.signs.markDirty(); if (net) net.chunkLoaded(c); };
    world.onBlockChanged = (x, y, z, o, n) => { if (this.net && this._capture) this.net.sendBlock(x, y, z, n, world.getMeta(x, y, z)); this.ticker.blockChanged(x, y, z, o, n); if (this.redstone) this.redstone.mark(x, y, z); if (o === 63 || o === 68 || n === 63 || n === 68) this.signs.markDirty(); if ((o === 49 || o === 90) && n !== 90) portalBroken(world, x, y, z); };
    this.ticker = new Ticker(this); this.mobs = new MobManager(this); this.redstone = new Redstone(this);
  }
  // travel between the overworld (0) and the nether (-1); at = fixed arrival spot (respawn), otherwise find/build a portal
  async changeDimension(to, at = null) {
    if (this.changingDim || this.net) return; this.changingDim = true;
    try {
      const p = this.player, info = this.info; if (p.riding) p.riding.dismount();
      this.gui.open(new Screens.Progress(to === -1 ? 'Entering the Nether' : 'Leaving the Nether', 'Building terrain'));
      await this.saveWorld();
      this.companion?.dispose(this.renderer.scene); this.companion = null;
      for (const e of this.entities) e.dispose(this.renderer.scene); this.entities = []; this.mobs.disposeAll();
      this.renderer.detach(); this.world.destroy(); this.breaking = null; this.renderer.setSelection(null); this.renderer.setBreak(null);
      if (at) { [p.x, p.y, p.z] = at; } else { const f = to === -1 ? 1 / 8 : 8; p.x = Math.floor(p.x * f) + 0.5; p.z = Math.floor(p.z * f) + 0.5; this.needPortal = true; }
      p.px = p.x; p.py = p.y; p.pz = p.z; p.mx = p.my = p.mz = 0; p.fall = 0; p.fireTicks = 0;
      info.dim = to; this._makeWorld(info, null);
      this.portalT = 0; this.portalLock = true; this.loadingWorld = true;
      await Saves.put(info);
    } finally { this.changingDim = false; }
  }
  // arrival: walk into the nearest portal around the scaled position, or build one
  arriveAtPortal() {
    const p = this.player, w = this.world, nether = w.dim === -1; const tx = Math.floor(p.x), tz = Math.floor(p.z), ty = nether ? Math.max(34, Math.min(100, Math.floor(p.y / 2))) : Math.floor(p.y);
    const s = findPortal(w, tx, tz, ty) || buildPortal(w, tx, tz, ty, nether);
    p.x = p.px = s[0] + 0.5; p.y = p.py = s[1]; p.z = p.pz = s[2] + 0.5; p.mx = p.my = p.mz = 0; p.fall = 0;
    if (nether) this.achievements.unlock('portal');
  }
  portalTick() {
    const p = this.player, w = this.world; let inP = false;
    for (let x = Math.floor(p.x - 0.3); x <= Math.floor(p.x + 0.3) && !inP; x++) for (let z = Math.floor(p.z - 0.3); z <= Math.floor(p.z + 0.3) && !inP; z++) for (let y = Math.floor(p.y); y <= Math.floor(p.y + 1.7); y++) if (w.getBlock(x, y, z) === 90) { inP = true; break; }
    if (!inP) { this.portalLock = false; this.portalT = Math.max(0, (this.portalT || 0) - 4); return; }
    if (this.portalLock || this.net) return;
    if (!this.portalT) Sound.play('portal', 0.6, 0.8 + Math.random() * 0.4);
    this.portalT = (this.portalT || 0) + 1;
    if (this.portalT >= (p.creative ? 2 : 80)) { this.portalT = 0; Sound.play('travel', 0.6, 1); this.changeDimension(w.dim === -1 ? 0 : -1); }
  }
  giveCreativeHotbar() { const ids = [1, 4, 45, 3, 5, 17, 18, 50, 98]; ids.forEach((id, i) => this.player.inv.slots[i] = { id, count: 1, dmg: 0 }); }
  _chunkLoaded(c) { if (this.mobs) this.mobs.chunkLoaded(c); }
  // oceans cover a lot of the map now: spiral out from 0,0 to the nearest land biome for a fresh world's spawn
  landOrigin(info) { if ((info.type || 0) === 1) return [0, 0]; const g = new Generator(this.world.seed, { wtype: info.type || 0, structures: false }); const sea = [BIO.OCEAN, BIO.DEEP, BIO.FOCEAN, BIO.RIVER, BIO.FRIVER];
    const ok = (x, z) => !sea.includes(g.biomeAt(x, z)) && [[16, 0], [-16, 0], [0, 16], [0, -16]].every(([a, b]) => !sea.includes(g.biomeAt(x + a, z + b)));
    for (let r = 0; r <= 2048; r += 32) for (let a = 0; a < Math.max(1, r / 8); a++) { const t = a / Math.max(1, r / 8) * Math.PI * 2, x = Math.round(Math.cos(t) * r), z = Math.round(Math.sin(t) * r); if (ok(x, z)) return [x, z]; }
    return [0, 0]; }
  findSpawn() {
    const w = this.world; const p = this.player;
    if (this.net && this.net.spawn) { [p.x, p.y, p.z] = this.net.spawn; p.yaw = 0; p.spawn = [...this.net.spawn]; return true; }
    for (let r = 0; r < 64; r += 4) for (let a = 0; a < 8; a++) {
      const [ox, oz] = this.spawnOrigin || [0, 0]; const x = ox + Math.round(Math.cos(a) * r), z = oz + Math.round(Math.sin(a) * r); if (!w.isLoaded(x, z)) continue;
      const y = w.topY(x, z); const b = w.getBlock(x, y, z);
      if (b === 2 || b === 12 || b === 3 || b === 78 || b === 18) { p.x = x + 0.5; p.z = z + 0.5; p.y = y + 1 + (b === 78 ? 0.2 : 0); while (SOLID[w.getBlock(x, Math.floor(p.y), z)] || SOLID[w.getBlock(x, Math.floor(p.y) + 1, z)]) p.y++; p.spawn = [p.x, p.y, p.z]; this.bonusChest(x, Math.floor(p.y), z); return true; }
    }
    const [ox, oz] = this.spawnOrigin || [0, 0]; p.x = ox + 0.5; p.z = oz + 0.5; p.y = w.topY(ox, oz) + 1; p.spawn = [p.x, p.y, p.z]; return true;
  }
  // 1.7 bonus chest: placed once beside the first spawn point
  bonusChest(x, y, z) {
    const info = this.info, w = this.world; if (!info || !info.bonusChest || info.bonusDone || this.net) return; info.bonusDone = true;
    for (const [dx, dz] of [[2, 0], [0, 2], [-2, 0], [0, -2], [2, 2]]) { const cx = x + dx, cz = z + dz, cy = w.topY(cx, cz) + 1; if (cy < 1 || cy >= 127 || w.getBlock(cx, cy, cz) || !SOLID[w.getBlock(cx, cy - 1, cz)]) continue;
      const loot = [[280, 12], [5, 12], [17, 4], [271, 1], [270, 1], [260, 5], [297, 2]]; const items = new Array(27).fill(null); loot.forEach(([id, n], i) => items[i * 3 + ((Math.random() * 3) | 0)] = { id, count: 1 + ((Math.random() * n) | 0), dmg: 0 });
      w.setBlock(cx, cy, cz, 54, 0); w.setTile(cx, cy, cz, { items });
      for (const [ex, ez] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!w.getBlock(cx + ex, cy, cz + ez) && SOLID[w.getBlock(cx + ex, cy - 1, cz + ez)]) w.setBlock(cx + ex, cy, cz + ez, 50, 5);
      return; }
  }
  async saveWorld() {
    if (!this.world) return; const info = this.info;
    if (this.net) { localStorage.setItem('mc125.mp.' + this.net.server, JSON.stringify({ player: this.player.toJSON(), achievements: this.achievements.save() })); return; }
    info.time = this.time; info.player = this.player.toJSON(); info.lastPlayed = Date.now(); info.achievements = this.achievements.save();
    this.mobs.saveToChunks(); await this.world.saveAll(); await Saves.put(info);
  }
  async quitToTitle(screen) {
    this.gui.open(new Screens.Progress('Saving level', ''));
    await this.saveWorld();
    this.companion?.dispose(this.renderer.scene); this.companion = null; this.companionChat.leaveWorld();
    if (this.net) { this.net.close(); this.net = null; } Music.stopRecord();
    for (const e of this.entities) e.dispose(this.renderer.scene); this.mobs.disposeAll();
    this.entities = []; this.renderer.detach(); this.world.destroy(); this.signs.clear(); this.world = null; this.player = null; this.hud = null; this.particles.clear(); this.hand.clear();
    this.renderer.setSelection(null); this.renderer.setBreak(null);
    this.gui.open(screen || new Screens.MainMenu());
  }
  disconnect(reason) { this.quitToTitle(new Screens.Disconnected(reason)); }
  // stream chunks around the player
  updateChunks() {
    const w = this.world; const p = this.player; const R = this.renderDist + 1; const pcx = Math.floor(p.x / 16), pcz = Math.floor(p.z / 16);
    let req = 0; const maxReq = 6;
    const want = [];
    for (let dx = -R; dx <= R; dx++) for (let dz = -R; dz <= R; dz++) { if (dx * dx + dz * dz > R * R + 1) continue; want.push([dx * dx + dz * dz, pcx + dx, pcz + dz]); }
    want.sort((a, b) => a[0] - b[0]);
    for (const [, cx, cz] of want) { if (w.busy > 12) break; if (w.request(cx, cz) && ++req >= maxReq) break; }
    const U = R + 2;
    for (const c of [...w.chunks.values()]) if (Math.abs(c.cx - pcx) > U || Math.abs(c.cz - pcz) > U) { this.mobs.unloadChunk(c); this.renderer.disposeChunk(c); w.unload(c); }
    w.cancelPending(k => { const cx = Math.floor(k / 65536) - 32768, cz = (k % 65536) - 32768; return Math.abs(cx - pcx) <= U && Math.abs(cz - pcz) <= U; });
  }

  // ---------------- input ----------------
  _bindInput() {
    addEventListener('keydown', e => {
      Sound.unlock(); Music.unlock();
      if ((this.gui.screen instanceof Screens.PlayerInventory || this.gui.screen instanceof Screens.Death) && e.code === 'KeyB' && !e.repeat) { this.toggleCompanionChat(); e.preventDefault(); return; }
      if (this.gui.screen) { if (this.gui.screen.key(e)) e.preventDefault(); return; }
    if (!this.world) return;
      this.keys[e.code] = true; const c = e.code;
      if (c === 'Escape') { this.pause(); e.preventDefault(); return; }
      if (c === 'KeyB' && !e.repeat) { this.toggleCompanionChat(); e.preventDefault(); return; }
      if (e.repeat && !Keys.is('drop', c)) { if (!c.startsWith('F')) e.preventDefault(); } // held keys only repeat the drop action
      else if (Keys.is('inventory', c)) { this.achievements.unlock('openInventory'); const rm = this.player.riding; if (rm && rm.type === 'horse' && rm.tame) { this.openHorse(rm); e.preventDefault(); return; } this.gui.open(this.player.creative ? new Screens.CreativeInventory() : new Screens.PlayerInventory()); e.preventDefault(); return; }
      else if (Keys.is('chat', c) || c === 'Slash') { this.keys = {}; this.gui.open(new Screens.Chat(c === 'Slash' && !Keys.is('chat', c) ? '/' : '')); e.preventDefault(); return; }
      if (Keys.is('drop', c)) this.dropHeld(e.ctrlKey || e.metaKey);
      if (e.code === 'F1') { this.hideGui = !this.hideGui; e.preventDefault(); }
      if (e.code === 'F3') { this.debug = !this.debug; e.preventDefault(); }
      if (e.code === 'F5') { this.thirdPerson = (this.thirdPerson + 1) % 3; e.preventDefault(); } // first person -> behind -> in front
      if (e.code === 'F2') { e.preventDefault(); this.screenshot = true; }
      if (Keys.is('forward', c) && !e.repeat) this.input.forwardPressed = true;
      if (Keys.is('jump', c) && !e.repeat) this.input.jumpPressed = true;
      if (Keys.is('pick', c) && !e.repeat) this.pickBlock();
      if (c.startsWith('Digit')) { const n = +c.slice(5); if (n >= 1 && n <= 9) this.player.inv.selected = n - 1; }
      // keep bound keys (space scrolling, tab focus, ctrl/alt shortcuts, quick-find on / and ') from reaching the browser
      if (Keys.BINDS.some(([a]) => Keys.is(a, c)) || ['Space', 'Tab', 'Slash', 'Quote', 'AltLeft', 'AltRight'].includes(c)) e.preventDefault();
    });
    addEventListener('keyup', e => { this.keys[e.code] = false; });
    addEventListener('blur', () => { this.keys = {}; this.mouse.left = this.mouse.right = false; });
    this.canvas.addEventListener('mousedown', e => {
      Sound.unlock(); Music.unlock(); if (!this.world || this.gui.screen) return;
      this.canvas.focus({ preventScroll: true });
      if (document.pointerLockElement !== this.canvas) { this.lock(); return; }
      const mb = 'Mouse' + e.button; this.keys[mb] = true;
      if (Keys.is('pick', mb)) { this.pickBlock(); return; }
      if (Keys.is('jump', mb)) this.input.jumpPressed = true; if (Keys.is('forward', mb)) this.input.forwardPressed = true;
      if (Keys.is('drop', mb)) { this.dropHeld(false); return; }
      if (e.button === 0) { this.mouse.left = true; this.clickLeft = true; }
      if (e.button === 2) { this.mouse.right = true; this.clickRight = true; }
    });
    addEventListener('mouseup', e => { this.keys['Mouse' + e.button] = false; if (e.button === 0) this.mouse.left = false; if (e.button === 2) this.mouse.right = false; });
    addEventListener('mousemove', e => {
      if (document.pointerLockElement !== this.canvas || !this.player || this.gui.screen) return;
      const s = (0.6 * this.settings.sensitivity + 0.2) ** 3 * 8 * 0.15 * Math.PI / 180;
      this.player.yaw -= e.movementX * s; this.player.pitch -= e.movementY * s * (this.settings.invert ? -1 : 1);
      this.player.pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.player.pitch));
    });
    addEventListener('wheel', e => { if (!this.player || this.gui.screen) return; const inv = this.player.inv; inv.selected = (inv.selected + Math.sign(e.deltaY) + 9) % 9; }, { passive: true });
    this.canvas.addEventListener('contextmenu', e => e.preventDefault());
    document.addEventListener('pointerlockchange', () => { if (document.pointerLockElement !== this.canvas && this.world && !this.gui.screen && !this._unlocking) this.pause(); this._unlocking = false; });
  }
  lock() { try { this.canvas.focus({ preventScroll: true }); const r = this.canvas.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch {} }
  unlock() { if (document.pointerLockElement) { this._unlocking = true; document.exitPointerLock(); } }
  pause() { this.gui.open(new Screens.Pause()); }
  onScreenChange(s) { if (s) { this.unlock(); this.mouse.left = this.mouse.right = false; this.keys = {}; } else if (this.world) this.lock(); }
  pickBlock() { const t = this.target; if (!t || t.entity) return; const id = t.id === 62 ? 61 : t.id === 74 ? 73 : t.id === 9 ? 8 : t.id === 63 || t.id === 68 ? 323 : t.id; if (!items[id]) return; const inv = this.player.inv;
    for (let i = 0; i < 9; i++) if (inv.slots[i] && inv.slots[i].id === id) { inv.selected = i; return; }
    if (this.player.creative) inv.slots[inv.selected] = { id, count: 1, dmg: id === 17 || id === 18 || id === 161 || id === 162 ? t.meta & 3 : BL[id]?.variants ? t.meta & 15 : 0 }; }
  dropHeld(all) { if (this.net && this.net.lobby) return; const inv = this.player.inv; const h = inv.held; if (!h) return; const n = all ? h.count : 1; this.dropStack({ id: h.id, count: n, dmg: h.dmg }, true); h.count -= n; if (h.count <= 0) inv.slots[inv.selected] = null; }
  dropStack(stack, thrown) { const p = this.player; let mx = (Math.random() - 0.5) * 0.2, my = 0.2, mz = (Math.random() - 0.5) * 0.2;
    if (thrown) { const s = 0.3; mx = -Math.sin(p.yaw) * Math.cos(p.pitch) * s; mz = -Math.cos(p.yaw) * Math.cos(p.pitch) * s; my = Math.sin(p.pitch) * s + 0.1; }
    if (this.net) { this.net.drop(p.x, p.eyeY - 0.3, p.z, stack, { mx, my, mz }); return; }
    const e = new ItemEntity(this.world, p.x, p.eyeY - 0.3, p.z, stack); e.mx = mx; e.my = my; e.mz = mz; if (thrown) e.pickupDelay = 40; this.entities.push(e); }
  spawnDrop(x, y, z, stack) { if (!stack || stack.count <= 0) return; if (this.net) { this.net.drop(x, y, z, stack, { mx: (Math.random() - 0.5) * 0.2, my: 0.2, mz: (Math.random() - 0.5) * 0.2 }); return; } const e = new ItemEntity(this.world, x, y, z, stack); this.entities.push(e); return e; }
  spawnXP(x, y, z, n) { while (n > 0) { const v = n >= 17 ? 17 : n >= 7 ? 7 : n >= 3 ? 3 : 1; n -= v; this.entities.push(new XPOrb(this.world, x, y, z, v)); } }
  sound(name, pos, vol = 1, pitch = 1) { let v = vol; if (pos && this.player) { const d = Math.hypot(pos.x - this.player.x, pos.y - this.player.y, pos.z - this.player.z); v *= Math.max(0, 1 - d / 16); } if (v > 0.01) Sound.play(name, v, pitch); }
  addChat(msg, color = '#ffffff') { this.chat.push({ msg, color, t: performance.now(), system: !String(msg).startsWith('<') }); if (this.chat.length > 100) this.chat.shift(); }
  // chat input: plain text is said aloud, '/' runs a command
  // a command block fired: run its command with ~ relative to the block
  runBlockCommand(cmd, x, y, z) { if (this.net && this.net.lobby) return; const c = cmd.startsWith('/') ? cmd : '/' + cmd; this._cb = { x: x + 0.5, y, z: z + 0.5 }; try { this.command(c.replace(/@[pa]/g, this.username || 'Player'), true); } finally { this._cb = null; } }
  command(m, fromBlock) {
    if (!fromBlock) { (this.sent ||= []).push(m); if (this.sent.length > 50) this.sent.shift(); }
    const name = this.net ? this.net.name : (this.username || 'Player');
    if (this.net && this.net.lobby) { if (!m.startsWith('/')) { this.net.chat(m, false); return; } if (this.net.lobby.command(m)) return; }
    if (!m.startsWith('/')) {
      this.addChat('<' + name + '> ' + m);
      if (this.net) this.net.chat(m, false);
      else this.companionChat?.receive(m);
      return;
    }
    let [cmd, ...a] = m.slice(1).split(/\s+/); const p = this.player; const err = s => this.addChat(s, '#ff5555'); const o = this._cb || p;
    const me = this.username || 'Player'; if ((cmd === 'tp' || cmd === 'give' || cmd === 'kill') && a[0] === me) a = a.slice(1);
    const num = (s, base) => s === undefined ? NaN : s.startsWith('~') ? base + (Number(s.slice(1)) || 0) : Number(s);
    if (!this.net && this.info && this.info.cheats === false && !this._cb && ['time', 'gamemode', 'give', 'tp', 'setblock', 'summon'].includes(cmd.toLowerCase())) return err('You do not have permission to use this command');
    switch (cmd.toLowerCase()) {
      case 'help': case '?': this.addChat(this.net ? 'Server commands: /help /me <action> /seed /kill' : 'Commands: /help /time set <day|night|value> /gamemode <0|1> /give <id> [count] /tp <x> <y> <z> /seed /kill /me <action> /vc'); break;
      case 'vc': if (this.net) err('Voice chat with Moss is only available in single-player worlds'); else this.companionChat?.toggleVoiceChat(); break;
      case 'me': this.addChat('* ' + name + ' ' + a.join(' ')); if (this.net) this.net.chat(a.join(' '), true); break;
      case 'seed': this.addChat('Seed: ' + this.world.seed); break;
      case 'kill': p.damage(1000, 'void'); break;
      case 'time': { if (this.net) return err('The time is controlled by the server'); if (a[0] !== 'set' && a[0] !== 'add') return err('Usage: /time <set|add> <value>'); const v = a[1] === 'day' ? 1000 : a[1] === 'night' ? 13000 : Number(a[1]); if (!Number.isFinite(v)) return err('Usage: /time <set|add> <value>');
        if (a[0] === 'set') this.time = Math.floor(this.time / 24000) * 24000 + v; else this.time += v; this.addChat((a[0] === 'set' ? 'Set the time to ' : 'Added ') + v); break; }
      case 'gamemode': case 'gm': { if (this.net) return err('You do not have permission to use this command'); const mode = { 0: 0, s: 0, survival: 0, 1: 1, c: 1, creative: 1 }[(a[0] || '').toLowerCase()]; if (mode === undefined) return err('Usage: /gamemode <0|1>');
        p.creative = mode === 1; if (!p.creative) p.flying = false; this.info.gamemode = mode; this.addChat('Your game mode has been updated'); break; }
      case 'give': { if (this.net) return err('You do not have permission to use this command'); const it = items[Number(a[0])] || items[I[(a[0] || '').replace(/^minecraft:/, '').toUpperCase()]]; if (!it) return err('There is no such item with ID ' + (a[0] || '?'));
        const n = Math.max(1, Math.min(640, Number(a[1]) || 1)); let left = n; const st = it.stack || 64;
        while (left > 0) { const c = Math.min(st, left); left -= c; const r = p.inv.add({ id: it.id, count: c, dmg: Number(a[2]) || 0 }); if (r) this.dropStack({ id: it.id, count: r, dmg: Number(a[2]) || 0 }, true); }
        this.addChat('Given ' + it.name + ' * ' + n); break; }
      case 'tp': { const x = num(a[0], p.x), y = num(a[1], p.y), z = num(a[2], p.z); if (![x, y, z].every(Number.isFinite)) return err('Usage: /tp <x> <y> <z>');
        p.x = p.px = x; p.y = p.py = y; p.z = p.pz = z; p.mx = p.my = p.mz = 0; p.fall = 0; this.addChat('Teleported to ' + [x, y, z].map(v => Math.round(v * 10) / 10).join(', ')); break; }
      case 'say': this.addChat('[' + (this._cb ? '@' : name) + '] ' + a.join(' ')); break;
      case 'setblock': { const x = Math.floor(num(a[0], o.x)), y = Math.floor(num(a[1], o.y)), z = Math.floor(num(a[2], o.z)); const id = Number(a[3]) || I[(a[3] || '').replace(/^minecraft:/, '').toUpperCase()] || BL.findIndex(b => b && b.key === (a[3] || '').replace(/^minecraft:/, ''));
        if (![x, y, z].every(Number.isFinite) || id < 0 || id > 255 || (id && !BL[id])) return err('Usage: /setblock <x> <y> <z> <block> [meta]'); this.world.setBlock(x, y, z, id, Number(a[4]) || 0); this.ticker.notifyNeighbors(x, y, z); if (!this._cb) this.addChat('Block placed'); break; }
      case 'summon': { const t = (a[0] || '').toLowerCase().replace(/^minecraft:/, ''); const x = num(a[1], o.x), y = num(a[2], o.y + (this._cb ? 1 : 0)), z = num(a[3], o.z);
        const key = { pigzombie: 'zombie_pigman', cavespider: 'cave_spider', lavaslime: 'magma_cube', villagergolem: 'iron_golem', snowman: 'snowman', entityhorse: 'horse', mushroomcow: 'mooshroom', ozelot: 'ocelot', witherskeleton: 'wither_skeleton' }[t.replace(/_/g, '')] || t;
        if (key === 'primedtnt' || key === 'tnt') { this.mobs.spawnTNT(Math.floor(x), Math.floor(y), Math.floor(z)); break; } if (key === 'minecart') { this.mobs.placeCart(x, y, z, 0); break; }
        if (![x, y, z].every(Number.isFinite) || !this.mobs.useEgg(key, Math.floor(x), y, Math.floor(z))) return err('Unable to summon object'); if (!this._cb) this.addChat('Object successfully summoned'); break; }
      default: err('Unknown command. Try /help for a list of commands');
    }
  }

  // ---------------- tick ----------------
  tick() {
    const p = this.player, w = this.world;
    if (this.loadingWorld) {
      this.updateChunks();
      const c = w.getChunk(Math.floor(p.x / 16), Math.floor(p.z / 16));
      let ready = c && c.lit; if (ready) for (const [dx, dz] of [[1,0],[-1,0],[0,1],[0,-1]]) if (!w.getChunk(c.cx + dx, c.cz + dz)) ready = false;
      if (ready && this.needSpawn) { this.findSpawn(); this.needSpawn = false; ready = false; }
      if (ready && this.needPortal) { for (let dx = -2; dx <= 2 && ready; dx++) for (let dz = -2; dz <= 2; dz++) { const n = w.getChunk(c.cx + dx, c.cz + dz); if (!n || !n.lit) { ready = false; break; } }
        if (ready) { this.arriveAtPortal(); this.needPortal = false; ready = false; } }
      if (ready) {
        this.loadingWorld = false;
        if (!this.net) {
          if (!this.companion) this.companion = new Companion(this);
          this.companionChat.enterWorld();
        } else this.companionChat.leaveWorld();
        this.gui.open(null);
      }
      return;
    }
    this.tickCount++;
    const k = this.keys; const inp = this.input;
    const T = this.touchInput || {}; const H = a => Keys.held(a, k) || !!T[a];
    Object.assign(inp, { forward: H('forward'), back: H('back'), left: H('left'), right: H('right'), jump: H('jump'), sneak: H('sneak'), sprint: H('sprint') });
    if (!this.gui.screen || !this.gui.screen.pausesGame || this.net) {
      if (this.gui.screen) { for (const kk of ['forward', 'back', 'left', 'right', 'jump', 'sneak']) inp[kk] = false; }
      p.tick(w, inp, this.settings.difficulty); inp.forwardPressed = inp.jumpPressed = false;
      this.companion?.tick();
      if (!p.dead) this.portalTick(); if (this.changingDim || this.loadingWorld) return;
      if (!p.dead) { this._capture = !!this.net; try { this.interactTick(); } finally { this._capture = false; } } else if (!(this.gui.screen instanceof Screens.Death)) { this.dropAll(); this.gui.open(new Screens.Death()); }
      this.time = this.net ? (this.net.lobby ? 6000 : this.net.time) : this.time + 1;
      for (const e of this.entities) { e.tick(this); if (!e.dead) this.pickup(e); }
      for (const e of this.entities) if (e.dead) { if (this.net && e.netId && !e.netRemoved) this.net.removeDrop(e); e.dispose(this.renderer.scene); }
      this.entities = this.entities.filter(e => !e.dead);
      this.mobs.tick(); this.ticker.tick(); this.redstone.tick(); this.particles.tick(w);
      this.achievements.tick(); Music.tick(); Music.listen(p.x, p.y, p.z);
      if (this.tickCount % 900 === 0) this.saveWorld();
      if (this.net) this.net.tick();
    }
    this.updateChunks();
  }
  dropAll() { if (this.net && this.net.lobby) return; const inv = this.player.inv; const p = this.player; for (let i = 0; i < 36; i++) if (inv.slots[i]) { const e = this.spawnDrop(p.x, p.y + 1, p.z, inv.slots[i]); if (e) { e.mx = (Math.random() - 0.5) * 0.5; e.mz = (Math.random() - 0.5) * 0.5; } inv.slots[i] = null; } for (let i = 0; i < 4; i++) if (inv.armor[i]) { this.spawnDrop(p.x, p.y + 1, p.z, inv.armor[i]); inv.armor[i] = null; } const xp = Math.min(100, p.xpLevel * 7); this.spawnXP(p.x, p.y + 1, p.z, xp); p.xpLevel = 0; p.xp = 0; }
  respawn() { const p = this.player; const np = new Player(); np.creative = p.creative; np.spawn = p.spawn; np.inv = p.creative ? p.inv : np.inv; const s = p.bedSpawn || p.spawn || [0.5, 80, 0.5]; np.x = s[0]; np.y = s[1]; np.z = s[2]; np.bedSpawn = p.bedSpawn; np.px = np.x; np.py = np.y; np.pz = np.z; this.player = np; if (this.net) this.net.respawn(); this.gui.open(null); if (this.world.dim === -1 && !this.net) this.changeDimension(0, [np.x, np.y, np.z]); }
  pickup(e) {
    const p = this.player; if (p.dead) return;
    if (Math.abs(e.x - p.x) > 1.3 || e.y < p.y - 0.5 || e.y > p.y + 2.3 || Math.abs(e.z - p.z) > 1.3) return;
    if (e.type === 'item' && e.pickupDelay <= 0) { if (this.net && e.netId) { this.net.requestPickup(e); return; } const id = e.stack.id; const left = p.inv.add(e.stack); if (left < e.stack.count) { Sound.play('pop', 0.3, 1.4 + Math.random() * 0.6); this.achievements.onPickup(id); } if (left <= 0) e.dead = true; else e.stack.count = left; }
    if (e.type === 'xp') { p.addXP(e.value); Sound.play('orb', 0.2, 0.6 + Math.random() * 0.5); e.dead = true; }
  }
  // look ray (blocks + entities)
  updateTarget() {
    const p = this.player; const reach = p.creative ? 5 : 4.5;
    const dx = -Math.sin(p.yaw) * Math.cos(p.pitch), dy = Math.sin(p.pitch), dz = -Math.cos(p.yaw) * Math.cos(p.pitch);
    const ex = p.x, ey = p.eyeY, ez = p.z;
    let hit = raycast(this.world, ex, ey, ez, dx, dy, dz, reach);
    const maxEntity = Math.min(hit ? hit.dist : reach, 3.5);
    const m = this.mobs.raycast(ex, ey, ez, dx, dy, dz, maxEntity);
    if (m) hit = { entity: m.mob, dist: m.t };
    const playerHit = this.net && this.net.raycastPlayers(ex, ey, ez, dx, dy, dz, maxEntity);
    if (playerHit && (!m || playerHit.t < m.t)) hit = { entity: playerHit.player, dist: playerHit.t, networkPlayer: true };
    this.target = hit; this.lookDir = [dx, dy, dz];
  }
  interactTick() {
    const p = this.player; const inv = p.inv; this.updateTarget(); const t = this.target;
    if (this.hitDelay > 0) this.hitDelay--;
    if (this.useDelay > 0) this.useDelay--;
    const lobby = this.net && this.net.lobby;
    if (lobby && this.clickLeft && lobby.clickNPC()) { this.clickLeft = false; p.swing = 6; return; }
    // attacking entities
    if (this.clickLeft && t && t.entity) { if (t.networkPlayer) this.net.attackPlayer(t.entity.id); else this.mobs.attack(t.entity, p); p.swing = 6; this.clickLeft = false; this.breaking = null; return; }
    if (this.clickLeft && !t) p.swing = 6;
    this.clickLeft = false;
    // breaking
    if (this.mouse.left && t && !t.entity && (!lobby || lobby.canBreak(t.x, t.y, t.z))) {
      const b = BL[t.id]; const key = t.x + ',' + t.y + ',' + t.z;
      if (!this.breaking || this.breaking.key !== key) { this.breaking = { key, x: t.x, y: t.y, z: t.z, prog: 0, ticks: 0 }; if (t.id === 25 && !p.creative) playNote(this, t.x, t.y, t.z); }
      const br = this.breaking;
      if (p.swing < 3) p.swing = 6;
      if (this.hitDelay > 0) {}
      else if (p.creative) { this.breakBlock(t.x, t.y, t.z, false); this.hitDelay = 5; this.breaking = null; }
      else if (b.hardness >= 0) {
        br.prog += this.breakStrength(b, inv.held); br.ticks++;
        if (br.ticks % 4 === 1) this.sound('hit:' + this.matSound(t.id), { x: t.x, y: t.y, z: t.z }, 0.6, 0.5);
        this.particles.blockHit(t.x, t.y, t.z, t.face, b.tex('side', t.meta), this.tintOf(t.id, t.meta, t.x, t.z));
        if (br.prog >= 1) { this.breakBlock(t.x, t.y, t.z, true); this.breaking = null; this.hitDelay = 5; }
      }
    } else this.breaking = null;
    this.renderer.setBreak(this.breaking ? [this.breaking.x, this.breaking.y, this.breaking.z] : null, this.breaking ? Math.min(9, Math.floor(this.breaking.prog * 10)) : -1, drawTile);
    // eating
    const held = inv.held; const it = held && items[held.id];
    const drink = it && held.id === 373 && !isSplash(held.dmg);
    if (this.mouse.right && it && (drink || it.food && (p.food < 20 || p.creative || held.id === 322)) && !(t && !t.entity && BL[t.id]?.gui && !p.sneak)) {
      this.eating = (this.eating || 0) + 1; if (this.eating % 4 === 0) Sound.play('eat', 0.5);
      if (this.eating >= 32 && drink) { applyPotion(p, held.dmg, 1, true); Sound.play('burp', 0.5); if (!p.creative) inv.slots[inv.selected] = { id: 374, count: 1, dmg: 0 }; this.eating = 0; this.useDelay = 4; }
      else if (this.eating >= 32) { p.eat(it); Sound.play('burp', 0.5); if (!p.creative) { inv.consumeHeld(); if (it.returns) inv.slots[inv.selected] = inv.slots[inv.selected] || { id: it.returns, count: 1, dmg: 0 }; } if (held.id === 322) p.heal(4); if (it.poison && Math.random() < it.poison) applyPotion(p, POT.poison, 0.11, true); this.eating = 0; this.useDelay = 4; }
      this.clickRight = false; return;
    } else this.eating = 0;
    if (this.mouse.right && (this.clickRight || this.useDelay <= 0)) { this.clickRight = false; this.useDelay = 4; this.useItem(); }
    if (!this.mouse.right) this.useDelay = 0;
  }
  matSound(id) { const b = BL[id]; return id === 2 || id === 31 || id === 18 || id === 161 ? 'grass' : b.sound; }
  tintOf(id, meta, x, z) { const b = BL[id]; if (!b.tint) return [1, 1, 1]; const bio = BIOMES[this.world.biomeAt(x, z)]; const c = b.tint === 'foliage' ? bio.foliage : bio.grass; return c.map(v => v / 255); }
  breakStrength(b, held) {
    if (b.hardness < 0) return 0; if (b.hardness === 0) return 1;
    const it = held && items[held.id]; let speed = 1;
    if (it && it.tool && (it.tool === b.tool || (it.tool === 'pickaxe' && b.tool === 'pickaxe'))) speed = it.speed;
    if (it && it.tool === 'shears' && (b.id === 18 || b.id === 161 || b.id === 35 || b.id === 106)) speed = 15;
    if (it && it.tool === 'sword') speed = 1.5;
    const can = this.canHarvest(b, it);
    let s = can ? speed / b.hardness / 30 : 1 / b.hardness / 100;
    if (this.player.eyeInWater) s /= 5; if (!this.player.onGround && !this.player.flying) s /= 5;
    return s;
  }
  canHarvest(b, it) { if (!b.level) return true; if (!it || it.tool !== b.tool) return false; return it.level >= b.level; }
  breakBlock(x, y, z, survival) {
    const w = this.world; if (isDoor(w.getBlock(x, y, z)) && (w.getMeta(x, y, z) & 8) && w.getBlock(x, y - 1, z) === w.getBlock(x, y, z)) y--; const id = w.getBlock(x, y, z), meta = w.getMeta(x, y, z); const b = BL[id]; if (!id || isFluid(id)) return;
    const p = this.player; const held = p.inv.held; const it = held && items[held.id];
    if (this.net && this.net.lobby) { if (!this.net.lobby.canBreak(x, y, z)) return; survival = false; }
    this.particles.blockBreak(w, x, y, z, b.tex('side', meta), this.tintOf(id, meta, x, z));
    this.sound('dig:' + this.matSound(id), { x, y, z });
    // container contents spill
    const tile = w.getTile(x, y, z); if (tile && tile.items) for (const s of tile.items) if (s) this.spawnDrop(x + 0.5, y + 0.5, z + 0.5, { ...s });
    if (tile && tile.slots) for (const s of tile.slots) if (s) this.spawnDrop(x + 0.5, y + 0.5, z + 0.5, { ...s });
    if (id === 84) this.ejectRecord(x, y, z);
    // ice turns to water
    const below = w.getBlock(x, y - 1, z);
    w.setBlock(x, y, z, (id === 79 && survival && SOLID[below]) ? 8 : 0, 0);
    if (id === 26) this.breakBedPart(x, y, z, meta);
    if (id === 33 || id === 29 || id === 34) pistonRemoved(this, x, y, z, id, meta, survival && !p.creative);
    if (survival) {
      p.addExhaustion(0.025);
      if (this.canHarvest(b, it)) this.dropsFor(id, meta, it).forEach(s => this.spawnDrop(x + 0.5, y + 0.3, z + 0.5, s));
      const xp = { 16: [0, 2], 56: [3, 7], 21: [2, 5], 73: [1, 5], 74: [1, 5] }[id]; if (xp) this.spawnXP(x + 0.5, y + 0.5, z + 0.5, xp[0] + Math.floor(Math.random() * (xp[1] - xp[0] + 1)));
      if (it && it.durability) this.damageHeld(it.tool === 'sword' ? 2 : 1);
      this.achievements.onMine(id);
    }
    this.ticker.notifyNeighbors(x, y, z);
    if (id === 69) this.updateIronDoors(x, y, z);
    updateRedstone(this, x, y, z);
  }
  // pop the record out of a jukebox (and stop it if it was the one playing)
  ejectRecord(x, y, z) { const w = this.world, tile = w.getTile(x, y, z); if (!tile || !tile.record) return; const r = Music.rec; if (r && r.pos.x === x && r.pos.y === y && r.pos.z === z) Music.stopRecord();
    const e = this.spawnDrop(x + 0.5, y + 1.1, z + 0.5, { id: tile.record, count: 1, dmg: 0 }); if (e) { e.my = 0.2; } tile.record = 0; w.setTile(x, y, z, tile); }
  dropsFor(id, meta, it) {
    const b = BL[id]; const r = Math.random;
    if (it && it.tool === 'shears' && (id === 18 || id === 161 || id === 31 || id === 106)) return [{ id, count: 1, dmg: id === 18 || id === 161 ? meta & 3 : meta }];
    if (id === 80 || id === 78) { if (!it || it.tool !== 'shovel') return []; }
    if (b.dropFn) { const d = b.dropFn(meta, r); if (!d) return []; const arr = Array.isArray(d[0]) ? d : [d]; return arr.filter(Boolean).map(a => ({ id: a[0], count: a[1], dmg: a[2] || 0 })); }
    if (!b.drop) return [];
    return [{ id: b.drop, count: b.dropCount || 1, dmg: b.keepMeta ? meta & (b.variants && id !== 17 && id !== 162 ? 15 : 3) : (id === 18 ? meta & 3 : 0) }];
  }
  damageHeld(n) { const p = this.player; if (p.creative) return; const h = p.inv.held; if (!h) return; const it = items[h.id]; if (!it.durability) return; h.dmg += n; if (h.dmg >= it.durability) { p.inv.slots[p.inv.selected] = null; Sound.play('dig:wood', 0.8, 0.6); } }
  useItem() {
    if (this.net && this.net.lobby) { this.net.lobby.useItem(); return; }
    const p = this.player, w = this.world, inv = p.inv; const t = this.target; const held = inv.held; const it = held && items[held.id];
    if (p.riding && (!t || t.entity === p.riding || !held)) { if (this.tickCount >= (this.rideCD || 0)) { p.riding.dismount(); this.rideCD = this.tickCount + 10; } return; }
    if (t && t.entity && t.entity.vehicle) { if (!p.riding && this.tickCount >= (this.rideCD || 0)) { t.entity.mount(p); this.rideCD = this.tickCount + 10; } return; }
    if (t && t.entity) { if (this.mobs.interact(t.entity, p, held)) p.swing = 6; return; }
    if (held && held.id === 373 && isSplash(held.dmg)) { this.mobs.throwPotion(p, null, held.dmg); if (!p.creative) inv.consumeHeld(); return; }
    if (held && held.id === 374) { const dx = this.lookDir; const h = raycast(w, p.x, p.eyeY, p.z, dx[0], dx[1], dx[2], 5, true); if (h && isWater(h.id)) { const b = { id: 373, count: 1, dmg: POT.water }; if (p.creative) { if (inv.add(b)) this.dropStack(b); } else if (held.count === 1) inv.slots[inv.selected] = b; else { held.count--; if (inv.add(b)) this.dropStack(b); } this.sound('splash', p, 0.4, 1.4); p.swing = 6; return; } }
    if (held && held.id === 328 && t && !t.entity && isRail(t.id)) { this.mobs.placeCart(t.x + 0.5, t.y + 0.07, t.z + 0.5, p.yaw); p.swing = 6; if (!p.creative) inv.consumeHeld(); return; }
    if (held && held.id === 333) { // boat: place on the water surface (or on top of a block)
      const dx = this.lookDir; const h = raycast(w, p.x, p.eyeY, p.z, dx[0], dx[1], dx[2], 5, true);
      if (h && (isWater(h.id) || h.face[1] === 1)) { const ty = isWater(h.id) ? h.y + 0.9 : h.y + 1; this.mobs.placeBoat(h.x + 0.5, ty, h.z + 0.5, p.yaw); p.swing = 6; if (!p.creative) inv.consumeHeld(); }
      return; }
    // fluids targeted for buckets
    if (held && (held.id === 325)) { const dx = this.lookDir; const h = raycast(w, p.x, p.eyeY, p.z, dx[0], dx[1], dx[2], 5, true); if (h && isFluid(h.id) && w.getMeta(h.x, h.y, h.z) === 0) { w.setBlock(h.x, h.y, h.z, 0, 0); const nid = isWater(h.id) ? 326 : 327; if (p.creative) {} else if (held.count === 1) inv.slots[inv.selected] = { id: nid, count: 1, dmg: 0 }; else { held.count--; if (inv.add({ id: nid, count: 1, dmg: 0 })) this.dropStack({ id: nid, count: 1, dmg: 0 }); } p.swing = 6; this.ticker.notifyNeighbors(h.x, h.y, h.z); } return; }
    if (!t) { if (it && it.armor !== undefined && !inv.armor[it.armor]) { inv.armor[it.armor] = { ...held, count: 1 }; inv.slots[inv.selected] = held.count > 1 ? { ...held, count: held.count - 1 } : null; this.sound('place:cloth', p, 1, 1); p.swing = 6; return; } if (held && held.id === 261) this.mobs.shootArrow(p); if (held && (held.id === 332 || held.id === 344)) { this.mobs.throwItem(p, held.id); if (!p.creative) inv.consumeHeld(); } return; }
    const b = BL[t.id];
    // block activation
    if (!p.sneak || !held) {
      if (b.gui === 'workbench') { this.gui.open(new Screens.Workbench()); return; }
      if (t.id === 137) { if (!p.creative) return; let tile = w.getTile(t.x, t.y, t.z); if (!tile) { tile = { cmd: '' }; w.setTile(t.x, t.y, t.z, tile); } this.gui.open(new Screens.CommandBlock(tile)); return; }
      if (b.container === 'chest') { let tile = w.getTile(t.x, t.y, t.z); if (!tile) { tile = { items: new Array(27).fill(null) }; w.setTile(t.x, t.y, t.z, tile); } Sound.play('chest', 0.5); this.gui.open(new Screens.Chest(tile, t)); return; }
      if (b.container === 'furnace') { let tile = w.getTile(t.x, t.y, t.z); if (!tile) { tile = { slots: [null, null, null], burn: 0, burnMax: 0, cook: 0 }; w.setTile(t.x, t.y, t.z, tile); } this.ticker.addFurnace(t.x, t.y, t.z); this.gui.open(new Screens.Furnace(tile, t)); return; }
      if (b.container === 'brewing') { let tile = w.getTile(t.x, t.y, t.z); if (!tile) { tile = { slots: [null, null, null, null], brew: 0, brewing: true }; w.setTile(t.x, t.y, t.z, tile); } this.ticker.addFurnace(t.x, t.y, t.z); this.gui.open(new Screens.BrewingStand(tile, t)); return; }
      if (t.id === 26) { this.sleep(t); return; }
      if ((t.id === 85 || t.id === 113) && this.mobs.leashFence(p, t.x, t.y, t.z)) { p.swing = 6; return; }
      if (t.id === 64) { this.setDoor(t.x, t.y, t.z, !(t.meta & 4)); p.swing = 6; return; }
      if (t.id === 69) { w.setBlock(t.x, t.y, t.z, 69, t.meta ^ 8); this.sound('click', t, 1, t.meta & 8 ? 0.5 : 0.6); p.swing = 6; return; }
      if (t.id === 77 || t.id === 143) { this.redstone.press(t.x, t.y, t.z); p.swing = 6; return; }
      if (t.id === 93 || t.id === 94) { w.setBlock(t.x, t.y, t.z, t.id, (t.meta + 4) & 15); this.sound('click', t, 0.3, 0.5 + ((t.meta >> 2) & 3) * 0.1); p.swing = 6; return; }
      if (t.id === 107) { let m = t.meta; if (m & 4) m &= ~4; else { const f = this.lookFacing(); m = (m & 1) === (f & 1) ? ((m & 1) | (f & 2) | 4) : (m | 4); } w.setBlock(t.x, t.y, t.z, 107, m); this.sound('door', t, 1, 1.1); p.swing = 6; return; }
      if (t.id === 25) { w.setBlock(t.x, t.y, t.z, 25, (t.meta % 25 + 1) % 25); playNote(this, t.x, t.y, t.z); p.swing = 6; return; }
      if (t.id === 84) { const tile = w.getTile(t.x, t.y, t.z) || {}; if (tile.record) { this.ejectRecord(t.x, t.y, t.z); p.swing = 6; return; }
        if (it && it.record) { tile.record = held.id; w.setTile(t.x, t.y, t.z, tile); Music.playRecord(it.record, { x: t.x, y: t.y, z: t.z }); if (this.hud) this.hud.nowPlaying('C418 - ' + it.record); if (!p.creative) inv.consumeHeld(); p.swing = 6; return; } }
      if (t.id === 46 && held && held.id === 259) { w.setBlock(t.x, t.y, t.z, 0); this.mobs.spawnTNT(t.x, t.y, t.z); this.damageHeld(1); return; }
    }
    if (!held) return;
    if (it && it.armor !== undefined && !inv.armor[it.armor]) { inv.armor[it.armor] = { ...held, count: 1 }; inv.slots[inv.selected] = held.count > 1 ? { ...held, count: held.count - 1 } : null; this.sound('place:cloth', p, 1, 1); p.swing = 6; return; }
    const [fx, fy, fz] = t.face; let x = t.x + fx, y = t.y + fy, z = t.z + fz;
    if (b.replaceable && t.id !== 8 && t.id !== 10) { x = t.x; y = t.y; z = t.z; }
    // tools on blocks
    if (it.tool === 'hoe' && (t.id === 2 || t.id === 3) && fy >= 0 && !w.getBlock(t.x, t.y + 1, t.z)) { w.setBlock(t.x, t.y, t.z, 60, 0); this.sound('step:gravel', t); this.damageHeld(1); p.swing = 6; return; }
    if (held.id === 351 && held.dmg === 15) { if (this.ticker.boneMeal(t.x, t.y, t.z)) { if (!p.creative) inv.consumeHeld(); p.swing = 6; } return; }
    if (held.id === 259) { if (!w.getBlock(x, y, z) && lightPortal(w, x, y, z)) { this.sound('fizz', t, 0.5); Sound.play('portal', 0.5, 1); this.damageHeld(1); return; } if (!w.getBlock(x, y, z)) { w.setBlock(x, y, z, 51, 0); this.sound('fizz', t, 0.5); this.damageHeld(1); this.ticker.schedule(x, y, z, 30); } return; }
    if (held.id === 326 || held.id === 327) { const cur = w.getBlock(x, y, z); if (held.id === 326 && w.dim === -1 && (!cur || BL[cur].replaceable)) { this.sound('fizz', { x, y, z }, 0.5, 2.6); for (let i = 0; i < 8; i++) this.particles.fx('smoke', x + Math.random(), y + Math.random(), z + Math.random()); if (!p.creative) inv.slots[inv.selected] = { id: 325, count: 1, dmg: 0 }; p.swing = 6; return; } if (!cur || BL[cur].replaceable) { w.setBlock(x, y, z, held.id === 326 ? 8 : 10, 0); this.ticker.schedule(x, y, z, 1); if (!p.creative) inv.slots[inv.selected] = { id: 325, count: 1, dmg: 0 }; p.swing = 6; } return; }
    if (held.id === 355) { this.placeBed(x, y, z); return; }
    if (held.id === 323) { // sign: standing on top faces, on walls otherwise
      if (fy === -1 || y < 0 || y >= 128) return; const cur = w.getBlock(x, y, z); if (cur && !BL[cur].replaceable) return;
      let id, meta;
      if (fy === 1) { if (!SOLID[w.getBlock(x, y - 1, z)]) return; id = 63; meta = Math.round(p.yaw / (Math.PI / 8)) & 15; }
      else { if (!SOLID[t.id]) return; id = 68; meta = fz === -1 ? 2 : fz === 1 ? 3 : fx === -1 ? 4 : 5; }
      w.setBlock(x, y, z, id, meta); const tile = { text: ['', '', '', ''] }; w.setTile(x, y, z, tile);
      this.sound('place:wood', { x, y, z }); p.swing = 6; if (!p.creative) inv.consumeHeld();
      this.signs && this.signs.markDirty(); this.unlock(); this.gui.open(new Screens.SignEdit(tile, () => { w.setTile(x, y, z, tile); this.signs && this.signs.markDirty(); }));
      return;
    }
    if (it.door) { // two blocks tall; closed panel sits on the side facing the player
      if (fy !== 1 || y < 1 || y >= 127) return;
      for (const yy of [y, y + 1]) { const c = w.getBlock(x, yy, z); if (c && !BL[c].replaceable) return; }
      if (!SOLID[w.getBlock(x, y - 1, z)]) return;
      const hw = p.w / 2; if (x + 1 > p.x - hw && x < p.x + hw && y + 2 > p.y && y < p.y + p.h && z + 1 > p.z - hw && z < p.z + hw) return; if (this.mobs.blocking(x, y, z) || this.mobs.blocking(x, y + 1, z)) return;
      const a = ((p.yaw / (Math.PI / 2)) % 4 + 4.5) % 4 | 0; let m = 3 - a;
      w.setBlock(x, y, z, it.door, m); w.setBlock(x, y + 1, z, it.door, m | 8);
      if (it.door === 71 && this.doorPowered(x, y, z)) this.setDoor(x, y, z, true);
      this.sound('place:' + BL[it.door].sound, { x, y, z }, 1, 0.8); p.swing = 6; if (!p.creative) inv.consumeHeld();
      return;
    }
    if (it.egg) { const et = EGG[held.dmg] && EGG[held.dmg][1]; if (et && y >= 0 && y < 128 && this.mobs.useEgg(et, x, y, z)) { p.swing = 6; if (!p.creative) inv.consumeHeld(); } return; }
    let placeId = it.block !== undefined ? it.block : it.places; if (placeId === undefined) { if (it.food) return; return; }
    if (it.placeOn && !it.placeOn.includes(t.id)) return; if (it.placeOn && fy !== 1) return;
    if (y < 0 || y >= 128) return;
    const cur = w.getBlock(x, y, z); if (cur && !BL[cur].replaceable) return;
    let meta = 0; const pb = BL[placeId];
    // placement rules
    if (pb.needsSupport && !this.canStay(placeId, x, y, z, t.face)) return;
    if (placeId === 50) { meta = fy === 1 ? 5 : fx === 1 ? 1 : fx === -1 ? 2 : fz === 1 ? 3 : fz === -1 ? 4 : 0; if (!meta) return; }
    if (placeId === 69 || placeId === 77 || placeId === 143 || placeId === 76) { meta = fy === 1 ? 5 : fx === 1 ? 1 : fx === -1 ? 2 : fz === 1 ? 3 : fz === -1 ? 4 : 0; if (!meta) return; }
    if (placeId === 93) meta = this.lookFacing();
    if (placeId === 107) meta = this.lookFacing();
    if (placeId === 65) { if (fy !== 0) return; meta = fz === -1 ? 2 : fz === 1 ? 3 : fx === -1 ? 4 : 5; }
    if (placeId === 106) { if (fy !== 0) return; meta = fz === -1 ? 1 : fz === 1 ? 4 : fx === -1 ? 8 : 2; }
    if (pb.piston) meta = pistonFacing(p);
    if (pb.facing) { const a = ((p.yaw / (Math.PI / 2)) % 4 + 4.5) % 4 | 0; meta = [0, 1, 2, 3][a]; meta = [0, 3, 2, 1][a]; }
    if (placeId === 17 || placeId === 18 || placeId === 6 || placeId === 161 || placeId === 162) meta = held.dmg & 7;
    else if (pb.variants) meta = held.dmg & 15;
    if (placeId === 44 && t.id === 44 && fy === 1 && x === t.x + fx) { if (w.getBlock(t.x, t.y, t.z) === 44 && fy === 1) { x = t.x; y = t.y; z = t.z; placeId = 43; } }
    if (SOLID[placeId]) { const hw = p.w / 2; if (x + 1 > p.x - hw && x < p.x + hw && y + 1 > p.y && y < p.y + p.h && z + 1 > p.z - hw && z < p.z + hw) return; if (this.mobs.blocking(x, y, z)) return; }
    w.setBlock(x, y, z, placeId, meta);
    if (pb.fluid || pb.falls) this.ticker.schedule(x, y, z, 2);
    this.ticker.notifyNeighbors(x, y, z);
    this.sound('place:' + this.matSound(placeId), { x, y, z }, 1, 0.8);
    p.swing = 6; if (!p.creative) inv.consumeHeld();
    this.achievements.onPlace(placeId);
    if (placeId === 86 || placeId === 91) this.mobs.tryBuildGolem(x, y, z);
    if (isRail(placeId)) railPlaced(w, x, y, z, this.lookFacing());
    updateRedstone(this, x, y, z);
  }
  // open/close both halves of a door (x,y,z = either half)
  openTrade(v) { this.gui.open(new Screens.Merchant(v)); }
  openNameTag(m, done) { this.gui.open(new Screens.NameTag(m, done)); }
  openHorse(h) { this.gui.open(new Screens.HorseInventory(h)); }
  setDoor(x, y, z, open) {
    const w = this.world; const id = w.getBlock(x, y, z); if (!isDoor(id)) return;
    if (w.getMeta(x, y, z) & 8) y--; if (w.getBlock(x, y, z) !== id) return;
    const m = w.getMeta(x, y, z); if (!!(m & 4) === open) return; const nm = open ? (m | 4) : (m & ~4);
    w.setBlock(x, y, z, id, nm & 7); if (w.getBlock(x, y + 1, z) === id) w.setBlock(x, y + 1, z, id, (nm & 7) | 8);
    this.sound('door', { x, y, z }, 1, id === 71 ? 0.6 : 1);
  }
  doorPowered(x, y, z) { return rsDoorPowered(this.world, x, y, z); }
  updateIronDoors() {}
  // horizontal direction the player looks (0 N, 1 E, 2 S, 3 W)
  lookFacing() { const p = this.player, dx = -Math.sin(p.yaw), dz = -Math.cos(p.yaw); return Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? 1 : 3) : (dz > 0 ? 2 : 0); }
  canStay(id, x, y, z, face) {
    const w = this.world; const below = w.getBlock(x, y - 1, z);
    if (id === 6 || id === 31 || id === 37 || id === 38) return below === 2 || below === 3 || below === 60;
    if (id === 39 || id === 40) return SOLID[below] && BL[below].opaque;
    if (id === 59) return below === 60;
    if (id === 115) return below === 88;
    if (id === 117) return SOLID[below] > 0;
    if (id === 81) { if (below !== 12 && below !== 81) return false; for (const [dx, dz] of [[1,0],[-1,0],[0,1],[0,-1]]) if (SOLID[w.getBlock(x + dx, y, z + dz)]) return false; return true; }
    if (id === 83) { if (below === 83) return true; if (below !== 2 && below !== 3 && below !== 12) return false; for (const [dx, dz] of [[1,0],[-1,0],[0,1],[0,-1]]) if (isWater(w.getBlock(x + dx, y - 1, z + dz))) return true; return false; }
    if (id === 55 || id === 70 || id === 72 || id === 93 || isRail(id)) return !!(OPAQUE[below] || below === 44 || below === 89);
    if (id === 77 || id === 143) id = 69;
    if (id === 76) id = 50;
    if (id === 50) { if (face && face[1] === -1) return false; if (face && face[1] === 1) return SOLID[below] && BL[below].opaque || below === 44; return face ? BL[w.getBlock(x - face[0], y, z - face[2])].opaque : false; }
    if (id === 78) return SOLID[below] && BL[below].opaque;
    if (id === 69) { if (!face || face[1] === -1) return false; if (face[1] === 1) return !!SOLID[below]; return !!OPAQUE[w.getBlock(x - face[0], y, z - face[2])]; }
    if (id === 65 || id === 106) return face && face[1] === 0 && BL[w.getBlock(x - face[0], y, z - face[2])].opaque;
    return true;
  }
  placeBed(x, y, z) { const w = this.world, p = this.player; const a = ((p.yaw / (Math.PI / 2)) % 4 + 4.5) % 4 | 0; const d = [[0, -1], [-1, 0], [0, 1], [1, 0]][a];
    const x2 = x + d[0], z2 = z + d[1]; if (w.getBlock(x, y, z) || w.getBlock(x2, y, z2) || !SOLID[w.getBlock(x, y - 1, z)] || !SOLID[w.getBlock(x2, y - 1, z2)]) return;
    w.setBlock(x, y, z, 26, a); w.setBlock(x2, y, z2, 26, a | 8); this.sound('place:wood', { x, y, z }); if (!p.creative) p.inv.consumeHeld(); }
  // remove the other half of a bed whose half at x,y,z was just removed (meta = that half's old meta)
  breakBedPart(x, y, z, meta) { const w = this.world; if (meta === undefined) return; const d = [[0, -1], [-1, 0], [0, 1], [1, 0]][meta & 3], s = meta & 8 ? -1 : 1;
    const ox = x + d[0] * s, oz = z + d[1] * s; if (w.getBlock(ox, y, oz) === 26) { w.setBlock(ox, y, oz, 0, 0); this.ticker.notifyNeighbors(ox, y, oz); } }
  sleep(t) {
    if (this.world.dim === -1) { const w = this.world; for (const [x, z] of [[t.x, t.z], [t.x - 1, t.z], [t.x + 1, t.z], [t.x, t.z - 1], [t.x, t.z + 1]]) if (w.getBlock(x, t.y, z) === 26) w.setBlock(x, t.y, z, 0, 0); this.mobs.explode(t.x + 0.5, t.y + 0.5, t.z + 0.5, 5, null); return; }
    const tod = this.time % 24000; if (tod < 12541 || tod > 23458) { this.addChat('You can only sleep at night'); return; }
    if (this.mobs.hostileNear(t.x, t.y, t.z, 8)) { this.addChat('You may not rest now, there are monsters nearby'); return; }
    this.player.bedSpawn = [t.x + 0.5, t.y + 0.6, t.z + 0.5]; this.gui.open(new Screens.Sleep());
  }

  // ---------------- frame ----------------
  frame(now) {
    requestAnimationFrame(t => this.frame(t));
    let dt = now - this.last; this.last = now; if (dt > 250) dt = 250;
    this.frames++; this.fpsT += dt; if (this.fpsT >= 1000) { this.fps = this.frames; this.frames = 0; this.fpsT -= 1000; }
    Music.setMode(this.world && !this.loadingWorld ? 'game' : this.world ? null : 'menu');
    if (this.world) {
      this.acc += dt; let n = 0; while (this.acc >= 50 && n < 5) { this.tick(); this.acc -= 50; n++; } if (n >= 5) this.acc = 0;
      if (this.world) this.renderWorld(this.acc / 50);
    } else this.renderTitleBackground(now);
    if (this.gui.screen && this.gui.screen.tick) this.gui.screen.tick(dt);
    this.gui.frame();
  }
  renderWorld(pt) {
    const p = this.player, r = this.renderer, cam = r.camera; if (!p) return;
    const x = p.px + (p.x - p.px) * pt, y = p.py + (p.y - p.py) * pt, z = p.pz + (p.z - p.pz) * pt;
    cam.position.set(x, y + p.eye - (p.sneak ? 0.08 : 0), z); cam.rotation.set(p.pitch, p.yaw, 0);
    if (this.settings.bobbing && !p.flying) { const wd = p.pWalkDist + (p.walkDist - p.pWalkDist) * pt; const bob = p.pBob + (p.bob - p.pBob) * pt; cam.position.y += -Math.abs(Math.cos(wd * Math.PI)) * bob * 0.5 + bob * 0.25; cam.rotation.z = Math.sin(wd * Math.PI) * bob * 0.03; cam.rotation.x += Math.abs(Math.cos(wd * Math.PI - 0.2)) * bob * 0.05; }
    if (p.hurtTime > 0) cam.rotation.z += Math.sin((p.hurtTime - pt) / 10 * Math.PI) * 0.12;
    if (p.dead) { cam.position.y = y + 0.3; cam.rotation.z = 0.6; }
    let fov = 70 + this.settings.fov * 40; if (p.sprint) fov *= 1.15; if (p.eyeInWater === 'water') fov *= 60 / 70; this._fov = (this._fov || fov) + (fov - (this._fov || fov)) * 0.3; cam.fov = this._fov; cam.updateProjectionMatrix();
    if (this.thirdPerson && !p.dead) { // pull the camera back (or out in front), stopping short of blocks like the classic client
      const s = this.thirdPerson === 2 ? -1 : 1; const dx = Math.sin(p.yaw) * Math.cos(p.pitch) * s, dy = -Math.sin(p.pitch) * s, dz = Math.cos(p.yaw) * Math.cos(p.pitch) * s;
      const o = cam.position; let d = 4;
      for (let i = 0; i < 8; i++) { const ox = o.x + ((i & 1) * 2 - 1) * 0.1, oy = o.y + ((i >> 1 & 1) * 2 - 1) * 0.1, oz = o.z + ((i >> 2 & 1) * 2 - 1) * 0.1;
        const h = raycast(this.world, ox, oy, oz, dx, dy, dz, d); if (h && h.dist < d) d = Math.max(0, h.dist - 0.1); }
      o.x += dx * d; o.y += dy * d; o.z += dz * d; cam.rotation.z = 0;
      if (s < 0) cam.rotation.set(-p.pitch, p.yaw + Math.PI, 0);
    }
    const biome = BIOMES[this.world.biomeAt(Math.floor(x), Math.floor(z))];
    r.updateSky(this.time + pt, biome.temp, this.renderDist, p.eyeInWater, this.world.dim);
    r.updateMeshes(x, z, this.loadingWorld ? 30 : 6);
    const t = this.target; if (t && !t.entity && !this.hideGui) r.setSelection([t.x, t.y, t.z], t.box); else r.setSelection(null);
    const daySub = r.uniforms.daySub.value;
    for (const e of this.entities) e.render(r, pt, daySub);
    this.mobs.render(pt, daySub);
    this.signs.update(daySub);
    this.playerModel.update(pt, daySub);
    this.companion?.render(pt, daySub);
    if (this.net) this.net.render(pt, daySub);
    this.particles.update(this.world, daySub);
    this.hand.update(pt, daySub);
    r.render();
    if (!this.thirdPerson && !this.hideGui) this.hand.render();
    if (this.screenshot) { this.screenshot = false; const a = document.createElement('a'); a.href = this.canvas.toDataURL('image/png'); a.download = 'screenshot.png'; a.click(); this.addChat('Saved screenshot'); }
  }
  // spinning blurred panorama for the title screen
  renderTitleBackground(now) {
    if (!this.titleWorld) { this.titleWorld = true; this.renderer.gl.setClearColor(0x6b8cff); }
    this.renderer.gl.clear();
  }
}
