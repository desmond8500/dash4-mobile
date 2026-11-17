/**
 * Stockage local hors ligne (IndexedDB, disponible dans la WebView Capacitor et le navigateur).
 *  - « kv »     : cache des données (utilisateur connecté, données des modules…)
 *  - « outbox » : actions faites hors ligne, envoyées dès que le réseau revient
 */
import type { OutboxItem, OutboxStore } from './outbox'

const DB_NAME = 'dash4'
const DB_VERSION = 1

let dbPromise: Promise<IDBDatabase> | null = null

function open(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv')
      if (!db.objectStoreNames.contains('outbox')) db.createObjectStore('outbox', { keyPath: 'id' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => {
      dbPromise = null
      reject(request.error)
    }
  })

  return dbPromise
}

function run<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(store, mode)
        const request = fn(tx.objectStore(store))
        tx.oncomplete = () => resolve(request.result)
        tx.onerror = () => reject(tx.error)
        tx.onabort = () => reject(tx.error)
      }),
  )
}

export const kv = {
  get<T>(key: string): Promise<T | undefined> {
    return run<T | undefined>('kv', 'readonly', (s) => s.get(key))
  },
  async set(key: string, value: unknown): Promise<void> {
    await run('kv', 'readwrite', (s) => s.put(value, key))
  },
  async delete(key: string): Promise<void> {
    await run('kv', 'readwrite', (s) => s.delete(key))
  },
}

export const indexedDbOutboxStore: OutboxStore = {
  async all() {
    const items = await run<OutboxItem[]>('outbox', 'readonly', (s) => s.getAll())
    return items.sort((a, b) => a.createdAt - b.createdAt)
  },
  async put(item) {
    await run('outbox', 'readwrite', (s) => s.put(item))
  },
  async delete(id) {
    await run('outbox', 'readwrite', (s) => s.delete(id))
  },
  async clear() {
    await run('outbox', 'readwrite', (s) => s.clear())
  },
}

/** Efface toutes les données locales (déconnexion, changement de type de compte). */
export async function wipeLocalData(): Promise<void> {
  await run('kv', 'readwrite', (s) => s.clear())
  await indexedDbOutboxStore.clear()
}
