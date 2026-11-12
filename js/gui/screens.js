// Menu screens: title, world select/create, multiplayer, texture packs, options, pause, death, chat
import { Screen, Button, Slider, TextField, drawDirtBg } from './gui.js';
import { drawText, drawTextCentered, drawTextRight, textWidth } from './font.js';
import { getLogo } from './logo.js';
import { Saves } from '../save/saves.js';
import { seedHash } from '../world/noise.js';
import { SECRET } from '../game.js';
import * as Keys from './keys.js';
import { Skins } from '../engine/skin.js';
import { drawPlayerPreview } from '../engine/playermodel.js';
export * from './containers.js';

const W200 = 200;
const menuPanorama = new Image();
menuPanorama.src = new URL('../../textures/title-panorama.jpg', import.meta.url).href;
export class MainMenu extends Screen {
  constructor() { super(); this.title = true; }
  layout() {
    const w = this.w, y = Math.floor(this.h / 4) + 48;
    this.buttons.push(new Button(1, w / 2 - 100, y, 200, 20, 'Singleplayer', () => this.gui.open(new WorldSelect(this))));
    this.buttons.push(new Button(2, w / 2 - 100, y + 24, 200, 20, 'Multiplayer', () => this.gui.open(new Multiplayer(this))));
    const realms = new Button(14, w / 2 - 100, y + 48, 200, 20, 'Minecraft Realms', () => {}); realms.enabled = false; this.buttons.push(realms);
    this.buttons.push(new Button(0, w / 2 - 100, y + 84, 98, 20, 'Options...', () => this.gui.open(new Options(this))));
    this.buttons.push(new Button(4, w / 2 + 2, y + 84, 98, 20, 'Quit Game', () => this.gui.open(new QuitScreen())));
    this.buttons.push(new Button(5, w / 2 - 124, y + 84, 20, 20, '', () => this.gui.open(new Language(this))));
  }
  drawBackground(ctx) {
    const im = menuPanorama;
    if (im.complete && im.naturalWidth) {
      // cover the screen by height (slightly zoomed), then pan slowly back and forth like the 1.7 title panorama
      const s = Math.max(this.h / im.naturalHeight, this.w / im.naturalWidth) * 1.08, dw = im.naturalWidth * s, dh = im.naturalHeight * s;
      const span = Math.max(0, dw - this.w), k = (1 - Math.cos(performance.now() / 40000 * Math.PI * 2)) / 2;
      ctx.save(); ctx.imageSmoothingEnabled = true; ctx.filter = 'blur(1px)';
      ctx.drawImage(im, -span * k, (this.h - dh) / 2, dw, dh); ctx.restore();
    } else { ctx.fillStyle = '#253849'; ctx.fillRect(0, 0, this.w, this.h); }
    const g = ctx.createLinearGradient(0, 0, 0, this.h); g.addColorStop(0, 'rgba(255,255,255,0.12)'); g.addColorStop(0.5, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.35)'); ctx.fillStyle = g; ctx.fillRect(0, 0, this.w, this.h);
  }
  draw(ctx, mx, my) {
    const lg = getLogo(), y = Math.floor(this.h / 4) + 48;
    if (lg.complete && lg.naturalWidth) { const scale = Math.min(0.9, (this.w - 24) / lg.width, (y - 38) / lg.height), w = lg.width * scale, h = lg.height * scale; ctx.drawImage(lg, (this.w - w) / 2, 24, w, h); }
    super.draw(ctx, mx, my);
    // globe icon on language button
    const b = this.buttons[5]; ctx.fillStyle = '#2050c0'; ctx.fillRect(b.x + 5, b.y + 4, 10, 12); ctx.fillRect(b.x + 4, b.y + 5, 12, 10); ctx.fillStyle = '#30a030'; ctx.fillRect(b.x + 6, b.y + 6, 3, 4); ctx.fillRect(b.x + 10, b.y + 9, 4, 4); ctx.fillStyle = '#e0e0ff'; ctx.fillRect(b.x + 7, b.y + 5, 2, 1);
    drawText(ctx, 'Minecraft 1.7.10', 2, this.h - 10, '#ffffff');
    drawTextRight(ctx, 'Copyright Mojang AB. Do not distribute!', this.w - 2, this.h - 10, '#ffffff');
    drawTextCentered(ctx, 'logo made by djboor', this.w / 2, this.h - 22, '#c0c0c0');
  }
  key(e) { return false; }
}
class QuitScreen extends Screen {
  layout() { this.buttons.push(new Button(0, this.w / 2 - 100, this.h / 2 + 20, 200, 20, 'Back to title', () => this.gui.open(new MainMenu()))); }
  draw(ctx, mx, my) { drawTextCentered(ctx, 'Thanks for playing!', this.w / 2, this.h / 2 - 20, '#ffffff'); drawTextCentered(ctx, 'You can now close this tab.', this.w / 2, this.h / 2 - 6, '#a0a0a0'); super.draw(ctx, mx, my); }
}
export class Progress extends Screen {
  constructor(title, sub) { super(); this.t = title; this.s = sub; }
  drawBackground(ctx) { drawDirtBg(ctx, this.w, this.h); }
  draw(ctx) { drawTextCentered(ctx, this.t, this.w / 2, this.h / 2 - 50, '#ffffff'); drawTextCentered(ctx, this.s, this.w / 2, this.h / 2 - 30, '#ffffff');
    const g = this.gui.game; if (g.world) { const n = g.world.chunks.size; const tot = (2 * g.renderDist + 1) ** 2 * 0.3; const f = Math.min(1, n / tot); ctx.fillStyle = '#808080'; ctx.fillRect(this.w / 2 - 50, this.h / 2 + 16, 100, 2); ctx.fillStyle = '#80ff80'; ctx.fillRect(this.w / 2 - 50, this.h / 2 + 16, 100 * f, 2); } }
  key() { return true; }
}

