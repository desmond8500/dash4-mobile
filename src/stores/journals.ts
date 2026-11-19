import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { ApiError, type Journal, type JournalPayload } from '@dash4/shared'
import { api } from '@/services/api'
import { kv, onWipe } from '@/offline/db'
import { mergeChanges, pendingCreations, plain } from '@/offline/collection'
import { useAuthStore } from './auth'
import { useSyncStore } from './sync'

const ITEMS_KEY = 'journals.items'
const SYNCED_AT_KEY = 'journals.syncedAt'
const PHOTOS_KEY = 'journals.photos'
const photoKey = (uuid: string, i: number) => `journals.photo.${uuid}.${i}`

export const JOURNAL_PERMISSIONS = ['journals.view', 'journals.view.own']

/**
 * Rapports d'intervention sur le téléphone : rédigés sans réseau, avec les photos gardées sur
 * le téléphone puis envoyées dès que le rapport est arrivé sur le serveur.
 */
export const useJournalsStore = defineStore('journals', () => {
  const auth = useAuthStore()
  const sync = useSyncStore()

  const items = ref<Journal[]>([])
  const syncedAt = ref<string | null>(null)
  const loaded = ref(false)
  const syncing = ref(false)
  /** uuid du rapport → nombre de photos en attente. */
  const pendingPhotos = ref<Record<string, number>>({})

  const allowed = () => auth.canAny(JOURNAL_PERMISSIONS)
  const sorted = computed(() => items.value.filter((j) => !j.deleted_at).sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '') || b.id - a.id))
  const pending = computed(() => pendingCreations(sync.pending, 'journals'))

  async function load(): Promise<void> {
    if (loaded.value || !allowed()) return
    const [stored, at, photos] = await Promise.all([kv.get<Journal[]>(ITEMS_KEY), kv.get<string>(SYNCED_AT_KEY), kv.get<Record<string, number>>(PHOTOS_KEY)])
    items.value = stored ?? []
    syncedAt.value = at ?? null
    pendingPhotos.value = photos ?? {}
    loaded.value = true
  }

  async function refresh(): Promise<void> {
    if (!allowed() || syncing.value) return
    await load()
    syncing.value = true
    try {
      const since = syncedAt.value
      const result = await api.syncAll((f) => api.journals.list(f), since)
      items.value = mergeChanges(since ? items.value : [], result.items)
      syncedAt.value = result.serverTime
      await Promise.all([kv.set(ITEMS_KEY, plain(items.value)), kv.set(SYNCED_AT_KEY, syncedAt.value)])
      await uploadPhotos()
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 0)) throw e
    } finally {
      syncing.value = false
    }
  }

  async function uploadPhotos(): Promise<void> {
    for (const [uuid, count] of Object.entries({ ...pendingPhotos.value })) {
      const journal = items.value.find((j) => j.client_uuid === uuid)
      if (!journal) continue
      for (let i = 0; i < count; i++) {
        const blob = await kv.get<Blob>(photoKey(uuid, i))
        if (blob) await api.documents.upload('journals', journal.id, blob, `photo-${i + 1}.jpg`, `Photo ${i + 1} — ${journal.title}`)
        await kv.delete(photoKey(uuid, i))
      }
      const rest = { ...pendingPhotos.value }
      delete rest[uuid]
      pendingPhotos.value = rest
      await kv.set(PHOTOS_KEY, { ...rest })
    }
  }

  async function create(payload: JournalPayload & { title: string; date: string }, photos: Blob[] = []): Promise<void> {
    const item = await sync.enqueue({ type: 'journal', label: `Rapport : ${payload.title}`, method: 'POST', path: 'journals', payload: plain(payload) as Record<string, unknown> })
    if (photos.length) {
      await Promise.all(photos.map((p, i) => kv.set(photoKey(item.id, i), p)))
      pendingPhotos.value = { ...pendingPhotos.value, [item.id]: photos.length }
      await kv.set(PHOTOS_KEY, { ...pendingPhotos.value })
    }
  }

  const find = (id: number) => items.value.find((j) => j.id === id)
  const photosWaiting = (uuid: string | null) => (uuid ? (pendingPhotos.value[uuid] ?? 0) : 0)

  function reset(): void {
    items.value = []
    syncedAt.value = null
    pendingPhotos.value = {}
    loaded.value = false
  }

  sync.onFlushed(() => void refresh().catch(() => undefined))
  onWipe(reset)

  return { items, sorted, pending, syncedAt, loaded, syncing, allowed, load, refresh, create, find, photosWaiting, reset }
})
