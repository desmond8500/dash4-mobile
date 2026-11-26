import type { AppNotification, CommentableType } from '@dash4/shared'

/** Écran du téléphone pour chaque fiche commentée (seules celles qui existent sur le téléphone). */
const SUBJECT_ROUTES: Partial<Record<CommentableType, string>> = {
  tasks: 'task',
  journals: 'journal',
  projects: 'project',
  'client-requests': 'client-request',
  clients: 'client',
  quotes: 'quote',
  invoices: 'invoice',
  tools: 'tool',
}

/** Où mène une notification touchée sur le téléphone, ou null. */
export function notificationRoute(n: AppNotification): { name: string; params?: Record<string, number>; query?: Record<string, string> } | null {
  if (n.subject_type && n.subject_id) {
    if (n.subject_type === 'tech-shares') return { name: 'tech-space' }
    const name = SUBJECT_ROUTES[n.subject_type]
    return name ? { name, params: { id: n.subject_id } } : null
  }
  if (n.client_request_id) return { name: 'client-request', params: { id: n.client_request_id } }
  if (n.tech_share_id) return { name: 'tech-share', params: { id: n.tech_share_id } }
  if (n.tech_access_request_id) return { name: 'tech-space', query: { onglet: 'demandes' } }
  if (n.tool_id) return { name: 'tool', params: { id: n.tool_id } }
  if (n.task_id) return { name: 'task', params: { id: n.task_id } }
  if (n.kind === 'site.assigned' && n.project_id) return { name: 'site', params: { projectId: n.project_id } }
  return null
}
