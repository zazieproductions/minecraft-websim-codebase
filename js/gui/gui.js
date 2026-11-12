// Canvas-based immediate GUI in scaled "GUI pixels", like the 2012 client
import { drawText, drawTextCentered, textWidth } from './font.js';
import { buildAtlas, tileIndex, COLS } from '../engine/textures.js';
import { PACK, crop } from '../engine/pack.js';
import { Sound } from '../engine/audio.js';

let btnTex = null;
function makeBtn(state) { // 0 disabled, 1 normal, 2 hover
  const cv = document.createElement('canvas'); cv.width = 200; cv.height = 20; const x = cv.getContext('2d');
  let s = 77; const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const base = state === 0 ? [44, 44, 44] : state === 2 ? [126, 136, 191] : [111, 111, 111];
  for (let yy = 0; yy < 20; yy++) for (let xx = 0; xx < 200; xx++) { const n = (r() - 0.5) * 14; x.fillStyle = 'rgb(' + base.map(v => Math.max(0, Math.min(255, v + n | 0))) + ')'; x.fillRect(xx, yy, 1, 1); }
  const hi = state === 0 ? 'rgba(255,255,255,0.08)' : state === 2 ? '#bcc4f2' : '#aaaaaa', lo = state === 0 ? 'rgba(0,0,0,0.3)' : state === 2 ? '#5a6499' : '#565656';
  x.fillStyle = hi; x.fillRect(1, 1, 198, 1); x.fillRect(1, 1, 1, 17);
  x.fillStyle = lo; x.fillRect(1, 17, 198, 2); x.fillRect(198, 2, 1, 16);
  x.strokeStyle = state === 2 ? '#ffffff' : '#000000'; x.lineWidth = 1; x.strokeRect(0.5, 0.5, 199, 19);
  if (state !== 2) { x.fillStyle = '#000'; x.fillRect(0, 0, 200, 1); x.fillRect(0, 19, 200, 1); x.fillRect(0, 0, 1, 20); x.fillRect(199, 0, 1, 20); }
  return cv;
}
export function drawButtonBg(ctx, x, y, w, h, state) {
  if (!btnTex) btnTex = PACK.gui ? [0, 1, 2].map(s => crop('gui', 0, 46 + s * 20, 200, 20)) : [makeBtn(0), makeBtn(1), makeBtn(2)];
  const t = btnTex[state]; const hw = Math.floor(w / 2);
  ctx.drawImage(t, 0, 0, hw, h - 2, x, y, hw, h - 2); ctx.drawImage(t, 200 - (w - hw), 0, w - hw, h - 2, x + hw, y, w - hw, h - 2);
  ctx.drawImage(t, 0, 18, hw, 2, x, y + h - 2, hw, 2); ctx.drawImage(t, 200 - (w - hw), 18, w - hw, 2, x + hw, y + h - 2, w - hw, 2);
}
export function drawPanel(ctx, x, y, w, h) { // classic inventory window
  ctx.fillStyle = '#000'; ctx.fillRect(x + 1, y, w - 2, h); ctx.fillRect(x, y + 1, w, h - 2);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 1, y + 1, w - 3, h - 3);
  ctx.fillStyle = '#555555'; ctx.fillRect(x + 3, y + 3, w - 4, h - 4);
  ctx.fillStyle = '#c6c6c6'; ctx.fillRect(x + 3, y + 3, w - 6, h - 6);
}
export function drawSlot(ctx, x, y) { ctx.fillStyle = '#373737'; ctx.fillRect(x, y, 18, 18); ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 1, y + 1, 17, 17); ctx.fillStyle = '#8b8b8b'; ctx.fillRect(x + 1, y + 1, 16, 16); }
let dirtPat = null;
export function drawDirtBg(ctx, w, h, dark = 0.25) {
  if (!dirtPat) { const cv = document.createElement('canvas'); cv.width = cv.height = 32; const c = cv.getContext('2d'); c.imageSmoothingEnabled = false; const i = tileIndex('dirt'); c.drawImage(buildAtlas(), (i % COLS) * 16, Math.floor(i / COLS) * 16, 16, 16, 0, 0, 32, 32); dirtPat = ctx.createPattern(cv, 'repeat'); }
  ctx.fillStyle = dirtPat; ctx.fillRect(0, 0, w, h); ctx.fillStyle = 'rgba(0,0,0,' + (1 - dark) + ')'; ctx.fillRect(0, 0, w, h);
}

