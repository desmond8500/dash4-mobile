import type { Vehicle } from '@dash4/shared'

/** Gravité d'un véhicule : 2 = papier dépassé ou entretien en retard, 1 = à prévoir, 0 = rien. */
export function vehicleLevel(v: Pick<Vehicle, 'alerts'>): number {
  return Math.max(0, ...(v.alerts ?? []).map((a) => (a.state === 'expired' || a.state === 'late' ? 2 : a.state === 'soon' ? 1 : 0)))
}

/** Les véhicules à surveiller d'abord, puis par nom. */
export function sortVehicles(list: Vehicle[]): Vehicle[] {
  return [...list].sort((a, b) => vehicleLevel(b) - vehicleLevel(a) || a.name.localeCompare(b.name, 'fr', { numeric: true }))
}

/** Couleur Ionic d'un état (papier ou entretien). */
export function stateColor(state: string | null | undefined): string {
  return state === 'expired' || state === 'late' ? 'danger' : state === 'soon' ? 'warning' : 'success'
}

/** Relevés du compteur encore dans la file d'attente pour un véhicule. */
export function pendingMileages(
  pending: Array<{ type: string; path: string; payload: Record<string, unknown> }>,
  vehicleId: number,
): Array<{ km: number; read_on: string }> {
  return pending
    .filter((p) => p.type === 'vehicle-mileage' && p.path === `vehicles/${vehicleId}/mileages`)
    .map((p) => ({ km: Number(p.payload.km), read_on: String(p.payload.read_on ?? '') }))
}

/** Le compteur ne recule pas : erreur en français, ou null si le relevé est acceptable. */
export function mileageError(km: number | null, current: number): string | null {
  if (km === null || Number.isNaN(km)) return 'Indiquez le kilométrage du compteur.'
  if (km < 0) return 'Le kilométrage ne peut pas être négatif.'
  if (km < current) return `Le compteur ne peut pas reculer : dernier relevé à ${current.toLocaleString('fr-FR')} km.`
  return null
}
