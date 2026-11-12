// Procedural 16x16 pixel-art texture atlas (original art, 2012-era style)
import { cell, PACK } from './pack.js';
export const TILE = 16, COLS = 16;
const tiles = {}; let nextTile = 0;
export function tileIndex(name) { return tiles[name]; }

function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
function hash(str) { let h = 2166136261; for (const ch of str) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
const clamp = v => Math.max(0, Math.min(255, v | 0));

class Px {
  constructor(name) { this.d = new Uint8ClampedArray(16 * 16 * 4); this.r = rng(hash(name)); }
  set(x, y, c, a = 255) { if (x < 0 || y < 0 || x > 15 || y > 15) return; const i = (y * 16 + x) * 4; this.d[i] = c[0]; this.d[i + 1] = c[1]; this.d[i + 2] = c[2]; this.d[i + 3] = a; }
  get(x, y) { const i = (y * 16 + x) * 4; return [this.d[i], this.d[i + 1], this.d[i + 2], this.d[i + 3]]; }
  noise(base, amt, a = 255) { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const n = (this.r() - 0.5) * amt; this.set(x, y, base.map(v => clamp(v + n)), a); } return this; }
  pal(colors, a = 255) { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) this.set(x, y, colors[(this.r() * colors.length) | 0], a); return this; }
  speck(colors, count) { for (let i = 0; i < count; i++) { const x = (this.r() * 16) | 0, y = (this.r() * 16) | 0; this.set(x, y, colors[(this.r() * colors.length) | 0]); } return this; }
  rect(x0, y0, w, h, c) { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) this.set(x, y, c); return this; }
  clear() { this.d.fill(0); return this; }
  shade(x, y, f) { const c = this.get(x, y); this.set(x, y, [clamp(c[0] * f), clamp(c[1] * f), clamp(c[2] * f)], c[3]); }
}

const defs = [];
function def(name, fn) { tiles[name] = nextTile++; defs.push([name, fn]); }

