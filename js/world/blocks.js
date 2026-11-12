// Block registry - IDs follow the classic 1.2.5 numeric layout
export const B = {};
export const blocks = new Array(256).fill(null);

// shape: cube | cross | liquid | torch | slab | layer | cactus | flat | none
function reg(id, key, o) {
  const b = Object.assign({
    id, key, name: key, tex: 'stone', hardness: 1, resistance: 1, tool: null, level: 0,
    solid: true, opaque: true, transparent: false, light: 0, lightOpacity: 15,
    drop: id, dropCount: 1, sound: 'stone', shape: 'cube', tint: null, replaceable: false,
    needsSupport: false, cull: true, stack: 64,
  }, o);
  if (!b.opaque && o.lightOpacity === undefined) b.lightOpacity = b.shape === 'liquid' ? 3 : (key === 'leaves' ? 1 : 0);
  if (b.variants && o.keepMeta === undefined && !o.dropFn && (o.drop === undefined || o.drop === id)) b.keepMeta = true;
  if (typeof b.tex === 'string') { const t = b.tex; b.tex = () => t; }
  else if (typeof b.tex === 'object') { const t = b.tex; b.tex = (face) => face === 'top' ? (t.top || t.side) : face === 'bottom' ? (t.bottom || t.top || t.side) : face === 'front' ? (t.front || t.side) : t.side; }
  blocks[id] = b; B[key.toUpperCase()] = id; return b;
}
export const COLORS = ['White', 'Orange', 'Magenta', 'Light Blue', 'Yellow', 'Lime', 'Pink', 'Gray', 'Light Gray', 'Cyan', 'Purple', 'Blue', 'Brown', 'Green', 'Red', 'Black'];
const FLOWERS = [['Poppy', 'poppy'], ['Blue Orchid', 'blue_orchid'], ['Allium', 'allium'], ['Azure Bluet', 'azure_bluet'], ['Red Tulip', 'tulip_red'], ['Orange Tulip', 'tulip_orange'], ['White Tulip', 'tulip_white'], ['Pink Tulip', 'tulip_pink'], ['Oxeye Daisy', 'oxeye_daisy']];
const plant = { solid: false, opaque: false, transparent: true, shape: 'cross', hardness: 0, sound: 'grass', needsSupport: true };

