// Item registry (classic 1.2.5 numeric IDs) + procedural pixel icons
import { blocks as BL, SH, SHAPE } from '../world/blocks.js';
import { buildAtlas, tileIndex, COLS } from '../engine/textures.js';
import { cell, PACK } from '../engine/pack.js';
import { potionName, potionType, isSplash } from './potions.js';

export const items = {}; export const I = {};
function reg(id, key, o = {}) { const it = Object.assign({ id, key, name: o.name || key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), stack: 64 }, o); items[id] = it; I[key.toUpperCase()] = id; return it; }

const MAT = { wood: { lvl: 1, speed: 2, dur: 59, dmg: 0, c: [[104,78,47],[150,116,65],[188,152,98]] }, stone: { lvl: 2, speed: 4, dur: 131, dmg: 1, c: [[82,82,82],[127,127,127],[160,160,160]] },
  iron: { lvl: 3, speed: 6, dur: 250, dmg: 2, c: [[110,110,110],[216,216,216],[255,255,255]] }, diamond: { lvl: 4, speed: 8, dur: 1561, dmg: 3, c: [[18,120,108],[51,235,203],[160,255,240]] },
  gold: { lvl: 1, speed: 12, dur: 32, dmg: 0, c: [[150,120,20],[234,238,87],[255,255,180]] } };
const tools = [['shovel', [269, 273, 256, 277, 284]], ['pickaxe', [270, 274, 257, 278, 285]], ['axe', [271, 275, 258, 279, 286]], ['sword', [268, 272, 267, 276, 283]], ['hoe', [290, 291, 292, 293, 294]]];
const mats = ['wood', 'stone', 'iron', 'diamond', 'gold'];
for (const [type, ids] of tools) ids.forEach((id, i) => { const m = MAT[mats[i]]; const mn = mats[i] === 'wood' ? 'Wooden' : mats[i] === 'gold' ? 'Golden' : mats[i][0].toUpperCase() + mats[i].slice(1);
  reg(id, mats[i] + '_' + type, { name: mn + ' ' + type[0].toUpperCase() + type.slice(1), stack: 1, tool: type, mat: mats[i], level: m.lvl, speed: m.speed, durability: m.dur, damage: type === 'sword' ? 4 + m.dmg : type === 'axe' ? 3 + m.dmg : type === 'pickaxe' ? 2 + m.dmg : type === 'shovel' ? 1 + m.dmg : 1, icon: { tool: type, mat: mats[i] } }); });