export class Button {
  constructor(id, x, y, w, h, label, onClick) { Object.assign(this, { id, x, y, w, h, label, onClick, enabled: true, visible: true }); }
  hover(mx, my) { return mx >= this.x && my >= this.y && mx < this.x + this.w && my < this.y + this.h; }
  draw(ctx, mx, my) { if (!this.visible) return; const hv = this.enabled && this.hover(mx, my); drawButtonBg(ctx, this.x, this.y, this.w, this.h, this.enabled ? (hv ? 2 : 1) : 0);
    const l = typeof this.label === 'function' ? this.label() : this.label; drawTextCentered(ctx, l, this.x + this.w / 2, this.y + (this.h - 8) / 2, !this.enabled ? '#a0a0a0' : hv ? '#ffffa0' : '#e0e0e0'); }
  click(mx, my) { if (this.visible && this.enabled && this.hover(mx, my)) { Sound.play('click'); this.onClick && this.onClick(this); return true; } return false; }
}
export class Slider extends Button {
  constructor(id, x, y, w, h, get, set, label) { super(id, x, y, w, h, () => label(get())); this.get = get; this.set = set; this.drag = false; }
  draw(ctx, mx, my) { drawButtonBg(ctx, this.x, this.y, this.w, this.h, 0); const v = this.get(); const kx = this.x + Math.round(v * (this.w - 8)); drawButtonBg(ctx, kx, this.y, 8, this.h, 1);
    drawTextCentered(ctx, this.label(), this.x + this.w / 2, this.y + (this.h - 8) / 2, this.hover(mx, my) ? '#ffffa0' : '#e0e0e0'); }
  click(mx, my) { if (this.hover(mx, my)) { this.drag = true; this.move(mx); Sound.play('click'); return true; } return false; }
  move(mx) { if (this.drag) this.set(Math.max(0, Math.min(1, (mx - this.x - 4) / (this.w - 8)))); }
}
export class TextField {
  constructor(x, y, w, h, value = '', max = 32) { Object.assign(this, { x, y, w, h, value, max, focused: false, t: 0 }); }
  draw(ctx) { ctx.fillStyle = '#a0a0a0'; ctx.fillRect(this.x - 1, this.y - 1, this.w + 2, this.h + 2); ctx.fillStyle = '#000'; ctx.fillRect(this.x, this.y, this.w, this.h);
    this.t++; let s = this.value; while (textWidth(s) > this.w - 10 && s.length) s = s.slice(1);
    drawText(ctx, s + (this.focused && (this.t >> 4) % 2 ? '_' : ''), this.x + 4, this.y + (this.h - 8) / 2, '#e0e0e0'); }
  click(mx, my) { this.focused = mx >= this.x && my >= this.y && mx < this.x + this.w && my < this.y + this.h; return this.focused; }
  key(e) { if (!this.focused) return false; if (e.key === 'Backspace') this.value = this.value.slice(0, -1); else if (e.key === 'v' && (e.ctrlKey || e.metaKey)) { navigator.clipboard?.readText().then(t => this.value = (this.value + t).slice(0, this.max)); } else if (e.key.length === 1 && this.value.length < this.max && !e.ctrlKey) this.value += e.key; else return false; return true; }
}

export class Screen {
  constructor() { this.buttons = []; this.fields = []; this.pausesGame = true; }
  init(gui) { this.gui = gui; this.w = gui.w; this.h = gui.h; this.buttons = []; this.fields = []; this.layout(); }
  layout() {}
  drawBackground(ctx) { if (this.gui.game.world) { const g = ctx.createLinearGradient(0, 0, 0, this.h); g.addColorStop(0, 'rgba(16,16,16,0.75)'); g.addColorStop(1, 'rgba(16,16,16,0.82)'); ctx.fillStyle = g; ctx.fillRect(0, 0, this.w, this.h); } else drawDirtBg(ctx, this.w, this.h); }
  draw(ctx, mx, my) { for (const b of this.buttons) b.draw(ctx, mx, my); for (const f of this.fields) f.draw(ctx); }
  mouseDown(mx, my, btn) { if (btn !== 0) return; for (const f of this.fields) f.click(mx, my); for (const b of this.buttons) if (b.click(mx, my)) return true; }
  mouseMove(mx, my) { for (const b of this.buttons) if (b.move) b.move(mx); }
  mouseUp() { for (const b of this.buttons) b.drag = false; }
  key(e) { for (const f of this.fields) if (f.key(e)) return true; if (e.key === 'Escape') { this.close(); return true; } }
  wheel() {}
  close() { this.gui.open(null); }
  tick() {}
}