reg(0, 'air', { solid: false, opaque: false, transparent: true, shape: 'none', hardness: 0, drop: 0, replaceable: true, lightOpacity: 0 });
reg(1, 'stone', { tex: 'stone', hardness: 1.5, resistance: 30, tool: 'pickaxe', level: 1, drop: 4 });
reg(2, 'grass', { name: 'Grass Block', tex: (f) => f === 'top' ? 'grass_top' : f === 'bottom' ? 'dirt' : 'grass_side', hardness: 0.6, tool: 'shovel', drop: 3, sound: 'grass', tint: 'grassTop' });
reg(3, 'dirt', { tex: (f, m) => m === 1 ? 'coarse_dirt' : m === 2 ? (f === 'top' ? 'podzol_top' : f === 'bottom' ? 'dirt' : 'podzol_side') : 'dirt', variants: ['Dirt', 'Coarse Dirt', 'Podzol'], hardness: 0.5, tool: 'shovel', sound: 'gravel' });
reg(4, 'cobblestone', { tex: 'cobblestone', hardness: 2, resistance: 30, tool: 'pickaxe', level: 1 });
reg(5, 'planks', { name: 'Wooden Planks', tex: (f, m) => ['planks', 'planks_spruce', 'planks_birch', 'planks_jungle', 'planks_acacia', 'planks_dark_oak'][m] || 'planks', variants: ['Oak Wood Planks', 'Spruce Wood Planks', 'Birch Wood Planks', 'Jungle Wood Planks', 'Acacia Wood Planks', 'Dark Oak Wood Planks'], hardness: 2, resistance: 15, tool: 'axe', sound: 'wood' });
reg(6, 'sapling', { ...plant, tex: (f, m) => (m & 7) === 4 ? 'acacia_sapling' : (m & 7) === 5 ? 'dark_oak_sapling' : 'sapling', variants: ['Oak Sapling', 'Spruce Sapling', 'Birch Sapling', 'Jungle Sapling', 'Acacia Sapling', 'Dark Oak Sapling'] });
reg(7, 'bedrock', { tex: 'bedrock', hardness: -1, resistance: 1e7, drop: 0 });
reg(8, 'water', { tex: 'water', solid: false, opaque: false, transparent: true, shape: 'liquid', hardness: 100, drop: 0, replaceable: true, fluid: 'water' });
reg(9, 'still_water', { name: 'Water', tex: 'water', solid: false, opaque: false, transparent: true, shape: 'liquid', hardness: 100, drop: 0, replaceable: true, fluid: 'water' });
reg(10, 'lava', { tex: 'lava', solid: false, opaque: false, transparent: false, shape: 'liquid', hardness: 0, drop: 0, light: 15, replaceable: true, fluid: 'lava', lightOpacity: 0 });
reg(11, 'still_lava', { name: 'Lava', tex: 'lava', solid: false, opaque: false, transparent: false, shape: 'liquid', hardness: 100, drop: 0, light: 15, replaceable: true, fluid: 'lava', lightOpacity: 0 });
reg(12, 'sand', { tex: (f, m) => m === 1 ? 'red_sand' : 'sand', variants: ['Sand', 'Red Sand'], hardness: 0.5, tool: 'shovel', sound: 'sand', falls: true });
reg(13, 'gravel', { tex: 'gravel', hardness: 0.6, tool: 'shovel', sound: 'gravel', falls: true, dropFn: (m, r) => r() < 0.1 ? [318, 1] : [13, 1] });
reg(14, 'gold_ore', { tex: 'gold_ore', hardness: 3, resistance: 15, tool: 'pickaxe', level: 3 });
reg(15, 'iron_ore', { tex: 'iron_ore', hardness: 3, resistance: 15, tool: 'pickaxe', level: 2 });
reg(16, 'coal_ore', { tex: 'coal_ore', hardness: 3, resistance: 15, tool: 'pickaxe', level: 1, drop: 263 });
const logTex = ['log_side', 'spruce_log_side', 'birch_log_side', 'jungle_log_side'];
reg(17, 'log', { name: 'Wood', tex: (f, m) => (f === 'top' || f === 'bottom') ? 'log_top' : logTex[m & 3], variants: ['Oak Wood', 'Spruce Wood', 'Birch Wood', 'Jungle Wood'], hardness: 2, tool: 'axe', sound: 'wood', keepMeta: true });
reg(18, 'leaves', { tex: (f, m) => (m & 3) === 1 ? 'spruce_leaves' : 'leaves', variants: ['Oak Leaves', 'Spruce Leaves', 'Birch Leaves', 'Jungle Leaves'], opaque: false, transparent: true, hardness: 0.2, sound: 'grass', tint: 'foliage', cull: false, lightOpacity: 1,
  dropFn: (m, r) => r() < 0.05 ? [6, 1] : (r() < 0.005 ? [260, 1] : null) });
