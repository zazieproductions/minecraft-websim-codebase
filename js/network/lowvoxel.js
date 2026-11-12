// LowVoxel: a Hypixel-style minigame network. The lobby world is built identically on every client
// (floating island hub, Spleef arena, Parkour course, PvP pit), and this module runs the client side
// of the minigames: scoreboard sidebar, titles, NPCs, holograms and leaderboards.
import * as THREE from 'three';
import { idx } from '../world/chunk.js';
import { buildModel } from '../entity/models.js';
import { pose, lightCurve } from '../engine/playermodel.js';
import { Skins } from '../engine/skin.js';
import { rayBox } from '../engine/physics.js';
import { Screen, Button } from '../gui/gui.js';
import { drawText, drawTextCentered, textWidth, CODES, stripCodes } from '../gui/font.js';
import { Sound } from '../engine/audio.js';

// geometry shared with server.js (LV)
export const Y = 64;
export const SPLEEF = { x0: -9, x1: 9, z0: -59, z1: -41, floor: Y + 6, cx: 0, cz: -50 };
export const PVP = { x0: -50, x1: -32, z0: -9, z1: 9, y0: Y - 3, y1: Y + 0.5 };
export const SPAWN = [0.5, Y + 1, 8.5], SPECTATE = [0.5, Y + 1, -35.5], PVP_IN = [-40.5, Y - 2, 0.5], PARKOUR_IN = [27.5, Y + 1, 0.5];
const inBox = (b, x, y, z) => x >= b.x0 && x <= b.x1 + 1 && z >= b.z0 && z <= b.z1 + 1 && y >= b.y0 && y <= b.y1;
const COMPASS = 345, SWORD = 267, SHOVEL = 277;
const STONE = 1, GRASS = 2, DIRT = 3, COBBLE = 4, WATER = 9, LOG = 17, LEAVES = 18, GLASS = 20, WOOL = 35, DANDELION = 37, ROSE = 38,
  GOLD = 41, IRON = 42, DIAMOND = 57, SNOW = 80, GLOW = 89, SGLASS = 95, SBRICK = 98, CLAY = 159;

