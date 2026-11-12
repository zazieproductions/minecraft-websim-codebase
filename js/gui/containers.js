// Container GUIs: player inventory (2x2 crafting), creative item selection, workbench, chest, furnace
import { Screen, Button, drawPanel, drawSlot } from './gui.js';
import { drawText, drawTextCentered } from './font.js';
import { drawItem, drawTooltip } from './hud.js';
import { items, itemName, maxStack, EGGS } from '../inventory/items.js';
import { findRecipe } from '../inventory/crafting.js';
import { INGREDIENTS, EFFECT_NAMES, effectTime } from '../inventory/potions.js';
// active potion effects listed left of an inventory panel, like 1.7
function drawEffects(ctx, game, ox, oy) { const e = game.player && game.player.effects; if (!e) return; let y = oy; for (const k in e) { if (!EFFECT_NAMES[k]) continue; drawPanel(ctx, ox - 124, y, 120, 32); drawText(ctx, EFFECT_NAMES[k], ox - 116, y + 7, '#ffffff', true); drawText(ctx, effectTime(e[k].t), ox - 116, y + 18, '#7f7f7f', true); y += 33; } }
import { Sound } from '../engine/audio.js';
import * as Keys from './keys.js';
import { drawPlayerPreview } from '../engine/playermodel.js';