reg(19, 'sponge', { tex: 'sponge', hardness: 0.6, sound: 'grass' });
reg(20, 'glass', { tex: 'glass', opaque: false, transparent: true, hardness: 0.3, sound: 'glass', drop: 0 });
reg(21, 'lapis_ore', { name: 'Lapis Lazuli Ore', tex: 'lapis_ore', hardness: 3, tool: 'pickaxe', level: 2, dropFn: (m, r) => [351, 4 + ((r() * 5) | 0), 4] });
reg(22, 'lapis_block', { name: 'Lapis Lazuli Block', tex: 'lapis_block', hardness: 3, tool: 'pickaxe', level: 2 });
reg(24, 'sandstone', { tex: { top: 'sandstone_top', side: 'sandstone_side', bottom: 'sandstone_bottom' }, hardness: 0.8, tool: 'pickaxe', level: 1 });
reg(26, 'bed', { tex: (f, m) => f === 'bottom' ? 'planks' : (m & 8 ? 'bed_head_' : 'bed_feet_') + (f === 'top' ? 'top' : 'side'), shape: 'slab', opaque: false, transparent: true, hardness: 0.2, sound: 'wood', drop: 355, lightOpacity: 0 });
reg(31, 'tallgrass', { ...plant, name: 'Tall Grass', tex: (f, m) => m === 2 ? 'fern' : m === 0 ? 'deadbush' : 'tallgrass', tint: 'grass', replaceable: true, dropFn: (m, r) => r() < 0.125 ? [295, 1] : null });
reg(32, 'deadbush', { ...plant, name: 'Dead Bush', tex: 'deadbush', replaceable: true, drop: 0 });
reg(35, 'wool', { tex: (f, m) => 'wool_' + (m & 15), variants: COLORS.map(c => c + ' Wool'), hardness: 0.8, sound: 'cloth' });
reg(37, 'dandelion', { ...plant, name: 'Dandelion', tex: 'flower_yellow' });
reg(38, 'rose', { ...plant, name: 'Poppy', tex: (f, m) => FLOWERS[m] ? FLOWERS[m][1] : 'poppy', variants: FLOWERS.map(f => f[0]) });
reg(39, 'brown_mushroom', { ...plant, name: 'Mushroom', tex: 'mushroom_brown', light: 1 });
reg(40, 'red_mushroom', { ...plant, name: 'Mushroom', tex: 'mushroom_red' });
reg(41, 'gold_block', { name: 'Block of Gold', tex: 'gold_block', hardness: 3, tool: 'pickaxe', level: 3, sound: 'metal' });
reg(42, 'iron_block', { name: 'Block of Iron', tex: 'iron_block', hardness: 5, tool: 'pickaxe', level: 2, sound: 'metal' });
reg(43, 'double_slab', { name: 'Stone Slab', tex: { top: 'slab_top', side: 'slab_side' }, hardness: 2, tool: 'pickaxe', level: 1, drop: 44, dropCount: 2 });
reg(44, 'slab', { name: 'Stone Slab', tex: { top: 'slab_top', side: 'slab_side' }, shape: 'slab', opaque: false, transparent: true, hardness: 2, tool: 'pickaxe', level: 1, lightOpacity: 0, cull: false });
reg(45, 'bricks', { tex: 'bricks', hardness: 2, resistance: 30, tool: 'pickaxe', level: 1 });
reg(46, 'tnt', { name: 'TNT', tex: { top: 'tnt_top', side: 'tnt_side' }, hardness: 0, sound: 'grass' });
reg(47, 'bookshelf', { tex: { top: 'planks', side: 'bookshelf' }, hardness: 1.5, tool: 'axe', sound: 'wood', drop: 0 });
reg(48, 'mossy_cobblestone', { name: 'Moss Stone', tex: 'mossy_cobblestone', hardness: 2, tool: 'pickaxe', level: 1 });
reg(49, 'obsidian', { tex: 'obsidian', hardness: 50, resistance: 6000, tool: 'pickaxe', level: 4 });
reg(50, 'torch', { tex: 'torch', solid: false, opaque: false, transparent: true, shape: 'torch', hardness: 0, light: 14, sound: 'wood', needsSupport: true });
reg(51, 'fire', { tex: 'fire', solid: false, opaque: false, transparent: true, shape: 'cross', hardness: 0, light: 15, drop: 0, replaceable: true });
reg(52, 'mob_spawner', { name: 'Monster Spawner', tex: 'mob_spawner', opaque: false, transparent: true, hardness: 5, tool: 'pickaxe', level: 1, drop: 0, sound: 'metal', lightOpacity: 0 });
reg(54, 'chest', { tex: { top: 'chest_top', side: 'chest_side', front: 'chest_front' }, hardness: 2.5, tool: 'axe', sound: 'wood', container: 'chest', facing: true });
reg(56, 'diamond_ore', { tex: 'diamond_ore', hardness: 3, tool: 'pickaxe', level: 3, drop: 264 });
reg(57, 'diamond_block', { name: 'Block of Diamond', tex: 'diamond_block', hardness: 5, tool: 'pickaxe', level: 3, sound: 'metal' });
reg(58, 'crafting_table', { tex: { top: 'crafting_top', side: 'crafting_side', bottom: 'planks' }, hardness: 2.5, tool: 'axe', sound: 'wood', gui: 'workbench' });
reg(59, 'wheat', { ...plant, name: 'Crops', tex: (f, m) => m >= 7 ? 'wheat_7' : m >= 3 ? 'wheat_3' : 'wheat_0', shape: 'cross', dropFn: (m, r) => m >= 7 ? [[296, 1], [295, 1 + ((r() * 3) | 0)]] : [295, 1] });
reg(60, 'farmland', { tex: (f, m) => f === 'top' ? (m > 0 ? 'farmland_wet' : 'farmland') : 'dirt', hardness: 0.6, tool: 'shovel', sound: 'gravel', drop: 3, shape: 'layer', height: 15 / 16, opaque: false, lightOpacity: 15 });
reg(61, 'furnace', { tex: { top: 'furnace_top', side: 'furnace_side', front: 'furnace_front' }, hardness: 3.5, tool: 'pickaxe', level: 1, container: 'furnace', facing: true });
reg(62, 'lit_furnace', { name: 'Furnace', tex: { top: 'furnace_top', side: 'furnace_side', front: 'furnace_front_lit' }, hardness: 3.5, tool: 'pickaxe', level: 1, light: 13, drop: 61, container: 'furnace', facing: true });
reg(65, 'ladder', { tex: 'ladder', solid: false, opaque: false, transparent: true, shape: 'wall', hardness: 0.4, tool: 'axe', sound: 'wood', climbable: true, needsSupport: true });
reg(73, 'redstone_ore', { tex: 'redstone_ore', hardness: 3, tool: 'pickaxe', level: 3, dropFn: (m, r) => [331, 4 + ((r() * 2) | 0)] });
reg(74, 'lit_redstone_ore', { name: 'Redstone Ore', tex: 'redstone_ore', hardness: 3, tool: 'pickaxe', level: 3, light: 9, dropFn: (m, r) => [331, 4 + ((r() * 2) | 0)] });
reg(78, 'snow_layer', { name: 'Snow', tex: 'snow_layer', shape: 'layer', height: 2 / 16, solid: false, opaque: false, transparent: true, hardness: 0.1, tool: 'shovel', sound: 'snow', drop: 332, replaceable: true, needsSupport: true, lightOpacity: 0, cull: false });
reg(79, 'ice', { tex: 'ice', opaque: false, transparent: true, hardness: 0.5, tool: 'pickaxe', sound: 'glass', drop: 0, lightOpacity: 3, slippery: true });
reg(174, 'packed_ice', { name: 'Packed Ice', tex: 'packed_ice', hardness: 0.5, tool: 'pickaxe', sound: 'glass', slippery: true });
reg(80, 'snow', { name: 'Snow', tex: 'snow', hardness: 0.2, tool: 'shovel', sound: 'snow', drop: 332, dropCount: 4 });
reg(81, 'cactus', { tex: { top: 'cactus_top', side: 'cactus_side', bottom: 'cactus_bottom' }, shape: 'cactus', opaque: false, transparent: true, hardness: 0.4, sound: 'cloth', needsSupport: true, lightOpacity: 0, cull: false, hurts: true });
reg(82, 'clay', { tex: 'clay', hardness: 0.6, tool: 'shovel', sound: 'gravel', drop: 337, dropCount: 4 });
reg(83, 'reeds', { ...plant, name: 'Sugar Cane', tex: 'reeds', drop: 338 });
reg(86, 'pumpkin', { tex: { top: 'pumpkin_top', side: 'pumpkin_side' }, hardness: 1, tool: 'axe', sound: 'wood' });
reg(87, 'netherrack', { tex: 'netherrack', hardness: 0.4, tool: 'pickaxe', level: 1 });
reg(115, 'nether_wart_block', { ...plant, name: 'Nether Wart', tex: (f, m) => 'nether_wart_' + (m >= 3 ? 2 : m >= 1 ? 1 : 0), dropFn: (m, r) => [372, m >= 3 ? 2 + ((r() * 3) | 0) : 1] });
reg(117, 'brewing_stand_block', { name: 'Brewing Stand', tex: f => f === 'top' || f === 'bottom' ? 'brewing_base' : 'brewing_stand', shape: 'cross', solid: false, opaque: false, transparent: true, hardness: 0.5, tool: 'pickaxe', drop: 379, light: 1, container: 'brewing', lightOpacity: 0 });
reg(88, 'soul_sand', { tex: 'soul_sand', hardness: 0.5, tool: 'shovel', sound: 'sand' });
reg(89, 'glowstone', { tex: 'glowstone', hardness: 0.3, light: 15, sound: 'glass', drop: 348, dropCount: 3 });
// nether portal: meta 0 = plane along x, 1 = plane along z
reg(90, 'portal', { tex: 'portal', solid: false, opaque: false, transparent: true, shape: 'portal', hardness: -1, resistance: 0, light: 11, drop: 0, lightOpacity: 0, sound: 'glass' });
reg(98, 'stone_bricks', { tex: 'stonebrick', hardness: 1.5, tool: 'pickaxe', level: 1 });
reg(103, 'melon', { tex: { top: 'melon_top', side: 'melon_side' }, hardness: 1, tool: 'axe', sound: 'wood', dropFn: (m, r) => [360, 3 + ((r() * 5) | 0)] });
// ---- 1.3 - 1.7 blocks ----
reg(95, 'stained_glass', { name: 'Stained Glass', tex: (f, m) => 'stained_glass_' + (m & 15), variants: COLORS.map(c => c + ' Stained Glass'), opaque: false, transparent: true, hardness: 0.3, sound: 'glass', drop: 0, lightOpacity: 0, cull: true });
reg(129, 'emerald_ore', { name: 'Emerald Ore', tex: 'emerald_ore', hardness: 3, resistance: 15, tool: 'pickaxe', level: 3, drop: 450 });
reg(133, 'emerald_block', { name: 'Block of Emerald', tex: 'emerald_block', hardness: 5, resistance: 30, tool: 'pickaxe', level: 3, sound: 'metal' });
reg(152, 'redstone_block', { name: 'Block of Redstone', tex: 'redstone_block', hardness: 5, resistance: 30, tool: 'pickaxe', level: 1, sound: 'metal' });
reg(159, 'stained_clay', { name: 'Stained Clay', tex: (f, m) => 'stained_clay_' + (m & 15), variants: COLORS.map(c => c + ' Stained Clay'), hardness: 1.25, resistance: 21, tool: 'pickaxe', level: 1 });
reg(161, 'leaves2', { name: 'Leaves', tex: (f, m) => (m & 3) === 1 ? 'dark_oak_leaves' : 'acacia_leaves', variants: ['Acacia Leaves', 'Dark Oak Leaves'], opaque: false, transparent: true, hardness: 0.2, sound: 'grass', tint: 'foliage', cull: false, lightOpacity: 1,
  dropFn: (m, r) => r() < 0.05 ? [6, 1, 4 + (m & 1)] : null });
