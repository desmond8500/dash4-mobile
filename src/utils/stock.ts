import type { Article } from '@dash4/shared'
import type { OutboxItem } from '@/offline/outbox'

export function formatQty(value: number | null | undefined): string {
  return (value ?? 0).toLocaleString('fr-FR', { maximumFractionDigits: 2 })
}

/** Couleur et libellé de l'état du stock. */
export function stockBadge(article: Pick<Article, 'quantity' | 'is_low'>): { label: string; color: string } {
  if (article.quantity <= 0) return { label: 'Rupture', color: 'danger' }
  if (article.is_low) return { label: 'Stock bas', color: 'warning' }
  return { label: 'En stock', color: 'success' }
}

/**
 * Quantité attendue une fois les mouvements en attente envoyés (entrées, sorties, inventaires
 * dans l'ordre), pour afficher un stock à jour même hors ligne.
 */
export function projectedQuantity(quantity: number, pending: Array<Pick<OutboxItem, 'payload'>>): number {
  return pending.reduce((qty, item) => {
    const amount = Number(item.payload.quantity ?? 0)
    switch (item.payload.type) {
      case 'in':
        return qty + amount
      case 'out':
        return qty - amount
      case 'inventory':
        return amount
      default:
        return qty
    }
  }, quantity)
}

/** Article dont le code-barres ou la référence correspond exactement au code scanné. */
export function findByCode<T extends Pick<Article, 'barcode' | 'reference' | 'deleted_at'>>(articles: T[], code: string): T | undefined {
  const wanted = code.trim().toLowerCase()
  if (!wanted) return undefined
  return (
    articles.find((a) => !a.deleted_at && a.barcode?.toLowerCase() === wanted) ??
    articles.find((a) => !a.deleted_at && a.reference?.toLowerCase() === wanted)
  )
}

/** Scan possible : API BarcodeDetector du navigateur et caméra. */
export function scannerSupported(win: unknown = typeof window === 'undefined' ? undefined : window): boolean {
  const w = win as { BarcodeDetector?: unknown; navigator?: { mediaDevices?: unknown } } | undefined
  return !!w?.BarcodeDetector && !!w.navigator?.mediaDevices
}