// ---- terrain ----
const STONE = [[125,125,125],[116,116,116],[134,134,134],[108,108,108],[127,127,127]];
function stoneBase(p) {
  p.pal(STONE);
  for (let i = 0; i < 7; i++) { let x = (p.r() * 16) | 0, y = (p.r() * 16) | 0; const len = 2 + ((p.r() * 4) | 0); for (let k = 0; k < len; k++) { p.set(x, y, [96,96,96]); p.set(x, y - 1, [146,146,146]); x++; if (p.r() < 0.3) y++; } }
  return p;
}
def('stone', p => stoneBase(p));
def('cobblestone', p => {
  p.pal([[122,122,122],[110,110,110],[132,132,132]]);
  const g = [[0,0,6,4],[6,0,5,5],[11,0,5,3],[0,4,4,5],[4,5,6,4],[10,3,6,5],[0,9,6,4],[6,9,4,4],[10,8,6,5],[0,13,5,3],[5,13,6,3],[11,13,5,3]];
  for (const [x0,y0,w,h] of g) { for (let x = x0; x < x0 + w; x++) { p.set(x, y0 + h - 1, [76,76,76]); p.set(x, y0, [150,150,150]); } for (let y = y0; y < y0 + h; y++) { p.set(x0 + w - 1, y, [82,82,82]); } }
});
def('mossy_cobblestone', p => { const t = new Px('cobblestone'); defs.find(d => d[0] === 'cobblestone')[1](t); p.d.set(t.d); for (let i = 0; i < 70; i++) { const x = (p.r()*16)|0, y = (p.r()*16)|0; p.set(x, y, p.r() < .5 ? [74,104,58] : [92,124,66]); } });
const DIRT = [[134,96,67],[121,85,58],[150,108,74],[109,76,52],[140,100,70]];
def('dirt', p => { p.pal(DIRT); p.speck([[96,67,45],[160,118,84]], 18); });
def('grass_top', p => { p.pal([[150,150,150],[138,138,138],[162,162,162],[128,128,128],[170,170,170]]); });
def('grass_side', p => { p.pal(DIRT); p.speck([[96,67,45],[160,118,84]], 14); const G = [[96,154,54],[86,140,48],[106,166,60]]; for (let x = 0; x < 16; x++) { const d = 3 + ((p.r() * 3) | 0); for (let y = 0; y < d; y++) p.set(x, y, G[(p.r() * 3) | 0]); } });
def('grass_side_snow', p => { p.pal(DIRT); p.speck([[96,67,45]], 14); for (let x = 0; x < 16; x++) { const d = 3 + ((p.r() * 3) | 0); for (let y = 0; y < d; y++) p.set(x, y, p.r() < .3 ? [228,236,236] : [248,252,252]); } });
def('snow', p => p.pal([[248,252,252],[238,246,246],[232,240,242]]));
def('packed_ice', p => { p.noise([150,178,236], 14); for (let i = 0; i < 9; i++) { let x = (p.r()*16)|0, y = (p.r()*16)|0; const len = 3 + ((p.r()*5)|0), dx = p.r() < 0.5 ? 1 : -1; for (let k = 0; k < len; k++) { p.set(x, y, [196,216,252]); x += dx; if (p.r() < 0.5) y++; } } for (let i = 0; i < 10; i++) p.set((p.r()*16)|0, (p.r()*16)|0, [120,150,214]); });
def('ice', p => { p.noise([126,168,252], 18, 170); for (let i = 0; i < 6; i++) { const x = (p.r()*14)|0, y = (p.r()*14)|0; p.set(x, y, [200,220,255], 200); p.set(x+1, y+1, [200,220,255], 200); } });
def('sand', p => { p.pal([[219,211,160],[212,202,150],[226,218,170],[205,196,144]]); p.speck([[196,186,134],[232,226,182]], 20); });
def('sandstone_side', p => { p.pal([[216,206,156],[210,200,150],[222,212,162]]); for (let x = 0; x < 16; x++) { p.set(x, 0, [236,228,180]); p.set(x, 3, [198,188,138]); p.set(x, 15, [180,168,118]); p.set(x, 12, [204,194,144]); } });
def('sandstone_top', p => { p.pal([[219,211,160],[214,204,154],[224,216,166]]); });
def('sandstone_bottom', p => { p.pal([[214,204,154],[206,196,146],[220,210,160]]); p.speck([[190,180,128]], 30); });
def('gravel', p => { p.pal([[132,124,122],[118,112,110],[148,140,138],[104,98,96],[160,152,150]]); p.speck([[90,84,82],[176,170,168]], 30); });
def('clay', p => p.pal([[160,166,178],[154,160,172],[166,172,184]]));
def('bedrock', p => p.pal([[86,86,86],[54,54,54],[118,118,118],[34,34,34],[70,70,70]]));
def('obsidian', p => { p.pal([[20,18,30],[16,12,24],[30,24,44],[40,30,60]]); p.speck([[62,50,90]], 10); });
function ore(name, cols) { def(name, p => { stoneBase(p); const n = 4 + ((p.r() * 2) | 0); for (let i = 0; i < n; i++) { const x = 1 + ((p.r() * 12) | 0), y = 1 + ((p.r() * 12) | 0); p.set(x, y, cols[0]); p.set(x + 1, y, cols[1]); p.set(x, y + 1, cols[1]); p.set(x + 1, y + 1, cols[2]); if (p.r() < .5) p.set(x + 2, y, cols[0]); } }); }
ore('coal_ore', [[40,40,40],[24,24,24],[60,60,60]]);
ore('iron_ore', [[216,180,152],[190,150,120],[170,130,104]]);
ore('gold_ore', [[252,238,75],[224,200,50],[180,150,30]]);
ore('redstone_ore', [[255,30,30],[200,0,0],[150,0,0]]);
ore('diamond_ore', [[140,244,226],[92,219,213],[40,180,180]]);
ore('lapis_ore', [[30,60,180],[22,44,150],[40,80,200]]);
function logSide(name, base, dark) { def(name, p => { for (let x = 0; x < 16; x++) { const c = (x % 4 === 0 || p.r() < 0.12) ? dark : base; for (let y = 0; y < 16; y++) p.set(x, y, p.r() < 0.15 ? dark : c.map(v => clamp(v + (p.r() - .5) * 12))); } }); }
logSide('log_side', [104,82,50], [74,58,34]);
logSide('spruce_log_side', [60,42,22], [42,28,14]);
def('birch_log_side', p => { p.pal([[216,216,210],[206,206,200],[226,226,222]]); for (let i = 0; i < 9; i++) { const x = (p.r()*14)|0, y = (p.r()*16)|0; p.set(x, y, [50,50,46]); p.set(x+1, y, [70,70,64]); if (p.r()<.5) p.set(x+2, y, [50,50,46]); } });
logSide('jungle_log_side', [88,70,32], [62,50,20]);
def('log_top', p => { p.noise([162,130,78], 10); for (let r = 1; r < 8; r++) { if (r % 2) for (let a = 0; a < 64; a++) { const t = a / 64 * Math.PI * 2; p.set((7.5 + Math.cos(t) * r) | 0, (7.5 + Math.sin(t) * r) | 0, [140,110,62]); } } for (let i = 0; i < 16; i++) { p.set(i, 0, [104,82,50]); p.set(i, 15, [104,82,50]); p.set(0, i, [104,82,50]); p.set(15, i, [104,82,50]); } });
function leaves(name, solid) { def(name, p => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const v = p.r(); if (v < 0.22) p.set(x, y, [0,0,0], solid ? 255 : 0); else { const g = 110 + (v * 90) | 0; p.set(x, y, [g, g, g]); } } }); }
leaves('leaves', false); leaves('leaves_opaque', true);
def('planks', p => { p.pal([[160,130,78],[152,122,72],[166,136,84]]); for (let x = 0; x < 16; x++) { p.set(x, 3, [110,88,50]); p.set(x, 7, [110,88,50]); p.set(x, 11, [110,88,50]); p.set(x, 15, [110,88,50]); } for (const [x, y] of [[4,0],[11,4],[2,8],[9,12]]) for (let k = 0; k < 3; k++) p.set(x, y + k, [126,100,58]); });
def('bricks', p => { p.pal([[150,74,58],[140,66,50],[160,84,66]]); for (let y = 0; y < 16; y += 4) { for (let x = 0; x < 16; x++) p.set(x, y + 3, [188,180,170]); const off = (y / 4) % 2 ? 4 : 0; for (let k = 0; k < 3; k++) { p.set(off, y + k, [188,180,170]); p.set(off + 8, y + k, [188,180,170]); } } });
def('stonebrick', p => { p.pal([[122,122,122],[116,116,116],[128,128,128]]); for (let x = 0; x < 16; x++) { p.set(x, 7, [72,72,72]); p.set(x, 15, [72,72,72]); p.set(x, 0, [150,150,150]); p.set(x, 8, [150,150,150]); } for (let y = 0; y < 7; y++) p.set(7, y, [72,72,72]); for (let y = 8; y < 15; y++) p.set(15, y, [72,72,72]); });
def('glass', p => { p.clear(); for (let i = 0; i < 16; i++) { p.set(i, 0, [220,240,244]); p.set(i, 15, [190,214,220]); p.set(0, i, [220,240,244]); p.set(15, i, [190,214,220]); } for (const [x, y] of [[3,3],[4,4],[5,5],[4,3],[10,9],[11,10]]) p.set(x, y, [240,250,255]); });
def('water', p => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const w = Math.sin((x + y * 0.5) * 0.8) * 8 + (p.r() - .5) * 10; p.set(x, y, [clamp(40 + w), clamp(70 + w), clamp(230 + w)], 170); } });
def('lava', p => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const v = p.r(); p.set(x, y, v < .15 ? [255,240,100] : v < .55 ? [230,110,20] : [210,80,10]); } });
def('wool', p => { p.pal([[226,226,226],[218,218,218],[234,234,234]]); });
def('tnt_side', p => { p.pal([[200,50,30],[180,40,24]]); p.rect(0, 5, 16, 6, [226,226,226]); p.rect(2, 6, 12, 4, [40,40,40]); for (const x of [3,5,8,11]) p.rect(x, 7, 1, 2, [226,226,226]); });
def('tnt_top', p => { p.pal([[180,60,40],[160,50,30]]); p.rect(6, 6, 4, 4, [60,60,60]); });
def('bookshelf', p => { defs.find(d => d[0] === 'planks')[1](p); const cols = [[150,30,30],[40,70,160],[40,130,50],[160,140,40],[110,40,120]]; for (const y0 of [1, 9]) { p.rect(1, y0, 14, 6, [60,40,20]); for (let x = 1; x < 15; x++) { const c = cols[(p.r() * cols.length) | 0]; const h = 4 + ((p.r() * 2) | 0); for (let y = y0 + 6 - h; y < y0 + 6; y++) p.set(x, y, c); } } });
def('crafting_top', p => { defs.find(d => d[0] === 'planks')[1](p); p.rect(1, 1, 14, 14, [126,90,50]); for (let i = 1; i < 15; i++) { p.set(i, 5, [80,56,30]); p.set(i, 10, [80,56,30]); p.set(5, i, [80,56,30]); p.set(10, i, [80,56,30]); } for (let i = 0; i < 16; i++) { p.set(i, 0, [80,56,30]); p.set(i, 15, [80,56,30]); p.set(0, i, [80,56,30]); p.set(15, i, [80,56,30]); } });
def('crafting_side', p => { defs.find(d => d[0] === 'planks')[1](p); p.rect(0, 0, 16, 3, [110,80,44]); p.rect(3, 6, 3, 8, [120,120,120]); p.rect(4, 4, 1, 3, [100,70,40]); p.rect(10, 5, 3, 2, [140,140,140]); p.rect(11, 7, 1, 7, [100,70,40]); });
def('furnace_side', p => { stoneBase(p); });
def('furnace_top', p => { p.pal([[110,110,110],[104,104,104],[118,118,118]]); for (let i = 0; i < 16; i++) { p.set(i, 0, [80,80,80]); p.set(i, 15, [80,80,80]); p.set(0, i, [80,80,80]); p.set(15, i, [80,80,80]); } });
def('furnace_front', p => { defs.find(d => d[0] === 'cobblestone')[1](p); p.rect(3, 8, 10, 6, [30,30,30]); p.rect(3, 7, 10, 1, [150,150,150]); p.rect(4, 3, 8, 2, [70,70,70]); });
def('furnace_front_lit', p => { defs.find(d => d[0] === 'cobblestone')[1](p); p.rect(3, 8, 10, 6, [60,20,0]); for (let x = 4; x < 12; x++) for (let y = 10; y < 14; y++) if (p.r() < .7) p.set(x, y, p.r() < .5 ? [255,180,40] : [230,90,10]); p.rect(3, 7, 10, 1, [150,150,150]); p.rect(4, 3, 8, 2, [70,70,70]); });
def('chest_top', p => { p.pal([[160,110,40],[150,102,36]]); for (let i = 0; i < 16; i++) { p.set(i, 0, [60,40,14]); p.set(i, 15, [60,40,14]); p.set(0, i, [60,40,14]); p.set(15, i, [60,40,14]); } });
def('chest_side', p => { p.pal([[160,110,40],[150,102,36]]); for (let i = 0; i < 16; i++) { p.set(i, 0, [60,40,14]); p.set(i, 15, [60,40,14]); p.set(0, i, [60,40,14]); p.set(15, i, [60,40,14]); p.set(i, 5, [60,40,14]); } });
def('chest_front', p => { defs.find(d => d[0] === 'chest_side')[1](p); p.rect(7, 4, 2, 4, [200,200,200]); p.rect(7, 7, 2, 1, [60,60,60]); });
def('cactus_side', p => { p.noise([20,120,30], 14); for (let y = 0; y < 16; y++) { p.set(0, y, [10,70,16]); p.set(15, y, [10,70,16]); } for (let y = 1; y < 16; y += 3) { p.set(3, y, [0,0,0]); p.set(12, y + 1, [0,0,0]); p.set(7, y, [200,220,180]); } });
def('cactus_top', p => { p.noise([60,150,60], 14); for (let i = 0; i < 16; i++) { p.set(i, 0, [10,70,16]); p.set(i, 15, [10,70,16]); p.set(0, i, [10,70,16]); p.set(15, i, [10,70,16]); } p.rect(6, 6, 4, 4, [140,180,90]); });
def('cactus_bottom', p => { p.noise([150,170,110], 10); });
def('reeds', p => { p.clear(); for (const x0 of [2, 7, 12]) for (let y = 0; y < 16; y++) { p.set(x0, y, [140,190,90]); p.set(x0 + 1, y, [110,160,70]); if (y % 5 === 0) { p.set(x0, y, [190,220,150]); p.set(x0 + 1, y, [190,220,150]); } } p.set(4, 3, [110,160,70]); p.set(5, 2, [110,160,70]); p.set(10, 9, [110,160,70]); });
function plant(name, fn) { def(name, p => { p.clear(); fn(p); }); }
plant('flower_red', p => { for (let y = 8; y < 16; y++) p.set(7, y, [40,110,20]); p.set(6, 11, [40,110,20]); p.set(5, 10, [40,110,20]); p.rect(5, 4, 5, 4, [200,10,10]); p.rect(6, 3, 3, 6, [200,10,10]); p.set(7, 5, [250,220,20]); p.set(6, 4, [240,60,60]); });
plant('flower_yellow', p => { for (let y = 9; y < 16; y++) p.set(7, y, [40,110,20]); p.set(8, 12, [40,110,20]); p.rect(6, 6, 3, 3, [240,240,20]); p.set(7, 5, [240,240,20]); p.set(5, 7, [240,240,20]); p.set(9, 7, [240,240,20]); p.set(7, 9, [200,200,10]); p.set(7, 7, [255,180,10]); });
plant('mushroom_red', p => { p.rect(7, 10, 2, 6, [230,220,200]); p.rect(4, 6, 8, 4, [220,20,20]); p.rect(5, 5, 6, 1, [220,20,20]); p.set(6, 7, [255,255,255]); p.set(9, 6, [255,255,255]); p.set(10, 8, [255,255,255]); });
plant('mushroom_brown', p => { p.rect(7, 10, 2, 6, [220,200,170]); p.rect(5, 8, 6, 2, [150,110,80]); p.rect(6, 7, 4, 1, [150,110,80]); });
plant('tallgrass', p => { for (let i = 0; i < 9; i++) { const x = 1 + ((p.r() * 14) | 0); const h = 6 + ((p.r() * 9) | 0); for (let y = 16 - h; y < 16; y++) { const g = 120 + ((p.r() * 70) | 0); p.set(x + (y < 10 && p.r() < .3 ? 1 : 0), y, [g, g, g]); } } });
plant('fern', p => { for (let y = 3; y < 16; y++) { p.set(7, y, [130,130,130]); if (y % 2) { p.set(5, y, [150,150,150]); p.set(6, y, [150,150,150]); p.set(9, y - 1, [150,150,150]); p.set(8, y, [150,150,150]); } } });
plant('deadbush', p => { const c = [124,80,30]; for (let y = 8; y < 16; y++) p.set(7, y, c); for (let k = 0; k < 5; k++) { p.set(7 - k, 8 - k, c); p.set(8 + k, 9 - k, c); p.set(5 + (k>2?1:0), 11 - k, c); p.set(10, 12 - k, c); } });
plant('vine', p => { for (let i = 0; i < 70; i++) { const x = (p.r() * 16) | 0, y = (p.r() * 16) | 0; const g = 100 + ((p.r() * 80) | 0); p.set(x, y, [g, g, g]); } for (let y = 0; y < 16; y++) { p.set(3, y, [120,120,120]); p.set(11, (y + 5) % 16, [120,120,120]); } });
plant('sapling', p => { for (let y = 9; y < 16; y++) p.set(7, y, [100,70,30]); for (let i = 0; i < 30; i++) { const a = p.r() * Math.PI * 2, r = p.r() * 5; p.set((7.5 + Math.cos(a) * r) | 0, (6 + Math.sin(a) * r * .8) | 0, p.r() < .5 ? [60,140,40] : [40,110,30]); } });
plant('torch', p => { p.rect(7, 6, 2, 10, [130,100,60]); p.rect(7, 5, 2, 2, [255,230,120]); p.set(7, 6, [255,200,60]); p.set(8, 6, [255,140,30]); });
plant('wheat_7', p => { for (let x = 1; x < 16; x += 3) for (let y = 3; y < 16; y++) p.set(x + (y < 8 ? 1 : 0), y, y < 8 ? [200,170,60] : [150,140,50]); });
plant('wheat_3', p => { for (let x = 1; x < 16; x += 3) for (let y = 9; y < 16; y++) p.set(x, y, [60,160,30]); });
plant('nether_wart_0', p => { for (const x of [4, 10]) { p.set(x, 13, [110, 20, 20]); p.set(x, 14, [90, 15, 15]); p.set(x, 15, [90, 15, 15]); } });
plant('nether_wart_1', p => { for (const x of [3, 7, 11]) for (let y = 10; y < 16; y++) p.set(x + (y < 12 ? 1 : 0), y, y < 12 ? [160, 30, 30] : [110, 20, 20]); });
plant('nether_wart_2', p => { for (const x of [2, 6, 10, 13]) for (let y = 6; y < 16; y++) { p.set(x, y, y < 10 ? [190, 40, 40] : [120, 25, 25]); if (y < 9) p.set(x + 1, y, [170, 35, 35]); } });
plant('brewing_stand', p => { for (let y = 2; y < 16; y++) p.set(7, y, [90, 90, 90]); p.set(7, 1, [200, 170, 60]); p.set(8, 1, [200, 170, 60]); for (let x = 1; x < 15; x++) p.set(x, 6, [110, 110, 110]); for (const x of [1, 14]) for (let y = 7; y < 12; y++) p.set(x, y, [190, 210, 230]); for (let x = 4; x < 12; x++) p.set(x, 15, [70, 70, 70]); });
def('brewing_base', p => p.noise([110, 110, 110], 14));
plant('wheat_0', p => { for (let x = 1; x < 16; x += 4) for (let y = 13; y < 16; y++) p.set(x, y, [60,170,30]); });
def('farmland', p => { p.pal([[100,66,40],[90,58,34],[110,74,46]]); for (let i = 0; i < 16; i++) { p.set(i, 0, [70,46,26]); p.set(0, i, [70,46,26]); } });
def('farmland_wet', p => { p.pal([[70,44,26],[62,38,22],[78,50,30]]); });
def('spruce_leaves', p => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const v = p.r(); if (v < 0.2) p.set(x, y, [0,0,0], 0); else { const g = 90 + (v * 70) | 0; p.set(x, y, [g, g, g]); } } });
function metalBlock(name, c) { def(name, p => { p.noise(c, 10); for (let i = 0; i < 16; i++) { p.set(i, 0, c.map(v => clamp(v + 40))); p.set(0, i, c.map(v => clamp(v + 40))); p.set(i, 15, c.map(v => clamp(v - 50))); p.set(15, i, c.map(v => clamp(v - 50))); } }); }
metalBlock('gold_block', [250,220,60]); metalBlock('iron_block', [220,220,220]); metalBlock('diamond_block', [100,220,214]); metalBlock('lapis_block', [30,64,170]);
def('pumpkin_side', p => { p.noise([200,120,20], 14); for (let x = 1; x < 16; x += 4) for (let y = 0; y < 16; y++) p.set(x, y, [170,96,10]); });
def('pumpkin_top', p => { p.noise([200,120,20], 14); p.rect(7, 6, 2, 3, [90,70,20]); });
def('netherrack', p => { p.pal([[110,50,50],[96,40,40],[124,60,58],[84,30,30]]); });
def('glowstone', p => { p.pal([[150,110,60],[200,160,90],[250,220,140],[120,90,50]]); });
def('soul_sand', p => { p.pal([[84,64,50],[74,56,42],[96,74,58]]); for (const [x,y] of [[3,4],[10,6],[6,11]]) { p.set(x,y,[40,30,22]); p.set(x+1,y,[40,30,22]); } });
def('portal', p => { // swirl
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const dx = x - 7.5, dy = y - 7.5, d = Math.hypot(dx, dy); const a = Math.atan2(dy, dx); const v = 0.5 + 0.5 * Math.sin(a * 2 + d * 0.9) * 0.6 + (p.r() - 0.5) * 0.35;
    p.set(x, y, [clamp(70 + v * 120), clamp(10 + v * 40), clamp(160 + v * 95)], 190); } });
