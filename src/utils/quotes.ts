import type { QuoteStatus } from '@dash4/shared'

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
