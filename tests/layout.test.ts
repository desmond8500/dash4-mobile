import { describe, expect, it } from 'vitest'
import { besideFab } from '../src/utils/layout'

describe('bouton « Haut de page »', () => {
  it('se place à gauche du bouton rond d\'ajout, centré sur lui', () => {
    // Écran 390 × 844 ; bouton d'ajout de 56 px dans le coin, au-dessus de la barre d'onglets
    const fab = { left: 324, top: 720, height: 56 }
    expect(besideFab(fab, 390, 844)).toEqual({ right: '78px', bottom: '76px' })
  })
})
