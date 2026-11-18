import type { ProjectStatus } from '@dash4/shared'

export function projectStatusColor(status: ProjectStatus): string {
  switch (status) {
    case 'in_progress':
      return 'primary'
    case 'on_hold':
      return 'warning'
    case 'completed':
      return 'success'
    case 'cancelled':
      return 'danger'
    default:
      return 'medium'
  }
}

/** « 01/12/2026 » à partir de « 2026-12-01 ». */
export function formatDate(iso: string | null): string {
  if (!iso) return ''
  const [y, m, d] = iso.slice(0, 10).split('-')
  return d && m && y ? `${d}/${m}/${y}` : ''
}

export function periodLabel(start: string | null, end: string | null): string {
  if (start && end) return `du ${formatDate(start)} au ${formatDate(end)}`
  if (start) return `à partir du ${formatDate(start)}`
  if (end) return `jusqu'au ${formatDate(end)}`
  return ''
}

/** Itinéraire vers le chantier : GPS en priorité, sinon l'adresse. */
export function directionsUrl(lat: number | null, lng: number | null, address: string | null): string | null {
  if (lat !== null && lng !== null) return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
  if (address) return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`
  return null
}

export function fileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`
  return `${(bytes / (1024 * 1024)).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Mo`
}
