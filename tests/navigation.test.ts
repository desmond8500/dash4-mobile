import { describe, expect, it } from 'vitest'
import type { RouteLocationNormalized } from 'vue-router'
import { resolveNavigation, type GuardState } from '../src/router/guard'
import { TABS, visibleTabs } from '../src/tabs'

function route(name: string, meta: RouteLocationNormalized['meta'] = {}) {
  return { name, meta, fullPath: `/${name}` } as RouteLocationNormalized
}

function state(partial: Partial<GuardState> = {}): GuardState {
  return { isAuthenticated: true, accountType: 'manager', canAny: () => false, ...partial }
}

describe('navigation mobile', () => {
  it('envoie vers la connexion sans session', () => {
    expect(resolveNavigation(route('home'), state({ isAuthenticated: false, accountType: null }))).toEqual({
      name: 'login',
    })
  })

  it("bloque un écran réservé à l'autre type de compte, même par un lien direct", () => {
    const managerOnly = route('quotes', { accountTypes: ['manager'] })
    expect(resolveNavigation(managerOnly, state({ accountType: 'technician' }))).toEqual({ name: 'home' })
    expect(resolveNavigation(managerOnly, state({ accountType: 'manager' }))).toBe(true)
  })

  it('bloque un écran sans la permission nécessaire', () => {
    const page = route('stock', { permissions: ['stock.view'] })
    expect(resolveNavigation(page, state())).toEqual({ name: 'home' })
    expect(resolveNavigation(page, state({ canAny: () => true }))).toBe(true)
  })
})

describe("documentation d'un article depuis le chantier", () => {
  it("est ouverte au technicien qui voit le stock, contrairement à la fiche de l'article", () => {
    const tech = state({ accountType: 'technician', canAny: (p: string[]) => p.includes('stock.view') })
    expect(resolveNavigation(route('article-docs', { permissions: ['stock.view'] }), tech)).toBe(true)
    expect(resolveNavigation(route('stock-article', { accountTypes: ['manager'], permissions: ['stock.view'] }), tech)).toEqual({ name: 'home' })
  })
})

describe('onglets', () => {
  it('filtre les onglets par type de compte et par permission', () => {
    const original = [...TABS]
    TABS.push(
      { name: 'quotes', label: 'Devis', icon: '', accountTypes: ['manager'], permissions: ['quotes.view'] },
      { name: 'tasks', label: 'Tâches', icon: '', accountTypes: ['technician'], permissions: [] },
    )

    const technician = visibleTabs('technician', () => true).map((t) => t.name)
    const manager = visibleTabs('manager', (p) => p.includes('quotes.view')).map((t) => t.name)

    expect(technician).toContain('tasks')
    expect(technician).not.toContain('quotes')
    expect(manager).toContain('quotes')
    expect(manager).not.toContain('tasks')

    TABS.splice(0, TABS.length, ...original)
  })
})
