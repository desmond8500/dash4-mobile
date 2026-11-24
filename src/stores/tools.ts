import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { ApiError, type Tool, type ToolCondition, type ToolLendPayload, type ToolLoan, type ToolOptions } from '@dash4/shared'
import { api } from '@/services/api'
import { kv, onWipe } from '@/offline/db'
import { plain } from '@/offline/collection'
import { useAuthStore } from './auth'
import { useSyncStore } from './sync'
import { findToolByScan, pendingToolActions, sortTools } from '@/utils/tools'

const ITEMS_KEY = 'tools.items'
const OPTIONS_KEY = 'tools.options'
const detailKey = (id: number) => `tools.detail.${id}`

export const TOOLS_PERMISSIONS = ['tools.view', 'tools.view.own']

/**
 * Outillage sur le téléphone : les outils que le compte a le droit de voir (tout l'outillage, ou ceux qu'il a
 * en prêt), consultables hors ligne. Prêts, retours et rappels passent par la file d'attente : ils partent
 * au retour du réseau, sans doublon (`client_uuid`). Aucune valeur d'achat sans `costs.view` (l'API ne l'envoie pas).
 */
export const useToolsStore = defineStore('tools', () => {
  const auth = useAuthStore()
  const sync = useSyncStore()

  const items = ref<Tool[]>([])
  const options = ref<ToolOptions | null>(null)
  const loaded = ref(false)
  const syncing = ref(false)

  const allowed = () => auth.canAny(TOOLS_PERMISSIONS)
  const canLend = () => auth.can('tools.lend')
  const visible = computed(() => sortTools(items.value))
  const lateCount = computed(() => items.value.filter((t) => t.status.value === 'late').length)
  const mine = computed(() => items.value.filter((t) => t.current_loan?.borrower_id === auth.user?.id))

  async function load(): Promise<void> {
    if (loaded.value || !allowed()) return
    items.value = (await kv.get<Tool[]>(ITEMS_KEY)) ?? []
    options.value = (await kv.get<ToolOptions>(OPTIONS_KEY)) ?? null
    loaded.value = true
  }

  async function refresh(): Promise<void> {
    if (!allowed() || syncing.value) return
    await load()
    syncing.value = true
    try {
      const [list, opts] = await Promise.all([api.tools.list(), api.tools.options()])
      items.value = list
      options.value = opts
      await kv.set(ITEMS_KEY, plain(list))
      await kv.set(OPTIONS_KEY, plain(opts))
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 0)) throw e
    } finally {
      syncing.value = false
    }
  }

  async function detail(id: number): Promise<{ tool: Tool | null; offline: boolean }> {
    if (!allowed()) return { tool: null, offline: false }
    try {
      const tool = await api.tools.get(id)
      await kv.set(detailKey(id), plain(tool))
      items.value = items.value.some((t) => t.id === id) ? items.value.map((t) => (t.id === id ? tool : t)) : [...items.value, tool]
      return { tool, offline: false }
    } catch (e) {
      if (e instanceof ApiError && e.status !== 0) throw e
      return { tool: (await kv.get<Tool>(detailKey(id))) ?? items.value.find((t) => t.id === id) ?? null, offline: true }
    }
  }

  /** Outil d'un code scanné (QR code de l'étiquette ou numéro d'inventaire). */
  const byScan = (content: string) => findToolByScan(items.value, content)

  async function lend(tool: Tool, payload: ToolLendPayload, borrowerLabel: string): Promise<void> {
    await sync.enqueue({
      type: 'tool-lend',
      label: `Prêt de ${tool.title} à ${borrowerLabel}`,
      method: 'POST',
      path: `tools/${tool.id}/loans`,
      payload: { ...payload },
    })
  }

  async function returnTool(tool: Tool, loan: ToolLoan, condition: ToolCondition, notes: string | null): Promise<void> {
    await sync.enqueue({
      type: 'tool-return',
      label: `Retour de ${tool.title} (${loan.borrower_label})`,
      method: 'POST',
      path: `tools/${tool.id}/loans/${loan.id}/return`,
      payload: { condition, return_notes: notes, returned_at: new Date().toISOString() },
    })
  }

  async function remind(tool: Tool, loan: ToolLoan): Promise<void> {
    await sync.enqueue({
      type: 'tool-remind',
      label: `Rappel à ${loan.borrower_label} : ${tool.title}`,
      method: 'POST',
      path: `tools/${tool.id}/loans/${loan.id}/remind`,
      payload: {},
    })
  }

  /** Actions en attente d'envoi pour cet outil. */
  const pendingFor = (toolId: number) => pendingToolActions(sync.pending, toolId)

  sync.onFlushed(() => void refresh().catch(() => undefined))

  function reset(): void {
    items.value = []
    options.value = null
    loaded.value = false
  }
  onWipe(reset)

  return { items, options, visible, lateCount, mine, loaded, syncing, allowed, canLend, load, refresh, detail, byScan, lend, returnTool, remind, pendingFor, reset }
})
