import { loadPack } from './engine/pack.js';
await loadPack();
const { Game } = await import('./game.js');
window.game = new Game();