reg(162, 'log2', { name: 'Wood', tex: (f, m) => (f === 'top' || f === 'bottom') ? ((m & 3) === 1 ? 'dark_oak_log_top' : 'acacia_log_top') : ((m & 3) === 1 ? 'dark_oak_log_side' : 'acacia_log_side'), variants: ['Acacia Wood', 'Dark Oak Wood'], hardness: 2, tool: 'axe', sound: 'wood', keepMeta: true });
reg(170, 'hay_block', { name: 'Hay Bale', tex: { top: 'hay_top', side: 'hay_side' }, hardness: 0.5, sound: 'grass' });
reg(171, 'carpet', { name: 'Carpet', tex: (f, m) => 'wool_' + (m & 15), variants: COLORS.map(c => c + ' Carpet'), shape: 'layer', height: 1 / 16, solid: false, opaque: false, transparent: true, hardness: 0.1, sound: 'cloth', needsSupport: true, lightOpacity: 0, cull: false });
reg(172, 'hardened_clay', { name: 'Hardened Clay', tex: 'hardened_clay', hardness: 1.25, resistance: 21, tool: 'pickaxe', level: 1 });
reg(173, 'coal_block', { name: 'Block of Coal', tex: 'coal_block', hardness: 5, resistance: 30, tool: 'pickaxe', level: 1 });
reg(106, 'vine', { tex: 'vine', solid: false, opaque: false, transparent: true, shape: 'vine', hardness: 0.2, tool: 'shears', sound: 'grass', tint: 'foliage', climbable: true, drop: 0, replaceable: true, cull: false });

