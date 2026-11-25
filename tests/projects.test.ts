import { describe, expect, it } from 'vitest'
import { visibleTabs } from '../src/tabs'
import { directionsUrl, fileSize, periodLabel, projectStatusColor } from '../src/utils/projects'

describe('projets sur le téléphone', () => {
  it("donne l'itinéraire vers le chantier : GPS d'abord, sinon l'adresse", () => {
    expect(directionsUrl(14.67, -17.43, 'Dakar')).toBe('https://www.google.com/maps/dir/?api=1&destination=14.67,-17.43')
    expect(directionsUrl(null, null, 'Thiès gare')).toBe('https://www.google.com/maps/dir/?api=1&destination=Thi%C3%A8s%20gare')
    expect(directionsUrl(null, null, null)).toBeNull()
  })

  it('affiche la période, la taille des fichiers et la couleur du statut', () => {
    expect(periodLabel('2026-12-01', '2027-01-15')).toBe('du 01/12/2026 au 15/01/2027')
    expect(fileSize(2048)).toBe('2 Ko')
    expect(projectStatusColor('on_hold')).toBe('warning')
  })
})

describe('onglet Projets', () => {
  const names = (type: 'manager' | 'technician', permissions: string[]) =>
    visibleTabs(type, (wanted) => wanted.some((p) => permissions.includes(p))).map((t) => t.name)

  it('apparaît pour le bureau, avec tous les projets ou seulement les siens', () => {
    expect(names('manager', ['projects.view'])).toEqual(['home', 'projects', 'practical-tools', 'messages', 'profile'])
    expect(names('manager', ['projects.view.own'])).toEqual(['home', 'projects', 'practical-tools', 'messages', 'profile'])
  })

  it("n'apparaît pas pour un technicien (il verra les projets de ses tâches)", () => {
    expect(names('technician', ['projects.view.own'])).toEqual(['home', 'practical-tools', 'messages', 'profile'])
  })
})
