// Achievements (1.2.5 tree), statistics and the "Achievement get!" toast
import { drawText, drawTextCentered, textWidth } from './font.js';
import { drawPanel } from './gui.js';
import { drawItem } from './hud.js';
import { drawTile } from '../engine/textures.js';
import { items } from '../inventory/items.js';
import { Sound } from '../engine/audio.js';

// key: [col,row,parent,icon,name,desc,special]
const DEFS = {
  openInventory: [0, 0, null, 340, 'Taking Inventory', "Press 'E' to open your inventory."],
  mineWood: [2, 1, 'openInventory', 17, 'Getting Wood', 'Attack a tree until a block of wood pops out'],
  buildWorkBench: [4, -1, 'mineWood', 58, 'Benchmarking', 'Craft a workbench with four blocks of planks'],
  buildPickaxe: [4, 2, 'buildWorkBench', 270, 'Time to Mine!', 'Use planks and sticks to make a pickaxe'],
  buildFurnace: [3, 4, 'buildPickaxe', 61, 'Hot Topic', 'Construct a furnace out of eight stone blocks'],
  acquireIron: [1, 4, 'buildFurnace', 265, 'Acquire Hardware', 'Smelt an iron ingot'],
  buildHoe: [2, -3, 'buildWorkBench', 290, 'Time to Farm!', 'Use planks and sticks to make a hoe'],
  makeBread: [-1, -3, 'buildHoe', 297, 'Bake Bread', 'Turn wheat into bread'],
  bakeCake: [0, -5, 'buildHoe', 354, 'The Lie', 'Wheat, sugar, milk and eggs!'],
  buildBetterPickaxe: [6, 2, 'buildPickaxe', 274, 'Getting an Upgrade', 'Construct a better pickaxe'],
  cookFish: [2, 6, 'buildFurnace', 350, 'Delicious Fish', 'Catch and cook fish!'],
  onARail: [2, 3, 'acquireIron', 66, 'On A Rail', 'Travel by minecart at least 1 km from where you started', 1],
  buildSword: [6, -1, 'buildWorkBench', 268, 'Time to Strike!', 'Use planks and sticks to make a sword'],
  killEnemy: [8, -1, 'buildSword', 352, 'Monster Hunter', 'Attack and destroy a monster'],
  killCow: [7, -3, 'buildSword', 334, 'Cow Tipper', 'Harvest some leather'],
  flyPig: [8, -4, 'killCow', 329, 'When Pigs Fly', 'Fly a pig off a cliff', 1],
  snipeSkeleton: [7, 0, 'killEnemy', 261, 'Sniper Duel', 'Kill a skeleton with an arrow from more than 50 meters', 1],
  diamonds: [-1, 5, 'acquireIron', 264, 'DIAMONDS!', 'Acquire diamonds with your iron tools'],
  portal: [-1, 7, 'diamonds', 49, 'We Need to Go Deeper', 'Build a portal to the Nether'],
  ghast: [-4, 8, 'portal', 385, 'Return to Sender', 'Destroy a Ghast with a fireball', 1],
  blazeRod: [0, 9, 'portal', 369, 'Into Fire', 'Relieve a Blaze of its rod'],
  potion: [2, 8, 'blazeRod', 373, 'Local Brewery', 'Brew a potion'],
  theEnd: [3, 10, 'blazeRod', 381, 'The End?', 'Locate the End', 1],
  theEnd2: [4, 13, 'theEnd', 122, 'The End.', 'Kill the Enderdragon', 1],
  enchantments: [-4, 4, 'diamonds', 116, 'Enchanter', 'Use a book, obsidian and diamonds to construct an enchantment table'],
  overkill: [-4, 1, 'enchantments', 276, 'Overkill', 'Deal eight hearts of damage in a single hit', 1],
  bookcase: [-3, 6, 'enchantments', 47, 'Librarian', 'Build some bookshelves to further increase your enchantment table'],
};
const iconOf = id => items[id] ? id : 1;
const PICKS = [270, 274, 257, 285, 278], BETTER = [274, 257, 285, 278], HOES = [290, 291, 292, 293, 294], SWORDS = [268, 272, 267, 283, 276];

function wrap(text, max) { const out = []; let line = ''; for (const w of text.split(' ')) { const t = line ? line + ' ' + w : w; if (textWidth(t) > max && line) { out.push(line); line = w; } else line = t; } if (line) out.push(line); return out; }