def('mob_spawner', p => { p.clear(); // iron cage
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const bar = x % 5 === 0 || y % 5 === 0 || x === 15 || y === 15; if (!bar) continue; const edge = x === 0 || y === 0 || x === 15 || y === 15; const v = (edge ? 34 : 52) + (p.r() * 14 | 0); p.set(x, y, [v, v + 6, v + 12]); if (!edge && (x + y) % 3 === 0) p.set(x, y, [80, 90, 104]); } });
def('sponge', p => { p.noise([196,196,70], 20); p.speck([[150,150,40]], 30); });
def('bed_top', p => { p.noise([170,30,30], 10); p.rect(0, 0, 16, 5, [230,230,230]); });
def('door_wood', p => { defs.find(d => d[0] === 'planks')[1](p); p.rect(3, 2, 4, 5, [90,64,36]); p.rect(9, 2, 4, 5, [90,64,36]); p.rect(12, 8, 2, 2, [60,60,60]); });
def('door_wood_upper', p => { p.pal([[150,116,66],[140,108,60],[158,122,70]]); for (let i = 0; i < 16; i++) { p.set(i, 0, [96,72,40]); p.set(0, i, [96,72,40]); p.set(15, i, [96,72,40]); } p.rect(3, 3, 4, 10, [96,72,40]); p.rect(9, 3, 4, 10, [96,72,40]); p.rect(4, 4, 2, 8, [120,92,52]); p.rect(10, 4, 2, 8, [120,92,52]); });
def('door_wood_lower', p => { p.pal([[150,116,66],[140,108,60],[158,122,70]]); for (let i = 0; i < 16; i++) { p.set(i, 15, [96,72,40]); p.set(0, i, [96,72,40]); p.set(15, i, [96,72,40]); } for (let y = 3; y < 15; y += 4) p.rect(1, y, 14, 1, [110,84,48]); p.rect(12, 1, 2, 2, [60,60,60]); });
def('door_iron_upper', p => { p.noise([200,200,200], 10); for (let i = 0; i < 16; i++) { p.set(i, 0, [120,120,120]); p.set(0, i, [120,120,120]); p.set(15, i, [120,120,120]); } p.rect(3, 3, 4, 4, [70,70,70]); p.rect(9, 3, 4, 4, [70,70,70]); p.rect(3, 9, 10, 1, [150,150,150]); p.rect(3, 12, 10, 1, [150,150,150]); });
def('door_iron_lower', p => { p.noise([200,200,200], 10); for (let i = 0; i < 16; i++) { p.set(i, 15, [120,120,120]); p.set(0, i, [120,120,120]); p.set(15, i, [120,120,120]); } for (let y = 2; y < 15; y += 3) p.rect(2, y, 12, 1, [150,150,150]); });
def('lever', p => { p.clear(); for (let y = 6; y < 16; y++) { p.set(7, y, [150,116,66]); p.set(8, y, [104,78,47]); } p.set(7, 6, [120,120,120]); p.set(8, 6, [90,90,90]); });
def('ladder', p => { p.clear(); p.rect(2, 0, 2, 16, [120,90,50]); p.rect(12, 0, 2, 16, [120,90,50]); for (let y = 1; y < 16; y += 4) p.rect(2, y, 12, 2, [150,116,66]); });
def('slab_side', p => { p.pal([[168,168,168],[160,160,160]]); for (let x = 0; x < 16; x++) { p.set(x, 7, [100,100,100]); p.set(x, 8, [190,190,190]); p.set(x, 0, [190,190,190]); p.set(x, 15, [100,100,100]); } });
def('slab_top', p => { p.pal([[168,168,168],[160,160,160]]); for (let i = 0; i < 16; i++) { p.set(i, 0, [190,190,190]); p.set(0, i, [190,190,190]); p.set(i, 15, [100,100,100]); p.set(15, i, [100,100,100]); } });
def('melon_side', p => { p.noise([110,160,30], 14); for (let x = 1; x < 16; x += 3) for (let y = 0; y < 16; y++) if (p.r() < .8) p.set(x, y, [70,110,20]); });
def('melon_top', p => { p.noise([120,170,40], 10); });
def('snow_layer', p => p.pal([[248,252,252],[238,246,246]]));
def('cake_top', p => { p.noise([240,240,240], 8); p.speck([[220,30,30]], 6); });
def('fire', p => {
  p.clear();
  const top = [10, 8, 9, 5, 3, 7, 4, 1, 3, 6, 2, 4, 7, 5, 9, 11];
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    if (y < top[x]) continue;
    const edge = x === 0 || x === 15 || y === top[x];
    let c = edge && y < 13 ? [224, 76, 12] : [255, 143, 20];
    if (y >= top[x] + 2 && x >= 3 && x <= 12) c = [255, 218, 56];
    if (y >= 12 && x >= 2 && x <= 13) c = [255, 235, 92];
    if (y >= 14 && x >= 4 && x <= 11) c = [255, 252, 210];
    if ((x + y * 3) % 7 === 0 && y < 13) c = [245, 106, 14];
    p.set(x, y, c, 235);
  }
});
def('fire_1', p => defs.find(d => d[0] === 'fire')[1](p));
for (let i = 0; i < 10; i++) def('destroy_' + i, p => { p.clear(); const n = 6 + i * 14; for (let k = 0; k < n; k++) { const x = (p.r() * 16) | 0, y = (p.r() * 16) | 0; p.set(x, y, [0,0,0], 150); } });


