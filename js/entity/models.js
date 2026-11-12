// Box models + procedural skins for mobs (original pixel art, classic proportions)
import * as THREE from 'three';
import { PACK } from '../engine/pack.js';

// part: [name, [w,h,d], pivot[x,y,z], boxMin offset from pivot[x,y,z], parent?, opts]
// model space: 1 unit = 1 pixel = 1/16 block, y up from feet, front faces -z
const biped = (armW = 4, legW = 4) => [
  ['legR', [legW, 12, legW], [2, 12, 0], [-legW / 2, -12, -legW / 2]],
  ['legL', [legW, 12, legW], [-2, 12, 0], [-legW / 2, -12, -legW / 2]],
  ['body', [8, 12, 4], [0, 12, 0], [-4, 0, -2]],
  ['armR', [armW, 12, armW], [4 + armW / 2, 22, 0], [-armW / 2, -10, -armW / 2]],
  ['armL', [armW, 12, armW], [-4 - armW / 2, 22, 0], [-armW / 2, -10, -armW / 2]],
  ['head', [8, 8, 8], [0, 24, 0], [-4, 0, -4]],
];
// the player: biped plus the second (outer) skin layer as slightly larger shells parented to each part
const OVERLAYS = { hat: ['head', 0.5], jacket: ['body', 0.25], sleeveR: ['armR', 0.25], sleeveL: ['armL', 0.25], pantsR: ['legR', 0.25], pantsL: ['legL', 0.25] };
const steveModel = () => { const b = biped(); const by = Object.fromEntries(b.map(p => [p[0], p]));
  return [...b, ...Object.entries(OVERLAYS).map(([n, [base, inf]]) => [n, by[base][1], [0, 0, 0], by[base][3], base, { inflate: inf, overlay: true }])]; };
const quad = (legH, lx, lz) => [['legFR', [4, legH, 4], [lx, legH, -lz], [-2, -legH, -2]], ['legFL', [4, legH, 4], [-lx, legH, -lz], [-2, -legH, -2]], ['legBR', [4, legH, 4], [lx, legH, lz], [-2, -legH, -2]], ['legBL', [4, legH, 4], [-lx, legH, lz], [-2, -legH, -2]]];
const spiderLegs = []; for (let i = 0; i < 4; i++) { const z = -2 + i * 1.6; spiderLegs.push(['leg' + i + 'R', [16, 2, 2], [4, 9, z], [0, -1, -1]], ['leg' + i + 'L', [16, 2, 2], [-4, 9, z], [-16, -1, -1]]); }