export function buildLobby() {
  const map = new Map();
  const set = (x, y, z, id, meta = 0) => { if (y < 1 || y > 127) return; map.set(x + ',' + y + ',' + z, [x, y, z, id, meta]); };
  const get = (x, y, z) => { const e = map.get(x + ',' + y + ',' + z); return e ? e[3] : 0; };
  const box = (x0, y0, z0, x1, y1, z1, id, meta = 0) => { for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) set(x, y, z, id, meta); };
  const walls = (x0, y0, z0, x1, y1, z1, id, meta = 0) => { for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) if (x === x0 || x === x1 || z === z0 || z === z1) set(x, y, z, id, meta); };
  let s = 4242; const rnd = () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;

  // floating island hub
  const R = 22;
  for (let x = -R; x <= R; x++) for (let z = -R; z <= R; z++) {
    const d = Math.hypot(x, z); if (d > R + 0.4) continue;
    const depth = 2 + Math.floor((R - d) * 0.75 + rnd() * 2.5);
    for (let y = Y - depth; y < Y; y++) set(x, y, z, y >= Y - 2 ? DIRT : STONE);
    set(x, Y, z, d < 10.5 || Math.abs(x) <= 1 || Math.abs(z) <= 1 ? SBRICK : d < 11.5 ? CLAY : GRASS, d >= 10.5 && d < 11.5 ? 9 : 0);
  }
  // fountain
  walls(-3, Y + 1, -3, 3, Y + 1, 3, SBRICK); box(-2, Y + 1, -2, 2, Y + 1, 2, WATER); box(0, Y + 1, 0, 0, Y + 3, 0, SBRICK); set(0, Y + 4, 0, GLOW);
  // lamps and trees
  const lamp = (x, z, y = Y) => { box(x, y + 1, z, x, y + 3, z, LOG); set(x, y + 4, z, GLOW); };
  for (const [x, z] of [[-7, -7], [7, -7], [-7, 7], [7, 7], [-16, 4], [16, 4], [-16, -4], [16, -4], [4, 16], [-4, 16], [4, -16], [-4, -16]]) lamp(x, z);
  const tree = (x, z) => { for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) for (let y = Y + 4; y <= Y + 6; y++) { if (Math.abs(dx) + Math.abs(dz) + (y - Y - 4) * 1.5 > 3.5) continue; set(x + dx, y, z + dz, LEAVES); } set(x, Y + 7, z, LEAVES); box(x, Y + 1, z, x, Y + 5, z, LOG); };
  for (const [x, z] of [[-13, -13], [13, -13], [-13, 13], [13, 13], [-18, 9], [18, -9], [9, 18], [-9, -18]]) tree(x, z);
  for (let i = 0; i < 70; i++) { const x = Math.floor(rnd() * 41) - 20, z = Math.floor(rnd() * 41) - 20; if (get(x, Y, z) === GRASS && !get(x, Y + 1, z)) set(x, Y + 1, z, rnd() < 0.5 ? ROSE : DANDELION); }
  // leaderboard pillars
  for (const x of [-9, 9]) { box(x, Y + 1, -9, x, Y + 1, -9, SBRICK); set(x, Y + 2, -9, GLOW); }

  // bridges
  box(22, Y, -1, 31, Y, 1, SBRICK); box(-31, Y, -1, -22, Y, 1, SBRICK); box(-1, Y, -33, 1, Y, -22, SBRICK);
  for (const x of [25, 29, -25, -29]) { set(x, Y + 1, 2, LOG); set(x, Y + 2, 2, GLOW); set(x, Y + 1, -2, LOG); set(x, Y + 2, -2, GLOW); box(x, Y, 2, x, Y, 2, SBRICK); box(x, Y, -2, x, Y, -2, SBRICK); }

  // Spleef arena (north): spectator deck, glass box, water pit, snow floor
  const A = SPLEEF;
  box(-8, Y, -37, 8, Y, -33, SBRICK); lamp(-8, -33); lamp(8, -33);
  box(A.x0 - 2, Y, A.z0 - 3, A.x1 + 2, Y, A.z1 + 3, SBRICK);
  for (let x = A.x0 - 2; x <= A.x1 + 2; x++) for (let z = A.z0 - 3; z <= A.z1 + 3; z++) { const d = 1 + Math.floor(rnd() * 3); for (let y = Y - d; y < Y; y++) set(x, y, z, STONE); }
  walls(A.x0 - 1, Y + 1, A.z0 - 1, A.x1 + 1, Y + 5, A.z1 + 1, SGLASS, 3);
  walls(A.x0 - 1, Y + 6, A.z0 - 1, A.x1 + 1, Y + 10, A.z1 + 1, GLASS);
  for (const [x, z] of [[A.x0 - 1, A.z0 - 1], [A.x1 + 1, A.z0 - 1], [A.x0 - 1, A.z1 + 1], [A.x1 + 1, A.z1 + 1]]) { box(x, Y + 1, z, x, Y + 10, z, SBRICK); set(x, Y + 11, z, GLOW); }
  box(A.x0, Y + 1, A.z0, A.x1, Y + 3, A.z1, WATER);
  box(A.x0, A.floor, A.z0, A.x1, A.floor, A.z1, SNOW);

  // PvP pit (west): sunken arena with a staircase back up to the bridge
  const P = PVP;
  box(P.x0 - 1, Y - 4, P.z0 - 1, P.x1 + 1, Y - 4, P.z1 + 1, STONE);
  for (let x = P.x0; x <= P.x1; x++) for (let z = P.z0; z <= P.z1; z++) set(x, Y - 3, z, rnd() < 0.3 ? COBBLE : SBRICK);
  walls(P.x0 - 1, Y - 3, P.z0 - 1, P.x1 + 1, Y, P.z1 + 1, SBRICK);
  walls(P.x0 - 1, Y, P.z0 - 1, P.x1 + 1, Y, P.z1 + 1, WOOL, 14);
  for (let i = P.x0 + 1; i < P.x1; i += 4) { set(i, Y - 1, P.z0 - 1, GLOW); set(i, Y - 1, P.z1 + 1, GLOW); }
  for (let i = P.z0 + 1; i < P.z1; i += 4) { set(P.x0 - 1, Y - 1, i, GLOW); if (Math.abs(i) > 2) set(P.x1 + 1, Y - 1, i, GLOW); }
  box(P.x1 - 2, Y - 2, -1, P.x1 - 2, Y - 2, 1, SBRICK); box(P.x1 - 1, Y - 2, -1, P.x1 - 1, Y - 1, 1, SBRICK); box(P.x1, Y - 2, -1, P.x1, Y, 1, SBRICK); box(P.x1 + 1, Y, -1, P.x1 + 1, Y, 1, SBRICK);

  // Parkour (east): 36 seeded jumps, iron checkpoints every 12, diamond finish
  const start = [32, Y, 0]; set(32, Y, 0, GOLD); box(32, Y - 1, 0, 32, Y - 1, 0, STONE);
  const course = [start.slice()], COLS = [1, 2, 3, 4, 5, 6, 9, 10, 11, 14];
  let [x, y, z] = start;
  for (let i = 1; i <= 36; i++) {
    let dy = rnd() < 0.3 ? 1 : rnd() < 0.25 ? -1 : 0; if (y + dy > Y + 12) dy = -1; if (y + dy < Y - 2) dy = 1;
    const max = dy > 0 ? 3.05 : dy < 0 ? 4.1 : 3.7; let dx, dz, tries = 0;
    do { dx = 2 + Math.floor(rnd() * 3); dz = Math.floor(rnd() * 5) - 2; } while ((Math.hypot(dx, dz) > max || Math.abs(z + dz) > 7) && ++tries < 50);
    if (tries >= 50) { dx = 2; dz = 0; }
    x += dx; y += dy; z += dz;
    if (i === 36) set(x, y, z, DIAMOND); else if (i % 12 === 0) set(x, y, z, IRON); else set(x, y, z, CLAY, COLS[Math.floor(rnd() * COLS.length)]);
    course.push([x, y, z]);
  }
  const end = course[course.length - 1]; box(end[0] + 1, end[1], end[2] - 1, end[0] + 3, end[1], end[2] + 1, SBRICK); lamp(end[0] + 3, end[2] + 1, end[1]); lamp(end[0] + 3, end[2] - 1, end[1]);

  const chunks = new Map();
  for (const e of map.values()) { const k = (e[0] >> 4) + ',' + (e[2] >> 4); (chunks.get(k) || chunks.set(k, []).get(k)).push(e); }
  return { chunks, spawn: SPAWN.slice(), level: Y, void: true, start, course, minY: Math.min(...course.map(c => c[1])) };
}