// ---- 1.7 bed parts (procedural fallback; real art comes from blocks17.png) ----
const bedSide = (p, head, end) => { p.clear(); p.rect(0, 7, 16, 3, [170, 30, 30]); if (head) p.rect(end ? 0 : 9, 7, end ? 16 : 7, 3, [230, 230, 230]); p.rect(0, 10, 16, 3, [150, 116, 66]); for (const lx of end ? [0, 13] : head ? [13] : [0]) p.rect(lx, 13, 3, 3, [120, 92, 52]); };
def('bed_feet_side', p => bedSide(p, false, false)); def('bed_head_side', p => bedSide(p, true, false));
def('bed_feet_end', p => bedSide(p, false, true)); def('bed_head_end', p => bedSide(p, true, true));
def('bed_feet_top', p => { p.noise([170, 30, 30], 10); });
def('bed_head_top', p => { p.noise([170, 30, 30], 10); p.rect(8, 0, 8, 16, [230, 230, 230]); });
// ---- 1.3 - 1.7 additions ----
export const DYE = [[221,221,221],[219,125,62],[179,80,188],[107,138,201],[177,166,39],[65,174,56],[208,132,153],[64,64,64],[154,161,161],[46,110,137],[126,61,181],[46,56,141],[79,50,31],[53,70,27],[150,52,48],[25,22,22]];
const CLAY = [[209,178,161],[161,83,37],[149,88,108],[113,108,137],[186,133,35],[103,117,52],[161,78,78],[57,42,35],[135,106,97],[86,91,91],[118,70,86],[74,59,91],[77,51,35],[76,83,42],[143,61,46],[37,22,16]];
for (let i = 0; i < 16; i++) {
  def('wool_' + i, p => { const c = DYE[i]; p.pal([c, c.map(v => clamp(v * 0.93)), c.map(v => clamp(v * 1.06))]); for (let k = 0; k < 14; k++) { const x = (p.r() * 16) | 0, y = (p.r() * 16) | 0; p.set(x, y, c.map(v => clamp(v * 0.82))); } });
  def('stained_clay_' + i, p => { const c = CLAY[i]; p.noise(c, 8); p.speck([c.map(v => clamp(v * 0.9))], 20); });
  def('stained_glass_' + i, p => { const c = DYE[i]; p.clear(); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const edge = x === 0 || y === 0 || x === 15 || y === 15; p.set(x, y, edge ? c.map(v => clamp(v * 0.8)) : c, edge ? 230 : 120); } for (const [x, y] of [[3,3],[4,4],[5,5],[4,3],[10,9],[11,10]]) p.set(x, y, c.map(v => clamp(v + 60)), 170); });
}
def('hardened_clay', p => { p.noise([150,92,66], 8); p.speck([[138,84,60]], 20); });
def('coal_block', p => { p.noise([22,22,22], 10); for (let i = 0; i < 16; i++) { p.set(i, 0, [40,40,40]); p.set(0, i, [40,40,40]); p.set(i, 15, [10,10,10]); p.set(15, i, [10,10,10]); } p.speck([[48,48,48]], 14); });
def('redstone_block', p => { p.noise([170,20,8], 16); for (let i = 0; i < 16; i++) { p.set(i, 0, [220,50,30]); p.set(0, i, [220,50,30]); p.set(i, 15, [110,10,4]); p.set(15, i, [110,10,4]); } for (const [x, y] of [[4,4],[11,5],[6,10],[10,11],[3,12]]) { p.set(x, y, [255,90,70]); p.set(x + 1, y, [120,8,4]); } });
def('emerald_block', p => { p.noise([60,210,100], 14); for (let i = 0; i < 16; i++) { p.set(i, 0, [150,255,180]); p.set(0, i, [150,255,180]); p.set(i, 15, [20,120,50]); p.set(15, i, [20,120,50]); } for (let y = 3; y < 13; y += 4) for (let x = 2; x < 14; x += 4) { p.set(x, y, [200,255,215]); p.set(x + 1, y + 1, [30,150,70]); } });
def('emerald_ore', p => { stoneBase(p); for (const [x, y] of [[3,3],[10,4],[6,9],[12,11],[2,12]]) { p.set(x, y, [60,220,110]); p.set(x + 1, y, [20,140,60]); p.set(x, y + 1, [140,255,180]); p.set(x + 1, y + 1, [40,180,80]); } });
def('hay_side', p => { p.pal([[186,154,30],[170,140,24],[200,168,40]]); for (let y = 0; y < 16; y++) if (p.r() < 0.4) p.set((p.r() * 16) | 0, y, [140,110,14]); for (const y of [2, 3, 12, 13]) for (let x = 0; x < 16; x++) p.set(x, y, y === 2 || y === 12 ? [110,74,30] : [90,60,24]); });
def('hay_top', p => { p.noise([176,144,28], 18); for (let i = 0; i < 40; i++) p.set((p.r() * 16) | 0, (p.r() * 16) | 0, [130,100,14]); for (let i = 0; i < 16; i++) { p.set(i, 0, [150,120,20]); p.set(0, i, [150,120,20]); p.set(i, 15, [120,94,14]); p.set(15, i, [120,94,14]); } });
def('red_sand', p => { p.pal([[169,88,33],[160,82,30],[178,96,40],[152,76,26]]); p.speck([[140,70,22],[190,106,48]], 20); });
def('coarse_dirt', p => { p.pal(DIRT); p.speck([[96,67,45],[160,118,84],[110,110,110],[90,90,90]], 40); });
def('podzol_top', p => { p.pal([[92,63,24],[106,74,30],[80,54,20],[122,86,40]]); p.speck([[60,40,14],[140,100,50]], 30); });
def('podzol_side', p => { p.pal(DIRT); p.speck([[96,67,45],[160,118,84]], 14); for (let x = 0; x < 16; x++) { const d = 2 + ((p.r() * 3) | 0); for (let y = 0; y < d; y++) p.set(x, y, p.r() < .5 ? [92,63,24] : [106,74,30]); } });
logSide('acacia_log_side', [104,98,88], [78,72,64]);
logSide('dark_oak_log_side', [62,48,28], [44,32,18]);
def('acacia_log_top', p => { p.noise([170,90,50], 10); for (let r = 1; r < 8; r += 2) for (let a = 0; a < 64; a++) { const q = a / 64 * Math.PI * 2; p.set((7.5 + Math.cos(q) * r) | 0, (7.5 + Math.sin(q) * r) | 0, [150,76,40]); } for (let i = 0; i < 16; i++) { p.set(i, 0, [104,98,88]); p.set(i, 15, [104,98,88]); p.set(0, i, [104,98,88]); p.set(15, i, [104,98,88]); } });
def('dark_oak_log_top', p => { p.noise([88,64,36], 10); for (let r = 1; r < 8; r += 2) for (let a = 0; a < 64; a++) { const q = a / 64 * Math.PI * 2; p.set((7.5 + Math.cos(q) * r) | 0, (7.5 + Math.sin(q) * r) | 0, [70,50,28]); } for (let i = 0; i < 16; i++) { p.set(i, 0, [62,48,28]); p.set(i, 15, [62,48,28]); p.set(0, i, [62,48,28]); p.set(15, i, [62,48,28]); } });
function planksOf(name, c) { def(name, p => { const d = c.map(v => clamp(v * 0.7)), m = c.map(v => clamp(v * 0.84)); p.pal([c, c.map(v => clamp(v * 0.95)), c.map(v => clamp(v * 1.04))]); for (let x = 0; x < 16; x++) for (const y of [3, 7, 11, 15]) p.set(x, y, d); for (const [x, y] of [[4,0],[11,4],[2,8],[9,12]]) for (let k = 0; k < 3; k++) p.set(x, y + k, m); }); }
planksOf('planks_spruce', [104,78,47]); planksOf('planks_birch', [196,178,123]); planksOf('planks_jungle', [160,115,80]); planksOf('planks_acacia', [168,90,50]); planksOf('planks_dark_oak', [66,43,20]);
// acacia/dark oak leaves reuse the grey leaves shapes (biome-tinted at mesh time)
def('acacia_leaves', p => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const v = p.r(); if (v < 0.25) p.set(x, y, [0,0,0], 0); else { const g = 100 + (v * 80) | 0; p.set(x, y, [g, g, g]); } } });
def('dark_oak_leaves', p => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const v = p.r(); if (v < 0.15) p.set(x, y, [0,0,0], 0); else { const g = 80 + (v * 80) | 0; p.set(x, y, [g, g, g]); } } });
// 1.7 flowers
const stem = (p, y0 = 8) => { for (let y = y0; y < 16; y++) p.set(7, y, [40,110,20]); p.set(6, 12, [50,130,26]); p.set(8, 11, [50,130,26]); p.set(5, 11, [50,130,26]); p.set(9, 10, [50,130,26]); };
const petals = (p, c, hi) => { p.rect(6, 4, 3, 3, c); p.set(7, 3, c); p.set(5, 5, c); p.set(9, 5, c); p.set(7, 7, c); if (hi) p.set(7, 5, hi); };
const tulip = c => p => { stem(p, 7); p.rect(6, 3, 3, 5, c); p.set(5, 4, c); p.set(9, 4, c); p.set(5, 2, c); p.set(7, 2, c); p.set(9, 2, c); p.set(7, 5, c.map(v => clamp(v * 0.8))); };
plant('poppy', p => { stem(p); p.rect(5, 4, 6, 4, [205,20,20]); p.rect(6, 3, 4, 6, [205,20,20]); p.rect(7, 5, 2, 2, [40,30,20]); p.set(6, 4, [240,70,60]); });
plant('blue_orchid', p => { stem(p, 7); for (const [x, y] of [[5,3],[9,3],[7,2],[4,6],[10,6],[6,5],[8,5]]) { p.set(x, y, [40,170,230]); p.set(x + 1, y, [90,200,250]); p.set(x, y + 1, [30,130,200]); } });
plant('allium', p => { for (let y = 7; y < 16; y++) p.set(7, y, [60,120,30]); for (let y = 1; y < 8; y++) for (let x = 4; x < 11; x++) if (Math.hypot(x - 7, y - 4) < 3.3) p.set(x, y, p.r() < 0.4 ? [220,140,240] : [170,90,210]); });
plant('azure_bluet', p => { for (const [x, y] of [[4,6],[9,4],[6,9],[11,8]]) { for (let k = y + 2; k < 16; k++) p.set(x + 1, k, [70,130,40]); p.set(x, y, [230,230,240]); p.set(x + 2, y, [230,230,240]); p.set(x + 1, y - 1, [230,230,240]); p.set(x + 1, y + 1, [230,230,240]); p.set(x + 1, y, [240,220,60]); } });
plant('tulip_red', tulip([210,40,30])); plant('tulip_orange', tulip([235,120,30])); plant('tulip_white', tulip([235,235,235])); plant('tulip_pink', tulip([235,160,200]));
plant('oxeye_daisy', p => { stem(p); petals(p, [245,245,245], [250,200,30]); p.rect(5, 3, 1, 1, [245,245,245]); p.rect(9, 3, 1, 1, [245,245,245]); p.rect(5, 7, 1, 1, [245,245,245]); p.rect(9, 7, 1, 1, [245,245,245]); });
plant('acacia_sapling', p => { for (let y = 7; y < 16; y++) p.set(7 + (y < 10 ? 1 : 0), y, [110,90,60]); for (let i = 0; i < 26; i++) { const a = p.r() * Math.PI * 2, r = p.r() * 5; p.set((8 + Math.cos(a) * r) | 0, (5 + Math.sin(a) * r * .5) | 0, p.r() < .5 ? [110,140,40] : [90,120,30]); } });
plant('dark_oak_sapling', p => { for (let y = 9; y < 16; y++) p.set(7, y, [70,50,24]); for (let i = 0; i < 34; i++) { const a = p.r() * Math.PI * 2, r = p.r() * 5; p.set((7.5 + Math.cos(a) * r) | 0, (6 + Math.sin(a) * r * .8) | 0, p.r() < .5 ? [40,90,20] : [30,70,16]); } });