export const MODELS = {
  witch: null, // filled below from the villager model
  pig: [...quad(6, 3, 5), ['body', [10, 8, 16], [0, 6, 0], [-5, 0, -8]], ['head', [8, 8, 8], [0, 12, -8], [-4, -4, -8]], ['snout', [4, 3, 1], [0, 0, 0], [-2, -3, -9], 'head']],
  cow: [...quad(12, 4, 6), ['body', [12, 10, 18], [0, 12, 0], [-6, 0, -9]], ['udder', [4, 2, 6], [0, 12, 0], [-2, -1.5, 2]], ['head', [8, 8, 6], [0, 20, -9], [-4, -4, -6]], ['hornR', [1, 3, 1], [0, 0, 0], [4, 3, -5], 'head'], ['hornL', [1, 3, 1], [0, 0, 0], [-5, 3, -5], 'head']],
  sheep: [...quad(12, 3, 5), ['body', [8, 6, 16], [0, 13, 0], [-4, 0, -8]], ['wool', [11, 9, 19], [0, 13, 0], [-5.5, -1.5, -9.5], null, { wool: 1 }], ['head', [6, 6, 8], [0, 18, -8], [-3, -4, -6]], ['woolHead', [7, 7, 6], [0, 0, 0], [-3.5, -3.6, -4.5], 'head', { wool: 1 }],
    ['woolLegFR', [5, 6, 5], [0, 0, 0], [-2.5, -6, -2.5], 'legFR', { wool: 1 }], ['woolLegFL', [5, 6, 5], [0, 0, 0], [-2.5, -6, -2.5], 'legFL', { wool: 1 }], ['woolLegBR', [5, 6, 5], [0, 0, 0], [-2.5, -6, -2.5], 'legBR', { wool: 1 }], ['woolLegBL', [5, 6, 5], [0, 0, 0], [-2.5, -6, -2.5], 'legBL', { wool: 1 }]],
  chicken: [['legR', [3, 5, 3], [1.5, 5, 1], [-1.5, -5, -1.5]], ['legL', [3, 5, 3], [-1.5, 5, 1], [-1.5, -5, -1.5]], ['body', [6, 6, 8], [0, 5, 0], [-3, 0, -4]], ['wingR', [1, 4, 6], [3, 10, 0], [0, -4, -3]], ['wingL', [1, 4, 6], [-3, 10, 0], [-1, -4, -3]],
    ['head', [4, 6, 3], [0, 9, -4], [-2, 0, -3]], ['beak', [4, 2, 2], [0, 0, 0], [-2, 2, -5], 'head'], ['wattle', [2, 2, 2], [0, 0, 0], [-1, 0, -4], 'head']],
  zombie: biped(), skeleton: biped(2, 2), steve: steveModel(), zombie_pigman: biped(),
  creeper: [['legFR', [4, 6, 4], [2, 6, -4], [-2, -6, -2]], ['legFL', [4, 6, 4], [-2, 6, -4], [-2, -6, -2]], ['legBR', [4, 6, 4], [2, 6, 4], [-2, -6, -2]], ['legBL', [4, 6, 4], [-2, 6, 4], [-2, -6, -2]], ['body', [8, 12, 4], [0, 6, 0], [-4, 0, -2]], ['head', [8, 8, 8], [0, 18, 0], [-4, 0, -4]]],
  villager: [['legR', [4, 12, 4], [2, 12, 0], [-2, -12, -2]], ['legL', [4, 12, 4], [-2, 12, 0], [-2, -12, -2]], ['body', [8, 12, 6], [0, 12, 0], [-4, 0, -3]],
    ['robe', [8, 18, 6], [0, 24, 0], [-4, -18, -3], null, { inflate: 0.5 }], ['head', [8, 10, 8], [0, 24, 0], [-4, 0, -4]], ['nose', [2, 4, 2], [0, 2, 0], [-1, -3, -6], 'head'],
    ['arms', [8, 4, 4], [0, 21, -1], [-4, -6, -2]], ['handR', [4, 8, 4], [0, 0, 0], [4, -6, -2], 'arms'], ['handL', [4, 8, 4], [0, 0, 0], [-8, -6, -2], 'arms']],
  iron_golem: [['legR', [6, 16, 5], [4, 13, 0], [-2.5, -13, -2.5]], ['legL', [6, 16, 5], [-5, 13, 0], [-2.5, -13, -2.5]], ['body', [18, 12, 11], [0, 31, 0], [-9, -10, -6]],
    ['waist', [9, 5, 6], [0, 0, 0], [-4.5, -15, -3], 'body', { inflate: 0.5 }], ['head', [8, 10, 8], [0, 31, -2], [-4, 2, -5.5]], ['nose', [2, 4, 2], [0, 0, 0], [-1, 1, -7.5], 'head'],
    ['armR', [4, 30, 6], [0, 31, 0], [9, -27.5, -3]], ['armL', [4, 30, 6], [0, 31, 0], [-13, -27.5, -3]]],
  slime: [['inner', [6, 6, 6], [0, 0, 0], [-3, 1, -3]], ['eyeR', [2, 2, 2], [0, 0, 0], [1.25, 4, -3.5]], ['eyeL', [2, 2, 2], [0, 0, 0], [-3.25, 4, -3.5]], ['mouth', [1, 1, 1], [0, 0, 0], [-1, 2, -3.5]], ['outer', [8, 8, 8], [0, 0, 0], [-4, 0, -4], null, { glass: 1 }]],
  magma_cube: [['core', [4, 4, 4], [0, 0, 0], [-2, 2, -2]], ...[0, 1, 2, 3, 4, 5, 6, 7].map(i => ['slice' + i, [8, 1, 8], [0, 7 - i, 0], [-4, 0, -4]])],
  ghast: [['body', [16, 16, 16], [0, 0, 0], [-8, 0, -8]], ...[0, 1, 2, 3, 4, 5, 6, 7, 8].map(i => ['tent' + i, [2, 8 + ((i * 5) % 7), 2], [((i % 3) - 1) * 5 + ((i / 3 | 0) % 2 ? -1.5 : 1.5), 1, ((i / 3 | 0) - 1) * 5], [-1, -(8 + ((i * 5) % 7)), -1]])],
  blaze: [['head', [8, 8, 8], [0, 22, 0], [-4, 0, -4]], ...[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(i => ['rod' + i, [2, 8, 2], [0, 0, 0], [-1, -8, -1]])],
  silverfish: (() => { const S = [[3, 2, 2], [4, 3, 2], [6, 4, 3], [3, 3, 3], [2, 2, 3], [2, 1, 2], [1, 1, 2]]; const out = []; let z = -3.5; const zs = [];
    S.forEach(([w, h, d], i) => { zs.push(z); out.push(['seg' + i, [w, h, d], [0, 0, z], [-w / 2, 0, -d / 2]]); if (i < 6) z += (d + S[i + 1][2]) * 0.5; });
    out.push(['wing0', [10, 8, 3], [0, 0, zs[2]], [-5, 0, -1.5]], ['wing1', [6, 4, 3], [0, 0, zs[4]], [-3, 0, -1.5]], ['wing2', [6, 5, 2], [0, 0, zs[1]], [-3, 0, -1]]); return out; })(),
  squid: [['body', [12, 16, 12], [0, 9, 0], [-6, 0, -6]], ...[0, 1, 2, 3, 4, 5, 6, 7].map(i => ['tent' + i, [2, 18, 2], [Math.cos(i * Math.PI / 4) * 5, 10, Math.sin(i * Math.PI / 4) * 5], [-1, -18, -1]])],
  wolf: [['head', [6, 6, 4], [1, 10.5, -7], [-3, -3, -2]], ['earR', [2, 2, 1], [0, 0, 0], [1, 3, 0], 'head'], ['earL', [2, 2, 1], [0, 0, 0], [-3, 3, 0], 'head'], ['nose', [3, 3, 4], [0, 0, 0], [-1.5, -3, -5], 'head'],
    ['body', [6, 6, 9], [0, 0, 0], [-2, 7, 0]], ['mane', [8, 7, 6], [0, 0, 0], [-3, 7, -6]],
    ['legFR', [2, 8, 2], [2.5, 8, -4], [-1, -8, -1]], ['legFL', [2, 8, 2], [-0.5, 8, -4], [-1, -8, -1]], ['legBR', [2, 8, 2], [2.5, 8, 7], [-1, -8, -1]], ['legBL', [2, 8, 2], [-0.5, 8, 7], [-1, -8, -1]], ['tail', [2, 8, 2], [1, 12, 8], [-1, -8, -1]]],
  enderman: [['legR', [2, 30, 2], [2, 29, 0], [-1, -30, -1]], ['legL', [2, 30, 2], [-2, 29, 0], [-1, -30, -1]], ['body', [8, 12, 4], [0, 38, 0], [-4, -12, -2]], ['armR', [2, 30, 2], [5, 36, 0], [-1, -28, -1]], ['armL', [2, 30, 2], [-5, 36, 0], [-1, -28, -1]], ['head', [8, 8, 8], [0, 38, 0], [-4, 0, -4]]],
  spider: [['abdomen', [10, 8, 12], [0, 9, 3], [-5, -4, 0]], ['neck', [6, 6, 6], [0, 9, 0], [-3, -3, -3]], ['head', [8, 8, 8], [0, 9, -3], [-4, -4, -8]], ...spiderLegs],
};

MODELS.cave_spider = MODELS.spider;
MODELS.wither_skeleton = MODELS.skeleton;
// ocelot / cat (vanilla ModelOcelot, y flipped to feet-up)
MODELS.ocelot = [['legBR', [2, 6, 2], [1.1, 6, 5], [-1, -6, -1]], ['legBL', [2, 6, 2], [-1.1, 6, 5], [-1, -6, -1]], ['legFR', [2, 10, 2], [1.2, 10, -5], [-1, -10, -1]], ['legFL', [2, 10, 2], [-1.2, 10, -5], [-1, -10, -1]],
  ['body', [4, 6, 16], [0, 6, 0], [-2, 0, -7]], ['head', [5, 4, 5], [0, 9, -9], [-2.5, -2, -3]], ['nose', [3, 2, 2], [0, 0, 0], [-1.5, -2, -4], 'head'], ['earR', [1, 1, 2], [0, 0, 0], [1, 2, 0], 'head'], ['earL', [1, 1, 2], [0, 0, 0], [-2, 2, 0], 'head'],
  ['tail', [1, 8, 1], [0, 9, 8], [-0.5, -8, -0.5]], ['tail2', [1, 8, 1], [0, -8, 0], [-0.5, -8, -0.5], 'tail']];
// bat: hangs from its head at the top of the model
MODELS.bat = [['head', [6, 6, 6], [0, 21, 0], [-3, -3, -3]], ['earR', [3, 4, 1], [0, 0, 0], [1, 2, -2], 'head'], ['earL', [3, 4, 1], [0, 0, 0], [-4, 2, -2], 'head'],
  ['body', [6, 12, 6], [0, 24, 0], [-3, -16, -3]], ['body2', [10, 6, 1], [0, 24, 0], [-5, -22, 0]],
  ['wingR', [10, 16, 1], [3, 23, 1.5], [0, -16, -0.5]], ['wingR2', [8, 12, 1], [10, 0, 0], [0, -12, -0.5], 'wingR'], ['wingL', [10, 16, 1], [-3, 23, 1.5], [-10, -16, -0.5]], ['wingL2', [8, 12, 1], [-10, 0, 0], [-8, -12, -0.5], 'wingL']];
// snow golem: three snow blocks, stick arms and a pumpkin
MODELS.snowman = [['bottom', [12, 12, 12], [0, 0, 0], [-6, 0, -6]], ['body', [10, 10, 10], [0, 11, 0], [-5, 0, -5]], ['head', [8, 8, 8], [0, 20, 0], [-4, 0, -4]], ['pumpkin', [9, 9, 9], [0, 0, 0], [-4.5, -0.5, -4.5], 'head', { pumpkin: 1 }],
  ['armR', [12, 2, 2], [4, 18, 0], [0, -1, -1]], ['armL', [12, 2, 2], [-4, 18, 0], [-12, -1, -1]]];
// saddles are drawn with the second material (never coat-tinted), shown only when saddled
const SAD = { wool: 1, saddle: 1 }; const CHEST = { wool: 1, chest: 1 };
MODELS.pig.push(['saddle', [8.4, 1, 8], [0, 14, 0], [-4.2, 0, -3], null, SAD], ['saddleStrap', [10.6, 4, 2], [0, 14, 0], [-5.3, -4, 0], null, SAD]);
// horse: neck group doubles as the "head" so it turns/pitches with the look
MODELS.horse = [...quad(11, 3.2, 8.5), ['body', [10, 10, 22], [0, 11, 0], [-5, 0, -11]],
  ['head', [4, 12, 7], [0, 18, -9], [-2, 0, -3.5]], ['face', [5, 5, 8], [0, 0, 0], [-2.5, 8.5, -10.5], 'head'],
  ['earR', [2, 3, 1], [0, 0, 0], [0.5, 13.5, -4], 'head'], ['earL', [2, 3, 1], [0, 0, 0], [-2.5, 13.5, -4], 'head'],
  ['mane', [2, 14, 2], [0, 0, 0], [-1, 0, 3.5], 'head'], ['tail', [3, 11, 3], [0, 20, 11], [-1.5, -11, -1]],
  ['saddle', [10.4, 1.5, 9], [0, 21, 0], [-5.2, 0, -5], null, SAD], ['saddleBack', [6, 1.5, 2], [0, 22.5, 0], [-3, 0, 2], null, SAD],
  ['girth', [10.8, 8, 2], [0, 21, 0], [-5.4, -8, -2], null, SAD], ['stirR', [1, 6, 1], [0, 21, 0], [5.4, -6, -1.5], null, SAD], ['stirL', [1, 6, 1], [0, 21, 0], [-6.4, -6, -1.5], null, SAD],
  ['bridle', [5.6, 2, 2], [0, 0, 0], [-2.8, 9, -9.5], 'head', SAD],
  ['earDR', [2, 7, 1], [0, 0, 0], [0.5, 13, -4], 'head'], ['earDL', [2, 7, 1], [0, 0, 0], [-2.5, 13, -4], 'head'],
  ['chestR', [3, 8, 8], [0, 13, 0], [5, 0, 1], null, CHEST], ['chestL', [3, 8, 8], [0, 13, 0], [-8, 0, 1], null, CHEST]];
MODELS.mooshroom = [...MODELS.cow, ['shroom0', [3, 3, 3], [0, 22, 0], [-1, 0, -4]], ['shroom1', [3, 3, 3], [0, 22, 0], [-4, 0, 2]], ['shroom2', [3, 3, 3], [0, 22, 0], [1, 0, 4]], ['shroomH', [3, 3, 3], [0, 0, 0], [-1.5, 4, -3], 'head']];

// ---------- procedural skins ----------
let seed = 1; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
function noise(ctx, x, y, w, h, c, amt = 20) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const n = (rnd() - 0.5) * amt; px(ctx, x + i, y + j, [c[0] + n, c[1] + n, c[2] + n]); } }
function px(ctx, x, y, c) { ctx.fillStyle = 'rgb(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ')'; ctx.fillRect(x, y, 1, 1); }
const BLACK = [20, 20, 20], WHITE = [235, 235, 235];
function eyes(ctx, x, y, w, row, gap, white = true) { const cx = Math.floor(w / 2); const l = cx - gap - 1, r = cx + gap; if (white) { px(ctx, x + l - 1, y + row, WHITE); px(ctx, x + r + 1, y + row, WHITE); } px(ctx, x + l, y + row, BLACK); px(ctx, x + r, y + row, BLACK); }
function paintSaddle(ctx, part, face, x, y, w, h) { noise(ctx, x, y, w, h, part.startsWith('stir') ? [120, 120, 125] : part === 'bridle' ? [70, 45, 25] : [110, 62, 32], 16);
  if (part === 'saddle' && face === 'top') { for (let i = 0; i < w; i++) { px(ctx, x + i, y, [70, 38, 18]); px(ctx, x + i, y + h - 1, [70, 38, 18]); } } }