const same = (a, b) => a && b && a.id === b.id && a.dmg === b.dmg;
class ContainerScreen extends Screen {
  constructor() { super(); this.cursor = null; this.slots = []; this.W = 176; this.H = 166; }
  get inv() { return this.gui.game.player.inv; }
  layout() { this.ox = Math.floor((this.w - this.W) / 2); this.oy = Math.floor((this.h - this.H) / 2); this.slots = []; this.addSlots(); this.buttons.push(new Button(0, this.ox + this.W - 23, this.oy + 2, 20, 20, 'X', () => this.close())); }
  addPlayerSlots(y0) { const inv = this.inv;
    for (let r = 0; r < 3; r++) for (let c = 0; c < 9; c++) { const i = 9 + r * 9 + c; this.slots.push({ x: 8 + c * 18, y: y0 + r * 18, get: () => inv.slots[i], set: v => inv.slots[i] = v, group: 'main' }); }
    for (let c = 0; c < 9; c++) this.slots.push({ x: 8 + c * 18, y: y0 + 58, get: () => inv.slots[c], set: v => inv.slots[c] = v, group: 'hotbar' }); }
  drawBackground(ctx) { ctx.fillStyle = 'rgba(16,16,16,0.75)'; ctx.fillRect(0, 0, this.w, this.h); }
  slotAt(mx, my) { for (const s of this.slots) { const x = this.ox + s.x, y = this.oy + s.y; if (mx >= x - 1 && my >= y - 1 && mx < x + 17 && my < y + 17) return s; } return null; }
  drawSlots(ctx, mx, my) {
    for (const s of this.slots) { if (s.bg !== false) drawSlot(ctx, this.ox + s.x - 1, this.oy + s.y - 1); if (s.big) { ctx.fillStyle = '#8b8b8b'; } }
    for (const s of this.slots) drawItem(ctx, s.get(), this.ox + s.x, this.oy + s.y);
    const h = this.slotAt(mx, my); if (h) { ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(this.ox + h.x, this.oy + h.y, 16, 16); }
  }
  drawCursor(ctx, mx, my) {
    if (this.cursor) drawItem(ctx, this.cursor, mx - 8, my - 8);
    else { const h = this.slotAt(mx, my); const s = h && h.get(); if (s) drawTooltip(ctx, itemName(s.id, s.dmg), mx, my); }
  }
  mouseDown(mx, my, btn, shift) {
    if (super.mouseDown(mx, my, btn)) return true;
    const s = this.slotAt(mx, my);
    if (!s) { const x = mx - this.ox, y = my - this.oy; if ((x < 0 || y < 0 || x > this.W || y > this.H) && this.cursor) { if (btn === 0) { this.gui.game.dropStack(this.cursor, true); this.cursor = null; } else { this.gui.game.dropStack({ ...this.cursor, count: 1 }, true); if (--this.cursor.count <= 0) this.cursor = null; } } return; }
    this.clickSlot(s, btn, shift);
  }
  clickSlot(s, btn, shift) {
    const cur = s.get();
    if (s.output) { this.takeOutput(s, shift); return; }
    if (shift && cur) { this.quickMove(s); return; }
    if (s.filter && this.cursor && !s.filter(this.cursor)) return;
    const lim = Math.min(maxStack(this.cursor ? this.cursor.id : cur ? cur.id : 1), s.limit || 64);
    if (btn === 0) {
      if (this.cursor && same(cur, this.cursor) && !items[cur.id]?.durability) { const n = Math.min(lim - cur.count, this.cursor.count); cur.count += n; this.cursor.count -= n; if (this.cursor.count <= 0) this.cursor = null; }
      else { if (this.cursor && this.cursor.count > lim) return; s.set(this.cursor); this.cursor = cur; }
    } else if (btn === 2) {
      if (!this.cursor && cur) { const h = Math.ceil(cur.count / 2); this.cursor = { ...cur, count: h }; cur.count -= h; if (cur.count <= 0) s.set(null); }
      else if (this.cursor && !cur) { s.set({ ...this.cursor, count: 1 }); if (--this.cursor.count <= 0) this.cursor = null; }
      else if (this.cursor && same(cur, this.cursor) && cur.count < lim) { cur.count++; if (--this.cursor.count <= 0) this.cursor = null; }
      else if (this.cursor) { s.set(this.cursor); this.cursor = cur; }
    }
    this.changed && this.changed();
  }
  moveInto(stack, targets) {
    for (const t of targets) { const c = t.get(); if (same(c, stack) && !items[c.id]?.durability) { const n = Math.min(maxStack(c.id) - c.count, stack.count); c.count += n; stack.count -= n; if (!stack.count) return true; } }
    for (const t of targets) { if (!t.get() && (!t.filter || t.filter(stack))) { t.set({ ...stack }); stack.count = 0; return true; } }
    return false;
  }
  targetsFor(s) { const g = s.group; if (g === 'main') return this.slots.filter(x => x.group === (this.hasContainer ? 'container' : 'hotbar')); if (g === 'hotbar') return this.slots.filter(x => x.group === (this.hasContainer ? 'container' : 'main')); return [...this.slots.filter(x => x.group === 'hotbar').reverse(), ...this.slots.filter(x => x.group === 'main').reverse()]; }
  quickMove(s) { const st = s.get(); if (!st) return; const c = { ...st }; this.moveInto(c, this.targetsFor(s)); s.set(c.count > 0 ? c : null); this.changed && this.changed(); }
  takeOutput(s, shift) {
    const out = s.get(); if (!out) return;
    const take = () => { if (shift) { const c = { ...out }; const all = [...this.slots.filter(x => x.group === 'hotbar').reverse(), ...this.slots.filter(x => x.group === 'main').reverse()]; if (!this.moveInto(c, all)) return false; return true; }
      if (this.cursor && (!same(this.cursor, out) || this.cursor.count + out.count > maxStack(out.id))) return false;
      if (this.cursor) this.cursor.count += out.count; else this.cursor = { ...out }; return true; };
    let n = 0; do { if (!take()) break; s.onTake && s.onTake(out); n++; } while (shift && s.get() && n < 64);
  }
  onClose() { const g = this.gui.game; if (this.cursor) { const l = this.inv.add(this.cursor); if (l) g.dropStack({ ...this.cursor, count: l }, true); this.cursor = null; } this.returnItems && this.returnItems(); }
  key(e) { if (e.key === 'Escape' || (Keys.is('inventory', e.code) && !e.repeat)) { this.close(); return true; } if (/^Digit[1-9]$/.test(e.code)) { const h = this.slotAt(this.gui.mx, this.gui.my); if (h && !h.output) { const i = +e.code.slice(5) - 1; const a = h.get(), b = this.inv.slots[i]; h.set(b); this.inv.slots[i] = a; this.changed && this.changed(); } return true; } }
}
// crafting grid helper
function craftingSlots(scr, n, x0, y0, outX, outY) {
  scr.grid = new Array(n * n).fill(null);
  for (let i = 0; i < n * n; i++) scr.slots.push({ x: x0 + (i % n) * 18, y: y0 + Math.floor(i / n) * 18, get: () => scr.grid[i], set: v => { scr.grid[i] = v; scr.updateCraft(); }, group: 'craft' });
  scr.result = null;
  scr.updateCraft = () => { scr.result = findRecipe(scr.grid, n); };
  scr.changed = () => scr.updateCraft();
  scr.slots.push({ x: outX, y: outY, get: () => scr.result, set: () => {}, output: true, big: true, onTake: (out) => {
    for (let i = 0; i < scr.grid.length; i++) { const g = scr.grid[i]; if (!g) continue; const it = items[g.id]; g.count--; if (g.count <= 0) scr.grid[i] = (g.id === 326 || g.id === 327 || g.id === 335) ? { id: 325, count: 1, dmg: 0 } : null; }
    scr.gui.game.achievements.onCraft(out.id); scr.updateCraft(); } });
  scr.returnItems = () => { for (let i = 0; i < scr.grid.length; i++) if (scr.grid[i]) { const l = scr.inv.add(scr.grid[i]); if (l) scr.gui.game.dropStack({ ...scr.grid[i], count: l }, true); scr.grid[i] = null; } };
}
function arrow(ctx, x, y, f = 1) { ctx.fillStyle = '#8b8b8b'; for (let i = 0; i < 16; i++) { const h = i < 10 ? 4 : 2 + (15 - i) * 2 - 6; } ctx.fillStyle = '#8b8b8b'; ctx.fillRect(x, y + 6, 16, 4); for (let i = 0; i < 6; i++) ctx.fillRect(x + 16 + i, y + 1 + i, 1, 14 - i * 2);
  if (f > 0) { ctx.fillStyle = '#ffffff'; const w = Math.round(22 * f); ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, 16); ctx.clip(); ctx.fillRect(x, y + 6, 16, 4); for (let i = 0; i < 6; i++) ctx.fillRect(x + 16 + i, y + 1 + i, 1, 14 - i * 2); ctx.restore(); } }
