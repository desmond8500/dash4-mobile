import { describe, expect, it } from 'vitest'
import type { Article } from '@dash4/shared'
import { TABS, visibleTabs } from '../src/tabs'
import { findByCode, formatQty, projectedQuantity, scannerSupported, stockBadge } from '../src/utils/stock'

const item = (type: string, quantity: number) => ({ payload: { type, quantity } })

describe('stock sur le téléphone', () => {
  it('ajoute au stock les mouvements pas encore envoyés, dans l\'ordre', () => {
    expect(projectedQuantity(10, [item('out', 3), item('in', 2)])).toBe(9)
    expect(projectedQuantity(10, [item('out', 3), item('inventory', 7), item('out', 1)])).toBe(6)
    expect(projectedQuantity(4, [])).toBe(4)
  })

  it('retrouve un article scanné par code-barres, puis par référence', () => {
    const articles = [
      { id: 1, barcode: null, reference: 'DS-2CD', deleted_at: null },
      { id: 2, barcode: '6941264012345', reference: 'X', deleted_at: null },
      { id: 3, barcode: '111', reference: null, deleted_at: '2026-11-01' },
    ] as Array<Pick<Article, 'barcode' | 'reference' | 'deleted_at'> & { id: number }>
    expect(findByCode(articles, ' 6941264012345 ')?.id).toBe(2)
    expect(findByCode(articles, 'ds-2cd')?.id).toBe(1)
    expect(findByCode(articles, '111')).toBeUndefined()
    expect(findByCode(articles, '')).toBeUndefined()
  })

  it('affiche rupture, stock bas, en stock', () => {
    expect(stockBadge({ quantity: 0, is_low: true }).label).toBe('Rupture')
    expect(stockBadge({ quantity: 2, is_low: true }).color).toBe('warning')
    expect(stockBadge({ quantity: 8, is_low: false }).color).toBe('success')
    expect(formatQty(2.5)).toBe('2,5')
  })

  it('ne propose le scan que si le navigateur sait lire les codes', () => {
    expect(scannerSupported({ BarcodeDetector: class {}, navigator: { mediaDevices: {} } })).toBe(true)
    expect(scannerSupported({ navigator: { mediaDevices: {} } })).toBe(false)
  })

  it('donne l\'onglet Stock aux gestionnaires qui voient le stock, jamais aux techniciens', () => {
    expect(TABS.some((t) => t.name === 'stock')).toBe(true)
    expect(visibleTabs('manager', (p) => p.includes('stock.view')).map((t) => t.name)).toContain('stock')
    expect(visibleTabs('technician', (p) => p.includes('stock.view')).map((t) => t.name)).not.toContain('stock')
  })
})
