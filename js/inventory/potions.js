// Potions (1.7-style): potion item 373 with dmg = type | 64 when splash, status effects and brewing-stand recipes
export const SPLASH = 64;
// key, name, liquid colour, effect, duration (ticks), instant amount
export const POTIONS = [
  ['water', 'Water Bottle', 0x385dc6],
  ['awkward', 'Awkward Potion', 0x385dc6],
  ['thick', 'Thick Potion', 0x385dc6],
  ['mundane', 'Mundane Potion', 0x385dc6],
  ['healing', 'Potion of Healing', 0xf82423, 'heal', 0, 4],
  ['regeneration', 'Potion of Regeneration', 0xcd5cab, 'regeneration', 900],
  ['swiftness', 'Potion of Swiftness', 0x7cafc6, 'speed', 3600],
  ['fire_resistance', 'Potion of Fire Resistance', 0xe49a3a, 'fire_resistance', 3600],
  ['strength', 'Potion of Strength', 0x932423, 'strength', 3600],
  ['poison', 'Potion of Poison', 0x4e9331, 'poison', 900],
  ['harming', 'Potion of Harming', 0x430a09, 'harm', 0, 6],
  ['weakness', 'Potion of Weakness', 0x484d48, 'weakness', 1800],
  ['slowness', 'Potion of Slowness', 0x5a6c81, 'slowness', 1800],
];
export const P = Object.fromEntries(POTIONS.map((p, i) => [p[0], i]));
export const EFFECT_NAMES = { regeneration: 'Regeneration', speed: 'Speed', fire_resistance: 'Fire Resistance', strength: 'Strength', poison: 'Poison', weakness: 'Weakness', slowness: 'Slowness' };
export const EFFECT_COLORS = Object.fromEntries(POTIONS.filter(p => p[4]).map(p => [p[3], p[2]]));
export const potionType = dmg => POTIONS[(dmg | 0) & 63] || POTIONS[0];
export const isSplash = dmg => !!((dmg | 0) & SPLASH);
export function potionName(dmg) { const p = potionType(dmg); if (!isSplash(dmg)) return p[1]; return p[0] === 'water' ? 'Splash Water Bottle' : 'Splash ' + p[1]; }

// ingredient id -> (base potion type -> result type)
const NETHER_WART = 372, GLOWSTONE = 348, REDSTONE = 331, FERM_EYE = 376, BLAZE_POWDER = 377, GLISTER = 382, GUNPOWDER = 289;
const FROM_AWKWARD = { 382: 'healing', 370: 'regeneration', 353: 'swiftness', 378: 'fire_resistance', 377: 'strength', 375: 'poison' };
const CORRUPT = { healing: 'harming', poison: 'harming', swiftness: 'slowness', fire_resistance: 'slowness', strength: 'weakness', regeneration: 'weakness', water: 'weakness' };
export const INGREDIENTS = new Set([NETHER_WART, GLOWSTONE, REDSTONE, FERM_EYE, BLAZE_POWDER, GLISTER, GUNPOWDER, 370, 353, 378, 375]);
// result dmg for brewing the ingredient into a potion with this dmg, or null when nothing happens
export function brew(dmg, ing) {
  const t = potionType(dmg)[0], splash = (dmg | 0) & SPLASH;
  if (ing === GUNPOWDER) return splash ? null : (dmg | 0) | SPLASH;
  let r = null;
  if (t === 'water') r = ing === NETHER_WART ? 'awkward' : ing === GLOWSTONE ? 'thick' : ing === FERM_EYE ? 'weakness' : [REDSTONE, BLAZE_POWDER, GLISTER, 370, 353, 378, 375].includes(ing) ? 'mundane' : null;
  else if (t === 'awkward') r = FROM_AWKWARD[ing] || null;
  else if (ing === FERM_EYE) r = CORRUPT[t] || null;
  return r === null ? null : P[r] | splash;
}

// ---- status effects (on the player: p.effects = { name: { t } }) ----
export function applyPotion(target, dmg, scale = 1, isPlayer = true, g = null) {
  const p = potionType(dmg); const eff = p[3]; if (!eff) return;
  if (eff === 'heal') { if (isPlayer) target.health = Math.min(20, target.health + Math.round(p[5] * scale)); else target.hp = Math.min(target.T.hp, target.hp + Math.round(p[5] * scale)); return; }
  if (eff === 'harm') { const n = Math.max(1, Math.round(p[5] * scale)); if (isPlayer) target.damage(n, 'magic'); else target.hurt(n, 'magic', null, g); return; }
  const t = Math.round(p[4] * (isSplash(dmg) ? 0.75 : 1) * scale); if (t < 20) return;
  target.effects = target.effects || {}; const cur = target.effects[eff]; if (!cur || cur.t < t) target.effects[eff] = { t };
}
export const hasEffect = (e, name) => !!(e.effects && e.effects[name] && e.effects[name].t > 0);
// one tick of effects; hurt(n) and heal(n) apply damage/healing to the entity
export function tickEffects(e, hurt, heal) {
  if (!e.effects) return; for (const k in e.effects) { const f = e.effects[k]; f.t--;
    if (k === 'regeneration' && f.t % 50 === 0) heal(1);
    if (k === 'poison' && f.t % 25 === 0) hurt(1);
    if (f.t <= 0) delete e.effects[k]; }
}
export function effectTime(t) { const s = Math.ceil(t / 20); return (s / 60 | 0) + ':' + String(s % 60).padStart(2, '0'); }
