import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { ApiError, type Invoice } from '@dash4/shared'
import { api } from '@/services/api'
import { kv, onWipe } from '@/offline/db'
import { mergeChanges, plain } from '@/offline/collection'
import { collectSummary, sortInvoices } from '@/utils/invoices'
import { useAuthStore } from './auth'

const ITEMS_KEY = 'invoices.items'
const SYNCED_AT_KEY = 'invoices.syncedAt'
const detailKey = (id: number) => `invoices.detail.${id}`

export const INVOICE_PERMISSIONS = ['invoices.view']

/**
 * Factures sur le téléphone, en lecture (bureau seulement, jamais pour un technicien) :
 * liste synchronisée et fiche gardée à chaque ouverture. L'émission et les paiements se font sur le web.
 */
export const useInvoicesStore = defineStore('invoices', () => {
  const auth = useAuthStore()

  const items = ref<Invoice[]>([])
  const syncedAt = ref<string | null>(null)
  const loaded = ref(false)
  const syncing = ref(false)

  const allowed = () => auth.canAny(INVOICE_PERMISSIONS) && !auth.isTechnician
  const visible = computed(() => sortInvoices(items.value.filter((i) => !i.deleted_at)))
  const summary = computed(() => collectSummary(items.value))

  async function load(): Promise<void> {
    if (loaded.value || !allowed()) return
    const [stored, at] = await Promise.all([kv.get<Invoice[]>(ITEMS_KEY), kv.get<string>(SYNCED_AT_KEY)])
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
      const result = await api.syncAll((f) => api.invoices.list(f), since)
      items.value = mergeChanges(since ? items.value : [], result.items)
      syncedAt.value = result.serverTime
      await Promise.all([kv.set(ITEMS_KEY, plain(items.value)), kv.set(SYNCED_AT_KEY, syncedAt.value)])
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 0)) throw e
    } finally {
      syncing.value = false
    }
  }

  const ofClient = (clientId: number) => visible.value.filter((i) => i.client_id === clientId)
  const ofQuote = (quoteId: number) => visible.value.filter((i) => i.quote_id === quoteId)
  const ofProject = (projectId: number) => visible.value.filter((i) => i.project_id === projectId)

  /** Fiche complète : depuis l'API si possible (et gardée), sinon la dernière copie. */
  async function detail(id: number): Promise<{ invoice: Invoice | null; offline: boolean }> {
    if (!allowed()) return { invoice: null, offline: false }
    try {
      const invoice = await api.invoices.get(id)
      await kv.set(detailKey(id), plain(invoice))
      return { invoice, offline: false }
    } catch (e) {
      if (e instanceof ApiError && e.status !== 0) throw e
      return { invoice: (await kv.get<Invoice>(detailKey(id))) ?? null, offline: true }
    }
  }

  function reset(): void {
    items.value = []
    syncedAt.value = null
    loaded.value = false
  }

  onWipe(reset)

  return { items, visible, summary, syncedAt, loaded, syncing, allowed, load, refresh, ofClient, ofQuote, ofProject, detail, reset }
})
