// Key bindings: action -> KeyboardEvent.code (or 'Mouse0'..'Mouse4' for mouse buttons), saved in settings.keys
export const BINDS = [['forward', 'Forward', 'KeyW'], ['left', 'Left', 'KeyA'], ['back', 'Back', 'KeyS'], ['right', 'Right', 'KeyD'], ['jump', 'Jump', 'Space'], ['sneak', 'Sneak', 'ShiftLeft'],
  ['drop', 'Drop', 'KeyQ'], ['inventory', 'Inventory', 'KeyE'], ['chat', 'Chat', 'KeyT'], ['players', 'List Players', 'Tab'], ['pick', 'Pick Block', 'Mouse1'], ['sprint', 'Sprint', 'ControlLeft']];
const DEF = Object.fromEntries(BINDS.map(([a, , c]) => [a, c]));
let custom = {};
export function setBindings(keys) { custom = keys || {}; }
export function bound(action) { return custom[action] || DEF[action]; }
// is this event code the key for the action? (sneak/sprint also accept the right-hand modifier when left is bound)
export function is(action, code) { const b = bound(action); if (code === b) return true;
  return (b === 'ShiftLeft' && code === 'ShiftRight') || (b === 'ControlLeft' && code === 'ControlRight'); }
export function held(action, keys) { const b = bound(action); return !!(keys[b] || (b === 'ShiftLeft' && keys.ShiftRight) || (b === 'ControlLeft' && keys.ControlRight)); }
const NAMES = { Space: 'SPACE', ShiftLeft: 'LSHIFT', ShiftRight: 'RSHIFT', ControlLeft: 'LCONTROL', ControlRight: 'RCONTROL', AltLeft: 'LMENU', AltRight: 'RMENU', Tab: 'TAB', Enter: 'RETURN',
  Backspace: 'BACK', CapsLock: 'CAPITAL', ArrowUp: 'UP', ArrowDown: 'DOWN', ArrowLeft: 'LEFT', ArrowRight: 'RIGHT', Minus: 'MINUS', Equal: 'EQUALS', BracketLeft: 'LBRACKET', BracketRight: 'RBRACKET',
  Semicolon: 'SEMICOLON', Quote: 'APOSTROPHE', Backquote: 'GRAVE', Backslash: 'BACKSLASH', Comma: 'COMMA', Period: 'PERIOD', Slash: 'SLASH', MetaLeft: 'LMETA', MetaRight: 'RMETA', Insert: 'INSERT',
  Delete: 'DELETE', Home: 'HOME', End: 'END', PageUp: 'PRIOR', PageDown: 'NEXT' };
export function keyName(code) {
  if (!code) return 'NONE'; if (NAMES[code]) return NAMES[code];
  let m = code.match(/^Key([A-Z])$/) || code.match(/^Digit(\d)$/); if (m) return m[1];
  if ((m = code.match(/^Mouse(\d)$/))) return 'BUTTON' + (+m[1] + 1);
  if ((m = code.match(/^Numpad(.+)$/))) return 'NUMPAD' + m[1].toUpperCase();
  return code.toUpperCase();
}