reg(259, 'flint_and_steel', { name: 'Flint and Steel', stack: 1, durability: 64, icon: { shape: 'flintsteel' } });
reg(260, 'apple', { food: 4, sat: 0.3, icon: { shape: 'apple', c: [200, 20, 20] } });
reg(261, 'bow', { stack: 1, durability: 384, icon: { shape: 'bow' } });
reg(262, 'arrow', { icon: { shape: 'arrow' } });
reg(263, 'coal', { fuel: 1600, icon: { shape: 'lump', c: [40, 40, 40] } });
reg(264, 'diamond', { icon: { shape: 'gem', c: [90, 230, 220] } });
reg(265, 'iron_ingot', { name: 'Iron Ingot', icon: { shape: 'ingot', c: [216, 216, 216] } });
reg(266, 'gold_ingot', { name: 'Gold Ingot', icon: { shape: 'ingot', c: [250, 230, 80] } });
reg(280, 'stick', { fuel: 100, icon: { shape: 'stick' } });
reg(281, 'bowl', { icon: { shape: 'bowl' } });
reg(282, 'mushroom_stew', { name: 'Mushroom Stew', stack: 1, food: 6, sat: 0.6, returns: 281, icon: { shape: 'bowl', fill: [200, 150, 100] } });
reg(287, 'string', { icon: { shape: 'string' } });
reg(288, 'feather', { icon: { shape: 'feather' } });
reg(289, 'gunpowder', { name: 'Gunpowder', icon: { shape: 'dust', c: [90, 90, 90] } });
reg(295, 'seeds', { places: 59, placeOn: [60], icon: { shape: 'seeds', c: [60, 150, 40] } });
reg(296, 'wheat', { icon: { shape: 'wheat' } });
reg(297, 'bread', { food: 5, sat: 0.6, icon: { shape: 'bread' } });
const armorNames = ['helmet', 'chestplate', 'leggings', 'boots'];
const armorMats = [['leather', 298, [1, 3, 2, 1], 5, [160, 100, 60]], ['chain', 302, [2, 5, 4, 1], 15, [170, 170, 170]], ['iron', 306, [2, 6, 5, 2], 15, [220, 220, 220]], ['diamond', 310, [3, 8, 6, 3], 33, [90, 230, 220]], ['gold', 314, [2, 5, 3, 1], 7, [250, 230, 80]]];
const armorMul = [11, 16, 15, 13];
for (const [m, base, pts, dm, c] of armorMats) armorNames.forEach((n, i) => reg(base + i, m + '_' + n, { name: (m === 'leather' ? 'Leather ' + ['Cap', 'Tunic', 'Pants', 'Boots'][i] : (m === 'gold' ? 'Golden' : m[0].toUpperCase() + m.slice(1)) + ' ' + n[0].toUpperCase() + n.slice(1)), stack: 1, armor: i, armorPts: pts[i], durability: dm * armorMul[i], icon: { shape: n, c } }));
reg(318, 'flint', { icon: { shape: 'flint' } });
reg(319, 'raw_porkchop', { name: 'Raw Porkchop', food: 3, sat: 0.3, icon: { shape: 'meat', c: [240, 140, 140] } });
reg(320, 'cooked_porkchop', { name: 'Cooked Porkchop', food: 8, sat: 0.8, icon: { shape: 'meat', c: [200, 130, 80] } });
reg(322, 'golden_apple', { name: 'Golden Apple', food: 4, sat: 1.2, icon: { shape: 'apple', c: [250, 220, 50] } });
reg(323, 'sign', { stack: 1, icon: { shape: 'sign' } });
reg(324, 'wooden_door', { name: 'Wooden Door', stack: 1, door: 64, icon: { tile: 'door_wood_lower' } });
reg(330, 'iron_door', { name: 'Iron Door', stack: 1, door: 71, icon: { tile: 'door_iron_lower' } });
reg(325, 'bucket', { stack: 16, icon: { shape: 'bucket' } });
reg(326, 'water_bucket', { name: 'Water Bucket', stack: 1, icon: { shape: 'bucket', fill: [50, 80, 230] } });
reg(327, 'lava_bucket', { name: 'Lava Bucket', stack: 1, fuel: 20000, icon: { shape: 'bucket', fill: [230, 100, 20] } });
reg(328, 'minecart', { stack: 1, icon: { shape: 'minecart' } });
reg(329, 'saddle', { stack: 1, icon: { shape: 'saddle' } });
reg(331, 'redstone', { name: 'Redstone', places: 55, icon: { shape: 'dust', c: [220, 0, 0] } });
reg(356, 'repeater', { name: 'Redstone Repeater', places: 93, icon: { shape: 'ingot', c: [160, 160, 160] } });
reg(332, 'snowball', { stack: 16, icon: { shape: 'ball', c: [250, 250, 250] } });
reg(333, 'boat', { stack: 1, icon: { shape: 'boat' } });
reg(334, 'leather', { icon: { shape: 'leather' } });
reg(335, 'milk_bucket', { name: 'Milk', stack: 1, icon: { shape: 'bucket', fill: [250, 250, 250] } });
reg(336, 'brick', { icon: { shape: 'ingot', c: [180, 90, 60] } });
reg(337, 'clay_ball', { name: 'Clay', icon: { shape: 'ball', c: [160, 166, 178] } });
reg(338, 'sugar_cane', { name: 'Sugar Canes', places: 83, icon: { tile: 'reeds' } });
reg(339, 'paper', { icon: { shape: 'paper' } });
reg(340, 'book', { icon: { shape: 'book' } });
reg(341, 'slimeball', { icon: { shape: 'ball', c: [110, 200, 90] } });
reg(344, 'egg', { stack: 16, icon: { shape: 'egg' } });
reg(345, 'compass', { stack: 1, icon: { shape: 'compass' } });
reg(347, 'clock', { name: 'Watch', stack: 1, icon: { shape: 'clock' } });
reg(348, 'glowstone_dust', { name: 'Glowstone Dust', icon: { shape: 'dust', c: [250, 220, 100] } });
reg(349, 'raw_fish', { name: 'Raw Fish', food: 2, sat: 0.3, icon: { shape: 'fish', c: [110, 150, 170] } });
reg(350, 'cooked_fish', { name: 'Cooked Fish', food: 5, sat: 0.6, icon: { shape: 'fish', c: [200, 160, 110] } });
reg(351, 'lapis', { name: 'Lapis Lazuli', icon: { shape: 'dust', c: [30, 60, 200] } });
reg(352, 'bone', { icon: { shape: 'bone' } });
reg(353, 'sugar', { icon: { shape: 'dust', c: [250, 250, 250] } });
reg(354, 'cake', { stack: 1, icon: { shape: 'cake' } });
reg(355, 'bed', { stack: 1, places: 26, icon: { shape: 'bed' } });
reg(357, 'cookie', { food: 1, sat: 0.1, icon: { shape: 'cookie' } });
reg(359, 'shears', { stack: 1, durability: 238, tool: 'shears', speed: 15, level: 0, icon: { shape: 'shears' } });
reg(360, 'melon_slice', { name: 'Melon', food: 2, sat: 0.3, icon: { shape: 'melon' } });
reg(363, 'raw_beef', { name: 'Raw Beef', food: 3, sat: 0.3, icon: { shape: 'meat', c: [210, 60, 60] } });
reg(364, 'steak', { food: 8, sat: 0.8, icon: { shape: 'meat', c: [140, 80, 40] } });
reg(365, 'raw_chicken', { name: 'Raw Chicken', food: 2, sat: 0.3, icon: { shape: 'drumstick', c: [240, 190, 170] } });
reg(366, 'cooked_chicken', { name: 'Cooked Chicken', food: 6, sat: 0.6, icon: { shape: 'drumstick', c: [210, 150, 80] } });
reg(367, 'rotten_flesh', { name: 'Rotten Flesh', food: 4, sat: 0.1, icon: { shape: 'meat', c: [130, 90, 60] } });
reg(368, 'ender_pearl', { name: 'Ender Pearl', stack: 16, icon: { shape: 'ball', c: [30, 110, 100] } });
reg(369, 'blaze_rod', { name: 'Blaze Rod', fuel: 2400, icon: { shape: 'stick', c: [250, 190, 40] } });
reg(370, 'ghast_tear', { name: 'Ghast Tear', icon: { shape: 'egg', c: [210, 240, 240] } });
reg(371, 'gold_nugget', { name: 'Gold Nugget', icon: { shape: 'lump', c: [250, 230, 80] } });
reg(372, 'nether_wart', { name: 'Nether Wart', places: 115, icon: { shape: 'seeds', c: [150, 30, 30] } });
reg(373, 'potion', { name: 'Potion', stack: 1, potion: true });
reg(374, 'glass_bottle', { name: 'Glass Bottle', icon: { shape: 'ball', c: [200, 220, 240] } });
reg(376, 'fermented_spider_eye', { name: 'Fermented Spider Eye', icon: { shape: 'ball', c: [170, 90, 90] } });
reg(377, 'blaze_powder', { name: 'Blaze Powder', icon: { shape: 'dust', c: [250, 160, 30] } });
reg(379, 'brewing_stand', { name: 'Brewing Stand', places: 117, icon: { shape: 'stick', c: [120, 120, 120] } });
reg(382, 'speckled_melon', { name: 'Glistering Melon', icon: { shape: 'melon' } });
reg(375, 'spider_eye', { name: 'Spider Eye', icon: { shape: 'ball', c: [150, 30, 50] } });
reg(450, 'emerald', { icon: { shape: 'gem', c: [60, 220, 110] } });
reg(378, 'magma_cream', { name: 'Magma Cream', icon: { shape: 'ball', c: [220, 120, 30] } });
reg(361, 'pumpkin_seeds', { name: 'Pumpkin Seeds', icon: { shape: 'seeds', c: [220, 210, 150] } });
reg(362, 'melon_seeds', { name: 'Melon Seeds', icon: { shape: 'seeds', c: [40, 30, 20] } });
reg(391, 'carrot', { food: 3, sat: 0.6, icon: { shape: 'lump', c: [240, 140, 30] } });
reg(396, 'golden_carrot', { name: 'Golden Carrot', food: 6, sat: 1.2, icon: { shape: 'lump', c: [250, 210, 60] } });
reg(392, 'potato', { food: 1, sat: 0.3, icon: { shape: 'lump', c: [200, 160, 80] } });
reg(393, 'baked_potato', { name: 'Baked Potato', food: 5, sat: 0.6, icon: { shape: 'lump', c: [220, 170, 70] } });
reg(394, 'poisonous_potato', { name: 'Poisonous Potato', food: 2, sat: 0.3, poison: 0.6, icon: { shape: 'lump', c: [170, 190, 60] } });
reg(400, 'pumpkin_pie', { name: 'Pumpkin Pie', food: 8, sat: 0.3, icon: { shape: 'cake' } });
reg(405, 'netherbrick', { name: 'Nether Brick', icon: { shape: 'ingot', c: [80, 30, 36] } });
reg(406, 'quartz', { name: 'Nether Quartz', icon: { shape: 'gem', c: [236, 230, 222] } });
reg(420, 'lead', { icon: { shape: 'string' } });
reg(421, 'name_tag', { name: 'Name Tag', icon: { shape: 'paper' } });

