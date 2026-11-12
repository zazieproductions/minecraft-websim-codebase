// Classic 1.2.5 crafting & smelting recipes
import { I } from './items.js';
const R = [];
// shaped: pattern rows, key map char -> id (or [id, dmg]); out [id, count, dmg]
function shaped(out, pattern, key) { R.push({ out, pattern, key }); }
function shapeless(out, ins) { R.push({ out, ins }); }
const P = 5, ST = 280, CB = 4, IR = 265, GD = 266, DM = 264, LOG = 17;
const mats = [[P, 'wood', 'wooden'], [CB, 'stone'], [IR, 'iron'], [DM, 'diamond'], [GD, 'gold']];
for (let m = 0; m < 4; m++) shapeless([P, 4, m], [[LOG, m]]);
for (let m = 0; m < 2; m++) shapeless([P, 4, 4 + m], [[162, m]]);
shaped([ST, 4], ['#', '#'], { '#': P });
shaped([58, 1], ['##', '##'], { '#': P });
shaped([66, 16], ['I I', 'ISI', 'I I'], { I: 265, S: 280 });
shaped([27, 6], ['G G', 'GSG', 'GRG'], { G: 266, S: 280, R: 331 });
shaped([28, 6], ['I I', 'IPI', 'IRI'], { I: 265, P: 70, R: 331 });
shaped([157, 6], ['ISI', 'ITI', 'ISI'], { I: 265, S: 280, T: 76 });
shaped([61, 1], ['###', '# #', '###'], { '#': CB });
shaped([54, 1], ['###', '# #', '###'], { '#': P });
shaped([50, 4], ['C', 'S'], { C: 263, S: ST });
shaped([50, 4], ['C', 'S'], { C: [263, 1], S: ST });
for (const [m, n] of mats) {
  const k = { '#': m, S: ST };
  shaped([I[n.toUpperCase() + '_PICKAXE'], 1], ['###', ' S ', ' S '], k);
  shaped([I[n.toUpperCase() + '_AXE'], 1], ['##', '#S', ' S'], k);
  shaped([I[n.toUpperCase() + '_SHOVEL'], 1], ['#', 'S', 'S'], k);
  shaped([I[n.toUpperCase() + '_SWORD'], 1], ['#', '#', 'S'], k);
  shaped([I[n.toUpperCase() + '_HOE'], 1], ['##', ' S', ' S'], k);
}
for (const [m, n] of [[334, 'leather'], [51, 'chain'], [IR, 'iron'], [DM, 'diamond'], [GD, 'gold']]) {
  if (n === 'chain') continue;
  const k = { '#': m };
  shaped([I[n.toUpperCase() + '_HELMET'], 1], ['###', '# #'], k);
  shaped([I[n.toUpperCase() + '_CHESTPLATE'], 1], ['# #', '###', '###'], k);
  shaped([I[n.toUpperCase() + '_LEGGINGS'], 1], ['###', '# #', '# #'], k);
  shaped([I[n.toUpperCase() + '_BOOTS'], 1], ['# #', '# #'], k);
}
shaped([325, 1], ['# #', ' # '], { '#': IR });
shapeless([259, 1], [IR, 318]);
shaped([261, 1], [' #S', '# S', ' #S'], { '#': ST, S: 287 });
shaped([262, 4], ['F', '#', 'E'], { F: 318, '#': ST, E: 288 });
shaped([281, 4], ['# #', ' # '], { '#': P });
shapeless([282, 1], [39, 40, 281]);
shaped([297, 1], ['###'], { '#': 296 });
shaped([339, 3], ['###'], { '#': 338 });
shapeless([340, 1], [339, 339, 339]);
shaped([47, 1], ['###', 'BBB', '###'], { '#': P, B: 340 });
shaped([24, 1], ['##', '##'], { '#': 12 });
shaped([98, 4], ['##', '##'], { '#': 1 });
shaped([44, 6], ['###'], { '#': 1 });
shaped([82, 1], ['##', '##'], { '#': 337 });
shaped([45, 1], ['##', '##'], { '#': 336 });
shaped([80, 1], ['##', '##'], { '#': 332 });
shaped([35, 1], ['##', '##'], { '#': 287 });
shaped([89, 1], ['##', '##'], { '#': 348 });
shaped([65, 2], ['# #', '###', '# #'], { '#': ST });
shaped([355, 1], ['WWW', 'PPP'], { W: 35, P: P });
shaped([324, 1], ['##', '##', '##'], { '#': P });
shaped([330, 1], ['##', '##', '##'], { '#': IR });
shaped([33, 1], ['PPP', 'CIC', 'CRC'], { P: P, C: CB, I: IR, R: 331 });
shaped([29, 1], ['S', 'P'], { S: 341, P: 33 });
shaped([25, 1], ['PPP', 'PRP', 'PPP'], { P: P, R: 331 });
shaped([84, 1], ['PPP', 'PDP', 'PPP'], { P: P, D: DM });
shaped([69, 1], ['S', 'C'], { S: ST, C: CB });
shaped([323, 1], ['###', '###', ' S '], { '#': P, S: ST });
shaped([333, 1], ['# #', '###'], { '#': P });
shaped([328, 1], ['# #', '###'], { '#': IR });
shaped([342, 1], ['C', 'M'], { C: 54, M: 328 });
shaped([46, 1], ['X#X', '#X#', 'X#X'], { X: 289, '#': 12 });
shaped([322, 1], ['###', '#A#', '###'], { '#': 41, A: 260 });
shaped([396, 1], ['###', '#A#', '###'], { '#': 371, A: 391 });
shaped([359, 1], [' #', '# '], { '#': IR });
shaped([345, 1], [' # ', '#R#', ' # '], { '#': IR, R: 331 });
shaped([347, 1], [' # ', '#R#', ' # '], { '#': GD, R: 331 });
shaped([354, 1], ['MMM', 'SES', 'WWW'], { M: 335, S: 353, E: 344, W: 296 });
shaped([357, 8], ['#X#'], { '#': 296, X: [351, 3] });
shapeless([353, 1], [338]);
for (const [blk, it] of [[41, GD], [42, IR], [57, DM], [22, [351, 4]]]) { shaped([blk, 1], ['###', '###', '###'], { '#': it }); shapeless(Array.isArray(it) ? [it[0], 9, it[1]] : [it, 9], [blk]); }
shaped([266, 1], ['###', '###', '###'], { '#': 371 });
// 1.3 - 1.7 additions
for (const [blk, it] of [[173, 263], [152, 331], [133, 450], [170, 296]]) { shaped([blk, 1], ['###', '###', '###'], { '#': it }); shapeless([it, 9], [blk]); }
for (let m = 0; m < 16; m++) shaped([171, 3, m], ['##'], { '#': [35, m] });
for (let d = 0; d < 16; d++) { const c = 15 - d;
  shaped([159, 8, c], ['###', '#D#', '###'], { '#': 172, D: [351, d] });
  shaped([95, 8, c], ['###', '#D#', '###'], { '#': 20, D: [351, d] });
  if (c) shapeless([35, 1, c], [[351, d], [35, 0]]); }