export class PlayerInventory extends ContainerScreen {
  constructor() { super(); this.pausesGame = false; }
  addSlots() { const inv = this.inv; this.addPlayerSlots(84);
    for (let i = 0; i < 4; i++) this.slots.push({ x: 8, y: 8 + i * 18, get: () => inv.armor[i], set: v => inv.armor[i] = v, filter: s => items[s.id]?.armor === i, limit: 1, group: 'armor' });
    craftingSlots(this, 2, 88, 26, 144, 36); }
  draw(ctx, mx, my) { drawPanel(ctx, this.ox, this.oy, this.W, this.H); ctx.fillStyle = '#000'; ctx.fillRect(this.ox + 26, this.oy + 8, 52, 70); drawPlayerPreview(ctx, this.gui.game, this.ox + 26, this.oy + 8, 52, 70, mx, my, this.gui.scale);
    drawText(ctx, 'Crafting', this.ox + 86, this.oy + 16, '#404040', false); arrow(ctx, this.ox + 112, this.oy + 36, 0);
    drawEffects(ctx, this.gui.game, this.ox, this.oy);
    this.drawSlots(ctx, mx, my); super.draw(ctx, mx, my); this.drawCursor(ctx, mx, my); }
  quickMove(s) { const st = s.get(); if (st && items[st.id]?.armor !== undefined && s.group !== 'armor') { const a = this.slots.find(x => x.group === 'armor' && x.filter(st)); if (a && !a.get()) { a.set({ ...st }); s.set(null); return; } } super.quickMove(s); }
}
export class Workbench extends ContainerScreen {
  addSlots() { this.addPlayerSlots(84); craftingSlots(this, 3, 30, 17, 124, 35); }
  draw(ctx, mx, my) { drawPanel(ctx, this.ox, this.oy, this.W, this.H); drawText(ctx, 'Crafting', this.ox + 28, this.oy + 6, '#404040', false); drawText(ctx, 'Inventory', this.ox + 8, this.oy + 72, '#404040', false); arrow(ctx, this.ox + 90, this.oy + 35, 0);
    this.drawSlots(ctx, mx, my); ctx.fillStyle = '#8b8b8b'; super.draw(ctx, mx, my); this.drawCursor(ctx, mx, my); }
  targetsFor(s) { if (s.group === 'craft') return super.targetsFor({ group: 'x' }); return super.targetsFor(s); }
}
export class Chest extends ContainerScreen {
  constructor(tile, pos) { super(); this.tile = tile; this.pos = pos; this.hasContainer = true; }
  addSlots() { const t = this.tile; for (let i = 0; i < 27; i++) this.slots.push({ x: 8 + (i % 9) * 18, y: 18 + Math.floor(i / 9) * 18, get: () => t.items[i], set: v => { t.items[i] = v; this.dirty(); }, group: 'container' }); this.addPlayerSlots(84); }
  dirty() { const g = this.gui.game; const c = g.world.getChunk(this.pos.x >> 4, this.pos.z >> 4); if (c) c.modified = true; }
  targetsFor(s) { if (s.group === 'container') return super.targetsFor({ group: 'x' }); return this.slots.filter(x => x.group === 'container'); }
  draw(ctx, mx, my) { drawPanel(ctx, this.ox, this.oy, this.W, this.H); drawText(ctx, 'Chest', this.ox + 8, this.oy + 6, '#404040', false); drawText(ctx, 'Inventory', this.ox + 8, this.oy + 72, '#404040', false); this.drawSlots(ctx, mx, my); super.draw(ctx, mx, my); this.drawCursor(ctx, mx, my); }
  onClose() { super.onClose(); this.dirty(); Sound.play('chest', 0.4); }
}
export class Furnace extends ContainerScreen {
  constructor(tile, pos) { super(); this.tile = tile; this.pos = pos; this.hasContainer = true; this.pausesGame = false; }
  addSlots() { const t = this.tile; const g = this.gui.game; const mk = (i, x, y, extra) => this.slots.push({ x, y, get: () => t.slots[i], set: v => { t.slots[i] = v; g.ticker.addFurnace(this.pos.x, this.pos.y, this.pos.z); }, group: 'container', ...extra });
    mk(0, 56, 17); mk(1, 56, 53, { filter: s => !!items[s.id]?.fuel }); mk(2, 116, 35, { output: true, onTake: () => { t.slots[2] = null; } }); this.addPlayerSlots(84); }
  takeOutput(s, shift) { const out = s.get(); if (!out) return; if (shift) { const c = { ...out }; this.moveInto(c, [...this.slots.filter(x => x.group === 'hotbar').reverse(), ...this.slots.filter(x => x.group === 'main').reverse()]); this.tile.slots[2] = c.count ? c : null; }
    else { if (this.cursor && (!same(this.cursor, out) || this.cursor.count + out.count > maxStack(out.id))) return; if (this.cursor) this.cursor.count += out.count; else this.cursor = { ...out }; this.tile.slots[2] = null; }
    const xp = { 265: 0.7, 266: 1, 1: 0.1, 20: 0.1, 320: 0.35, 364: 0.35, 366: 0.35, 350: 0.35, 336: 0.3, 263: 0.15 }[out.id] || 0.1; const g = this.gui.game; g.spawnXP(g.player.x, g.player.y + 0.5, g.player.z, Math.floor(xp * out.count + Math.random()));
    if (out.id === 265) g.achievements.unlock('acquireIron'); }
  targetsFor(s) { if (s.group === 'container') return super.targetsFor({ group: 'x' }); const st = s.get(); return this.slots.filter(x => x.group === 'container' && !x.output && (!x.filter || x.filter(st))); }
  draw(ctx, mx, my) { const t = this.tile; drawPanel(ctx, this.ox, this.oy, this.W, this.H); drawText(ctx, 'Furnace', this.ox + 60, this.oy + 6, '#404040', false); drawText(ctx, 'Inventory', this.ox + 8, this.oy + 72, '#404040', false);
    arrow(ctx, this.ox + 79, this.oy + 34, t.cook / 200);
    const fx = this.ox + 57, fy = this.oy + 37; ctx.fillStyle = '#8b8b8b'; ctx.fillRect(fx, fy, 14, 14); if (t.burn > 0) { const h = Math.ceil(13 * t.burn / (t.burnMax || 1)); ctx.fillStyle = '#ff9a1a'; ctx.fillRect(fx + 2, fy + 14 - h, 10, h); ctx.fillStyle = '#ffe050'; ctx.fillRect(fx + 4, fy + 14 - Math.max(1, h - 3), 6, Math.max(1, h - 3)); }
    this.drawSlots(ctx, mx, my); super.draw(ctx, mx, my); this.drawCursor(ctx, mx, my); }
}
export class BrewingStand extends ContainerScreen {
  constructor(tile, pos) { super(); this.tile = tile; this.pos = pos; this.hasContainer = true; this.pausesGame = false; }
  addSlots() { const t = this.tile, g = this.gui.game; const mk = (i, x, y, extra) => this.slots.push({ x, y, get: () => t.slots[i], set: v => { t.slots[i] = v; g.ticker.addFurnace(this.pos.x, this.pos.y, this.pos.z); }, group: 'container', ...extra });
    const bottle = { filter: s => s.id === 373 || s.id === 374, limit: 1 };
    mk(0, 56, 46, bottle); mk(1, 79, 53, bottle); mk(2, 102, 46, bottle); mk(3, 79, 17, { filter: s => INGREDIENTS.has(s.id) }); this.addPlayerSlots(84); }
  targetsFor(s) { if (s.group === 'container') return super.targetsFor({ group: 'x' }); const st = s.get(); return this.slots.filter(x => x.group === 'container' && (!x.filter || x.filter(st))); }
  draw(ctx, mx, my) { const t = this.tile, ox = this.ox, oy = this.oy; drawPanel(ctx, ox, oy, this.W, this.H); drawText(ctx, 'Brewing Stand', ox + 56, oy + 6, '#404040', false); drawText(ctx, 'Inventory', ox + 8, oy + 72, '#404040', false);
    // tubes from the ingredient down to the bottles, and the brewing progress arrow
    ctx.fillStyle = '#8b8b8b'; ctx.fillRect(ox + 62, oy + 30, 2, 14); ctx.fillRect(ox + 62, oy + 30, 18, 2); ctx.fillRect(ox + 96, oy + 30, 18, 2); ctx.fillRect(ox + 112, oy + 30, 2, 14); ctx.fillRect(ox + 87, oy + 36, 2, 15);
    ctx.fillRect(ox + 98, oy + 16, 9, 28); const f = (t.brew || 0) / 400; if (f > 0) { ctx.fillStyle = '#ffffff'; ctx.fillRect(ox + 99, oy + 17, 7, Math.ceil(26 * f)); ctx.fillStyle = '#9bd0ff'; for (let i = 0; i < 4; i++) { const by = oy + 42 - ((t.brew / 3 + i * 7) % 26); ctx.fillRect(ox + 66 + (i % 2) * 4, by, 2, 2); } }
    this.drawSlots(ctx, mx, my); super.draw(ctx, mx, my); this.drawCursor(ctx, mx, my); }
}
// villager trading (1.7 merchant screen): two payment slots, one result, and arrows to page through the offers
const TRADES = {
  farmer: [[[296, 18, 22]], [[450, 1], null, [297, 2, 4]], [[450, 1], null, [260, 5, 7]], [[349, 9, 13]], [[450, 1], null, [357, 6, 10]], [[391, 15, 19]], [[450, 1], null, [360, 4, 6]]],
  librarian: [[[339, 24, 36]], [[450, 1], [340, 1], [403, 1]], [[450, 3, 5], null, [47, 1]], [[340, 8, 10]], [[450, 1], null, [20, 3, 5]], [[450, 10, 12], null, [345, 1]], [[450, 10, 12], null, [347, 1]]],
  priest: [[[367, 36, 64]], [[266, 8, 10]], [[450, 1], null, [331, 2, 4]], [[450, 1], null, [348, 1, 3]], [[450, 4, 7], null, [368, 1]], [[450, 3, 11], null, [381, 1]]],
  butcher: [[[263, 16, 24]], [[319, 14, 18]], [[363, 14, 18]], [[450, 1], null, [320, 5, 7]], [[450, 1], null, [364, 5, 7]]],
  smith: [[[263, 16, 24]], [[265, 8, 10]], [[264, 1]], [[450, 7, 10], null, [257, 1]], [[450, 9, 11], null, [267, 1]], [[450, 4, 6], null, [306, 1]], [[450, 10, 14], null, [307, 1]], [[450, 16, 19], null, [278, 1]], [[450, 12, 15], null, [276, 1]]] };