// ---------------- world selection ----------------
function fmtDate(t) { const d = new Date(t); const p = n => String(n).padStart(2, '0'); return p(d.getMonth() + 1) + '/' + p(d.getDate()) + '/' + String(d.getFullYear()).slice(2) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()); }
class ListScreen extends Screen {
  constructor(parent) { super(); this.parent = parent; this.sel = -1; this.scroll = 0; this.list = []; this.slotH = 36; }
  get top() { return 32; } get bottom() { return this.h - 64; }
  drawBackground(ctx) { drawDirtBg(ctx, this.w, this.h); ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, this.top, this.w, this.bottom - this.top);
    const g1 = ctx.createLinearGradient(0, this.top, 0, this.top + 4); g1.addColorStop(0, 'rgba(0,0,0,1)'); g1.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g1; ctx.fillRect(0, this.top, this.w, 4);
    const g2 = ctx.createLinearGradient(0, this.bottom - 4, 0, this.bottom); g2.addColorStop(0, 'rgba(0,0,0,0)'); g2.addColorStop(1, 'rgba(0,0,0,1)'); ctx.fillStyle = g2; ctx.fillRect(0, this.bottom - 4, this.w, 4); }
  drawList(ctx, drawRow) {
    ctx.save(); ctx.beginPath(); ctx.rect(0, this.top, this.w, this.bottom - this.top); ctx.clip();
    this.list.forEach((it, i) => { const y = this.top + 4 + i * this.slotH - this.scroll; if (y + this.slotH < this.top || y > this.bottom) return; const x = this.w / 2 - 110;
      if (i === this.sel) { ctx.fillStyle = '#808080'; ctx.fillRect(x - 2, y - 2, 220, this.slotH - 2); ctx.fillStyle = '#000'; ctx.fillRect(x - 1, y - 1, 218, this.slotH - 4); }
      drawRow(ctx, it, x + 2, y + 1); });
    ctx.restore();
  }
  mouseDown(mx, my, b) { if (super.mouseDown(mx, my, b)) return true; if (my > this.top && my < this.bottom && Math.abs(mx - this.w / 2) < 110) { const i = Math.floor((my - this.top - 4 + this.scroll) / this.slotH); if (i >= 0 && i < this.list.length) { const now = performance.now(); if (i === this.sel && now - (this.lastClick || 0) < 300) this.activate(); this.sel = i; this.lastClick = now; this.updateButtons(); } } }
  wheel(d) { const max = Math.max(0, this.list.length * this.slotH - (this.bottom - this.top - 8)); this.scroll = Math.max(0, Math.min(max, this.scroll + d * 18)); }
  activate() {} updateButtons() {}
  key(e) { if (e.key === 'Escape') { this.gui.open(this.parent); return true; } return super.key(e); }
}
export class WorldSelect extends ListScreen {
  constructor(parent) { super(parent); Saves.list().then(l => { this.list = l; if (this.gui) this.updateButtons(); }); }
  layout() {
    const w = this.w, h = this.h;
    this.bPlay = new Button(1, w / 2 - 154, h - 52, 150, 20, 'Play Selected World', () => this.activate());
    this.buttons.push(this.bPlay, new Button(3, w / 2 + 4, h - 52, 150, 20, 'Create New World', () => this.gui.open(new CreateWorld(this))));
    this.bRen = new Button(6, w / 2 - 154, h - 28, 72, 20, 'Rename', () => this.gui.open(new RenameWorld(this, this.list[this.sel])));
    this.bDel = new Button(2, w / 2 - 76, h - 28, 72, 20, 'Delete', () => this.gui.open(new Confirm(this, 'Are you sure you want to delete this world?', "'" + this.list[this.sel].name + "' will be lost forever! (A long time!)", 'Delete', async () => { await Saves.remove(this.list[this.sel].id); this.gui.open(new WorldSelect(this.parent)); })));
    this.buttons.push(this.bRen, this.bDel, new Button(0, w / 2 + 4, h - 28, 150, 20, 'Cancel', () => this.gui.open(this.parent)));
    this.updateButtons();
  }
  updateButtons() { const ok = this.sel >= 0 && this.sel < this.list.length; if (this.bPlay) this.bPlay.enabled = this.bRen.enabled = this.bDel.enabled = ok; }
  activate() { const w = this.list[this.sel]; if (w) this.gui.game.startWorld(w); }
  draw(ctx, mx, my) {
    this.drawList(ctx, (ctx, w, x, y) => { drawText(ctx, w.name, x, y + 1, '#ffffff'); drawText(ctx, w.folder + ' (' + fmtDate(w.lastPlayed) + ')', x, y + 12, '#808080'); drawText(ctx, (w.hardcore ? 'Hardcore Mode!' : w.gamemode === 1 ? 'Creative Mode' : 'Survival Mode'), x, y + 22, w.hardcore ? '#ff5555' : '#808080'); });
    drawTextCentered(ctx, 'Select World', this.w / 2, 20, '#ffffff'); super.draw(ctx, mx, my);
  }
}
class Confirm extends Screen {
  constructor(parent, l1, l2, yes, fn) { super(); Object.assign(this, { parent, l1, l2, yes, fn }); }
  layout() { this.buttons.push(new Button(0, this.w / 2 - 155, this.h / 6 + 96, 150, 20, this.yes, () => this.fn()), new Button(1, this.w / 2 + 5, this.h / 6 + 96, 150, 20, 'Cancel', () => this.gui.open(this.parent))); }
  draw(ctx, mx, my) { drawTextCentered(ctx, this.l1, this.w / 2, 70, '#ffffff'); drawTextCentered(ctx, this.l2, this.w / 2, 90, '#ffffff'); super.draw(ctx, mx, my); }
}
class RenameWorld extends Screen {
  constructor(parent, world) { super(); this.parent = parent; this.world = world; }
  layout() { const f = new TextField(this.w / 2 - 100, 60, 200, 20, this.world.name); f.focused = true; this.fields.push(f); this.f = f;
    this.buttons.push(new Button(0, this.w / 2 - 100, this.h / 4 + 96 + 12, 200, 20, 'Rename', async () => { await Saves.rename(this.world.id, this.f.value.trim() || 'New World'); this.gui.open(new WorldSelect(this.parent.parent)); }), new Button(1, this.w / 2 - 100, this.h / 4 + 120 + 12, 200, 20, 'Cancel', () => this.gui.open(this.parent))); }
  draw(ctx, mx, my) { drawTextCentered(ctx, 'Rename World', this.w / 2, this.h / 4 - 60 + 20, '#ffffff'); drawText(ctx, 'Enter Name', this.w / 2 - 100, 47, '#a0a0a0'); super.draw(ctx, mx, my); }
  key(e) { if (e.key === 'Enter') { this.buttons[0].onClick(); return true; } if (e.key === 'Escape') { this.gui.open(this.parent); return true; } return super.key(e); }
}
// naming a mob with a name tag (there is no anvil, so the tag is written on use)
export class NameTag extends Screen {
  constructor(mob, done) { super(); this.mob = mob; this.done = done; this.pausesGame = false; }
  layout() { const f = new TextField(this.w / 2 - 100, 60, 200, 20, this.mob.nameTag || '', 30); f.focused = true; this.fields.push(f); this.f = f;
    this.buttons.push(new Button(0, this.w / 2 - 100, this.h / 4 + 96 + 12, 200, 20, 'Done', () => { const n = this.f.value.trim(); if (n) this.done(n); this.gui.open(null); }), new Button(1, this.w / 2 - 100, this.h / 4 + 120 + 12, 200, 20, 'Cancel', () => this.gui.open(null))); }
  draw(ctx, mx, my) { drawTextCentered(ctx, 'Name Tag', this.w / 2, this.h / 4 - 40, '#ffffff'); drawText(ctx, 'Enter Name', this.w / 2 - 100, 47, '#a0a0a0'); super.draw(ctx, mx, my); }
  key(e) { if (e.key === 'Enter') { this.buttons[0].onClick(); return true; } if (e.key === 'Escape') { this.gui.open(null); return true; } return super.key(e); }
}
// command block editor (creative only)
export class CommandBlock extends Screen {
  constructor(tile) { super(); this.tile = tile; this.pausesGame = false; }
  layout() { const f = new TextField(this.w / 2 - 150, 60, 300, 20, this.tile.cmd || '', 256); f.focused = true; this.fields.push(f); this.f = f;
    this.buttons.push(new Button(0, this.w / 2 - 154, this.h / 4 + 120 + 12, 150, 20, 'Done', () => { this.tile.cmd = this.f.value.trim(); this.gui.open(null); }), new Button(1, this.w / 2 + 4, this.h / 4 + 120 + 12, 150, 20, 'Cancel', () => this.gui.open(null))); }
  draw(ctx, mx, my) { drawTextCentered(ctx, 'Set Console Command for Block', this.w / 2, 20, '#ffffff'); drawText(ctx, 'Console Command', this.w / 2 - 150, 47, '#a0a0a0');
    drawText(ctx, 'Use "@p" to target nearest player', this.w / 2 - 150, 90, '#a0a0a0'); drawText(ctx, '~ coordinates are relative to the block', this.w / 2 - 150, 101, '#a0a0a0'); super.draw(ctx, mx, my); }
  key(e) { if (e.key === 'Enter') { this.buttons[0].onClick(); return true; } if (e.key === 'Escape') { this.gui.open(null); return true; } return super.key(e); }
}
const MODES = ['survival', 'hardcore', 'creative'];
const WORLD_TYPES = ['Default', 'Superflat', 'Large Biomes', 'AMPLIFIED'];
const MODE_DESC = { survival: ['Search for resources, crafting, gain', 'levels, health and hunger'], hardcore: ['Same as survival mode, locked at hardest', 'difficulty, and one life only'], creative: ['Unlimited resources, free flying and', 'destroy blocks instantly'] };
class CreateWorld extends Screen {
  constructor(parent) { super(); this.parent = parent; this.mode = 'survival'; this.more = false; this.structures = true; this.type = 0; this.cheats = null; this.bonus = false; this.name = 'New World'; this.seed = ''; }
  layout() {
    const w = this.w;
    this.fName = new TextField(w / 2 - 100, 60, 200, 20, this.name); this.fName.focused = !this.more; this.fSeed = new TextField(w / 2 - 100, 60, 200, 20, this.seed);
    this.fields.push(this.more ? this.fSeed : this.fName);
    this.buttons.push(new Button(0, w / 2 - 155, this.h - 28, 150, 20, 'Create New World', () => this.create()), new Button(1, w / 2 + 5, this.h - 28, 150, 20, 'Cancel', () => this.gui.open(this.parent)));
    if (!this.more) this.buttons.push(new Button(2, w / 2 - 75, 100, 150, 20, () => 'Game Mode: ' + this.mode[0].toUpperCase() + this.mode.slice(1), () => { this.mode = MODES[(MODES.indexOf(this.mode) + 1) % 3]; }));
    else { const hc = this.mode === 'hardcore';
      this.buttons.push(new Button(4, w / 2 - 155, 100, 150, 20, () => 'Generate Structures: ' + (this.structures ? 'ON' : 'OFF'), () => this.structures = !this.structures), new Button(5, w / 2 + 5, 100, 150, 20, () => 'World Type: ' + WORLD_TYPES[this.type], () => this.type = (this.type + 1) % WORLD_TYPES.length));
      const ch = new Button(6, w / 2 - 155, 151, 150, 20, () => 'Allow Cheats: ' + (this.allowCheats() ? 'ON' : 'OFF'), () => this.cheats = !this.allowCheats()), bc = new Button(7, w / 2 + 5, 151, 150, 20, () => 'Bonus Chest: ' + (this.bonus && !hc ? 'ON' : 'OFF'), () => this.bonus = !this.bonus);
      if (hc) ch.enabled = bc.enabled = false; this.buttons.push(ch, bc); }
    this.buttons.push(new Button(3, w / 2 - 75, this.more ? 187 : 172, 150, 20, () => this.more ? 'Done' : 'More World Options...', () => { this.name = this.fName.value; this.seed = this.fSeed.value; this.more = !this.more; this.init(this.gui); }));
  }
  allowCheats() { return this.mode !== 'hardcore' && (this.cheats ?? this.mode === 'creative'); }
  folder() { return (this.fName.value.trim() || 'World').replace(/[^a-zA-Z0-9 _-]/g, '_'); }
  async create() {
    if (this.creating) return; this.creating = true;
    if (this.more) this.seed = this.fSeed.value; else this.name = this.fName.value;
    const s = (this.more ? this.fSeed.value : this.seed).trim();
    const seed = s ? seedHash(s) : (Math.random() * 4294967296) >>> 0;
    const name = (this.more ? this.name : this.fName.value).trim() || 'New World';
    const existing = await Saves.list(); let folder = name.replace(/[^a-zA-Z0-9 _-]/g, '_'); while (existing.some(w => w.folder === folder)) folder += '-';
    const info = { id: 'w' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name, folder, seed, gamemode: this.mode === 'creative' ? 1 : 0, hardcore: this.mode === 'hardcore', structures: this.structures, type: this.type, cheats: this.allowCheats(), bonusChest: this.bonus && this.mode !== 'hardcore', created: Date.now(), lastPlayed: Date.now(), time: 0 };
    this.gui.game.startWorld(info);
  }
  draw(ctx, mx, my) {
    drawTextCentered(ctx, 'Create New World', this.w / 2, 20, '#ffffff');
    if (!this.more) { drawText(ctx, 'World Name', this.w / 2 - 100, 47, '#a0a0a0'); drawText(ctx, 'Will be saved in: ' + this.folder(), this.w / 2 - 100, 85, '#a0a0a0'); const d = MODE_DESC[this.mode]; drawText(ctx, d[0], this.w / 2 - 100, 122, '#a0a0a0'); drawText(ctx, d[1], this.w / 2 - 100, 134, '#a0a0a0'); }
    else { drawText(ctx, 'Seed for the World Generator', this.w / 2 - 100, 47, '#a0a0a0'); drawText(ctx, 'Leave blank for a random seed', this.w / 2 - 100, 85, '#a0a0a0'); drawText(ctx, 'Villages, dungeons etc', this.w / 2 - 150, 122, '#a0a0a0'); drawText(ctx, 'Commands like /gamemode, /xp', this.w / 2 - 150, 172, '#a0a0a0'); }
    super.draw(ctx, mx, my);
  }
  key(e) { if (e.key === 'Enter') { this.create(); return true; } if (e.key === 'Escape') { this.gui.open(this.parent); return true; } return super.key(e); }
}

