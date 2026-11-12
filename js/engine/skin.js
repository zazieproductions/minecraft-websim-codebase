// Player skins: the local player's chosen skin (kept in localStorage as a small PNG data URL) and
// a texture cache shared by the local Steve model, the first-person hand and other players in multiplayer.
import { steveSkinTexture, defaultSteveTexture } from '../entity/models.js';

const KEY = 'mc125.skin';
const EARS_KEY = KEY + '.deadmau5';
const cache = new Map(); // dataUrl -> Promise<THREE.Texture>
const listeners = new Set();

function loadImage(src) { return new Promise((res, rej) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => res(i); i.onerror = () => rej(new Error('Could not load that skin')); i.src = src; }); }
// re-encode at 64px wide so the skin is small enough to send to other players
function normalize(img) {
  const w = img.naturalWidth, h = img.naturalHeight;
  if (w < 64 || w % 64 || !(h === w || h * 2 === w)) throw new Error('Skins must be 64x32 or 64x64');
  const cv = document.createElement('canvas'); cv.width = 64; cv.height = h * 64 / w; const c = cv.getContext('2d'); c.imageSmoothingEnabled = false;
  c.drawImage(img, 0, 0, cv.width, cv.height); return cv.toDataURL('image/png');
}
export const isSkinData = s => typeof s === 'string' && s.startsWith('data:image/png;base64,') && s.length < 24000;

export const Skins = {
  get current() { const s = localStorage.getItem(KEY); return isSkinData(s) ? s : null; },
  get hasDeadmau5Ears() { return localStorage.getItem(EARS_KEY) === '1'; },
  set(dataUrl, deadmau5 = false) { if (dataUrl) localStorage.setItem(KEY, dataUrl); else localStorage.removeItem(KEY); localStorage.setItem(EARS_KEY, dataUrl && deadmau5 ? '1' : '0'); for (const f of listeners) f(dataUrl, !!dataUrl && deadmau5); },
  onChange(f) { listeners.add(f); return () => listeners.delete(f); },
  async fromFile(file) { const url = URL.createObjectURL(file); try { return normalize(await loadImage(url)); } finally { URL.revokeObjectURL(url); } },
  async fromUsername(name) { name = String(name).trim(); if (!/^[A-Za-z0-9_]{1,16}$/.test(name)) throw new Error('Not a valid Minecraft username');
    return normalize(await loadImage('https://mc-heads.net/skin/' + encodeURIComponent(name))); },
  texture(dataUrl) {
    if (!isSkinData(dataUrl)) return Promise.resolve(defaultSteveTexture());
    let p = cache.get(dataUrl); if (!p) { p = loadImage(dataUrl).then(steveSkinTexture).catch(() => defaultSteveTexture()); cache.set(dataUrl, p); }
    return p;
  },
  // point a model material at a skin; stale loads (skin changed again meanwhile) are ignored
  apply(mat, dataUrl) { const tok = mat.userData.skinTok = (mat.userData.skinTok || 0) + 1;
    return this.texture(dataUrl).then(t => { if (mat.userData.skinTok !== tok) return; mat.map = t; mat.needsUpdate = true; }); },
};
