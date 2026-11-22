import type { Expense, ExpensePayload, ExpenseStatus, PaymentMethod } from '@dash4/shared'

export function expenseColor(status: ExpenseStatus): string {
  switch (status) {
    case 'submitted':
      return 'warning'
    case 'approved':
      return 'primary'
    case 'reimbursed':
      return 'success'
    default:
      return 'danger'
  }
}

export interface ExpenseForm {
  label: string
  amount: number | string | null
  spentAt: string
  categoryId: number | null
  spaceId: number | null
  projectId: number | null
  /** Devis (gestionnaires) : la dépense prend aussi le projet du devis. */
  quoteId: number | null
  method: PaymentMethod
  advanced: boolean
  description: string
}

/** Contrôle et prépare la dépense ; renvoie un message d'erreur en français si elle est incomplète. */
export function buildExpensePayload(form: ExpenseForm, today: string): { payload?: ExpensePayload & { label: string; amount: number; spent_at: string }; error?: string } {
  const amount = Math.round(Number(form.amount))
  if (!form.label.trim()) return { error: 'Indiquez ce que vous avez payé.' }
  if (!Number.isFinite(amount) || amount <= 0) return { error: 'Indiquez le montant.' }
  if (!form.spentAt || form.spentAt > today) return { error: 'La date ne peut pas être dans le futur.' }
  if (!form.projectId && !form.quoteId) return { error: 'Liez la dépense à un projet ou à un devis.' }

  return {
    payload: {
      label: form.label.trim(),
      amount,
      spent_at: form.spentAt,
      expense_category_id: form.categoryId,
      expense_space_id: form.spaceId,
      project_id: form.projectId,
      ...(form.quoteId ? { quote_id: form.quoteId } : {}),
      payment_method: form.method,
      advanced: form.advanced,
      description: form.description.trim() || null,
    },
  }
}

/** Date locale au format AAAA-MM-JJ. */
export function todayIso(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

/** Dépenses à vérifier par la comptabilité : à valider d'abord, puis à rembourser (avancées et validées). */
export function expensesToReview(list: Expense[]): { toValidate: Expense[]; toReimburse: Expense[] } {
  return {
    toValidate: list.filter((e) => e.status.value === 'submitted'),
    toReimburse: list.filter((e) => e.to_reimburse),
  }
}

/** Copie locale après une décision (affichée tout de suite, envoyée au retour du réseau). */
export function decideLocally(expense: Expense, action: 'approve' | 'reject' | 'reimburse', reason: string | null = null): Expense {
  if (action === 'approve') return { ...expense, status: { value: 'approved', label: 'Validée' }, rejection_reason: null, to_reimburse: !!expense.advanced }
  if (action === 'reject') return { ...expense, status: { value: 'rejected', label: 'Refusée' }, rejection_reason: reason, to_reimburse: false }
  return { ...expense, status: { value: 'reimbursed', label: 'Remboursée' }, to_reimburse: false }
}