// ---------------- multiplayer ----------------
function servers() { const s = JSON.parse(localStorage.getItem('mc125.servers') || '[]');
  if (!localStorage.getItem('mc125.wsimmc')) { localStorage.setItem('mc125.wsimmc', '1'); if (!s.some(x => x.ip === 'wsimmc')) s.unshift({ name: 'Websim SMP', ip: 'wsimmc' }); }
  if (!localStorage.getItem('mc125.wscrtv')) { localStorage.setItem('mc125.wscrtv', '1'); if (!s.some(x => x.ip === 'wscrtv')) s.push({ name: 'Websim Creative', ip: 'wscrtv' }); }
  if (!localStorage.getItem('mc125.3b3t')) { localStorage.setItem('mc125.3b3t', '1'); if (!s.some(x => x.ip === '3b3t')) s.push({ name: '3b3t', ip: '3b3t' }); }
  if (!localStorage.getItem('mc125.lowvoxel')) { localStorage.setItem('mc125.lowvoxel', '1'); if (!s.some(x => x.ip === 'lowvoxel')) s.splice(1, 0, { name: 'LowVoxel Network', ip: 'lowvoxel' }); }
  for (const server of s) if (server.ip === 'wsimmc' && server.name === 'Websim Test Server') server.name = 'Websim SMP';
  saveServers(s); return s; }
