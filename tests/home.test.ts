import { describe, expect, it } from 'vitest'
import { homeSearch, matches, quickActions } from '../src/utils/home'
import type { Article, Client, Project, Quote } from '@dash4/shared'

const client = { id: 1, name: 'Hôtel Téranga', phones: [{ number: '77 123 45 67' }] } as unknown as Client
const project = { id: 5, name: 'Vidéosurveillance hall', client: { id: 1, name: 'Hôtel Téranga' }, status: { value: 'in_progress', label: 'En cours' } } as unknown as Project
const quote = { id: 9, number: 'DEV-2026-0014', title: 'Caméras', client: { id: 1, name: 'Hôtel Téranga' }, project: null, status: { value: 'sent', label: 'Envoyé' } } as unknown as Quote
const article = { id: 3, designation: 'Caméra dôme 4 MP', reference: 'DS-2CD1143', barcode: '6941264012345', quantity: 12, unit: null } as unknown as Article

describe('accueil', () => {
  it('cherche sans accents ni majuscules, mot par mot', () => {
    expect(matches('hotel teranga', 'Hôtel Téranga')).toBe(true)
    expect(matches('teranga dakar', 'Hôtel Téranga')).toBe(false)
    expect(matches(' ', 'x')).toBe(false)
  })

  it('regroupe les résultats par type et mène à la bonne fiche', () => {
    const groups = homeSearch('teranga', { clients: [client], projects: [project], quotes: [quote], articles: [article] })
    expect(groups.map((g) => g.key)).toEqual(['clients', 'projects', 'quotes'])
    expect(groups[2]!.hits[0]).toMatchObject({ title: 'DEV-2026-0014 — Caméras', route: { name: 'quote', params: { id: 9 } } })
    expect(homeSearch('6941264012345', { articles: [article] })[0]!.hits[0]).toMatchObject({ subtitle: 'DS-2CD1143 · 12 u en stock', route: { name: 'stock-article' } })
    expect(homeSearch('7712', { clients: [client] })).toEqual([])
    expect(homeSearch('77 123', { clients: [client] })[0]!.hits[0]!.title).toBe('Hôtel Téranga')
    expect(homeSearch('t', { clients: [client] })).toEqual([])
  })

  it('montre la photo des articles trouvés', () => {
    expect(homeSearch('caméra', { articles: [{ ...article, image_url: 'https://api/x.png' } as Article] })[0]!.hits[0]!.image).toBe('https://api/x.png')
    expect(homeSearch('caméra', { articles: [article] })[0]!.hits[0]!.image).toBeNull()
    expect(homeSearch('hôtel', { clients: [client] })[0]!.hits[0]!.image).toBeUndefined()
  })

  it('montre les actions rapides que le compte peut faire', () => {
    const technician = quickActions('technician', (p) => p.some((x) => ['client_requests.create', 'journals.create', 'accounting.create.own', 'stock.view'].includes(x)))
    expect(technician.map((a) => a.key)).toEqual(['request', 'journal', 'expense'])
    expect(quickActions('manager', () => true).map((a) => a.key)).toEqual(['request', 'journal', 'scan', 'expense', 'client', 'clients'])
  })
})
