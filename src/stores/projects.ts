import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { ACTIVE_PROJECT_STATUSES, ApiError, type Project } from '@dash4/shared'
import { api } from '@/services/api'
import { kv, onWipe } from '@/offline/db'
import { mergeChanges, pendingCreations, plain } from '@/offline/collection'
import { useAuthStore } from './auth'
import { useSyncStore } from './sync'

const ITEMS_KEY = 'projects.items'
const SYNCED_AT_KEY = 'projects.syncedAt'

export const PROJECT_PERMISSIONS = ['projects.view', 'projects.view.own']

/**
 * Projets sur le téléphone (bureau seulement pour l'instant ; le technicien verra
 * ceux de ses tâches). Notes et liens inclus pour la consultation hors ligne ;
 * les documents restent sur le serveur et s'ouvrent avec le réseau.
 */
export const useProjectsStore = defineStore('projects', () => {
  const auth = useAuthStore()
  const sync = useSyncStore()

  const items = ref<Project[]>([])
  const syncedAt = ref<string | null>(null)
  const loaded = ref(false)
  const syncing = ref(false)
  const error = ref<string | null>(null)

  const sorted = computed(() =>
    [...items.value].sort(
      (a, b) =>
        Number(b.is_favorite) - Number(a.is_favorite) ||
        (b.updated_at ?? '').localeCompare(a.updated_at ?? '') ||
        b.id - a.id,
    ),
  )
  const active = computed(() => sorted.value.filter((p) => ACTIVE_PROJECT_STATUSES.includes(p.status.value)))

  const allowed = () => auth.canAny(PROJECT_PERMISSIONS) && !auth.isTechnician

  async function load(): Promise<void> {
    if (loaded.value || !allowed()) return
    const [stored, at] = await Promise.all([kv.get<Project[]>(ITEMS_KEY), kv.get<string>(SYNCED_AT_KEY)])
    items.value = stored ?? []
    syncedAt.value = at ?? null
    loaded.value = true
  }

  async function refresh(): Promise<void> {
    if (!allowed() || syncing.value) return
    await load()
    syncing.value = true
    error.value = null
    try {
      const since = syncedAt.value
      const result = await api.syncAll((f) => api.projects.list({ ...f, include: 'notes,links' }), since)
      items.value = mergeChanges(since ? items.value : [], result.items)
      syncedAt.value = result.serverTime
      await Promise.all([kv.set(ITEMS_KEY, plain(items.value)), kv.set(SYNCED_AT_KEY, syncedAt.value)])
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 0)) {
        error.value = e instanceof Error ? e.message : 'Synchronisation impossible.'
      }
    } finally {
      syncing.value = false
    }
  }

  function find(id: number): Project | undefined {
    return items.value.find((p) => p.id === id)
  }

  function ofClient(clientId: number): Project[] {
    return sorted.value.filter((p) => p.client_id === clientId)
  }

  /** Notes en attente d'envoi pour un projet. */
  function pendingNotes(projectId: number) {
    return pendingCreations(sync.pending, `projects/${projectId}/notes`)
  }

  /** Note écrite sur le chantier, même sans réseau. */
  async function addNote(projectId: number, body: string): Promise<void> {
    await sync.enqueue({
      type: 'note',
      label: `Note de projet : ${body.slice(0, 50)}`,
      method: 'POST',
      path: `projects/${projectId}/notes`,
      payload: { body },
    })
  }

  function reset(): void {
    items.value = []
    syncedAt.value = null
    loaded.value = false
    error.value = null
  }

  sync.onFlushed(() => void refresh())
  onWipe(reset)

  return { items, sorted, active, syncedAt, loaded, syncing, error, load, refresh, find, ofClient, pendingNotes, addNote, reset }
})
