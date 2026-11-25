import { describe, expect, it } from 'vitest'
import { quantitiesChoices, quoteStatusColor } from '../src/utils/quotes'

describe('devis sur le téléphone', () => {
  it('colore les statuts', () => {
    expect(quoteStatusColor('draft')).toBe('medium')
    expect(quoteStatusColor('sent')).toBe('primary')
    expect(quoteStatusColor('accepted')).toBe('success')
    expect(quoteStatusColor('refused')).toBe('danger')
  })
})

describe('quantitatif du devis', () => {
  const line = (value: string) => ({ category: { value, label: value } }) as never
  const section = (id: number, title: string, lines: never[], is_visible = true) => ({ id, title, is_visible, lines })

  it('propose tout le devis puis les sections imprimées qui ont du matériel', () => {
    expect(
      quantitiesChoices([
        section(1, 'Bâtiment A', [line('device'), line('service')]),
        section(2, 'Main-d\'œuvre', [line('service')]),
        section(3, 'Option', [line('device')], false),
        section(4, 'Bâtiment B', [line('cable')]),
      ]),
    ).toEqual([{ label: 'Tout le devis' }, { label: 'Bâtiment A', sectionId: 1 }, { label: 'Bâtiment B', sectionId: 4 }])
  })

  it('ne compte pas les lignes retirées du quantitatif', () => {
    const hidden = { category: { value: 'device', label: 'Organe' }, show_in_quantities: false } as never
    expect(quantitiesChoices([section(1, 'Bâtiment A', [hidden])])).toEqual([])
  })

  it('ne propose rien sans matériel', () => {
    expect(quantitiesChoices([section(1, 'Forfaits', [line('service')])])).toEqual([])
  })
})