// pistons, note block, jukebox
const runDef = (name, p) => defs.find(d => d[0] === name)[1](p);
const pistonPlanks = p => { p.pal([[160,128,78],[150,118,70],[170,136,84]]); for (let x = 0; x < 16; x++) { p.set(x, 0, [110,86,50]); p.set(x, 15, [110,86,50]); p.set(0, x, [110,86,50]); p.set(15, x, [110,86,50]); } for (const y of [5, 10]) for (let x = 1; x < 15; x++) p.set(x, y, [128,100,60]); };
def('piston_side', p => { runDef('cobblestone', p); for (let y = 0; y < 4; y++) for (let x = 0; x < 16; x++) p.set(x, y, y === 3 ? [100,78,46] : [156,124,74].map(v => clamp(v + (p.r() - 0.5) * 16))); for (let x = 0; x < 16; x++) p.set(x, 0, [120,94,56]); });
def('piston_top', p => { pistonPlanks(p); p.rect(6, 6, 4, 4, [150,150,150]); p.rect(6, 6, 4, 1, [180,180,180]); p.rect(6, 9, 4, 1, [100,100,100]); });
def('piston_top_sticky', p => { pistonPlanks(p); for (let y = 2; y < 14; y++) for (let x = 2; x < 14; x++) if (Math.hypot(x - 7.5, y - 7.5) < 6 - p.r() * 0.8) p.set(x, y, p.r() < 0.3 ? [140,210,110] : [110,190,90]); });
def('piston_bottom', p => { runDef('cobblestone', p); p.rect(5, 5, 6, 6, [70,70,70]); p.rect(6, 6, 4, 4, [140,140,140]); });
def('piston_inner', p => { runDef('cobblestone', p); p.rect(5, 5, 6, 6, [60,60,60]); p.rect(6, 6, 4, 4, [120,120,120]); });
def('piston_arm', p => { p.pal([[156,124,74],[148,116,68],[164,130,80]]); for (let y = 0; y < 16; y++) { p.set(6, y, [110,86,50]); p.set(9, y, [110,86,50]); } });
def('noteblock', p => { p.pal([[112,74,50],[104,68,46],[120,80,54]]); for (let i = 0; i < 16; i++) { p.set(i, 0, [70,46,30]); p.set(0, i, [70,46,30]); p.set(i, 15, [70,46,30]); p.set(15, i, [70,46,30]); } for (const y of [4, 8, 12]) for (let x = 3; x < 13; x++) p.set(x, y, [60,40,26]); });
def('jukebox_side', p => runDef('noteblock', p));
def('jukebox_top', p => { runDef('noteblock', p); for (let y = 3; y < 13; y++) for (let x = 3; x < 13; x++) if (Math.hypot(x - 7.5, y - 7.5) < 4.5) p.set(x, y, [30,24,20]); });
// redstone components, quartz, nether brick
def('redstone_dust_cross', p => { p.clear(); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const c = Math.abs(x - 7.5) < 2.5 || Math.abs(y - 7.5) < 2.5; if (c && Math.abs(x - 7.5) + Math.abs(y - 7.5) < 11 && p.r() < 0.8) { const v = 200 + p.r() * 55 | 0; p.set(x, y, [v, v, v]); } } });
def('redstone_dust_line', p => { p.clear(); for (let x = 0; x < 16; x++) for (let y = 6; y < 10; y++) if (p.r() < 0.75) { const v = 200 + p.r() * 55 | 0; p.set(x, y, [v, v, v]); } });
const rsTorch = on => p => { p.clear(); for (let y = 6; y < 16; y++) { p.set(7, y, [110,84,50]); p.set(8, y, [90,68,40]); } const c = on ? [255,40,30] : [90,20,20]; p.set(7, 6, c); p.set(8, 6, c); p.set(7, 7, on ? [255,140,120] : [110,40,40]); p.set(8, 7, c); };
def('redstone_torch_on', rsTorch(true)); def('redstone_torch_off', rsTorch(false));
const repeater = on => p => { stoneBase(p); for (let i = 0; i < 16; i++) { p.set(i, 0, [150,150,150]); p.set(0, i, [150,150,150]); } for (let y = 3; y < 13; y++) p.set(7, y, on ? [230,30,20] : [110,20,20]); p.set(6, 4, [230,230,230]); p.set(8, 4, [230,230,230]); p.set(7, 3, [230,230,230]); };
def('repeater_off', repeater(false)); def('repeater_on', repeater(true));
const lamp = on => p => { p.pal(on ? [[240,190,110],[220,160,80],[250,210,140]] : [[110,70,40],[96,60,34],[124,80,46]]); for (let i = 0; i < 16; i++) { p.set(i, 0, [60,36,20]); p.set(0, i, [60,36,20]); p.set(i, 15, [60,36,20]); p.set(15, i, [60,36,20]); } for (const k of [5, 10]) for (let i = 1; i < 15; i++) { p.set(i, k, [70,44,24]); p.set(k, i, [70,44,24]); } };
def('redstone_lamp_off', lamp(false)); def('redstone_lamp_on', lamp(true));
const QZ = [[236,230,222],[230,224,216],[240,236,228]];
def('quartz_side', p => { p.pal(QZ); }); def('quartz_top', p => { p.pal(QZ); }); def('quartz_bottom', p => { p.pal(QZ); p.speck([[214,208,200]], 12); });
def('quartz_chiseled_side', p => { p.pal(QZ); for (let i = 1; i < 15; i++) { p.set(i, 1, [200,194,186]); p.set(i, 14, [200,194,186]); } for (let y = 4; y < 12; y++) for (let x = 4; x < 12; x++) if ((x + y) % 4 === 0) p.set(x, y, [206,200,192]); });
def('quartz_chiseled_top', p => { p.pal(QZ); for (let i = 1; i < 15; i++) { p.set(i, 1, [200,194,186]); p.set(1, i, [200,194,186]); p.set(i, 14, [200,194,186]); p.set(14, i, [200,194,186]); } p.rect(6, 6, 4, 4, [210,204,196]); });
def('quartz_pillar_side', p => { p.pal(QZ); for (const x of [0, 3, 12, 15]) for (let y = 0; y < 16; y++) p.set(x, y, [208,202,194]); });
def('quartz_pillar_top', p => { p.pal(QZ); for (let i = 0; i < 16; i++) { p.set(i, 0, [200,194,186]); p.set(0, i, [200,194,186]); p.set(i, 15, [200,194,186]); p.set(15, i, [200,194,186]); } p.rect(4, 4, 8, 8, [222,216,208]); });
def('quartz_ore', p => { p.pal([[112,54,52],[98,44,42],[124,62,58],[86,38,36]]); for (let i = 0; i < 7; i++) { const x = 1 + ((p.r() * 13) | 0), y = 1 + ((p.r() * 13) | 0); p.set(x, y, [236,230,222]); p.set(x + 1, y, [206,200,192]); if (p.r() < .6) p.set(x, y + 1, [220,214,206]); } });
def('nether_brick', p => { p.pal([[44,22,26],[50,26,30],[40,20,24]]); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const row = y >> 2, off = row & 1 ? 4 : 0; if (y % 4 === 3 || (x + off) % 8 === 7) p.set(x, y, [22,10,12]); else if (y % 4 === 0) p.set(x, y, [66,34,38]); } });