export class Achievements {
  constructor(game) { this.game = game; this.got = {}; this.stats = {}; this.toasts = []; }
  load(data) { data = data || {}; this.got = Object.assign({}, data.got || {}); this.stats = Object.assign({ played: 0, mined: 0, placed: 0, crafted: 0, kills: 0, deaths: 0, ticks: 0 }, data.stats || {}); this.stats.played++; this.toasts = []; }
  save() { return { got: { ...this.got }, stats: { ...this.stats } }; }
  has(k) { return !!this.got[k]; }
  canGet(k) { const d = DEFS[k]; return d && (!d[2] || this.got[d[2]]); }
  unlock(k) {
    if (!DEFS[k] || this.got[k] || !this.canGet(k)) return false;
    this.got[k] = true; this.toasts.push({ k, t: 0 });
    this.game.onAIProgress?.(k);
    if (this.game.addChat) this.game.addChat('Achievement get! ' + DEFS[k][4]);
    return true;
  }
  tick() { this.stats.ticks = (this.stats.ticks || 0) + 1; const t = this.toasts[0]; if (t && ++t.t > 100) this.toasts.shift(); }
  onPickup(id) { if (id === 17) this.unlock('mineWood'); else if (id === 264) this.unlock('diamonds'); else if (id === 334) this.unlock('killCow'); else if (id === 369) this.unlock('blazeRod'); }
  onMine() { this.stats.mined = (this.stats.mined || 0) + 1; }
  onPlace() { this.stats.placed = (this.stats.placed || 0) + 1; }
  onCraft(id) {
    this.stats.crafted = (this.stats.crafted || 0) + 1;
    if (id === 58) this.unlock('buildWorkBench');
    if (PICKS.includes(id)) this.unlock('buildPickaxe');
    if (BETTER.includes(id)) this.unlock('buildBetterPickaxe');
    if (id === 61) this.unlock('buildFurnace');
    if (HOES.includes(id)) this.unlock('buildHoe');
    if (id === 297) this.unlock('makeBread');
    if (id === 354) this.unlock('bakeCake');
    if (SWORDS.includes(id)) this.unlock('buildSword');
    if (id === 116) this.unlock('enchantments');
    if (id === 47) this.unlock('bookcase');
  }
  onSmelt(id) { if (id === 265) this.unlock('acquireIron'); if (id === 350) this.unlock('cookFish'); }
  onKill(mob) { this.stats.kills = (this.stats.kills || 0) + 1; if (mob.hostile) this.unlock('killEnemy'); }

