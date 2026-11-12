// In-game HUD: crosshair, hotbar, hearts, hunger, armor, air, XP, chat, F3 debug
import { getIcon, items, itemName } from '../inventory/items.js';
import { drawText, drawTextCentered, drawTextRight, textWidth } from './font.js';
import { BIOMES } from '../world/gen.js';
import { PACK, crop } from '../engine/pack.js';
import { drawTile } from '../engine/textures.js';

function sprite(rows, pal) { const h = rows.length, w = rows[0].length; const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const x = cv.getContext('2d');
  rows.forEach((r, y) => { for (let i = 0; i < w; i++) { const c = pal[r[i]]; if (c) { x.fillStyle = c; x.fillRect(i, y, 1, 1); } } }); return cv; }
const HEART = ['.oo.oo...', 'orrorroo.', 'orwrrrro.', 'orrrrrro.', '.orrrro..', '..orro...', '...oo....', '.........', '.........'].map(r => r.slice(0, 9));
const heartRows = ['.oo.oo..', 'oRRoRRo.', 'oRwRRRo.', 'oRRRRRo.', '.oRRRo..', '..oRo...', '...o....'];
const H = {
  full: sprite(['.ooo.ooo.', 'oRRRoRRRo', 'oRwRRRRRo', 'oRRRRRRRo', '.oRRRRRo.', '..oRRRo..', '...oRo...', '....o....', '.........'], { o: '#000', R: '#d81818', w: '#ff8080' }),
  half: sprite(['.ooo.ooo.', 'oRRRoddo', 'oRwRdddo', 'oRRRdddo', '.oRRddo.', '..oRdo..', '...oRo...', '....o....', '.........'].map(r => (r + '.........').slice(0, 9)), { o: '#000', R: '#d81818', w: '#ff8080', d: '#3a0000' }),
  empty: sprite(['.ooo.ooo.', 'odddodddo', 'odddddddo', 'odddddddo', '.odddddo.', '..odddo..', '...odo...', '....o....', '.........'], { o: '#000', d: '#2a0505' }),
  emptyHurt: sprite(['.ooo.ooo.', 'odddodddo', 'odddddddo', 'odddddddo', '.odddddo.', '..odddo..', '...odo...', '....o....', '.........'], { o: '#fff', d: '#2a0505' }),
};
const FOODROWS = ['....oooo.', '...obbbbo', '..obbbwbo', '..obbbbbo', '.obbbbbo.', 'owoooooo.', 'ow.o.....', '.oo......', '.........'];
const F = { full: sprite(FOODROWS, { o: '#000', b: '#b06a28', w: '#e8b070' }), empty: sprite(FOODROWS, { o: '#000', b: '#2a1a08', w: '#2a1a08' }),
  half: sprite(FOODROWS.map(r => r.split('').map((c, i) => (i < 5 && (c === 'b' || c === 'w')) ? 'd' : c).join('')), { o: '#000', b: '#b06a28', w: '#e8b070', d: '#2a1a08' }) };
const AROWS = ['.oo.oo...', 'oaaoaao..', 'oaaaaao..', '.oaaao...', '.oaaao...', '.oaaao...', '.ooooo...', '.........', '.........'];
const A = { full: sprite(AROWS.map(r => r.slice(0, 9)), { o: '#000', a: '#d0d0d0' }), half: sprite(AROWS.map(r => r.split('').map((c, i) => i > 3 && c === 'a' ? 'd' : c).join('')), { o: '#000', a: '#d0d0d0', d: '#404040' }), empty: sprite(AROWS, { o: '#000', a: '#303030' }) };
const BUB = sprite(['..ooo....', '.obbbo...', 'obwbbbo..', 'obbbbbo..', 'obbbbbo..', '.obbbo...', '..ooo....', '.........', '.........'], { o: '#0a3a8a', b: '#6aa8ff', w: '#ffffff' });

// texture-pack HUD sprites (icons.png / gui.png, classic layout)
const ic = (x, y, w = 9, h = 9) => crop('icons', x, y, w, h);
if (PACK.icons) {
  Object.assign(H, { empty: ic(16, 0), emptyHurt: ic(25, 0), full: ic(52, 0), half: ic(61, 0) });
  Object.assign(A, { empty: ic(16, 9), half: ic(25, 9), full: ic(34, 9) });
  Object.assign(F, { empty: ic(16, 27), full: ic(52, 27), half: ic(61, 27) });
}
// mount hearts (row 9: container, full, half) and the horse jump bar (1.7 icons.png)
const MH = PACK.icons ? { empty: ic(52, 9), full: ic(88, 9), half: ic(97, 9) } : { empty: H.empty, full: H.full, half: H.half };
const JUMP_BG = PACK.icons ? ic(0, 84, 182, 5) : null, JUMP_FILL = PACK.icons ? ic(0, 89, 182, 5) : null;
const BUBBLE = PACK.icons ? ic(16, 18) : BUB;
const CROSS = PACK.icons ? ic(0, 0, 16, 16) : null, XP_BG = PACK.icons ? ic(0, 64, 182, 5) : null, XP_FILL = PACK.icons ? ic(0, 69, 182, 5) : null;
const HOTBAR = PACK.gui ? crop('gui', 0, 0, 182, 22) : null, HOTSEL = PACK.gui ? crop('gui', 0, 22, 24, 24) : null;

