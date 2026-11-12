// Pixel particles: GL points sampling small atlas fragments (block break, smoke, flame, splash, hearts...)
import * as THREE from 'three';
import { tileIndex, COLS } from './textures.js';
const MAX = 3000;
export class Particles {
  constructor(renderer) {
    this.r = renderer; this.list = [];
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(MAX * 3); this.uv = new Float32Array(MAX * 2); this.size = new Float32Array(MAX); this.col = new Float32Array(MAX * 3);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); g.setAttribute('uvo', new THREE.BufferAttribute(this.uv, 2)); g.setAttribute('psize', new THREE.BufferAttribute(this.size, 1)); g.setAttribute('pcol', new THREE.BufferAttribute(this.col, 3));
    this.geo = g; const rows = renderer.opts.rows;
    this.mat = new THREE.ShaderMaterial({ transparent: false, uniforms: { atlas: renderer.uniforms.atlas, tile: { value: new THREE.Vector2(1 / COLS, 1 / rows) }, scale: { value: innerHeight }, fogColor: renderer.uniforms.fogColor, fogFar: renderer.uniforms.fogFar },
      vertexShader: 'attribute vec2 uvo; attribute float psize; attribute vec3 pcol; varying vec2 vUvo; varying vec3 vCol; varying float vF; uniform float scale; uniform float fogFar; void main(){ vUvo = uvo; vCol = pcol; vec4 mv = modelViewMatrix * vec4(position,1.0); vF = clamp(length(mv.xyz)/fogFar,0.0,1.0); gl_PointSize = psize * scale / -mv.z; gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform sampler2D atlas; uniform vec2 tile; uniform vec3 fogColor; varying vec2 vUvo; varying vec3 vCol; varying float vF; void main(){ vec2 uv = vUvo + (floor(gl_PointCoord * 4.0) + 0.5) / 16.0 * tile; vec4 t = texture2D(atlas, uv); if (t.a < 0.1) discard; gl_FragColor = vec4(mix(t.rgb * vCol, fogColor, vF), 1.0); }' });
    this.points = new THREE.Points(g, this.mat); this.points.frustumCulled = false; renderer.scene.add(this.points);
    this.rows = rows; this.special = this._specialTiles();
  }
  _specialTiles() { // tiny procedural sprites placed in a canvas atlas region are complex; reuse block tiles with tints
    return { smoke: ['wool', [0.6, 0.6, 0.6]], flame: ['lava', [1.2, 1, 0.6]], splash: ['water', [0.6, 0.7, 1.4]], heart: ['flower_red', [1.4, 0.6, 0.6]], lava: ['lava', [1.3, 1, 0.8]], portal: ['obsidian', [2, 1, 2.5]], crit: ['sand', [1, 1, 1]], explode: ['wool', [0.9, 0.9, 0.9]] };
  }
  spawn(x, y, z, tileName, opts = {}) {
    if (this.list.length >= MAX) this.list.shift();
    const t = tileIndex(tileName) ?? 0; const fx = Math.floor(Math.random() * 3) / 4, fy = Math.floor(Math.random() * 3) / 4;
    this.list.push({ x, y, z, vx: opts.vx ?? (Math.random() - 0.5) * 0.2, vy: opts.vy ?? Math.random() * 0.2, vz: opts.vz ?? (Math.random() - 0.5) * 0.2,
      u: (t % COLS) / COLS + fx / COLS, v: Math.floor(t / COLS) / this.rows + fy / this.rows, size: opts.size ?? (0.1 + Math.random() * 0.1), life: opts.life ?? (4 / (Math.random() * 0.9 + 0.1)) | 0, grav: opts.grav ?? 0.04, col: opts.col || [1, 1, 1], drag: opts.drag ?? 0.98, collide: opts.collide !== false, rise: opts.rise || 0 });
  }
  fx(type, x, y, z, n = 1, arg = 0) { const s = this.special[type]; for (let i = 0; i < n; i++) {
    if (type === 'note') { const h = arg * 6.283; this.spawn(x, y, z, 'wool', { vx: 0, vy: 0.02, vz: 0, grav: -0.001, col: [Math.max(0, Math.sin(h)) * 0.65 + 0.35, Math.max(0, Math.sin(h + 2.094)) * 0.65 + 0.35, Math.max(0, Math.sin(h + 4.189)) * 0.65 + 0.35].map(c => c * 1.4), life: 20, size: 0.22, collide: false }); continue; }
    if (type === 'smoke') this.spawn(x, y, z, s[0], { vx: (Math.random() - 0.5) * 0.02, vy: 0.02, vz: (Math.random() - 0.5) * 0.02, grav: -0.002, col: s[1].map(c => c * (0.3 + Math.random() * 0.4)), life: 20 + Math.random() * 10 | 0, size: 0.12, collide: false });
    else if (type === 'flame') this.spawn(x, y, z, s[0], { vx: 0, vy: 0.005, vz: 0, grav: 0, col: s[1], life: 10 + Math.random() * 6 | 0, size: 0.07, collide: false });
    else if (type === 'splash') this.spawn(x + (Math.random() - 0.5), y, z + (Math.random() - 0.5), s[0], { vx: (Math.random() - 0.5) * 0.1, vy: 0.1 + Math.random() * 0.1, vz: (Math.random() - 0.5) * 0.1, col: s[1], life: 12, size: 0.08 });
    else if (type === 'heart') this.spawn(x, y, z, s[0], { vx: 0, vy: 0.03, vz: 0, grav: 0, col: s[1], life: 25, size: 0.2, collide: false });
    else if (type === 'lava') this.spawn(x, y, z, s[0], { vx: (Math.random() - 0.5) * 0.08, vy: 0.2 + Math.random() * 0.1, vz: (Math.random() - 0.5) * 0.08, grav: 0.03, col: s[1], life: 30, size: 0.1 });
    else if (type === 'portal') this.spawn(x, y, z, s[0], { vx: (Math.random() - 0.5) * 0.1, vy: (Math.random() - 0.5) * 0.1, vz: (Math.random() - 0.5) * 0.1, grav: 0, col: s[1], life: 30, size: 0.08, collide: false });
    else if (type === 'crit' || type === 'damage') this.spawn(x, y, z, 'snow', { vx: (Math.random() - 0.5) * 0.3, vy: Math.random() * 0.3, vz: (Math.random() - 0.5) * 0.3, col: type === 'damage' ? [0.6, 0.1, 0.1] : [0.9, 0.9, 1], life: 10, size: 0.08 });
    else if (type === 'explode') this.spawn(x + (Math.random() - 0.5) * 3, y + (Math.random() - 0.5) * 3, z + (Math.random() - 0.5) * 3, s[0], { vx: (Math.random() - 0.5) * 0.1, vy: 0.05, vz: (Math.random() - 0.5) * 0.1, grav: -0.002, col: [0.8, 0.8, 0.8], life: 20, size: 0.6, collide: false });
  } }
  blockBreak(world, x, y, z, tileName, tint) {
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) for (let k = 0; k < 4; k++) {
      const px = x + (i + 0.5) / 4, py = y + (j + 0.5) / 4, pz = z + (k + 0.5) / 4;
      this.spawn(px, py, pz, tileName, { vx: (px - x - 0.5) * 0.15 + (Math.random() - 0.5) * 0.08, vy: (py - y - 0.5) * 0.15 + Math.random() * 0.1, vz: (pz - z - 0.5) * 0.15 + (Math.random() - 0.5) * 0.08, col: tint, grav: 0.04 });
    }
  }
  blockHit(x, y, z, face, tileName, tint) {
    const px = x + 0.5 + face[0] * 0.55 + (face[0] ? 0 : (Math.random() - 0.5) * 0.9), py = y + 0.5 + face[1] * 0.55 + (face[1] ? 0 : (Math.random() - 0.5) * 0.9), pz = z + 0.5 + face[2] * 0.55 + (face[2] ? 0 : (Math.random() - 0.5) * 0.9);
    this.spawn(px, py, pz, tileName, { vx: face[0] * 0.04, vy: 0.03, vz: face[2] * 0.04, col: tint, size: 0.07 });
  }
  tick(world) {
    const keep = [];
    for (const p of this.list) {
      if (--p.life <= 0) continue;
      p.vy -= p.grav; p.x += p.vx; p.y += p.vy; p.z += p.vz;
      if (p.collide) { const id = world.getBlock(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z)); if (id && id !== 8 && id !== 9 && world.getBlock(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z)) !== 0 && (id < 6 || id > 100 || [12, 13, 17, 18, 24, 35, 45, 48, 49, 54, 58, 61, 79, 80, 82, 87].includes(id))) { p.y = Math.floor(p.y) + 1.001; p.vy = 0; p.vx *= 0.7; p.vz *= 0.7; } }
      p.vx *= p.drag; p.vy *= p.drag; p.vz *= p.drag; keep.push(p);
    }
    this.list = keep;
  }
  update(world, daySub) {
    const n = this.list.length;
    for (let i = 0; i < n; i++) { const p = this.list[i];
      this.pos[i * 3] = p.x; this.pos[i * 3 + 1] = p.y; this.pos[i * 3 + 2] = p.z; this.uv[i * 2] = p.u; this.uv[i * 2 + 1] = p.v; this.size[i] = p.size;
      const x = Math.floor(p.x), y = Math.floor(p.y), z = Math.floor(p.z); const l = Math.max(world.getSky(x, y, z) - daySub, world.getBlockLight(x, y, z)); const f = 1 - Math.max(0, l) / 15; const b = (1 - f) / (f * 3 + 1) * 0.95 + 0.05;
      const fb = p.col[0] > 1.1 ? 1 : b; this.col[i * 3] = p.col[0] * fb; this.col[i * 3 + 1] = p.col[1] * fb; this.col[i * 3 + 2] = p.col[2] * fb; }
    this.geo.setDrawRange(0, n); for (const k of ['position', 'uvo', 'psize', 'pcol']) this.geo.attributes[k].needsUpdate = true;
    this.mat.uniforms.scale.value = innerHeight / (2 * Math.tan(this.r.camera.fov * Math.PI / 360));
  }
  clear() { this.list = []; }
}
