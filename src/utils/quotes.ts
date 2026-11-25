import type { QuoteSection, QuoteStatus } from '@dash4/shared'

export function quoteStatusColor(status: QuoteStatus): string {
  switch (status) {
    case 'sent':
      return 'primary'
    case 'accepted':
      return 'success'
    case 'refused':
      return 'danger'
    default:
      return 'medium'
  }
}

/**
 * Choix proposés pour le quantitatif (sans forfaits, main-d'œuvre ni lignes retirées sur le web) : tout le devis s'il a du matériel
 * dans ses sections imprimées, puis chaque section imprimée qui en a.
 */
export function quantitiesChoices(
  sections: Array<Pick<QuoteSection, 'id' | 'title' | 'is_visible' | 'lines'>>,
): Array<{ label: string; sectionId?: number }> {
  const withMaterial = sections.filter((s) => s.is_visible && s.lines.some((l) => l.category.value !== 'service' && l.show_in_quantities !== false))
  if (!withMaterial.length) return []
  return [{ label: 'Tout le devis' }, ...withMaterial.map((s) => ({ label: s.title, sectionId: s.id }))]
}
