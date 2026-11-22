import { describe, expect, it } from 'vitest'
import { visibleTabs } from '../src/tabs'
import {
  addParticipant,
  applyJournalChanges,
  buildJournalPayload,
  journalProjectOptions,
  journalToForm,
  newJournalForm,
  normalizePendingPhotos,
  photoTarget,
  sectionPositions,
  type JournalForm,
} from '../src/utils/journals'
import type { Journal } from '@dash4/shared'

const form = (patch: Partial<JournalForm> = {}): JournalForm => {
  const f = newJournalForm('2026-11-19')
  f.title = 'Pose caméras R+1'
  f.type = 'installation'
  f.taskId = 4
  f.projectId = 7
  f.sections[0]!.body = '4 caméras posées'
  f.sections[2]!.body = ' Câble à protéger '
  f.latitude = 14.7167
  f.longitude = -17.4677
  return { ...f, ...patch }
}

const journal = {
  id: 9, title: 'Visite', type: { value: 'visit', label: 'Visite' }, date: '2026-11-18', task_id: null, project_id: 7, project: { id: 7, name: 'Hôtel' },
  latitude: null, longitude: null,
  sections: [{ id: 41, position: 0, title: 'Constat', body: 'Porte forcée', photos: [] }],
  participants: [{ id: 1, user_id: 3, contact_id: null, name: 'Awa Diop', role: 'Cheffe', kind: 'team' }],
} as unknown as Journal

describe('rapports d\'intervention sur le téléphone', () => {
  it('envoie le projet, les sections remplies, les intervenants, la tâche et la position', () => {
    const f = form()
    f.participants = addParticipant(addParticipant([], { user_id: 3, contact_id: null, name: 'Awa Diop', role: '', kind: 'team' }), { user_id: null, contact_id: null, name: ' Électricien du client ', role: 'Sous-traitant', kind: 'other' })
    expect(buildJournalPayload(f, '2026-11-19').payload).toEqual({
      title: 'Pose caméras R+1',
      type: 'installation',
      date: '2026-11-19',
      project_id: 7,
      task_id: 4,
      sections: [
        { title: 'Travaux réalisés', body: '4 caméras posées' },
        { title: 'Observations', body: 'Câble à protéger' },
      ],
      participants: [{ user_id: 3, role: null }, { name: 'Électricien du client', role: 'Sous-traitant' }],
      latitude: 14.7167,
      longitude: -17.4677,
    })
  })

  it('refuse un rapport sans titre, sans projet, daté dans le futur ou vide', () => {
    expect(buildJournalPayload(form({ title: ' ' }), '2026-11-19').error).toBe('Indiquez le titre du rapport.')
    expect(buildJournalPayload(form({ projectId: null }), '2026-11-19').error).toBe('Choisissez le projet du rapport.')
    expect(buildJournalPayload(form({ date: '2026-11-20' }), '2026-11-19').error).toBe('La date ne peut pas être dans le futur.')
    const empty = form()
    empty.sections.forEach((s) => (s.body = ''))
    expect(buildJournalPayload(empty, '2026-11-19').error).toBe('Décrivez au moins les travaux réalisés.')
  })

  it('ne met pas deux fois le même intervenant', () => {
    const one = addParticipant([], { user_id: 3, contact_id: null, name: 'Awa', role: '', kind: 'team' })
    expect(addParticipant(one, { user_id: 3, contact_id: null, name: 'Awa', role: '', kind: 'team' })).toHaveLength(1)
    const free = addParticipant(one, { user_id: null, contact_id: null, name: 'Moussa', role: '', kind: 'other' })
    expect(addParticipant(free, { user_id: null, contact_id: null, name: ' moussa ', role: '', kind: 'other' })).toHaveLength(2)
    expect(addParticipant(free, { user_id: null, contact_id: null, name: '  ', role: '', kind: 'other' })).toHaveLength(2)
  })

  it('modifie un rapport : garde ses sections (même vidées) et ses intervenants', () => {
    const f = journalToForm(journal)
    expect(f.sections.map((s) => s.title)).toEqual(['Constat', 'Travaux réalisés', 'Reste à faire', 'Observations'])
    expect(f.participants[0]).toMatchObject({ user_id: 3, name: 'Awa Diop', role: 'Cheffe' })
    f.sections[1]!.body = 'Serrure changée'
    const payload = buildJournalPayload(f, '2026-11-19').payload!
    expect(payload.sections).toEqual([{ id: 41, title: 'Constat', body: 'Porte forcée' }, { title: 'Travaux réalisés', body: 'Serrure changée' }])
    expect(payload.participants).toEqual([{ user_id: 3, role: 'Cheffe' }])

    const local = applyJournalChanges(journal, { ...payload, title: 'Visite du 18' }, { id: 7, name: 'Hôtel' })
    expect(local.title).toBe('Visite du 18')
    expect(local.sections!.map((s) => [s.id, s.body])).toEqual([[41, 'Porte forcée'], [undefined, 'Serrure changée']])
  })

  it('propose les projets du téléphone sans doublon', () => {
    expect(journalProjectOptions([[{ id: 2, name: 'Zone' }, null], [{ id: 1, name: 'Atelier' }, { id: 2, name: 'Zone' }]])).toEqual([
      { id: 1, name: 'Atelier' },
      { id: 2, name: 'Zone' },
    ])
  })

  it('donne l\'onglet Rapports aux techniciens et aux gestionnaires', () => {
    const can = (p: string[]) => p.includes('journals.view.own')
    expect(visibleTabs('technician', can).map((t) => t.name)).toContain('journals')
    expect(visibleTabs('manager', can).map((t) => t.name)).toContain('journals')
  })
})

describe('photos des sections', () => {
  it('place chaque photo dans sa section, ou avec le rapport si la section est vide', () => {
    const f = newJournalForm('2026-11-19')
    f.sections[0]!.body = 'Fait'
    f.sections[2]!.body = 'RAS'
    expect(sectionPositions(f)).toEqual({ done: 0, todo: null, remarks: 1 })

    const j = { id: 9, sections: [{ id: 41, position: 0, title: 'Travaux réalisés', body: 'Fait' }, { id: 42, position: 1, title: 'Observations', body: 'RAS' }] }
    expect(photoTarget(j, 1)).toEqual({ type: 'journal-sections', id: 42 })
    expect(photoTarget(j, null)).toEqual({ type: 'journals', id: 9 })
    expect(photoTarget(j, 5)).toEqual({ type: 'journals', id: 9 })
    expect(normalizePendingPhotos({ a: 2, b: [0, null] })).toEqual({ a: [null, null], b: [0, null] })
  })
})