const HORSE_COATS = [[236, 232, 224], [214, 186, 140], [170, 98, 52], [124, 80, 50], [52, 46, 44], [134, 132, 130], [84, 54, 34]];
const ARMOR_COL = { 417: [[200, 200, 206], [240, 240, 244], [120, 120, 128]], 418: [[230, 190, 50], [255, 236, 120], [160, 120, 20]], 419: [[80, 214, 200], [170, 250, 240], [30, 130, 120]] };
let HV = { kind: 'h', coat: 0, mark: 0, armor: 0 };
function paintPumpkin(ctx, part, face, x, y, w, h) { noise(ctx, x, y, w, h, [214, 128, 30], 22); if (face !== 'top' && face !== 'bottom') for (let i = 1; i < w; i += 3) for (let j = 0; j < h; j++) px(ctx, x + i, y + j, [180, 100, 20]);
  if (face === 'top') { px(ctx, x + 4, y + 4, [80, 60, 20]); px(ctx, x + 4, y + 3, [90, 120, 30]); }
  if (face === 'front') { for (const [i, j] of [[2, 2], [3, 2], [5, 2], [6, 2], [2, 3], [6, 3], [2, 5], [3, 6], [4, 6], [5, 6], [6, 5], [4, 5]]) px(ctx, x + i, y + j, [60, 30, 0]); } }
function paintChest(ctx, part, face, x, y, w, h) { noise(ctx, x, y, w, h, [150, 104, 50], 18); ctx.fillStyle = '#4a2f14'; ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y + h - 1, w, 1); ctx.fillRect(x, y, 1, h); ctx.fillRect(x + w - 1, y, 1, h);
  if (face === 'right' || face === 'left') { ctx.fillRect(x, y + 3, w, 1); if (w >= 6) { ctx.fillStyle = '#c8c8c8'; ctx.fillRect(x + (w >> 1) - 1, y + 2, 2, 3); } } }
// horse barding: plates over the neck, face, back and upper legs, rimmed and riveted
function paintHorseArmor(ctx, part, face, x, y, w, h) { const A = ARMOR_COL[HV.armor]; if (!A) return; const leg = part.startsWith('leg');
  const plate = (ax, ay, aw, ah) => { noise(ctx, ax, ay, aw, ah, A[0], 12); for (let i = 0; i < aw; i++) { px(ctx, ax + i, ay, A[1]); px(ctx, ax + i, ay + ah - 1, A[2]); } for (let j = 2; j < ah - 1; j += 4) for (let i = 2; i < aw - 1; i += 5) px(ctx, ax + i, ay + j, A[1]); };
  if (part === 'body') { if (face === 'top' || face === 'front' || face === 'back') plate(x, y, w, h); else if (face === 'right' || face === 'left') plate(x, y, w, Math.min(h, 7)); }
  if (part === 'head' && face !== 'bottom' && face !== 'top') plate(x, y, w, h - 1);
  if (part === 'face' && face !== 'bottom') { plate(x, y, w, Math.max(1, h - (face === 'front' ? 2 : 1))); if (face === 'right' || face === 'left') { const ex = face === 'right' ? 1 : w - 2; px(ctx, x + ex, y + 1, BLACK); } }
  if (leg && face !== 'top' && face !== 'bottom') plate(x, y, w, 4); }
