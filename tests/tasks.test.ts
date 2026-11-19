import { describe, expect, it } from 'vitest'
import type { Task } from '@dash4/shared'
import { visibleTabs } from '../src/tabs'
import { hours, isOnDay, nextDays, sortForDay, taskColor, withPending } from '../src/utils/tasks'

const task = (patch: Partial<Task> = {}) =>
  ({
    id: 5,
    title: 'Poser les caméras',
    status: { value: 'todo', label: 'À faire' },
    priority: { value: 'normal', label: 'Normale' },
    starts_at: '2026-11-23T08:30:00',
    ends_at: '2026-11-23T12:00:00',
    subtasks: [
      { id: 1, position: 0, title: 'Câbles', is_done: false },
      { id: 2, position: 1, title: 'Caméras', is_done: false },
    ],
    subtasks_done: 0,
    subtasks_count: 2,
    ...patch,
  }) as Task

describe('tâches sur le téléphone', () => {
  it('montre tout de suite les changements pas encore envoyés', () => {
    const t = withPending(task(), [
      { method: 'PATCH', path: 'subtasks/1', payload: { is_done: true } },
      { method: 'PATCH', path: 'tasks/5', payload: { status: 'in_progress' } },
      { method: 'PATCH', path: 'tasks/6', payload: { status: 'done' } },
      { method: 'PATCH', path: 'subtasks/99', payload: { is_done: true } },
      { method: 'POST', path: 'tasks/5/notes', payload: { body: 'x' } },
    ])
    expect(t.status).toEqual({ value: 'in_progress', label: 'En cours' })
    expect(t.subtasks_done).toBe(1)
    expect(t.subtasks[0]!.is_done).toBe(true)
  })

  it('place les tâches dans la journée et donne leurs heures', () => {
    expect(isOnDay(task(), '2026-11-23')).toBe(true)
    expect(isOnDay(task({ starts_at: null }), '2026-11-23')).toBe(false)
    expect(hours(task(), '2026-11-23')).toBe('08:30 – 12:00')
    expect(hours(task({ ends_at: '2026-11-25T17:00:00' }), '2026-11-24')).toBe('Toute la journée')
    expect(nextDays(new Date(2026, 11, 30), 3)).toEqual(['2026-12-30', '2026-12-31', '2027-01-01'])
  })

  it('met les tâches en cours en premier, puis par heure, les terminées à la fin', () => {
    const list = sortForDay([
      task({ id: 1, status: { value: 'done', label: '' }, starts_at: '2026-11-23T07:00:00' }),
      task({ id: 2, starts_at: '2026-11-23T14:00:00' }),
      task({ id: 3, status: { value: 'in_progress', label: '' }, starts_at: '2026-11-23T15:00:00' }),
      task({ id: 4, starts_at: '2026-11-23T09:00:00' }),
    ])
    expect(list.map((t) => t.id)).toEqual([3, 4, 2, 1])
    expect(taskColor('blocked')).toBe('danger')
  })

  it('donne l\'onglet Tâches aux techniciens et aux gestionnaires', () => {
    const can = (p: string[]) => p.includes('tasks.view.own')
    expect(visibleTabs('technician', can)[1]?.name).toBe('tasks')
    expect(visibleTabs('manager', can).map((t) => t.name)).toContain('tasks')
  })
})