shaped([103, 1], ['###', '###', '###'], { '#': 360 });
shaped([361, 4], ['#'], { '#': 86 });
shaped([362, 1], ['#'], { '#': 360 });
shapeless([351, 3, 15], [352]);
// brewing
shaped([379, 1], [' B ', '###'], { B: 369, '#': CB });
shaped([374, 3], ['# #', ' # '], { '#': 20 });
shapeless([377, 2], [369]);
shapeless([376, 1], [375, 39, 353]);
shapeless([378, 1], [377, 341]);
shaped([382, 1], ['###', '#M#', '###'], { '#': 371, M: 360 });
// redstone
shaped([76, 1], ['R', 'S'], { R: 331, S: ST });
shapeless([77, 1], [1]);
shapeless([143, 1], [[P, -1]]);
shaped([70, 1], ['##'], { '#': 1 });
shaped([72, 1], ['##'], { '#': [P, -1] });
shaped([356, 1], ['TRT', 'SSS'], { T: 76, R: 331, S: 1 });
shaped([123, 1], [' R ', 'RGR', ' R '], { R: 331, G: 89 });
// quartz, nether brick, fences
shaped([155, 1], ['##', '##'], { '#': 406 });
shaped([155, 2, 2], ['#', '#'], { '#': [155, 0] });
shaped([155, 2, 1], ['##'], { '#': [155, 0] });
shaped([112, 1], ['##', '##'], { '#': 405 });
shaped([113, 6], ['###', '###'], { '#': 112 });
shaped([85, 2], ['SSS', 'SSS'], { S: ST });
shaped([107, 1], ['S#S', 'S#S'], { S: ST, '#': [P, -1] });
shaped([420, 2], ['~~ ', '~O ', '  ~'], { '~': 287, O: 341 });
shapeless([400, 1], [86, 353, 344]);
// dyes from flowers, and mixing
shapeless([351, 2, 11], [37]);
[[0, 1], [1, 12], [2, 13], [3, 7], [4, 1], [5, 14], [6, 7], [7, 9], [8, 7]].forEach(([f, d]) => shapeless([351, 1, d], [[38, f]]));
for (const [a, b, out, n] of [[1, 15, 9, 2], [1, 11, 14, 2], [2, 15, 10, 2], [4, 15, 12, 2], [4, 1, 5, 2], [4, 2, 6, 2], [0, 15, 8, 2], [8, 15, 7, 2], [5, 9, 13, 2]]) shapeless([351, n, out], [[351, a], [351, b]]);

