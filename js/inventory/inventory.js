// Inventory model: 36 main slots (0-8 hotbar) + 4 armor slots
import { maxStack, items } from './items.js';
export const stack = (id, count = 1, dmg = 0) => ({ id, count, dmg });
export class Inventory {
  constructor() { this.slots = new Array(36).fill(null); this.armor = new Array(4).fill(null); this.selected = 0; }
  get held() { return this.slots[this.selected]; }
  add(s) { // returns leftover count
    let left = s.count; const ms = maxStack(s.id);
    const order = [...Array(36).keys()];
    for (const i of order) { const t = this.slots[i]; if (t && t.id === s.id && t.dmg === s.dmg && t.count < ms && !items[s.id]?.durability) { const n = Math.min(ms - t.count, left); t.count += n; left -= n; if (!left) return 0; } }
    for (const i of order) if (!this.slots[i]) { const n = Math.min(ms, left); this.slots[i] = stack(s.id, n, s.dmg); left -= n; if (!left) return 0; }
    return left;
  }
  consumeHeld(n = 1) { const h = this.held; if (!h) return; h.count -= n; if (h.count <= 0) this.slots[this.selected] = null; }
  count(id) { let c = 0; for (const s of this.slots) if (s && s.id === id) c += s.count; return c; }
  remove(id, n) { for (let i = 0; i < 36 && n > 0; i++) { const s = this.slots[i]; if (s && s.id === id) { const k = Math.min(n, s.count); s.count -= k; n -= k; if (!s.count) this.slots[i] = null; } } }
  armorPoints() { let p = 0; for (const a of this.armor) if (a) p += items[a.id]?.armorPts || 0; return p; }
  toJSON() { return { slots: this.slots, armor: this.armor, selected: this.selected }; }
  load(d) { if (!d) return; this.slots = d.slots.slice(0, 36); while (this.slots.length < 36) this.slots.push(null); this.armor = d.armor || [null, null, null, null]; this.selected = d.selected || 0; }
}
