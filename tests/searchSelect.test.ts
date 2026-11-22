import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { matches } from '../src/utils/home'

describe('recherche dans les listes', () => {
  it('trouve un projet ou une personne sans accents, mot par mot', () => {
    expect(matches('ecole thies', 'École Thiès — vidéo', null)).toBe(true)
    expect(matches('awa', 'Awa Diop', 'Cheffe de chantier')).toBe(true)
    expect(matches('awa ndiaye', 'Awa Diop')).toBe(false)
  })

  it('a un composant de choix avec recherche', async () => {
    const mod = await import('../src/components/SearchSelect.vue')
    expect(mod.default).toBeTruthy()
    expect(typeof mount).toBe('function')
  })
})