// texture-pack overrides: atlas tile name -> [col,row] in terrain.png (classic layout)
const TERRAIN = { stone: [1, 0], cobblestone: [0, 1], mossy_cobblestone: [4, 2], dirt: [2, 0], grass_top: [0, 0], grass_side: [3, 0], grass_side_snow: [4, 4], snow: [2, 4], ice: [3, 4], sand: [2, 1],
  sandstone_side: [0, 12], sandstone_top: [0, 11], sandstone_bottom: [0, 13], gravel: [3, 1], clay: [8, 4], bedrock: [1, 1], obsidian: [5, 2], coal_ore: [2, 2], iron_ore: [1, 2], gold_ore: [0, 2],
  redstone_ore: [3, 3], diamond_ore: [2, 3], lapis_ore: [0, 10], log_side: [4, 1], spruce_log_side: [4, 7], birch_log_side: [5, 7], jungle_log_side: [9, 9], log_top: [5, 1], leaves: [4, 3], leaves_opaque: [5, 3],
  planks: [4, 0], bricks: [7, 0], stonebrick: [6, 3], glass: [1, 3], water: [13, 12], lava: [13, 14], wool: [0, 4], tnt_side: [8, 0], tnt_top: [9, 0], bookshelf: [3, 2],
  crafting_top: [11, 2], crafting_side: [11, 3], furnace_side: [13, 2], furnace_top: [14, 3], furnace_front: [12, 2], furnace_front_lit: [13, 3], chest_top: [9, 1], chest_side: [10, 1], chest_front: [11, 1],
  cactus_side: [6, 4], cactus_top: [5, 4], cactus_bottom: [7, 4], reeds: [9, 4], flower_red: [12, 0], flower_yellow: [13, 0], mushroom_red: [12, 1], mushroom_brown: [13, 1], tallgrass: [7, 2], fern: [8, 3], deadbush: [7, 3],
  vine: [15, 8], sapling: [15, 0], torch: [0, 5], wheat_7: [15, 5], wheat_3: [11, 5], wheat_0: [8, 5], farmland: [7, 5], farmland_wet: [6, 5], spruce_leaves: [4, 8], gold_block: [7, 1], iron_block: [6, 1],
  diamond_block: [8, 1], lapis_block: [0, 9], pumpkin_side: [6, 7], pumpkin_top: [6, 6], netherrack: [7, 6], glowstone: [9, 6], soul_sand: [8, 6], sponge: [0, 3], bed_top: [6, 8], door_wood: [1, 6], door_wood_upper: [1, 5], door_wood_lower: [1, 6], door_iron_upper: [2, 5], door_iron_lower: [2, 6], lever: [0, 6], ladder: [3, 5],
  slab_side: [5, 0], slab_top: [6, 0], melon_side: [8, 8], melon_top: [9, 8], snow_layer: [2, 4], cake_top: [9, 7], portal: [14, 0], mob_spawner: [1, 4] };