// music discs (2256..2267), played in a jukebox
export const RECORD_NAMES = ['13', 'cat', 'blocks', 'chirp', 'far', 'mall', 'mellohi', 'stal', 'strad', 'ward', '11', 'wait'];
const RECORD_COL = [[250, 230, 80], [80, 220, 60], [230, 110, 40], [200, 40, 40], [120, 230, 90], [130, 90, 230], [230, 120, 230], [90, 90, 90], [240, 240, 240], [40, 120, 40], [30, 30, 30], [80, 170, 230]];
RECORD_NAMES.forEach((n, i) => reg(2256 + i, 'record_' + n, { name: 'Music Disc', desc: 'C418 - ' + n, record: n, stack: 1, icon: { shape: 'record', c: RECORD_COL[i] } }));
reg(417, 'iron_horse_armor', { name: 'Iron Horse Armor', stack: 1, horseArmor: 5, icon: { shape: 'horse_armor', c: [220, 220, 220] } });
reg(418, 'golden_horse_armor', { name: 'Gold Horse Armor', stack: 1, horseArmor: 7, icon: { shape: 'horse_armor', c: [250, 230, 80] } });
reg(419, 'diamond_horse_armor', { name: 'Diamond Horse Armor', stack: 1, horseArmor: 11, icon: { shape: 'horse_armor', c: [90, 230, 220] } });

// spawn eggs: one item (383) whose damage value is the vanilla entity id, as in 1.7
export const EGGS = [[50, 'creeper', 'Creeper', 0x0DA70B, 0x000000], [51, 'skeleton', 'Skeleton', 0xC1C1C1, 0x494949], [52, 'spider', 'Spider', 0x342D27, 0xA80E0E], [54, 'zombie', 'Zombie', 0x00AFAF, 0x799C65],
  [55, 'slime', 'Slime', 0x51A03E, 0x7EBF6E], [56, 'ghast', 'Ghast', 0xF9F9F9, 0xBCBCBC], [57, 'zombie_pigman', 'Zombie Pigman', 0xEA9393, 0x4C7129], [58, 'enderman', 'Enderman', 0x161616, 0x000000],
  [59, 'cave_spider', 'Cave Spider', 0x0C424E, 0xA80E0E], [60, 'silverfish', 'Silverfish', 0x6E6E6E, 0x303030], [61, 'blaze', 'Blaze', 0xF6B201, 0xFFF87E], [62, 'magma_cube', 'Magma Cube', 0x340000, 0xFCFC00],
  [65, 'bat', 'Bat', 0x4C3E30, 0x0F0F0F], [66, 'witch', 'Witch', 0x340000, 0x51A03E],
  [90, 'pig', 'Pig', 0xF0A5A2, 0xDB635F], [91, 'sheep', 'Sheep', 0xE7E7E7, 0xFFB5B5], [92, 'cow', 'Cow', 0x443626, 0xA1A1A1], [93, 'chicken', 'Chicken', 0xA1A1A1, 0xFF0000],
  [94, 'squid', 'Squid', 0x223B4D, 0x708899], [95, 'wolf', 'Wolf', 0xD7D3D3, 0xCEAF96], [96, 'mooshroom', 'Mooshroom', 0xA00F10, 0xB7B7B7], [98, 'ocelot', 'Ocelot', 0xEFDE7D, 0x564434],
  [100, 'horse', 'Horse', 0xC09E7D, 0xEEE500], [120, 'villager', 'Villager', 0x563C33, 0xBD8B72]];
export const EGG = Object.fromEntries(EGGS.map(e => [e[0], e])); export const EGG_ID = Object.fromEntries(EGGS.map(e => [e[1], e[0]]));
reg(383, 'spawn_egg', { name: 'Spawn Egg', egg: true, icon: { egg: [0xC09E7D, 0xEEE500] } });
const EGG_PX = '..............................................................................7d6b........................5e60d1c27e5d..................5e777b99dfc26a59................607a8697e8d9826b..............7dd09a99e7e7d9c0c06a............7fdae4ebe8de7c67bf6b..........7cd1de99a7dfd48d67c1bf6a........5d7adbaae4d8d5d3c1c2bf64........5b66d8e6df93d1d4c1bf615d..........7cd3d67f7867c0666452............7cbbc07a6561bf645650..............6a6cbebfbfbe6251....................69575962............................................';
function drawEgg(ctx, size, [a, b]) {
  const s = size / 16; const ca = [a >> 16 & 255, a >> 8 & 255, a & 255], cb = [b >> 16 & 255, b >> 8 & 255, b & 255];
  for (let i = 0; i < 256; i++) { const h = EGG_PX.slice(i * 2, i * 2 + 2); if (h === '..') continue; const v = parseInt(h, 16);
    const spot = v >= 0xb0, c = spot ? cb : ca, f = spot ? 0.55 + 0.45 * v / 0xe8 : 0.55 + 0.45 * v / 0x9a;
    ctx.fillStyle = 'rgb(' + c.map(k => Math.min(255, k * f | 0)).join(',') + ')'; ctx.fillRect((i & 15) * s, (i >> 4) * s, s, s); }
}

