import { SAVE_VERSION, type GameState } from '../game/logic/game';

/** Minimal IndexedDB key/value wrapper — the whole game is one save slot. */
const DB_NAME = 'tiem-vang-dai-gia';
const STORE = 'saves';
const SLOT = 'slot-1';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export async function saveGame(state: GameState): Promise<void> {
  await run('readwrite', (s) => s.put({ savedAt: Date.now(), state }, SLOT));
}

export async function loadGame(): Promise<GameState | null> {
  try {
    const rec = await run<{ state: GameState } | undefined>('readonly', (s) => s.get(SLOT));
    if (!rec?.state || rec.state.version !== SAVE_VERSION) return null;
    return rec.state;
  } catch {
    return null;
  }
}

export async function clearSave(): Promise<void> {
  await run('readwrite', (s) => s.delete(SLOT));
}