TRADES.villager = TRADES.farmer;
for (const k in TRADES) TRADES[k] = TRADES[k].filter(t => t.every(s => !s || items[s[0]]));
const rr = (a, b) => a + Math.floor(Math.random() * ((b ?? a) - a + 1));
function makeOffer(t) { const [a, b, out] = t; const st = s => s && { id: s[0], count: rr(s[1], s[2]), dmg: 0 }; return { a: st(a), b: st(b), out: out ? st(out) : { id: 450, count: 1, dmg: 0 }, uses: 0, max: rr(3, 10) }; }
export function villagerOffers(v) { if (!v.offers) { const pool = TRADES[v.prof] || TRADES.farmer; v.offers = [makeOffer(pool[0]), makeOffer(pool[1 + Math.floor(Math.random() * (pool.length - 1))])]; } return v.offers; }
export class Merchant extends ContainerScreen {
  constructor(v) { super(); this.v = v; this.hasContainer = true; this.pausesGame = false; this.pay = [null, null]; this.page = 0; v.trading = true; }
  get offer() { const o = villagerOffers(this.v); this.page = Math.max(0, Math.min(o.length - 1, this.page)); return o[this.page]; }
  layout() { super.layout(); this.buttons.push(new Button(1, this.ox + 120 + 27, this.oy + 24, 12, 19, '>', () => { this.page++; }), new Button(2, this.ox + 36 - 19, this.oy + 24, 12, 19, '<', () => { this.page--; })); }
  addSlots() { for (let i = 0; i < 2; i++) this.slots.push({ x: 36 + i * 26, y: 53, get: () => this.pay[i], set: v => { this.pay[i] = v; }, group: 'container' });
    this.slots.push({ x: 120, y: 53, get: () => this.result(), set: () => {}, output: true, onTake: () => this.trade() }); this.addPlayerSlots(84); }
  // which payment slot covers which cost (either order works, like vanilla)
  match() { const o = this.offer; if (!o || o.uses >= o.max) return null; const ok = (s, c) => c ? s && s.id === c.id && s.count >= c.count : !s || true;
    if (ok(this.pay[0], o.a) && (o.b ? ok(this.pay[1], o.b) : true)) return [0, 1]; if (!o.b && ok(this.pay[1], o.a)) return [1, 0]; if (o.b && ok(this.pay[1], o.a) && ok(this.pay[0], o.b)) return [1, 0]; return null; }
  result() { const m = this.match(); return m ? { ...this.offer.out } : null; }
  trade() { const o = this.offer, m = this.match(); if (!m) return; const take = (i, c) => { if (!c) return; const s = this.pay[i]; s.count -= c.count; if (s.count <= 0) this.pay[i] = null; };
    take(m[0], o.a); take(m[1], o.b); o.uses++; const g = this.gui.game, v = this.v; g.spawnXP(v.x, v.y + 0.5, v.z, rr(2, 5)); g.sound('mob:villager', v, 0.6, 1.3);
    if (Math.random() < 0.25 || o.uses === 1 && this.page === this.v.offers.length - 1) { const pool = TRADES[v.prof] || TRADES.farmer; const n = makeOffer(pool[Math.floor(Math.random() * pool.length)]); if (!v.offers.some(x => x.out.id === n.out.id && (x.a && x.a.id) === (n.a && n.a.id))) { v.offers.push(n); for (let i = 0; i < 5; i++) g.particles.fx('heart', v.x + Math.random() - 0.5, v.y + 2.2, v.z + Math.random() - 0.5); } }
    if (o.uses >= o.max && Math.random() < 0.5) for (const x of v.offers) if (x !== o && x.uses >= x.max) x.uses = 0; }
  targetsFor(s) { if (s.group === 'container') return super.targetsFor({ group: 'x' }); return this.slots.filter(x => x.group === 'container'); }
  returnItems() { for (let i = 0; i < 2; i++) if (this.pay[i]) { const l = this.inv.add(this.pay[i]); if (l) this.gui.game.dropStack({ ...this.pay[i], count: l }, true); this.pay[i] = null; } this.v.trading = false; }
  draw(ctx, mx, my) { const ox = this.ox, oy = this.oy, o = this.offer; if (this.v.deathTime || this.v.dead) { this.close(); return; }
    drawPanel(ctx, ox, oy, this.W, this.H); drawTextCentered(ctx, ({ farmer: 'Farmer', librarian: 'Librarian', priest: 'Priest', butcher: 'Butcher', smith: 'Blacksmith' }[this.v.prof] || 'Villager'), ox + this.W / 2, oy + 6, '#404040', false); drawText(ctx, 'Inventory', ox + 8, oy + 72, '#404040', false);
    if (o) { drawItem(ctx, o.a, ox + 36, oy + 26); if (o.b) drawItem(ctx, o.b, ox + 62, oy + 26); drawItem(ctx, o.out, ox + 120, oy + 26); arrow(ctx, ox + 88, oy + 26, 0); if (o.uses >= o.max) { ctx.fillStyle = '#c00'; ctx.fillRect(ox + 86, oy + 31, 26, 3); } }
    arrow(ctx, ox + 88, oy + 53, 0); this.drawSlots(ctx, mx, my); super.draw(ctx, mx, my); this.drawCursor(ctx, mx, my); }
}
// a tamed horse's gear: saddle, armour (horses only) and, on donkeys and mules with a chest, 15 storage slots
export class HorseInventory extends ContainerScreen {
  constructor(horse) { super(); this.horse = horse; this.hasContainer = true; this.pausesGame = false; }
  addSlots() { const h = this.horse;
    this.slots.push({ x: 8, y: 18, get: () => h.saddled ? { id: 329, count: 1, dmg: 0 } : null, set: v => { h.saddled = !!v; if (!v && h.rider) h.dismount(); }, filter: s => s.id === 329, limit: 1, group: 'container' });
    if ((h.kind || 'h') === 'h') this.slots.push({ x: 8, y: 36, get: () => h.armor ? { id: h.armor, count: 1, dmg: 0 } : null, set: v => { h.armor = v ? v.id : 0; }, filter: s => !!items[s.id]?.horseArmor, limit: 1, group: 'container' });
    if (h.chest) { h.hinv = h.hinv || new Array(15).fill(null); for (let i = 0; i < 15; i++) this.slots.push({ x: 80 + (i % 5) * 18, y: 18 + Math.floor(i / 5) * 18, get: () => h.hinv[i], set: v => { h.hinv[i] = v; }, group: 'container' }); }
    this.addPlayerSlots(84); }
  targetsFor(s) { if (s.group === 'container') return super.targetsFor({ group: 'x' }); const st = s.get(); const gear = this.slots.filter(x => x.filter && x.filter(st) && !x.get()); return gear.length ? gear : this.slots.filter(x => x.group === 'container' && !x.filter); }
  key(e) { if (this.horse.deathTime) { this.close(); return true; } return super.key(e); }
  draw(ctx, mx, my) { const h = this.horse, ox = this.ox, oy = this.oy; if (h.deathTime || h.dead) { this.close(); return; }
    drawPanel(ctx, ox, oy, this.W, this.H); drawText(ctx, h.nameTag || ({ d: 'Donkey', m: 'Mule' }[h.kind] || 'Horse'), ox + 8, oy + 6, '#404040', false); drawText(ctx, 'Inventory', ox + 8, oy + 72, '#404040', false);
    ctx.fillStyle = '#000'; ctx.fillRect(ox + 26, oy + 18, 52, 52); drawHorsePreview(ctx, h, ox + 26, oy + 18, 52, 52);
    if (!h.chest) { ctx.fillStyle = '#8b8b8b'; ctx.fillRect(ox + 79, oy + 17, 90, 54); }
    this.drawSlots(ctx, mx, my);
    for (const [s, icon] of [[this.slots[0], 'saddle'], [this.slots[1], 'armor']]) if (s && s.y <= 36 && s.x === 8 && !s.get()) { ctx.fillStyle = 'rgba(55,55,55,0.35)'; if (icon === 'saddle') { ctx.fillRect(ox + 11, oy + s.y + 6, 10, 4); ctx.fillRect(ox + 13, oy + s.y + 4, 6, 2); } else { ctx.fillRect(ox + 10, oy + s.y + 5, 12, 6); ctx.fillRect(ox + 18, oy + s.y + 2, 4, 4); } }
    super.draw(ctx, mx, my); this.drawCursor(ctx, mx, my); }
}
// a small side-on silhouette of the horse in its coat colour (stand-in for a 3D preview)
function drawHorsePreview(ctx, h, x, y, w, hh) { const c = h.kind === 'd' ? '#867a6c' : h.kind === 'm' ? '#60402a' : ['#ece8e0', '#d6ba8c', '#aa6234', '#7c5032', '#342e2c', '#868482', '#543622'][h.color || 0];
  const R = (a, b, cw, ch, col) => { ctx.fillStyle = col; ctx.fillRect(x + a, y + b, cw, ch); };
  R(12, 20, 28, 12, c); for (const lx of [13, 18, 31, 36]) { R(lx, 32, 3, 12, c); R(lx, 42, 3, 2, '#2a2422'); } R(6, 9, 7, 14, c); R(2, 9, 6, 6, c); R(7, 6, 2, h.kind && h.kind !== 'h' ? 5 : 3, c); R(13, 7, 2, 14, '#3a2a20'); R(40, 21, 3, 11, '#3a2a20'); R(4, 11, 1, 1, '#000');
  if (h.armor) R(12, 20, 28, 5, { 417: '#c8c8ce', 418: '#e6be32', 419: '#50d6c8' }[h.armor]); if (h.saddled) { R(20, 18, 10, 3, '#6e3e20'); R(24, 21, 1, 7, '#888'); } if (h.chest) R(30, 22, 6, 7, '#96682f'); }