reg(63, 'sign', { name: 'Sign', tex: 'planks', solid: false, opaque: false, transparent: true, shape: 'none', hardness: 1, tool: 'axe', sound: 'wood', drop: 323, needsSupport: true, sign: true });
reg(68, 'wall_sign', { name: 'Sign', tex: 'planks', solid: false, opaque: false, transparent: true, shape: 'none', hardness: 1, tool: 'axe', sound: 'wood', drop: 323, needsSupport: true, sign: true });
// doors: meta bits 0-1 = closed side (0 W,1 N,2 E,3 S), bit 2 = open, bit 3 = upper half
const doorDrop = item => m => m & 8 ? null : [item, 1];
reg(64, 'wooden_door', { name: 'Wooden Door', tex: (f, m) => m & 8 ? 'door_wood_upper' : 'door_wood_lower', shape: 'door', opaque: false, transparent: true, lightOpacity: 0, hardness: 3, resistance: 15, tool: 'axe', sound: 'wood', needsSupport: true, door: 'wood', dropFn: doorDrop(324) });
reg(71, 'iron_door', { name: 'Iron Door', tex: (f, m) => m & 8 ? 'door_iron_upper' : 'door_iron_lower', shape: 'door', opaque: false, transparent: true, lightOpacity: 0, hardness: 5, resistance: 50, tool: 'pickaxe', level: 1, sound: 'metal', needsSupport: true, door: 'iron', dropFn: doorDrop(330) });
// lever: meta bits 0-2 = mount (1-4 walls like torches, 5 floor), bit 3 = on
reg(69, 'lever', { tex: 'lever', solid: false, opaque: false, transparent: true, shape: 'lever', hardness: 0.5, sound: 'wood', needsSupport: true, dropFn: () => [69, 1] });