for (let i = 0; i < 10; i++) TERRAIN['destroy_' + i] = [i, 15];
TERRAIN.wool_0 = [0, 4]; for (let m = 1; m < 16; m++) TERRAIN['wool_' + m] = [1 + (m < 8 ? 1 : 0), 7 + (~m & 7)];
Object.assign(TERRAIN, { planks_spruce: [6, 12], planks_birch: [6, 13], planks_jungle: [7, 12] });
// ---- rails and the command block ----
function railTile(p, turned, rail, accent) { p.clear(); const TIE = [[110, 80, 45], [96, 68, 38]];
  if (!turned) { for (let y = 1; y < 16; y += 4) p.rect(1, y, 14, 2, TIE[(y >> 2) & 1]); for (let y = 0; y < 16; y++) { p.set(3, y, rail); p.set(12, y, rail); p.set(4, y, [rail[0] * 0.7, rail[1] * 0.7, rail[2] * 0.7]); p.set(11, y, [rail[0] * 0.7, rail[1] * 0.7, rail[2] * 0.7]); if (accent && y % 4 === 1) { p.set(5, y, accent); p.set(10, y, accent); } } }
  else { for (let i = 0; i < 4; i++) p.rect(1 + i * 3, 1 + i * 3, 4, 3, TIE[i & 1]); for (let a = 0; a <= 90; a += 2) { const r1 = 12.5, r2 = 3.5, t = a * Math.PI / 180; p.set(Math.round(16 - r1 * Math.cos(t)) , Math.round(16 - r1 * Math.sin(t)), rail); p.set(Math.round(16 - r2 * Math.cos(t)), Math.round(16 - r2 * Math.sin(t)), rail); } } }
def('rail_normal', p => railTile(p, false, [160, 160, 166]));
def('rail_normal_turned', p => railTile(p, true, [160, 160, 166]));
def('rail_golden', p => railTile(p, false, [220, 190, 60], [90, 20, 20]));
def('rail_golden_powered', p => railTile(p, false, [240, 210, 70], [255, 60, 40]));
def('rail_detector', p => { railTile(p, false, [150, 150, 150]); p.rect(6, 6, 4, 4, [110, 110, 110]); p.rect(7, 7, 2, 2, [90, 20, 20]); });
def('rail_detector_powered', p => { railTile(p, false, [150, 150, 150]); p.rect(6, 6, 4, 4, [110, 110, 110]); p.rect(7, 7, 2, 2, [255, 50, 30]); });
def('rail_activator', p => railTile(p, false, [150, 150, 150], [110, 30, 30]));
def('rail_activator_powered', p => railTile(p, false, [160, 160, 160], [230, 50, 40]));
def('command_block', p => { p.pal([[176, 140, 104], [168, 132, 98], [184, 148, 112]]); p.rect(0, 0, 16, 1, [120, 92, 66]); p.rect(0, 15, 16, 1, [120, 92, 66]); p.rect(0, 0, 1, 16, [120, 92, 66]); p.rect(15, 0, 1, 16, [120, 92, 66]);
  for (const [x, y] of [[3, 3], [12, 3], [3, 12], [12, 12]]) p.rect(x - 1, y - 1, 2, 2, [96, 72, 52]); p.rect(5, 5, 6, 6, [96, 72, 52]); p.rect(6, 6, 4, 4, [210, 180, 140]); p.rect(7, 7, 2, 2, [140, 100, 70]); });
