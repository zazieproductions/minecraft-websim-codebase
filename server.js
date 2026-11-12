// Multiplayer backend: hosts named servers (e.g. "wsimmc") inside the project's single realtime room.
// Each server shares a world seed; player block edits are kept in memory and persisted to env.DB.

const SERVERS = {
  wsimmc: { name: 'Websim SMP', motd: 'Build, explore, and play together', seed: 1337420, max: 50, gamemode: 0, pvp: true },
  '3b3t': { name: '3b3t', motd: 'Anarchy. Survive if you can.', seed: 1337422, max: 50, gamemode: 0, pvp: true },
  wscrtv: { name: 'Websim Creative', motd: 'Build freely with unlimited resources', seed: 1337421, max: 50, gamemode: 1, pvp: false },
  creative: { name: 'Websim Creative', motd: 'Build freely with unlimited resources', seed: 1337421, max: 50, gamemode: 1, pvp: false },
  lowvoxel: { name: 'LowVoxel Network', motd: 'Spleef, Parkour & PvP minigames', seed: 4242, max: 100, gamemode: 0, pvp: true, network: 'lowvoxel' },
};
// ---- LowVoxel network: geometry shared with js/network/lowvoxel.js ----
const LV_Y = 64;
const LV = { spleef: { x0: -9, x1: 9, z0: -59, z1: -41, floor: LV_Y + 6, cx: 0, cz: -50 }, pvp: { x0: -50, x1: -32, z0: -9, z1: 9, y0: LV_Y - 3, y1: LV_Y + 0.5 } };
const inBox = (b, x, y, z) => x >= b.x0 && x <= b.x1 + 1 && z >= b.z0 && z <= b.z1 + 1 && y >= b.y0 && y <= b.y1;
const RANKS = [[25, 'MVP+', 'b'], [10, 'MVP', 'b'], [3, 'VIP', 'a']];
const rankOf = st => { for (const [n, r, c] of RANKS) if ((st.spleef_wins || 0) >= n) return { rank: r, color: c }; return { rank: '', color: '7' }; };
function sendOne(room, id, msg) { room.broadcast(msg, { except: [...players.keys()].filter(k => k !== id) }); }
const lvState = new Map(); // server -> spleef state
function spleefOf(name) { let s = lvState.get(name); if (!s) lvState.set(name, s = { phase: 'idle', queue: new Set(), alive: new Set(), t: 0, edits: new Set(), round: 0 }); return s; }
function spleefPublic(room, name) { const s = spleefOf(name); const nm = id => players.get(id)?.name; return { type: 'spleef', phase: s.phase, queue: [...s.queue].map(nm).filter(Boolean), alive: [...s.alive].map(nm).filter(Boolean), t: s.t, round: s.round }; }
async function lvSave(env, p) { if (!p.persist || !p.stats) return; const st = p.stats;
  await env.DB.prepare('INSERT INTO lv_stats (user_id, name, coins, spleef_wins, spleef_games, parkour_ms) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET name = excluded.name, coins = excluded.coins, spleef_wins = excluded.spleef_wins, spleef_games = excluded.spleef_games, parkour_ms = excluded.parkour_ms')
    .bind(p.userId, p.name, st.coins, st.spleef_wins, st.spleef_games, st.parkour_ms).run(); }
async function lvBoards(env) {
  const wins = await env.DB.prepare('SELECT name, spleef_wins AS v FROM lv_stats WHERE spleef_wins > 0 ORDER BY spleef_wins DESC LIMIT 5').all();
  const pk = await env.DB.prepare('SELECT name, parkour_ms AS v FROM lv_stats WHERE parkour_ms > 0 ORDER BY parkour_ms ASC LIMIT 5').all();
  return { type: 'lv_boards', spleef: wins.results, parkour: pk.results };
}
const lvPub = p => ({ coins: p.stats.coins, spleef_wins: p.stats.spleef_wins, spleef_games: p.stats.spleef_games, parkour_ms: p.stats.parkour_ms, ...rankOf(p.stats) });
async function spleefReset(room, name) { const s = spleefOf(name), w = worlds.get(name);
  if (w) for (const k of s.edits) w.edits.delete(k); s.edits.clear(); s.alive.clear(); s.phase = 'idle'; s.t = Date.now() + 4000;
  sendTo(room, name, { type: 'spleef_reset' }); sendTo(room, name, spleefPublic(room, name)); }