// pistons: meta bits 0-2 = facing (0 down, 1 up, 2 north, 3 south, 4 west, 5 east), bit 3 = extended (base) / sticky (head)
const pistonTex = top => (f) => f === 'top' ? top : f === 'bottom' ? 'piston_bottom' : 'piston_side';
reg(33, 'piston', { tex: pistonTex('piston_top'), shape: 'piston', opaque: false, lightOpacity: 15, hardness: 0.5, sound: 'stone', piston: true, dropFn: () => [33, 1] });
reg(29, 'sticky_piston', { name: 'Sticky Piston', tex: pistonTex('piston_top_sticky'), shape: 'piston', opaque: false, lightOpacity: 15, hardness: 0.5, sound: 'stone', piston: true, sticky: true, dropFn: () => [29, 1] });
reg(34, 'piston_head', { name: 'Piston Head', tex: pistonTex('piston_top'), shape: 'piston', opaque: false, lightOpacity: 15, hardness: 0.5, sound: 'stone', drop: 0 });
reg(25, 'noteblock', { name: 'Note Block', tex: 'noteblock', hardness: 0.8, tool: 'axe', sound: 'wood', dropFn: () => [25, 1] });
reg(84, 'jukebox', { tex: { top: 'jukebox_top', side: 'jukebox_side' }, hardness: 2, resistance: 30, tool: 'axe', sound: 'wood', dropFn: () => [84, 1] });

