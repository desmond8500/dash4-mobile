import { describe, expect, it } from 'vitest'
import { visibleTabs } from '../src/tabs'
import { buildExpensePayload, decideLocally, expenseColor, expensesToReview, todayIso, type ExpenseForm } from '../src/utils/expenses'
import type { Expense } from '@dash4/shared'

const form = (patch: Partial<ExpenseForm> = {}): ExpenseForm => ({
  label: 'Taxi chantier',
  amount: '5000',
  spentAt: '2026-11-18',
  categoryId: 2,
  spaceId: null,
  projectId: 7,
  quoteId: null,
  method: 'cash',
  advanced: true,
  description: '  ',
  ...patch,
})

describe('dépenses sur le téléphone', () => {
  it('prépare la dépense à envoyer', () => {
    expect(buildExpensePayload(form(), '2026-11-18').payload).toEqual({
      label: 'Taxi chantier',
      amount: 5000,
      spent_at: '2026-11-18',
      expense_category_id: 2,
      expense_space_id: null,
      project_id: 7,
      payment_method: 'cash',
      advanced: true,
      description: null,
    })
  })

  it('refuse une dépense incomplète ou datée dans le futur', () => {
    expect(buildExpensePayload(form({ label: ' ' }), '2026-11-18').error).toBe('Indiquez ce que vous avez payé.')
    expect(buildExpensePayload(form({ amount: 0 }), '2026-11-18').error).toBe('Indiquez le montant.')
    expect(buildExpensePayload(form({ amount: 'abc' }), '2026-11-18').error).toBe('Indiquez le montant.')
    expect(buildExpensePayload(form({ spentAt: '2026-11-19' }), '2026-11-18').error).toBe('La date ne peut pas être dans le futur.')
    expect(buildExpensePayload(form({ projectId: null }), '2026-11-18').error).toBe('Liez la dépense à un projet ou à un devis.')
    expect(buildExpensePayload(form({ projectId: null, quoteId: 12 }), '2026-11-18').payload).toMatchObject({ quote_id: 12, project_id: null })
  })

  it('range les dépenses à vérifier et applique la décision tout de suite', () => {
    const e = (id: number, status: string, extra: Partial<Expense> = {}) => ({ id, status: { value: status, label: status }, advanced: false, to_reimburse: false, rejection_reason: null, ...extra }) as unknown as Expense
    const review = expensesToReview([e(1, 'submitted'), e(2, 'approved', { to_reimburse: true }), e(3, 'approved')])
    expect(review.toValidate.map((x) => x.id)).toEqual([1])
    expect(review.toReimburse.map((x) => x.id)).toEqual([2])
    expect(decideLocally(e(1, 'submitted', { advanced: true }), 'approve')).toMatchObject({ status: { value: 'approved' }, to_reimburse: true })
    expect(decideLocally(e(1, 'submitted'), 'reject', 'Pas de reçu')).toMatchObject({ status: { value: 'rejected' }, rejection_reason: 'Pas de reçu' })
    expect(decideLocally(e(2, 'approved', { to_reimburse: true }), 'reimburse')).toMatchObject({ status: { value: 'reimbursed' }, to_reimburse: false })
  })

  it('date du jour et couleurs des statuts', () => {
    expect(todayIso(new Date(2026, 0, 5))).toBe('2026-01-05')
    expect(expenseColor('submitted')).toBe('warning')
    expect(expenseColor('rejected')).toBe('danger')
  })

  it('donne l\'onglet Dépenses aux techniciens comme aux gestionnaires', () => {
    const can = (p: string[]) => p.includes('accounting.view.own')
    expect(visibleTabs('technician', can).map((t) => t.name)).toContain('expenses')
    expect(visibleTabs('manager', can).map((t) => t.name)).toContain('expenses')
    expect(visibleTabs('technician', () => false).map((t) => t.name)).not.toContain('expenses')
  })
})