// void every chunk, then lay the lobby blocks in
export function patchLobby(town, c) {
  c.blocks.fill(0); c.meta.fill(0); c.tiles.clear();
  const list = town.chunks.get(c.cx + ',' + c.cz); if (!list) return;
  const x0 = c.cx * 16, z0 = c.cz * 16;
  for (const e of list) { const i = idx(e[0] - x0, e[1], e[2] - z0); c.blocks[i] = e[3]; c.meta[i] = e[4]; }
}

// formatting-code aware text for canvas sprites
function segments(s) { const out = []; let col = '#ffffff'; String(s).split('§').forEach((seg, i) => { let t = seg; if (i > 0) { const k = seg[0]; t = seg.slice(1); if (CODES[k]) col = CODES[k]; else if (k === 'r') col = '#ffffff'; } if (t) out.push([col, t]); }); return out; }
export function textSprite(lines, bg = 'rgba(0,0,0,0.25)', h = 0.28) {
  const fs = 30, lh = fs + 8, c = document.createElement('canvas'), ctx = c.getContext('2d'); ctx.font = 'bold ' + fs + 'px monospace';
  const ws = lines.map(l => ctx.measureText(stripCodes(l)).width); const W = Math.ceil(Math.max(8, ...ws)) + 20; c.width = W; c.height = lh * lines.length + 6;
  ctx.fillStyle = bg; ctx.fillRect(0, 0, c.width, c.height); ctx.font = 'bold ' + fs + 'px monospace'; ctx.textBaseline = 'middle';
  lines.forEach((l, i) => { let cx = (W - ws[i]) / 2; const cy = 3 + lh * i + lh / 2;
    for (const [col, t] of segments(l)) { ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillText(t, cx + 3, cy + 3); ctx.fillStyle = col; ctx.fillText(t, cx, cy); cx += ctx.measureText(t).width; } });
  const tex = new THREE.CanvasTexture(c); tex.magFilter = THREE.LinearFilter; tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false })); const sh = h * lines.length; sp.scale.set(sh * c.width / c.height, sh, 1); return sp;
}
export const rankTag = o => o && o.rank ? '§' + o.color + '[' + o.rank + '] ' : '§7';
const fmt = ms => { const t = Math.max(0, ms) / 1000, m = Math.floor(t / 60), sec = t - m * 60; return m + ':' + (sec < 10 ? '0' : '') + sec.toFixed(1); };