// 1.7 creative inventory: tabbed item groups, search, and a survival inventory tab
const V = (id, n) => Array.from({ length: n }, (_, m) => [id, m]);
const TAB_ITEMS = {
  building: [1, ...V(2, 1), ...V(3, 3), 4, ...V(5, 6), 7, ...V(12, 2), 13, 14, 15, 16, ...V(17, 4), ...V(162, 2), 19, 20, ...V(95, 16), 21, 22, 24, ...V(35, 16), 41, 42, 133, 57, 173, 43, 44, 45, 47, 48, 49, 56, 73, 129, 79, 174, 80, 82, 172, ...V(159, 16), 86, 87, 88, 89, 98, 103, 170, 112, ...V(155, 3), 153],
  decoration: [...V(6, 6), ...V(18, 4), ...V(161, 2), [31, 1], [31, 2], 32, 37, ...V(38, 9), 39, 40, 81, 106, 50, 65, 85, 113, 107, 54, 58, 61, 78, ...V(171, 16), 323, 355],
  redstone: [331, 76, 356, 69, 77, 143, 70, 72, 152, 123, 33, 29, 25, 46, 324, 330, 107, 137],
  transportation: [66, 27, 28, 157, 328, 333, 329, 417, 418, 419, 420],
  misc: [325, 326, 327, 335, 339, 340, 332, 368, 421, 2256, 2257, 2258, 2259, 2260, 2261, 2262, 2263, 2264, 2265, 2266, 2267, ...EGGS.map(e => [383, e[0]])],
  food: [260, 322, 282, 297, 319, 320, 349, 350, 357, 360, 363, 364, 365, 366, 367, 354, 391, 396, 392, 393, 394, 400],
  tools: [269, 270, 271, 290, 273, 274, 275, 291, 256, 257, 258, 292, 277, 278, 279, 293, 284, 285, 286, 294, 259, 345, 347, 359],
  combat: [268, 272, 267, 276, 283, 261, 262, ...Array.from({ length: 20 }, (_, i) => 298 + i)],
  brewing: [...Array.from({ length: 13 }, (_, i) => [373, i]), ...Array.from({ length: 13 }, (_, i) => [373, i | 64]), 374, 379, 372, 370, 375, 376, 377, 378, 369, 382, 348, 331, 353, 289],
  materials: [263, 264, 450, 265, 266, 371, 280, 281, 287, 288, 289, 295, 296, 318, 334, 336, 337, 338, 341, 344, 348, ...V(351, 16), 352, 353, 405, 406, 361, 362],
};
const TABS = [['building', 'Building Blocks', 45], ['decoration', 'Decoration Blocks', [38, 0]], ['redstone', 'Redstone', 331], ['transportation', 'Transportation', 328], ['misc', 'Miscellaneous', 327], ['search', 'Search Items', 345],
  ['food', 'Foodstuffs', 260], ['tools', 'Tools', 258], ['combat', 'Combat', 283], ['brewing', 'Brewing', 370], ['materials', 'Materials', 280], ['inventory', 'Survival Inventory', 54]];