// block items: every registered block (except technical ones) is an item with the same id
const NOT_ITEMS = new Set([0, 8, 9, 10, 11, 26, 51, 59, 62, 64, 71, 74, 83, 90, 52, 34, 55, 75, 93, 94, 124]);
for (const b of BL) if (b && !NOT_ITEMS.has(b.id)) items[b.id] = { id: b.id, key: b.key, name: b.name === b.key ? b.key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : b.name, stack: 64, block: b.id, fuel: (b.sound === 'wood' && b.id !== 54 && b.id !== 58 ? 300 : b.id === 54 || b.id === 58 ? 300 : 0) };
items[6].fuel = 100;

export function itemName(id, dmg) { const it = items[id]; if (!it) return 'Unknown'; if (id === 373) return potionName(dmg); const vb = it.block !== undefined && BL[it.block]; if (vb && vb.variants) return vb.variants[(dmg | 0) & (id === 17 || id === 18 || id === 161 || id === 162 ? 3 : 15)] || vb.variants[0]; if (id === 351) return DYE_NAMES[(dmg | 0) & 15]; if (id === 383) return EGG[dmg] ? 'Spawn ' + EGG[dmg][2] : 'Spawn Egg'; return it.name; }
export const DYE_NAMES = ['Ink Sac', 'Rose Red', 'Cactus Green', 'Cocoa Beans', 'Lapis Lazuli', 'Purple Dye', 'Cyan Dye', 'Light Gray Dye', 'Gray Dye', 'Pink Dye', 'Lime Dye', 'Dandelion Yellow', 'Light Blue Dye', 'Magenta Dye', 'Orange Dye', 'Bone Meal'];
const DYE_FILES = ['black', 'red', 'green', 'brown', 'blue', 'purple', 'cyan', 'silver', 'gray', 'pink', 'lime', 'yellow', 'light_blue', 'magenta', 'orange', 'white'];
export function maxStack(id) { return items[id]?.stack ?? 64; }

