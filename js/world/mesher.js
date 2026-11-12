// Section mesher: hidden-face removal, classic face shading, optional smooth lighting + AO
import { blocks as BL, OPAQUE, SHAPE, SH, LOPAC, doorBox } from './blocks.js';
import { tileIndex, COLS } from '../engine/textures.js';
import { BIOMES } from './gen.js';
import { CH, idx, ckey } from './chunk.js';

const P = 18; // padded size
const pid = (x, y, z) => (x + 1) + (z + 1) * P + (y + 1) * P * P;
const vb = new Uint8Array(P * P * P), vm = new Uint8Array(P * P * P), vs = new Uint8Array(P * P * P), vl = new Uint8Array(P * P * P);
// faces: dir, normal, corners (BL,BR,TR,TL), shade, name
const FACES = [
  { n: [1, 0, 0], c: [[1,0,1],[1,0,0],[1,1,0],[1,1,1]], s: 0.6, f: 'side', dir: 'east' },
  { n: [-1, 0, 0], c: [[0,0,0],[0,0,1],[0,1,1],[0,1,0]], s: 0.6, f: 'side', dir: 'west' },
  { n: [0, 1, 0], c: [[0,1,1],[1,1,1],[1,1,0],[0,1,0]], s: 1.0, f: 'top' },
  { n: [0, -1, 0], c: [[0,0,0],[1,0,0],[1,0,1],[0,0,1]], s: 0.5, f: 'bottom' },
  { n: [0, 0, 1], c: [[0,0,1],[1,0,1],[1,1,1],[0,1,1]], s: 0.8, f: 'side', dir: 'south' },
  { n: [0, 0, -1], c: [[1,0,0],[0,0,0],[0,1,0],[1,1,0]], s: 0.8, f: 'side', dir: 'north' },
];
const FACING = ['south', 'west', 'north', 'east']; // meta 0..3 front direction
const UVS = [[0, 1], [1, 1], [1, 0], [0, 0]]; // atlas v grows downward
const AO = [1, 0.8, 0.66, 0.52];
const texCache = new Map();
function tileUV(name) { let t = texCache.get(name); if (t === undefined) { t = tileIndex(name) ?? 0; texCache.set(name, t); } return t; }

class Buf {
  constructor() { this.pos = []; this.uv = []; this.col = []; this.lit = []; this.ind = []; this.n = 0; }
  quad(v, uvs, cols, lits, tile, flip, rows) {
    const tu = (tile % COLS) / COLS, tv = Math.floor(tile / COLS) / rows, su = 1 / COLS, sv = 1 / rows, e = 0.0004;
    for (let i = 0; i < 4; i++) { this.pos.push(v[i][0], v[i][1], v[i][2]); const u = uvs[i]; this.uv.push(tu + e + u[0] * (su - 2 * e), tv + e + u[1] * (sv - 2 * e)); this.col.push(cols[i][0], cols[i][1], cols[i][2]); this.lit.push(lits[i][0], lits[i][1]); }
    const b = this.n; if (flip) this.ind.push(b + 1, b + 2, b + 3, b + 1, b + 3, b); else this.ind.push(b, b + 1, b + 2, b, b + 2, b + 3); this.n += 4;
  }
  out() { if (!this.n) return null; return { pos: new Float32Array(this.pos), uv: new Float32Array(this.uv), col: new Uint8Array(this.col), lit: new Uint8Array(this.lit), ind: this.n * 1.5 > 65535 ? new Uint32Array(this.ind) : new Uint16Array(this.ind) }; }
}

// generic box: lo/hi in local block space (UVs follow local coords), xf maps local -> world, both = emit back faces too
function emitBox(buf, lo, hi, tile, xf, L, rows, both, skip) {
  for (let f = 0; f < 6; f++) {
    if (skip && skip[f]) continue;
    const F = FACES[f]; const c0 = F.c[0], c1 = F.c[1], c2 = F.c[2];
    const ua = c0[0] !== c1[0] ? 0 : c0[1] !== c1[1] ? 1 : 2, va = c1[0] !== c2[0] ? 0 : c1[1] !== c2[1] ? 1 : 2;
    const verts = [], uvs = [], cols = [], lits = []; const s = F.s * 255;
    for (let k = 0; k < 4; k++) {
      const c = F.c[k]; const P = [lo[0] + c[0] * (hi[0] - lo[0]), lo[1] + c[1] * (hi[1] - lo[1]), lo[2] + c[2] * (hi[2] - lo[2])];
      verts.push(xf(P[0], P[1], P[2]));
      uvs.push([c0[ua] ? 1 - P[ua] : P[ua], c1[va] ? P[va] : 1 - P[va]]);
      cols.push([s, s, s]); lits.push(L);
    }
    buf.quad(verts, uvs, cols, lits, tile, false, rows);
    if (both) buf.quad([verts[1], verts[0], verts[3], verts[2]], [uvs[1], uvs[0], uvs[3], uvs[2]], cols, lits, tile, false, rows);
  }
}