const net = () => import('../network/client.js');
function saveServers(s) { localStorage.setItem('mc125.servers', JSON.stringify(s.map(({ name, ip }) => ({ name, ip })))); }
class Multiplayer extends ListScreen {
  constructor(parent) { super(parent); this.list = servers(); this.ping(); }
  ping() { for (const s of this.list) { s.st = null; s.err = null; const t = performance.now(); net().then(m => m.status(s.ip)).then(r => { s.st = r; s.ms = Math.round(performance.now() - t); }, e => { s.err = e.message; }); } }
  layout() { const w = this.w, h = this.h;
    this.bEdit = new Button(7, w / 2 - 154, h - 28, 70, 20, 'Edit', () => this.gui.open(new EditServer(this, this.list[this.sel], s => { this.list[this.sel] = s; saveServers(this.list); })));
    this.bDel = new Button(2, w / 2 - 74, h - 28, 70, 20, 'Delete', () => this.gui.open(new Confirm(this, 'Are you sure you want to remove this server?', "'" + this.list[this.sel].name + "' will be lost forever! (A long time!)", 'Delete', () => { this.list.splice(this.sel, 1); saveServers(this.list); this.gui.open(new Multiplayer(this.parent)); })));
    const left = w / 2 - 154, bw = 74, gap = 4;
    this.bJoin = new Button(1, left, h - 52, bw, 20, 'Join Server', () => this.activate());
    this.buttons.push(this.bJoin,
      new Button(9, left + bw + gap, h - 52, bw, 20, 'Host Server', () => this.gui.open(new HostServer(this))),
      new Button(4, left + (bw + gap) * 2, h - 52, bw, 20, 'Direct', () => this.gui.open(new EditServer(this, { name: 'Minecraft Server', ip: '' }, s => this.gui.open(new Connecting(this, s.ip)), true))),
      new Button(3, left + (bw + gap) * 3, h - 52, bw, 20, 'Add Server', () => this.gui.open(new EditServer(this, { name: 'Minecraft Server', ip: '' }, s => { this.list.push(s); saveServers(this.list); }))),
      this.bEdit, this.bDel, new Button(8, w / 2 + 4, h - 28, 70, 20, 'Refresh', () => this.ping()), new Button(0, w / 2 + 80, h - 28, 75, 20, 'Cancel', () => this.gui.open(this.parent)));
    this.updateButtons(); }
  updateButtons() { const ok = this.sel >= 0 && this.sel < this.list.length; if (this.bJoin) this.bJoin.enabled = this.bEdit.enabled = this.bDel.enabled = ok; }
  activate() { const s = this.list[this.sel]; if (s) this.gui.open(new Connecting(this, s.ip)); }
  draw(ctx, mx, my) { this.drawList(ctx, (ctx, s, x, y) => { drawText(ctx, s.name, x, y + 1, '#ffffff');
      const st = s.st; drawText(ctx, st ? (st.motd || st.name) : s.err ? "Can't reach server" : 'Checking server...', x, y + 12, '#808080'); drawText(ctx, s.ip, x, y + 23, '#303030');
      if (st) { const n = st.online + '/' + st.max; drawTextRight(ctx, n, x + 200, y + 1, '#808080'); const bars = s.ms < 150 ? 5 : s.ms < 300 ? 4 : s.ms < 600 ? 3 : s.ms < 1000 ? 2 : 1;
        for (let i = 0; i < 5; i++) { ctx.fillStyle = i < bars ? '#00ff21' : '#303030'; ctx.fillRect(x + 204 + i * 2, y + 1 + 8 - (i + 1) * 1.6, 1, (i + 1) * 1.6); } }
      else drawTextRight(ctx, '???', x + 214, y + 1, '#808080'); });
    drawTextCentered(ctx, 'Play Multiplayer', this.w / 2, 20, '#ffffff'); super.draw(ctx, mx, my); }
}
class EditServer extends Screen {
  constructor(parent, s, done, direct) { super(); Object.assign(this, { parent, s: { ...s }, done, direct }); }
  layout() { const w = this.w; this.fName = new TextField(w / 2 - 100, 76, 200, 20, this.s.name); this.fIp = new TextField(w / 2 - 100, this.direct ? 76 : 116, 200, 20, this.s.ip, 128); (this.direct ? this.fIp : this.fName).focused = true;
    if (!this.direct) this.fields.push(this.fName); this.fields.push(this.fIp);
    this.buttons.push(new Button(0, w / 2 - 100, this.h / 4 + 96 + 12, 200, 20, this.direct ? 'Join Server' : 'Done', () => { this.s.name = this.fName.value; this.s.ip = this.fIp.value; this.gui.open(this.parent); this.done(this.s); this.parent.list = servers(); }), new Button(1, w / 2 - 100, this.h / 4 + 120 + 12, 200, 20, 'Cancel', () => this.gui.open(this.parent))); }
  draw(ctx, mx, my) { drawTextCentered(ctx, this.direct ? 'Direct Connect' : 'Edit Server Info', this.w / 2, 17, '#ffffff'); if (!this.direct) drawText(ctx, 'Server Name', this.w / 2 - 100, 63, '#a0a0a0'); drawText(ctx, 'Server Address', this.w / 2 - 100, this.direct ? 63 : 104, '#a0a0a0'); super.draw(ctx, mx, my); }
  key(e) { if (e.key === 'Enter') { this.buttons[0].onClick(); return true; } if (e.key === 'Escape') { this.gui.open(this.parent); return true; } return super.key(e); }
}
class HostServer extends Screen {
  constructor(parent) { super(); this.parent = parent; this.error = ''; }
  layout() {
    const x = this.w / 2 - 100;
    this.fName = new TextField(x, 72, 200, 20, this.name, 28); this.fName.focused = true; this.fields.push(this.fName);
    this.buttons.push(new Button(0, x, this.h / 4 + 96, 98, 20, 'Create', () => this.create()),
      new Button(1, x + 102, this.h / 4 + 96, 98, 20, 'Cancel', () => this.gui.open(this.parent)));
  }
  async create() {
    if (this.creating) return; this.creating = true; this.error = '';
    try {
      const r = await fetch('/api/servers', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: this.fName.value }) });
      const data = await r.json(); if (!r.ok) throw new Error(data.error || 'Could not create server');
      const network = await net(); let resolved = false;
      for (let attempt = 0; attempt < 6; attempt++) {
        try { await network.status(data.server); resolved = true; break; }
        catch { await new Promise(resolve => setTimeout(resolve, 250)); }
      }
      if (!resolved) throw new Error('Server was created, but its address is not resolving yet. Try again shortly.');
      const list = servers(); list.push({ name: data.name, ip: data.server }); saveServers(list);
      this.gui.open(new Connecting(this.parent, data.server));
    } catch (e) { this.error = e.message || 'Could not create server'; }
    finally { this.creating = false; }
  }
  draw(ctx, mx, my) {
    drawTextCentered(ctx, 'Host Server', this.w / 2, 20, '#ffffff');
    drawText(ctx, 'Server Name', this.w / 2 - 100, 59, '#a0a0a0');
    if (this.error) drawTextCentered(ctx, this.error, this.w / 2, 112, '#ff5555');
    super.draw(ctx, mx, my);
  }
  key(e) { if (e.key === 'Enter') { this.create(); return true; } if (e.key === 'Escape') { this.gui.open(this.parent); return true; } return super.key(e); }
}
// Network layer placeholder: the protocol module would plug in here (see js/network/client.js)
class Connecting extends Screen {
  constructor(parent, ip) { super(); this.parent = parent; this.ip = ip; this.t = performance.now(); }
  init(gui) { super.init(gui); if (this.started) return; this.started = true; net().then(m => m.connect(this.ip, gui.game)).then(null, err => this.err = err.message); }
  layout() { this.buttons.push(new Button(0, this.w / 2 - 100, this.h / 4 + 120 + 12, 200, 20, () => this.err ? (this.ip.startsWith('host-') && this.err === 'Unknown host' ? 'Refresh & retry' : 'Back to title screen') : 'Cancel', () => {
    if (!this.err) { net().then(m => m.cancelConnect()); this.gui.open(this.parent); return; }
    if (this.ip.startsWith('host-') && this.err === 'Unknown host') { location.reload(); return; }
    this.gui.open(this.parent);
  })); }
  drawBackground(ctx) { drawDirtBg(ctx, this.w, this.h); }
  draw(ctx, mx, my) { if (this.err) { drawTextCentered(ctx, 'Failed to connect to the server', this.w / 2, this.h / 2 - 50, '#ffffff'); const message = this.ip.startsWith('host-') && this.err === 'Unknown host' ? 'Refresh the game to load this new server, then join again.' : this.err; drawTextCentered(ctx, message, this.w / 2, this.h / 2 - 10, '#a0a0a0'); } else { drawTextCentered(ctx, 'Connecting to the server...', this.w / 2, this.h / 2 - 50, '#ffffff'); } super.draw(ctx, mx, my); }
}