// ---- redstone components ----
const flat = { solid: false, opaque: false, transparent: true, lightOpacity: 0, cull: false, hardness: 0, needsSupport: true };
// wire: meta = power 0-15
reg(55, 'redstone_wire', { ...flat, name: 'Redstone Dust', tex: 'redstone_dust_cross', shape: 'wire', drop: 331, replaceable: false });
// redstone torch: meta like torches (1-4 walls, 5 floor)
reg(75, 'unlit_redstone_torch', { name: 'Redstone Torch', tex: 'redstone_torch_off', solid: false, opaque: false, transparent: true, shape: 'torch', hardness: 0, sound: 'wood', needsSupport: true, drop: 76, rsTorch: true });
reg(76, 'redstone_torch', { name: 'Redstone Torch', tex: 'redstone_torch_on', solid: false, opaque: false, transparent: true, shape: 'torch', hardness: 0, light: 7, sound: 'wood', needsSupport: true, drop: 76, rsTorch: true });
// buttons: meta 1-5 mount (like levers), bit 3 = pressed
reg(77, 'stone_button', { ...flat, name: 'Button', tex: 'stone', shape: 'button', hardness: 0.5, sound: 'stone', button: 20 });
reg(143, 'wooden_button', { ...flat, name: 'Wooden Button', tex: 'planks', shape: 'button', hardness: 0.5, sound: 'wood', button: 30 });
// pressure plates: meta 1 = pressed
reg(70, 'stone_pressure_plate', { ...flat, name: 'Stone Pressure Plate', tex: 'stone', shape: 'plate', hardness: 0.5, sound: 'stone', plate: 'mobs' });
reg(72, 'wooden_pressure_plate', { ...flat, name: 'Wooden Pressure Plate', tex: 'planks', shape: 'plate', hardness: 0.5, sound: 'wood', plate: 'all' });
// repeater: meta bits 0-1 = output direction (0 N, 1 E, 2 S, 3 W), bits 2-3 = delay - 1
reg(93, 'unpowered_repeater', { ...flat, name: 'Redstone Repeater', tex: f => f === 'top' ? 'repeater_off' : 'slab_top', shape: 'repeater', sound: 'wood', drop: 356, repeater: true });
reg(94, 'powered_repeater', { ...flat, name: 'Redstone Repeater', tex: f => f === 'top' ? 'repeater_on' : 'slab_top', shape: 'repeater', sound: 'wood', drop: 356, repeater: true });
reg(123, 'redstone_lamp', { name: 'Redstone Lamp', tex: 'redstone_lamp_off', hardness: 0.3, sound: 'glass', drop: 123 });
reg(124, 'lit_redstone_lamp', { name: 'Redstone Lamp', tex: 'redstone_lamp_on', hardness: 0.3, sound: 'glass', light: 15, drop: 123 });
// ---- quartz, nether brick, fences ----
reg(153, 'quartz_ore', { name: 'Nether Quartz Ore', tex: 'quartz_ore', hardness: 3, resistance: 15, tool: 'pickaxe', level: 1, dropFn: () => [406, 1] });
reg(155, 'quartz_block', { name: 'Block of Quartz', tex: (f, m) => m === 1 ? (f === 'side' ? 'quartz_chiseled_side' : 'quartz_chiseled_top') : m === 2 ? (f === 'side' ? 'quartz_pillar_side' : 'quartz_pillar_top') : f === 'top' ? 'quartz_top' : f === 'bottom' ? 'quartz_bottom' : 'quartz_side',
  variants: ['Block of Quartz', 'Chiseled Quartz Block', 'Pillar Quartz Block'], hardness: 0.8, tool: 'pickaxe', level: 1 });
