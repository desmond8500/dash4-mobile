import { describe, expect, it } from 'vitest'
import type { Invoice } from '@dash4/shared'
import { collectSummary, invoiceBadge, invoiceStatusColor, sortInvoices } from '../src/utils/invoices'

const inv = (id: number, status: Invoice['status']['value'], remaining: number, extra: Partial<Invoice> = {}) =>
  ({ id, status: { value: status, label: status }, remaining_amount: remaining, is_overdue: false, deleted_at: null, issued_at: '2026-11-01', ...extra }) as Invoice

describe('factures sur le téléphone', () => {
  it('additionne le reste à encaisser et les retards des factures émises', () => {
    const list = [
      inv(1, 'issued', 100000),
      inv(2, 'partially_paid', 40000, { is_overdue: true }),
      inv(3, 'paid', 0),
      inv(4, 'draft', 999999),
      inv(5, 'cancelled', 50000),
      inv(6, 'issued', 70000, { deleted_at: '2026-11-10T00:00:00Z' }),
    ]
    expect(collectSummary(list)).toEqual({ toCollect: 140000, unpaidCount: 2, overdueAmount: 40000, overdueCount: 1 })
  })

  it('affiche « En retard » avant le statut et colore les statuts', () => {
    expect(invoiceBadge(inv(1, 'issued', 1, { is_overdue: true }))).toEqual({ label: 'En retard', color: 'danger' })
    expect(invoiceBadge(inv(1, 'paid', 0)).color).toBe('success')
    expect(invoiceStatusColor('partially_paid')).toBe('warning')
  })

  it('range les brouillons en tête puis les plus récentes', () => {
    const list = [inv(1, 'issued', 1, { issued_at: '2026-10-01' }), inv(2, 'draft', 1, { issued_at: null }), inv(3, 'paid', 0, { issued_at: '2026-11-15' })]
    expect(sortInvoices(list).map((i) => i.id)).toEqual([2, 3, 1])
  })
})
