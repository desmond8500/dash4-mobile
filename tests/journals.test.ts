import { describe, expect, it } from 'vitest'
import { visibleTabs } from '../src/tabs'
import { buildJournalPayload, type JournalForm } from '../src/utils/journals'

const form = (patch: Partial<JournalForm> = {}): JournalForm => ({
  title: 'Pose caméras R+1',
  type: 'installation',
  date: '2026-11-19',
  taskId: 4,
  done: '4 caméras posées',
  todo: '',
  remarks: ' Câble à protéger ',
  latitude: 14.7167,
  longitude: -17.4677,
  ...patch,
})

describe('rapports d\'intervention sur le téléphone', () => {
  it('envoie seulement les sections remplies, la tâche et la position', () => {
    expect(buildJournalPayload(form(), '2026-11-19').payload).toEqual({
      title: 'Pose caméras R+1',
      type: 'installation',
      date: '2026-11-19',
      task_id: 4,
      sections: [
        { title: 'Travaux réalisés', body: '4 caméras posées' },
        { title: 'Observations', body: 'Câble à protéger' },
      ],
      latitude: 14.7167,
      longitude: -17.4677,
    })
    expect(buildJournalPayload(form({ taskId: null, latitude: null, longitude: null }), '2026-11-19').payload).not.toHaveProperty('latitude')
  })

  it('refuse un rapport sans titre, daté dans le futur ou vide', () => {
    expect(buildJournalPayload(form({ title: ' ' }), '2026-11-19').error).toBe('Indiquez le titre du rapport.')
    expect(buildJournalPayload(form({ date: '2026-11-20' }), '2026-11-19').error).toBe('La date ne peut pas être dans le futur.')
    expect(buildJournalPayload(form({ done: '', remarks: '' }), '2026-11-19').error).toBe('Décrivez au moins les travaux réalisés.')
  })

  it('donne l\'onglet Rapports aux techniciens et aux gestionnaires', () => {
    const can = (p: string[]) => p.includes('journals.view.own')
    expect(visibleTabs('technician', can).map((t) => t.name)).toContain('journals')
    expect(visibleTabs('manager', can).map((t) => t.name)).toContain('journals')
  })
})
