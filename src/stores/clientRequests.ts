import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  ApiError,
  CLIENT_REQUEST_STATUS_LABELS,
  OPEN_CLIENT_REQUEST_STATUSES,
  type ClientRequest,
  type ClientRequestPayload,
  type ClientRequestStatus,
} from '@dash4/shared'
import { api } from '@/services/api'
import { kv, onWipe } from '@/offline/db'
import { mergeChanges, pendingCreations, plain, sortRequests } from '@/offline/collection'
import { useAuthStore } from './auth'
import { useSyncStore } from './sync'

const ITEMS_KEY = 'clientRequests.items'
const SYNCED_AT_KEY = 'clientRequests.syncedAt'

export const CLIENT_REQUEST_PERMISSIONS = ['client_requests.view', 'client_requests.view.own']

/**
 * Demandes clients sur le téléphone, pour les gestionnaires comme pour les techniciens
 * (l'API ne renvoie à un technicien que les siennes). Consultation hors ligne,
 * saisie et changements de statut via la file d'attente.
 */
export const useClientRequestsStore = defineStore('clientRequests', () => {
  const auth = useAuthStore()
  const sync = useSyncStore()

  const items = ref<ClientRequest[]>([])
  const syncedAt = ref<string | null>(null)
  const loaded = ref(false)
  const syncing = ref(false)
  const error = ref<string | null>(null)

  const sorted = computed(() => sortRequests(items.value))
  const open = computed(() => sorted.value.filter((r) => OPEN_CLIENT_REQUEST_STATUSES.includes(r.status.value)))
  const closed = computed(() => sorted.value.filter((r) => !OPEN_CLIENT_REQUEST_STATUSES.includes(r.status.value)))
  const pending = computed(() => pendingCreations(sync.pending, 'client-requests'))
  /** Compteur de l'onglet : demandes à traiter, y compris celles pas encore envoyées. */
  const openCount = computed(() => open.value.length + pending.value.length)

  const allowed = () => auth.canAny(CLIENT_REQUEST_PERMISSIONS)

  async function load(): Promise<void> {
    if (loaded.value || !allowed()) return
    const [stored, at] = await Promise.all([kv.get<ClientRequest[]>(ITEMS_KEY), kv.get<string>(SYNCED_AT_KEY)])
    items.value = stored ?? []
    syncedAt.value = at ?? null
    loaded.value = true
  }

  async function save(): Promise<void> {
    await Promise.all([kv.set(ITEMS_KEY, plain(items.value)), kv.set(SYNCED_AT_KEY, syncedAt.value)])
  }

  async function refresh(): Promise<void> {
    if (!allowed() || syncing.value) return
    await load()
    syncing.value = true
    error.value = null
    try {
      const since = syncedAt.value
      const result = await api.syncAll((f) => api.clientRequests.list(f), since)
      items.value = mergeChanges(since ? items.value : [], result.items)
      syncedAt.value = result.serverTime
      await save()
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 0)) {
        error.value = e instanceof Error ? e.message : 'Synchronisation impossible.'
      }
    } finally {
      syncing.value = false
    }
  }

  function find(id: number): ClientRequest | undefined {
    return items.value.find((r) => r.id === id)
  }

  async function create(payload: ClientRequestPayload): Promise<void> {
    await sync.enqueue({
      type: 'client_request',
      label: `Demande : ${payload.body.slice(0, 60)}`,
      method: 'POST',
      path: 'client-requests',
      payload: plain(payload) as unknown as Record<string, unknown>,
    })
  }

  /**
   * Changement de statut (bureau seulement). Appliqué tout de suite sur le téléphone,
   * envoyé dès que possible ; la synchro suivante remet la version du serveur.
   */
  async function setStatus(id: number, status: ClientRequestStatus, assignToMe = false): Promise<void> {
    const request = find(id)
    if (!request) return
    const payload: Record<string, unknown> = { status }
    if (assignToMe && auth.user) payload.assigned_to = auth.user.id

    request.status = { value: status, label: CLIENT_REQUEST_STATUS_LABELS[status] }
    if (assignToMe && auth.user) {
      request.assigned_to = auth.user.id
      request.assignee = { id: auth.user.id, full_name: auth.user.full_name }
    }
    await save()

    await sync.enqueue({
      type: 'client_request',
      label: `Demande ${CLIENT_REQUEST_STATUS_LABELS[status].toLowerCase()} : ${request.body.slice(0, 40)}`,
      method: 'PATCH',
      path: `client-requests/${id}`,
      payload,
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

  return {
    items,
    sorted,
    open,
    closed,
    pending,
    openCount,
    syncedAt,
    loaded,
    syncing,
    error,
    load,
    refresh,
    find,
    create,
    setStatus,
    reset,
  }
})
