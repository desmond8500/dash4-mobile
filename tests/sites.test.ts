import { describe, expect, it } from 'vitest'
import type { Equipment } from '@dash4/shared'
import { equipmentMatches, statusColor } from '../src/utils/sites'

const e = { id: 1, name: 'Enregistreur 16 voies', type: 'NVR', model: 'DS-7616', serial_number: 'SN-42', characteristics: [{ label: 'Adresse IP', value: '192.168.1.10' }] } as unknown as Equipment

describe('chantier sur le téléphone', () => {
  it('cherche un équipement par nom, type, n° de série ou caractéristique', () => {
    expect(equipmentMatches(e, 'enregistreur')).toBe(true)
    expect(equipmentMatches(e, '192.168.1.10')).toBe(true)
    expect(equipmentMatches(e, 'sn-42')).toBe(true)
    expect(equipmentMatches(e, 'caméra')).toBe(false)
    expect(equipmentMatches(e, '')).toBe(true)
  })

  it('colore l\'état des équipements', () => {
    expect(statusColor('faulty')).toBe('danger')
    expect(statusColor('commissioned')).toBe('success')
  })
})
