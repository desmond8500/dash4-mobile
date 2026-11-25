import { describe, expect, it } from 'vitest'
import { galaxyDimensionText } from '@dash4/shared'
import { visibleTabs } from '../src/tabs'

describe('outils pratiques sur le téléphone', () => {
  it('sont proposés aux gestionnaires comme aux techniciens', () => {
    expect(visibleTabs('manager', () => false).map((t) => t.name)).toContain('practical-tools')
    expect(visibleTabs('technician', () => false).map((t) => t.name)).toContain('practical-tools')
  })

  it('convertissent sans réseau (calcul du paquet partagé)', () => {
    expect(galaxyDimensionText('Zone 1').codes.join(' ')).toBe('45 31 28 18 10 01')
  })
})