export function drawItem(ctx, s, x, y, showCount = true) {
  if (!s) return; ctx.drawImage(getIcon(s.id, 32, s.dmg), x, y, 16, 16);
  const it = items[s.id];
  if (it && it.durability && s.dmg > 0) { const f = 1 - s.dmg / it.durability; const c = Math.round(255 * f); ctx.fillStyle = '#000'; ctx.fillRect(x + 2, y + 13, 13, 2); ctx.fillStyle = 'rgb(' + (255 - c) + ',' + c + ',0)'; ctx.fillRect(x + 2, y + 13, Math.round(13 * f), 1); }
  if (showCount && s.count > 1) drawTextRight(ctx, String(s.count), x + 17, y + 9, '#ffffff');
}
export function drawTooltip(ctx, text, x, y) { const w = textWidth(text); ctx.fillStyle = 'rgba(16,0,16,0.94)'; ctx.fillRect(x + 9, y - 15, w + 6, 14); ctx.strokeStyle = '#2a0a5e'; ctx.lineWidth = 1; ctx.strokeRect(x + 9.5, y - 14.5, w + 5, 13); drawText(ctx, text, x + 12, y - 12, '#ffffff'); }

const NP_COLS = ['#ff5555', '#ffaa00', '#ffff55', '#55ff55', '#55ffff', '#5555ff', '#ff55ff'];
export class HUD {
  constructor(game) { this.g = game; this.lastSel = -1; this.selT = 0; this.np = null; }
  // action-bar style message above the hotbar (jukebox "Now playing" in shifting colours)
  nowPlaying(text) { this.np = { text: 'Now playing: ' + text, t: performance.now(), rainbow: true }; }
  actionBar(text) { this.np = { text, t: performance.now(), rainbow: false }; }
  draw(ctx, w, h, screenOpen) {
    const g = this.g, p = g.player; if (!p || g.loadingWorld) return;
    if (g.hideGui) return;
    // overlays
    if (p.eyeInWater === 'water') { ctx.fillStyle = 'rgba(20,40,120,0.25)'; ctx.fillRect(0, 0, w, h); }
    if (g.portalT > 0) { const k = Math.min(1, g.portalT / 80); ctx.fillStyle = 'rgba(120,30,200,' + (0.15 + k * 0.6).toFixed(3) + ')'; ctx.fillRect(0, 0, w, h); }
    if (g.settings.fancy) { const gr = ctx.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.35)'); ctx.fillStyle = gr; ctx.fillRect(0, 0, w, h); }
    if (p.fireTicks > 0 && !p.creative) {
      const size = Math.max(24, h * 0.55), flicker = Math.sin(g.tickCount * 0.19) * size * 0.025;
      ctx.save(); ctx.globalAlpha = 0.82;
      for (const side of [0, 1]) {
        ctx.save(); if (side) { ctx.translate(w, 0); ctx.scale(-1, 1); }
        drawTile(ctx, 'fire', -size * 0.42, h - size + flicker, size);
        drawTile(ctx, 'fire', size * 0.22, h - size * 0.78 - flicker, size * 0.78);
        ctx.restore();
      }
      ctx.restore();
    }
    // crosshair
    if (!screenOpen && CROSS) { ctx.save(); ctx.globalCompositeOperation = 'difference'; ctx.drawImage(CROSS, Math.floor(w / 2) - 7, Math.floor(h / 2) - 7); ctx.restore(); }
    else if (!screenOpen) { ctx.save(); ctx.globalCompositeOperation = 'difference'; ctx.fillStyle = '#e0e0e0'; ctx.fillRect(Math.floor(w / 2) - 4, Math.floor(h / 2), 9, 1); ctx.fillRect(Math.floor(w / 2), Math.floor(h / 2) - 4, 1, 4); ctx.fillRect(Math.floor(w / 2), Math.floor(h / 2) + 1, 1, 4); ctx.restore(); }
    const cx = Math.floor(w / 2); const hx = cx - 91, hy = h - 22;
    // hotbar
    if (HOTBAR) ctx.drawImage(HOTBAR, hx, hy); else {
    ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(hx, hy, 182, 22);
    ctx.fillStyle = 'rgba(140,140,140,0.75)'; ctx.fillRect(hx + 1, hy + 1, 180, 20);
    for (let i = 0; i < 9; i++) { const sx = hx + 1 + i * 20; ctx.fillStyle = 'rgba(55,55,55,0.75)'; ctx.fillRect(sx + 1, sy(hy) , 18, 18); ctx.fillStyle = 'rgba(30,30,30,0.6)'; ctx.fillRect(sx + 1, hy + 2, 18, 1); ctx.fillRect(sx + 1, hy + 2, 1, 18); }
    }
    function sy(y) { return y + 2; }
    const sel = p.inv.selected; const selX = hx - 1 + sel * 20;
    if (HOTSEL) ctx.drawImage(HOTSEL, selX, hy - 1); else {
    ctx.fillStyle = '#000'; ctx.fillRect(selX, hy - 1, 24, 24); ctx.fillStyle = '#ffffff'; ctx.fillRect(selX + 1, hy, 22, 22); ctx.fillStyle = '#9d9d9d'; ctx.fillRect(selX + 2, hy + 1, 20, 20); ctx.fillStyle = 'rgba(60,60,60,1)'; ctx.fillRect(selX + 3, hy + 2, 18, 18); }
    for (let i = 0; i < 9; i++) drawItem(ctx, p.inv.slots[i], hx + 3 + i * 20, hy + 3);
    // item name popup
    if (sel !== this.lastSel || (p.inv.held && p.inv.held.id) !== this.lastId) { this.lastSel = sel; this.lastId = p.inv.held && p.inv.held.id; this.selT = performance.now(); }
    const age = performance.now() - this.selT; if (p.inv.held && age < 2000) { ctx.globalAlpha = Math.min(1, (2000 - age) / 500); drawTextCentered(ctx, itemName(p.inv.held.id, p.inv.held.dmg), cx, h - 59 + (p.creative ? 14 : 0), '#ffffff'); ctx.globalAlpha = 1; }
    if (this.np) { const a = performance.now() - this.np.t; if (a > 3000) this.np = null; else { ctx.globalAlpha = Math.min(1, (3000 - a) / 500); drawTextCentered(ctx, this.np.text, cx, h - 72 + (p.creative ? 14 : 0), this.np.rainbow ? NP_COLS[(a / 80 | 0) % NP_COLS.length] : '#ffffff'); ctx.globalAlpha = 1; } }
    if (!p.creative) {
      // xp bar
      const xy = h - 29; const mount = p.riding && p.riding.type === 'horse' && p.riding.tame ? p.riding : null;
      if (mount) { const f = Math.min(1, mount.jumpCharge || 0); if (JUMP_BG) { ctx.drawImage(JUMP_BG, hx, xy); const fw = Math.floor(182 * f); if (fw > 0) ctx.drawImage(JUMP_FILL, 0, 0, fw, 5, hx, xy, fw, 5); } else { ctx.fillStyle = '#000'; ctx.fillRect(hx, xy, 182, 5); ctx.fillStyle = '#3a3a5a'; ctx.fillRect(hx + 1, xy + 1, 180, 3); ctx.fillStyle = '#70a0ff'; ctx.fillRect(hx + 1, xy + 1, Math.floor(180 * f), 3); } }
      else if (XP_BG) { ctx.drawImage(XP_BG, hx, xy); const fw = Math.floor(182 * p.xp); if (fw > 0) ctx.drawImage(XP_FILL, 0, 0, fw, 5, hx, xy, fw, 5); } else { ctx.fillStyle = '#000'; ctx.fillRect(hx, xy, 182, 5); ctx.fillStyle = '#2a4a0a'; ctx.fillRect(hx + 1, xy + 1, 180, 3);
      ctx.fillStyle = '#80ff20'; ctx.fillRect(hx + 1, xy + 1, Math.floor(180 * p.xp), 3); ctx.fillStyle = '#c0ff60'; ctx.fillRect(hx + 1, xy + 1, Math.floor(180 * p.xp), 1); }
      if (p.xpLevel > 0 && !mount) { const s = String(p.xpLevel); const tx = cx - textWidth(s) / 2, ty = xy - 6; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) drawText(ctx, s, tx + dx, ty + dy, '#000000', false); drawText(ctx, s, tx, ty, '#80ff20', false); }
      // hearts
      const hy2 = h - 39; const blink = p.invuln > 10 && (p.invuln / 3 | 0) % 2 === 1;
      for (let i = 0; i < 10; i++) { let yy = hy2; if (p.health <= 4) yy += (Math.random() * 2) | 0; const x = hx + i * 8;
        ctx.drawImage(blink ? H.emptyHurt : H.empty, x, yy); if (i * 2 + 1 < p.health) ctx.drawImage(H.full, x, yy); else if (i * 2 + 1 === p.health) ctx.drawImage(H.half, x, yy); }
      // armor
      const ap = p.inv.armorPoints(); if (ap > 0) for (let i = 0; i < 10; i++) { const x = hx + i * 8; ctx.drawImage(i * 2 + 1 < ap ? A.full : i * 2 + 1 === ap ? A.half : A.empty, x, h - 49); }
      // food, or the mount's health while riding
      if (mount) { const mh = Math.ceil(mount.hp), max = mount.maxHp || mount.T.hp, n = Math.ceil(max / 2);
        for (let i = 0; i < n; i++) { const x = cx + 91 - 9 - (i % 10) * 8, yy = hy2 - Math.floor(i / 10) * 10; ctx.drawImage(MH.empty, x, yy); if (i * 2 + 1 < mh) ctx.drawImage(MH.full, x, yy); else if (i * 2 + 1 === mh) ctx.drawImage(MH.half, x, yy); } }
      else for (let i = 0; i < 10; i++) { const x = cx + 91 - 9 - i * 8; let yy = hy2; if (p.sat <= 0 && g.tickCount % (p.food * 3 + 1) === 0) yy += (Math.random() * 3 | 0) - 1;
        ctx.drawImage(F.empty, x, yy); if (i * 2 + 1 < p.food) ctx.drawImage(F.full, x, yy); else if (i * 2 + 1 === p.food) ctx.drawImage(F.half, x, yy); }
      // air
      if (p.eyeInWater === 'water' && p.air < 300) { const full = Math.ceil((p.air - 2) * 10 / 300), part = Math.ceil(p.air * 10 / 300) - full; const ay = h - 49 - (mount ? Math.floor((Math.ceil((mount.maxHp || mount.T.hp) / 2) - 1) / 10) * 10 : 0); for (let i = 0; i < full + part; i++) ctx.drawImage(BUBBLE, cx + 91 - 9 - i * 8, ay); }
    }
    if (g.net && g.net.lobby) g.net.lobby.drawHUD(ctx, w, h);
    // chat
    const now = performance.now(); let cy = h - 48; const chatOpen = g.gui.screen && g.gui.screen.isChat;
    const cs = g.settings.chat, op = g.settings.chatOpacity ?? 1;
    if (cs !== 2) for (let i = g.chat.length - 1, n = 0; i >= 0 && n < (chatOpen ? 20 : 10); i--, n++) { const c = g.chat[i]; if (cs === 1 && !c.system) continue; const a = (chatOpen ? 1 : Math.max(0, Math.min(1, (10000 - (now - c.t)) / 1000))) * (0.1 + 0.9 * op); if (a <= 0) continue; ctx.globalAlpha = a; ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(2, cy - 1, 320, 9); drawText(ctx, c.msg, 3, cy, c.color || '#ffffff'); ctx.globalAlpha = 1; cy -= 9; }
    if (g.debug) this.debug(ctx, w);
  }
  debug(ctx, w) {
    const g = this.g, p = g.player; const wd = g.world;
    const lines = ['Minecraft 1.7.10 (' + g.fps + ' fps, ' + wd.busy + ' chunk updates)', 'C: ' + g.entities.length + '/' + g.mobs.mobs.length + '. Chunks: ' + wd.chunks.size, '', 'x: ' + p.x.toFixed(5) + ' (' + Math.floor(p.x) + ') // c: ' + (Math.floor(p.x) >> 4) + ' (' + (Math.floor(p.x) & 15) + ')', 'y: ' + p.y.toFixed(3) + ' (feet pos, ' + p.eyeY.toFixed(3) + ' eyes pos)', 'z: ' + p.z.toFixed(5) + ' (' + Math.floor(p.z) + ') // c: ' + (Math.floor(p.z) >> 4) + ' (' + (Math.floor(p.z) & 15) + ')', 'f: ' + (((Math.round(-p.yaw / (Math.PI / 2)) % 4) + 4) % 4), 'lc: ' + wd.getBlockLight(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z)) + ' b: ' + BIOMES[wd.biomeAt(Math.floor(p.x), Math.floor(p.z))].name + ' bl: ' + wd.getBlockLight(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z)) + ' sl: ' + wd.getSky(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z)), 'Seed: ' + wd.seed];
    lines.forEach((l, i) => drawText(ctx, l, 2, 2 + i * 10, '#e0e0e0'));
  }
}
