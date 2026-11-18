import { defineStore } from 'pinia'
import { ref } from 'vue'
import { ApiError, type Quote } from '@dash4/shared'
import { api } from '@/services/api'
import { kv, onWipe } from '@/offline/db'
import { mergeChanges, plain } from '@/offline/collection'
import { useAuthStore } from './auth'

const ITEMS_KEY = 'quotes.items'
const SYNCED_AT_KEY = 'quotes.syncedAt'
const detailKey = (id: number) => `quotes.detail.${id}`

export const QUOTE_PERMISSIONS = ['quotes.view', 'quotes.view.own']

/**
 * Devis sur le téléphone (bureau seulement, jamais pour un technicien) : liste synchronisée,
 * et fiche complète gardée en copie à chaque ouverture, pour la relire sans réseau.
 */
export const useQuotesStore = defineStore('quotes', () => {
  const auth = useAuthStore()

  const items = ref<Quote[]>([])
  const syncedAt = ref<string | null>(null)
  const loaded = ref(false)
  const syncing = ref(false)

  const allowed = () => auth.canAny(QUOTE_PERMISSIONS) && !auth.isTechnician

  async function load(): Promise<void> {
    if (loaded.value || !allowed()) return
    const [stored, at] = await Promise.all([kv.get<Quote[]>(ITEMS_KEY), kv.get<string>(SYNCED_AT_KEY)])
    items.value = stored ?? []
    syncedAt.value = at ?? null
    loaded.value = true
  }

  async function refresh(): Promise<void> {
    if (!allowed() || syncing.value) return
    await load()
    syncing.value = true
    try {
      const since = syncedAt.value
      const result = await api.syncAll((f) => api.quotes.list(f), since)
      items.value = mergeChanges(since ? items.value : [], result.items)
      syncedAt.value = result.serverTime
      await Promise.all([kv.set(ITEMS_KEY, plain(items.value)), kv.set(SYNCED_AT_KEY, syncedAt.value)])
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 0)) throw e
    } finally {
      syncing.value = false
    }
  }

  const sortByDate = (list: Quote[]) =>
    [...list].sort((a, b) => b.issued_at.localeCompare(a.issued_at) || b.id - a.id)

  function ofClient(clientId: number): Quote[] {
    return sortByDate(items.value.filter((q) => q.client_id === clientId))
  }

  function ofProject(projectId: number): Quote[] {
    return sortByDate(items.value.filter((q) => q.project_id === projectId))
  }

  /** Fiche complète : depuis l'API si possible (et gardée), sinon la dernière copie. */
  async function detail(id: number): Promise<{ quote: Quote | null; offline: boolean }> {
    if (!allowed()) return { quote: null, offline: false }
    try {
      const quote = await api.quotes.get(id)
      await kv.set(detailKey(id), plain(quote))
      return { quote, offline: false }
    } catch (e) {
      if (e instanceof ApiError && e.status !== 0) throw e
      return { quote: (await kv.get<Quote>(detailKey(id))) ?? null, offline: true }
    }
  }

  function reset(): void {
    items.value = []
    syncedAt.value = null
    loaded.value = false
  }

  onWipe(reset)

  return { items, syncedAt, loaded, syncing, load, refresh, ofClient, ofProject, detail, reset }
})
