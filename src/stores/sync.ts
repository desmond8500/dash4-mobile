import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { Network } from '@capacitor/network'
import { App } from '@capacitor/app'
import { createOutbox, type OutboxItem } from '@/offline/outbox'
import { indexedDbOutboxStore } from '@/offline/db'
import { api } from '@/services/api'

const FLUSH_INTERVAL_MS = 60_000

/**
 * Réseau et synchronisation : état de la connexion, actions en attente, envoi automatique
 * au retour du réseau, au retour de l'application au premier plan et toutes les minutes.
 */
export const useSyncStore = defineStore('sync', () => {
  const online = ref(typeof navigator === 'undefined' ? true : navigator.onLine)
  const pending = ref<OutboxItem[]>([])
  const syncing = ref(false)
  const lastSync = ref<number | null>(null)

  const outbox = createOutbox(indexedDbOutboxStore, (item) =>
    api.request(item.method, item.path, item.payload),
  )

  const pendingCount = computed(() => pending.value.length)
  const failedItems = computed(() => pending.value.filter((item) => item.lastError))

  async function refreshPending(): Promise<void> {
    pending.value = await outbox.all()
  }

  async function flush(): Promise<void> {
    if (!online.value || syncing.value) return
    syncing.value = true
    try {
      const result = await outbox.flush()
      if (!result.interrupted) lastSync.value = Date.now()
    } finally {
      syncing.value = false
      await refreshPending()
    }
  }

  /** Ajoute une action à la file et tente de l'envoyer tout de suite. */
  async function enqueue(action: Parameters<typeof outbox.enqueue>[0]): Promise<OutboxItem> {
    const item = await outbox.enqueue(action)
    await refreshPending()
    void flush()
    return item
  }

  async function discard(id: string): Promise<void> {
    await outbox.remove(id)
    await refreshPending()
  }

  let started = false

  async function start(): Promise<void> {
    if (started) return
    started = true

    online.value = (await Network.getStatus()).connected
    await refreshPending()

    await Network.addListener('networkStatusChange', (status) => {
      online.value = status.connected
      if (status.connected) void flush()
    })
    await App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) void flush()
    })
    setInterval(() => void flush(), FLUSH_INTERVAL_MS)

    void flush()
  }

  return { online, pending, syncing, lastSync, pendingCount, failedItems, start, flush, enqueue, discard, refreshPending }
})