  // toast in the top right corner, slides in and out
  drawToast(ctx, w) {
    const t = this.toasts[0]; if (!t) return; const d = DEFS[t.k];
    const f = t.t / 100; let s = f < 0.15 ? f / 0.15 : f > 0.85 ? (1 - f) / 0.15 : 1; s = 1 - s; s = s * s * s * s;
    const x = w - 160, y = Math.round(-s * 36);
    ctx.fillStyle = '#000000'; ctx.fillRect(x, y, 160, 32); ctx.fillStyle = '#c6c6c6'; ctx.fillRect(x + 1, y, 158, 31);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 1, y, 157, 2); ctx.fillRect(x + 1, y, 2, 30); ctx.fillStyle = '#555555'; ctx.fillRect(x + 3, y + 29, 156, 2); ctx.fillRect(x + 157, y + 2, 2, 29);
    ctx.fillStyle = '#212121'; ctx.fillRect(x + 4, y + 2, 153, 27);
    drawItem(ctx, { id: iconOf(d[3]), count: 1 }, x + 8, y + 8, false);
    drawText(ctx, 'Achievement get!', x + 30, y + 7, '#ffff00'); drawText(ctx, d[4], x + 30, y + 18, '#ffffff');
  }

  // achievement map (1.2.5 layout: 256x202 window, scrollable inner area)
  drawTree(ctx, w, h, mx, my, scr) {
    const L = Math.floor((w - 256) / 2), T = Math.floor((h - 202) / 2), IX = L + 16, IY = T + 17, IW = 224, IH = 155;
    let minC = 0, maxC = 0, minR = 0, maxR = 0; for (const d of Object.values(DEFS)) { minC = Math.min(minC, d[0]); maxC = Math.max(maxC, d[0]); minR = Math.min(minR, d[1]); maxR = Math.max(maxR, d[1]); }
    const minX = minC * 24 - 112, maxX = maxC * 24 - 77 - 112 + 77 + 24, minY = minR * 24 - 112, maxY = maxR * 24 - 50;
    scr.ox = Math.max(minX, Math.min(maxX, scr.ox)); scr.oy = Math.max(minY, Math.min(maxY, scr.oy));
    const ox = Math.floor(scr.ox), oy = Math.floor(scr.oy);
    drawPanel(ctx, L, T, 256, 202);
    ctx.save(); ctx.beginPath(); ctx.rect(IX, IY, IW, IH); ctx.clip();
    // background: random terrain tiles by depth
    const tx0 = Math.floor((ox + 288) / 16), ty0 = Math.floor((oy + 288) / 16);
    for (let j = -1; j <= IH / 16 + 1; j++) for (let i = -1; i <= IW / 16 + 1; i++) {
      const ty = ty0 + j, tx = tx0 + i; let hsh = (tx * 73856093) ^ (ty * 19349663); hsh = ((hsh >>> 0) % 1000) / 1000;
      let name = 'sand'; if (ty > 37 || ty === 35) name = 'bedrock'; else if (ty > 4) { name = 'stone'; if (hsh > 0.96 && ty > 4) name = 'coal_ore'; if (hsh < 0.02 && ty > 10) name = 'iron_ore'; if (hsh > 0.985 && ty > 18) name = 'redstone_ore'; if (hsh < 0.004 && ty > 28) name = 'diamond_ore'; if (hsh > 0.995 && ty > 15) name = 'gold_ore'; } else if (ty > 0) name = 'dirt'; else if (ty === 0) name = 'grass_side';
      const px = IX + i * 16 - ((ox + 288) % 16 + 16) % 16, py = IY + j * 16 - ((oy + 288) % 16 + 16) % 16;
      drawTile(ctx, name, px, py, 16); ctx.fillStyle = 'rgba(0,0,0,' + Math.min(0.75, Math.max(0.15, ty / 50)) + ')'; ctx.fillRect(px, py, 16, 16);
    }
    const pos = d => [IX + d[0] * 24 - ox, IY + d[1] * 24 - oy];
    // connecting lines
    for (const [k, d] of Object.entries(DEFS)) { if (!d[2]) continue; const p = DEFS[d[2]]; const [x1, y1] = pos(d), [x2, y2] = pos(p);
      const col = this.got[k] ? '#a0a0a0' : this.canGet(k) ? ((Math.floor(performance.now() / 300) & 1) ? '#00ff00' : '#008200') : '#000000';
      ctx.fillStyle = col; const cx1 = x1 + 11, cy1 = y1 + 11, cx2 = x2 + 11, cy2 = y2 + 11;
      ctx.fillRect(Math.min(cx1, cx2), cy1, Math.abs(cx1 - cx2) + 1, 1); ctx.fillRect(cx2, Math.min(cy1, cy2), 1, Math.abs(cy1 - cy2) + 1); }
    let hover = null;
    for (const [k, d] of Object.entries(DEFS)) { const [x, y] = pos(d); if (x < IX - 24 || y < IY - 24 || x > IX + IW || y > IY + IH) continue;
      const got = this.got[k], can = this.canGet(k);
      ctx.fillStyle = got ? '#ffffff' : can ? '#a0a0a0' : '#505050';
      // frame
      ctx.fillStyle = '#1e1e1e'; ctx.fillRect(x - 2, y - 2, 26, 26);
      ctx.fillStyle = got ? (d[6] ? '#d9b84a' : '#c6c6c6') : can ? (d[6] ? '#8c7530' : '#8b8b8b') : '#3c3c3c'; ctx.fillRect(x - 1, y - 1, 24, 24);
      ctx.fillStyle = got ? '#ffffff' : '#a0a0a0'; ctx.fillRect(x - 1, y - 1, 24, 1); ctx.fillRect(x - 1, y - 1, 1, 24);
      ctx.fillStyle = '#373737'; ctx.fillRect(x - 1, y + 22, 24, 1); ctx.fillRect(x + 22, y - 1, 1, 24);
      if (d[6]) { ctx.fillStyle = '#1e1e1e'; ctx.fillRect(x - 2, y - 2, 3, 3); ctx.fillRect(x + 21, y - 2, 3, 3); ctx.fillRect(x - 2, y + 21, 3, 3); ctx.fillRect(x + 21, y + 21, 3, 3); }
      ctx.globalAlpha = got || can ? 1 : 0.3; drawItem(ctx, { id: iconOf(d[3]), count: 1 }, x + 3, y + 3, false); ctx.globalAlpha = 1;
      if (!got && !can) { ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(x - 1, y - 1, 24, 24); }
      if (mx >= IX && my >= IY && mx < IX + IW && my < IY + IH && mx >= x && my >= y && mx < x + 22 && my < y + 22) hover = k;
    }
    ctx.restore();
    drawText(ctx, 'Achievements', L + 15, T + 5, '#404040', false);
    if (hover) { const d = DEFS[hover]; const parentHidden = d[2] && !this.canGet(d[2]) && !this.got[d[2]];
      const title = d[4], desc = this.canGet(hover) || this.got[hover] ? d[5] : parentHidden ? 'Requires unknown achievement' : 'Requires \'' + DEFS[d[2]][4] + '\'';
      const lines = wrap(desc, 120); const bw = Math.max(120, textWidth(title)); const x = mx + 12, y = my - 4;
      const bh = 12 + lines.length * 9 + (this.got[hover] ? 12 : 0);
      ctx.fillStyle = 'rgba(0,0,0,0.75)'; ctx.fillRect(x - 3, y - 3, bw + 6, bh + 3);
      drawText(ctx, title, x, y, this.got[hover] ? (d[6] ? '#ffff80' : '#ffffff') : this.canGet(hover) ? (d[6] ? '#ffff80' : '#ffffff') : '#808080');
      lines.forEach((l, i) => drawText(ctx, l, x, y + 12 + i * 9, this.canGet(hover) || this.got[hover] ? '#a0a0a0' : '#705050'));
      if (this.got[hover]) drawText(ctx, 'Taken!', x, y + 12 + lines.length * 9 + 3, '#9090ff');
    }
  }
}