// 1.7 bed: mattress top at 9/16, plank underside at 3/16, cut-out side/end art with legs; the inner end between halves is skipped
const BED_DIRS = [[0, -1], [-1, 0], [0, 1], [1, 0]];
function bedMesh(buf, x, y, z, wy, meta, p, rows) {
  const head = meta & 8, [dx, dz] = BED_DIRS[meta & 3], sx = -dz, sz = dx; // forward = towards the head
  const W = (fx, py, sv) => { const qx = fx - 0.5, qz = sv - 0.5; return [x + 0.5 + qx * dx + qz * sx, wy + py, z + 0.5 + qx * dz + qz * sz]; };
  const L = [vs[p] * 17, vl[p] * 17]; const L4 = [L, L, L, L];
  const nb = (ox, oz) => vb[pid(x + ox, y, z + oz)];
  const quad = (pts, uvs, shade, tname, ox, oz) => { if (ox !== undefined && OPAQUE[nb(ox, oz)]) return; const c = [255 * shade, 255 * shade, 255 * shade];
    buf.quad(pts.map(q => W(...q)), uvs, [c, c, c, c], L4, tileUV(tname), false, rows); };
  const pre = head ? 'bed_head_' : 'bed_feet_', T = 9 / 16, B = 3 / 16;
  const sideShade = Math.abs(sx) ? 0.6 : 0.8, fwdShade = Math.abs(dx) ? 0.6 : 0.8;
  // top (u along the bed towards the head, v across)
  quad([[0, T, 1], [1, T, 1], [1, T, 0], [0, T, 0]], [[0, 1], [1, 1], [1, 0], [0, 0]], 1, pre + 'top');
  // underside
  quad([[0, B, 0], [1, B, 0], [1, B, 1], [0, B, 1]], [[0, 0], [1, 0], [1, 1], [0, 1]], 0.5, 'planks');
  // long sides (+side and -side); u follows forward so the head art stays at the head end on both
  quad([[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], [[0, 1], [1, 1], [1, 0], [0, 0]], sideShade, pre + 'side', sx, sz);
  quad([[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], [[1, 1], [0, 1], [0, 0], [1, 0]], sideShade, pre + 'side', -sx, -sz);
  // outer end only
  if (head) quad([[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], [[0, 1], [1, 1], [1, 0], [0, 0]], fwdShade, pre + 'end', dx, dz);
  else quad([[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], [[0, 1], [1, 1], [1, 0], [0, 0]], fwdShade, pre + 'end', -dx, -dz);
}

// pistons: boxes modelled facing +Y (local), rotated to the facing (meta & 7: 0 down,1 up,2 north,3 south,4 west,5 east)
const ROT6 = [(a, b, c) => [a, -b, -c], (a, b, c) => [a, b, c], (a, b, c) => [a, c, -b], (a, b, c) => [a, -c, b], (a, b, c) => [-b, a, c], (a, b, c) => [b, -a, c]];
function orientedBox(buf, lo, hi, tiles, rot, X, Y, Z, L, rows) {
  for (let f = 0; f < 6; f++) {
    const F = FACES[f]; const tile = tiles[f === 2 ? 0 : f === 3 ? 1 : 2]; if (tile === null) continue; const c0 = F.c[0], c1 = F.c[1], c2 = F.c[2];
    const ua = c0[0] !== c1[0] ? 0 : c0[1] !== c1[1] ? 1 : 2, va = c1[0] !== c2[0] ? 0 : c1[1] !== c2[1] ? 1 : 2;
    const wn = rot(F.n[0], F.n[1], F.n[2]); const s = (wn[1] > 0.5 ? 1 : wn[1] < -0.5 ? 0.5 : Math.abs(wn[0]) > 0.5 ? 0.6 : 0.8) * 255;
    const verts = [], uvs = [], cols = [], lits = [];
    for (let k = 0; k < 4; k++) {
      const c = F.c[k]; const P = [lo[0] + c[0] * (hi[0] - lo[0]), lo[1] + c[1] * (hi[1] - lo[1]), lo[2] + c[2] * (hi[2] - lo[2])];
      const q = rot(P[0] - 0.5, P[1] - 0.5, P[2] - 0.5); verts.push([X + 0.5 + q[0], Y + 0.5 + q[1], Z + 0.5 + q[2]]);
      uvs.push([c0[ua] ? 1 - P[ua] : P[ua], c1[va] ? P[va] : 1 - P[va]]); cols.push([s, s, s]); lits.push(L);
    }
    buf.quad(verts, uvs, cols, lits, tile, false, rows);
  }
}
function pistonMesh(buf, x, y, z, wy, id, meta, p, rows) {
  let sk = vs[p], bl = vl[p]; for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) { const q = pid(x + dx, y + dy, z + dz); if (!OPAQUE[vb[q]]) { sk = Math.max(sk, vs[q]); bl = Math.max(bl, vl[q]); } }
  const L = [sk * 17, bl * 17]; const rot = ROT6[meta & 7] || ROT6[1]; const side = tileUV('piston_side');
  if (id === 34) { // head: plate + arm
    const face = tileUV(meta & 8 ? 'piston_top_sticky' : 'piston_top');
    orientedBox(buf, [0, 0.75, 0], [1, 1, 1], [face, tileUV('piston_top'), side], rot, x, wy, z, L, rows);
    orientedBox(buf, [0.375, -0.25, 0.375], [0.625, 0.75, 0.625], [null, null, tileUV('piston_arm')], rot, x, wy, z, L, rows);
  } else if (meta & 8) orientedBox(buf, [0, 0, 0], [1, 0.75, 1], [tileUV('piston_inner'), tileUV('piston_bottom'), side], rot, x, wy, z, L, rows);
  else orientedBox(buf, [0, 0, 0], [1, 1, 1], [tileUV(id === 29 ? 'piston_top_sticky' : 'piston_top'), tileUV('piston_bottom'), side], rot, x, wy, z, L, rows);
}

// ---- redstone & fences ----
const HD = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // N E S W
const RS_LINK = new Set([55, 75, 76, 69, 77, 143, 70, 72, 152]);
export function wireColor(pw) { const f = pw / 15, r = pw ? f * 0.6 + 0.4 : 0.3; return [r * 255, Math.max(0, f * f * 0.7 - 0.5) * 255, Math.max(0, f * f * 0.6 - 0.7) * 255]; }
function rsLinks(nid, nm, d) { if (RS_LINK.has(nid)) return true; if (nid === 93 || nid === 94) return ((nm & 3) & 1) === (d & 1); return false; }
function wireMesh(buf, x, y, z, wy, meta, p, rows) {
  const L = [vs[p] * 17, vl[p] * 17], L4 = [L, L, L, L]; const col = wireColor(meta & 15), C4 = [col, col, col, col];
  const upOpen = !OPAQUE[vb[pid(x, y + 1, z)]]; const con = [0, 0, 0, 0], up = [0, 0, 0, 0];
  for (let d = 0; d < 4; d++) { const [dx, dz] = HD[d]; const q = pid(x + dx, y, z + dz), n = vb[q];
    if (rsLinks(n, vm[q], d)) con[d] = 1;
    else if (upOpen && vb[pid(x + dx, y + 1, z + dz)] === 55 && OPAQUE[n]) { con[d] = 1; up[d] = 1; }
    else if (!OPAQUE[n] && vb[pid(x + dx, y - 1, z + dz)] === 55) con[d] = 1; }
  const Y = wy + 1 / 64; const cross = tileUV('redstone_dust_cross'), line = tileUV('redstone_dust_line');
  const flat = (x0, z0, x1, z1, tile, rot) => { const uv = (a, b) => rot ? [b, a] : [a, b];
    buf.quad([[x + x0, Y, z + z1], [x + x1, Y, z + z1], [x + x1, Y, z + z0], [x + x0, Y, z + z0]], [uv(x0, z1), uv(x1, z1), uv(x1, z0), uv(x0, z0)], C4, L4, tile, false, rows); };
  const ns = con[0] || con[2], ew = con[1] || con[3];
  if (ns && !ew) flat(0, 0, 1, 1, line, true);
  else if (ew && !ns) flat(0, 0, 1, 1, line, false);
  else if (!ns && !ew) flat(0, 0, 1, 1, cross, false);
  else { const a = 5 / 16, b = 11 / 16; flat(con[3] ? 0 : a, con[0] ? 0 : a, con[1] ? 1 : b, con[2] ? 1 : b, cross, false); }
  const e = 1 / 64; // climbing up the side of a block
  for (let d = 0; d < 4; d++) if (up[d]) { const [dx, dz] = HD[d]; let q;
    if (dx) { const X = x + (dx > 0 ? 1 - e : e); q = [[X, wy, z + 1], [X, wy, z], [X, wy + 1, z], [X, wy + 1, z + 1]]; }
    else { const Z = z + (dz > 0 ? 1 - e : e); q = [[x, wy, Z], [x + 1, wy, Z], [x + 1, wy + 1, Z], [x, wy + 1, Z]]; }
    const uvs = [[1, 0], [1, 1], [0, 1], [0, 0]]; buf.quad(q, uvs, C4, L4, line, false, rows); buf.quad([q[1], q[0], q[3], q[2]], [uvs[1], uvs[0], uvs[3], uvs[2]], C4, L4, line, false, rows); }
}
// rails: meta 0 N-S, 1 E-W, 2-5 ascending E/W/N/S, 6-9 curves SE/SW/NW/NE (only plain rails curve)
function railMesh(buf, x, y, z, wy, b, meta, p, rows) {
  const L = [vs[p] * 17, vl[p] * 17], L4 = [L, L, L, L]; const c = [255, 255, 255], C4 = [c, c, c, c];
  const sh = b.id === 66 ? meta : meta & 7; const tile = tileUV(b.tex('top', meta));
  const uvf = sh === 1 || sh === 2 || sh === 3 ? (u, v) => [v, 1 - u] : sh === 7 ? (u, v) => [1 - u, v] : sh === 8 ? (u, v) => [1 - u, 1 - v] : sh === 9 ? (u, v) => [u, 1 - v] : (u, v) => [u, v];
  const hy = (u, v) => wy + 1 / 64 + (sh === 2 ? u : sh === 3 ? 1 - u : sh === 4 ? 1 - v : sh === 5 ? v : 0);
  const C = [[0, 1], [1, 1], [1, 0], [0, 0]]; const pts = C.map(([u, v]) => [x + u, hy(u, v), z + v]), uvs = C.map(([u, v]) => uvf(u, v));
  buf.quad(pts, uvs, C4, L4, tile, false, rows);
  if (sh >= 2 && sh <= 5) buf.quad([pts[1], pts[0], pts[3], pts[2]], [uvs[1], uvs[0], uvs[3], uvs[2]], C4, L4, tile, false, rows);
}
// small upright column with explicit torch-like UVs (used for repeater torches)
function torchColumn(buf, xf, cx, cz, y0, y1, tile, L, rows) {
  const w = 1 / 16; const c = [255, 255, 255], C4 = [c, c, c, c], L4 = [L, L, L, L]; const vTop = 6 / 16, vBot = vTop + (y1 - y0);
  const sides = [[[-w, -w], [w, -w]], [[w, -w], [w, w]], [[w, w], [-w, w]], [[-w, w], [-w, -w]]]; const uvs = [[7 / 16, vBot], [9 / 16, vBot], [9 / 16, vTop], [7 / 16, vTop]];
  for (const [s0, s1] of sides) buf.quad([xf(cx + s1[0], y0, cz + s1[1]), xf(cx + s0[0], y0, cz + s0[1]), xf(cx + s0[0], y1, cz + s0[1]), xf(cx + s1[0], y1, cz + s1[1])], uvs, C4, L4, tile, false, rows);
  buf.quad([xf(cx - w, y1, cz + w), xf(cx + w, y1, cz + w), xf(cx + w, y1, cz - w), xf(cx - w, y1, cz - w)], [[7 / 16, 8 / 16], [9 / 16, 8 / 16], [9 / 16, 6 / 16], [7 / 16, 6 / 16]], C4, L4, tile, false, rows);
}
const ROT4 = [(a, c, d) => [a, c, d], (a, c, d) => [1 - d, c, a], (a, c, d) => [1 - a, c, 1 - d], (a, c, d) => [d, c, 1 - a]];
function repeaterMesh(buf, x, y, z, wy, id, meta, p, rows) {
  const L = [vs[p] * 17, vl[p] * 17]; const r = ROT4[meta & 3]; const xf = (a, c, d) => { const q = r(a, c, d); return [x + q[0], wy + q[1], z + q[2]]; };
  const top = tileUV(id === 94 ? 'repeater_on' : 'repeater_off'), side = tileUV('slab_top');
  emitBox(buf, [0, 0, 0], [1, 2 / 16, 1], side, xf, L, rows, false, { 2: 1 });
  emitBox(buf, [0, 2 / 16 - 0.001, 0], [1, 2 / 16, 1], top, xf, L, rows, false, { 0: 1, 1: 1, 3: 1, 4: 1, 5: 1 });
  const torch = tileUV(id === 94 ? 'redstone_torch_on' : 'redstone_torch_off'), delay = (meta >> 2) & 3;
  torchColumn(buf, xf, 0.5, 4 / 16, 2 / 16, 7 / 16, torch, L, rows);
  torchColumn(buf, xf, 0.5, (8 + 2 * delay) / 16, 2 / 16, 7 / 16, torch, L, rows);
}
function buttonMesh(buf, x, y, z, wy, id, meta, p, rows, tile) {
  const L = [vs[p] * 17, vl[p] * 17]; const m = meta & 7, d = meta & 8 ? 1 / 16 : 2 / 16;
  const T = m === 1 ? (a, c, e) => [c, e, a] : m === 2 ? (a, c, e) => [1 - c, e, a] : m === 3 ? (a, c, e) => [a, e, c] : m === 4 ? (a, c, e) => [a, e, 1 - c] : (a, c, e) => [a, c, e];
  const W = (a, c, e) => { const q = T(a, c, e); return [x + q[0], wy + q[1], z + q[2]]; };
  emitBox(buf, [5 / 16, 0, 6 / 16], [11 / 16, d, 10 / 16], tile, W, L, rows, true);
}
function fenceLinksPad(x, y, z) {
  const id = vb[pid(x, y, z)], nether = id === 113;
  const j = (nx, nz, axis) => { const q = pid(nx, y, nz), n = vb[q]; if (n === 85 || n === 113) return nether === (n === 113); if (n === 107) return ((vm[q] & 1) === 0) === (axis === 0); return !!OPAQUE[n]; };
  return [j(x - 1, z, 0), j(x + 1, z, 0), j(x, z - 1, 1), j(x, z + 1, 1)];
}
function fenceMesh(buf, x, y, z, wy, p, rows, tile) {
  const L = [vs[p] * 17, vl[p] * 17]; const xf = (a, c, d) => [x + a, wy + c, z + d];
  emitBox(buf, [6 / 16, 0, 6 / 16], [10 / 16, 1, 10 / 16], tile, xf, L, rows, false);
  const [w, e, n, s] = fenceLinksPad(x, y, z); const a = 7 / 16, b = 9 / 16;
  for (const [y0, y1] of [[12 / 16, 15 / 16], [6 / 16, 9 / 16]]) {
    if (w) emitBox(buf, [0, y0, a], [6 / 16, y1, b], tile, xf, L, rows, false); if (e) emitBox(buf, [10 / 16, y0, a], [1, y1, b], tile, xf, L, rows, false);
    if (n) emitBox(buf, [a, y0, 0], [b, y1, 6 / 16], tile, xf, L, rows, false); if (s) emitBox(buf, [a, y0, 10 / 16], [b, y1, 1], tile, xf, L, rows, false); }
}
function gateMesh(buf, x, y, z, wy, meta, p, rows, tile) {
  const L = [vs[p] * 17, vl[p] * 17]; const along = meta & 1; // 0: spans x
  const xf = along ? (a, c, d) => [x + 1 - d, wy + c, z + a] : (a, c, d) => [x + a, wy + c, z + d];
  const a = 7 / 16, b = 9 / 16, open = meta & 4, sgn = (meta & 2) ? 1 : -1;
  emitBox(buf, [0, 5 / 16, a], [2 / 16, 1, b], tile, xf, L, rows, false); emitBox(buf, [14 / 16, 5 / 16, a], [1, 1, b], tile, xf, L, rows, false);
  if (!open) { for (const [y0, y1] of [[6 / 16, 9 / 16], [12 / 16, 15 / 16]]) { emitBox(buf, [2 / 16, y0, a], [6 / 16, y1, b], tile, xf, L, rows, false); emitBox(buf, [10 / 16, y0, a], [14 / 16, y1, b], tile, xf, L, rows, false); }
    emitBox(buf, [6 / 16, 6 / 16, a], [8 / 16, 15 / 16, b], tile, xf, L, rows, false); emitBox(buf, [8 / 16, 6 / 16, a], [10 / 16, 15 / 16, b], tile, xf, L, rows, false); }
  else { const z0 = sgn > 0 ? b : a - 6 / 16, z1 = sgn > 0 ? b + 6 / 16 : a;
    for (const xa of [0, 14 / 16]) { const x0 = xa, x1 = xa + 2 / 16;
      for (const [y0, y1] of [[6 / 16, 9 / 16], [12 / 16, 15 / 16]]) emitBox(buf, [x0, y0, z0], [x1, y1, z1], tile, xf, L, rows, false);
      emitBox(buf, [x0, 6 / 16, sgn > 0 ? z1 - 2 / 16 : z0], [x1, 15 / 16, sgn > 0 ? z1 : z0 + 2 / 16], tile, xf, L, rows, false); } }
}

function fillPadded(world, c, sy) {
  const y0 = sy * 16;
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
    const n = dx || dz ? world.chunks.get(ckey(c.cx + dx, c.cz + dz)) : c;
    const xa = dx < 0 ? 15 : 0, xb = dx > 0 ? 0 : 15, za = dz < 0 ? 15 : 0, zb = dz > 0 ? 0 : 15;
    for (let y = -1; y <= 16; y++) { const wy = y0 + y;
      for (let z = za; z <= zb; z++) for (let x = xa; x <= xb; x++) {
        const p = pid(x + dx * 16, y, z + dz * 16);
        if (!n || wy < 0 || wy >= CH) { vb[p] = wy < 0 ? 7 : 0; vm[p] = 0; vs[p] = wy >= CH ? 15 : (n ? 0 : 15); vl[p] = 0; continue; }
        const i = idx(x, wy, z); vb[p] = n.blocks[i]; vm[p] = n.meta[i]; vs[p] = n.sky[i]; vl[p] = n.blk[i];
      } }
  }
}

function tintFor(b, meta, face, biome) {
  if (!b.tint) return null;
  const bio = BIOMES[biome] || BIOMES[1];
  if (b.tint === 'grassTop') return face === 'top' ? bio.grass : null;
  if (b.tint === 'grass') return meta === 0 ? null : bio.grass;
  if (b.tint === 'foliage') { if (b.id === 18) { const t = meta & 3; if (t === 1) return [97, 153, 97]; if (t === 2) return [128, 167, 85]; } return bio.foliage; }
  return null;
}

export function buildSection(world, c, sy, opt) {
  fillPadded(world, c, sy);
  const solid = new Buf(), water = new Buf(), glass = new Buf(); const rows = opt.rows; const smooth = opt.smooth, fancy = opt.fancy;
  const y0 = sy * 16;
  const lightAt = (p) => [vs[p], vl[p]];
  for (let y = 0; y < 16; y++) for (let z = 0; z < 16; z++) for (let x = 0; x < 16; x++) {
    const p = pid(x, y, z); const id = vb[p]; if (!id) continue;
    const b = BL[id]; if (!b) continue; const shape = SHAPE[id]; const meta = vm[p];
    const biome = c.biomes[x | z << 4]; const wy = y0 + y;
    if (shape === SH.piston) { pistonMesh(solid, x, y, z, wy, id, meta, p, rows); continue; }
    if (shape === SH.rail) { railMesh(solid, x, y, z, wy, b, meta, p, rows); continue; }
    if (shape === SH.wire) { wireMesh(solid, x, y, z, wy, meta, p, rows); continue; }
    if (shape === SH.repeater) { repeaterMesh(solid, x, y, z, wy, id, meta, p, rows); continue; }
    if (shape === SH.button) { buttonMesh(solid, x, y, z, wy, id, meta, p, rows, tileUV(b.tex('side', meta))); continue; }
    if (shape === SH.plate) { const L = [vs[p] * 17, vl[p] * 17]; emitBox(solid, [1 / 16, 0, 1 / 16], [15 / 16, meta & 1 ? 0.5 / 16 : 1 / 16, 15 / 16], tileUV(b.tex('side', meta)), (a, c, d) => [x + a, wy + c, z + d], L, rows, false, { 3: 1 }); continue; }
    if (shape === SH.fence) { fenceMesh(solid, x, y, z, wy, p, rows, tileUV(b.tex('side', meta))); continue; }
    if (shape === SH.gate) { gateMesh(solid, x, y, z, wy, meta, p, rows, tileUV(b.tex('side', meta))); continue; }
    if (id === 26) { bedMesh(solid, x, y, z, wy, meta, p, rows); continue; }
    if (shape === SH.cube || shape === SH.slab || shape === SH.layer || shape === SH.cactus) {
      const h = shape === SH.slab ? 0.5 : shape === SH.layer ? (b.height || 0.125) : 1;
      for (let f = 0; f < 6; f++) {
        const F = FACES[f]; const np = pid(x + F.n[0], y + F.n[1], z + F.n[2]); const nid = vb[np];
        if (shape === SH.cube) { if (OPAQUE[nid]) continue; if (nid === id && (b.cull !== false || !fancy) ) continue; if ((id === 18 || id === 161) && nid === id && !fancy) continue; }
        else if (shape === SH.cactus) { if ((f === 2 || f === 3) && (nid === id || OPAQUE[nid])) continue; }
        else { if (f === 3 && OPAQUE[nid]) continue; if (f !== 2 && f !== 3 && OPAQUE[nid]) continue; if (f === 2 && h === 1 && OPAQUE[nid]) continue; }
        let face = F.f; if (b.facing && F.dir) face = FACING[meta & 3] === F.dir ? 'front' : 'side';
        let tname = b.tex(face, meta); if (id === 18 && !fancy) tname = (meta & 3) === 1 ? 'spruce_leaves' : 'leaves_opaque';
        if (id === 2 && face === 'side' && vb[pid(x, y + 1, z)] === 78) tname = 'grass_side_snow';
        const tile = tileUV(tname); const out = id === 20 || id === 95 ? glass : solid; const tint = id === 2 && tname === 'grass_side_snow' ? null : tintFor(b, meta, F.f, biome);
        const verts = [], uvs = [], cols = [], lits = []; const aos = [];
        for (let k = 0; k < 4; k++) {
          const cc = F.c[k]; let vx = cc[0], vy = cc[1] * h, vz = cc[2];
          if (shape === SH.cactus && F.n[1] === 0) { if (F.n[0]) vx = F.n[0] > 0 ? 15 / 16 : 1 / 16; else vz = F.n[2] > 0 ? 15 / 16 : 1 / 16; }
          verts.push([x + vx, wy + vy, z + vz]);
          const u = UVS[k]; uvs.push(F.n[1] === 0 && h < 1 ? [u[0], u[1] === 0 ? 1 - h : 1] : u);
          let sky, bl, ao = 0;
          if (smooth && shape === SH.cube) {
            const ax = F.n[0] ? null : (cc[0] ? 1 : -1), ay = F.n[1] ? null : (cc[1] ? 1 : -1), az = F.n[2] ? null : (cc[2] ? 1 : -1);
            const bx = x + F.n[0], by = y + F.n[1], bz = z + F.n[2];
            let s1, s2;
            if (F.n[0]) { s1 = pid(bx, by + ay, bz); s2 = pid(bx, by, bz + az); } else if (F.n[1]) { s1 = pid(bx + ax, by, bz); s2 = pid(bx, by, bz + az); } else { s1 = pid(bx + ax, by, bz); s2 = pid(bx, by + ay, bz); }
            const cn = pid(bx + (ax || 0), by + (ay || 0), bz + (az || 0));
            const o1 = OPAQUE[vb[s1]], o2 = OPAQUE[vb[s2]], oc = OPAQUE[vb[cn]];
            ao = (o1 && o2) ? 3 : o1 + o2 + oc;
            let ss = vs[np], sb = vl[np], nn = 1;
            if (!o1) { ss += vs[s1]; sb += vl[s1]; nn++; } if (!o2) { ss += vs[s2]; sb += vl[s2]; nn++; } if (!oc && !(o1 && o2)) { ss += vs[cn]; sb += vl[cn]; nn++; }
            sky = ss / nn; bl = sb / nn;
          } else { const lp = (shape === SH.cube) ? np : (f === 2 || OPAQUE[nid] ? p : np); sky = vs[lp]; bl = vl[lp]; if (shape !== SH.cube) { sky = Math.max(sky, vs[p]); bl = Math.max(bl, vl[p]); } }
          aos.push(ao);
          const sh = F.s * AO[ao];
          cols.push(tint ? [tint[0] * sh, tint[1] * sh, tint[2] * sh] : [255 * sh, 255 * sh, 255 * sh]);
          lits.push([sky * 17, bl * 17]);
        }
        out.quad(verts, uvs, cols, lits, tile, aos[0] + aos[2] > aos[1] + aos[3], rows);
      }
    } else if (shape === SH.cross || shape === SH.torch) {
      const tint = tintFor(b, meta, 'side', biome); const col = tint || [255, 255, 255];
      const L = [vs[p], vl[p]].map(v => v * 17); const tile = tileUV(b.tex('side', meta));
      const C4 = [col, col, col, col], L4 = [L, L, L, L];
      if (id === 51) { // classic fire: two crossed tilted pairs plus four edge planes leaning inward, 1.4 tall
        const t0 = tileUV('fire'), t1 = tileUV('fire_1'), H = wy + 1.4, X = x, Z = z;
        const pl = (q, tl) => { solid.quad(q, UVS, C4, L4, tl, false, rows); solid.quad([q[1], q[0], q[3], q[2]], UVS, C4, L4, tl, false, rows); };
        const ax = (b0, b1, tl) => { pl([[X + b0, wy, Z + 1], [X + b0, wy, Z], [X + b1, H, Z], [X + b1, H, Z + 1]], tl); pl([[X, wy, Z + b0], [X + 1, wy, Z + b0], [X + 1, H, Z + b1], [X, H, Z + b1]], tl); };
        ax(0.7, 0.2, t0); ax(0.3, 0.8, t0); ax(0, 0.1, t1); ax(1, 0.9, t1);
      } else if (shape === SH.cross) {
        let jx = 0, jz = 0; if (id === 31 || id === 37 || id === 38) { const hsh = ((x + c.cx * 16) * 3129871 ^ (z + c.cz * 16) * 116129781) >>> 0; jx = ((hsh & 15) / 15 - 0.5) * 0.3; jz = (((hsh >> 4) & 15) / 15 - 0.5) * 0.3; }
        const a = id === 51 ? 0 : 0.15, bb = id === 51 ? 1 : 0.85; const X = x + jx, Z = z + jz;
        const q1 = [[X + a, wy, Z + a], [X + bb, wy, Z + bb], [X + bb, wy + 1, Z + bb], [X + a, wy + 1, Z + a]];
        const q2 = [[X + a, wy, Z + bb], [X + bb, wy, Z + a], [X + bb, wy + 1, Z + a], [X + a, wy + 1, Z + bb]];
        for (const q of [q1, q2]) { solid.quad(q, UVS, C4, L4, tile, false, rows); solid.quad([q[1], q[0], q[3], q[2]], UVS, C4, L4, tile, false, rows); }
      } else {
        // torch: 2px column, offset toward the wall it is attached to
        let ox = 0, oz = 0, lean = 0; const m = meta; const off = 0.3;
        if (m === 1) ox = -off; else if (m === 2) ox = off; else if (m === 3) oz = -off; else if (m === 4) oz = off;
        const yb = m >= 1 && m <= 4 ? wy + 0.2 : wy; const cx = x + 0.5, cz = z + 0.5;
        const w = 1 / 16, ht = 10 / 16; const top = yb + ht;
        const bx = cx + ox, bz = cz + oz, tx = cx + ox * 0.45, tz = cz + oz * 0.45;
        const sides = [[[-w, -w], [w, -w]], [[w, -w], [w, w]], [[w, w], [-w, w]], [[-w, w], [-w, -w]]];
        const uvsT = [[7 / 16, 1], [9 / 16, 1], [9 / 16, 6 / 16], [7 / 16, 6 / 16]];
        for (const [s0, s1] of sides) solid.quad([[bx + s1[0], yb, bz + s1[1]], [bx + s0[0], yb, bz + s0[1]], [tx + s0[0], top, tz + s0[1]], [tx + s1[0], top, tz + s1[1]]], uvsT, C4, L4, tile, false, rows);
        solid.quad([[tx - w, top, tz + w], [tx + w, top, tz + w], [tx + w, top, tz - w], [tx - w, top, tz - w]], [[7/16, 8/16], [9/16, 8/16], [9/16, 6/16], [7/16, 6/16]], C4, L4, tile, false, rows);
      }
    } else if (shape === SH.wall || shape === SH.vine) {
      const tint = tintFor(b, meta, 'side', biome); const col = tint ? tint.map(v => v * 0.8) : [204, 204, 204];
      const L = [vs[p], vl[p]].map(v => v * 17); const tile = tileUV(b.tex('side', meta)); const C4 = [col, col, col, col], L4 = [L, L, L, L];
      const e = 0.05; const planes = [];
      if (shape === SH.wall) planes.push(meta === 2 ? 1 : meta === 3 ? 4 : meta === 4 ? 8 : 2);
      else { for (const bit of [1, 2, 4, 8]) if (meta & bit) planes.push(bit); if (!meta) planes.push(16); }
      for (const pl of planes) {
        let q;
        if (pl === 1) q = [[x, wy, z + 1 - e], [x + 1, wy, z + 1 - e], [x + 1, wy + 1, z + 1 - e], [x, wy + 1, z + 1 - e]];
        else if (pl === 4) q = [[x + 1, wy, z + e], [x, wy, z + e], [x, wy + 1, z + e], [x + 1, wy + 1, z + e]];
        else if (pl === 2) q = [[x + e, wy, z], [x + e, wy, z + 1], [x + e, wy + 1, z + 1], [x + e, wy + 1, z]];
        else if (pl === 8) q = [[x + 1 - e, wy, z + 1], [x + 1 - e, wy, z], [x + 1 - e, wy + 1, z], [x + 1 - e, wy + 1, z + 1]];
        else q = [[x, wy + 1 - e, z + 1], [x + 1, wy + 1 - e, z + 1], [x + 1, wy + 1 - e, z], [x, wy + 1 - e, z]];
        solid.quad(q, UVS, C4, L4, tile, false, rows); solid.quad([q[1], q[0], q[3], q[2]], UVS, C4, L4, tile, false, rows);
      }
    } else if (shape === SH.door) {
      const L = [vs[p] * 17, vl[p] * 17]; const bx = doorBox(meta); const tile = tileUV(b.tex('side', meta));
      emitBox(solid, [bx[0], 0, bx[2]], [bx[3], 1, bx[5]], tile, (a, c, d) => [x + a, wy + c, z + d], L, rows, false, meta & 8 ? { 3: 1 } : { 2: 1 });
    } else if (shape === SH.portal) {
      const L = [vs[p] * 17, Math.max(vl[p], 11) * 17]; const tile = tileUV('portal'); const ax = meta & 1;
      const e = 6 / 16, f = 10 / 16; const lo = ax ? [e, 0, 0] : [0, 0, e], hi = ax ? [f, 1, 1] : [1, 1, f];
      const skip = {}; const nb = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
      for (let k = 0; k < 6; k++) { const n = nb[k]; const q = vb[pid(x + n[0], y + n[1], z + n[2])]; if ((q === id && vm[pid(x + n[0], y + n[1], z + n[2])] === meta) || (OPAQUE[q] && (ax ? n[0] === 0 : n[2] === 0))) skip[k] = 1; }
      emitBox(water, lo, hi, tile, (a, c, d) => [x + a, wy + c, z + d], L, rows, false, skip);
    } else if (shape === SH.lever) {
      const L = [vs[p] * 17, vl[p] * 17]; const m = meta & 7, on = meta & 8;
      const T = m === 1 ? (a, c, d) => [c, d, a] : m === 2 ? (a, c, d) => [1 - c, d, a] : m === 3 ? (a, c, d) => [a, d, c] : m === 4 ? (a, c, d) => [a, d, 1 - c] : (a, c, d) => [a, c, d];
      const W = (a, c, d) => { const q = T(a, c, d); return [x + q[0], wy + q[1], z + q[2]]; };
      emitBox(solid, [5 / 16, 0, 4 / 16], [11 / 16, 3 / 16, 12 / 16], tileUV('cobblestone'), W, L, rows, true);
      const ang = on ? -0.7 : 0.7, cs = Math.cos(ang), sn = Math.sin(ang), py = 1 / 16, pz = 0.5;
      const R = (a, c, d) => { const dy = c - py, dz = d - pz; return W(a, py + dy * cs - dz * sn, pz + dy * sn + dz * cs); };
      emitBox(solid, [7 / 16, 0, 7 / 16], [9 / 16, 10 / 16, 9 / 16], tileUV('lever'), R, L, rows, true);
    } else if (shape === SH.liquid) {
      const isW = id === 8 || id === 9; const buf = isW ? water : solid; const tile = tileUV(b.tex('side', meta));
      const same = (n) => isW ? (n === 8 || n === 9) : (n === 10 || n === 11);
      const above = vb[pid(x, y + 1, z)];
      const lh = (pp) => { const n = vb[pp]; if (!same(n)) return -1; if (same(vb[pp + P * P])) return 1; const m = vm[pp]; return m >= 8 ? 0.9 : (8 - m) / 9; };
      const myH = same(above) ? 1 : lh(p);
      // corner heights: average with neighbours for slopes
      const corner = (cx, cz) => { if (same(above)) return 1; let s = 0, n = 0; for (const [dx, dz] of [[cx - 1, cz - 1], [cx, cz - 1], [cx - 1, cz], [cx, cz]]) { const pp = pid(x + dx, y, z + dz); if (same(vb[pp + P * P])) return 1; const hh = lh(pp); if (hh >= 0) { s += hh; n++; } else if (!SOLIDLIKE(vb[pp])) { n++; } } return n ? s / n : myH; };
      const hc = { '00': corner(0, 0), '10': corner(1, 0), '01': corner(0, 1), '11': corner(1, 1) };
      const L = [vs[p], vl[p]];
      for (let f = 0; f < 6; f++) {
        const F = FACES[f]; const np = pid(x + F.n[0], y + F.n[1], z + F.n[2]); const nid = vb[np];
        if (same(nid)) continue; if (OPAQUE[nid] && f !== 2) continue; if (f === 2 && myH >= 1 && OPAQUE[nid]) continue;
        const verts = [], cols = [], lits = [], uvs = [];
        for (let k = 0; k < 4; k++) { const cc = F.c[k]; const top = cc[1] ? hc['' + cc[0] + cc[2]] : 0; verts.push([x + cc[0], wy + (cc[1] ? top - (myH < 1 || f === 2 ? 0.001 : 0) : 0), z + cc[2]]);
          const s = F.s * 255; cols.push([s, s, s]); const ll = f === 2 ? L : [Math.max(vs[np], L[0]), Math.max(vl[np], L[1])]; lits.push([ll[0] * 17, ll[1] * 17]); uvs.push(UVS[k]); }
        buf.quad(verts, uvs, cols, lits, tile, false, rows);
        if (f === 2 && isW) buf.quad([verts[1], verts[0], verts[3], verts[2]], uvs, cols, lits, tile, false, rows);
      }
    }
  }
  return { solid: solid.out(), water: water.out(), glass: glass.out() };
}
const SOLIDLIKE = (n) => OPAQUE[n] === 1;