const PAINT = {
  generic(ctx, part, face, x, y, w, h) { noise(ctx, x, y, w, h, [150, 140, 120], 18); },
  // horses, donkeys and mules: coat, markings and armour are baked per variant "kind.coat.marking.armour"
  horse(ctx, part, face, x, y, w, h) { const V = HV; const hair = part === 'mane' || part === 'tail';
    const base = V.kind === 'd' ? [134, 122, 108] : V.kind === 'm' ? [96, 64, 42] : HORSE_COATS[V.coat] || HORSE_COATS[0];
    const hairC = V.kind === 'd' ? [70, 60, 52] : V.kind === 'm' ? [44, 30, 22] : V.coat === 0 ? [210, 206, 200] : V.coat === 1 ? [150, 120, 84] : base.map(c => c * 0.45);
    const c = hair ? hairC : base; for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const n = (rnd() - 0.5) * 14 + (hair ? ((i + j * 3) % 4 === 0 ? -20 : 0) : 0); px(ctx, x + i, y + j, [c[0] + n, c[1] + n, c[2] + n]); }
    const leg = part.startsWith('leg');
    if (V.kind === 'h' && !hair) { const m = V.mark; // 1 white socks + blaze, 2 white field, 3 white dots, 4 black dots
      if (m === 1 && leg && face !== 'top') noise(ctx, x, y + h - 5, w, 5, [238, 236, 232], 8);
      if (m === 1 && part === 'face' && (face === 'front' || face === 'top')) noise(ctx, x + Math.floor(w / 2) - 1, y, 2, h, [238, 236, 232], 8);
      if (m === 2) for (let j = 0; j < h; j += 2) for (let i = 0; i < w; i += 2) if (rnd() < 0.45) noise(ctx, x + i, y + j, 2, 2, [236, 234, 230], 8);
      if (m === 3 || m === 4) for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (rnd() < 0.07) px(ctx, x + i, y + j, m === 3 ? [236, 234, 230] : [30, 26, 24]); }
    if (V.kind !== 'h' && part === 'body' && face === 'bottom') noise(ctx, x, y, w, h, base.map(c => c * 1.25), 10);
    if (V.kind !== 'h' && part === 'face' && face !== 'top') noise(ctx, x, y + h - 3, w, 3, V.kind === 'd' ? [190, 182, 170] : [140, 110, 86], 8);
    if (leg && face !== 'top') for (let i = 0; i < w; i++) { px(ctx, x + i, y + h - 1, [55, 50, 48]); px(ctx, x + i, y + h - 2, [70, 64, 60]); }
    if (part === 'face' && face === 'front') { px(ctx, x + 1, y + h - 2, [50, 40, 36]); px(ctx, x + w - 2, y + h - 2, [50, 40, 36]); }
    if (part.startsWith('earD') && (face === 'front' || face === 'back')) noise(ctx, x + Math.floor(w / 2) - (w > 1 ? 1 : 0), y + 1, Math.min(2, w), h - 2, [60, 52, 46], 6);
    if (!horseSheet(V)) paintHorseArmor(ctx, part, face, x, y, w, h);
    if (part === 'face' && (face === 'right' || face === 'left')) { const ex = face === 'right' ? 1 : w - 2; px(ctx, x + ex, y + 1, BLACK); px(ctx, x + ex + (face === 'right' ? 1 : -1), y + 1, [60, 50, 45]); } },
  pig(ctx, part, face, x, y, w, h) { noise(ctx, x, y, w, h, [236, 156, 156], 18); if (part === 'head' && face === 'front') { eyes(ctx, x, y, w, 3, 1); }
    if (part === 'snout' && face === 'front') { noise(ctx, x, y, w, h, [220, 130, 135], 8); px(ctx, x + 1, y + 1, [130, 60, 70]); px(ctx, x + 2, y + 1, [130, 60, 70]); }
    if (part.startsWith('leg') && face !== 'top') for (let i = 0; i < w; i++) px(ctx, x + i, y + h - 1, [120, 80, 80]); },
  cow(ctx, part, face, x, y, w, h) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const sp = Math.sin((x + i) * 0.7 + (y + j) * 0.3) + Math.cos((y + j) * 0.55 - (x + i) * 0.2) > 0.9; const n = (rnd() - 0.5) * 14; px(ctx, x + i, y + j, sp ? [225 + n, 225 + n, 220 + n] : [72 + n, 52 + n, 34 + n]); }
    if (part === 'head' && face === 'front') { eyes(ctx, x, y, w, 3, 1); noise(ctx, x + 2, y + 5, 4, 3, [190, 165, 150], 10); px(ctx, x + 2, y + 6, [60, 40, 40]); px(ctx, x + 5, y + 6, [60, 40, 40]); }
    if (part.startsWith('horn')) noise(ctx, x, y, w, h, [205, 200, 185], 10); if (part === 'udder') noise(ctx, x, y, w, h, [230, 150, 150], 10);
    if (part.startsWith('leg') && face !== 'top') for (let i = 0; i < w; i++) { px(ctx, x + i, y + h - 1, [40, 35, 30]); px(ctx, x + i, y + h - 2, [60, 50, 40]); } },
  sheep(ctx, part, face, x, y, w, h, wool) { if (wool) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const n = (rnd() - 0.5) * 30 + ((i + j) % 3 === 0 ? -12 : 0); px(ctx, x + i, y + j, [232 + n, 232 + n, 232 + n]); } return; }
    noise(ctx, x, y, w, h, [210, 180, 160], 12); if (part === 'head' && face === 'front') { eyes(ctx, x, y, w, 2, 1); px(ctx, x + 2, y + 4, [170, 120, 120]); px(ctx, x + 3, y + 4, [170, 120, 120]); } },
  chicken(ctx, part, face, x, y, w, h) { noise(ctx, x, y, w, h, [245, 245, 245], 12);
    if (part === 'head' && face === 'front') { px(ctx, x, y + 1, BLACK); px(ctx, x + 3, y + 1, BLACK); }
    if (part === 'head' && (face === 'right' || face === 'left')) px(ctx, x + 0, y + 1, BLACK);
    if (part === 'beak') noise(ctx, x, y, w, h, [235, 165, 40], 10); if (part === 'wattle') noise(ctx, x, y, w, h, [200, 20, 20], 10); if (part.startsWith('leg')) noise(ctx, x, y, w, h, [230, 160, 40], 10); },
  zombie(ctx, part, face, x, y, w, h) { const skin = [80, 135, 70];
    if (part === 'head' || part.startsWith('arm')) { noise(ctx, x, y, w, h, skin, 18); if (part.startsWith('arm') && face !== 'bottom') noise(ctx, x, y, w, Math.min(h, 4) * (face === 'top' ? 0 : 1), [0, 150, 150], 14);
      if (part === 'head' && face === 'front') { px(ctx, x + 1, y + 4, [10, 30, 10]); px(ctx, x + 2, y + 4, [10, 30, 10]); px(ctx, x + 5, y + 4, [10, 30, 10]); px(ctx, x + 6, y + 4, [10, 30, 10]); noise(ctx, x + 3, y + 5, 2, 1, [60, 100, 50], 6); noise(ctx, x + 2, y + 6, 4, 1, [40, 70, 35], 6); }
      if (part === 'head' && face === 'top') noise(ctx, x, y, w, h, [60, 110, 55], 18); return; }
    if (part === 'body') { noise(ctx, x, y, w, h, [0, 160, 160], 18); return; }
    noise(ctx, x, y, w, h, [60, 60, 160], 16); if (face !== 'top' && face !== 'bottom') for (let i = 0; i < w; i++) { px(ctx, x + i, y + h - 1, [90, 90, 90]); px(ctx, x + i, y + h - 2, [100, 100, 100]); } },
  steve(ctx, part, face, x, y, w, h) { const skin = [196, 140, 110]; if (OVERLAYS[part]) return;
    if (part === 'head' || part.startsWith('arm')) { noise(ctx, x, y, w, h, skin, 10); if (part.startsWith('arm') && face !== 'bottom' && face !== 'top') noise(ctx, x, y, w, 4, [0, 168, 168], 12); if (part.startsWith('arm') && face === 'top') noise(ctx, x, y, w, h, [0, 168, 168], 12);
      if (part === 'head' && face === 'top') noise(ctx, x, y, w, h, [70, 45, 25], 12);
      if (part === 'head' && face !== 'top' && face !== 'bottom') noise(ctx, x, y, w, face === 'front' ? 2 : 3, [70, 45, 25], 12);
      if (part === 'head' && face === 'front') { px(ctx, x + 1, y + 4, [255, 255, 255]); px(ctx, x + 2, y + 4, [80, 60, 160]); px(ctx, x + 5, y + 4, [80, 60, 160]); px(ctx, x + 6, y + 4, [255, 255, 255]); noise(ctx, x + 2, y + 6, 4, 1, [110, 60, 40], 6); } return; }
    if (part === 'body') { noise(ctx, x, y, w, h, [0, 168, 168], 12); return; }
    noise(ctx, x, y, w, h, [60, 60, 170], 14); if (face !== 'top') for (let i = 0; i < w; i++) { px(ctx, x + i, y + h - 1, [100, 100, 100]); px(ctx, x + i, y + h - 2, [110, 110, 110]); } },
  skeleton(ctx, part, face, x, y, w, h) { noise(ctx, x, y, w, h, [190, 190, 190], 22);
    if (part === 'body' && (face === 'front' || face === 'back')) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if ((j < 9 && j % 2 === 1 && i > 0 && i < w - 1 && i !== 3 && i !== 4) || (j >= 9 && i !== 3 && i !== 4)) ctx.clearRect(x + i, y + j, 1, 1); }
    if (part === 'head' && face === 'front') { for (const [i, j] of [[1, 3], [2, 3], [1, 4], [2, 4], [5, 3], [6, 3], [5, 4], [6, 4]]) px(ctx, x + i, y + j, [30, 30, 30]); px(ctx, x + 3, y + 5, [70, 70, 70]); px(ctx, x + 4, y + 5, [70, 70, 70]); for (let i = 1; i < 7; i++) px(ctx, x + i, y + 6, i % 2 ? [60, 60, 60] : [130, 130, 130]); } },
  creeper(ctx, part, face, x, y, w, h) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const r = rnd(); const c = r < 0.15 ? [170, 230, 150] : r < 0.4 ? [90, 190, 80] : r < 0.85 ? [70, 160, 60] : [40, 110, 35]; px(ctx, x + i, y + j, c); }
    if (part === 'head' && face === 'front') { const F = [[1, 2], [2, 2], [1, 3], [2, 3], [5, 2], [6, 2], [5, 3], [6, 3], [3, 4], [4, 4], [2, 5], [3, 5], [4, 5], [5, 5], [2, 6], [3, 6], [4, 6], [5, 6], [2, 7], [5, 7]]; for (const [i, j] of F) px(ctx, x + i, y + j, [8, 8, 8]); }
    if (part.startsWith('leg') && face !== 'top') for (let i = 0; i < w; i++) px(ctx, x + i, y + h - 1, [30, 30, 30]); },
  villager(ctx, part, face, x, y, w, h) { const skin = [180, 125, 95];
    if (part === 'head' || part === 'nose' || part.startsWith('hand') || part === 'arms') { noise(ctx, x, y, w, h, skin, 10); if (part === 'arms' || part.startsWith('hand')) { if (face !== 'front' || part !== 'arms') noise(ctx, x, y, w, h, [100, 70, 45], 10); }
      if (part === 'head' && face === 'front') { px(ctx, x + 1, y + 4, WHITE); px(ctx, x + 2, y + 4, [40, 120, 50]); px(ctx, x + 6, y + 4, WHITE); px(ctx, x + 5, y + 4, [40, 120, 50]); for (let i = 1; i < 7; i++) px(ctx, x + i, y + 3, [70, 50, 35]); noise(ctx, x + 2, y + 8, 4, 1, [130, 85, 65], 6); }
      if (part === 'head' && face === 'top') noise(ctx, x, y, w, h, [150, 105, 80], 10); return; }
    if (part === 'robe' && face !== 'top') { noise(ctx, x, y, w, h, [95, 65, 40], 14); return; }
    noise(ctx, x, y, w, h, [90, 62, 38], 12); },
  witch(ctx, part, face, x, y, w, h) { if (part.startsWith('hat')) { noise(ctx, x, y, w, h, [34, 34, 34], 8); if (part === 'hat1' && face !== 'top' && face !== 'bottom') noise(ctx, x, y, w, 1, [40, 130, 40], 8); return; }
    if (part === 'mole') { noise(ctx, x, y, w, h, [40, 120, 40], 6); return; }
    if (part === 'robe' || part === 'body') { noise(ctx, x, y, w, h, [70, 30, 100], 14); return; }
    PAINT.villager(ctx, part === 'nose' ? 'nose' : part, face, x, y, w, h); if (part === 'head' && face === 'front') { px(ctx, x + 2, y + 4, [130, 40, 160]); px(ctx, x + 5, y + 4, [130, 40, 160]); } },
  iron_golem(ctx, part, face, x, y, w, h) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const n = (rnd() - 0.5) * 22; const crack = rnd() < 0.04 ? -45 : 0; px(ctx, x + i, y + j, [212 + n + crack, 206 + n + crack, 196 + n + crack]); }
    if ((part === 'body' || part.startsWith('arm') || part.startsWith('leg')) && face !== 'top' && face !== 'bottom') { let vx = (rnd() * w) | 0; for (let j = 0; j < h; j++) { if (rnd() < 0.3) vx += rnd() < 0.5 ? -1 : 1; vx = Math.max(0, Math.min(w - 1, vx)); if (rnd() < 0.75) px(ctx, x + vx, y + j, rnd() < 0.5 ? [70, 120, 40] : [50, 95, 30]); if (rnd() < 0.15 && vx + 1 < w) px(ctx, x + vx + 1, y + j, [90, 145, 50]); } }
    if (part === 'head' && face === 'front') { for (let i = 0; i < w; i++) { px(ctx, x + i, y + 3, [150, 145, 135]); } px(ctx, x + 2, y + 4, [140, 20, 10]); px(ctx, x + 1, y + 4, [60, 40, 35]); px(ctx, x + 5, y + 4, [140, 20, 10]); px(ctx, x + 6, y + 4, [60, 40, 35]); noise(ctx, x + 2, y + 8, 4, 1, [150, 145, 135], 8); }
    if (part === 'nose') noise(ctx, x, y, w, h, [185, 178, 168], 12); },
  slime(ctx, part, face, x, y, w, h) { if (part.startsWith('eye') || part === 'mouth') { noise(ctx, x, y, w, h, [30, 50, 30], 8); return; } noise(ctx, x, y, w, h, part === 'outer' ? [110, 200, 90] : [90, 170, 70], 20); },
  magma_cube(ctx, part, face, x, y, w, h) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const r = rnd(); px(ctx, x + i, y + j, part === 'core' ? [250, 200 * r + 40, 20] : r < 0.15 ? [230, 120, 20] : [60 + r * 30, 15, 10]); } if (part === 'slice3' && face === 'front') { px(ctx, x + 2, y, [250, 220, 50]); px(ctx, x + 5, y, [250, 220, 50]); } },
  ghast(ctx, part, face, x, y, w, h) { noise(ctx, x, y, w, h, [236, 236, 236], 14); if (part === 'body' && face === 'front') { for (const [i, j] of [[3, 7], [4, 7], [11, 7], [12, 7]]) px(ctx, x + i, y + j, [60, 60, 60]); noise(ctx, x + 6, y + 11, 4, 2, [70, 70, 70], 10); } },
  blaze(ctx, part, face, x, y, w, h) { noise(ctx, x, y, w, h, part === 'head' ? [235, 190, 40] : [250, 200, 60], 30); if (part === 'head' && face === 'front') { noise(ctx, x, y + 4, w, 1, [120, 70, 10], 10); px(ctx, x + 2, y + 4, BLACK); px(ctx, x + 5, y + 4, BLACK); } },
  silverfish(ctx, part, face, x, y, w, h) { noise(ctx, x, y, w, h, part.startsWith('wing') ? [125, 125, 125] : [145, 145, 150], 30); },
  squid(ctx, part, face, x, y, w, h) { noise(ctx, x, y, w, h, [50, 75, 100], 18); if (part === 'body' && face === 'front') { px(ctx, x + 3, y + 10, WHITE); px(ctx, x + 8, y + 10, WHITE); px(ctx, x + 4, y + 10, BLACK); px(ctx, x + 7, y + 10, BLACK); } },
  wolf(ctx, part, face, x, y, w, h) { noise(ctx, x, y, w, h, part === 'mane' ? [200, 196, 192] : [215, 210, 205], 16); if (part === 'head' && face === 'front') { eyes(ctx, x, y, w, 2, 1, false); } if (part === 'nose' && face === 'front') { px(ctx, x + 1, y, BLACK); } },
  enderman(ctx, part, face, x, y, w, h) { noise(ctx, x, y, w, h, [24, 24, 24], 10); },
  zombie_pigman(ctx, part, face, x, y, w, h) { noise(ctx, x, y, w, h, part === 'legR' || part === 'legL' ? [120, 90, 60] : [225, 140, 140], 20); if (part === 'head' && face === 'front') { px(ctx, x + 2, y + 4, BLACK); px(ctx, x + 5, y + 4, BLACK); noise(ctx, x + 4, y, 4, 8, [200, 210, 190], 30); } if (part === 'head' && face === 'left') noise(ctx, x, y, w, h, [160, 190, 150], 30); },
  cave_spider(ctx, part, face, x, y, w, h) { noise(ctx, x, y, w, h, [20, 60, 75], 16); if (part === 'head' && face === 'front') for (const [i, j] of [[1, 3], [2, 3], [5, 3], [6, 3]]) px(ctx, x + i, y + j, [210, 20, 20]); },
  mooshroom(ctx, part, face, x, y, w, h) { if (part.startsWith('shroom')) { noise(ctx, x, y, w, h, [200, 30, 30], 14); if (face !== 'bottom') px(ctx, x + 1, y + 1, WHITE); if (face === 'bottom') noise(ctx, x, y, w, h, [220, 210, 180], 8); return; }
    noise(ctx, x, y, w, h, [160, 25, 25], 18); if (part === 'head' && face === 'front') { eyes(ctx, x, y, w, 3, 1); noise(ctx, x + 2, y + 5, 4, 3, [190, 165, 150], 10); } if (part.startsWith('horn')) noise(ctx, x, y, w, h, [205, 200, 185], 10); },
  spider(ctx, part, face, x, y, w, h) { noise(ctx, x, y, w, h, [52, 44, 38], 16);
    if (part === 'abdomen' && face === 'top') for (let j = 2; j < h - 2; j += 3) for (let i = 2; i < w - 2; i++) if ((i + j) % 4 === 0) px(ctx, x + i, y + j, [80, 15, 15]);
    if (part === 'head' && face === 'front') { for (const [i, j] of [[1, 3], [2, 3], [5, 3], [6, 3], [2, 2], [5, 2], [3, 4], [4, 4]]) px(ctx, x + i, y + j, [210, 20, 20]); px(ctx, x + 2, y + 3, [255, 120, 120]); px(ctx, x + 5, y + 3, [255, 120, 120]); } },
};