// ---------- icon rendering ----------
const iconCache = new Map();
function px(ctx, x, y, c) { ctx.fillStyle = 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')'; ctx.fillRect(x, y, 1, 1); }
const sh = (c, f) => c.map(v => Math.max(0, Math.min(255, v * f | 0)));
function grid() { return Array.from({ length: 16 }, () => new Array(16).fill(null)); }
function line(g, x0, y0, x1, y1, c, w = 1) { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)); for (let i = 0; i <= n; i++) { const x = Math.round(x0 + (x1 - x0) * i / n), y = Math.round(y0 + (y1 - y0) * i / n); for (let k = 0; k < w; k++) if (g[y] && x + k < 16) g[y][x + k] = c; } }
function disc(g, cx, cy, r, c, shadeIt) { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const d = Math.hypot(x - cx, y - cy); if (d <= r) g[y][x] = shadeIt ? sh(c, 1.15 - (x - cx + y - cy) / (r * 4) ) : c; } }
function rect(g, x0, y0, w, h, c) { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (g[y] && x < 16 && x >= 0) g[y][x] = c; }
function outline(g, c = [30, 30, 30]) { const o = grid(); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { if (g[y][x]) { o[y][x] = g[y][x]; continue; } for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) { const v = g[y + dy]?.[x + dx]; if (v && v !== 'o') { o[y][x] = c; break; } } } return o; }
const STICK = [[73, 54, 21], [104, 78, 47], [137, 103, 39]];
function drawShape(g, ic) {
  const s = ic.shape; const c = ic.c || [200, 200, 200];
  const stick = (x0, y0, x1, y1) => { line(g, x0, y0, x1, y1, STICK[1]); line(g, x0 + 1, y0, x1 + 1, y1, STICK[0]); };
  if (ic.tool) {
    const M = MAT[ic.mat].c; const handle = ic.mat === 'wood' ? STICK : STICK;
    if (ic.tool === 'sword') { line(g, 2, 13, 4, 11, handle[1]); line(g, 3, 13, 4, 12, handle[0]); line(g, 4, 11, 13, 2, M[1], 2); line(g, 5, 11, 13, 3, M[0]); line(g, 5, 10, 13, 2, M[2]); line(g, 2, 9, 6, 13, [60, 50, 30]); g[14][1] = handle[0]; }
    else { stick(2, 13, 10, 5);
      if (ic.tool === 'pickaxe') { const pts = [[4, 2], [5, 1], [6, 1], [7, 1], [8, 1], [9, 2], [10, 2], [11, 3], [12, 4], [13, 5], [13, 6], [14, 7], [14, 8], [14, 9], [13, 10]]; for (const [x, y] of pts) { g[y][x] = M[1]; if (g[y + 1]) g[y + 1][x] = g[y + 1][x] || M[0]; } g[2][5] = M[2]; g[2][6] = M[2]; g[3][11] = M[2]; }
      if (ic.tool === 'axe') { rect(g, 7, 2, 4, 3, M[1]); rect(g, 9, 1, 3, 2, M[2]); rect(g, 6, 3, 2, 3, M[0]); rect(g, 10, 4, 2, 2, M[0]); }
      if (ic.tool === 'shovel') { disc(g, 11.5, 3.5, 2.6, M[1]); g[2][11] = M[2]; g[2][12] = M[2]; g[5][12] = M[0]; g[4][13] = M[0]; }
      if (ic.tool === 'hoe') { rect(g, 7, 3, 5, 2, M[1]); rect(g, 7, 3, 2, 3, M[1]); g[3][11] = M[2]; g[4][11] = M[0]; }
    }
    return;
  }
  switch (s) {
    case 'stick': stick(3, 12, 12, 3); if (ic.c) { line(g, 3, 12, 12, 3, ic.c); line(g, 4, 12, 13, 3, sh(ic.c, 0.7)); } break;
    case 'ingot': for (let y = 0; y < 5; y++) line(g, 3 + y, 11 - y, 10 + y, 11 - y, sh(c, 0.8 + y * 0.08)); line(g, 7, 7, 14, 7, sh(c, 1.2)); line(g, 3, 11, 10, 11, sh(c, 0.6)); break;
    case 'gem': for (let y = 2; y < 14; y++) { const w = y < 6 ? (y - 2) * 1.5 + 2 : (14 - y) * 0.8 + 1; for (let x = Math.round(8 - w); x <= Math.round(7 + w); x++) g[y][x] = sh(c, 1.2 - (x / 16) * 0.5 - (y > 6 ? 0.2 : 0)); } g[4][6] = [255, 255, 255]; g[5][5] = [220, 255, 255]; break;
    case 'lump': disc(g, 7.5, 8.5, 4.5, c, true); g[6][6] = sh(c, 1.6); g[10][9] = sh(c, 0.6); break;
    case 'dust': { let r = 7; for (let i = 0; i < 30; i++) { const x = 4 + ((i * 7 + 3) % 9), y = 5 + ((i * 5 + 1) % 8); if (Math.hypot(x - 8, y - 9) < 4.8) g[y][x] = sh(c, 0.7 + ((i * 13) % 5) / 8); } break; }
    case 'ball': disc(g, 7.5, 7.5, 5, c, true); g[5][5] = sh(c, 1.3); break;
    case 'egg': for (let y = 2; y < 14; y++) for (let x = 3; x < 13; x++) if (((x - 7.5) / 4.6) ** 2 + ((y - 8.5) / 6) ** 2 < 1) g[y][x] = sh(ic.c || [240, 225, 190], 1.1 - (x + y) / 40); break;
    case 'apple': disc(g, 7.5, 9, 5, c, true); g[4][8] = STICK[0]; g[3][8] = STICK[0]; g[3][9] = [60, 160, 40]; g[2][10] = [60, 160, 40]; g[7][5] = [255, 255, 255]; break;
    case 'bowl': rect(g, 2, 8, 12, 2, [130, 100, 60]); rect(g, 3, 10, 10, 2, [110, 84, 50]); rect(g, 5, 12, 6, 1, [90, 68, 40]); if (ic.fill) rect(g, 3, 7, 10, 1, ic.fill); break;
    case 'string': line(g, 3, 4, 12, 12, [230, 230, 230]); line(g, 5, 3, 10, 8, [230, 230, 230]); line(g, 10, 8, 4, 13, [200, 200, 200]); break;
    case 'feather': line(g, 3, 13, 12, 2, [200, 200, 200]); for (let i = 0; i < 7; i++) { line(g, 5 + i, 9 - i, 7 + i, 11 - i, [245, 245, 245]); } line(g, 3, 13, 12, 2, [170, 170, 170]); break;
    case 'seeds': for (const [x, y] of [[5, 7], [9, 5], [7, 10], [11, 9], [4, 11], [9, 12]]) { g[y][x] = c; g[y][x + 1] = sh(c, 0.7); } break;
    case 'wheat': for (let i = 0; i < 4; i++) line(g, 3 + i, 13, 9 + i * 1.5 | 0, 2 + i, i % 2 ? [190, 160, 60] : [220, 190, 80]); break;
    case 'bread': for (let y = 6; y < 12; y++) for (let x = 2; x < 14; x++) if (((x - 7.5) / 6) ** 2 + ((y - 9) / 3.2) ** 2 < 1) g[y][x] = y < 8 ? [200, 140, 60] : [170, 110, 40]; for (const x of [5, 8, 11]) g[7][x] = [230, 190, 110]; break;
    case 'flint': for (let y = 3; y < 13; y++) for (let x = 4; x < 12; x++) if (Math.abs(x - 8) + Math.abs(y - 8) * 0.7 < 5) g[y][x] = sh([60, 60, 60], 0.8 + (12 - y) / 20); g[5][7] = [140, 140, 140]; break;
    case 'meat': for (let y = 3; y < 13; y++) for (let x = 2; x < 14; x++) if (((x - 8) / 5.5) ** 2 + ((y - 7.5) / 4.2) ** 2 < 1) g[y][x] = sh(c, 1 - (y - 3) / 30); rect(g, 6, 6, 3, 2, sh(c, 1.25)); g[11][3] = [240, 240, 230]; g[12][2] = [240, 240, 230]; break;
    case 'drumstick': for (let y = 2; y < 11; y++) for (let x = 5; x < 14; x++) if (((x - 9.5) / 4.3) ** 2 + ((y - 6) / 4) ** 2 < 1) g[y][x] = sh(c, 1.1 - (x + y) / 40); line(g, 3, 13, 7, 9, [240, 240, 230]); g[13][2] = [240, 240, 230]; g[12][2] = [240, 240, 230]; break;
    case 'fish': for (let y = 5; y < 11; y++) for (let x = 3; x < 12; x++) if (((x - 7.5) / 4.6) ** 2 + ((y - 8) / 2.8) ** 2 < 1) g[y][x] = sh(c, 1.1 - (y - 5) / 15); rect(g, 12, 6, 2, 1, c); rect(g, 12, 9, 2, 1, c); g[8][12] = c; g[7][5] = [20, 20, 20]; break;
    case 'bone': line(g, 4, 11, 11, 4, [240, 240, 225], 2); for (const [x, y] of [[3, 11], [4, 12], [11, 3], [12, 4], [2, 12], [13, 3]]) g[y][x] = [240, 240, 225]; break;
    case 'bucket': rect(g, 3, 5, 10, 8, [190, 190, 190]); rect(g, 4, 13, 8, 1, [140, 140, 140]); rect(g, 3, 5, 10, 1, [110, 110, 110]); rect(g, 4, 6, 8, 1, ic.fill || [80, 80, 80]); line(g, 3, 4, 6, 2, [140, 140, 140]); line(g, 12, 4, 9, 2, [140, 140, 140]); rect(g, 6, 2, 4, 1, [140, 140, 140]); for (let y = 7; y < 13; y++) g[y][4] = [230, 230, 230]; break;
    case 'bow': for (let i = 0; i < 12; i++) { const t = i / 11; const x = Math.round(2 + t * 11 + Math.sin(t * Math.PI) * -2.5), y = Math.round(13 - t * 11 - Math.sin(t * Math.PI) * 2.5); g[y][x] = STICK[1]; } line(g, 2, 13, 13, 2, [220, 220, 220]); break;
    case 'arrow': line(g, 3, 12, 12, 3, STICK[1]); rect(g, 10, 2, 3, 1, [200, 200, 200]); rect(g, 12, 2, 1, 3, [200, 200, 200]); g[3][11] = [160, 160, 160]; line(g, 2, 11, 4, 13, [240, 240, 240]); line(g, 3, 10, 5, 12, [240, 240, 240]); break;
    case 'flintsteel': rect(g, 3, 8, 4, 5, [60, 60, 60]); g[9][4] = [130, 130, 130]; line(g, 8, 10, 13, 5, [200, 200, 200]); line(g, 8, 5, 13, 5, [200, 200, 200]); line(g, 8, 5, 8, 9, [160, 160, 160]); break;
    case 'helmet': rect(g, 3, 4, 10, 3, c); rect(g, 3, 7, 3, 4, c); rect(g, 10, 7, 3, 4, c); rect(g, 4, 4, 8, 1, sh(c, 1.2)); break;
    case 'chestplate': rect(g, 2, 3, 12, 4, c); rect(g, 4, 7, 8, 7, c); rect(g, 6, 3, 4, 2, null); rect(g, 2, 7, 2, 3, sh(c, 0.8)); rect(g, 12, 7, 2, 3, sh(c, 0.8)); rect(g, 5, 8, 6, 1, sh(c, 1.2)); break;
    case 'leggings': rect(g, 3, 3, 10, 3, c); rect(g, 3, 6, 4, 8, c); rect(g, 9, 6, 4, 8, c); rect(g, 3, 3, 10, 1, sh(c, 1.2)); break;
    case 'boots': rect(g, 2, 7, 4, 5, c); rect(g, 10, 7, 4, 5, c); rect(g, 1, 11, 5, 2, sh(c, 0.85)); rect(g, 10, 11, 5, 2, sh(c, 0.85)); break;
    case 'leather': for (let y = 3; y < 13; y++) for (let x = 3; x < 13; x++) if ((x + y) % 7 !== 0) g[y][x] = sh([160, 100, 60], 0.9 + ((x * y) % 5) / 20); break;
    case 'paper': rect(g, 3, 2, 10, 12, [240, 240, 230]); for (const y of [4, 6, 8, 10]) rect(g, 4, y, 8, 1, [200, 200, 190]); break;
    case 'book': rect(g, 3, 2, 10, 12, [110, 60, 30]); rect(g, 4, 3, 8, 10, [140, 80, 40]); rect(g, 12, 3, 1, 10, [240, 240, 230]); break;
    case 'sign': rect(g, 2, 3, 12, 7, [160, 130, 78]); rect(g, 7, 10, 2, 5, STICK[1]); for (const y of [5, 7]) rect(g, 4, y, 8, 1, [110, 88, 50]); break;
    case 'minecart': rect(g, 2, 6, 12, 5, [120, 120, 120]); rect(g, 3, 7, 10, 2, [70, 70, 70]); rect(g, 3, 11, 2, 2, [40, 40, 40]); rect(g, 11, 11, 2, 2, [40, 40, 40]); break;
    case 'boat': rect(g, 1, 8, 14, 3, [150, 116, 66]); rect(g, 3, 11, 10, 2, [120, 90, 50]); rect(g, 1, 7, 2, 1, [150, 116, 66]); rect(g, 13, 7, 2, 1, [150, 116, 66]); break;
    case 'record': disc(g, 7.5, 7.5, 6.5, [30, 30, 34]); disc(g, 7.5, 7.5, 5, [44, 44, 50]); disc(g, 7.5, 7.5, 2.2, ic.c); g[7][7] = g[8][8] = g[7][8] = g[8][7] = [20, 20, 20]; g[3][5] = g[4][4] = [90, 90, 100]; break;
    case 'horse_armor': rect(g, 2, 4, 9, 3, ic.c); rect(g, 10, 2, 4, 5, ic.c); rect(g, 3, 7, 7, 4, sh(ic.c, 0.8)); rect(g, 3, 11, 2, 3, sh(ic.c, 0.7)); rect(g, 8, 11, 2, 3, sh(ic.c, 0.7)); rect(g, 11, 3, 1, 1, [30, 30, 30]); break;
    case 'saddle': rect(g, 3, 5, 10, 4, [140, 80, 40]); rect(g, 5, 9, 2, 5, [100, 60, 30]); rect(g, 6, 13, 2, 1, [200, 200, 200]); break;
    case 'compass': disc(g, 7.5, 7.5, 5.5, [150, 150, 150]); disc(g, 7.5, 7.5, 4, [210, 210, 210]); g[5][8] = [220, 0, 0]; g[6][8] = [220, 0, 0]; g[7][7] = [80, 80, 80]; g[8][7] = [80, 80, 80]; break;
    case 'clock': disc(g, 7.5, 7.5, 5.5, [230, 200, 60]); disc(g, 7.5, 7.5, 4, [90, 140, 220]); rect(g, 4, 8, 8, 3, [40, 60, 30]); rect(g, 7, 5, 1, 3, [255, 255, 255]); break;
    case 'cake': rect(g, 2, 7, 12, 6, [230, 200, 160]); rect(g, 2, 6, 12, 2, [250, 250, 250]); for (const x of [4, 8, 11]) g[6][x] = [220, 30, 30]; break;
    case 'bed': rect(g, 1, 7, 14, 3, [170, 30, 30]); rect(g, 1, 7, 4, 3, [240, 240, 240]); rect(g, 1, 10, 14, 2, [150, 116, 66]); rect(g, 1, 12, 1, 2, [150, 116, 66]); rect(g, 14, 12, 1, 2, [150, 116, 66]); break;
    case 'cookie': disc(g, 7.5, 7.5, 5, [200, 140, 70]); for (const [x, y] of [[5, 6], [9, 5], [8, 9], [5, 10], [10, 9]]) g[y][x] = [70, 40, 20]; break;
    case 'shears': line(g, 3, 12, 9, 6, [210, 210, 210]); line(g, 6, 3, 12, 9, [210, 210, 210]); rect(g, 2, 11, 3, 3, [180, 40, 40]); rect(g, 11, 2, 3, 3, [180, 40, 40]); break;
    case 'melon': for (let y = 4; y < 13; y++) for (let x = 2; x < 14; x++) if (Math.hypot(x - 8, y - 4) < 8 && y > 4) g[y][x] = Math.hypot(x - 8, y - 4) > 6.8 ? [60, 140, 30] : [230, 60, 50]; g[7][7] = [30, 20, 10]; g[9][10] = [30, 20, 10]; break;
  }
}
function isoBlock(ctx, id, S, dmg = 0, hOver) {
  const b = BL[id]; const atlas = buildAtlas();
  const tile = (f) => { const i = tileIndex(b.tex(f, dmg)) ?? 0; return [(i % COLS) * 16, Math.floor(i / COLS) * 16]; };
  const h = hOver || (b.shape === 'slab' ? 0.5 : b.shape === 'layer' && b.height < 0.5 ? Math.max(b.height, 1 / 8) : 1);
  const top = tile('top'), side = tile(b.facing ? 'front' : 'side'), side2 = tile('side');
  const s = S / 16; const W = S * 0.9;
  ctx.save(); ctx.imageSmoothingEnabled = false;
  const cx = S / 2, ty = S * 0.05 + (1 - h) * W / 2;
  const tint = (b.id === 2) ? [124, 189, 107] : b.id === 18 || b.id === 161 ? [72, 181, 24] : null;
  const drawFace = (src, m, shade, isTop) => {
    const tmp = document.createElement('canvas'); tmp.width = tmp.height = 16; const tx = tmp.getContext('2d');
    tx.drawImage(atlas, src[0], src[1], 16, 16, 0, 0, 16, 16);
    if (tint && (isTop || b.id === 18 || b.id === 161)) { tx.globalCompositeOperation = 'multiply'; tx.fillStyle = 'rgb(' + tint + ')'; tx.fillRect(0, 0, 16, 16); tx.globalCompositeOperation = 'destination-in'; tx.drawImage(atlas, src[0], src[1], 16, 16, 0, 0, 16, 16); }
    if (shade < 1) { tx.globalCompositeOperation = 'source-atop'; tx.fillStyle = 'rgba(0,0,0,' + (1 - shade) + ')'; tx.fillRect(0, 0, 16, 16); }
    ctx.setTransform(...m); ctx.drawImage(tmp, 0, 0, 16, isTop ? 16 : 16 * h, 0, 0, 16, isTop ? 16 : 16 * h);
  };
  const a = W / 2 / 16, bb = W / 4 / 16, dv = W / 2 / 16; // iso basis
  drawFace(top, [a, bb, -a, bb, cx, ty], 1, true);
  drawFace(side, [a, bb, 0, dv, cx - W / 2, ty + W / 4], 0.8, false);
  drawFace(side2, [a, -bb, 0, dv, cx, ty + W / 2], 0.6, false);
  ctx.restore();
}
// texture-pack item icons: id -> [col,row] in items.png (classic layout)
const PACK_ICONS = { 259: [5, 0], 260: [10, 0], 261: [5, 1], 262: [5, 2], 263: [7, 0], 264: [7, 3], 265: [7, 1], 266: [7, 2], 280: [5, 3], 281: [7, 4], 282: [8, 4], 287: [8, 0], 288: [8, 1], 289: [8, 2],
  295: [9, 0], 296: [9, 1], 297: [9, 2], 318: [6, 0], 319: [7, 5], 320: [8, 5], 322: [11, 0], 323: [10, 2], 324: [11, 2], 330: [12, 2], 325: [10, 4], 326: [11, 4], 327: [12, 4], 328: [7, 8], 329: [8, 6], 331: [8, 3], 332: [14, 0],
  333: [8, 8], 334: [7, 6], 335: [13, 4], 336: [6, 1], 337: [9, 3], 338: [11, 1], 339: [10, 3], 340: [11, 3], 341: [14, 1], 344: [12, 0], 345: [6, 3], 347: [6, 4], 348: [9, 4], 349: [9, 5], 350: [10, 5],
  351: [14, 8], 352: [12, 1], 353: [13, 0], 354: [13, 1], 355: [13, 2], 357: [12, 5], 359: [13, 5], 360: [13, 6], 363: [9, 6], 364: [10, 6], 365: [9, 7], 366: [10, 7], 367: [11, 5], 368: [11, 6],
  369: [12, 6], 370: [11, 7], 371: [12, 7], 375: [11, 8], 378: [13, 10], 450: [15, 4], 374: [13, 3], 2256: [0, 15], 2257: [1, 15] };
