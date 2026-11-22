import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { ApiError, type Expense, type ExpenseCategory, type ExpensePayload, type ExpenseSpace } from '@dash4/shared'
import { api } from '@/services/api'
import { kv, onWipe } from '@/offline/db'
import { mergeChanges, pendingCreations, plain } from '@/offline/collection'
import { useAuthStore } from './auth'
import { useSyncStore } from './sync'
import { decideLocally } from '@/utils/expenses'

const ITEMS_KEY = 'expenses.items'
const SYNCED_AT_KEY = 'expenses.syncedAt'
const LISTS_KEY = 'expenses.lists'
const RECEIPTS_KEY = 'expenses.receipts'
const receiptKey = (uuid: string) => `expenses.receipt.${uuid}`

export const EXPENSE_PERMISSIONS = ['accounting.view', 'accounting.view.own']

/**
 * Dépenses sur le téléphone (techniciens et gestionnaires) : ses dépenses et celles de ses caisses,
 * saisie hors ligne avec photo du justificatif. La photo est gardée sur le téléphone puis envoyée
 * dès que la dépense est arrivée sur le serveur. La validation se fait sur le web.
 */
export const useExpensesStore = defineStore('expenses', () => {
  const auth = useAuthStore()
  const sync = useSyncStore()

  const items = ref<Expense[]>([])
  const categories = ref<ExpenseCategory[]>([])
  const spaces = ref<ExpenseSpace[]>([])
  const syncedAt = ref<string | null>(null)
  const loaded = ref(false)
  const syncing = ref(false)
  const pendingReceipts = ref<string[]>([])

  const allowed = () => auth.canAny(EXPENSE_PERMISSIONS)
  const sorted = computed(() =>
    items.value.filter((e) => !e.deleted_at).sort((a, b) => (b.spent_at ?? '').localeCompare(a.spent_at ?? '') || b.id - a.id),
  )
  const mine = computed(() => sorted.value.filter((e) => e.created_by === auth.user?.id))
  const pending = computed(() => pendingCreations(sync.pending, 'expenses'))
  /** Ce qu'on doit me rembourser : mes dépenses avancées, validées. */
  const toReimburse = computed(() => mine.value.filter((e) => e.to_reimburse).reduce((t, e) => t + e.amount, 0))

  async function load(): Promise<void> {
    if (loaded.value || !allowed()) return
    const [stored, at, lists, receipts] = await Promise.all([
      kv.get<Expense[]>(ITEMS_KEY),
      kv.get<string>(SYNCED_AT_KEY),
      kv.get<{ categories: ExpenseCategory[]; spaces: ExpenseSpace[] }>(LISTS_KEY),
      kv.get<string[]>(RECEIPTS_KEY),
    ])
    items.value = stored ?? []
    syncedAt.value = at ?? null
    categories.value = lists?.categories ?? []
    spaces.value = lists?.spaces ?? []
    pendingReceipts.value = receipts ?? []
    loaded.value = true
  }

  async function refresh(): Promise<void> {
    if (!allowed() || syncing.value) return
    await load()
    syncing.value = true
    try {
      const since = syncedAt.value
      const [result, cats, sp] = await Promise.all([
        api.syncAll((f) => api.expenses.list(f), since),
        api.expenseCategories.list(),
        api.expenseSpaces.list(),
      ])
      items.value = mergeChanges(since ? items.value : [], result.items)
      syncedAt.value = result.serverTime
      categories.value = cats
      spaces.value = sp
      await Promise.all([
        kv.set(ITEMS_KEY, plain(items.value)),
        kv.set(SYNCED_AT_KEY, syncedAt.value),
        kv.set(LISTS_KEY, plain({ categories: cats, spaces: sp })),
      ])
      await uploadReceipts()
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 0)) throw e
    } finally {
      syncing.value = false
    }
  }

  /** Envoie les photos gardées pour les dépenses arrivées sur le serveur. */
  async function uploadReceipts(): Promise<void> {
    for (const uuid of [...pendingReceipts.value]) {
      const expense = items.value.find((e) => e.client_uuid === uuid)
      if (!expense) continue
      const blob = await kv.get<Blob>(receiptKey(uuid))
      if (blob) {
        const updated = await api.expenses.uploadReceipt(expense.id, blob, 'justificatif.jpg')
        items.value = items.value.map((e) => (e.id === updated.id ? updated : e))
        await kv.set(ITEMS_KEY, plain(items.value))
      }
      await kv.delete(receiptKey(uuid))
      pendingReceipts.value = pendingReceipts.value.filter((u) => u !== uuid)
      await kv.set(RECEIPTS_KEY, [...pendingReceipts.value])
    }
  }

  /** Dépense saisie sur le téléphone, même sans réseau, avec la photo du justificatif. */
  async function create(payload: ExpensePayload & { label: string; amount: number; spent_at: string }, receipt?: Blob | null): Promise<void> {
    const item = await sync.enqueue({
      type: 'expense',
      label: `Dépense : ${payload.label} — ${payload.amount.toLocaleString('fr-FR')} F CFA`,
      method: 'POST',
      path: 'expenses',
      payload: { ...payload },
    })
    if (receipt) {
      await kv.set(receiptKey(item.id), receipt)
      pendingReceipts.value = [...pendingReceipts.value, item.id]
      await kv.set(RECEIPTS_KEY, [...pendingReceipts.value])
    }
  }

  /**
   * Vérification par la comptabilité (accounting.update) : valider, refuser (avec un motif) ou rembourser.
   * Envoyé maintenant ou au retour du réseau ; la liste change tout de suite.
   */
  async function decide(expense: Expense, action: 'approve' | 'reject' | 'reimburse', reason: string | null = null): Promise<void> {
    const labels = { approve: 'Dépense validée', reject: 'Dépense refusée', reimburse: 'Dépense remboursée' } as const
    await sync.enqueue({
      type: `expense-${action}`,
      label: `${labels[action]} : ${expense.label} — ${expense.amount.toLocaleString('fr-FR')} F CFA`,
      method: 'POST',
      path: `expenses/${expense.id}/${action}`,
      payload: action === 'reject' ? { reason } : {},
    })
    items.value = items.value.map((e) => (e.id === expense.id ? decideLocally(e, action, reason) : e))
    await kv.set(ITEMS_KEY, plain(items.value))
  }
  const canDecide = () => auth.can('accounting.update')

  const hasPendingReceipt = (uuid: string | null) => !!uuid && pendingReceipts.value.includes(uuid)

  function reset(): void {
    items.value = []
    categories.value = []
    spaces.value = []
    syncedAt.value = null
    pendingReceipts.value = []
    loaded.value = false
  }

  sync.onFlushed(() => void refresh().catch(() => undefined))
  onWipe(reset)

  return { items, sorted, mine, pending, toReimburse, categories, spaces, syncedAt, loaded, syncing, allowed, load, refresh, create, decide, canDecide, hasPendingReceipt, reset }
})