// compass game selector
class GameMenu extends Screen {
  constructor(lobby) { super(); this.lobby = lobby; this.pausesGame = false; }
  layout() {
    const L = this.lobby, cx = Math.floor(this.w / 2), y = Math.floor(this.h / 4) + 12;
    const b = (i, label, fn) => this.buttons.push(new Button(i, cx - 100, y + i * 24, 200, 20, label, () => { this.close(); fn(); }));
    b(0, '§eSpleef', () => L.joinSpleef()); b(1, '§aParkour', () => L.toParkour()); b(2, '§cPvP Arena', () => L.toPvp()); b(3, 'Lobby Spawn', () => L.toSpawn()); b(4, '§7Close', () => {});
  }
  draw(ctx, mx, my) {
    this.drawBackground(ctx); const st = this.lobby.stats, cx = this.w / 2, y = Math.floor(this.h / 4);
    drawTextCentered(ctx, '§eLowVoxel Games', cx, y - 18);
    if (st) drawTextCentered(ctx, '§7Coins: §6' + st.coins + '   §7Spleef wins: §a' + st.spleef_wins, cx, y - 4);
    super.draw(ctx, mx, my);
  }
}

const NPCS = [
  { x: 0.5, z: -9.5, yaw: Math.PI, label: ['§eSpleef', '§7Click to queue'], act: 'spleef' },
  { x: 9.5, z: 0.5, yaw: Math.PI / 2, label: ['§aParkour', '§7Click to play'], act: 'parkour' },
  { x: -8.5, z: 0.5, yaw: -Math.PI / 2, label: ['§cPvP Arena', '§7Click to fight'], act: 'pvp' },
];

