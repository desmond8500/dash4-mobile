import { describe, expect, it } from 'vitest'
import { homeTiles } from '../src/utils/dashboard'

describe('accueil du téléphone', () => {
  it('ne garde que les chiffres non nuls que le compte peut voir', () => {
    const tiles = homeTiles({
      client_requests: { open: 3, new: 1, late: 0, reminders: 0 },
      tech_space: { unread_shares: 2, my_pending_requests: 0, to_decide: 0 },
    })
    expect(tiles.map((t) => t.label)).toEqual(['Demandes à traiter', 'Informations non lues'])
    expect(homeTiles({})).toEqual([])
  })
})
