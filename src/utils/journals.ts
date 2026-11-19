import type { JournalPayload, JournalType } from '@dash4/shared'

export interface JournalForm {
  title: string
  type: JournalType
  date: string
  taskId: number | null
  done: string
  todo: string
  remarks: string
  latitude: number | null
  longitude: number | null
}

/** Sections du rapport, dans l'ordre : seules celles qui sont remplies sont envoyées. */
export const SECTION_TITLES = { done: 'Travaux réalisés', todo: 'Reste à faire', remarks: 'Observations' } as const

/** Prépare le rapport à envoyer, ou renvoie ce qui manque (en français). */
export function buildJournalPayload(form: JournalForm, today: string): { payload?: JournalPayload & { title: string; date: string }; error?: string } {
  if (!form.title.trim()) return { error: 'Indiquez le titre du rapport.' }
  if (!form.date || form.date > today) return { error: 'La date ne peut pas être dans le futur.' }
  const sections = (Object.keys(SECTION_TITLES) as Array<keyof typeof SECTION_TITLES>)
    .filter((k) => form[k].trim())
    .map((k) => ({ title: SECTION_TITLES[k], body: form[k].trim() }))
  if (!sections.length) return { error: 'Décrivez au moins les travaux réalisés.' }

  return {
    payload: {
      title: form.title.trim(),
      type: form.type,
      date: form.date,
      ...(form.taskId ? { task_id: form.taskId } : {}),
      sections,
      ...(form.latitude !== null && form.longitude !== null ? { latitude: form.latitude, longitude: form.longitude } : {}),
    },
  }
}
