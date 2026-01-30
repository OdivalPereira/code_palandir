import { CodeNode } from './types';

type CachedAnalysis = {
  key: string;
  value: CodeNode[];
  createdAt: number;
  expiresAt: number | null;
};

const DB_NAME = 'code-mind-ai-cache';
const DB_VERSION = 1;
const STORE_NAME = 'analysis';

let dbPromise: Promise<IDBDatabase> | null = null;

const openDb = (): Promise<IDBDatabase> => {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return dbPromise;
};

const withStore = async <T>(
  mode: IDBTransactionMode,
  callback: (store: IDBObjectStore) => void,
): Promise<T> => {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);

    transaction.oncomplete = () => resolve(undefined as T);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);

    callback(store);
  });
};

export const hashContent = async (content: string): Promise<string> => {
  if (crypto?.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  }

  let hash = 0x811c9dc5;
  for (let i = 0; i < content.length; i += 1) {
    hash ^= content.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }

  return `fnv1a-${(hash >>> 0).toString(16)}`;
};

export const getCachedAnalysis = async (key: string): Promise<CodeNode[] | null> => {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(key);

    request.onsuccess = () => {
      const result = request.result as CachedAnalysis | undefined;
      if (!result) {
        resolve(null);
        return;
      }

      if (result.expiresAt && Date.now() > result.expiresAt) {
        store.delete(key);
        resolve(null);
        return;
      }

      resolve(result.value);
    };

    request.onerror = () => reject(request.error);
  });
};

export const setCachedAnalysis = async (
  key: string,
  value: CodeNode[],
  ttlMs?: number,
): Promise<void> => {
  const now = Date.now();
  const expiresAt = ttlMs && ttlMs > 0 ? now + ttlMs : null;

  await withStore<void>('readwrite', (store) => {
    store.put({
      key,
      value,
      createdAt: now,
      expiresAt,
    });
  });
};
