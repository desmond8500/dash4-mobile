import { toolIdFromQr } from '@dash4/shared'
import type { Tool, ToolStatus } from '@dash4/shared'

/** Outillage sur le téléphone : lecture des QR codes, actions en attente, tri et couleurs. */

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

/**
 * Outil correspondant à un code scanné : QR code de l'étiquette (adresse de la fiche ou `DASH4-OUTIL-12`),
 * sinon numéro d'inventaire (code-barres ou saisie). `id` seul quand l'outil n'est pas encore sur le téléphone.
 */
export function findToolByScan(items: Tool[], content: string): { id: number; tool: Tool | null } | null {
  const id = toolIdFromQr(content)
  if (id !== null) return { id, tool: items.find((t) => t.id === id) ?? null }
  const code = fold(content)
  const tool = code ? (items.find((t) => t.code && fold(t.code) === code) ?? null) : null
  return tool ? { id: tool.id, tool } : null
}

export interface PendingToolAction {
  kind: 'lend' | 'return' | 'remind'
  label: string
}

/** Prêts, retours et rappels encore dans la file d'attente pour un outil. */
export function pendingToolActions(pending: Array<{ type: string; path: string; label: string }>, toolId: number): PendingToolAction[] {
  return pending
    .filter((p) => p.path === `tools/${toolId}/loans` || p.path.startsWith(`tools/${toolId}/loans/`))
    .map((p) => ({ kind: p.type === 'tool-return' ? 'return' : p.type === 'tool-remind' ? 'remind' : 'lend', label: p.label }))
}

/**
 * Disponibilité affichée, actions en attente comprises : un prêt en attente rend l'outil « prêté »,
 * un retour en attente le rend « disponible » (ou indisponible selon son état).
 */
export function displayedStatus(tool: Pick<Tool, 'status' | 'condition'>, pending: PendingToolAction[]): ToolStatus {
  const last = [...pending].reverse().find((p) => p.kind !== 'remind')
  if (last?.kind === 'lend') return 'lent'
  if (last?.kind === 'return') return ['repair', 'broken', 'lost', 'retired'].includes(tool.condition.value) ? 'unavailable' : 'available'
  return tool.status.value
}

/** Couleur Ionic d'une disponibilité ou d'un prêt. */
export function toolColor(state: string): string {
  return state === 'late' ? 'danger' : state === 'soon' || state === 'unavailable' ? 'warning' : state === 'available' ? 'success' : 'primary'
}

/** En retard d'abord, puis prêtés, puis par nom. */
export function sortTools(list: Tool[]): Tool[] {
  const rank: Record<ToolStatus, number> = { late: 0, lent: 1, available: 2, unavailable: 3 }
  return [...list].sort((a, b) => rank[a.status.value] - rank[b.status.value] || a.name.localeCompare(b.name, 'fr', { numeric: true }) || (a.code ?? '').localeCompare(b.code ?? '', 'fr', { numeric: true }))
}

/** Date du jour au format de l'API (AAAA-MM-JJ), dans `days` jours. */
export function isoDateIn(days: number, from: Date = new Date()): string {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
