import { describe, expect, it } from 'vitest'
import { visibleTabs } from '../src/tabs'
import { accessRequestError, activeShares, expiresIn, isShareExpired, sortAccessRequests } from '../src/utils/techSpace'

const now = new Date(2026, 10, 19, 10, 0)
const share = (id: number, expires_at: string | null, patch: Record<string, unknown> = {}) => ({ id, expires_at, expired: false, deleted_at: null, expires_with_task: false, ...patch })

describe('informations temporaires sur le téléphone', () => {
  it('retire les informations expirées, même sans réseau', () => {
    const soon = new Date(2026, 10, 19, 11, 0).toISOString()
    const later = new Date(2026, 10, 20, 9, 0).toISOString()
    const past = new Date(2026, 10, 19, 9, 59).toISOString()
    expect(isShareExpired(share(1, past), now)).toBe(true)
    expect(isShareExpired(share(2, null, { expired: true }), now)).toBe(true)
    expect(isShareExpired(share(3, null, { expires_with_task: true }), now)).toBe(false)
    expect(activeShares([share(1, past), share(2, later), share(3, soon), share(4, null, { expires_with_task: true })], now).map((s) => s.id)).toEqual([3, 2, 4])
  })

  it('dit quand l\'information expire', () => {
    expect(expiresIn(share(1, new Date(2026, 10, 19, 10, 25).toISOString()), now)).toBe('dans 25 min')
    expect(expiresIn(share(1, new Date(2026, 10, 19, 18, 0).toISOString()), now)).toBe("aujourd'hui à 18:00")
    expect(expiresIn(share(1, new Date(2026, 10, 20, 8, 15).toISOString()), now)).toBe('demain à 08:15')
    expect(expiresIn(share(1, null, { expires_with_task: true }), now)).toBe("jusqu'à la fin de la tâche")
  })
})

describe('demandes d\'accès', () => {
  it('met les demandes en attente d\'abord', () => {
    const r = (id: number, status: string, created_at: string) => ({ id, status: { value: status as 'pending', label: '' }, created_at })
    expect(sortAccessRequests([r(1, 'approved', '2026-11-19'), r(2, 'pending', '2026-11-17'), r(3, 'pending', '2026-11-18')]).map((x) => x.id)).toEqual([3, 2, 1])
  })

  it('vérifie la demande avant de la garder', () => {
    expect(accessRequestError({ subject: ' ', neededOn: '' }, '2026-11-19')).toContain('Indiquez')
    expect(accessRequestError({ subject: 'Badge', neededOn: '2026-11-18' }, '2026-11-19')).toContain('passée')
    expect(accessRequestError({ subject: 'Badge', neededOn: '2026-11-19' }, '2026-11-19')).toBeNull()
  })

  it('montre l\'onglet Accès aux techniciens et aux chefs de projet', () => {
    const names = (type: 'manager' | 'technician', perms: string[]) => visibleTabs(type, (p) => p.some((x) => perms.includes(x))).map((t) => t.name)
    expect(names('technician', ['tech_shares.view.own', 'tech_access_requests.view.own'])).toContain('tech-space')
    expect(names('manager', ['tech_access_requests.view.own'])).toContain('tech-space')
    expect(names('technician', ['journals.view.own'])).not.toContain('tech-space')
  })
})
