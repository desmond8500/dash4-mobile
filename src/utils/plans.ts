import type { Equipment, Plan, PlanMarker } from '@dash4/shared'
import { matches } from '@/utils/home'

export const MIN_ZOOM = 1
export const MAX_ZOOM = 6

/** Plans rangés par projet (ordre alphabétique des projets), filtrés par la recherche. */
export function groupPlansByProject(plans: Plan[], query = ''): Array<{ project: { id: number; name: string }; plans: Plan[] }> {
  const groups = new Map<number, { project: { id: number; name: string }; plans: Plan[] }>()
  for (const p of plans) {
    const project = p.project ?? { id: p.project_id, name: `Projet ${p.project_id}` }
    if (query.trim() && !matches(query, p.name, project.name, p.building?.name, p.level?.name)) continue
    const group = groups.get(project.id) ?? { project, plans: [] }
    group.plans.push(p)
    groups.set(project.id, group)
  }
  return [...groups.values()].sort((a, b) => a.project.name.localeCompare(b.project.name, 'fr'))
}

/** Lieu du plan : bâtiment › niveau. */
export function planPlace(p: Pick<Plan, 'building' | 'level'>): string | null {
  return [p.building?.name, p.level?.name].filter(Boolean).join(' › ') || null
}

/** Fichiers gardés sur le téléphone qui ne sont plus dans la liste (plan supprimé ou plus d'accès) : à effacer. */
export function staleFileIds(index: Record<string, string | null>, plans: Pick<Plan, 'id'>[]): number[] {
  const keep = new Set(plans.map((p) => p.id))
  return Object.keys(index).map(Number).filter((id) => !keep.has(id))
}

/** Le fichier gardé est-il à jour ? */
export function isFileFresh(index: Record<string, string | null>, plan: Pick<Plan, 'id' | 'updated_at'>): boolean {
  return Object.prototype.hasOwnProperty.call(index, String(plan.id)) && index[String(plan.id)] === plan.updated_at
}

export function clampZoom(z: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(z * 100) / 100))
}

/** Zoom à deux doigts : rapport des écarts entre les doigts. */
export function pinchZoom(startZoom: number, startDistance: number, distance: number): number {
  return startDistance > 0 ? clampZoom(startZoom * (distance / startDistance)) : startZoom
}

/**
 * Défilement après un changement de zoom, pour garder sous les doigts le même point du plan.
 * `cx`, `cy` : point visé, relatif au cadre visible.
 */
export function scrollAfterZoom(scroll: { left: number; top: number }, cx: number, cy: number, oldZoom: number, newZoom: number): { left: number; top: number } {
  const ratio = newZoom / oldZoom
  return { left: Math.max(0, (scroll.left + cx) * ratio - cx), top: Math.max(0, (scroll.top + cy) * ratio - cy) }
}

/** Défilement pour centrer un repère (position relative 0 à 1) dans le cadre visible. */
export function scrollToPoint(x: number, y: number, stage: { width: number; height: number }, view: { width: number; height: number }): { left: number; top: number } {
  return { left: Math.max(0, x * stage.width - view.width / 2), top: Math.max(0, y * stage.height - view.height / 2) }
}

/** Recherche d'un repère : libellé, ou équipement lié (nom, type, modèle, n° de série, caractéristiques). */
export function markerMatches(marker: Pick<PlanMarker, 'label'>, equipment: Equipment | null | undefined, query: string): boolean {
  if (!query.trim()) return true
  return matches(
    query,
    marker.label,
    equipment?.name,
    equipment?.type,
    equipment?.model,
    equipment?.serial_number,
    ...(equipment?.characteristics ?? []).flatMap((c) => [c.label, c.value]),
  )
}
