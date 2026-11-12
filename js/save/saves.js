// IndexedDB persistence: world metadata, player data and modified chunks
let dbp = null;
function db() {
  if (dbp) return dbp;
  dbp = new Promise((res, rej) => { const r = indexedDB.open('mc125', 1);
    r.onupgradeneeded = () => { const d = r.result; d.createObjectStore('worlds', { keyPath: 'id' }); d.createObjectStore('chunks'); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  return dbp;
}
async function tx(store, mode, fn) { const d = await db(); return new Promise((res, rej) => { const t = d.transaction(store, mode); const s = t.objectStore(store); const out = fn(s); t.oncomplete = () => res(out instanceof IDBRequest ? out.result : out); t.onerror = () => rej(t.error); }); }
export const Saves = {
  async list() { const all = await tx('worlds', 'readonly', s => s.getAll()); return (all || []).sort((a, b) => b.lastPlayed - a.lastPlayed); },
  async get(id) { return tx('worlds', 'readonly', s => s.get(id)); },
  async put(w) { return tx('worlds', 'readwrite', s => s.put(w)); },
  async remove(id) {
    await tx('worlds', 'readwrite', s => s.delete(id));
    await tx('chunks', 'readwrite', s => s.delete(IDBKeyRange.bound(id + ':', id + ':\uffff')));
  },
  async rename(id, name) { const w = await this.get(id); if (w) { w.name = name; await this.put(w); } },
  chunkStore(id, dim = 0) {
    const pre = dim === -1 ? id + ':N' : id + ':';
    return {
      loadChunk: async (cx, cz) => { try { return await tx('chunks', 'readonly', s => s.get(pre + cx + ',' + cz)); } catch { return null; } },
      saveChunk: (cx, cz, data) => tx('chunks', 'readwrite', s => s.put(data, pre + cx + ',' + cz)),
    };
  },
};