for (const [row, ids] of [[4, [268, 272, 267, 276, 283]], [5, [269, 273, 256, 277, 284]], [6, [270, 274, 257, 278, 285]], [7, [271, 275, 258, 279, 286]], [8, [290, 291, 292, 293, 294]]]) ids.forEach((id, c) => PACK_ICONS[id] = [c, row]);
// armor: column = material (leather, chain, iron, diamond, gold), row = piece
[298, 302, 306, 310, 314].forEach((base, c) => { for (let r = 0; r < 4; r++) PACK_ICONS[base + r] = [c, r]; });
// 1.7 single-file item icons (preferred over the classic sheet)
const FILE_ICONS = { 259: 'flint_and_steel', 260: 'apple', 261: 'bow_standby', 262: 'arrow', 265: 'iron_ingot', 266: 'gold_ingot', 281: 'bowl', 282: 'mushroom_stew', 288: 'feather', 289: 'gunpowder', 295: 'seeds_wheat',
  297: 'bread', 318: 'flint', 319: 'porkchop_raw', 320: 'porkchop_cooked', 322: 'apple_golden', 323: 'sign', 328: 'minecart_normal', 329: 'saddle', 331: 'redstone_dust', 333: 'boat', 334: 'leather', 336: 'brick',
  338: 'reeds', 339: 'paper', 340: 'book_normal', 344: 'egg', 348: 'glowstone_dust', 349: 'fish_cod_raw', 350: 'fish_cod_cooked', 352: 'bone', 355: 'bed', 357: 'cookie', 359: 'shears', 360: 'melon',
  361: 'seeds_pumpkin', 362: 'seeds_melon', 363: 'beef_raw', 364: 'beef_cooked', 367: 'rotten_flesh', 368: 'ender_pearl', 369: 'blaze_rod', 370: 'ghast_tear', 371: 'gold_nugget', 372: 'nether_wart',
  374: 'potion_bottle_empty', 377: 'blaze_powder', 378: 'magma_cream', 379: 'brewing_stand', 382: 'melon_speckled', 450: 'emerald', 417: 'iron_horse_armor', 418: 'gold_horse_armor',
  256: 'iron_shovel', 257: 'iron_pickaxe', 258: 'iron_axe', 267: 'iron_sword', 292: 'iron_hoe', 283: 'gold_sword', 284: 'gold_shovel', 285: 'gold_pickaxe', 286: 'gold_axe', 294: 'gold_hoe',
  306: 'iron_helmet', 307: 'iron_chestplate', 308: 'iron_leggings', 309: 'iron_boots', 314: 'gold_helmet', 315: 'gold_chestplate', 316: 'gold_leggings', 317: 'gold_boots',
  356: 'repeater', 405: 'netherbrick', 406: 'quartz', 420: 'lead', 421: 'name_tag', 396: 'carrot_golden', 392: 'potato', 393: 'potato_baked', 394: 'potato_poisonous', 400: 'pumpkin_pie' };
