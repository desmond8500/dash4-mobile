import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { ApiError, type Article, type StockMovementPayload } from '@dash4/shared'
import { api } from '@/services/api'
import { kv, onWipe } from '@/offline/db'
import { matchesSearch, mergeChanges, pendingCreations, plain } from '@/offline/collection'
import { findByCode, projectedQuantity } from '@/utils/stock'
import { useAuthStore } from './auth'
import { useSyncStore } from './sync'

const ITEMS_KEY = 'stock.items'
const SYNCED_AT_KEY = 'stock.syncedAt'
const detailKey = (id: number) => `stock.detail.${id}`

/**
 * Stock sur le téléphone (gestionnaires) : articles synchronisés, recherche et scan sans réseau,
 * mouvements (entrée, sortie, inventaire) mis en file d'attente. Prix et coûts : seulement si l'API
 * les envoie au compte.
 */
export const useStockStore = defineStore('stock', () => {
  const auth = useAuthStore()
  const sync = useSyncStore()

  const items = ref<Article[]>([])
  const syncedAt = ref<string | null>(null)
  const loaded = ref(false)
  const syncing = ref(false)

  const allowed = () => auth.can('stock.view') && !auth.isTechnician
  const active = computed(() =>
    items.value.filter((a) => !a.deleted_at && a.is_active).sort((a, b) => a.designation.localeCompare(b.designation, 'fr')),
  )
  const low = computed(() => active.value.filter((a) => a.is_low || a.quantity <= 0))

  async function load(): Promise<void> {
    if (loaded.value || !allowed()) return
    const [stored, at] = await Promise.all([kv.get<Article[]>(ITEMS_KEY), kv.get<string>(SYNCED_AT_KEY)])
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
      const result = await api.syncAll((f) => api.articles.list(f), since)
      items.value = mergeChanges(since ? items.value : [], result.items)
      syncedAt.value = result.serverTime
      await Promise.all([kv.set(ITEMS_KEY, plain(items.value)), kv.set(SYNCED_AT_KEY, syncedAt.value)])
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 0)) throw e
    } finally {
      syncing.value = false
    }
  }

  const find = (id: number) => items.value.find((a) => a.id === id)
  const byCode = (code: string) => findByCode(items.value, code)
  const search = (query: string, list: Article[] = active.value) =>
    list.filter((a) => matchesSearch(query, [a.designation, a.reference, a.barcode, a.brand?.name, a.location]))

  const pendingMovements = (articleId: number) => pendingCreations(sync.pending, `articles/${articleId}/movements`)
  /** Stock affiché : celui du serveur, plus les mouvements pas encore envoyés. */
  const quantityOf = (article: Article) => projectedQuantity(article.quantity, pendingMovements(article.id))

  /** Fiche (articles liés, derniers mouvements) : depuis l'API si possible, sinon la dernière copie. */
  async function detail(id: number): Promise<{ article: Article | null; offline: boolean }> {
    if (!allowed()) return { article: null, offline: false }
    try {
      const article = await api.articles.get(id)
      await kv.set(detailKey(id), plain(article))
      return { article, offline: false }
    } catch (e) {
      if (e instanceof ApiError && e.status !== 0) throw e
      return { article: (await kv.get<Article>(detailKey(id))) ?? find(id) ?? null, offline: true }
    }
  }

  /** Entrée, sortie ou inventaire, même sans réseau. */
  async function move(article: Article, payload: Omit<StockMovementPayload, 'client_uuid'>): Promise<void> {
    const verb = { in: 'Entrée', out: 'Sortie', inventory: 'Inventaire' }[payload.type]
    await sync.enqueue({
      type: 'stock_movement',
      label: `${verb} de stock : ${payload.quantity} × ${article.designation}`,
      method: 'POST',
      path: `articles/${article.id}/movements`,
      payload: { ...payload },
    })
  }

  function reset(): void {
    items.value = []
    syncedAt.value = null
    loaded.value = false
  }

  sync.onFlushed(() => void refresh().catch(() => undefined))
  onWipe(reset)

  return { items, active, low, syncedAt, loaded, syncing, allowed, load, refresh, find, byCode, search, pendingMovements, quantityOf, detail, move, reset }
})