reg(112, 'nether_brick', { name: 'Nether Brick', tex: 'nether_brick', hardness: 2, resistance: 30, tool: 'pickaxe', level: 1 });
reg(85, 'fence', { name: 'Fence', tex: 'planks', shape: 'fence', opaque: false, transparent: true, lightOpacity: 0, cull: false, hardness: 2, resistance: 15, tool: 'axe', sound: 'wood', fence: true });
reg(113, 'nether_brick_fence', { name: 'Nether Brick Fence', tex: 'nether_brick', shape: 'fence', opaque: false, transparent: true, lightOpacity: 0, cull: false, hardness: 2, resistance: 30, tool: 'pickaxe', level: 1, fence: true });
// fence gate: meta bits 0-1 = facing (0/2 spans x, 1/3 spans z), bit 2 = open
reg(107, 'fence_gate', { name: 'Fence Gate', tex: 'planks', shape: 'gate', opaque: false, transparent: true, lightOpacity: 0, cull: false, hardness: 2, resistance: 15, tool: 'axe', sound: 'wood' });

// derived lookup tables (fast access in hot loops)
export const OPAQUE = new Uint8Array(256), SOLID = new Uint8Array(256), LIGHT = new Uint8Array(256), LOPAC = new Uint8Array(256), SHAPE = new Uint8Array(256);
// ---- rails + command block ----
const railB = { solid: false, opaque: false, transparent: true, lightOpacity: 0, cull: false, hardness: 0.7, needsSupport: true, shape: 'rail', sound: 'metal', rail: true };
reg(66, 'rail', { ...railB, name: 'Rail', tex: (f, m) => (m | 0) >= 6 ? 'rail_normal_turned' : 'rail_normal' });
reg(27, 'golden_rail', { ...railB, name: 'Powered Rail', tex: (f, m) => m & 8 ? 'rail_golden_powered' : 'rail_golden', dropFn: () => [27, 1] });
reg(28, 'detector_rail', { ...railB, name: 'Detector Rail', tex: (f, m) => m & 8 ? 'rail_detector_powered' : 'rail_detector', dropFn: () => [28, 1] });
reg(157, 'activator_rail', { ...railB, name: 'Activator Rail', tex: (f, m) => m & 8 ? 'rail_activator_powered' : 'rail_activator', dropFn: () => [157, 1] });
reg(137, 'command_block', { name: 'Command Block', tex: 'command_block', hardness: -1, resistance: 6000000, sound: 'metal' });
export const isRail = id => id === 66 || id === 27 || id === 28 || id === 157;
const SHAPES = ['none', 'cube', 'cross', 'liquid', 'torch', 'slab', 'layer', 'cactus', 'wall', 'vine', 'door', 'lever', 'portal', 'piston', 'wire', 'button', 'plate', 'repeater', 'fence', 'gate', 'rail'];
export const SH = Object.fromEntries(SHAPES.map((s, i) => [s, i]));
for (const b of blocks) if (b) {
  OPAQUE[b.id] = b.opaque && b.shape === 'cube' ? 1 : 0; SOLID[b.id] = b.solid ? 1 : 0; LIGHT[b.id] = b.light;
  LOPAC[b.id] = b.opaque ? 15 : b.lightOpacity; SHAPE[b.id] = SHAPES.indexOf(b.shape);
}
export const DOOR_T = 3 / 16;
// box of a door cell given its meta
export function doorBox(meta) {
  const side = meta & 4 ? (meta + 1) & 3 : meta & 3, t = DOOR_T;
  return side === 0 ? [0, 0, 0, t, 1, 1] : side === 1 ? [0, 0, 0, 1, 1, t] : side === 2 ? [1 - t, 0, 0, 1, 1, 1] : [0, 0, 1 - t, 1, 1, 1];
}
export const DIR6 = [[0, -1, 0], [0, 1, 0], [0, 0, -1], [0, 0, 1], [-1, 0, 0], [1, 0, 0]];
export const isDoor = id => id === 64 || id === 71;
export const isFluid = id => id >= 8 && id <= 11;
export const isWater = id => id === 8 || id === 9;
export const isLava = id => id === 10 || id === 11;
