// Texture pack sheets (loaded once before the game starts). Each entry is a canvas, or missing if it failed to load.
export const PACK = {};
const FILES = { terrain: 'terrain.png', items: 'items.png', gui: 'gui.png', icons: 'icons.png', particles: 'sprites.png', mobs: 'mobtextures.png', blocks17: 'blocks17.png', witch: 'witch.png' };
const MAGENTA = [214, 127, 255];

function load(src) { return new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; }); }
// single 16x16 images (1.7 style): PACK['item:name'] / PACK['block:name']
const ITEM_FILES = 'apple apple_golden arrow bed beef_cooked beef_raw blaze_powder blaze_rod boat bone book_normal bow_standby bowl bread brewing_stand brick carrot_golden cauldron comparator cookie dye_powder_black dye_powder_blue dye_powder_brown dye_powder_cyan dye_powder_gray dye_powder_green dye_powder_light_blue dye_powder_lime dye_powder_magenta dye_powder_orange dye_powder_pink dye_powder_purple dye_powder_red dye_powder_silver dye_powder_white dye_powder_yellow egg emerald ender_pearl feather fish_cod_cooked fish_cod_raw flint flint_and_steel flower_pot ghast_tear glowstone_dust gold_axe gold_boots gold_chestplate gold_helmet gold_hoe gold_horse_armor gold_ingot gold_leggings gold_nugget gold_pickaxe gold_shovel gold_sword gunpowder hopper iron_axe iron_boots iron_chestplate iron_helmet iron_hoe iron_horse_armor iron_ingot iron_leggings iron_pickaxe iron_shovel iron_sword item_frame lead leather magma_cream melon melon_speckled minecart_normal mushroom_stew name_tag nether_wart netherbrick paper porkchop_cooked porkchop_raw potato potato_baked potato_poisonous potion_bottle_empty pumpkin_pie quartz record_11 record_13 record_blocks record_cat record_chirp record_far record_mall record_mellohi record_stal record_strad record_wait record_ward redstone_dust reeds repeater rotten_flesh saddle seeds_melon seeds_pumpkin seeds_wheat shears sign'.split(' ');
const BLOCK_FILES = { piston_bottom: 'piston_bottom', piston_inner: 'piston_inner', piston_side: 'piston_side', piston_top: 'piston_top_normal', piston_top_sticky: 'piston_top_sticky' };
// whole-entity skins (vanilla layouts): PACK['mob:name'] from textures/mobs/
const MOB_FILES = 'wolf wolf_tame wolf_angry wolf_collar ghast ghast_shooting wither_skeleton skeleton cave_spider wither wither_invulnerable wither_armor zombie_pigman squid spider_eyes snowman silverfish chicken blaze ocelot black red siamese lead_knot experience_orb steve witch17 iron_golem bat boat minecart sign arrow mule donkey horse_zombie horse_white horse_skeleton horse_markings_whitefield horse_markings_whitedots horse_markings_white horse_markings_blackdots horse_gray horse_darkbrown horse_creamy horse_chestnut horse_brown horse_black'.split(' ');
export async function loadPack(base = 'textures/') {
  const one = async (key, src) => { const im = await load(src); if (!im) return; const cv = document.createElement('canvas'); cv.width = im.width; cv.height = im.height; cv.getContext('2d', { willReadFrequently: true }).drawImage(im, 0, 0); PACK[key] = cv; };
  await Promise.all([...ITEM_FILES.map(n => one('item:' + n, base + 'items/' + n + '.png')), ...Object.entries(BLOCK_FILES).map(([k, f]) => one('block:' + k, base + 'blocks/' + f + '.png')), ...MOB_FILES.map(n => one('mob:' + n, base + 'mobs/' + n + '.png'))]);
  await Promise.all(Object.entries(FILES).map(async ([k, f]) => {
    const im = await load(base + f); if (!im) return;
    const cv = document.createElement('canvas'); cv.width = im.width; cv.height = im.height;
    const ctx = cv.getContext('2d', { willReadFrequently: true }); ctx.drawImage(im, 0, 0); PACK[k] = cv;
  }));
}
// arbitrary rectangle of a sheet as its own canvas (null when the sheet is missing)
export function crop(sheet, x, y, w, h) {
  const cv = PACK[sheet]; if (!cv) return null;
  const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(cv, x, y, w, h, 0, 0, w, h); return c;
}
// 16x16 cell (col,row) of a sheet as ImageData, or null when absent / a magenta "missing" placeholder
export function cell(sheet, col, row, size = 16) {
  const cv = PACK[sheet]; if (!cv || (col + 1) * size > cv.width || (row + 1) * size > cv.height) return null;
  const d = cv.getContext('2d', { willReadFrequently: true }).getImageData(col * size, row * size, size, size);
  let mag = 0, any = 0; const p = d.data;
  for (let i = 0; i < p.length; i += 4) { if (p[i + 3] > 0) any++; if (Math.abs(p[i] - MAGENTA[0]) < 24 && Math.abs(p[i + 1] - MAGENTA[1]) < 24 && Math.abs(p[i + 2] - MAGENTA[2]) < 24) mag++; }
  if (!any || mag > p.length / 8) return null;
  return d;
}