function match(k, s) { if (k == null) return s == null; if (s == null) return false; if (Array.isArray(k)) return s.id === k[0] && (k[1] === -1 || s.dmg === k[1]); return s.id === k; }
// grid: array of w*w stacks
export function findRecipe(grid, w) {
  let minX = w, minY = w, maxX = -1, maxY = -1; const items = [];
  for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) { const s = grid[y * w + x]; if (s) { items.push(s); minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); } }
  if (!items.length) return null;
  const gw = maxX - minX + 1, gh = maxY - minY + 1;
  for (const r of R) {
    if (r.ins) {
      if (r.ins.length !== items.length) continue; const pool = items.slice(); let ok = true;
      for (const k of r.ins) { const i = pool.findIndex(s => match(k, s)); if (i < 0) { ok = false; break; } pool.splice(i, 1); }
      if (ok) return out(r);
      continue;
    }
    if (!r.pattern.length) continue;
    const ph = r.pattern.length, pw = Math.max(...r.pattern.map(p => p.length));
    if (ph !== gh || pw !== gw) continue;
    for (const mirror of [false, true]) {
      let ok = true;
      for (let y = 0; y < gh && ok; y++) for (let x = 0; x < gw && ok; x++) {
        const ch = r.pattern[y][mirror ? pw - 1 - x : x] || ' '; const k = ch === ' ' ? null : r.key[ch];
        if (!match(k, grid[(y + minY) * w + x + minX])) ok = false;
      }
      if (ok) return out(r);
    }
  }
  return null;
}
const out = r => ({ id: r.out[0], count: r.out[1] || 1, dmg: r.out[2] || 0 });

export const SMELT = { 15: [265], 14: [266], 12: [20], 4: [1], 319: [320], 363: [364], 365: [366], 349: [350], 337: [336], 81: [351, 2], 17: [263, 1], 56: [264], 16: [263], 73: [331], 21: [351, 4], 82: [172], 162: [263, 1], 129: [450], 87: [405], 153: [406], 392: [393] };
export function smeltResult(s) { const r = SMELT[s.id]; if (!r) return null; return { id: r[0], count: 1, dmg: r[1] || 0 }; }
