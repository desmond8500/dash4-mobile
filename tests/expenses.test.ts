import { describe, expect, it } from 'vitest'
import { visibleTabs } from '../src/tabs'
import { buildExpensePayload, expenseColor, todayIso, type ExpenseForm } from '../src/utils/expenses'

const form = (patch: Partial<ExpenseForm> = {}): ExpenseForm => ({
  label: 'Taxi chantier',
  amount: '5000',
  spentAt: '2026-11-18',
  categoryId: 2,
  spaceId: null,
  projectId: null,
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
      project_id: null,
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
