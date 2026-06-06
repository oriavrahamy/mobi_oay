/* ═══════════ STORE — IndexedDB persistence ═══════════ */
const Store = (() => {
  const DB_NAME = 'MobiOAY';
  const DB_VER = 1;
  let db = null;

  function open() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = e => {
        const d = e.target.result;
        if (!d.objectStoreNames.contains('agents')) d.createObjectStore('agents', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('tools')) d.createObjectStore('tools', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('memory')) d.createObjectStore('memory', { keyPath: 'id', autoIncrement: true });
      };
      req.onsuccess = e => { db = e.target.result; resolve(db); };
      req.onerror = e => reject(e.target.error);
    });
  }

  function tx(store, mode = 'readonly') {
    return db.transaction(store, mode).objectStore(store);
  }

  function promisify(req) {
    return new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });
  }

  async function getAll(store) { return promisify(tx(store).getAll()); }
  async function get(store, id) { return promisify(tx(store).get(id)); }
  async function put(store, obj) { return promisify(tx(store, 'readwrite').put(obj)); }
  async function del(store, id) { return promisify(tx(store, 'readwrite').delete(id)); }
  async function clear(store) { return promisify(tx(store, 'readwrite').clear()); }

  return {
    init: open,
    getAgents: () => getAll('agents'),
    getAgent: id => get('agents', id),
    saveAgent: agent => put('agents', agent),
    deleteAgent: id => del('agents', id),
    getTools: () => getAll('tools'),
    saveTool: tool => put('tools', tool),
    getMemory: () => getAll('memory'),
    addMemory: entry => put('memory', { ...entry, id: Date.now() + Math.random() }),
    clearMemory: () => clear('memory'),
  };
})();