async function spleefTick(room, env, name) {
  const s = spleefOf(name), now = Date.now();
  for (const id of [...s.queue]) if (!players.has(id) || players.get(id).server !== name) s.queue.delete(id);
  if (s.phase === 'idle') { if (now >= s.t && s.queue.size >= 2) { s.phase = 'countdown'; s.t = now + 10000; sendTo(room, name, spleefPublic(room, name)); } return; }
  if (s.phase === 'countdown') {
    if (s.queue.size < 2) { s.phase = 'idle'; sendTo(room, name, spleefPublic(room, name)); return; }
    if (now < s.t) return;
    s.phase = 'playing'; s.round++; s.t = now + 180000; s.alive = new Set(s.queue); s.queue.clear();
    const ids = [...s.alive], A = LV.spleef; const spots = {};
    ids.forEach((id, i) => { const a = i / ids.length * Math.PI * 2; spots[id] = [A.cx + 0.5 + Math.cos(a) * 6, A.floor + 1, A.cz + 0.5 + Math.sin(a) * 6]; const p = players.get(id); if (p) { p.stats.spleef_games++; p.stats.coins += 10; p.spleefGrace = now + 2500; } });
    sendTo(room, name, { type: 'spleef_start', spots, round: s.round }); sendTo(room, name, spleefPublic(room, name));
    for (const id of ids) { const p = players.get(id); if (p) { await lvSave(env, p); sendOne(room, id, { type: 'lv_stats', stats: lvPub(p) }); } }
    return;
  }
  // playing: anyone below the floor is out
  for (const id of [...s.alive]) { const p = players.get(id);
    if (!p || p.server !== name || (now > (p.spleefGrace || 0) && (p.y < LV.spleef.floor - 0.2 || !inBox({ ...LV.spleef, y0: -1e9, y1: 1e9 }, p.x, p.y, p.z)))) {
      s.alive.delete(id); if (p) sendTo(room, name, { type: 'spleef_out', id, name: p.name, left: s.alive.size }); } }
  if (s.alive.size <= 1 || now > s.t) {
    const wid = s.alive.size === 1 ? [...s.alive][0] : null, wp = wid && players.get(wid);
    if (wp) { wp.stats.spleef_wins++; wp.stats.coins += 100; await lvSave(env, wp); sendOne(room, wid, { type: 'lv_stats', stats: lvPub(wp) }); sendTo(room, name, { type: 'spleef_win', id: wid, name: wp.name, rank: rankOf(wp.stats) }); sendTo(room, name, await lvBoards(env)); }
    else sendTo(room, name, { type: 'spleef_win', id: null, name: null });
    await spleefReset(room, name);
  }
}
const WEAPON_DAMAGE = { 268: 4, 272: 5, 267: 6, 276: 7, 283: 4, 269: 1, 273: 2, 256: 3, 277: 4, 284: 1, 270: 2, 274: 3, 257: 4, 278: 5, 285: 2, 271: 3, 275: 4, 258: 5, 279: 6, 286: 3 };
const REACH = 9; // max distance from a player to a block they edit

export const schema = `
  CREATE TABLE IF NOT EXISTS edits (server TEXT NOT NULL, x INTEGER NOT NULL, y INTEGER NOT NULL, z INTEGER NOT NULL, id INTEGER NOT NULL, meta INTEGER NOT NULL, user_id TEXT, PRIMARY KEY (server, x, y, z));
  CREATE TABLE IF NOT EXISTS item_drops (server TEXT NOT NULL, drop_id TEXT NOT NULL, x REAL NOT NULL, y REAL NOT NULL, z REAL NOT NULL, mx REAL NOT NULL, my REAL NOT NULL, mz REAL NOT NULL, item_id INTEGER NOT NULL, count INTEGER NOT NULL, dmg INTEGER NOT NULL, created INTEGER NOT NULL, user_id TEXT NOT NULL, PRIMARY KEY (server, drop_id));
  CREATE TABLE IF NOT EXISTS status (server TEXT PRIMARY KEY, online INTEGER NOT NULL DEFAULT 0, names TEXT, updated INTEGER);
  CREATE TABLE IF NOT EXISTS lv_stats (user_id TEXT PRIMARY KEY, name TEXT NOT NULL, coins INTEGER NOT NULL DEFAULT 0, spleef_wins INTEGER NOT NULL DEFAULT 0, spleef_games INTEGER NOT NULL DEFAULT 0, parkour_ms INTEGER NOT NULL DEFAULT 0);
  CREATE TABLE IF NOT EXISTS hosted_servers (server TEXT PRIMARY KEY, name TEXT NOT NULL, motd TEXT NOT NULL, seed INTEGER NOT NULL, max INTEGER NOT NULL, gamemode INTEGER NOT NULL DEFAULT 0, user_id TEXT NOT NULL, created INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS ai_lessons (user_id TEXT NOT NULL, pattern TEXT NOT NULL, good_count INTEGER NOT NULL DEFAULT 0, bad_count INTEGER NOT NULL DEFAULT 0, updated INTEGER NOT NULL, PRIMARY KEY (user_id, pattern));
  CREATE TABLE IF NOT EXISTS ai_lesson_events (user_id TEXT NOT NULL, batch_id TEXT NOT NULL, pattern TEXT NOT NULL, outcome TEXT NOT NULL, created INTEGER NOT NULL, PRIMARY KEY (user_id, batch_id, pattern, outcome));
  CREATE TABLE IF NOT EXISTS ai_lesson_images (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, pattern TEXT NOT NULL, outcome TEXT NOT NULL, image_url TEXT NOT NULL, created INTEGER NOT NULL);
  CREATE UNIQUE INDEX IF NOT EXISTS ai_lesson_images_owner_pattern_outcome ON ai_lesson_images (user_id, pattern, outcome);
`;