export class Disconnected extends Screen {
  constructor(reason) { super(); this.reason = reason || 'End of stream'; }
  layout() { this.buttons.push(new Button(0, this.w / 2 - 100, this.h / 4 + 120 + 12, 200, 20, 'Back to title screen', () => this.gui.open(new MainMenu()))); }
  drawBackground(ctx) { drawDirtBg(ctx, this.w, this.h); }
  draw(ctx, mx, my) { drawTextCentered(ctx, 'Connection lost', this.w / 2, this.h / 2 - 50, '#ffffff'); drawTextCentered(ctx, this.reason, this.w / 2, this.h / 2 - 10, '#a0a0a0'); super.draw(ctx, mx, my); }
}

// ---------------- texture packs ----------------
class TexturePacks extends ListScreen {
  constructor(parent) { super(parent); this.list = [{ name: 'Default', d1: 'The default look of Minecraft' }, { name: 'Classic Fast', d1: 'Opaque leaves, fast graphics feel' }]; }
  layout() { const g = this.gui.game; this.sel = Math.max(0, this.list.findIndex(p => p.name === g.settings.texturePack));
    this.buttons.push(new Button(5, this.w / 2 - 154, this.h - 48, 150, 20, 'Open resource pack folder', () => {}), new Button(6, this.w / 2 + 4, this.h - 48, 150, 20, 'Done', () => { const p = this.list[this.sel]; g.settings.texturePack = p.name; if (p.name === 'Classic Fast') g.settings.fancy = false; g.saveSettings(); this.gui.open(this.parent); }));
    this.buttons[0].enabled = false; }
  draw(ctx, mx, my) { this.drawList(ctx, (ctx, p, x, y) => { ctx.fillStyle = '#6a8a3a'; ctx.fillRect(x, y, 32, 32); ctx.fillStyle = '#866043'; ctx.fillRect(x, y + 10, 32, 22); drawText(ctx, p.name, x + 34, y + 2, '#ffffff'); drawText(ctx, p.d1, x + 34, y + 12, '#808080'); });
    drawTextCentered(ctx, 'Select Resource Packs', this.w / 2, 16, '#ffffff'); drawTextCentered(ctx, '(Place resource pack files here)', this.w / 2 - 77, this.h - 26, '#808080'); super.draw(ctx, mx, my); }
}
class Language extends ListScreen {
  constructor(parent) { super(parent); this.list = ['English (US)', 'English (UK)', 'Deutsch', 'Español', 'Français', 'Русский', 'Svenska']; this.slotH = 18; }
  layout() { this.sel = Math.max(0, this.list.indexOf(this.gui.game.settings.lang)); this.buttons.push(new Button(0, this.w / 2 - 75, this.h - 38, 150, 20, 'Done', () => { this.gui.game.settings.lang = this.list[this.sel]; this.gui.game.saveSettings(); this.gui.open(this.parent); })); }
  draw(ctx, mx, my) { this.drawList(ctx, (ctx, l, x, y) => drawTextCentered(ctx, l, this.w / 2, y + 3, '#ffffff')); drawTextCentered(ctx, 'Language', this.w / 2, 16, '#ffffff'); drawTextCentered(ctx, '(Translations may not be 100% accurate)', this.w / 2, this.h - 56, '#808080'); super.draw(ctx, mx, my); }
}

