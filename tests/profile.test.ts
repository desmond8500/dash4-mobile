import { describe, expect, it } from 'vitest'
import type { CurrentUser } from '@dash4/shared'
import { applyProfile, profileChanges } from '../src/utils/profile'

const user = {
  id: 1,
  firstname: 'Awa',
  lastname: 'Ndiaye',
  full_name: 'Awa Ndiaye',
  phone: null,
  job_title: 'Technicienne',
} as unknown as CurrentUser

describe('profil hors ligne', () => {
  it('met à jour le nom complet', () => {
    expect(applyProfile(user, { lastname: 'Diop' }).full_name).toBe('Awa Diop')
  })

  it('n\'envoie que les champs changés', () => {
    expect(profileChanges(user, { firstname: 'Awa', lastname: 'Ndiaye', phone: '', job_title: 'Technicienne' })).toEqual({})
    expect(profileChanges(user, { firstname: ' Awa ', lastname: 'Ndiaye', phone: '77 1', job_title: '' })).toEqual({ phone: '77 1', job_title: null })
  })
})
