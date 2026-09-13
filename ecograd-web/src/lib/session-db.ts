import { evictedSessions } from './session-codec';
export interface StoredAnalysis { id: string; updated: number; bytes: number; text: string }
const open = () => new Promise<IDBDatabase>((resolve, reject) => {
  const request = indexedDB.open('ecograd-recovery', 1);
  request.onupgradeneeded = () => request.result.createObjectStore('sessions', { keyPath: 'id' });
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
  request.onblocked = () => reject(new Error('Armazenamento ocupado por outra aba.'));
});
export async function readAnalysis(id: string): Promise<StoredAnalysis | undefined> {
  const db = await open();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('sessions', 'readonly');
      const request = tx.objectStore('sessions').get(id);
      tx.oncomplete = () => resolve(request.result);
      tx.onabort = tx.onerror = () => reject(tx.error);
    });
  } finally { db.close(); }
}
/** Single transaction: replace the tab's snapshot and evict expired/LRU snapshots atomically. */
export async function writeAnalysis(id: string, value?: StoredAnalysis) {
  const db = await open();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('sessions', 'readwrite');
      const store = tx.objectStore('sessions');
      const all = store.getAll();
      all.onsuccess = () => {
        for (const key of evictedSessions(all.result, id, value?.bytes ?? 0)) store.delete(key);
        if (value) store.put(value);
      };
      tx.oncomplete = () => resolve();
      tx.onabort = tx.onerror = () => reject(tx.error);
    });
  } finally { db.close(); }
}
