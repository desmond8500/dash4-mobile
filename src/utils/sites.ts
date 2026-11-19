import type { Equipment, EquipmentStatus } from '@dash4/shared'
import { normalize } from '@/offline/collection'

/** Recherche dans un équipement : nom, type, modèle, n° de série et caractéristiques (adresse IP…). */
export function equipmentMatches(e: Equipment, query: string): boolean {
  const q = normalize(query)
  if (!q) return true
  const fields = [e.name, e.type, e.model, e.serial_number, ...e.characteristics.flatMap((c) => [c.label, c.value])]
  return fields.some((f) => normalize(f).includes(q))
}

export function statusColor(status: EquipmentStatus): string {
  return ({ planned: 'medium', installed: 'primary', commissioned: 'success', faulty: 'danger', removed: 'dark' } as const)[status]
}