// ---------- texture-pack skins ----------
MODELS.witch = [...MODELS.villager, ['mole', [1, 1, 1], [0, 0, 0], [0, -1, -6.75], 'nose'],
  ['hat1', [10, 2, 10], [0, 10, 0], [-5, 0, -5], 'head'], ['hat2', [7, 4, 7], [0, 2, 0], [-3.5, 0, -3.5], 'hat1'], ['hat3', [4, 4, 4], [0, 4, 0], [-2, 0, -2], 'hat2'], ['hat4', [1, 2, 1], [0, 4, 0], [-0.5, 0, -0.5], 'hat3']];
// origins of each vanilla 64x32 skin inside textures/mobtextures.png
const SHEET = { zombie: [404, 8], skeleton: [242, 8], creeper: [350, 8], spider: [166, 8], pig: [89, 128], sheep: [234, 128], fur: [304, 128], cow: [16, 188], chicken: [92, 197], steve: [14, 128], farmer: [10, 296], librarian: [80, 296], priest: [160, 296], villager: [240, 296], butcher: [320, 296], smith: [400, 296],
  enderman: [13, 8], cave_spider: [86, 8], slime: [300, 12], zombie_pigman: [13, 68], wolf_angry: [89, 68], ghast: [167, 68], ghast_fire: [247, 68], wolf: [379, 128], wolf_tame: [449, 128],
  squid: [144, 192], silverfish: [214, 193], mooshroom: [290, 188], magma_cube: [370, 192], blaze: [440, 188] };
