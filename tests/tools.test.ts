import { describe, expect, it } from 'vitest'
import type { AppNotification, Tool } from '@dash4/shared'
import { displayedStatus, findToolByScan, isoDateIn, pendingToolActions, sortTools, toolColor } from '../src/utils/tools'
import { notificationRoute } from '../src/utils/notifications'
import { quickActions } from '../src/utils/home'

const tool = (id: number, name: string, status: Tool['status']['value'], code: string | null = null, condition: Tool['condition']['value'] = 'good') =>
  ({ id, name, code, status: { value: status, label: status }, condition: { value: condition, label: condition } }) as unknown as Tool

describe('outillage (mobile)', () => {
  const items = [tool(7, 'Perceuse', 'available', 'OUT-007'), tool(8, 'Escabeau', 'late', 'OUT-008')]

  it('retrouve l’outil d’une étiquette QR ou de son numéro d’inventaire', () => {
    expect(findToolByScan(items, 'https://dash4.yonkou.info/stock/outillage/7')).toEqual({ id: 7, tool: items[0] })
    expect(findToolByScan(items, 'DASH4-OUTIL-99')).toEqual({ id: 99, tool: null })
    expect(findToolByScan(items, ' out-008 ')).toEqual({ id: 8, tool: items[1] })
    expect(findToolByScan(items, '3017620422003')).toBeNull()
  })

  it('tient compte des prêts et retours en attente d’envoi', () => {
    const pending = [
      { type: 'tool-lend', path: 'tools/7/loans', label: 'Prêt' },
      { type: 'tool-return', path: 'tools/8/loans/3/return', label: 'Retour' },
      { type: 'tool-remind', path: 'tools/8/loans/3/remind', label: 'Rappel' },
      { type: 'vehicle-mileage', path: 'vehicles/7/mileages', label: 'Compteur' },
    ]
    expect(pendingToolActions(pending, 7)).toEqual([{ kind: 'lend', label: 'Prêt' }])
    expect(pendingToolActions(pending, 8).map((p) => p.kind)).toEqual(['return', 'remind'])
    expect(displayedStatus(items[0]!, pendingToolActions(pending, 7))).toBe('lent')
    expect(displayedStatus(items[1]!, pendingToolActions(pending, 8))).toBe('available')
    expect(displayedStatus(tool(9, 'Scie', 'lent', null, 'broken'), [{ kind: 'return', label: '' }])).toBe('unavailable')
  })

  it('met les outils en retard en tête', () => {
    expect(sortTools([tool(1, 'B', 'available'), tool(2, 'A', 'lent'), tool(3, 'C', 'late')]).map((t) => t.name)).toEqual(['C', 'A', 'B'])
    expect(toolColor('late')).toBe('danger')
    expect(isoDateIn(7, new Date(2026, 10, 28))).toBe('2026-12-05')
  })

  it('ouvre la fiche de l’outil depuis un rappel, et propose l’outillage au technicien', () => {
    const n = { id: 'x', kind: 'tool_loan.late', title: '', body: '', tool_id: 7, read_at: null, created_at: null } as AppNotification
    expect(notificationRoute(n)).toEqual({ name: 'tool', params: { id: 7 } })
    const tech = quickActions('technician', (p) => p.includes('tools.view.own'))
    expect(tech.map((a) => a.key)).toEqual(['tools'])
  })
})