// ---------------- options (1.7 layout) ----------------
const DIFF = ['Peaceful', 'Easy', 'Normal', 'Hard'];
const esc = (s, e) => { if (e.key === 'Escape') { s.gui.open(s.parent); return true; } };
const doneBtn = s => new Button(200, s.w / 2 - 100, s.h / 6 + 168, 200, 20, 'Done', () => s.gui.open(s.parent));
export class Options extends Screen {
  constructor(parent) { super(); this.parent = parent; }
  layout() {
    const g = this.gui.game, s = g.settings, w = this.w, h = this.h; const x0 = w / 2 - 155, x1 = w / 2 + 5; const ingame = !!g.world;
    this.buttons.push(new Slider(0, x0, h / 6 - 12, 150, 20, () => s.fov, v => { s.fov = v; g.saveSettings(); }, v => 'FOV: ' + (v === 0 ? 'Normal' : v === 1 ? 'Quake Pro' : Math.round(70 + v * 40))));
    const diff = new Button(0, x1, h / 6 - 12, 150, 20, () => 'Difficulty: ' + (g.info && g.info.hardcore ? 'Hard' : DIFF[s.difficulty]), () => { s.difficulty = (s.difficulty + 1) % 4; g.saveSettings(); }); if (g.info && g.info.hardcore && ingame) diff.enabled = false; this.buttons.push(diff);
    const rows = [
      ['Skin Customization...', () => this.gui.open(new SkinScreen(this)), 'Super Secret Settings...', () => { s.secret = (s.secret + 1) % SECRET.length; g.saveSettings(); }],
      ['Music & Sounds...', () => this.gui.open(new SoundSettings(this)), 'Broadcast Settings...', null],
      ['Video Settings...', () => this.gui.open(new VideoSettings(this)), 'Controls...', () => this.gui.open(new Controls(this))],
      ['Language...', () => this.gui.open(new Language(this)), 'Chat Settings...', () => this.gui.open(new ChatSettings(this))],
      ['Resource Packs...', () => this.gui.open(new TexturePacks(this)), 'Snooper Settings...', null],
    ];
    rows.forEach((r, i) => { const y = h / 6 + 48 - 6 + i * 24 - 24;
      for (const [x, l, f] of [[x0, r[0], r[1]], [x1, r[2], r[3]]]) { const b = new Button(0, x, y, 150, 20, l, f || (() => {})); if (!f) b.enabled = false; this.buttons.push(b); } });
    this.buttons.push(doneBtn(this));
  }
  draw(ctx, mx, my) { drawTextCentered(ctx, 'Options', this.w / 2, 15, '#ffffff'); super.draw(ctx, mx, my); }
  key(e) { return esc(this, e); }
}
class SoundSettings extends Screen {
  constructor(parent) { super(); this.parent = parent; }
  layout() { const g = this.gui.game, s = g.settings;
    this.buttons.push(new Slider(0, this.w / 2 - 155, this.h / 6 - 12, 310, 20, () => s.sound, v => { s.sound = v; g.saveSettings(); }, v => 'Master Volume: ' + (v === 0 ? 'OFF' : Math.round(v * 100) + '%')),
      new Slider(0, this.w / 2 - 155, this.h / 6 + 12, 150, 20, () => s.music, v => { s.music = v; g.saveSettings(); }, v => 'Music: ' + (v === 0 ? 'OFF' : Math.round(v * 100) + '%')),
      new Slider(0, this.w / 2 + 5, this.h / 6 + 12, 150, 20, () => s.records, v => { s.records = v; g.saveSettings(); }, v => 'Jukebox/Noteblocks: ' + (v === 0 ? 'OFF' : Math.round(v * 100) + '%')), doneBtn(this)); }
  draw(ctx, mx, my) { drawTextCentered(ctx, 'Music & Sound Options', this.w / 2, 15, '#ffffff'); super.draw(ctx, mx, my); }
  key(e) { return esc(this, e); }
}
class ChatSettings extends Screen {
  constructor(parent) { super(); this.parent = parent; }
  layout() { const g = this.gui.game, s = g.settings, x0 = this.w / 2 - 155, y = this.h / 6;
    this.buttons.push(new Button(0, x0, y, 150, 20, () => 'Chat: ' + ['Shown', 'Commands Only', 'Hidden'][s.chat], () => { s.chat = (s.chat + 1) % 3; g.saveSettings(); }),
      new Slider(0, x0 + 160, y, 150, 20, () => s.chatOpacity, v => { s.chatOpacity = v; g.saveSettings(); }, v => 'Opacity: ' + Math.round(10 + v * 90) + '%'), doneBtn(this)); }
  draw(ctx, mx, my) { drawTextCentered(ctx, 'Chat Settings', this.w / 2, 20, '#ffffff'); super.draw(ctx, mx, my); }
  key(e) { return esc(this, e); }
}
class VideoSettings extends Screen {
  constructor(parent) { super(); this.parent = parent; }
  layout() {
    const g = this.gui.game, s = g.settings, w = this.w, h = this.h; const set = (k, v) => { s[k] = v; g.saveSettings(); };
    const fs = () => !!document.fullscreenElement;
    const items = [
      [() => 'Graphics: ' + (s.fancy ? 'Fancy' : 'Fast'), () => set('fancy', !s.fancy)],
      ['slider', () => (s.rdChunks - 2) / 14, v => set('rdChunks', 2 + Math.round(v * 14)), () => 'Render Distance: ' + s.rdChunks + ' chunks'],
      [() => 'Smooth Lighting: ' + (s.smooth ? 'Maximum' : 'OFF'), () => set('smooth', !s.smooth)],
      [() => 'GUI Scale: ' + ['Auto', 'Small', 'Normal', 'Large'][s.guiScale], () => set('guiScale', (s.guiScale + 1) % 4)],
      ['slider', () => s.brightness, v => set('brightness', v), () => 'Brightness: ' + (s.brightness === 0 ? 'Moody' : s.brightness === 1 ? 'Bright' : '+' + Math.round(s.brightness * 100) + '%')],
      [() => 'View Bobbing: ' + (s.bobbing ? 'ON' : 'OFF'), () => set('bobbing', !s.bobbing)],
      [() => '3D Anaglyph: ' + (s.anaglyph ? 'ON' : 'OFF'), () => { set('anaglyph', !s.anaglyph); document.body.classList.toggle('anaglyph', s.anaglyph); }],
      [() => 'Clouds: ' + (s.clouds ? 'ON' : 'OFF'), () => set('clouds', !s.clouds)],
      [() => 'Fullscreen: ' + (fs() ? 'ON' : 'OFF'), () => { if (fs()) document.exitFullscreen?.(); else document.documentElement.requestFullscreen?.().catch(() => {}); }],
    ];
    items.forEach((it, i) => { const x = w / 2 - 155 + (i % 2) * 160, y = h / 6 + 24 * (i >> 1);
      if (it[0] === 'slider') this.buttons.push(new Slider(0, x, y, 150, 20, it[1], it[2], it[3]));
      else this.buttons.push(new Button(0, x, y, 150, 20, it[0], it[1])); });
    this.buttons.push(doneBtn(this));
  }
  draw(ctx, mx, my) { drawTextCentered(ctx, 'Video Settings', this.w / 2, 15, '#ffffff'); super.draw(ctx, mx, my); }
  key(e) { return esc(this, e); }
}
// choose the player skin: import a Minecraft account's skin by name, upload a skin PNG, or go back to Steve
class SkinScreen extends Screen {
  constructor(parent) { super(); this.parent = parent; this.msg = ''; this.msgColor = '#a0a0a0'; this.name = ''; }
  layout() { const w = this.w, x = w / 2 - 30, y = this.h / 6;
    this.f = new TextField(x, y + 12, 130, 20, this.name, 16); this.f.focused = true; this.fields.push(this.f);
    this.buttons.push(new Button(0, x + 134, y + 12, 56, 20, 'Import', () => this.importName()),
      new Button(1, x, y + 48, 190, 20, 'Upload Skin File...', () => this.pickFile()),
      new Button(2, x, y + 72, 190, 20, 'Reset to Steve', () => { Skins.set(null); this.say('Skin reset to Steve'); }),
      new Button(3, w / 2 - 100, this.h / 6 + 168, 200, 20, 'Done', () => this.gui.open(this.parent))); }
  say(m, err) { this.msg = m; this.msgColor = err ? '#ff5555' : '#a0a0a0'; }
  async importName() { const n = this.f.value.trim(); this.name = n; if (!n) return; this.say('Downloading skin...');
    try { Skins.set(await Skins.fromUsername(n), n.toLowerCase() === 'deadmau5'); this.say('Now wearing ' + n + "'s skin"); } catch (e) { this.say(e.message || 'Could not load that skin', true); } }
  pickFile() { const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/png';
    inp.onchange = async () => { const f = inp.files && inp.files[0]; if (!f) return; try { Skins.set(await Skins.fromFile(f)); this.say('Skin changed'); } catch (e) { this.say(e.message || 'Could not load that skin', true); } };
    inp.click(); }
  draw(ctx, mx, my) { drawTextCentered(ctx, 'Skin', this.w / 2, 20, '#ffffff');
    const y = this.h / 6; drawText(ctx, 'Minecraft Username', this.w / 2 - 30, y, '#a0a0a0');
    const bx = this.w / 2 - 100, by = y - 4; ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(bx, by, 60, 104);
    drawPlayerPreview(ctx, this.gui.game, bx, by, 60, 104, mx, my, this.gui.scale);
    if (this.msg) drawTextCentered(ctx, this.msg, this.w / 2, y + 120, this.msgColor);
    super.draw(ctx, mx, my); }
  key(e) { if (e.key === 'Enter') { this.importName(); return true; } if (e.key === 'Escape') { this.gui.open(this.parent); return true; } return super.key(e); }
}
// click a binding, then press a key or mouse button (Escape cancels). Clashing bindings are shown in red.
class Controls extends Screen {
  constructor(parent) { super(); this.parent = parent; this.wait = null; }
  layout() { const w = this.w, g = this.gui.game, s = g.settings;
    this.buttons.push(new Button(0, w / 2 - 155, this.h / 6 - 6, 150, 20, () => 'Invert Mouse: ' + (s.invert ? 'ON' : 'OFF'), () => { s.invert = !s.invert; g.saveSettings(); }),
      new Slider(0, w / 2 + 5, this.h / 6 - 6, 150, 20, () => s.sensitivity, v => { s.sensitivity = v; g.saveSettings(); }, v => 'Sensitivity: ' + (v === 0 ? '*yawn*' : v === 1 ? 'HYPERSPEED!!!' : Math.round(v * 200) + '%')));
    Keys.BINDS.forEach(([a, n], i) => { const x = w / 2 - 155 + (i % 2) * 160, y = this.h / 6 + 20 + 24 * (i >> 1);
      const b = new Button(0, x + 70, y, 70, 20, () => this.wait === a ? '> ??? <' : Keys.keyName(Keys.bound(a)), () => { this.wait = a; this.armed = false; }); b.name = n; b.action = a; this.buttons.push(b); });
    this.buttons.push(new Button(0, w / 2 - 100, this.h / 6 + 168, 98, 20, 'Reset Keys', () => { this.gui.game.settings.keys = {}; this.gui.game.saveSettings(); this.wait = null; }),
      new Button(0, w / 2 + 2, this.h / 6 + 168, 98, 20, 'Done', () => this.gui.open(this.parent))); }
  set(code) { const g = this.gui.game; g.settings.keys = { ...g.settings.keys, [this.wait]: code }; g.saveSettings(); this.wait = null; }
  draw(ctx, mx, my) { drawTextCentered(ctx, 'Controls', this.w / 2, 20, '#ffffff');
    const codes = Keys.BINDS.map(([a]) => Keys.bound(a));
    for (const b of this.buttons) if (b.name) { drawText(ctx, b.name, b.x - 68, b.y + 6, '#ffffff'); b.clash = codes.filter(c => c === Keys.bound(b.action)).length > 1; }
    super.draw(ctx, mx, my);
    for (const b of this.buttons) if (b.clash && this.wait !== b.action) { ctx.fillStyle = 'rgba(255,40,40,0.35)'; ctx.fillRect(b.x + 2, b.y + 2, b.w - 4, b.h - 4); } }
  mouseDown(mx, my, btn) { if (this.wait) { if (this.armed || btn !== 0) { this.set('Mouse' + btn); return true; } this.armed = true; } return super.mouseDown(mx, my, btn); }
  mouseUp() { super.mouseUp(); if (this.wait) this.armed = true; }
  key(e) { if (this.wait) { if (e.code === 'Escape') this.wait = null; else this.set(e.code); return true; }
    if (e.key === 'Escape') { this.gui.open(this.parent); return true; } }
}

