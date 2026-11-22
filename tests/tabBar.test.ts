import { describe, expect, it } from 'vitest'
import { splitTabs, TAB_BAR_SIZE } from '../src/tabs'

const can = (granted: string[]) => (wanted: string[]) => wanted.some((p) => granted.includes(p))

describe('barre du bas', () => {
  it("garde au plus 4 onglets et met le reste dans « Plus » (gestionnaire)", () => {
    const { bar, more } = splitTabs(
      'manager',
      can(['projects.view', 'tasks.view', 'clients.view', 'stock.view', 'accounting.view', 'invoices.view', 'client_requests.view', 'vehicles.view']),
    )
    expect(bar.map((t) => t.name)).toEqual(['home', 'tasks', 'projects', 'messages'])
    expect(bar.length).toBe(TAB_BAR_SIZE - 1)
    expect(more.map((t) => t.name)).toEqual(['client-requests', 'clients', 'stock', 'invoices', 'vehicles', 'expenses', 'profile'])
  })

  it('met les tâches et les rapports en bas pour un technicien', () => {
    const { bar, more } = splitTabs(
      'technician',
      can(['tasks.view.own', 'journals.view.own', 'tech_shares.view.own', 'client_requests.view.own', 'accounting.view.own', 'vehicles.view.own']),
    )
    expect(bar.map((t) => t.name)).toEqual(['home', 'tasks', 'journals', 'messages'])
    expect(more.map((t) => t.name)).toEqual(['tech-space', 'client-requests', 'vehicles', 'expenses', 'profile'])
  })

  it('garde tout dans la barre quand il y a peu d\'onglets', () => {
    const { bar, more } = splitTabs('manager', can(['clients.view']))
    expect(bar.map((t) => t.name)).toEqual(['home', 'clients', 'messages', 'profile'])
    expect(more).toEqual([])
  })
})
