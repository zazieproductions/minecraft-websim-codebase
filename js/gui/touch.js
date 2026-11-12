// Touch controls for phones/tablets: movement, look, attack, use, crafting, chat and inventory
import * as Screens from './screens.js';
import { items } from '../inventory/items.js';

const svg = (d, s = 24) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}"><polyline points="${d}" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="square" stroke-linejoin="miter"/></svg>`;
const ARROW = { up: '6,15 12,8 18,15', down: '6,9 12,16 18,9', left: '15,6 8,12 15,18', right: '9,6 16,12 9,18' };

export class TouchControls {
  constructor(game) {
    this.g = game; this.enabled = matchMedia('(pointer: coarse)').matches; this.state = {}; this.pressRelease = []; game.touchInput = this.state;
    const root = this.root = document.createElement('div'); root.id = 'touch'; root.hidden = true;
    root.innerHTML = `<div class="t-look"></div>
      <button class="t-btn t-back" aria-label="Pause"><svg viewBox="0 0 24 24" width="20" height="20"><path d="M10 6 L4 12 L10 18 M4 12 H20" fill="none" stroke="#fff" stroke-width="2.4"/></svg></button>
      <button class="t-btn t-chat" aria-label="Chat">Chat</button>
      <button class="t-btn t-craft" aria-label="Craft">Craft</button>
      <button class="t-btn t-inv" aria-label="Inventory">Inv</button>
      <div class="t-dpad"><span class="up">${svg(ARROW.up)}</span><span class="left">${svg(ARROW.left)}</span><span class="right">${svg(ARROW.right)}</span><span class="down">${svg(ARROW.down)}</span></div>
      <button class="t-btn t-attack" aria-label="Attack">Hit</button>
      <button class="t-btn t-sneak" aria-label="Toggle sneak" aria-pressed="false">Sneak</button>
      <button class="t-btn t-use" aria-label="Use item or place block">Use</button>
      <button class="t-btn t-jump" aria-label="Jump">${svg(ARROW.up, 28)}</button>`;
    document.body.appendChild(root);
    addEventListener('touchstart', () => { this.enabled = true; }, { capture: true, passive: true });
    this.bindLook(root.querySelector('.t-look'));
    this.bindDpad(root.querySelector('.t-dpad'));
    const tap = (el, fn) => el.addEventListener('touchstart', e => { e.preventDefault(); fn(); }, { passive: false });
    tap(root.querySelector('.t-back'), () => game.pause());
    tap(root.querySelector('.t-inv'), () => { game.achievements.unlock('openInventory'); const rm = game.player.riding; if (rm && rm.type === 'horse' && rm.tame) return game.openHorse(rm); game.gui.open(game.player.creative ? new Screens.CreativeInventory() : new Screens.PlayerInventory()); });
    tap(root.querySelector('.t-craft'), () => game.gui.open(new Screens.Workbench()));
    tap(root.querySelector('.t-chat'), () => this.openChat());
    this.bindPress(root.querySelector('.t-attack'), () => { game.clickLeft = true; game.mouse.left = true; }, () => { game.mouse.left = false; });
    tap(root.querySelector('.t-use'), () => { game.clickRight = true; game.mouse.right = true; setTimeout(() => { game.mouse.right = false; }, 100); });
    const sneak = root.querySelector('.t-sneak');
    tap(sneak, () => { this.state.sneak = !this.state.sneak; sneak.classList.toggle('on', this.state.sneak); sneak.setAttribute('aria-pressed', String(this.state.sneak)); });
    const jump = root.querySelector('.t-jump');
    jump.addEventListener('touchstart', e => { e.preventDefault(); this.state.jump = true; game.input.jumpPressed = true; jump.classList.add('on'); }, { passive: false });
    const up = e => { e.preventDefault(); this.state.jump = false; jump.classList.remove('on'); };
    jump.addEventListener('touchend', up); jump.addEventListener('touchcancel', up);
    const loop = () => { this.update(); requestAnimationFrame(loop); }; requestAnimationFrame(loop);
  }
  get active() { const g = this.g; return this.enabled && g.world && g.player && !g.gui.screen && !g.loadingWorld; }
  update() {
    const on = !!this.active; if (this.root.hidden === on) this.root.hidden = !on;
    if (!on) this.reset();
    if (this.chatInput && this.g.gui.screen !== this.chatScreen) this.hideChatInput();
  }
  openChat() {
    const screen = new Screens.Chat(''); this.g.gui.open(screen);
    if (!this.enabled) return;
    this.hideChatInput(); const input = this.chatInput = document.createElement('input'); this.chatScreen = screen;
    input.className = 't-chat-input'; input.type = 'text'; input.maxLength = 100; input.autocomplete = 'off'; input.spellcheck = false; input.enterKeyHint = 'send';
    input.addEventListener('input', () => { screen.f.value = input.value; });
    input.addEventListener('keydown', e => {
      e.stopPropagation();
      if (e.key === 'Enter') { e.preventDefault(); const message = input.value.trim(); if (message) this.g.command(message); this.g.gui.open(null); this.hideChatInput(); }
      else if (e.key === 'Escape') { e.preventDefault(); this.g.gui.open(null); this.hideChatInput(); }
    });
    document.body.appendChild(input); input.focus();
  }
  hideChatInput() { if (this.chatInput) this.chatInput.remove(); this.chatInput = this.chatScreen = null; }
  reset() {
    const s = this.state; if (Object.values(s).some(Boolean)) { for (const k in s) s[k] = false; this.root.querySelectorAll('.on').forEach(e => e.classList.remove('on')); this.root.querySelector('.t-sneak').setAttribute('aria-pressed', 'false'); }
    for (const release of this.pressRelease) release();
    if (this.look) { this.endLook(false); }
  }
  // ---------- d-pad: 3x3 zones, corners move diagonally, finger can slide between arrows ----------
  bindDpad(el) {
    let id = null; const spans = { forward: el.querySelector('.up'), back: el.querySelector('.down'), left: el.querySelector('.left'), right: el.querySelector('.right') };
    const set = (t) => { const s = this.state; const r = el.getBoundingClientRect();
      const cx = t ? Math.floor((t.clientX - r.left) / r.width * 3) : 1, cy = t ? Math.floor((t.clientY - r.top) / r.height * 3) : 1;
      s.forward = !!t && cy <= 0; s.back = !!t && cy >= 2; s.left = !!t && cx <= 0; s.right = !!t && cx >= 2;
      for (const k in spans) spans[k].classList.toggle('on', s[k]); };
    const find = e => [...e.changedTouches].find(t => t.identifier === id);
    el.addEventListener('touchstart', e => { e.preventDefault(); if (id !== null) return; const t = e.changedTouches[0]; id = t.identifier; const was = this.state.forward; set(t); if (this.state.forward && !was) this.g.input.forwardPressed = true; }, { passive: false });
    el.addEventListener('touchmove', e => { e.preventDefault(); const t = find(e); if (t) { const was = this.state.forward; set(t); if (this.state.forward && !was) this.g.input.forwardPressed = true; } }, { passive: false });
    const end = e => { if (find(e)) { id = null; set(null); } };
    el.addEventListener('touchend', end); el.addEventListener('touchcancel', end);
  }
  // ---------- look / interact ----------
  bindLook(el) {
    const g = this.g;
    el.addEventListener('touchstart', e => { e.preventDefault();
      for (const t of e.changedTouches) {
        if (this.hotbarTap(t)) continue;
        if (this.look) continue;
        this.look = { id: t.identifier, x: t.clientX, y: t.clientY, sx: t.clientX, sy: t.clientY, t0: performance.now(), moved: false, held: false };
        this.look.timer = setTimeout(() => this.startHold(), 280);
      } }, { passive: false });
    el.addEventListener('touchmove', e => { e.preventDefault(); const L = this.look; if (!L) return;
      for (const t of e.changedTouches) { if (t.identifier !== L.id) continue;
        const dx = t.clientX - L.x, dy = t.clientY - L.y; L.x = t.clientX; L.y = t.clientY;
        if (Math.hypot(t.clientX - L.sx, t.clientY - L.sy) > 12 && !L.held) { L.moved = true; clearTimeout(L.timer); }
        const p = g.player; if (!p) return; const s = 0.004 * (0.4 + g.settings.sensitivity * 1.2);
        p.yaw -= dx * s; p.pitch -= dy * s * (g.settings.invert ? -1 : 1); p.pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, p.pitch)); } }, { passive: false });
    const end = e => { const L = this.look; if (!L) return; for (const t of e.changedTouches) if (t.identifier === L.id) this.endLook(!L.moved && !L.held); };
    el.addEventListener('touchend', end); el.addEventListener('touchcancel', e => { if (this.look) this.endLook(false); });
  }
  bindPress(el, down, up) {
    let id = null;
    const find = e => [...e.changedTouches].some(t => t.identifier === id);
    const end = e => { if (id === null || !find(e)) return; id = null; el.classList.remove('on'); up(); };
    el.addEventListener('touchstart', e => { e.preventDefault(); if (id !== null) return; id = e.changedTouches[0].identifier; el.classList.add('on'); down(); }, { passive: false });
    el.addEventListener('touchend', end); el.addEventListener('touchcancel', end);
    this.pressRelease.push(() => { if (id !== null) { id = null; el.classList.remove('on'); up(); } });
  }
  holdUses() { const h = this.g.player?.inv.held; const it = h && items[h.id]; return !!(it && (it.food || h.id === 261)); } // food & bow: hold = use
  startHold() { const L = this.look; if (!L || L.moved) return; L.held = true; const g = this.g;
    if (this.holdUses()) { g.mouse.right = true; g.clickRight = true; }
    else { g.updateTarget?.(); if (g.target && g.target.entity) g.clickLeft = true; g.mouse.left = true; } }
  endLook(tap) { const L = this.look; if (!L) return; clearTimeout(L.timer); this.look = null; const g = this.g;
    g.mouse.left = false; g.mouse.right = false;
    if (tap && g.player && !g.gui.screen) {
      if (g.target && g.target.entity) g.clickLeft = true;
      else { g.mouse.right = true; g.clickRight = true; setTimeout(() => { if (!this.look || !this.look.held) g.mouse.right = false; }, 70); }
    } }
  hotbarTap(t) { const g = this.g, gui = g.gui; if (!g.player) return false; const x = t.clientX / gui.scale, y = t.clientY / gui.scale;
    const hx = Math.floor(gui.w / 2) - 91; if (y < gui.h - 23 || x < hx || x >= hx + 182) return false;
    g.player.inv.selected = Math.min(8, Math.floor((x - hx) / 20)); return true; }
}
