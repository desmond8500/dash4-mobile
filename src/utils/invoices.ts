import type { Invoice, InvoiceStatus } from '@dash4/shared'

export function invoiceStatusColor(status: InvoiceStatus): string {
  switch (status) {
    case 'issued':
      return 'primary'
    case 'partially_paid':
      return 'warning'
    case 'paid':
      return 'success'
    case 'cancelled':
      return 'dark'
    default:
      return 'medium'
  }
}

/** Badge d'une facture : « En retard » passe avant le statut. */
export function invoiceBadge(invoice: Pick<Invoice, 'status' | 'is_overdue'>): { label: string; color: string } {
  return invoice.is_overdue ? { label: 'En retard', color: 'danger' } : { label: invoice.status.label, color: invoiceStatusColor(invoice.status.value) }
}

const open = (i: Pick<Invoice, 'status'>) => i.status.value === 'issued' || i.status.value === 'partially_paid'

/** À encaisser et en retard, calculés sur les factures gardées sur le téléphone (aussi hors ligne). */
export function collectSummary(invoices: Array<Pick<Invoice, 'status' | 'is_overdue' | 'remaining_amount' | 'deleted_at'>>): {
  toCollect: number
  unpaidCount: number
  overdueAmount: number
  overdueCount: number
} {
  const unpaid = invoices.filter((i) => !i.deleted_at && open(i))
  const overdue = unpaid.filter((i) => i.is_overdue)
  const sum = (list: typeof unpaid) => list.reduce((t, i) => t + i.remaining_amount, 0)
  return { toCollect: sum(unpaid), unpaidCount: unpaid.length, overdueAmount: sum(overdue), overdueCount: overdue.length }
}

/** Tri : brouillons d'abord, puis les plus récentes. */
export function sortInvoices<T extends Pick<Invoice, 'id' | 'issued_at' | 'status'>>(list: T[]): T[] {
  return [...list].sort(
    (a, b) =>
      Number(b.status.value === 'draft') - Number(a.status.value === 'draft') ||
      (b.issued_at ?? '').localeCompare(a.issued_at ?? '') ||
      b.id - a.id,
  )
}

export const isUnpaid = open
