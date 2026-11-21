import { describe, expect, it } from 'vitest'
import { mileageError, pendingMileages, sortVehicles, stateColor, vehicleLevel } from '../src/utils/fleet'
import type { Vehicle } from '@dash4/shared'

const v = (name: string, states: string[]): Vehicle => ({ name, alerts: states.map((s) => ({ kind: 'paper', state: s, label: 'A', date: null })) }) as unknown as Vehicle

describe('parc automobile (mobile)', () => {
  it('met les véhicules à surveiller en tête', () => {
    expect(vehicleLevel(v('a', ['soon', 'expired']))).toBe(2)
    expect(sortVehicles([v('B', []), v('A', ['soon']), v('C', ['late'])]).map((x) => x.name)).toEqual(['C', 'A', 'B'])
    expect(stateColor('soon')).toBe('warning')
  })

  it('retrouve les relevés en attente et refuse un compteur qui recule', () => {
    const pending = [
      { type: 'vehicle-mileage', path: 'vehicles/3/mileages', payload: { km: 5300, read_on: '2026-11-21' } },
      { type: 'expense', path: 'expenses', payload: {} },
    ]
    expect(pendingMileages(pending, 3)).toEqual([{ km: 5300, read_on: '2026-11-21' }])
    expect(pendingMileages(pending, 4)).toEqual([])
    expect(mileageError(null, 0)).toBe('Indiquez le kilométrage du compteur.')
    expect(mileageError(4000, 5000)).toContain('ne peut pas reculer')
    expect(mileageError(5000, 5000)).toBeNull()
  })
})