// 1.7 block textures (stitched atlas, 32x16 tiles) override the classic sheet
const B17 = { stone: [19, 8], cobblestone: [2, 5], mossy_cobblestone: [3, 5], dirt: [8, 4], grass_top: [3, 10], grass_side: [0, 10], grass_side_snow: [2, 10], snow: [19, 5], snow_layer: [19, 5], ice: [11, 11], packed_ice: [12, 11],
  sand: [18, 9], red_sand: [17, 11], sandstone_side: [18, 12], sandstone_top: [18, 14], sandstone_bottom: [18, 10], gravel: [4, 10], clay: [7, 4], hardened_clay: [5, 10], bedrock: [4, 3], obsidian: [4, 15],
  coal_ore: [1, 5], iron_ore: [15, 11], gold_ore: [15, 9], redstone_ore: [18, 3], diamond_ore: [8, 3], lapis_ore: [5, 12], emerald_ore: [11, 7],
  log_side: [12, 13], log_top: [13, 13], spruce_log_side: [14, 13], birch_log_side: [8, 13], jungle_log_side: [10, 13], acacia_log_side: [4, 13], acacia_log_top: [5, 13], dark_oak_log_side: [6, 13], dark_oak_log_top: [7, 13],
  leaves: [15, 12], leaves_opaque: [0, 13], spruce_leaves: [1, 13], acacia_leaves: [7, 12], dark_oak_leaves: [9, 12],
  planks: [14, 15], planks_spruce: [15, 15], planks_birch: [12, 15], planks_jungle: [13, 15], planks_acacia: [10, 15], planks_dark_oak: [11, 15],
  bricks: [5, 3], stonebrick: [19, 11], bookshelf: [5, 0], crafting_top: [4, 6], crafting_side: [3, 6], furnace_side: [15, 1], furnace_top: [15, 2], furnace_front: [14, 7], furnace_front_lit: [15, 0],
  cactus_side: [6, 1], cactus_top: [6, 0], cactus_bottom: [6, 2], reeds: [18, 6], flower_red: [14, 2], flower_yellow: [13, 6], poppy: [14, 2], blue_orchid: [13, 5], allium: [13, 4], azure_bluet: [13, 7],
  tulip_red: [14, 5], tulip_orange: [14, 3], tulip_white: [14, 6], tulip_pink: [14, 4], oxeye_daisy: [14, 0], mushroom_red: [11, 14], mushroom_brown: [10, 14], tallgrass: [19, 15], fern: [13, 1], deadbush: [7, 6],
  vine: [20, 7], sapling: [19, 2], acacia_sapling: [18, 15], dark_oak_sapling: [19, 3], torch: [20, 3], wheat_0: [20, 11], wheat_3: [20, 14], wheat_7: [21, 2],
  gold_block: [14, 9], iron_block: [14, 11], diamond_block: [8, 2], lapis_block: [4, 12], emerald_block: [11, 6], coal_block: [0, 5], redstone_block: [17, 12],
  pumpkin_side: [16, 7], pumpkin_top: [16, 10], netherrack: [2, 15], glowstone: [13, 9], soul_sand: [19, 6], portal: [16, 0], mob_spawner: [5, 14], sponge: [19, 7],
  door_wood: [9, 3], door_wood_lower: [9, 3], door_wood_upper: [9, 4], door_iron_lower: [9, 1], door_iron_upper: [9, 2], lever: [3, 13], ladder: [3, 12], slab_side: [19, 9], slab_top: [19, 10],
  melon_side: [0, 14], melon_top: [3, 14], podzol_side: [8, 5], podzol_top: [8, 6], hay_side: [6, 11], hay_top: [7, 11], tnt_side: [20, 1], tnt_top: [20, 2], cake_top: [7, 2], water: [20, 8], lava: [6, 12],
  jukebox_top: [0, 12], jukebox_side: [1, 12], noteblock: [3, 15],
  bed_feet_end: [1, 3], bed_feet_side: [2, 3], bed_feet_top: [3, 3], bed_head_end: [4, 0], bed_head_side: [4, 1], bed_head_top: [4, 2] };
{ // dye colours in atlas (alphabetical) order -> block meta
  const META = [15, 11, 12, 9, 7, 13, 3, 5, 2, 1, 6, 10, 14, 8, 0, 4];
  const run = (c, r, n) => { const o = []; for (let k = 0; k < n; k++) { o.push([c, r]); if (++r > 15) { r = 0; c++; } } return o; };
  const glass = [...run(15, 4, 4), ...[0, 1, 2, 3, 4, 5].map(c => [c, 8]), ...[7, 8, 9, 10, 11, 12].map(c => [c, 9])];
  const clay = [...[6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map(c => [c, 10]), ...[0, 1, 2, 3, 4, 5].map(c => [c, 11])];
  const wool = run(21, 3, 16);
  META.forEach((m, i) => { B17['stained_clay_' + m] = clay[i]; B17['wool_' + m] = wool[i]; });
  B17.wool = B17.wool_0;
}
Object.assign(B17, { redstone_dust_cross: [17, 13], redstone_dust_line: [17, 15], redstone_torch_on: [18, 5], redstone_torch_off: [18, 4], repeater_off: [18, 7], repeater_on: [18, 8],
  redstone_lamp_off: [18, 1], redstone_lamp_on: [18, 2], quartz_side: [16, 11], quartz_top: [17, 0], quartz_bottom: [17, 1], quartz_chiseled_side: [16, 12], quartz_chiseled_top: [16, 13],
  quartz_pillar_side: [16, 14], quartz_pillar_top: [16, 15], quartz_ore: [17, 2],
  rail_activator: [17, 3], rail_activator_powered: [17, 4], rail_detector: [17, 5], rail_detector_powered: [17, 6], rail_golden: [17, 7], rail_golden_powered: [17, 8], rail_normal: [17, 9], rail_normal_turned: [17, 10] });
function applyPack(ctx) {
  for (const [name, [c, r]] of Object.entries(TERRAIN)) {
    const i = tiles[name]; if (i === undefined) continue; const d = cell('terrain', c, r); if (!d) continue;
    if (name.startsWith('destroy_')) { const p = d.data; // pack cracks sit on an opaque stone background: keep only the dark crack lines
      for (let k = 0; k < p.length; k += 4) { const dark = p[k] + p[k + 1] + p[k + 2] < 260; p[k] = p[k + 1] = p[k + 2] = 0; p[k + 3] = dark ? 170 : 0; } }
    ctx.putImageData(d, (i % COLS) * TILE, ((i / COLS) | 0) * TILE);
  }
  for (const [name, [c, r]] of Object.entries(B17)) { const i = tiles[name]; if (i === undefined) continue; const d = cell('blocks17', c, r); if (d) ctx.putImageData(d, (i % COLS) * TILE, ((i / COLS) | 0) * TILE); }
  // single-file block textures win over both sheets
  for (const name of Object.keys(tiles)) { const im = PACK['block:' + name]; if (!im) continue; const i = tiles[name], x = (i % COLS) * TILE, y = ((i / COLS) | 0) * TILE; ctx.clearRect(x, y, 16, 16); ctx.drawImage(im, 0, 0, im.width, im.height, x, y, 16, 16); }
  // piston arm: the wooden strip along the top of the side texture, turned to run the length of the arm
  { const si = tiles.piston_side, ai = tiles.piston_arm; const sx = (si % COLS) * TILE, sy = ((si / COLS) | 0) * TILE, ax = (ai % COLS) * TILE, ay = ((ai / COLS) | 0) * TILE;
    const src = ctx.getImageData(sx, sy, 16, 4), out = ctx.createImageData(16, 16);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const k = ((x - 6) % 4 + 4) % 4, s = (k * 16 + y) * 4, o = (y * 16 + x) * 4; for (let c = 0; c < 4; c++) out.data[o + c] = src.data[s + c]; }
    ctx.putImageData(out, ax, ay); }
}

let canvas = null;
export function buildAtlas() {
  if (canvas) return canvas;
  const rows = Math.ceil(nextTile / COLS);
  canvas = document.createElement('canvas'); canvas.width = COLS * TILE; canvas.height = Math.max(16, 2 ** Math.ceil(Math.log2(rows))) * TILE;
  const ctx = canvas.getContext('2d');
  for (const [name, fn] of defs) { const p = new Px(name); fn(p); const img = new ImageData(p.d, 16, 16); const i = tiles[name]; ctx.putImageData(img, (i % COLS) * TILE, ((i / COLS) | 0) * TILE); }
  applyPack(ctx);
  return canvas;
}
// animated fire: 32-frame 16x16 strip, two layers half a cycle apart
const fireImg = new Image(); let fireReady = false; fireImg.onload = () => { fireReady = true; }; fireImg.src = new URL('../../textures/fire.png', import.meta.url).href;
export function animateFire(frame) {
  if (!fireReady || !canvas) return false; const ctx = canvas.getContext('2d'); const n = Math.floor(fireImg.height / 16);
  for (const [name, off] of [['fire', 0], ['fire_1', n >> 1]]) { const i = tiles[name]; const x = (i % COLS) * TILE, y = ((i / COLS) | 0) * TILE;
    ctx.clearRect(x, y, 16, 16); ctx.drawImage(fireImg, 0, ((frame + off) % n) * 16, 16, 16, x, y, 16, 16); }
  return true;
}
export function atlasRows() { return canvas.height / TILE; }
// draw a single tile onto a 2d context (for icons)
export function drawTile(ctx, name, x, y, size, tint) {
  const i = tiles[name]; if (i === undefined) return;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(buildAtlas(), (i % COLS) * TILE, ((i / COLS) | 0) * TILE, 16, 16, x, y, size, size);
}