// part -> [u, v, w, h, d, rotated?, sheet?] in vanilla skin coordinates (rotated = quadruped body turned 90deg about X)
const BIPED = (aw = 4) => ({ head: [0, 0, 8, 8, 8], body: [16, 16, 8, 12, 4], armR: [40, 16, aw, 12, aw], armL: [40, 16, aw, 12, aw], legR: [0, 16, aw, 12, aw], legL: [0, 16, aw, 12, aw] });
const LEGS = (h) => ({ legFR: [0, 16, 4, h, 4], legFL: [0, 16, 4, h, 4], legBR: [0, 16, 4, h, 4], legBL: [0, 16, 4, h, 4] });
const SPIDER_LEGS = {}; for (let i = 0; i < 4; i++) SPIDER_LEGS['leg' + i + 'R'] = SPIDER_LEGS['leg' + i + 'L'] = [18, 0, 16, 2, 2];
const FURLEG = [0, 16, 4, 6, 4, false, 'fur'];
const UVMAP = {
  zombie: BIPED(), steve: { ...BIPED(), hat: [32, 0, 8, 8, 8] }, skeleton: BIPED(2),
  creeper: { head: [0, 0, 8, 8, 8], body: [16, 16, 8, 12, 4], ...LEGS(6) },
  spider: { head: [32, 4, 8, 8, 8], neck: [0, 0, 6, 6, 6], abdomen: [0, 12, 10, 8, 12], ...SPIDER_LEGS },
  pig: { head: [0, 0, 8, 8, 8], snout: [16, 16, 4, 3, 1], body: [28, 8, 10, 16, 8, true], ...LEGS(6) },
  cow: { head: [0, 0, 8, 8, 6], hornR: [22, 0, 1, 3, 1], hornL: [22, 0, 1, 3, 1], body: [18, 4, 12, 18, 10, true], udder: [52, 0, 4, 6, 1, true], ...LEGS(12) },
  sheep: { head: [0, 0, 6, 6, 8], body: [28, 8, 8, 16, 6, true], ...LEGS(12), wool: [28, 8, 8, 16, 6, true, 'fur'], woolHead: [0, 0, 6, 6, 6, false, 'fur'],
    woolLegFR: FURLEG, woolLegFL: FURLEG, woolLegBR: FURLEG, woolLegBL: FURLEG },
  villager: { head: [0, 0, 8, 10, 8], nose: [24, 0, 2, 4, 2], body: [16, 20, 8, 12, 6], robe: [0, 38, 8, 18, 6], arms: [40, 38, 8, 4, 4], handR: [44, 22, 4, 8, 4], handL: [44, 22, 4, 8, 4], legR: [0, 22, 4, 12, 4], legL: [0, 22, 4, 12, 4] },
  zombie_pigman: BIPED(), cave_spider: null, mooshroom: null,
  enderman: { head: [0, 0, 8, 8, 8], body: [32, 16, 8, 12, 4], armR: [56, 0, 2, 30, 2], armL: [56, 0, 2, 30, 2], legR: [56, 0, 2, 30, 2], legL: [56, 0, 2, 30, 2] },
  slime: { outer: [0, 0, 8, 8, 8], inner: [0, 16, 6, 6, 6], eyeR: [32, 0, 2, 2, 2], eyeL: [32, 4, 2, 2, 2], mouth: [32, 8, 1, 1, 1] },
  magma_cube: { core: [0, 16, 4, 4, 4], slice0: [0, 0, 8, 1, 8], slice1: [0, 1, 8, 1, 8], slice2: [24, 10, 8, 1, 8], slice3: [24, 19, 8, 1, 8], slice4: [0, 4, 8, 1, 8], slice5: [0, 5, 8, 1, 8], slice6: [0, 6, 8, 1, 8], slice7: [0, 7, 8, 1, 8] },
  ghast: { body: [0, 0, 16, 16, 16], ...Object.fromEntries([0, 1, 2, 3, 4, 5, 6, 7, 8].map(i => ['tent' + i, [0, 0, 2, 8 + ((i * 5) % 7), 2]])) },
  blaze: { head: [0, 0, 8, 8, 8], ...Object.fromEntries([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(i => ['rod' + i, [0, 16, 2, 8, 2]])) },
  silverfish: { seg0: [0, 0, 3, 2, 2], seg1: [0, 4, 4, 3, 2], seg2: [0, 9, 6, 4, 3], seg3: [0, 16, 3, 3, 3], seg4: [0, 22, 2, 2, 3], seg5: [11, 0, 2, 1, 2], seg6: [13, 4, 1, 1, 2], wing0: [20, 0, 10, 8, 3], wing1: [20, 11, 6, 4, 3], wing2: [20, 18, 6, 5, 2] },
  squid: { body: [0, 0, 12, 16, 12], ...Object.fromEntries([0, 1, 2, 3, 4, 5, 6, 7].map(i => ['tent' + i, [48, 0, 2, 18, 2]])) },
  wolf: { head: [0, 0, 6, 6, 4], earR: [16, 14, 2, 2, 1], earL: [16, 14, 2, 2, 1], nose: [0, 10, 3, 3, 4], body: [18, 14, 6, 9, 6, true], mane: [21, 0, 8, 6, 7, true], legFR: [0, 18, 2, 8, 2], legFL: [0, 18, 2, 8, 2], legBR: [0, 18, 2, 8, 2], legBL: [0, 18, 2, 8, 2], tail: [9, 18, 2, 8, 2] },
  chicken: { head: [0, 0, 4, 6, 3], beak: [14, 0, 4, 2, 2], wattle: [14, 4, 2, 2, 2], body: [0, 9, 6, 8, 6, true], legR: [26, 0, 3, 5, 3], legL: [26, 0, 3, 5, 3], wingR: [24, 13, 1, 4, 6], wingL: [24, 13, 1, 4, 6] },
};
UVMAP.witch = Object.fromEntries(Object.entries({ ...UVMAP.villager, mole: [0, 0, 1, 1, 1], hat1: [0, 64, 10, 2, 10], hat2: [0, 76, 7, 4, 7], hat3: [0, 87, 4, 4, 4], hat4: [0, 95, 1, 2, 1] }).map(([k, v]) => [k, [...v.slice(0, 5), false, 'witch']]));
SHEET.witch = [0, 0];
const HLEG_F = [44, 29, 3, 8, 4], HLEG_B = [78, 29, 4, 9, 5];
UVMAP.horse = { body: [0, 34, 10, 10, 24], head: [0, 12, 4, 14, 8], face: [0, 0, 5, 5, 7], earR: [0, 0, 2, 3, 1], earL: [0, 0, 2, 3, 1], earDR: [0, 12, 2, 7, 1], earDL: [0, 12, 2, 7, 1], mane: [58, 0, 2, 16, 4], tail: [38, 7, 3, 4, 7, true], legFR: HLEG_F, legFL: HLEG_F, legBR: HLEG_B, legBL: HLEG_B };
UVMAP.cave_spider = UVMAP.spider; UVMAP.wither_skeleton = UVMAP.skeleton;
UVMAP.ocelot = { legBR: [8, 13, 2, 6, 2], legBL: [8, 13, 2, 6, 2], legFR: [40, 0, 2, 10, 2], legFL: [40, 0, 2, 10, 2], body: [20, 0, 4, 16, 6, true], head: [0, 0, 5, 4, 5], nose: [0, 24, 3, 2, 2], earR: [0, 10, 1, 1, 2], earL: [6, 10, 1, 1, 2], tail: [0, 15, 1, 8, 1], tail2: [4, 15, 1, 8, 1] };
UVMAP.bat = { head: [0, 0, 6, 6, 6], earR: [24, 0, 3, 4, 1], earL: [24, 0, 3, 4, 1], body: [0, 16, 6, 12, 6], body2: [0, 34, 10, 6, 1], wingR: [42, 0, 10, 16, 1], wingL: [42, 0, 10, 16, 1], wingR2: [24, 16, 8, 12, 1], wingL2: [24, 16, 8, 12, 1] };
UVMAP.snowman = { head: [0, 0, 8, 8, 8], body: [0, 16, 10, 10, 10], bottom: [0, 36, 12, 12, 12], armR: [32, 0, 12, 2, 2], armL: [32, 0, 12, 2, 2] }; UVMAP.mooshroom = UVMAP.cow;
const boxFaces = (u, v, w, h, d) => ({ top: [u + d, v, w, d], bottom: [u + d + w, v, w, d], right: [u, v + d, d, h], front: [u + d, v + d, w, h], left: [u + d + w, v + d, d, h], back: [u + 2 * d + w, v + d, w, h] });
// a quadruped body is modelled upright then rotated: its texture's back becomes our top, front our belly, top our front, bottom our rear; sides turn 90deg
const ROT = { top: 'back', bottom: 'front', front: 'top', back: 'bottom', right: 'right', left: 'left' };
// whole-skin files (textures/mobs/*.png) that replace the combined sheet for a skin key
const SINGLE = { wolf: 'wolf', wolf_angry: 'wolf_angry', ghast: 'ghast', ghast_fire: 'ghast_shooting', skeleton: 'skeleton', cave_spider: 'cave_spider', zombie_pigman: 'zombie_pigman', squid: 'squid', silverfish: 'silverfish', chicken: 'chicken', blaze: 'blaze', wither_skeleton: 'wither_skeleton', ocelot: 'ocelot', cat_black: 'black', cat_red: 'red', cat_siamese: 'siamese', snowman: 'snowman', bat: 'bat', iron_golem: 'iron_golem' };
const composites = {};
function composite(key, layers) { if (composites[key] !== undefined) return composites[key]; const base = PACK['mob:' + layers[0][0]]; if (!base) return composites[key] = null;
  const cv = document.createElement('canvas'); cv.width = base.width; cv.height = base.height; const c = cv.getContext('2d');
  for (const [n, tint] of layers) { const im = PACK['mob:' + n]; if (!im) continue; if (!tint) { c.drawImage(im, 0, 0); continue; }
    const t = document.createElement('canvas'); t.width = im.width; t.height = im.height; const tc = t.getContext('2d'); tc.drawImage(im, 0, 0); tc.globalCompositeOperation = 'multiply'; tc.fillStyle = tint; tc.fillRect(0, 0, t.width, t.height); tc.globalCompositeOperation = 'destination-in'; tc.drawImage(im, 0, 0); c.drawImage(t, 0, 0); }
  return composites[key] = cv; }
const HORSE_FILES = ['horse_white', 'horse_creamy', 'horse_chestnut', 'horse_brown', 'horse_black', 'horse_gray', 'horse_darkbrown'], MARK_FILES = [null, 'horse_markings_white', 'horse_markings_whitefield', 'horse_markings_whitedots', 'horse_markings_blackdots'];
function horseSheet(V) { const base = V.kind === 'd' ? 'donkey' : V.kind === 'm' ? 'mule' : V.kind === 'z' ? 'horse_zombie' : V.kind === 's' ? 'horse_skeleton' : HORSE_FILES[V.coat] || HORSE_FILES[0];
  const layers = [[base]]; if (V.kind === 'h' && MARK_FILES[V.mark]) layers.push([MARK_FILES[V.mark]]); return composite(layers.map(l => l[0]).join('+'), layers); }
function skinImage(type, key, variant) {
  if (type === 'horse') return horseSheet(HV);
  if (key === 'wolf_tame') return composite('wolf_tame+collar', [['wolf_tame'], ['wolf_collar', '#b02e26']]);
  return SINGLE[key] ? PACK['mob:' + SINGLE[key]] || null : null; }
function packFaces(ctx, type, name, faces, variant) {
  const m = UVMAP[type] && UVMAP[type][name]; if (!m) return;
  const [u, v, w, h, d, rot, sheet] = m; const single = sheet ? null : skinImage(type, variant || type, variant);
  const IMG = single || (sheet === 'witch' ? PACK.witch : PACK.mobs); if (!IMG) return; const o = single ? [0, 0] : SHEET[sheet || variant || type]; if (!o) return;
  const src = boxFaces(o[0] + u, o[1] + v, w, h, d);
  for (const [f, r] of Object.entries(faces)) {
    const s = src[rot ? ROT[f] : f]; if (!s || r[2] <= 0 || r[3] <= 0) continue;
    ctx.save(); if (type !== 'enderman') ctx.clearRect(r[0], r[1], r[2], r[3]);
    if (rot && (f === 'right' || f === 'left')) { // transpose the side: source rows (along the upright body) run along our length
      ctx.translate(r[0] + r[2] / 2, r[1] + r[3] / 2); ctx.rotate(Math.PI / 2); ctx.drawImage(IMG, s[0], s[1], s[2], s[3], -r[3] / 2, -r[2] / 2, r[3], r[2]);
    } else ctx.drawImage(IMG, s[0], s[1], s[2], s[3], r[0], r[1], r[2], r[3]);
    ctx.restore();
  }
}

const skins = {};
function buildSkin(type, variant) {
  const parts = MODELS[type]; const W = 128; let cx = 0, cy = 0, rowH = 0; const regions = {};
  for (const [name, [w, h, d]] of parts) { const bw = Math.ceil(2 * (d + w)), bh = Math.ceil(d + h); if (cx + bw > W) { cx = 0; cy += rowH; rowH = 0; } regions[name] = [cx, cy]; cx += bw; rowH = Math.max(rowH, bh); }
  const H = Math.max(16, 1 << Math.ceil(Math.log2(cy + rowH)));
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const ctx = cv.getContext('2d'); seed = 1 + type.length * 7919;
  if (type === 'horse') { const [k, c, m, a] = String(variant || 'h.0.0.0').split('.'); HV = { kind: k || 'h', coat: +c || 0, mark: +m || 0, armor: +a || 0 }; seed += (+c || 0) * 131 + (+m || 0) * 17; }
  for (const [name, [w0, h0, d0], , , , opts] of parts) { const [u, v] = regions[name]; const w = Math.ceil(w0), h = Math.ceil(h0), d = Math.ceil(d0);
    const faces = { top: [u + d, v, w, d], bottom: [u + d + w, v, w, d], right: [u, v + d, d, h], front: [u + d, v + d, w, h], left: [u + d + w, v + d, d, h], back: [u + 2 * d + w, v + d, w, h] };
    for (const [f, r] of Object.entries(faces)) { ctx.save(); ctx.beginPath(); ctx.rect(r[0], r[1], r[2], r[3]); ctx.clip(); (opts && opts.saddle ? paintSaddle : opts && opts.chest ? paintChest : opts && opts.pumpkin ? paintPumpkin : PAINT[type] || PAINT.generic)(ctx, name, f, r[0], r[1], r[2], r[3], opts && opts.wool); ctx.restore(); }
    packFaces(ctx, type, name, faces, variant);
    if (type === 'horse' && horseSheet(HV)) { const IMG = horseSheet(HV);
      if (name.startsWith('leg')) for (const f of ['front', 'back', 'left', 'right']) { const r = faces[f]; ctx.drawImage(IMG, 48, 55, 4, 3, r[0], r[1] + r[2 + 1] - 3, r[2], 3); }
      if (HV.armor) for (const [f, r] of Object.entries(faces)) { ctx.save(); ctx.beginPath(); ctx.rect(r[0], r[1], r[2], r[3]); ctx.clip(); paintHorseArmor(ctx, name, f, r[0], r[1], r[2], r[3]); ctx.restore(); } }
    if (type === 'enderman' && name === 'head') { const f = faces.front; const d = ctx.getImageData(f[0], f[1], f[2], f[3]); for (let i = 0; i < d.data.length; i += 4) if (d.data[i] > 150 && d.data[i + 1] > 150) { d.data[i] = 204; d.data[i + 1] = 60; d.data[i + 2] = 250; } ctx.putImageData(d, f[0], f[1]);
      if (!PACK.mobs) for (const i of [1, 2, 5, 6]) px(ctx, f[0] + i, f[1] + 4, [204, 60, 250]); }
  }
  const tex = new THREE.CanvasTexture(cv); tex.magFilter = tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false; tex.colorSpace = THREE.NoColorSpace;
  return skins[variant ? type + ':' + variant : type] = { tex, regions, W, H };
}

// a Steve-model texture from a vanilla player skin image (64x32 classic or 64x64 with separate left limbs and overlays)
export function steveSkinTexture(img) {
  const base = skins.steve || buildSkin('steve'); const cv = document.createElement('canvas'); cv.width = base.W; cv.height = base.H;
  const ctx = cv.getContext('2d'); ctx.imageSmoothingEnabled = false; const s = img.width / 64, tall = img.height >= img.width * 0.9;
  const SRC = { head: [0, 0], body: [16, 16], armR: [40, 16], legR: [0, 16], armL: tall ? [32, 48] : [40, 16], legL: tall ? [16, 48] : [0, 16] };
  const OVER = tall ? { hat: [32, 0], jacket: [16, 32], sleeveR: [40, 32], pantsR: [0, 32], sleeveL: [48, 48], pantsL: [0, 48] } : { hat: [32, 0] };
  // the probe canvas reads the source so legacy skins with a solid (non-transparent) hat layer don't cover the face
  const probe = document.createElement('canvas'); probe.width = img.width; probe.height = img.height; const pc = probe.getContext('2d'); pc.drawImage(img, 0, 0);
  const px = pc.getImageData(0, 0, img.width, img.height).data;
  const overlayUsable = (u, v, w, h, d) => { let clear = 0, n = 0; for (let y = v; y < v + d + h; y++) for (let x = u; x < u + 2 * (d + w); x++) { const a = px[((Math.floor(y * s)) * img.width + Math.floor(x * s)) * 4 + 3]; n++; if (a < 128) clear++; } return clear > 0 && clear < n; };
  for (const [name, [w0, h0, d0]] of MODELS.steve) { const [u, v] = base.regions[name]; const w = Math.ceil(w0), h = Math.ceil(h0), d = Math.ceil(d0);
    const dst = boxFaces(u, v, w, h, d);
    const layer = (o) => { const src = boxFaces(o[0], o[1], w, h, d); for (const f in dst) { const a = src[f], b = dst[f]; ctx.drawImage(img, a[0] * s, a[1] * s, a[2] * s, a[3] * s, b[0], b[1], b[2], b[3]); } };
    if (SRC[name]) layer(SRC[name]); const o = OVER[name]; if (o && overlayUsable(o[0], o[1], w, h, d)) layer(o); }
  const tex = new THREE.CanvasTexture(cv); tex.magFilter = tex.minFilter = THREE.NearestFilter; tex.generateMipmaps = false; tex.colorSpace = THREE.NoColorSpace;
  return tex;
}
export function defaultSteveTexture() { return (skins.steve || buildSkin('steve')).tex; }

const SHADE = [0.7, 0.7, 1, 0.5, 0.85, 0.85]; // px nx py ny pz nz
function partGeometry(skin, name, [w, h, d], off, inf = 0) {
  const g = new THREE.BoxGeometry((w + inf * 2) / 16, (h + inf * 2) / 16, (d + inf * 2) / 16); g.translate((off[0] + w / 2) / 16, (off[1] + h / 2) / 16, (off[2] + d / 2) / 16);
  const [u, v] = skin.regions[name]; const W = Math.ceil(w), H = Math.ceil(h), D = Math.ceil(d);
  const R = [[u, v + D, D, H], [u + D + W, v + D, D, H], [u + D, v, W, D], [u + D + W, v, W, D], [u + 2 * D + W, v + D, W, H], [u + D, v + D, W, H]];
  const uv = g.attributes.uv; const col = new Float32Array(24 * 3);
  for (let f = 0; f < 6; f++) { const [rx, ry, rw, rh] = R[f]; for (let k = 0; k < 4; k++) { const i = f * 4 + k; const uu = uv.getX(i), vv = uv.getY(i); uv.setXY(i, (rx + uu * rw) / skin.W, 1 - (ry + (1 - vv) * rh) / skin.H); col.fill(SHADE[f], i * 3, i * 3 + 3); } }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); return g;
}
const geoCache = {};
export function buildModel(type, variant) {
  const sk = variant ? type + ':' + variant : type; const skin = skins[sk] || buildSkin(type, variant); const parts = {}; const root = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ map: skin.tex, vertexColors: true, alphaTest: 0.5 }); const woolMat = mat.clone(); const glassMat = new THREE.MeshBasicMaterial({ map: skin.tex, vertexColors: true, transparent: true, opacity: 0.75, alphaTest: 0.05, depthWrite: false });
  const gc = geoCache[sk] || (geoCache[sk] = {});
  for (const [name, size, pivot, off, parent, opts] of MODELS[type]) {
    const grp = new THREE.Group(); grp.position.set(pivot[0] / 16, pivot[1] / 16, pivot[2] / 16);
    const geo = gc[name] || (gc[name] = partGeometry(skin, name, size, off, opts && opts.inflate)); const m = new THREE.Mesh(geo, opts && opts.wool ? woolMat : opts && opts.glass ? glassMat : mat); if (opts && opts.glass) m.renderOrder = 1; grp.add(m); grp.userData.wool = !!(opts && opts.wool);
    parts[name] = grp; (parent ? parts[parent] : root).add(grp);
  }
  return { root, parts, mat, woolMat, glassMat, skin };
}