export class GUI {
  constructor(game, canvas) {
    this.game = game; this.cv = canvas; this.ctx = canvas.getContext('2d'); this.screen = null; this.mx = 0; this.my = 0; this.scaleSetting = 0;
    this.resize(); addEventListener('resize', () => { this.resize(); if (this.screen) this.screen.init(this); });
    canvas.addEventListener('mousemove', e => { this.mx = e.clientX / this.scale; this.my = e.clientY / this.scale; this.screen && this.screen.mouseMove(this.mx, this.my); });
    canvas.addEventListener('mousedown', e => { if (this.screen) { e.preventDefault(); this.screen.mouseDown(this.mx, this.my, e.button, e.shiftKey); } });
    addEventListener('mouseup', e => { this.screen && this.screen.mouseUp(this.mx, this.my, e.button); });
    let touch = null;
    const touchPos = t => { this.mx = t.clientX / this.scale; this.my = t.clientY / this.scale; };
    canvas.addEventListener('touchstart', e => {
      if (!this.screen || touch) return; e.preventDefault(); const t = e.changedTouches[0]; touchPos(t);
      touch = { id: t.identifier, screen: this.screen, x: t.clientX, y: t.clientY, moved: false };
      touch.screen.mouseDown(this.mx, this.my, 0, false);
    }, { passive: false });
    addEventListener('touchmove', e => {
      if (!touch) return; const t = [...e.changedTouches].find(x => x.identifier === touch.id); if (!t) return; e.preventDefault(); touchPos(t);
      if (Math.hypot(t.clientX - touch.x, t.clientY - touch.y) > 7) touch.moved = true;
      touch.screen.mouseMove(this.mx, this.my);
    }, { passive: false });
    const endTouch = (e, canceled = false) => {
      if (!touch) return; const t = [...e.changedTouches].find(x => x.identifier === touch.id); if (!t) return; e.preventDefault(); touchPos(t);
      const drag = touch; touch = null;
      if (!canceled && drag.moved && this.screen === drag.screen && drag.screen.cursor && !drag.screen.dragBar) drag.screen.mouseDown(this.mx, this.my, 0, false);
      drag.screen.mouseUp(this.mx, this.my, 0);
    };
    addEventListener('touchend', e => endTouch(e), { passive: false });
    addEventListener('touchcancel', e => endTouch(e, true), { passive: false });
    canvas.addEventListener('wheel', e => { if (this.screen) this.screen.wheel(Math.sign(e.deltaY)); }, { passive: true });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
  }
  resize() {
    const W = innerWidth, H = innerHeight; let s = 1; const max = this.scaleSetting || 1000;
    while (s < max && W / (s + 1) >= 320 && H / (s + 1) >= 240) s++;
    this.scale = s; this.cv.width = W; this.cv.height = H; this.w = Math.ceil(W / s); this.h = Math.ceil(H / s);
    this.ctx.imageSmoothingEnabled = false;
  }
  setScale(n) { this.scaleSetting = n; this.resize(); if (this.screen) this.screen.init(this); }
  open(screen) {
    if (this.screen && this.screen.onClose) this.screen.onClose();
    this.screen = screen; if (screen) screen.init(this);
    this.cv.style.pointerEvents = screen ? 'auto' : 'none';
    this.game.onScreenChange(screen);
  }
  frame() {
    const ctx = this.ctx; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, this.cv.width, this.cv.height);
    ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0); ctx.imageSmoothingEnabled = false;
    if (this.game.world && this.game.hud) this.game.hud.draw(ctx, this.w, this.h, !!this.screen);
    if (this.screen) { this.screen.drawBackground(ctx); this.screen.draw(ctx, this.mx, this.my); }
    if (this.game.world) this.game.achievements.drawToast(ctx, this.w);
  }
}
