// Renderer: three.js scene, chunk shader with classic light table, sky, sun/moon, stars, clouds, fog
import * as THREE from 'three';
import { buildAtlas, animateFire, atlasRows } from './textures.js';
import { buildSection } from '../world/mesher.js';
import { SECTIONS, ckey } from '../world/chunk.js';
import { BIOMES } from '../world/gen.js';

const chunkVS = `
attribute vec2 lit; varying vec2 vUv; varying vec3 vCol; varying float vLight; varying float vFog;
uniform float daySub; uniform float gamma; uniform float time; uniform float liquid; uniform float ambient;
float bright(float l){ float f = 1.0 - l/15.0; return (1.0 - f) / (f * 3.0 + 1.0) * 0.95 + 0.05; }
void main(){
  vUv = uv; vCol = color;
  float sky = lit.x * 15.0; float blk = lit.y * 15.0;
  float l = max(sky - daySub, blk);
  float b = bright(clamp(l, 0.0, 15.0));
  b = mix(b, 1.0 - pow(1.0 - b, 3.0) , gamma * 0.6);
  vLight = b * (1.0 - ambient) + ambient;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vFog = length(mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;
const chunkFS = `
uniform sampler2D atlas; uniform vec3 fogColor; uniform float fogNear; uniform float fogFar; uniform float alphaTest; uniform float opacity;
varying vec2 vUv; varying vec3 vCol; varying float vLight; varying float vFog;
void main(){
  vec4 t = texture2D(atlas, vUv);
  if (t.a < alphaTest) discard;
  vec3 c = t.rgb * vCol * vLight;
  float f = clamp((vFog - fogNear) / (fogFar - fogNear), 0.0, 1.0);
  gl_FragColor = vec4(mix(c, fogColor, f), opacity < 1.0 ? max(t.a, opacity) : t.a);
}`;

export class Renderer {
  constructor(canvas) {
    this.gl = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
    this.gl.setPixelRatio(1); this.gl.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.scene = new THREE.Scene(); this.camera = new THREE.PerspectiveCamera(70, 1, 0.05, 1000); this.camera.rotation.order = 'YXZ';
    this.scene.add(this.camera);
    const tex = new THREE.CanvasTexture(buildAtlas()); tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter; tex.flipY = false; tex.generateMipmaps = false; tex.colorSpace = THREE.NoColorSpace;
    this.atlasTex = tex;
    this.uniforms = { atlas: { value: tex }, daySub: { value: 0 }, ambient: { value: 0 }, gamma: { value: 0 }, fogColor: { value: new THREE.Color() }, fogNear: { value: 50 }, fogFar: { value: 100 }, time: { value: 0 }, alphaTest: { value: 0.1 }, opacity: { value: 1 }, liquid: { value: 0 } };
    this.solidMat = new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: chunkVS, fragmentShader: chunkFS, vertexColors: true });
    const wu = { ...this.uniforms, alphaTest: { value: 0.01 }, opacity: { value: 0.75 } };
    this.waterMat = new THREE.ShaderMaterial({ uniforms: wu, vertexShader: chunkVS, fragmentShader: chunkFS, vertexColors: true, transparent: true, depthWrite: true });
    this.glassMat = new THREE.ShaderMaterial({ uniforms: this.uniforms, vertexShader: chunkVS, fragmentShader: chunkFS, vertexColors: true, transparent: true, depthWrite: false });
    this.chunkGroup = new THREE.Group(); this.scene.add(this.chunkGroup);
    this.opts = { smooth: true, fancy: true, rows: atlasRows() };
    this._initSky(); this._initClouds(); this._initSelection();
    this.resize();
    addEventListener('resize', () => this.resize());
  }
  resize() { const w = innerWidth, h = innerHeight; this.gl.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
  setOptions(o) {
    const changed = (o.smooth !== this.opts.smooth) || (o.fancy !== this.opts.fancy);
    this.opts.smooth = o.smooth; this.opts.fancy = o.fancy; this.renderDist = o.renderDist; this.uniforms.gamma.value = o.brightness;
    this.camera.fov = o.fov; this.camera.updateProjectionMatrix();
    this.clouds.visible = this.cloudsOn = o.clouds !== false; this.cloudsFancy = o.fancy;
    if (changed && this.world) for (const c of this.world.chunks.values()) c.dirty.fill(1);
  }
  attach(world) {
    this.detach(); this.world = world;
  }
  detach() { if (!this.world) return; for (const c of this.world.chunks.values()) this.disposeChunk(c); this.world = null; }
  disposeChunk(c) { for (let s = 0; s < SECTIONS; s++) { const m = c.meshes[s]; if (m) { for (const mm of m) { this.chunkGroup.remove(mm); mm.geometry.dispose(); } c.meshes[s] = null; } } }
  _mkMesh(d, mat, c) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(d.pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(d.uv, 2));
    g.setAttribute('color', new THREE.BufferAttribute(d.col, 3, true)); g.setAttribute('lit', new THREE.BufferAttribute(d.lit, 2, true));
    g.setIndex(new THREE.BufferAttribute(d.ind, 1)); g.computeBoundingSphere();
    const m = new THREE.Mesh(g, mat); m.position.set(c.cx * 16, 0, c.cz * 16); m.matrixAutoUpdate = false; m.updateMatrix();
    if (mat === this.waterMat) m.renderOrder = 1; else if (mat === this.glassMat) m.renderOrder = 2; return m;
  }
  // rebuild dirty sections, nearest first, within a time budget
  updateMeshes(px, pz, budgetMs) {
    const w = this.world; if (!w) return; const t0 = performance.now(); const pcx = Math.floor(px / 16), pcz = Math.floor(pz / 16);
    const cand = [];
    for (const c of w.chunks.values()) { if (!c.lit) continue; let d = false; for (let s = 0; s < SECTIONS; s++) if (c.dirty[s]) { d = true; break; } if (!d) continue;
      if (!w.chunks.has(ckey(c.cx + 1, c.cz)) || !w.chunks.has(ckey(c.cx - 1, c.cz)) || !w.chunks.has(ckey(c.cx, c.cz + 1)) || !w.chunks.has(ckey(c.cx, c.cz - 1))) continue;
      cand.push([(c.cx - pcx) ** 2 + (c.cz - pcz) ** 2, c]); }
    cand.sort((a, b) => a[0] - b[0]);
    for (const [, c] of cand) {
      for (let s = 0; s < SECTIONS; s++) { if (!c.dirty[s]) continue; c.dirty[s] = 0;
        const r = buildSection(w, c, s, this.opts);
        const old = c.meshes[s]; if (old) for (const mm of old) { this.chunkGroup.remove(mm); mm.geometry.dispose(); }
        const arr = []; if (r.solid) arr.push(this._mkMesh(r.solid, this.solidMat, c)); if (r.water) arr.push(this._mkMesh(r.water, this.waterMat, c)); if (r.glass) arr.push(this._mkMesh(r.glass, this.glassMat, c));
        for (const mm of arr) this.chunkGroup.add(mm); c.meshes[s] = arr.length ? arr : null;
      }
      if (performance.now() - t0 > budgetMs) break;
    }
  }

  // ---------------- sky ----------------
  _initSky() {
    const skyGeo = new THREE.SphereGeometry(400, 24, 12);
    this.skyMat = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { skyColor: { value: new THREE.Color() }, fogColor: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3() }, sunset: { value: new THREE.Vector4() } },
      vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }',
      fragmentShader: `uniform vec3 skyColor; uniform vec3 fogColor; uniform vec3 sunDir; uniform vec4 sunset; varying vec3 vDir;
        void main(){ float h = vDir.y; vec3 c = mix(fogColor, skyColor, smoothstep(-0.02, 0.35, h));
          if (h < -0.02) c = mix(fogColor, skyColor * vec3(0.2,0.2,0.6), smoothstep(-0.02, -0.3, h));
          float s = max(0.0, dot(normalize(vec3(vDir.x, 0.0, vDir.z)), normalize(vec3(sunDir.x, 0.0, sunDir.z))));
          float band = smoothstep(0.5, -0.05, abs(h - 0.05)) * pow(s, 2.0) * sunset.w;
          c = mix(c, sunset.rgb, band);
          gl_FragColor = vec4(c, 1.0); }` });
    this.sky = new THREE.Mesh(skyGeo, this.skyMat); this.sky.renderOrder = -10; this.sky.frustumCulled = false; this.scene.add(this.sky);
    // sun & moon (pixel textures)
    const mk = (draw) => { const cv = document.createElement('canvas'); cv.width = cv.height = 32; const x = cv.getContext('2d'); draw(x); const t = new THREE.CanvasTexture(cv); t.magFilter = t.minFilter = THREE.NearestFilter; t.colorSpace = THREE.NoColorSpace; return t; };
    const sunT = mk(x => { x.fillStyle = '#fff8a0'; x.fillRect(8, 8, 16, 16); x.fillStyle = '#ffffe8'; x.fillRect(10, 10, 12, 12); x.fillStyle = 'rgba(255,240,150,0.35)'; x.fillRect(6, 6, 20, 20); });
    const moonT = mk(x => { x.fillStyle = '#c8ccd8'; x.fillRect(10, 10, 12, 12); x.fillStyle = '#a0a4b4'; x.fillRect(12, 12, 3, 3); x.fillRect(17, 16, 3, 3); x.fillRect(13, 18, 2, 2); });
    const quad = (t, s) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(s, s), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending })); m.renderOrder = -9; m.frustumCulled = false; return m; };
    this.sunMesh = quad(sunT, 60); this.moonMesh = quad(moonT, 40); this.scene.add(this.sunMesh, this.moonMesh);
    // stars
    const r = (() => { let s = 10842; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; })();
    const pos = []; for (let i = 0; i < 1500; i++) { const u = r() * 2 - 1, a = r() * Math.PI * 2, q = Math.sqrt(1 - u * u); pos.push(q * Math.cos(a) * 350, u * 350, q * Math.sin(a) * 350); }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    this.starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 1.4, sizeAttenuation: false, transparent: true, depthWrite: false, fog: false });
    this.stars = new THREE.Points(sg, this.starMat); this.stars.renderOrder = -9; this.stars.frustumCulled = false; this.scene.add(this.stars);
  }
  _initClouds() {
    // cloud map: 64x64 cells of 12 blocks
    const N = 64; const map = new Uint8Array(N * N); let s = 1234;
    const rr = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    const v = new Float32Array(N * N); for (let i = 0; i < N * N; i++) v[i] = rr();
    for (let pass = 0; pass < 2; pass++) for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { let t = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) t += v[((y + dy + N) % N) * N + (x + dx + N) % N]; v[y * N + x] = t / 9; }
    for (let i = 0; i < N * N; i++) map[i] = v[i] > 0.53 ? 1 : 0;
    const C = 12, H = 4; const pos = [], col = [];
    const face = (a, b, c, d, sh) => { pos.push(...a, ...b, ...c, ...a, ...c, ...d); for (let i = 0; i < 6; i++) col.push(sh, sh, sh); };
    const at = (x, y) => map[((y + N) % N) * N + (x + N) % N];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { if (!map[y * N + x]) continue; const x0 = x * C, x1 = x0 + C, z0 = y * C, z1 = z0 + C;
      face([x0, H, z1], [x1, H, z1], [x1, H, z0], [x0, H, z0], 1); face([x0, 0, z0], [x1, 0, z0], [x1, 0, z1], [x0, 0, z1], 0.7);
      if (!at(x + 1, y)) face([x1, 0, z1], [x1, 0, z0], [x1, H, z0], [x1, H, z1], 0.9); if (!at(x - 1, y)) face([x0, 0, z0], [x0, 0, z1], [x0, H, z1], [x0, H, z0], 0.9);
      if (!at(x, y + 1)) face([x0, 0, z1], [x1, 0, z1], [x1, H, z1], [x0, H, z1], 0.8); if (!at(x, y - 1)) face([x1, 0, z0], [x0, 0, z0], [x0, H, z0], [x1, H, z0], 0.8); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    this.cloudMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: true, vertexColors: true,
      uniforms: { tint: { value: new THREE.Color(1, 1, 1) }, fogColor: this.uniforms.fogColor, far: { value: 300 } },
      vertexShader: 'varying vec3 vC; varying float vD; void main(){ vC = color; vec4 mv = modelViewMatrix * vec4(position,1.0); vD = length(mv.xz); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform vec3 tint; uniform vec3 fogColor; uniform float far; varying vec3 vC; varying float vD; void main(){ float f = clamp(vD / far, 0.0, 1.0); gl_FragColor = vec4(mix(vC * tint, fogColor, f*f), 0.8 * (1.0 - f*f)); }' });
    this.clouds = new THREE.Group(); this.cloudSize = N * C;
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { const m = new THREE.Mesh(g, this.cloudMat); m.position.set(i * N * C, 0, j * N * C); m.frustumCulled = false; this.clouds.add(m); }
    this.clouds.renderOrder = 2; this.scene.add(this.clouds);
  }
  _initSelection() {
    const g = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.004, 1.004, 1.004));
    this.selBox = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.45 }));
    this.selBox.visible = false; this.scene.add(this.selBox);
    this.breakMats = []; const canvas = buildAtlas();
    this.breakMesh = new THREE.Mesh(new THREE.BoxGeometry(1.006, 1.006, 1.006), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }));
    this.breakMesh.visible = false; this.scene.add(this.breakMesh);
    this.breakTex = [];
  }
  setBreak(pos, stage, tileFn) {
    if (!pos || stage < 0) { this.breakMesh.visible = false; return; }
    if (!this.breakTex[stage]) { const cv = document.createElement('canvas'); cv.width = cv.height = 16; tileFn(cv.getContext('2d'), 'destroy_' + stage); const t = new THREE.CanvasTexture(cv); t.magFilter = t.minFilter = THREE.NearestFilter; t.colorSpace = THREE.NoColorSpace; this.breakTex[stage] = t; }
    this.breakMesh.material.map = this.breakTex[stage]; this.breakMesh.material.needsUpdate = true;
    this.breakMesh.position.set(pos[0] + 0.5, pos[1] + 0.5, pos[2] + 0.5); this.breakMesh.visible = true;
  }
  setSelection(pos, box) {
    if (!pos) { this.selBox.visible = false; return; }
    const b = box || [0, 0, 0, 1, 1, 1];
    this.selBox.scale.set((b[3] - b[0]) || 1, (b[4] - b[1]) || 1, (b[5] - b[2]) || 1);
    this.selBox.position.set(pos[0] + (b[0] + b[3]) / 2, pos[1] + (b[1] + b[4]) / 2, pos[2] + (b[2] + b[5]) / 2); this.selBox.visible = true;
  }

  // time: world ticks; biome temp for sky hue
  updateSky(time, temp, renderDist, underwater, dim = 0) {
    const nether = dim === -1; this.sky.visible = !nether; this.sunMesh.visible = this.moonMesh.visible = !nether; this.clouds.visible = !nether && this.cloudsOn !== false; this.uniforms.ambient.value = nether ? 0.1 : 0;
    const tt = (time % 24000) / 24000; let ang = tt - 0.25; if (ang < 0) ang += 1; if (ang > 1) ang -= 1;
    const f0 = ang; ang = f0 + ((1 - (Math.cos(f0 * Math.PI) + 1) / 2) - f0) / 3;
    const day = Math.max(0, Math.min(1, Math.cos(ang * Math.PI * 2) * 2 + 0.5));
    this.daylight = day;
    const t = Math.max(-1, Math.min(1, temp / 3));
    const sky = new THREE.Color().setHSL(0, 0, 0); { const h = 0.6222 - t * 0.05, s = 0.5 + t * 0.1; const c = hsv(h, s, 1); sky.setRGB(c[0] * day, c[1] * day, c[2] * day); }
    const fog = new THREE.Color(0.753 * (day * 0.94 + 0.06), 0.847 * (day * 0.94 + 0.06), 1.0 * (day * 0.91 + 0.09));
    const k = 1 - Math.pow(0.25 + 0.75 * renderDist / 16, 0.25); fog.lerp(sky, Math.max(0, Math.min(1, k + 0.15)));
    // sunrise/sunset color
    const cA = Math.cos(ang * Math.PI * 2); let sunset = 0; let ssC = [1, 0.5, 0.25];
    if (cA >= -0.4 && cA <= 0.4) { const f = cA / 0.4 * 0.5 + 0.5; sunset = (1 - (1 - Math.sin(f * Math.PI)) * 0.99); sunset *= sunset; ssC = [f * 0.3 + 0.7, f * f * 0.7 + 0.2, 0.2]; }
    if (underwater === 'water') { fog.setRGB(0.02, 0.02, 0.2 + 0.1 * day); }
    else if (underwater === 'lava') { fog.setRGB(0.6, 0.1, 0); }
    if (nether && !underwater) fog.setRGB(0.2, 0.03, 0.03);
    this.skyMat.uniforms.skyColor.value.copy(sky); this.skyMat.uniforms.fogColor.value.copy(fog);
    const sd = new THREE.Vector3(Math.sin(ang * Math.PI * 2) * -1, Math.cos(ang * Math.PI * 2), 0);
    this.skyMat.uniforms.sunDir.value.copy(sd); this.skyMat.uniforms.sunset.value.set(ssC[0], ssC[1], ssC[2], sunset * 0.8);
    this.uniforms.fogColor.value.copy(fog); this.gl.setClearColor(fog);
    const far = renderDist * 16; this.uniforms.fogFar.value = underwater === 'water' ? 18 : underwater === 'lava' ? 2 : far * 0.95; this.uniforms.fogNear.value = underwater ? 0 : far * 0.3;
    this.uniforms.daySub.value = (1 - day) * 11;
    if (nether) { this.uniforms.daySub.value = 0; if (!underwater) { this.uniforms.fogNear.value = 0; this.uniforms.fogFar.value = Math.min(far, 96) * 0.9; } this.stars.visible = false; }
    const cam = this.camera.position;
    this.sky.position.copy(cam); this.stars.position.copy(cam);
    this.sunMesh.position.copy(cam).addScaledVector(sd, 300); this.sunMesh.lookAt(cam);
    this.moonMesh.position.copy(cam).addScaledVector(sd, -300); this.moonMesh.lookAt(cam);
    this.stars.rotation.z = -ang * Math.PI * 2; const sb = Math.max(0, 1 - (Math.cos(ang * Math.PI * 2) * 2 + 0.75)); this.starMat.opacity = sb * sb * 0.6; this.stars.visible = sb > 0.01 && !nether;
    // clouds
    this.cloudMat.uniforms.tint.value.setRGB(day * 0.9 + 0.1, day * 0.9 + 0.1, day * 0.85 + 0.15);
    this.cloudMat.uniforms.far.value = Math.max(160, far * 1.6);
    const off = (time * 0.03) % this.cloudSize;
    const S = this.cloudSize; const cx = Math.floor((cam.x - off) / S) * S + off, cz = Math.floor(cam.z / S) * S;
    this.clouds.position.set(cx, 108.33, cz); this.clouds.scale.y = this.cloudsFancy ? 1 : 0.01;
  }
  render() { const f = Math.floor(performance.now() / 50) % 32; if (f !== this.fireFrame && animateFire(f)) { this.fireFrame = f; this.atlasTex.needsUpdate = true; } this.gl.render(this.scene, this.camera); }
}
function hsv(h, s, v) { const i = Math.floor(h * 6), f = h * 6 - i, p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s); return [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][((i % 6) + 6) % 6]; }