// ---------------- in-game ----------------
export class Pause extends Screen {
  layout() {
    const g = this.gui.game, w = this.w, y = this.h / 4 + 8;
    this.buttons.push(new Button(4, w / 2 - 100, y + 24 - 16, 200, 20, 'Back to Game', () => this.gui.open(null)));
    this.buttons.push(new Button(5, w / 2 - 100, y + 48 - 16, 98, 20, 'Achievements', () => this.gui.open(new AchievementsScreen(this))), new Button(6, w / 2 + 2, y + 48 - 16, 98, 20, 'Statistics', () => this.gui.open(new Stats(this))));
    this.buttons.push(new Button(0, w / 2 - 100, y + 96 - 16, 98, 20, 'Options...', () => this.gui.open(new Options(this))));
    const lan = new Button(7, w / 2 + 2, y + 96 - 16, 98, 20, 'Open to LAN', () => {}); lan.enabled = false; this.buttons.push(lan);
    this.buttons.push(new Button(1, w / 2 - 100, y + 120 - 16, 200, 20, g.net ? 'Disconnect' : 'Save and Quit to Title', () => g.quitToTitle()));
  }
  draw(ctx, mx, my) { drawTextCentered(ctx, 'Game menu', this.w / 2, 40, '#ffffff'); super.draw(ctx, mx, my); if (this.saving) drawText(ctx, 'Saving level..', 8, this.h - 16, '#ffffff'); }
  key(e) { if (e.key === 'Escape') { this.gui.open(null); return true; } }
}
class AchievementsScreen extends Screen {
  constructor(parent) { super(); this.parent = parent; this.ox = 0; this.oy = 0; }
  layout() { this.buttons.push(new Button(1, this.w / 2 + 24, this.h / 2 + 74, 80, 20, 'Done', () => this.gui.open(this.parent))); }
  draw(ctx, mx, my) { this.gui.game.achievements.drawTree(ctx, this.w, this.h, mx, my, this); super.draw(ctx, mx, my); }
  mouseDown(mx, my, b) { if (super.mouseDown(mx, my, b)) return true; this.drag = [mx, my, this.ox, this.oy]; }
  mouseMove(mx, my) { if (this.drag) { this.ox = this.drag[2] - (mx - this.drag[0]); this.oy = this.drag[3] - (my - this.drag[1]); } }
  mouseUp() { this.drag = null; }
  key(e) { if (e.key === 'Escape' || Keys.is('inventory', e.code)) { this.gui.open(this.parent); return true; } }
}
class Stats extends Screen {
  constructor(parent) { super(); this.parent = parent; }
  layout() { this.buttons.push(new Button(0, this.w / 2 + 4, this.h - 28, 150, 20, 'Done', () => this.gui.open(this.parent)), new Button(1, this.w / 2 - 154, this.h - 52, 100, 20, 'General', () => {}), new Button(2, this.w / 2 - 50, this.h - 52, 100, 20, 'Blocks', () => {}), new Button(3, this.w / 2 + 54, this.h - 52, 100, 20, 'Items', () => {})); }
  draw(ctx, mx, my) { const st = this.gui.game.achievements.stats; drawTextCentered(ctx, 'Statistics', this.w / 2, 20, '#ffffff');
    const rows = [['Times played', st.played || 1], ['Blocks mined', st.mined || 0], ['Blocks placed', st.placed || 0], ['Items crafted', st.crafted || 0], ['Mobs killed', st.kills || 0], ['Deaths', st.deaths || 0], ['Time played', Math.floor((st.ticks || 0) / 1200) + ' m']];
    rows.forEach(([a, b], i) => { drawText(ctx, a, this.w / 2 - 140, 40 + i * 12, i % 2 ? '#909090' : '#ffffff'); drawTextRight(ctx, String(b), this.w / 2 + 140, 40 + i * 12, i % 2 ? '#909090' : '#ffffff'); });
    super.draw(ctx, mx, my); }
  key(e) { if (e.key === 'Escape') { this.gui.open(this.parent); return true; } }
}
export class Death extends Screen {
  layout() { const g = this.gui.game; const hc = g.info && g.info.hardcore;
    this.buttons.push(new Button(1, this.w / 2 - 100, this.h / 4 + 72, 200, 20, hc ? 'Delete world' : 'Respawn', () => { if (hc) { const id = g.info.id; g.quitToTitle().then(() => Saves.remove(id)); } else g.respawn(); }), new Button(2, this.w / 2 - 100, this.h / 4 + 96, 200, 20, 'Title menu', () => g.quitToTitle()));
    this.buttons.forEach(b => b.enabled = false); setTimeout(() => this.buttons.forEach(b => b.enabled = true), 1000); g.achievements.stats.deaths = (g.achievements.stats.deaths || 0) + 1; }
  drawBackground(ctx) { const gr = ctx.createLinearGradient(0, 0, 0, this.h); gr.addColorStop(0, 'rgba(80,0,0,0.38)'); gr.addColorStop(1, 'rgba(128,48,48,0.62)'); ctx.fillStyle = gr; ctx.fillRect(0, 0, this.w, this.h); }
  draw(ctx, mx, my) { ctx.save(); ctx.scale(2, 2); drawTextCentered(ctx, this.gui.game.info?.hardcore ? 'Game over!' : 'You died!', this.w / 4, 30, '#ffffff'); ctx.restore(); drawTextCentered(ctx, 'Score: \u00a7e' .replace('\u00a7e', '') + (this.gui.game.player.xpTotal), this.w / 2, 100, '#ffffff'); super.draw(ctx, mx, my); }
  key() { return true; }
}
export class Chat extends Screen {
  constructor(init) { super(); this.init0 = init; this.pausesGame = false; this.isChat = true; }
  layout() { this.f = new TextField(2, this.h - 12, this.w - 4, 10, this.init0 || '', 100); this.f.focused = true; this.fields.push(this.f); }
  drawBackground() {}
  draw(ctx) { ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(2, this.h - 14, this.w - 4, 12); drawText(ctx, '> ' + this.f.value + ((performance.now() / 300 | 0) % 2 ? '_' : ''), 4, this.h - 12, '#e0e0e0'); }
  key(e) {
    if (e.key === 'Enter') { const m = this.f.value.trim(); if (m) this.gui.game.command(m); this.gui.open(null); return true; }
    if (e.key === 'Escape') { this.gui.open(null); return true; }
    const sent = this.gui.game.sent || [];
    if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && sent.length) { this.hi = Math.max(0, Math.min(sent.length, (this.hi ?? sent.length) + (e.key === 'ArrowUp' ? -1 : 1))); this.f.value = sent[this.hi] ?? ''; return true; }
    return this.f.key(e) || true;
  }
}
// sign text editor: 4 lines of up to 15 characters, like the classic GuiEditSign
export class SignEdit extends Screen {
  constructor(tile, onDone) { super(); this.tile = tile; this.onDone = onDone; this.line = 0; this.t = 0; this.pausesGame = false; }
  layout() { this.buttons.push(new Button(0, this.w / 2 - 100, this.h / 4 + 120, 200, 20, 'Done', () => this.close())); }
  close() { if (this.onDone) this.onDone(); this.onDone = null; this.gui.open(null); }
  onClose() { if (this.onDone) this.onDone(); this.onDone = null; }
  tick() { this.t++; }
  draw(ctx, mx, my) {
    drawTextCentered(ctx, 'Edit sign message', this.w / 2, 40, '#ffffff');
    const bw = 96, bh = 48, x = Math.floor(this.w / 2 - bw / 2), y = 64;
    ctx.fillStyle = '#5c4426'; ctx.fillRect(this.w / 2 - 4, y + bh, 8, 34); ctx.fillStyle = '#3d2d18'; ctx.fillRect(this.w / 2 + 2, y + bh, 2, 34);
    ctx.fillStyle = '#3d2d18'; ctx.fillRect(x - 2, y - 2, bw + 4, bh + 4); ctx.fillStyle = '#9c7f4e'; ctx.fillRect(x, y, bw, bh);
    ctx.fillStyle = '#8a6e42'; for (let i = 0; i < 4; i++) ctx.fillRect(x, y + 6 + i * 12, bw, 1);
    const blink = (this.t >> 3) % 2 === 0;
    this.tile.text.forEach((s, i) => { const l = i === this.line && blink ? '> ' + s + ' <' : s; drawTextCentered(ctx, l, this.w / 2, y + 5 + i * 10, '#000000', false); });
    super.draw(ctx, mx, my);
  }
  key(e) {
    const tx = this.tile.text;
    if (e.key === 'Escape') { this.close(); return true; }
    if (e.key === 'ArrowUp') { this.line = (this.line + 3) % 4; return true; }
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === 'Tab') { this.line = (this.line + 1) % 4; return true; }
    if (e.key === 'Backspace') { tx[this.line] = tx[this.line].slice(0, -1); return true; }
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && tx[this.line].length < 15) { tx[this.line] += e.key; return true; }
    return true;
  }
}
export class Sleep extends Screen {
  constructor() { super(); this.t = 0; this.pausesGame = false; }
  layout() { this.buttons.push(new Button(1, this.w / 2 - 100, this.h - 40, 200, 20, 'Leave Bed', () => this.gui.open(null))); }
  drawBackground(ctx) { ctx.fillStyle = 'rgba(16,16,32,' + Math.min(0.95, this.t / 100) + ')'; ctx.fillRect(0, 0, this.w, this.h); }
  tick() { this.t++; const g = this.gui.game; if (this.t >= 100 * 3) { g.time = Math.ceil(g.time / 24000) * 24000; g.addChat('Respawn point set'); this.gui.open(null); } }
  key(e) { if (e.key === 'Escape') { this.gui.open(null); return true; } return true; }
}
