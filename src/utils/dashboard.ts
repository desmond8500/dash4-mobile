import type { DashboardWidgets } from '@dash4/shared'

export interface HomeTile {
  label: string
  value: number
  route: { name: string; query?: Record<string, string> }
  tone?: 'danger' | 'warning'
}

/** Raccourcis de l'accueil du téléphone : seulement les chiffres non nuls que le compte peut voir. */
export function homeTiles(w: DashboardWidgets): HomeTile[] {
  const tiles: HomeTile[] = []
  const add = (value: number | undefined, label: string, route: HomeTile['route'], tone?: HomeTile['tone']) => {
    if (value) tiles.push({ label, value, route, tone })
  }
  add(w.client_requests?.open, 'Demandes à traiter', { name: 'client-requests' })
  add(w.client_requests?.late, 'Demandes en retard', { name: 'client-requests' }, 'danger')
  add(w.tech_space?.to_decide, "Demandes d'accès à décider", { name: 'tech-space', query: { onglet: 'demandes' } }, 'warning')
  add(w.tech_space?.unread_shares, 'Informations non lues', { name: 'tech-space' })
  add(w.team_tasks?.overdue, "Tâches de l'équipe en retard", { name: 'tasks' }, 'danger')
  add(w.expenses?.to_validate, 'Dépenses à valider', { name: 'expenses' }, 'warning')
  add(w.expenses?.my_submitted, 'Mes dépenses en attente', { name: 'expenses' })
  add(w.stock?.low, 'Articles sous le seuil', { name: 'stock' }, 'warning')
  add(w.purchases?.awaiting, 'Achats à réceptionner', { name: 'stock' })
  return tiles
}