export class Lobby {
  constructor(net) { this.net = net; this.g = net.g; this.town = buildLobby(); this.stats = net.welcome.stats || null; this.boards = { spleef: [], parkour: [] };
    this.sp = { phase: 'idle', queue: [], alive: [], t: 0, round: 0 }; this.title = null; this.pk = null; this.armed = false; this.inited = false; this.objs = []; this.npcs = []; this.lastCount = -1; }
  get p() { return this.g.player; }
  get now() { return Date.now() + (this.net.offset || 0); }
  get alive() { return this.sp.phase === 'playing' && this.sp.alive.includes(this.net.name); }
  get queued() { return this.sp.queue.includes(this.net.name); }
  // ---------- server messages ----------
  handle(m) {
    const g = this.g, me = this.net.myId;
    switch (m.type) {
      case 'lv_boards': this.boards = { spleef: m.spleef || [], parkour: m.parkour || [] }; this.rebuildBoards(); return true;
      case 'lv_stats': this.stats = m.stats; return true;
      case 'spleef': this.sp = m; return true;
      case 'spleef_start': { const spot = m.spots && m.spots[me]; if (!spot || !this.p) return true;
        this.pk = null; this.clearInv(); this.give(0, SHOVEL); this.p.inv.selected = 0; this.tp(spot[0], spot[1], spot[2], Math.atan2(spot[0] - SPLEEF.cx - 0.5, spot[2] - SPLEEF.cz - 0.5));
        this.showTitle('§eSPLEEF', '§7Dig the snow out from under them!'); Sound.play('orb', 0.6, 0.8); return true; }
      case 'spleef_out': if (g.world) this.chatLine('§7' + m.name + ' §cwas eliminated! §e' + m.left + ' §7left');
        if (m.id === me && g.player && !g.player.dead) { this.showTitle('§cELIMINATED', '§7Better luck next time'); this.tp(...SPECTATE, 0); this.init(); } return true;
      case 'spleef_win': if (m.name) { this.chatLine('§6' + m.name + ' §ewon Spleef! §6+100 coins'); if (m.id === me) { this.showTitle('§6VICTORY!', '§eYou won Spleef!'); Sound.play('levelup', 0.7, 1); } }
        else this.chatLine('§7Spleef ended in a draw.'); this.wasAlive = m.id === me; return true;
      case 'spleef_reset': this.resetFloor(); if (this.wasAlive || (this.p && inBox({ ...SPLEEF, y0: SPLEEF.floor - 1, y1: SPLEEF.floor + 6 }, this.p.x, this.p.y, this.p.z))) { this.tp(...SPECTATE, 0); this.init(); } this.wasAlive = false; return true;
      case 'lv_parkour': this.chatLine('§a' + m.name + ' §7finished the parkour in §e' + fmt(m.ms) + (m.best ? ' §6(personal best!)' : '')); return true;
      case 'lv_kill': this.chatLine('§c' + m.victim + ' §7was slain by §c' + m.killer); return true;
    }
    return false;
  }
  chatLine(text) { if (this.g.world) this.g.addChat(text, '#ffffff'); }
  chat(m) { if (m.me) this.chatLine('§d* ' + m.from + ' ' + m.text); else this.chatLine(rankTag(m) + m.from + (m.rank ? '§f: ' : '§7: ') + m.text); }
  tagFor(o) { return rankTag(o) + o.name; }
  // ---------- player helpers ----------
  tp(x, y, z, yaw) { const p = this.p; if (!p) return; p.x = p.px = x; p.y = p.py = y; p.z = p.pz = z; p.mx = p.my = p.mz = 0; p.fall = 0; if (yaw !== undefined) p.yaw = yaw; }
  give(slot, id) { this.p.inv.slots[slot] = { id, count: 1, dmg: 0 }; }
  clearInv() { const inv = this.p.inv; inv.slots.fill(null); for (let i = 0; i < 4; i++) inv.armor[i] = null; this.armed = false; }
  init() { if (!this.p) return; this.clearInv(); this.give(0, COMPASS); this.p.inv.selected = 0; }
  showTitle(text, sub = '') { this.title = { text, sub, t: performance.now() }; }
  joinSpleef() { if (this.alive) return; this.net.send({ type: 'lv', action: 'spleef_join' }); this.pk = null; this.tp(...SPECTATE, 0); this.chatLine('§aYou joined the Spleef queue! §7(/leave to quit)'); }
  leaveSpleef() { const was = this.alive; this.net.send({ type: 'lv', action: 'spleef_leave' }); if (was) { this.toSpawn(); } else this.chatLine('§7You left the Spleef queue.'); }
  toSpawn() { if (this.alive) this.net.send({ type: 'lv', action: 'spleef_leave' }); this.pk = null; this.tp(...SPAWN, 0); this.init(); }
  toParkour() { if (this.alive) return this.chatLine('§cYou are in a Spleef game!'); this.pk = null; this.tp(...PARKOUR_IN, -Math.PI / 2); this.init(); this.chatLine('§aStep on the §6gold block §ato start the timer!'); }
  toPvp() { if (this.alive) return this.chatLine('§cYou are in a Spleef game!'); this.pk = null; this.tp(...PVP_IN, -Math.PI / 2); }
  resetFloor() {
    const A = SPLEEF, w = this.g.world, net = this.net;
    for (let x = A.x0; x <= A.x1; x++) for (let z = A.z0; z <= A.z1; z++) { net.edits.delete(x + ',' + A.floor + ',' + z); if (w && w.isLoaded(x, z) && w.getBlock(x, A.floor, z) !== SNOW) w.setBlock(x, A.floor, z, SNOW, 0); }
  }
  canBreak(x, y, z) { const A = SPLEEF; return this.alive && y === A.floor && x >= A.x0 && x <= A.x1 && z >= A.z0 && z <= A.z1 && this.g.world.getBlock(x, y, z) === SNOW; }
  inPvp() { const p = this.p; return !!p && inBox(PVP, p.x, p.y, p.z); }
  // ---------- input ----------
  npcAtCrosshair() {
    const p = this.p; if (!p) return null; const dx = -Math.sin(p.yaw) * Math.cos(p.pitch), dy = Math.sin(p.pitch), dz = -Math.cos(p.yaw) * Math.cos(p.pitch);
    let best = null; for (const n of NPCS) { const h = rayBox(p.x, p.eyeY, p.z, dx, dy, dz, n.x - 0.35, Y + 1, n.z - 0.35, n.x + 0.35, Y + 2.9, n.z + 0.35); if (h && h.t <= 4.5 && (!best || h.t < best.t)) best = { npc: n, t: h.t }; }
    return best && best.npc;
  }
  clickNPC() { const n = this.npcAtCrosshair(); if (!n) return false; Sound.play('click'); if (n.act === 'spleef') this.joinSpleef(); else if (n.act === 'parkour') this.toParkour(); else this.toPvp(); return true; }
  useItem() { if (this.clickNPC()) return; const h = this.p.inv.held; if (h && h.id === COMPASS) this.g.gui.open(new GameMenu(this)); }
  command(m) {
    const [cmd] = m.slice(1).split(/ +/); const c = cmd.toLowerCase();
    if (c === 'lobby' || c === 'hub' || c === 'spawn' || c === 'l') this.toSpawn();
    else if (c === 'spleef' || c === 'play') this.joinSpleef();
    else if (c === 'leave') this.leaveSpleef();
    else if (c === 'parkour') this.toParkour();
    else if (c === 'pvp') this.toPvp();
    else if (c === 'me') this.net.chat(m.slice(1).split(/ +/).slice(1).join(' '), true);
    else if (c === 'stats') { const s = this.stats || {}; this.chatLine('§e--- Your stats ---'); this.chatLine('§7Rank: ' + (s.rank ? '§' + s.color + s.rank : '§7Default') + '   §7Coins: §6' + (s.coins || 0)); this.chatLine('§7Spleef: §a' + (s.spleef_wins || 0) + ' wins §7/ ' + (s.spleef_games || 0) + ' games   §7Parkour best: §a' + (s.parkour_ms ? fmt(s.parkour_ms) : '-')); }
    else if (c === 'help' || c === '?') { this.chatLine('§e/lobby §7- back to spawn   §e/spleef §7- queue for Spleef   §e/leave'); this.chatLine('§e/parkour  /pvp  /stats  /me <action>'); }
    else return false;
    return true;
  }
  // ---------- per tick ----------
  tick() {
    const p = this.p, g = this.g; if (!p || g.loadingWorld) return;
    if (!this.inited) { this.inited = true; this.init(); }
    if (p.dead) { this.pk = null; return; }
    p.food = 20; p.sat = 5; p.fall = 0; p.fireTicks = 0;
    const inv = p.inv;
    // keep the compass around (respawns hand out a fresh inventory)
    if (!this.alive && !inv.slots.some(s => s && s.id === COMPASS)) { inv.slots[0] = { id: COMPASS, count: 1, dmg: 0 }; }
    // void rescue
    if (p.y < Y - 30) { if (this.pk) { this.tp(...this.pk.cp); } else if (!this.alive) this.toSpawn(); }
    // PvP pit hands out a sword
    const pvp = this.inPvp();
    if (pvp && !this.armed) { this.armed = true; inv.slots[1] = { id: SWORD, count: 1, dmg: 0 }; inv.selected = 1; this.showTitle('§cPvP', '§7Last one standing wins nothing but glory'); }
    else if (!pvp && this.armed) { this.armed = false; for (let i = 0; i < inv.slots.length; i++) if (inv.slots[i] && inv.slots[i].id === SWORD) inv.slots[i] = null; if (p.health < 20) p.health = 20; }
    // parkour plates
    if (p.onGround) {
      const id = g.world.getBlock(Math.floor(p.x), Math.floor(p.y - 0.05), Math.floor(p.z));
      if (id === GOLD) { if (!this.pk) { this.chatLine('§aParkour started! §7Reach the §bdiamond block§7.'); Sound.play('orb', 0.5, 1.2); } this.pk = { start: performance.now(), cp: [32.5, Y + 1, 0.5], cps: 0 }; }
      else if (id === IRON && this.pk) { const k = Math.floor(p.x) + ',' + Math.floor(p.z); if (this.pk.lastCp !== k) { this.pk.lastCp = k; this.pk.cps++; this.pk.cp = [Math.floor(p.x) + 0.5, Math.floor(p.y - 0.05) + 1, Math.floor(p.z) + 0.5]; this.showTitle('', '§aCheckpoint ' + this.pk.cps + '/2'); Sound.play('orb', 0.5, 1.5); } }
      else if (id === DIAMOND && this.pk) { const ms = Math.round(performance.now() - this.pk.start); this.pk = null; this.showTitle('§bPARKOUR COMPLETE', '§e' + fmt(ms)); Sound.play('levelup', 0.7, 1); this.net.send({ type: 'lv', action: 'parkour', ms }); }
    }
    if (this.pk && p.y < this.town.minY - 3) { this.tp(...this.pk.cp); Sound.play('click'); }
    if (this.pk && Math.abs(p.z) > 20) this.pk = null; // wandered off the course
    // spleef countdown
    if (this.sp.phase === 'countdown' && this.queued) { const sec = Math.ceil((this.sp.t - this.now) / 1000); if (sec !== this.lastCount && sec <= 5 && sec > 0) { this.lastCount = sec; this.showTitle('§e' + sec, '§7Spleef is starting'); Sound.play('click'); } }
  }
  // ---------- rendering ----------
  ensureScene() {
    if (this.scene) return; const sc = this.g.renderer.scene; this.scene = sc;
    for (const n of NPCS) {
      const m = buildModel('steve'); try { Skins.apply(m.mat, null); } catch {} m.root.position.set(n.x, Y + 1, n.z); m.root.rotation.set(0, n.yaw, 0); sc.add(m.root);
      const tag = textSprite(n.label); tag.position.y = 2.35; m.root.add(tag); this.npcs.push({ n, m });
    }
    const hello = textSprite(['§bLOWVOXEL', '§7Spleef - Parkour - PvP', '§eRight-click the compass to play!'], 'rgba(0,0,0,0.3)', 0.32); hello.position.set(0.5, Y + 6.2, 0.5); sc.add(hello); this.objs.push(hello);
    const st = textSprite(['§6Parkour start', '§7Step on the gold block'], 'rgba(0,0,0,0.3)'); st.position.set(32.5, Y + 2.6, 0.5); sc.add(st); this.objs.push(st);
    const sp = textSprite(['§eSPLEEF', '§7Queue with the compass or /spleef'], 'rgba(0,0,0,0.3)'); sp.position.set(0.5, Y + 4.2, -33.5); sc.add(sp); this.objs.push(sp);
    this.rebuildBoards();
  }
  rebuildBoards() {
    if (!this.scene) return; for (const b of this.boardObjs || []) { this.scene.remove(b); b.material.map.dispose(); b.material.dispose(); }
    const list = (title, rows, f) => [title, ...[0, 1, 2, 3, 4].map(i => rows[i] ? '§e' + (i + 1) + '. §f' + rows[i].name + ' §7- §a' + f(rows[i].v) : '§8' + (i + 1) + '. ---')];
    const a = textSprite(list('§bSpleef Wins', this.boards.spleef, v => v), 'rgba(0,0,0,0.35)', 0.26), b = textSprite(list('§aFastest Parkour', this.boards.parkour, fmt), 'rgba(0,0,0,0.35)', 0.26);
    a.position.set(-8.5, Y + 3.9, -8.5); b.position.set(9.5, Y + 3.9, -8.5); this.scene.add(a); this.scene.add(b); this.boardObjs = [a, b];
  }
  render(pt, daySub) {
    this.ensureScene(); const p = this.p, w = this.g.world; if (!p || !w) return;
    for (const { n, m } of this.npcs) {
      let d = Math.atan2(n.x - p.x, n.z - p.z) - n.yaw; d = ((d % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2) - Math.PI; const near = Math.hypot(n.x - p.x, n.z - p.z) < 10;
      const pitch = near ? Math.max(-0.6, Math.min(0.6, Math.atan2(p.y + 1.6 - (Y + 2.6), Math.hypot(n.x - p.x, n.z - p.z)))) : 0;
      pose(m, { headYaw: near ? Math.max(-1, Math.min(1, d)) : 0, pitch, limb: 0, amt: 0, sneak: false, swing: 0, holding: false });
      const l = lightCurve(w, Math.floor(n.x), Y + 2, Math.floor(n.z), daySub); m.mat.color.setRGB(l, l, l);
    }
  }
  drawHUD(ctx, w, h) {
    const g = this.g, st = this.stats || {}, sp = this.sp, n = this.net;
    const state = sp.phase === 'playing' ? '§c' + sp.alive.length + ' alive' : sp.phase === 'countdown' ? '§aStarting ' + Math.max(0, Math.ceil((sp.t - this.now) / 1000)) + 's' : '§7' + sp.queue.length + '/2 queued';
    const lines = ['', '§fRank: ' + (st.rank ? '§' + st.color + st.rank : '§7Default'), '§fCoins: §6' + (st.coins || 0), '', '§fSpleef wins: §a' + (st.spleef_wins || 0), '§fBest parkour: §a' + (st.parkour_ms ? fmt(st.parkour_ms) : '-'), '',
      '§fSpleef: ' + state + (this.queued ? ' §e(in)' : this.alive ? ' §e(alive)' : ''), '§fLobby: §a' + (n.others.size + 1) + ' online', '', '§elowvoxel'];
    const title = '§eLOWVOXEL', lw = Math.max(textWidth(title), ...lines.map(l => textWidth(l))) + 8, lh = 9, bh = lines.length * lh + 12;
    const x = w - lw - 2, y = Math.floor(h / 2 - bh / 2);
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(x, y, lw, 11); ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(x, y + 11, lw, bh - 11);
    drawTextCentered(ctx, title, x + lw / 2, y + 2); lines.forEach((l, i) => drawText(ctx, l, x + 4, y + 12 + i * lh));
    if (this.pk) drawTextCentered(ctx, '§aParkour §f' + fmt(performance.now() - this.pk.start) + (this.pk.cps ? ' §7(checkpoint ' + this.pk.cps + ')' : ''), w / 2, 12);
    if (this.title) { const a = performance.now() - this.title.t; if (a > 2600) this.title = null; else {
      ctx.save(); ctx.globalAlpha = Math.min(1, a / 150, (2600 - a) / 500);
      if (this.title.text) { ctx.save(); ctx.translate(Math.floor(w / 2), Math.floor(h * 0.3)); ctx.scale(3, 3); drawTextCentered(ctx, this.title.text, 0, 0); ctx.restore(); }
      if (this.title.sub) drawTextCentered(ctx, this.title.sub, w / 2, Math.floor(h * 0.3) + 30);
      ctx.restore(); } }
  }
  dispose() {
    if (!this.scene) return;
    for (const { m } of this.npcs) { this.scene.remove(m.root); m.mat.dispose(); }
    for (const o of [...this.objs, ...(this.boardObjs || [])]) { this.scene.remove(o); o.material.map.dispose(); o.material.dispose(); }
    this.npcs = []; this.objs = []; this.boardObjs = []; this.scene = null;
  }
}