RECORD_NAMES.forEach((n, i) => FILE_ICONS[2256 + i] = 'record_' + n);
function fileIcon(id, dmg) { const im = PACK['item:' + (id === 351 ? 'dye_powder_' + DYE_FILES[dmg & 15] : FILE_ICONS[id])]; return im || null; }
function packIcon(id, dmg) { const f = fileIcon(id, dmg); if (f) return f; const p = PACK_ICONS[id]; if (!p) return null; const d = cell('items', p[0], p[1]); if (!d) return null; const c = document.createElement('canvas'); c.width = c.height = 16; c.getContext('2d').putImageData(d, 0, 0); return c; }
// potion: the bottle template (items.png cell 12,3) with its liquid recoloured; splash bottles sit lower with a wider body
function potionIcon(dmg) { const col = potionType(dmg)[2], rgb = [col >> 16 & 255, col >> 8 & 255, col & 255]; const c = document.createElement('canvas'); c.width = c.height = 16; const ctx = c.getContext('2d');
  const d = cell('items', 12, 3); if (!d) { ctx.fillStyle = '#c8dcf0'; ctx.fillRect(6, 3, 4, 4); ctx.fillRect(4, 7, 8, 7); ctx.fillStyle = 'rgb(' + rgb + ')'; ctx.fillRect(5, 8, 6, 5); ctx.fillStyle = '#a94725'; ctx.fillRect(7, 2, 2, 2); return c; }
  const q = d.data; for (let i = 0; i < q.length; i += 4) if (q[i + 3] > 0 && q[i] < 64 && q[i + 2] > q[i]) { const k = q[i + 2] / 198; q[i] = Math.min(255, rgb[0] * k); q[i + 1] = Math.min(255, rgb[1] * k); q[i + 2] = Math.min(255, rgb[2] * k); }
  ctx.putImageData(d, 0, 0); if (isSplash(dmg)) { const t = document.createElement('canvas'); t.width = t.height = 16; const tc = t.getContext('2d'); tc.drawImage(c, 0, 2, 16, 14, -1, 2, 18, 14); tc.drawImage(c, 0, 0, 16, 5, 0, 1, 16, 5); return t; }
  return c; }
