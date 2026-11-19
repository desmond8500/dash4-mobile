import type { Journal, JournalPayload, JournalType } from '@dash4/shared'

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

export type SectionKey = keyof typeof SECTION_TITLES

/**
 * Position, dans les sections envoyées, de chaque section du formulaire (null si elle est vide
 * et n'est donc pas envoyée : ses photos vont alors avec le rapport).
 */
export function sectionPositions(form: Pick<JournalForm, SectionKey>): Record<SectionKey, number | null> {
  let next = 0
  const result = {} as Record<SectionKey, number | null>
  for (const key of Object.keys(SECTION_TITLES) as SectionKey[]) {
    result[key] = form[key].trim() ? next++ : null
  }
  return result
}

/**
 * Où envoyer une photo gardée sur le téléphone, une fois le rapport sur le serveur :
 * la section à cette position (par son id), ou le rapport lui-même.
 */
export function photoTarget(journal: Pick<Journal, 'id' | 'sections'>, position: number | null): { type: 'journals' | 'journal-sections'; id: number } {
  const section = position === null ? undefined : (journal.sections ?? []).find((s, i) => (s.position ?? i) === position)
  return section?.id ? { type: 'journal-sections', id: section.id } : { type: 'journals', id: journal.id }
}

/** Ancien format (nombre de photos du rapport) ou nouveau (position de section de chaque photo). */
export function normalizePendingPhotos(stored: Record<string, number | Array<number | null>> | undefined | null): Record<string, Array<number | null>> {
  const result: Record<string, Array<number | null>> = {}
  for (const [uuid, value] of Object.entries(stored ?? {})) {
    result[uuid] = typeof value === 'number' ? Array.from({ length: value }, () => null) : value
  }
  return result
}
