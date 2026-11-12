// Audio: recorded samples (sounds/) with procedural fallbacks, streamed music & jukebox records
let ac = null, master = null, sfxGain = null; let noiseBuf = null;
const vol = { sound: 1, music: 1, records: 1 };
function ctx() {
  if (!ac) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null; ac = new AC(); master = ac.createGain(); master.connect(ac.destination); sfxGain = ac.createGain(); sfxGain.connect(master); applyVol();
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; loadSamples(); }
  if (ac.state === 'suspended') ac.resume(); return ac;
}
// ---------- recorded samples ----------
const seq = (p, n) => Array.from({ length: n }, (_, i) => p + (i + 1));
const STEP = { grass: 6, gravel: 4, stone: 6, wood: 6, sand: 5, snow: 4, cloth: 4, ladder: 5 };
const SAMPLES = {
  'dig:grass': seq('dig/grass', 4), 'dig:gravel': seq('dig/gravel', 4),
  hurt: seq('hit/hit', 3), click: ['random/click'], break: ['random/break'], place: ['place'], glass: seq('random/glass', 3),
  pop: ['random/pop'], orb: ['random/orb'], levelup: ['random/levelup'], splash: ['random/splash'], fizz: ['random/fizz'], fuse: ['random/fuse'],
  explode: seq('random/explode', 4), eat: seq('random/eat', 3), drink: ['random/drink'], burp: ['random/burp'], bow: ['random/bow'], bowhit: seq('random/bowhit', 4),
  door_open: ['random/door_open'], door_close: ['random/door_close'], chestopen: ['random/chestopen'], chestclosed: ['random/chestclosed'],
  breath: ['random/breath'], anvil_use: ['random/anvil_use'], anvil_land: ['random/anvil_land'], anvil_break: ['random/anvil_break'],
  successful_hit: ['random/successful_hit'], wood_click: ['random/wood_click'], classic_hurt: ['random/classic_hurt'],
  portal: ['portal/portal'], travel: ['portal/travel'], trigger: ['portal/trigger'],
  'piston:out': ['piston/out'], 'piston:in': ['piston/in'],
};
for (const [m, n] of Object.entries(STEP)) SAMPLES['step:' + m] = seq('step/' + m, n);
for (const n of ['harp', 'bd', 'snare', 'hat', 'bass', 'pling', 'bassattack']) SAMPLES['note:' + n] = ['note/' + n];
const MAT_ALIAS = { metal: 'stone', glass: 'stone', ice: 'stone' };
const bufs = new Map();
function loadSamples() {
  for (const list of Object.values(SAMPLES)) for (const n of list) {
    if (bufs.has(n)) continue; bufs.set(n, null);
    fetch(new URL('../../sounds/' + n + '.ogg', import.meta.url)).then(r => r.arrayBuffer()).then(a => ac.decodeAudioData(a)).then(b => bufs.set(n, b)).catch(() => {});
  }
}
// play a random sample from a group; returns false if none are loaded (caller falls back to synth)
function sample(group, v, pitch) {
  const list = SAMPLES[group]; if (!list) return false; const b = bufs.get(list[(Math.random() * list.length) | 0]); if (!b) return false;
  const src = ac.createBufferSource(); src.buffer = b; src.playbackRate.value = pitch;
  const g = ac.createGain(); g.gain.value = v; src.connect(g); g.connect(sfxGain); src.start(); return true;
}
function applyVol() { if (sfxGain) sfxGain.gain.value = vol.sound * 0.6; Music.refresh(); }
const MAT = { // filter freq, q, duration, gain
  stone: [1800, 1.2, 0.09, 0.5], wood: [700, 2.5, 0.1, 0.6], gravel: [1200, 0.6, 0.12, 0.45], grass: [2600, 0.5, 0.12, 0.35], sand: [3800, 0.4, 0.12, 0.3],
  cloth: [900, 0.5, 0.1, 0.3], snow: [3000, 0.5, 0.1, 0.3], glass: [3200, 6, 0.25, 0.4], metal: [2400, 4, 0.12, 0.45], ladder: [700, 2.5, 0.1, 0.6] };