export function getIcon(id, size = 32, dmg = 0) {
  const vb = items[id] && items[id].block !== undefined && BL[items[id].block]; if ((!vb || !vb.variants) && id !== 373 && id !== 351 && id !== 383) dmg = 0;
  const key = id + ':' + size + ':' + dmg; let cv = iconCache.get(key); if (cv) return cv;
  cv = document.createElement('canvas'); cv.width = cv.height = size; const ctx = cv.getContext('2d'); ctx.imageSmoothingEnabled = false;
  const it = items[id]; const pi = id === 373 ? potionIcon(dmg) : packIcon(id, dmg);
  if (pi) ctx.drawImage(pi, 0, 0, size, size);
  else if (it && it.block !== undefined) {
    const b = BL[it.block]; const sp = SHAPE[it.block];
    if (sp === SH.cube || sp === SH.piston || sp === SH.slab || sp === SH.cactus || sp === SH.layer && it.block !== 78) isoBlock(ctx, it.block, size, dmg);
    else if (sp === SH.plate) isoBlock(ctx, it.block, size, dmg, 1 / 8);
    else if (sp === SH.button) { const t = document.createElement('canvas'); t.width = t.height = size; isoBlock(t.getContext('2d'), it.block, size, dmg, 0.5); ctx.drawImage(t, size * 0.25, size * 0.3, size * 0.5, size * 0.5); }
    else if (sp === SH.fence || sp === SH.gate) { const atlas = buildAtlas(); const i = tileIndex(b.tex('side', 0)) ?? 0, tx = (i % COLS) * 16, ty = Math.floor(i / COLS) * 16, s = size / 16;
      const r = (x, y, w, h, sh) => { ctx.drawImage(atlas, tx + x, ty + y, w, h, x * s, y * s, w * s, h * s); if (sh) { ctx.fillStyle = 'rgba(0,0,0,' + sh + ')'; ctx.fillRect(x * s, y * s, w * s, h * s); } };
      if (sp === SH.fence) { r(1, 4, 14, 3, 0.15); r(1, 9, 14, 3, 0.15); r(2, 1, 4, 15); r(10, 1, 4, 15); }
      else { r(0, 4, 16, 3, 0.15); r(0, 9, 16, 3, 0.15); r(0, 2, 3, 13); r(13, 2, 3, 13); r(7, 4, 2, 8, 0.1); } }
    else { const atlas = buildAtlas(); const i = tileIndex(b.tex('side', dmg || (it.block === 31 ? 1 : 0))) ?? 0; ctx.drawImage(atlas, (i % COLS) * 16, Math.floor(i / COLS) * 16, 16, 16, 0, 0, size, size);
      if (b.tint) { ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = 'rgb(100,180,70)'; ctx.fillRect(0, 0, size, size); ctx.globalCompositeOperation = 'destination-in'; ctx.drawImage(atlas, (i % COLS) * 16, Math.floor(i / COLS) * 16, 16, 16, 0, 0, size, size); ctx.globalCompositeOperation = 'source-over'; } }
  } else if (it && it.icon && it.icon.egg) { const e = id === 383 && EGG[dmg]; drawEgg(ctx, size, e ? [e[3], e[4]] : it.icon.egg); }
  else if (it && it.icon && it.icon.tile) { const atlas = buildAtlas(); const i = tileIndex(it.icon.tile); ctx.drawImage(atlas, (i % COLS) * 16, Math.floor(i / COLS) * 16, 16, 16, 0, 0, size, size); }
  else if (it && it.icon) {
    const g = grid(); drawShape(g, it.icon); const o = outline(g, [24, 24, 24]); const s = size / 16;
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (o[y][x]) { ctx.fillStyle = 'rgb(' + o[y][x].join(',') + ')'; ctx.fillRect(x * s, y * s, s, s); }
  } else { ctx.fillStyle = '#f0f'; ctx.fillRect(0, 0, size / 2, size / 2); ctx.fillRect(size / 2, size / 2, size / 2, size / 2); }
  iconCache.set(key, cv); return cv;
}
