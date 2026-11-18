import { describe, expect, it } from 'vitest'
import { quoteStatusColor } from '../src/utils/quotes'

describe('devis sur le téléphone', () => {
  it('colore les statuts', () => {
    expect(quoteStatusColor('draft')).toBe('medium')
    expect(quoteStatusColor('sent')).toBe('primary')
    expect(quoteStatusColor('accepted')).toBe('success')
    expect(quoteStatusColor('refused')).toBe('danger')
  })
})