function noise(t0, dur, freq, q, g, type = 'bandpass', p = 1) {
  const a = ac; const src = a.createBufferSource(); src.buffer = noiseBuf; src.playbackRate.value = p; src.loop = true;
  const f = a.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const gn = a.createGain(); gn.gain.setValueAtTime(0, t0); gn.gain.linearRampToValueAtTime(g, t0 + 0.005); gn.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  src.connect(f); f.connect(gn); gn.connect(sfxGain); src.start(t0, Math.random() * 0.5); src.stop(t0 + dur + 0.02);
}
function tone(t0, dur, f0, f1, g, type = 'square', out) {
  const a = ac; const o = a.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
  const gn = a.createGain(); gn.gain.setValueAtTime(g, t0); gn.gain.exponentialRampToValueAtTime(0.001, t0 + dur); o.connect(gn); gn.connect(out || sfxGain); o.start(t0); o.stop(t0 + dur + 0.02);
}
const stepMat = m => STEP[m] ? m : (MAT_ALIAS[m] || 'stone');
export const Sound = {
  setVolume(s, music, records) { vol.sound = s; if (music !== undefined) vol.music = music; if (records !== undefined) vol.records = records; applyVol(); },
  unlock() { ctx(); Music.unlock(); },
  // name: 'step:stone', 'dig:wood', 'place:grass', 'click', 'pop', 'hurt', 'note:harp', 'piston:out', ...
  play(name, v = 1, pitch = 1) {
    if (!ctx() || vol.sound <= 0) return; const t = ac.currentTime; const [kind, mat] = name.split(':');
    const m = MAT[mat] || MAT.stone; const p = pitch * (0.9 + Math.random() * 0.2); const sm = stepMat(mat);
    switch (kind) {
      case 'step': if (sample('step:' + sm, 0.3 * v, pitch)) break; noise(t, m[2] * 0.8, m[0] * p, m[1], m[3] * 0.35 * v); break;
      case 'dig': if (mat === 'glass' ? sample('glass', v, p) : (SAMPLES[name] ? sample(name, v, pitch * 0.8) : sample('step:' + sm, v, pitch * 0.8))) break; noise(t, m[2] * 1.6, m[0] * p * 0.9, m[1], m[3] * v); break;
      case 'hit': if (sample('step:' + sm, 0.25 * v, pitch * 0.5)) break; noise(t, m[2] * 0.7, m[0] * p, m[1], m[3] * 0.4 * v); break;
      case 'place': if (SAMPLES['dig:' + mat] ? sample('dig:' + mat, v, pitch) : sample('step:' + sm, v, pitch * 0.8)) break; noise(t, m[2] * 1.2, m[0] * p * 0.8, m[1], m[3] * 0.8 * v); break;
      case 'note': { const k = 'note:' + (mat || 'harp'); if (sample(k, v, pitch)) break; tone(t, 0.4, 440 * pitch, 440 * pitch, 0.15 * v, 'triangle'); break; }
      case 'piston': if (sample(name, 0.5 * v, p)) break; noise(t, 0.15, 600, 2, 0.4 * v); break;
      case 'click': if (sample('click', 0.5 * v, pitch)) break; tone(t, 0.05, 1400, 900, 0.12, 'square'); break;
      case 'pop': if (sample('pop', v, p)) break; tone(t, 0.08, 500 * p * 1.5, 1600 * p, 0.15 * v, 'sine'); break;
      case 'hurt': if (sample('hurt', v, p)) break; tone(t, 0.18, 280 * p, 140, 0.25 * v, 'sawtooth'); noise(t, 0.12, 800, 1, 0.2 * v); break;
      case 'fall': noise(t, 0.2, 400, 0.8, 0.6 * v, 'lowpass'); break;
      case 'splash': if (sample('splash', v, p)) break; noise(t, 0.5, 1500 * p, 0.3, 0.5 * v, 'bandpass', 0.6); break;
      case 'swim': if (sample('splash', 0.25 * v, 1.6 * p)) break; noise(t, 0.25, 1200 * p, 0.5, 0.15 * v); break;
      case 'lava': noise(t, 0.3, 300 * p, 2, 0.3 * v, 'lowpass'); tone(t, 0.06, 120, 60, 0.15 * v, 'sine'); break;
      case 'portal': if (sample(mat === 'trigger' ? 'trigger' : 'portal', 0.6 * v, pitch)) break; tone(t, 2.2, 90 * p, 140 * p, 0.12 * v, 'sawtooth'); noise(t, 2.2, 700 * p, 1.5, 0.08 * v, 'bandpass'); break;
      case 'travel': if (sample('travel', 0.6 * v, pitch)) break; tone(t, 1.6, 300 * p, 60 * p, 0.15 * v, 'sawtooth'); break;
      case 'fizz': if (sample('fizz', 0.5 * v, p)) break; noise(t, 0.5, 5000, 0.5, 0.25 * v, 'highpass'); break;
      case 'burp': if (sample('burp', v, p)) break; tone(t, 0.25, 160, 90, 0.25 * v, 'sawtooth'); break;
      case 'eat': if (sample('eat', v, p)) break; for (let i = 0; i < 3; i++) noise(t + i * 0.07, 0.06, 1500 + Math.random() * 1000, 1.5, 0.3 * v); break;
      case 'drink': if (sample('drink', v, p)) break; noise(t, 0.1, 900, 2, 0.2 * v); break;
      case 'orb': if (sample('orb', v, pitch)) break; tone(t, 0.15, 1800 * p, 2600 * p, 0.08 * v, 'sine'); break;
      case 'levelup': if (sample('levelup', 0.8 * v, 1)) break; [523, 659, 784, 1046].forEach((f, i) => tone(t + i * 0.08, 0.4, f, f, 0.1 * v, 'triangle')); break;
      case 'explode': if (sample('explode', Math.min(1.5, v), p)) break; noise(t, 1.4, 300, 0.3, 1.0 * v, 'lowpass', 0.5); tone(t, 0.6, 80, 30, 0.6 * v, 'sine'); break;
      case 'fuse': if (sample('fuse', v, pitch)) break; noise(t, 1.2, 4500, 0.6, 0.25 * v, 'highpass'); break;
      case 'bow': if (sample('bow', v, pitch)) break; noise(t, 0.2, 1500, 1, 0.3 * v); break;
      case 'bowhit': if (sample('bowhit', v, p)) break; noise(t, 0.1, 1500, 1, 0.3 * v); break;
      case 'door': if (sample(mat === 'close' ? 'door_close' : 'door_open', v, pitch * (0.9 + Math.random() * 0.1))) break; noise(t, 0.25, 500, 3, 0.4 * v); break;
      case 'chest': if (sample(mat === 'close' ? 'chestclosed' : 'chestopen', v, p)) break; noise(t, 0.35, 350, 4, 0.35 * v); break;
      case 'anvil': if (sample('anvil_' + (mat || 'use'), v, p)) break; tone(t, 0.3, 1800, 1700, 0.15 * v, 'square'); break;
      case 'breath': if (sample('breath', v, p)) break; break;
      case 'ding': if (sample('successful_hit', v, pitch)) break; tone(t, 0.2, 1600, 1600, 0.1 * v, 'sine'); break;
      case 'break': if (sample('break', v, p)) break; noise(t, 0.2, 900, 2, 0.4 * v); break;
      case 'mob': this.mob(mat, v, p); break;
      case 'golem': tone(t, 0.25, 90 * p, 50, 0.4 * v, 'square'); noise(t, 0.3, 600 * p, 2, 0.5 * v, 'lowpass'); break;
      default: noise(t, 0.1, 1000, 1, 0.2 * v);
    }
  },
  mob(type, v, p) {
    const t = ac.currentTime;
    switch (type) {
      case 'cow': tone(t, 0.6, 140 * p, 110 * p, 0.25 * v, 'sawtooth'); break;
      case 'pig': tone(t, 0.25, 320 * p, 200 * p, 0.2 * v, 'sawtooth'); tone(t + 0.25, 0.2, 300 * p, 220 * p, 0.15 * v, 'sawtooth'); break;
      case 'sheep': for (let i = 0; i < 5; i++) tone(t + i * 0.07, 0.08, 420 * p, 380 * p, 0.12 * v, 'sawtooth'); break;
      case 'chicken': tone(t, 0.08, 1500 * p, 1100 * p, 0.12 * v, 'square'); tone(t + 0.12, 0.06, 1700 * p, 1300 * p, 0.1 * v, 'square'); break;
      case 'horse': // whinny: wobbling falling neigh + breath
        { const o = ac.createOscillator(); o.type = 'sawtooth'; const lfo = ac.createOscillator(); lfo.frequency.value = 18; const lg = ac.createGain(); lg.gain.value = 60 * p; lfo.connect(lg); lg.connect(o.frequency);
          o.frequency.setValueAtTime(900 * p, t); o.frequency.exponentialRampToValueAtTime(380 * p, t + 0.9); const gn = ac.createGain(); gn.gain.setValueAtTime(0.0001, t); gn.gain.linearRampToValueAtTime(0.12 * v, t + 0.05); gn.gain.exponentialRampToValueAtTime(0.001, t + 0.95);
          const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1100; f.Q.value = 0.8; o.connect(f); f.connect(gn); gn.connect(sfxGain); o.start(t); lfo.start(t); o.stop(t + 1); lfo.stop(t + 1); noise(t + 0.9, 0.3, 1500, 0.5, 0.12 * v); } break;
      case 'horse_hurt': tone(t, 0.25, 700 * p, 400 * p, 0.15 * v, 'sawtooth'); noise(t, 0.15, 1400, 1, 0.12 * v); break;
      case 'gallop': noise(t, 0.05, 500, 2, 0.35 * v, 'lowpass'); noise(t + 0.08, 0.05, 450, 2, 0.3 * v, 'lowpass'); tone(t, 0.06, 120, 70, 0.15 * v, 'sine'); break;
      case 'zombie': tone(t, 0.8, 110 * p, 80 * p, 0.25 * v, 'sawtooth'); noise(t, 0.6, 300, 2, 0.15 * v); break;
      case 'skeleton': for (let i = 0; i < 4; i++) noise(t + i * 0.06, 0.04, 2500, 6, 0.25 * v); break;
      case 'spider': for (let i = 0; i < 6; i++) noise(t + i * 0.05, 0.04, 3000, 3, 0.15 * v); break;
      case 'wolf': tone(t, 0.3, 500 * p, 700 * p, 0.12 * v, 'triangle'); break;
      case 'slime': tone(t, 0.12, 200 * p, 90 * p, 0.25 * v, 'sine'); break;
      case 'villager': tone(t, 0.12, 190 * p, 230 * p, 0.14 * v, 'triangle'); tone(t + 0.13, 0.22, 230 * p, 160 * p, 0.14 * v, 'triangle'); break;
      case 'iron_golem': noise(t, 0.35, 450 * p, 3, 0.4 * v, 'bandpass'); tone(t, 0.3, 70 * p, 45, 0.25 * v, 'square'); break;
      case 'ghast': tone(t, 0.9, 520 * p, 300 * p, 0.12 * v, 'sawtooth'); tone(t, 0.9, 530 * p, 260 * p, 0.1 * v, 'triangle'); break;
      case 'blaze': noise(t, 0.6, 900 * p, 1.5, 0.25 * v, 'bandpass'); tone(t, 0.5, 160 * p, 120 * p, 0.12 * v, 'sawtooth'); break;
      case 'silverfish': for (let i = 0; i < 5; i++) noise(t + i * 0.04, 0.03, 5000, 4, 0.12 * v); break;
      case 'cave_spider': for (let i = 0; i < 6; i++) noise(t + i * 0.05, 0.04, 3300, 3, 0.15 * v); break;
      case 'squid': noise(t, 0.3, 700 * p, 1, 0.12 * v, 'lowpass'); break;
      case 'zombie_pigman': tone(t, 0.3, 280 * p, 160 * p, 0.2 * v, 'sawtooth'); tone(t + 0.3, 0.3, 240 * p, 140 * p, 0.15 * v, 'sawtooth'); break;
      case 'magma_cube': tone(t, 0.12, 140 * p, 70 * p, 0.3 * v, 'sine'); noise(t, 0.1, 400, 2, 0.15 * v); break;
      case 'mooshroom': tone(t, 0.6, 140 * p, 110 * p, 0.25 * v, 'sawtooth'); break;
      case 'enderman': tone(t, 0.6, 90, 60, 0.2 * v, 'sawtooth'); tone(t, 0.6, 93, 50, 0.2 * v, 'sawtooth'); break;
      default: tone(t, 0.2, 200 * p, 150 * p, 0.15 * v, 'sawtooth');
    }
  },
};
// ---------- music (menu + in-game background) & jukebox records, streamed ----------
export const RECORDS = ['13', 'cat', 'blocks', 'chirp', 'far', 'mall', 'mellohi', 'stal', 'strad', 'ward', '11', 'wait'];
const TRACKS = ['menu1', 'menu2', 'menu3', 'menu4'];
const url = p => new URL('../../sounds/' + p + '.ogg', import.meta.url).href;
export const Music = {
  el: null, mode: null, unlocked: false, wait: 0, rec: null, recGain: 1,
  unlock() { if (this.unlocked) return; this.unlocked = true; if (this.mode === 'menu' && !this.el) this.next(); },
  refresh() { if (this.el) this.el.volume = Math.min(1, vol.sound * vol.music * 0.5 * (this.rec ? 0 : 1)); if (this.rec) this.rec.el.volume = Math.max(0, Math.min(1, vol.sound * vol.records * this.recGain)); },
  // 'menu': loops tracks; 'game': plays a track now and then; null: silence
  setMode(m) { if (m === this.mode) return; this.mode = m; this.stopTrack(); this.wait = m === 'game' ? 600 + Math.random() * 1800 : 0; if (m === 'menu') this.next(); },
  stopTrack() { if (this.el) { this.el.pause(); this.el.src = ''; this.el = null; } },
  next() { if (!this.unlocked || !this.mode) return; this.stopTrack(); const a = new Audio(url('music/' + TRACKS[(Math.random() * TRACKS.length) | 0])); this.el = a; this.refresh();
    a.onended = () => { if (this.el !== a) return; this.el = null; if (this.mode === 'menu') this.next(); else this.wait = 1200 + Math.random() * 3600; }; a.play().catch(() => {}); },
  // called once per game tick
  tick() { if (this.mode === 'game' && !this.el && this.unlocked && --this.wait <= 0) this.next(); },
  playRecord(name, pos) { this.stopRecord(); const el = new Audio(url('records/' + name)); this.rec = { el, name, pos }; this.recGain = 1; this.refresh(); el.onended = () => { if (this.rec && this.rec.el === el) this.stopRecord(); }; el.play().catch(() => {}); },
  stopRecord() { if (this.rec) { this.rec.el.pause(); this.rec.el.src = ''; this.rec = null; } this.refresh(); },
  // fade a playing record by distance from the listener
  listen(x, y, z) { if (!this.rec) return; const p = this.rec.pos; const d = Math.hypot(p.x + 0.5 - x, p.y + 0.5 - y, p.z + 0.5 - z); this.recGain = Math.max(0, 1 - d / 64) ** 1.5; this.refresh(); },
};
