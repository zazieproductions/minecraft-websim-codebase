// Spawn town for multiplayer servers: generated identically on every client from the world seed and
// applied to chunks as a base layer underneath player edits (so players can still change everything).
import { Generator } from '../world/gen.js';
import { idx } from '../world/chunk.js';

const AIR = 0, GRASS = 2, DIRT = 3, COBBLE = 4, PLANKS = 5, WATER = 9, GRAVEL = 13, LOG = 17, LEAVES = 18, GLASS = 20, WOOL = 35,
  ROSE = 38, DANDELION = 37, IRON = 42, DSLAB = 43, SLAB = 44, BRICKS = 45, BOOKS = 47, MOSSY = 48, TORCH = 50, CHEST = 54,
  WORKBENCH = 58, WHEAT = 59, FARMLAND = 60, FURNACE = 61, SIGN = 63, LADDER = 65, PUMPKIN = 86, GLOW = 89, STONEBRICK = 98, BED = 26;
const R = 76; // radius of the SMP town and surrounding city districts

export function buildTown(seed) {
  const gen = new Generator(seed);
  const map = new Map(); // "x,y,z" -> [x, y, z, id, meta, tile?]
  const set = (x, y, z, id, meta = 0, tile) => { if (y < 1 || y > 127) return; map.set(x + ',' + y + ',' + z, tile ? [x, y, z, id, meta, tile] : [x, y, z, id, meta]); };
  const box = (x0, y0, z0, x1, y1, z1, id, meta = 0) => { for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) set(x, y, z, id, meta); };
  const walls = (x0, y0, z0, x1, y1, z1, id, meta = 0) => { for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) if (x === x0 || x === x1 || z === z0 || z === z1) set(x, y, z, id, meta); };
  const Y = Math.max(64, gen.surfaceAt(0, 0)); // plaza surface level
  const samples = R / 4 * 2 + 1, heights = new Int16Array(samples * samples);
  for (let sx = 0; sx < samples; sx++) for (let sz = 0; sz < samples; sz++) heights[sx * samples + sz] = gen.surfaceAt(-R + sx * 4, -R + sz * 4);
  const groundAt = (x, z) => {
    const gx = (x + R) / 4, gz = (z + R) / 4;
    const ix = Math.min(samples - 2, Math.floor(gx)), iz = Math.min(samples - 2, Math.floor(gz));
    const fx = gx - ix, fz = gz - iz;
    const a = heights[ix * samples + iz], b = heights[(ix + 1) * samples + iz], c = heights[ix * samples + iz + 1], d = heights[(ix + 1) * samples + iz + 1];
    return Math.round((a + (b - a) * fx) * (1 - fz) + (c + (d - c) * fx) * fz);
  };

  // flatten the square: fill dips, shave hills, clear trees
  for (let x = -R; x <= R; x++) for (let z = -R; z <= R; z++) {
    const g = groundAt(x, z);
    for (let y = Math.min(g, Y - 3) + 1; y < Y; y++) set(x, y, z, DIRT);
    set(x, Y, z, GRASS);
    for (let y = Y + 1; y <= Math.max(g, Y) + 9; y++) set(x, y, z, AIR);
  }
  // flowers scattered on the grass (deterministic)
  let s = seed >>> 0; const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  for (let i = 0; i < 90; i++) { const x = Math.floor(rnd() * (2 * R + 1)) - R, z = Math.floor(rnd() * (2 * R + 1)) - R; set(x, Y + 1, z, rnd() < 0.5 ? ROSE : DANDELION); }

  // plaza + roads
  box(-8, Y, -8, 8, Y, 8, STONEBRICK); walls(-8, Y, -8, 8, Y, 8, DSLAB);
  box(-1, Y, -R, 1, Y, R, COBBLE); box(-R, Y, -1, R, Y, 1, COBBLE);
  for (let x = -8; x <= 8; x++) for (let z = -8; z <= 8; z++) set(x, Y + 1, z, AIR);
  // fountain
  walls(-3, Y + 1, -3, 3, Y + 1, 3, STONEBRICK); box(-2, Y + 1, -2, 2, Y + 1, 2, WATER);
  box(0, Y + 1, 0, 0, Y + 3, 0, STONEBRICK); set(0, Y + 4, 0, GLOW);
  for (const [x, z] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) set(x, Y + 2, z, TORCH, 5);
  // welcome sign facing the spawn point
  set(0, Y + 1, 6, SIGN, 0, { text: ['Welcome!', 'Websim SMP', 'Build. Explore.', 'Be kind!'] });
  // lamp posts along the roads
  const lamp = (x, z) => { box(x, Y + 1, z, x, Y + 3, z, LOG); set(x, Y + 4, z, GLOW); };
  for (const d of [12, 20, 27]) for (const sgn of [-1, 1]) { lamp(3, d * sgn); lamp(-3, d * sgn); lamp(d * sgn, 3); lamp(d * sgn, -3); }
  for (const [x, z] of [[-8, -8], [8, -8], [-8, 8], [8, 8]]) lamp(x, z);

  // generic building: floor, walls with corner posts, windows, a door gap, a stepped roof and a ceiling light
  const building = (x0, z0, x1, z1, h, o) => {
    box(x0, Y, z0, x1, Y, z1, o.floor);
    walls(x0, Y + 1, z0, x1, Y + h, z1, o.wall);
    for (const [x, z] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) box(x, Y + 1, z, x, Y + h, z, o.corner);
    box(x0 + 1, Y + 1, z0 + 1, x1 - 1, Y + h, z1 - 1, AIR);
    for (let x = x0 + 2; x < x1 - 1; x += 2) { set(x, Y + 2, z0, GLASS); set(x, Y + 2, z1, GLASS); }
    for (let z = z0 + 2; z < z1 - 1; z += 2) { set(x0, Y + 2, z, GLASS); set(x1, Y + 2, z, GLASS); }
    for (let i = 0; x0 - 1 + i <= x1 + 1 - i && z0 - 1 + i <= z1 + 1 - i; i++) box(x0 - 1 + i, Y + h + 1 + i, z0 - 1 + i, x1 + 1 - i, Y + h + 1 + i, z1 + 1 - i, o.roof);
    set(Math.floor((x0 + x1) / 2), Y + h, Math.floor((z0 + z1) / 2), GLOW);
    const [dx, dz] = o.door; box(dx, Y + 1, dz, dx, Y + 2, dz, AIR);
    // gravel path from the door to the nearest road
    if (dz === z1 || dz === z0) { const st = dz === z1 ? 1 : -1; for (let z = dz + st; Math.abs(z) > 1; z += st) set(dx, Y, z, GRAVEL); }
    else { const st = dx === x1 ? 1 : -1; for (let x = dx + st; Math.abs(x) > 1; x += st) set(x, Y, dz, GRAVEL); }
  };

  // NE: cottage with a bed, crafting table, furnace and chest
  building(10, -20, 20, -10, 4, { floor: PLANKS, wall: PLANKS, corner: LOG, roof: BRICKS, door: [15, -10] });
  set(11, Y + 1, -19, WORKBENCH); set(12, Y + 1, -19, FURNACE, 2); set(13, Y + 1, -19, CHEST, 2);
  set(19, Y + 1, -18, BED, 0); set(19, Y + 1, -19, BED, 8);
  set(18, Y + 1, -11, PUMPKIN); box(11, Y + 1, -15, 11, Y + 1, -14, WOOL);

  // NW: library lined with bookshelves
  building(-20, -20, -10, -10, 5, { floor: PLANKS, wall: STONEBRICK, corner: STONEBRICK, roof: COBBLE, door: [-15, -10] });
  for (let x = -19; x <= -11; x++) { box(x, Y + 1, -19, x, Y + 3, -19, BOOKS); }
  for (let z = -18; z <= -12; z++) { box(-19, Y + 1, z, -19, Y + 3, z, BOOKS); box(-11, Y + 1, z, -11, Y + 3, z, BOOKS); }
  box(-16, Y + 1, -15, -14, Y + 1, -15, SLAB); set(-15, Y + 2, -15, TORCH, 5);

  // SW: smithy with furnaces, iron and a chest
  building(-20, 10, -10, 20, 4, { floor: COBBLE, wall: COBBLE, corner: MOSSY, roof: SLAB, door: [-15, 10] });
  box(-19, Y + 1, 19, -17, Y + 1, 19, FURNACE, 3); set(-19, Y + 2, 19, FURNACE, 3);
  box(-12, Y + 1, 18, -11, Y + 1, 19, IRON); set(-11, Y + 1, 12, CHEST, 5); set(-19, Y + 1, 12, WORKBENCH);

  // SE: wheat farm with irrigation, by the river side
  box(8, Y, 8, 24, Y, 24, LOG); box(8, Y + 1, 8, 24, Y + 9, 24, AIR);
  for (let x = 9; x <= 23; x++) for (let z = 9; z <= 23; z++) {
    if (x === 16) { set(x, Y, z, WATER); continue; }
    set(x, Y, z, FARMLAND, 7); set(x, Y + 1, z, WHEAT, ((x * 7 + z * 13) % 4) + 4);
  }
  for (const [x, z] of [[8, 8], [24, 8], [8, 24], [24, 24]]) set(x, Y + 1, z, TORCH, 5);

  // watchtower in the far NE corner with a ladder to a lit lookout
  const tx = 21, tz = -26, TH = 18;
  box(tx, Y, tz, tx + 4, Y, tz + 4, STONEBRICK); walls(tx, Y + 1, tz, tx + 4, Y + TH, tz + 4, STONEBRICK);
  box(tx + 1, Y + 1, tz + 1, tx + 3, Y + TH, tz + 3, AIR);
  for (let y = Y + 4; y < Y + TH; y += 4) { set(tx, y, tz + 2, GLASS); set(tx + 4, y, tz + 2, GLASS); set(tx + 2, y, tz + 4, GLASS); }
  box(tx + 2, Y + 1, tz + 4, tx + 2, Y + 2, tz + 4, AIR);
  box(tx - 1, Y + TH, tz - 1, tx + 5, Y + TH, tz + 5, STONEBRICK);
  for (let y = Y + 1; y <= Y + TH; y++) set(tx + 2, y, tz + 1, LADDER, 3);
  for (let x = tx - 1; x <= tx + 5; x++) for (let z = tz - 1; z <= tz + 5; z++) {
    const edge = x === tx - 1 || x === tx + 5 || z === tz - 1 || z === tz + 5; if (edge && (x + z) % 2 === 0) set(x, Y + TH + 1, z, STONEBRICK);
  }
  for (const [x, z] of [[tx - 1, tz - 1], [tx + 5, tz - 1], [tx - 1, tz + 5], [tx + 5, tz + 5]]) set(x, Y + TH + 2, z, GLOW);

  // a few oak trees
  const tree = (x, z) => { box(x, Y + 1, z, x, Y + 4, z, LOG);
    for (let dy = 3; dy <= 6; dy++) { const r = dy >= 5 ? 1 : 2; for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) {
      if ((a || b || dy > 4) && !(Math.abs(a) === r && Math.abs(b) === r && dy !== 4)) set(x + a, Y + dy, z + b, LEAVES); } } };
  for (const [x, z] of [[24, -6], [-24, -6], [-6, 24], [6, -24], [-24, 5], [-6, -24]]) tree(x, z);

  // City grid beyond the original town core: avenues, sidewalks and lit intersections.
  const streets = [-72, -48, -24, 0, 24, 48, 72];
  for (const street of streets) for (let along = -72; along <= 72; along++) {
    if (Math.abs(street) <= 28 && Math.abs(along) <= 28) continue;
    for (let side = -2; side <= 2; side++) {
      const road = side === -2 || side === 2 ? DSLAB : side === 0 ? COBBLE : GRAVEL;
      set(street + side, Y, along, road);
      set(along, Y, street + side, road);
    }
  }
  for (const x of streets) for (const z of streets) {
    if (Math.abs(x) <= 28 && Math.abs(z) <= 28) continue;
    lamp(x + 3, z + 3);
  }

  const urbanStyles = [
    { wall: BRICKS, trim: STONEBRICK, floor: PLANKS, roof: STONEBRICK },
    { wall: STONEBRICK, trim: IRON, floor: COBBLE, roof: STONEBRICK },
    { wall: PLANKS, trim: LOG, floor: PLANKS, roof: BRICKS },
    { wall: COBBLE, trim: MOSSY, floor: COBBLE, roof: DSLAB },
    { wall: BRICKS, trim: LOG, floor: STONEBRICK, roof: BRICKS },
  ];
  const cityBuilding = (x0, z0, x1, z1, floors, style, landmark = false) => {
    const top = Y + floors * 3 + 1, doorX = Math.floor((x0 + x1) / 2);
    box(x0, Y, z0, x1, Y, z1, style.floor);
    walls(x0, Y + 1, z0, x1, top, z1, style.wall);
    for (const [x, z] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) box(x, Y + 1, z, x, top, z, style.trim);
    box(x0 + 1, Y + 1, z0 + 1, x1 - 1, top - 1, z1 - 1, AIR);
    for (let floor = 1; floor < floors; floor++) box(x0 + 1, Y + 1 + floor * 3, z0 + 1, x1 - 1, Y + 1 + floor * 3, z1 - 1, style.floor);
    for (let floor = 0; floor < floors; floor++) {
      const wy = Y + 2 + floor * 3;
      for (let x = x0 + 2; x < x1 - 1; x += 3) { set(x, wy, z0, GLASS); set(x, wy, z1, GLASS); }
      for (let z = z0 + 2; z < z1 - 1; z += 3) { set(x0, wy, z, GLASS); set(x1, wy, z, GLASS); }
    }
    // Flat roof with a low parapet and a lit center.
    box(x0, top + 1, z0, x1, top + 1, z1, style.roof);
    walls(x0, top + 2, z0, x1, top + 2, z1, style.trim);
    set(doorX, top + 2, Math.floor((z0 + z1) / 2), GLOW);
    // South-facing entrance; both halves are functional wooden doors.
    set(doorX, Y + 1, z1, 64, 3); set(doorX, Y + 2, z1, 64, 11);
    set(doorX - 2, Y + 3, z1, TORCH, 5); set(doorX + 2, Y + 3, z1, TORCH, 5);
    if (landmark) {
      for (let y = top + 3; y <= top + 6; y++) { set(doorX, y, z0, GLASS); set(doorX, y, z1, GLASS); }
      set(doorX, top + 7, z0, GLOW);
      set(doorX - 2, top + 3, z1, WOOL, 14); set(doorX - 2, top + 4, z1, WOOL, 14);
      set(doorX + 2, top + 3, z1, WOOL, 14); set(doorX + 2, top + 4, z1, WOOL, 14);
    }
  };
  const cityPark = (x0, z0, x1, z1) => {
    box(x0, Y, z0, x1, Y, z1, GRASS);
    const cx = (x0 + x1) >> 1, cz = (z0 + z1) >> 1;
    box(cx - 1, Y, z0 + 1, cx + 1, Y, z1 - 1, GRAVEL);
    box(x0 + 1, Y, cz - 1, x1 - 1, Y, cz + 1, GRAVEL);
    box(cx - 2, Y + 1, cz - 2, cx + 2, Y + 1, cz + 2, STONEBRICK);
    box(cx - 1, Y + 1, cz - 1, cx + 1, Y + 1, cz + 1, WATER);
    set(cx, Y + 2, cz, GLOW);
    for (const [x, z] of [[x0 + 3, z0 + 3], [x1 - 3, z0 + 3], [x0 + 3, z1 - 3], [x1 - 3, z1 - 3]]) {
      tree(x, z); box(x - 1, Y + 1, z + 2, x + 1, Y + 1, z + 2, PLANKS);
    }
    for (const [x, z] of [[x0 + 1, z0 + 1], [x1 - 1, z0 + 1], [x0 + 1, z1 - 1], [x1 - 1, z1 - 1]]) set(x, Y + 1, z, TORCH, 5);
  };

  // Six-by-six city blocks: a compact downtown around the existing town and quieter outer blocks.
  let cityIndex = 0;
  for (let x0 = -67; x0 <= 53; x0 += 24) for (let z0 = -67; z0 <= 53; z0 += 24) {
    const x1 = x0 + 14, z1 = z0 + 14, cx = (x0 + x1) >> 1, cz = (z0 + z1) >> 1;
    if (Math.abs(cx) < 32 && Math.abs(cz) < 32) continue;
    const roll = rnd();
    if ((cx === -36 && cz === 36) || (roll < 0.12 && !(cx === 36 && cz === -36))) { cityPark(x0, z0, x1, z1); cityIndex++; continue; }
    const landmark = cx === 36 && cz === -36;
    const style = landmark ? urbanStyles[0] : urbanStyles[Math.floor(rnd() * urbanStyles.length)];
    const bx0 = x0 + 1 + (rnd() < 0.5 ? 0 : 1), bz0 = z0 + 1 + (rnd() < 0.5 ? 0 : 1);
    const bx1 = x1 - 1 - (rnd() < 0.5 ? 0 : 1), bz1 = z1 - 1 - (rnd() < 0.5 ? 0 : 1);
    const central = Math.max(Math.abs(cx), Math.abs(cz)) <= 40;
    const floors = landmark ? 7 : central ? 4 + Math.floor(rnd() * 3) : 2 + Math.floor(rnd() * 3);
    cityBuilding(bx0, bz0, bx1, bz1, floors, style, landmark);
    if (cityIndex % 3 === 0) { set(bx0 + 2, Y + 1, bz0 + 2, WORKBENCH); set(bx0 + 3, Y + 1, bz0 + 2, CHEST); }
    cityIndex++;
  }
  set(-3, Y + 1, -70, SIGN, 0, { text: ['Websim City', 'SMP District', 'Welcome!', ''] });

  // bucket by chunk for fast patching
  const chunks = new Map();
  for (const e of map.values()) { const k = (e[0] >> 4) + ',' + (e[2] >> 4); (chunks.get(k) || chunks.set(k, []).get(k)).push(e); }
  return { chunks, spawn: [0.5, Y + 1, 9.5], level: Y };
}

export function patchTown(town, c) {
  const list = town.chunks.get(c.cx + ',' + c.cz); if (!list) return;
  const x0 = c.cx * 16, z0 = c.cz * 16;
  for (const e of list) { const i = idx(e[0] - x0, e[1], e[2] - z0); c.blocks[i] = e[3]; c.meta[i] = e[4]; if (e[5]) c.tiles.set(i, { text: [...e[5].text] }); else c.tiles.delete(i); }
}