const norm = e => Array.isArray(e) ? { id: e[0], count: 1, dmg: e[1] } : { id: e, count: 1, dmg: 0 };
const ALL = [...new Map(Object.values(TAB_ITEMS).flat().map(e => [JSON.stringify(norm(e)), e])).values()];
const tabList = k => (k === 'search' ? ALL : TAB_ITEMS[k] || []).map(norm).filter(s => items[s.id]);
let lastTab = 0;
export class CreativeInventory extends ContainerScreen {
  constructor() { super(); this.W = 195; this.H = 136; this.scroll = 0; this.pausesGame = false; this.tab = lastTab; this.query = ''; this.refresh(); }
  refresh() { const k = TABS[this.tab][0]; let l = tabList(k); if (k === 'search' && this.query) { const q = this.query.toLowerCase(); l = l.filter(s => itemName(s.id, s.dmg).toLowerCase().includes(q)); } this.list = l; this.scroll = 0; }
  get rows() { return Math.ceil(this.list.length / 9); }
  get survival() { return TABS[this.tab][0] === 'inventory'; }
  addSlots() { const inv = this.inv;
    if (this.survival) {
      for (let r = 0; r < 3; r++) for (let c = 0; c < 9; c++) { const i = 9 + r * 9 + c; this.slots.push({ x: 9 + c * 18, y: 54 + r * 18, get: () => inv.slots[i], set: v => inv.slots[i] = v, group: 'main' }); }
      for (let a = 0; a < 4; a++) this.slots.push({ x: 54 + a * 18, y: 6, get: () => inv.armor[a], set: v => inv.armor[a] = v, filter: s => items[s.id]?.armor === a, limit: 1, group: 'armor' });
      this.slots.push({ x: 173, y: 112, get: () => null, set: () => {}, trash: true });
    } else for (let i = 0; i < 45; i++) { const k = i; this.slots.push({ x: 9 + (i % 9) * 18, y: 18 + Math.floor(i / 9) * 18, get: () => this.list[this.scroll * 9 + k] ? { ...this.list[this.scroll * 9 + k] } : null, set: () => {}, creative: true }); }
    for (let c = 0; c < 9; c++) this.slots.push({ x: 9 + c * 18, y: 112, get: () => inv.slots[c], set: v => inv.slots[c] = v, group: 'hotbar' }); }
  layout() { super.layout(); const x = this.buttons[this.buttons.length - 1]; if (x) { x.x = this.ox + this.W + 4; x.y = this.oy; } }
  tabRect(i) { const top = i < 6, col = i % 6; const x = this.ox + (col === 5 ? this.W - 28 : col * 29), y = top ? this.oy - 28 : this.oy + this.H - 4; return [x, y, 28, 32]; }
  setTab(i) { if (i === this.tab) return; this.tab = lastTab = i; this.query = ''; this.refresh(); this.slots = []; this.addSlots(); }
  clickSlot(s, btn, shift) {
    if (s.trash) { if (shift) { for (let i = 0; i < 36; i++) this.inv.slots[i] = null; } this.cursor = null; return; }
    if (s.creative) { const st = s.get(); if (this.cursor) { if (st && same(st, this.cursor) && btn === 0) { this.cursor.count = Math.min(maxStack(st.id), this.cursor.count + 1); } else this.cursor = null; return; } if (st) this.cursor = { ...st, count: shift ? maxStack(st.id) : 1 }; return; }
    if (shift && !this.survival) { s.set(null); return; } super.clickSlot(s, btn, shift && this.survival);
  }
  wheel(d) { if (!this.survival) this.scroll = Math.max(0, Math.min(Math.max(0, this.rows - 5), this.scroll + d)); }
  mouseDown(mx, my, btn, shift) {
    for (let i = 0; i < TABS.length; i++) { const [x, y, w, h] = this.tabRect(i); const inY = i < 6 ? my >= y && my < y + 28 : my >= y + 4 && my < y + h; if (mx >= x && mx < x + w && inY) { Sound.play('click'); this.setTab(i); return true; } }
    const sx = this.ox + 175, sy = this.oy + 18; if (!this.survival && mx >= sx && mx < sx + 12 && my >= sy && my < sy + 88) { this.dragBar = true; this.mouseMove(mx, my); return; }
    return super.mouseDown(mx, my, btn, shift); }
  mouseMove(mx, my) { if (this.dragBar) { const f = (my - this.oy - 18 - 7) / (88 - 15); this.scroll = Math.max(0, Math.min(Math.max(0, this.rows - 5), Math.round(f * (this.rows - 5)))); } }
  mouseUp() { this.dragBar = false; }
  onClose() { this.cursor = null; }
  key(e) { if (TABS[this.tab][0] === 'search' && e.key !== 'Escape') { if (e.key === 'Backspace') { this.query = this.query.slice(0, -1); this.refresh(); return true; } if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) { if (this.query.length < 30) this.query += e.key; this.refresh(); return true; } }
    return super.key(e); }
  drawTab(ctx, i, sel) { const [x, y, w, h] = this.tabRect(i); const top = i < 6;
    ctx.fillStyle = '#000'; ctx.fillRect(x + 1, y, w - 2, h); ctx.fillRect(x, y + 1, w, h - 2);
    ctx.fillStyle = sel ? '#c6c6c6' : '#a0a0a0'; ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
    ctx.fillStyle = sel ? '#ffffff' : '#c8c8c8'; ctx.fillRect(x + 1, y + 1, w - 3, 2); ctx.fillRect(x + 1, y + 1, 2, h - 3);
    ctx.fillStyle = sel ? '#555555' : '#6a6a6a'; ctx.fillRect(x + w - 3, y + 2, 2, h - 3); if (!top) ctx.fillRect(x + 2, y + h - 3, w - 4, 2);
    if (sel) { ctx.fillStyle = '#c6c6c6'; if (top) ctx.fillRect(x + 1, y + h - 6, w - 2, 7); else ctx.fillRect(x + 1, y - 1, w - 2, 7); }
    const ic = TABS[i][2]; drawItem(ctx, norm(ic), x + 6, y + (top ? 9 : 10), false); }
  draw(ctx, mx, my) {
    for (let i = 0; i < TABS.length; i++) if (i !== this.tab) this.drawTab(ctx, i, false);
    drawPanel(ctx, this.ox, this.oy, this.W, this.H); this.drawTab(ctx, this.tab, true);
    const k = TABS[this.tab][0];
    if (this.survival) { ctx.fillStyle = '#000'; ctx.fillRect(this.ox + 8, this.oy + 5, 34, 46); drawPlayerPreview(ctx, this.gui.game, this.ox + 9, this.oy + 6, 32, 44, mx, my, this.gui.scale);
      ctx.fillStyle = '#8b8b8b'; drawSlot(ctx, this.ox + 172, this.oy + 111); ctx.fillStyle = '#c03030'; ctx.fillRect(this.ox + 176, this.oy + 115, 8, 8); ctx.fillStyle = '#8b8b8b'; ctx.fillRect(this.ox + 178, this.oy + 117, 4, 4); }
    else { drawText(ctx, TABS[this.tab][1], this.ox + 8, this.oy + 6, '#404040', false);
      if (k === 'search') { const bx = this.ox + 82, by = this.oy + 5; ctx.fillStyle = '#000'; ctx.fillRect(bx, by, 89, 10); ctx.fillStyle = '#a0a0a0'; ctx.fillRect(bx, by, 89, 1); drawText(ctx, this.query + ((performance.now() / 300 | 0) % 2 ? '_' : ''), bx + 2, by + 1, '#ffffff'); }
      const sx = this.ox + 175, sy = this.oy + 18; ctx.fillStyle = '#000'; ctx.fillRect(sx, sy, 12, 88); ctx.fillStyle = '#8b8b8b'; ctx.fillRect(sx + 1, sy + 1, 10, 86);
      const can = this.rows > 5; const ky = sy + 1 + Math.round(this.scroll / Math.max(1, this.rows - 5) * (86 - 15)); ctx.fillStyle = can ? '#ffffff' : '#a0a0a0'; ctx.fillRect(sx + 1, ky, 10, 15); ctx.fillStyle = can ? '#c6c6c6' : '#8b8b8b'; ctx.fillRect(sx + 2, ky + 1, 9, 14); ctx.fillStyle = '#555'; ctx.fillRect(sx + 10, ky + 1, 1, 14); ctx.fillRect(sx + 2, ky + 14, 9, 1); }
    this.drawSlots(ctx, mx, my); super.draw(ctx, mx, my);
    if (!this.cursor) for (let i = 0; i < TABS.length; i++) { const [x, y, w, h] = this.tabRect(i); if (mx >= x && mx < x + w && my >= y && my < y + h) { drawTooltip(ctx, TABS[i][1], mx, my); return; } }
    this.drawCursor(ctx, mx, my); }
}