const players = new Map(); // conn.id -> { id, name, server, x, y, z, yaw, pitch, sneak, held, dirty }
const worlds = new Map();  // server -> persisted blocks and live item drops
const DROP_TTL = 300000;
const publicDrop = d => ({ dropId: d.dropId, x: d.x, y: d.y, z: d.z, mx: d.mx, my: d.my, mz: d.mz, itemId: d.itemId, count: d.count, dmg: d.dmg, created: d.created });
function persistDrop(w, write) { const next = (w.dropWrites || Promise.resolve()).then(write); w.dropWrites = next.catch(() => {}); return next; }
const dropReachable = (p, d, x, y, z) => num(x) && num(y) && num(z) && Math.abs(x - d.x) <= 8 && Math.abs(z - d.z) <= 8 && y <= d.y + 2 && y >= d.y - 64 && Math.abs(p.x - x) <= 2 && Math.abs(p.z - z) <= 2 && y >= p.y - 0.5 && y <= p.y + 2.3;

async function loadWorld(name, env) {
  let w = worlds.get(name);
  if (!w) {
    w = { edits: new Map(), drops: new Map() };
    w.loading = (async () => {
      const { results } = await env.DB.prepare('SELECT x, y, z, id, meta FROM edits WHERE server = ?').bind(name).all();
      for (const r of results) { const k = r.x + ',' + r.y + ',' + r.z; if (!w.edits.has(k)) w.edits.set(k, [r.x, r.y, r.z, r.id, r.meta]); }
      const now = Date.now();
      const saved = await env.DB.prepare('SELECT drop_id, x, y, z, mx, my, mz, item_id, count, dmg, created, user_id FROM item_drops WHERE server = ?').bind(name).all();
      for (const r of saved.results) if (now - r.created < DROP_TTL) w.drops.set(r.drop_id, { dropId: r.drop_id, x: r.x, y: r.y, z: r.z, mx: r.mx, my: r.my, mz: r.mz, itemId: r.item_id, count: r.count, dmg: r.dmg, created: r.created, userId: r.user_id });
      await env.DB.prepare('DELETE FROM item_drops WHERE server = ? AND created <= ?').bind(name, now - DROP_TTL).run();
    })();
    worlds.set(name, w);
  }
  await w.loading; return w;
}
async function serverConfig(name, env) {
  if (SERVERS[name]) return SERVERS[name];
  for (let attempt = 0; attempt < 4; attempt++) {
    const row = await env.DB.prepare('SELECT name, motd, seed, max, gamemode FROM hosted_servers WHERE server = ?').bind(name).first();
    if (row) return { ...row, hosted: true };
    if (!name.startsWith('host-')) break;
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  return null;
}
const inServer = name => [...players.values()].filter(p => p.server === name);
function sendTo(room, name, msg, except) { const ids = inServer(name).filter(p => p.id !== except).map(p => p.id); if (!ids.length) return;
  const others = [...players.keys()].filter(id => !ids.includes(id)); room.broadcast(msg, { except: others.concat(except ? [except] : []) }); }
async function writeStatus(name, env) { const ps = inServer(name);
  await env.DB.prepare('INSERT INTO status (server, online, names, updated) VALUES (?, ?, ?, ?) ON CONFLICT(server) DO UPDATE SET online = excluded.online, names = excluded.names, updated = excluded.updated')
    .bind(name, ps.length, JSON.stringify(ps.map(p => p.name).slice(0, 20)), Date.now()).run(); }
const num = v => typeof v === 'number' && Number.isFinite(v);
const skinOf = s => typeof s === 'string' && s.startsWith('data:image/png;base64,') && s.length < 24000 && /^[A-Za-z0-9+/=]+$/.test(s.slice(22)) ? s : null;
const pub = p => ({ id: p.id, name: p.name, x: p.x, y: p.y, z: p.z, yaw: p.yaw, pitch: p.pitch, sneak: p.sneak, held: p.held, skin: p.skin, ...(p.stats ? rankOf(p.stats) : {}) });

export const room = {
  tickMs: 100,
  async onConnect(conn) { conn.send({ type: 'hi' }); },
  async onMessage(conn, message, room, env) {
    let m; try { m = JSON.parse(message); } catch { return; }
    const me = players.get(conn.id);
    if (m.type === 'hello') {
      if (me) return;
      const name = String(m.server || '').trim().toLowerCase(); const cfg = await serverConfig(name, env);
      if (!cfg) { conn.send({ type: 'kick', reason: 'Unknown host' }); return; }
      if (inServer(name).length >= cfg.max) { conn.send({ type: 'kick', reason: 'The server is full!' }); return; }
      const w = await loadWorld(name, env);
      let pname = conn.username || ('Guest' + String(conn.id).replace(/\W/g, '').slice(-4));
      while (inServer(name).some(p => p.name === pname)) pname += '_';
      const pvp = cfg.pvp ?? cfg.gamemode === 0;
      const p = { id: conn.id, name: pname, server: name, x: 0, y: -100, z: 0, yaw: 0, pitch: 0, sneak: false, held: -1, armor: 0, hp: 20, armorCarry: 0, hurtUntil: 0, attackUntil: 0, pvp, skin: skinOf(m.skin), dirty: false, persist: conn.identity === 'user', userId: conn.userId };
      if (cfg.network) { p.network = cfg.network; p.pvp = false; p.stats = { coins: 0, spleef_wins: 0, spleef_games: 0, parkour_ms: 0 };
        if (p.persist) { const row = await env.DB.prepare('SELECT coins, spleef_wins, spleef_games, parkour_ms FROM lv_stats WHERE user_id = ?').bind(p.userId).first(); if (row) Object.assign(p.stats, row); } }
      players.set(conn.id, p);
      const othersFull = inServer(name).filter(o => o.id !== conn.id); const others = othersFull.map(o => ({ ...pub(o), skin: null }));
      conn.send({ type: 'welcome', id: conn.id, name: pname, server: name, serverName: cfg.name, motd: cfg.motd, seed: cfg.seed, gamemode: cfg.gamemode, pvp, hosted: !!cfg.hosted, now: Date.now(), players: others, editCount: w.edits.size, network: cfg.network || null, stats: p.stats ? lvPub(p) : null });
      const all = [...w.edits.values()];
      for (let i = 0; i < all.length; i += 2000) conn.send({ type: 'edits', list: all.slice(i, i + 2000) });
      const drops = [...w.drops.values()].map(publicDrop);
      for (let i = 0; i < drops.length; i += 200) conn.send({ type: 'drops', list: drops.slice(i, i + 200) });
      for (const o of othersFull) if (o.skin) conn.send({ type: 'skin', id: o.id, skin: o.skin }); // one per message: skins are a few KB each
      if (cfg.network) { conn.send(await lvBoards(env)); conn.send(spleefPublic(room, name)); }
      conn.send({ type: 'ready' });
      sendTo(room, name, { type: 'join', player: pub(p) }, conn.id);
      await writeStatus(name, env);
      return;
    }
    if (!me) return;
    if (m.type === 'pos') {
      if (![m.x, m.y, m.z, m.yaw, m.pitch].every(num)) return;
      if (Math.abs(m.x) > 3e7 || Math.abs(m.z) > 3e7 || Math.abs(m.y) > 1000) return;
      me.x = m.x; me.y = m.y; me.z = m.z; me.yaw = m.yaw; me.pitch = m.pitch; me.sneak = !!m.sneak; me.held = Number.isInteger(m.held) ? m.held : -1; if (Number.isInteger(m.armor) && m.armor >= 0 && m.armor <= 20) me.armor = m.armor; me.dirty = true;
    } else if (m.type === 'block') {
      const { x, y, z, id, meta } = m;
      if (![x, y, z, id, meta].every(Number.isInteger) || y < 0 || y > 127 || id < 0 || id > 255 || meta < 0 || meta > 15) return;
      if (Math.hypot(x + 0.5 - me.x, y + 0.5 - (me.y + 1.6), z + 0.5 - me.z) > REACH) return;
      if (me.network) { // the lobby is protected: only spleef players may dig the arena floor during a round
        const s = spleefOf(me.server), A = LV.spleef;
        if (s.phase !== 'playing' || !s.alive.has(me.id) || id !== 0 || y !== A.floor || x < A.x0 || x > A.x1 || z < A.z0 || z > A.z1) return;
        const k = x + ',' + y + ',' + z; s.edits.add(k); worlds.get(me.server).edits.set(k, [x, y, z, 0, 0]); sendTo(room, me.server, { type: 'block', e: [x, y, z, 0, 0], by: me.id }, conn.id); return; }
      const w = worlds.get(me.server); const e = [x, y, z, id, meta]; w.edits.set(x + ',' + y + ',' + z, e);
      sendTo(room, me.server, { type: 'block', e, by: me.id }, conn.id);
      if (me.persist) await env.DB.prepare('INSERT INTO edits (server, x, y, z, id, meta, user_id) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(server, x, y, z) DO UPDATE SET id = excluded.id, meta = excluded.meta, user_id = excluded.user_id')
        .bind(me.server, x, y, z, id, meta, me.userId).run();
    } else if (m.type === 'drop') {
      const { x, y, z, mx, my, mz, itemId, count, dmg } = m;
      if (me.network) return;
      if (![x, y, z, mx, my, mz].every(num) || ![itemId, count, dmg].every(Number.isInteger)) return;
      if (x < -3e7 || x > 3e7 || z < -3e7 || z > 3e7 || y < 0 || y > 127 || itemId < 1 || itemId > 383 || count < 1 || count > 64 || dmg < 0 || dmg > 32767 || Math.abs(mx) > 0.6 || Math.abs(my) > 0.6 || Math.abs(mz) > 0.6) return;
      if (Math.hypot(x - me.x, y - (me.y + 1.3), z - me.z) > REACH + 3) return;
      const w = worlds.get(me.server), d = { dropId: crypto.randomUUID(), x, y, z, mx, my, mz, itemId, count, dmg, created: Date.now(), userId: me.persist ? me.userId : null, owner: me.id };
      w.drops.set(d.dropId, d);
      if (me.persist) await persistDrop(w, () => env.DB.prepare('INSERT INTO item_drops (server, drop_id, x, y, z, mx, my, mz, item_id, count, dmg, created, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .bind(me.server, d.dropId, x, y, z, mx, my, mz, itemId, count, dmg, d.created, me.userId).run());
      sendTo(room, me.server, { type: 'drop', e: publicDrop(d) });
    } else if (m.type === 'pickup') {
      const w = worlds.get(me.server), dropId = String(m.dropId || ''), d = w.drops.get(dropId);
      if (!d || !Number.isInteger(m.count) || m.count < 1 || !dropReachable(me, d, m.x, m.y, m.z)) { conn.send({ type: 'pickup_result', dropId, accepted: 0 }); return; }
      const accepted = Math.min(m.count, d.count); d.count -= accepted;
      if (!d.count) w.drops.delete(dropId);
      if (d.userId) await persistDrop(w, () => d.count
        ? env.DB.prepare('UPDATE item_drops SET count = ? WHERE server = ? AND drop_id = ?').bind(d.count, me.server, dropId).run()
        : env.DB.prepare('DELETE FROM item_drops WHERE server = ? AND drop_id = ?').bind(me.server, dropId).run());
      sendTo(room, me.server, { type: 'pickup', dropId, by: me.id, accepted, itemId: d.itemId, dmg: d.dmg, remaining: d.count });
    } else if (m.type === 'drop_remove') {
      const w = worlds.get(me.server), dropId = String(m.dropId || ''), d = w.drops.get(dropId);
      if (!d) return;
      if (d.owner !== me.id || !dropReachable(me, d, m.x, m.y, m.z)) { conn.send({ type: 'drop_state', e: publicDrop(d) }); return; }
      w.drops.delete(dropId);
      if (d.userId) await persistDrop(w, () => env.DB.prepare('DELETE FROM item_drops WHERE server = ? AND drop_id = ?').bind(me.server, dropId).run());
      sendTo(room, me.server, { type: 'drop_remove', dropId });
    } else if (m.type === 'hit') {
      const target = players.get(String(m.id || ''));
      if (!target || target.server !== me.server || me.hp <= 0 || target.hp <= 0) return;
      if (me.network ? !(inBox(LV.pvp, me.x, me.y, me.z) && inBox(LV.pvp, target.x, target.y, target.z)) : (!me.pvp || !target.pvp)) return;
      const dx = target.x - me.x, dy = target.y + 0.9 - (me.y + 1.62), dz = target.z - me.z, dist = Math.hypot(dx, dy, dz);
      if (dist > 4.1 || dist < 0.01) return;
      const aimX = -Math.sin(me.yaw) * Math.cos(me.pitch), aimY = Math.sin(me.pitch), aimZ = -Math.cos(me.yaw) * Math.cos(me.pitch);
      if ((dx * aimX + dy * aimY + dz * aimZ) / dist < 0.45) return;
      const now = Date.now(); if (now < me.attackUntil || now < target.hurtUntil) return;
      me.attackUntil = now + 450; target.hurtUntil = now + 500;
      const raw = WEAPON_DAMAGE[me.held] || 1, scaled = raw * (25 - target.armor) + target.armorCarry;
      const damage = Math.floor(scaled / 25); target.armorCarry = scaled % 25; target.hp = Math.max(0, target.hp - damage);
      const flat = Math.hypot(dx, dz) || 1;
      sendTo(room, me.server, { type: 'pvp_hit', attacker: me.id, target: target.id, damage, hp: target.hp, kx: dx / flat * 0.36, kz: dz / flat * 0.36 });
      if (me.network && target.hp <= 0) { me.stats.coins += 5; sendTo(room, me.server, { type: 'lv_kill', killer: me.name, victim: target.name }); conn.send({ type: 'lv_stats', stats: lvPub(me) }); await lvSave(env, me); }
    } else if (m.type === 'respawn') {
      if (me.hp <= 0) { me.hp = 20; me.armor = 0; me.armorCarry = 0; me.hurtUntil = Date.now() + 1000; me.attackUntil = Date.now() + 1000; }
    } else if (m.type === 'skin') {
      me.skin = skinOf(m.skin); sendTo(room, me.server, { type: 'skin', id: me.id, skin: me.skin }, conn.id);
    } else if (m.type === 'swing') {
      sendTo(room, me.server, { type: 'swing', id: me.id }, conn.id);
    } else if (m.type === 'chat') {
      const text = room.censor(String(m.text ?? '')).replace(/[\u0000-\u001f]/g, '').slice(0, 100).trim();
      if (text) sendTo(room, me.server, { type: 'chat', from: me.name, text, me: !!m.me, ...(me.stats ? rankOf(me.stats) : {}) });
    } else if (m.type === 'lv' && me.network) {
      const s = spleefOf(me.server);
      if (m.action === 'spleef_join') { if (s.phase === 'playing' && s.alive.has(me.id)) return; s.queue.add(me.id); sendTo(room, me.server, spleefPublic(room, me.server)); }
      else if (m.action === 'spleef_leave') { s.queue.delete(me.id); if (s.alive.delete(me.id)) sendTo(room, me.server, { type: 'spleef_out', id: me.id, name: me.name, left: s.alive.size }); sendTo(room, me.server, spleefPublic(room, me.server)); }
      else if (m.action === 'parkour' && Number.isInteger(m.ms) && m.ms >= 12000 && m.ms < 3600000) {
        const st = me.stats, best = !st.parkour_ms || m.ms < st.parkour_ms; if (!me.parkourDone) { st.coins += 25; me.parkourDone = true; } if (best) { st.parkour_ms = m.ms; st.coins += 25; }
        sendTo(room, me.server, { type: 'lv_parkour', name: me.name, ms: m.ms, best }); await lvSave(env, me); conn.send({ type: 'lv_stats', stats: lvPub(me) }); if (best) sendTo(room, me.server, await lvBoards(env));
      }
    }
  },
  async onTick(room, env) {
    const now = Date.now();
    for (const [name, w] of worlds) for (const [id, d] of w.drops) if (now - d.created >= DROP_TTL) {
      w.drops.delete(id);
      if (d.userId) await persistDrop(w, () => env.DB.prepare('DELETE FROM item_drops WHERE server = ? AND drop_id = ?').bind(name, id).run());
      sendTo(room, name, { type: 'drop_remove', dropId: id });
    }
    const by = new Map();
    for (const p of players.values()) if (p.dirty) { p.dirty = false; (by.get(p.server) || by.set(p.server, []).get(p.server)).push([p.id, Math.round(p.x * 100) / 100, Math.round(p.y * 100) / 100, Math.round(p.z * 100) / 100, Math.round(p.yaw * 100) / 100, Math.round(p.pitch * 100) / 100, p.sneak ? 1 : 0, p.held]); }
    for (const [name, list] of by) sendTo(room, name, { type: 'snap', t: Date.now(), list });
    for (const [name, cfg] of Object.entries(SERVERS)) if (cfg.network && inServer(name).length) await spleefTick(room, env, name);
  },
  async onClose(conn, room, env) {
    const p = players.get(conn.id); if (!p) return; players.delete(conn.id);
    if (p.network) { const s = spleefOf(p.server); s.queue.delete(p.id); if (s.alive.delete(p.id)) sendTo(room, p.server, { type: 'spleef_out', id: p.id, name: p.name, left: s.alive.size }); }
    sendTo(room, p.server, { type: 'left', id: p.id, name: p.name });
    await writeStatus(p.server, env);
  },
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/api/ai/learning') {
      const lessonRows = `SELECT user_id, pattern, good_count AS good, bad_count AS bad FROM ai_lessons UNION ALL SELECT user_id, pattern, CASE WHEN outcome = 'good' THEN 1 ELSE 0 END AS good, CASE WHEN outcome = 'bad' THEN 1 ELSE 0 END AS bad FROM ai_lesson_events`;
      const { results } = await env.DB.prepare('SELECT pattern, SUM(good) AS good, SUM(bad) AS bad, COUNT(DISTINCT user_id) AS contributors FROM (' + lessonRows + ') GROUP BY pattern HAVING SUM(good + bad) >= 2 ORDER BY ABS(SUM(good) - SUM(bad)) DESC LIMIT 20').all();
      const total = await env.DB.prepare('SELECT COUNT(DISTINCT user_id) AS contributors FROM (SELECT user_id FROM ai_lessons UNION SELECT user_id FROM ai_lesson_events)').first('contributors');
      const goodImage = await env.DB.prepare("SELECT pattern, outcome, image_url FROM ai_lesson_images WHERE outcome = 'good' ORDER BY created DESC LIMIT 1").first();
      const badImage = await env.DB.prepare("SELECT pattern, outcome, image_url FROM ai_lesson_images WHERE outcome = 'bad' ORDER BY created DESC LIMIT 1").first();
      return Response.json({ lessons: results, contributors: total || 0, examples: [goodImage, badImage].filter(Boolean) });
    }
    if (request.method === 'POST' && url.pathname === '/api/ai/learning') {
      const userId = request.headers.get('x-websim-user-id');
      if (!userId) return Response.json({ error: 'Sign in to contribute AI lessons' }, { status: 401 });
      let body; try { body = await request.json(); } catch { return Response.json({ error: 'Invalid request' }, { status: 400 }); }
      body = body && typeof body === 'object' ? body : {};
      const validPattern = value => typeof value === 'string' && value.length <= 120 && /^(forward|back|left|right|jump|sprint|look-right|look-left|look-down|look-up|fast-look|slow-look|attack|eat|use|inventory|item-[a-z0-9-]{1,32})(\+(forward|back|left|right|jump|sprint|look-right|look-left|look-down|look-up|fast-look|slow-look|attack|eat|use|inventory|item-[a-z0-9-]{1,32}))*$/.test(value);
      const good = Array.isArray(body.good) ? [...new Set(body.good.filter(validPattern))].slice(0, 5) : [];
      const bad = Array.isArray(body.bad) ? [...new Set(body.bad.filter(validPattern))].slice(0, 5) : [];
      const batchId = typeof body.batchId === 'string' && /^[a-zA-Z0-9-]{1,80}$/.test(body.batchId) ? body.batchId : null;
      const validExamples = new Map();
      const examples = Array.isArray(body.examples) ? body.examples.slice(0, 10) : [];
      for (const example of examples) {
        if (!example || !validPattern(example.pattern) || !['good', 'bad'].includes(example.outcome) || !(example.outcome === 'good' ? good : bad).includes(example.pattern)) continue;
        const encoded = typeof example.image === 'string' && example.image.match(/^data:image\/jpeg;base64,([A-Za-z0-9+/]+={0,2})$/);
        if (!encoded || encoded[1].length > 120000) continue;
        const key = example.outcome + ':' + example.pattern;
        if (!validExamples.has(key)) validExamples.set(key, { ...example, base64: encoded[1] });
      }
      const imageStatements = [];
      for (const example of validExamples.values()) {
        const exists = await env.DB.prepare('SELECT id FROM ai_lesson_images WHERE user_id = ? AND pattern = ? AND outcome = ?').bind(userId, example.pattern, example.outcome).first();
        if (exists) continue;
        let bytes;
        try { bytes = Uint8Array.from(atob(example.base64), char => char.charCodeAt(0)); } catch { continue; }
        if (bytes.length < 3 || bytes.length > 90000 || bytes[0] !== 255 || bytes[1] !== 216 || bytes[2] !== 255) continue;
        const { url: imageUrl } = await env.BLOB.put('ai-learning/' + crypto.randomUUID() + '.jpg', bytes, { contentType: 'image/jpeg' });
        imageStatements.push(env.DB.prepare('INSERT INTO ai_lesson_images (user_id, pattern, outcome, image_url, created) VALUES (?, ?, ?, ?, ?)').bind(userId, example.pattern, example.outcome, imageUrl, Date.now()));
      }
      const lessons = batchId
        ? [...good.map(pattern => [pattern, 'good']), ...bad.map(pattern => [pattern, 'bad'])].map(([pattern, outcome]) => env.DB.prepare('INSERT OR IGNORE INTO ai_lesson_events (user_id, batch_id, pattern, outcome, created) VALUES (?, ?, ?, ?, ?)').bind(userId, batchId, pattern, outcome, Date.now()))
        : [...new Set([...good, ...bad])].map(pattern => env.DB.prepare('INSERT INTO ai_lessons (user_id, pattern, good_count, bad_count, updated) VALUES (?, ?, ?, ?, ?) ON CONFLICT(user_id, pattern) DO UPDATE SET good_count = good_count + excluded.good_count, bad_count = bad_count + excluded.bad_count, updated = excluded.updated').bind(userId, pattern, good.includes(pattern) ? 1 : 0, bad.includes(pattern) ? 1 : 0, Date.now()));
      if (imageStatements.length || lessons.length) await env.DB.batch([...imageStatements, ...lessons]);
      return Response.json({ ok: true, images: imageStatements.length });
    }
    if (request.method === 'GET' && url.pathname === '/api/status') {
      const name = String(url.searchParams.get('server') || '').trim().toLowerCase(); const cfg = await serverConfig(name, env);
      if (!cfg) return Response.json({ error: 'Unknown host' }, { status: 404 });
      const row = await env.DB.prepare('SELECT online FROM status WHERE server = ?').bind(name).first();
      return Response.json({ server: name, name: cfg.name, motd: cfg.motd, online: row ? row.online : 0, max: cfg.max });
    }
    if (request.method === 'POST' && url.pathname === '/api/servers') {
      const userId = request.headers.get('x-websim-user-id');
      if (!userId) return Response.json({ error: 'Sign in to host a server' }, { status: 401 });
      let body; try { body = await request.json(); } catch { return Response.json({ error: 'Invalid request' }, { status: 400 }); }
      const name = String(body.name || '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, 28);
      if (!name) return Response.json({ error: 'Enter a server name' }, { status: 400 });
      const count = await env.DB.prepare('SELECT COUNT(*) AS n FROM hosted_servers WHERE user_id = ?').bind(userId).first('n');
      if (count >= 3) return Response.json({ error: 'You can host up to 3 servers' }, { status: 429 });
      const bytes = crypto.getRandomValues(new Uint8Array(8));
      const server = 'host-' + [...bytes].map(v => v.toString(16).padStart(2, '0')).join('');
      const seedBytes = crypto.getRandomValues(new Uint32Array(1));
      await env.DB.prepare('INSERT INTO hosted_servers (server, name, motd, seed, max, gamemode, user_id, created) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .bind(server, name, 'A player-hosted world', seedBytes[0] & 0x7fffffff, 20, 0, userId, Date.now()).run();
      return Response.json({ server, name });
    }
    return new Response('Not found', { status: 404 });
  },
};
