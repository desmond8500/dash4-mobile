import { describe, expect, it } from 'vitest'
import {
  matchesSearch,
  mergeChanges,
  normalize,
  pendingCreations,
  plain,
  sortByFavoriteThenName,
} from '../src/offline/collection'
import type { OutboxItem } from '../src/offline/outbox'
import { visibleTabs } from '../src/tabs'
import { buildClientPayload, buildContactPayload } from '../src/utils/forms'
import { initials, telHref } from '../src/utils/links'

const row = (id: number, name: string, deleted_at: string | null = null) => ({ id, name, deleted_at })

describe('copie locale synchronisée', () => {
  it('remplace les fiches modifiées, ajoute les nouvelles et retire les supprimées', () => {
    const local = [row(1, 'Ancien nom'), row(2, 'Supprimé ailleurs'), row(3, 'Inchangé')]
    const changes = [row(1, 'Nouveau nom'), row(2, 'Supprimé ailleurs', '2026-11-18T10:00:00+00:00'), row(4, 'Nouveau')]

    const merged = mergeChanges(local, changes)

    expect(merged.map((r) => [r.id, r.name])).toEqual([
      [1, 'Nouveau nom'],
      [3, 'Inchangé'],
      [4, 'Nouveau'],
    ])
  })

  it('ignore une suppression de fiche jamais téléchargée', () => {
    expect(mergeChanges([row(1, 'A')], [row(9, 'X', '2026-11-18T10:00:00+00:00')])).toEqual([row(1, 'A')])
  })

  it('rend une copie enregistrable, sans lien avec l\'objet d\'origine', () => {
    const source = { name: 'A', phones: [{ number: '77' }] }
    const copy = plain(source)
    copy.phones[0]!.number = '78'
    expect(source.phones[0]!.number).toBe('77')
  })
})

describe('recherche hors ligne', () => {
  it('ignore les accents et les majuscules', () => {
    expect(normalize('  Société  Générale ')).toBe('societe generale')
    expect(matchesSearch('societe gen', ['Société Générale'])).toBe(true)
    expect(matchesSearch('ÉCOLE', ['ecole Mariama Bâ'])).toBe(true)
  })

  it('trouve un numéro tapé sans espaces et exige tous les mots', () => {
    expect(matchesSearch('770000', ['Sonatel', '77 00 00 01'])).toBe(true)
    expect(matchesSearch('sonatel dakar', ['Sonatel', 'Thiès'])).toBe(false)
    expect(matchesSearch('', ['peu importe'])).toBe(true)
  })

  it('classe les favoris en premier puis par ordre alphabétique', () => {
    const items = [
      { name: 'Zeta', is_favorite: false },
      { name: 'Éole', is_favorite: false },
      { name: 'Banque', is_favorite: true },
      { name: 'Alpha', is_favorite: false },
    ]
    expect(sortByFavoriteThenName(items).map((i) => i.name)).toEqual(['Banque', 'Alpha', 'Éole', 'Zeta'])
  })
})

describe('créations en attente', () => {
  const item = (path: string, method: OutboxItem['method'] = 'POST'): OutboxItem => ({
    id: path + method,
    type: 'x',
    label: 'x',
    method,
    path,
    payload: {},
    createdAt: 0,
    attempts: 0,
  })

  it('ne garde que les créations du module demandé', () => {
    const items = [item('clients'), item('contacts'), item('clients/3', 'PATCH')]
    expect(pendingCreations(items, 'clients').map((i) => i.id)).toEqual(['clientsPOST'])
  })
})

describe('saisie rapide', () => {
  it('prépare un client avec son premier téléphone et e-mail', () => {
    expect(
      buildClientPayload({
        name: ' Sonatel ',
        type: 'company',
        status: 'prospect',
        phone: ' 33 839 00 00 ',
        email: '',
        address: '',
        description: ' RDV lundi ',
      }),
    ).toEqual({
      name: 'Sonatel',
      type: 'company',
      status: 'prospect',
      address: null,
      description: 'RDV lundi',
      phones: [{ label: null, number: '33 839 00 00' }],
      emails: [],
    })
  })

  it('rattache le contact au client', () => {
    expect(
      buildContactPayload({ firstname: 'Awa', lastname: '', job_title: 'DAF', phone: '', email: 'awa@x.sn' }, 5),
    ).toEqual({ client_id: 5, firstname: 'Awa', lastname: null, job_title: 'DAF', phone: null, email: 'awa@x.sn' })
  })

  it('crée un lien d\'appel sans espaces', () => {
    expect(telHref('+221 77 000-00-00')).toBe('tel:+221770000000')
  })
})

describe('onglet Clients', () => {
  const names = (type: 'manager' | 'technician', permissions: string[]) =>
    visibleTabs(type, (wanted) => wanted.some((p) => permissions.includes(p))).map((t) => t.name)

  it('apparaît pour un gestionnaire qui voit les clients', () => {
    expect(names('manager', ['clients.view'])).toEqual(['home', 'clients', 'practical-tools', 'messages', 'profile'])
    expect(names('manager', [])).toEqual(['home', 'practical-tools', 'messages', 'profile'])
  })

  it("n'apparaît jamais pour un technicien", () => {
    expect(names('technician', ['clients.view'])).toEqual(['home', 'practical-tools', 'messages', 'profile'])
  })
})

describe('logo', () => {
  it('affiche les initiales à défaut de logo', () => {
    expect(initials('Société Générale')).toBe('SG')
    expect(initials('Sonatel')).toBe('SO')
    expect(initials('')).toBe('?')
  })
})
