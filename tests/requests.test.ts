import { describe, expect, it } from 'vitest'
import { isOverdue, sortRequests } from '../src/offline/collection'
import { visibleTabs } from '../src/tabs'
import { buildRequestPayload, requesterLabel, statusColor } from '../src/utils/requests'

const req = (id: number, priority: string, created_at: string, status = 'new') => ({
  id,
  priority: { value: priority },
  status: { value: status },
  created_at,
})

describe('demandes clients sur le téléphone', () => {
  it('classe les urgentes en premier, puis les plus récentes', () => {
    const sorted = sortRequests([
      req(1, 'normal', '2026-11-17T10:00:00Z'),
      req(2, 'high', '2026-11-10T10:00:00Z'),
      req(3, 'normal', '2026-11-18T10:00:00Z'),
      req(4, 'low', '2026-11-18T11:00:00Z'),
    ])
    expect(sorted.map((r) => r.id)).toEqual([2, 3, 1, 4])
  })

  it('signale une demande encore « Nouvelle » après 2 jours, même hors ligne', () => {
    const now = new Date('2026-11-18T12:00:00Z')
    expect(isOverdue(req(1, 'normal', '2026-11-16T11:00:00Z'), 2, now)).toBe(true)
    expect(isOverdue(req(2, 'normal', '2026-11-17T12:00:00Z'), 2, now)).toBe(false)
    expect(isOverdue(req(3, 'normal', '2026-11-01T12:00:00Z', 'in_progress'), 2, now)).toBe(false)
  })

  it('prépare la saisie express : un client choisi remplace le nom et le téléphone', () => {
    expect(
      buildRequestPayload({
        body: '  Deux caméras en plus ',
        clientId: 4,
        contactName: 'Awa',
        contactPhone: '77',
        source: 'whatsapp',
        priority: 'high',
      }),
    ).toEqual({
      body: 'Deux caméras en plus',
      client_id: 4,
      contact_name: null,
      contact_phone: null,
      source: 'whatsapp',
      priority: 'high',
    })

    expect(
      buildRequestPayload({ body: 'Interphone', clientId: null, contactName: ' Awa ', contactPhone: '', source: 'visit', priority: 'normal' }),
    ).toMatchObject({ client_id: null, contact_name: 'Awa', contact_phone: null })
  })

  it('affiche le demandeur et la couleur du statut', () => {
    expect(requesterLabel({ client: null, contact_name: null, contact_phone: '77 000 00 00' })).toBe('77 000 00 00')
    expect(statusColor('in_progress')).toBe('warning')
  })
})

describe('onglet Demandes', () => {
  const names = (type: 'manager' | 'technician', permissions: string[]) =>
    visibleTabs(type, (wanted) => wanted.some((p) => permissions.includes(p))).map((t) => t.name)

  it('apparaît pour le technicien (ses demandes) comme pour le bureau', () => {
    expect(names('technician', ['client_requests.view.own', 'client_requests.create'])).toEqual([
      'home',
      'client-requests',
      'profile',
    ])
    expect(names('manager', ['client_requests.view', 'clients.view'])).toEqual([
      'home',
      'client-requests',
      'clients',
      'profile',
    ])
  })

  it("n'apparaît pas sans droit sur les demandes", () => {
    expect(names('manager', ['stock.view'])).toEqual(['home', 'profile'])
  })
})
