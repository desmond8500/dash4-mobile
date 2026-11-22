import { describe, expect, it } from 'vitest'
import type { Equipment, Plan } from '@dash4/shared'
import { clampZoom, groupPlansByProject, isFileFresh, markerMatches, pinchZoom, planPlace, scrollAfterZoom, scrollToPoint, staleFileIds } from '../src/utils/plans'
import { visibleTabs } from '../src/tabs'
import { quickActions } from '../src/utils/home'

const plan = (id: number, projectId: number, projectName: string, name: string, extra: Partial<Plan> = {}) =>
  ({ id, project_id: projectId, project: { id: projectId, name: projectName }, name, updated_at: `t${id}`, building: null, level: null, ...extra }) as unknown as Plan

describe('plans sur le téléphone', () => {
  it('range les plans par projet et cherche aussi dans le bâtiment et le niveau', () => {
    const plans = [plan(1, 2, 'Villa Beta', 'Sous-sol'), plan(2, 1, 'Tour Alpha', 'RDC', { building: { id: 1, name: 'Bât A' }, level: { id: 1, name: 'Rez' } }), plan(3, 1, 'Tour Alpha', 'Étage 1')]
    expect(groupPlansByProject(plans).map((g) => [g.project.name, g.plans.map((p) => p.id)])).toEqual([['Tour Alpha', [2, 3]], ['Villa Beta', [1]]])
    expect(groupPlansByProject(plans, 'etage').map((g) => g.plans.map((p) => p.id))).toEqual([[3]])
    expect(groupPlansByProject(plans, 'bat a').map((g) => g.plans.map((p) => p.id))).toEqual([[2]])
    expect(planPlace(plans[1]!)).toBe('Bât A › Rez')
    expect(planPlace(plans[0]!)).toBeNull()
  })

  it('sait quels fichiers sont à jour et lesquels effacer', () => {
    const index = { '1': 't1', '2': 'ancien', '9': 't9' }
    const plans = [plan(1, 1, 'A', 'X'), plan(2, 1, 'A', 'Y')]
    expect(isFileFresh(index, plans[0]!)).toBe(true)
    expect(isFileFresh(index, plans[1]!)).toBe(false)
    expect(isFileFresh({}, plans[0]!)).toBe(false)
    expect(staleFileIds(index, plans)).toEqual([9])
  })

  it('zoome à deux doigts en gardant le point visé', () => {
    expect(pinchZoom(1, 100, 250)).toBe(2.5)
    expect(pinchZoom(2, 100, 10)).toBe(1)
    expect(pinchZoom(5, 100, 300)).toBe(6)
    expect(clampZoom(1.234)).toBe(1.23)
    expect(scrollAfterZoom({ left: 0, top: 0 }, 100, 50, 1, 2)).toEqual({ left: 100, top: 50 })
    expect(scrollToPoint(0.5, 0.5, { width: 2000, height: 1000 }, { width: 400, height: 600 })).toEqual({ left: 800, top: 200 })
  })

  it('trouve un repère par son équipement (n° de série, adresse IP)', () => {
    const camera = { name: 'Caméra hall', type: null, model: 'DS-2CD', serial_number: 'SN42', characteristics: [{ label: 'Adresse IP', value: '192.168.1.20' }] } as unknown as Equipment
    expect(markerMatches({ label: null }, camera, '192.168.1.20')).toBe(true)
    expect(markerMatches({ label: null }, camera, 'sn42')).toBe(true)
    expect(markerMatches({ label: 'Issue de secours' }, null, 'issue')).toBe(true)
    expect(markerMatches({ label: null }, camera, 'nvr')).toBe(false)
  })

  it('donne l’onglet et l’action rapide Plans aux comptes qui voient les chantiers', () => {
    const can = (granted: string[]) => (wanted: string[]) => wanted.some((p) => granted.includes(p))
    expect(visibleTabs('technician', can(['sites.view.own'])).map((t) => t.name)).toContain('plans')
    expect(visibleTabs('manager', can(['clients.view'])).map((t) => t.name)).not.toContain('plans')
    expect(quickActions('technician', can(['sites.view.own'])).map((a) => a.key)).toEqual(['plans'])
  })
})
