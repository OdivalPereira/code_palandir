import { CodeNode } from './types';

type CachedAnalysis = {
  key: string;
  value: CodeNode[];
  createdAt: number;
  expiresAt: number | null;
};

type CachedRelevance = {
  key: string;
  value: string[];
  createdAt: number;
  expiresAt: number | null;
  repoHash: string;
};

const DB_NAME = 'code-mind-ai-cache';
const DB_VERSION = 2;
const ANALYSIS_STORE = 'analysis';
const RELEVANCE_STORE = 'relevance';

let dbPromise: Promise<IDBDatabase> | null = null;

const openDb = (): Promise<IDBDatabase> => {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(ANALYSIS_STORE)) {
        db.createObjectStore(ANALYSIS_STORE, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(RELEVANCE_STORE)) {
        db.createObjectStore(RELEVANCE_STORE, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return dbPromise;
};

const withStore = async <T>(
  storeName: string,
  mode: IDBTransactionMode,
  callback: (store: IDBObjectStore) => void,
): Promise<T> => {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);

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
    const transaction = db.transaction(ANALYSIS_STORE, 'readwrite');
    const store = transaction.objectStore(ANALYSIS_STORE);
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

  await withStore<void>(ANALYSIS_STORE, 'readwrite', (store) => {
    store.put({
      key,
      value,
      createdAt: now,
      expiresAt,
    });
  });
};

export const getCachedRelevantFiles = async (
  key: string,
  repoHash: string,
): Promise<string[] | null> => {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(RELEVANCE_STORE, 'readwrite');
    const store = transaction.objectStore(RELEVANCE_STORE);
    const request = store.get(key);

    request.onsuccess = () => {
      const result = request.result as CachedRelevance | undefined;
      if (!result) {
        resolve(null);
        return;
      }

      if (result.repoHash !== repoHash) {
        store.delete(key);
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

export const setCachedRelevantFiles = async (
  key: string,
  value: string[],
  repoHash: string,
  ttlMs?: number,
): Promise<void> => {
  const now = Date.now();
  const expiresAt = ttlMs && ttlMs > 0 ? now + ttlMs : null;

  await withStore<void>(RELEVANCE_STORE, 'readwrite', (store) => {
    store.put({
      key,
      value,
      createdAt: now,
      expiresAt,
      repoHash,
    });
  });
};
