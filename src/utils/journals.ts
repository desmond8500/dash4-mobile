import type { Journal, JournalParticipantPayload, JournalPayload, JournalType } from '@dash4/shared'

/** Sections proposées sur un nouveau rapport, dans l'ordre. */
export const SECTION_TITLES = { done: 'Travaux réalisés', todo: 'Reste à faire', remarks: 'Observations' } as const
export type SectionKey = keyof typeof SECTION_TITLES

export interface SectionDraft {
  /** Clé stable dans le formulaire (photos, champs). */
  key: string
  /** Section déjà sur le serveur. */
  id?: number
  title: string
  body: string
}

export interface ParticipantDraft {
  key: string
  user_id: number | null
  contact_id: number | null
  name: string
  role: string
  kind: 'team' | 'contact' | 'other'
}

export interface JournalForm {
  title: string
  type: JournalType
  date: string
  taskId: number | null
  projectId: number | null
  sections: SectionDraft[]
  participants: ParticipantDraft[]
  latitude: number | null
  longitude: number | null
}

let seq = 0
const nextKey = (prefix: string) => `${prefix}-${++seq}`

/** Nouveau rapport : les trois sections habituelles, vides. */
export function newJournalForm(today: string): JournalForm {
  return {
    title: '',
    type: 'intervention',
    date: today,
    taskId: null,
    projectId: null,
    sections: (Object.keys(SECTION_TITLES) as SectionKey[]).map((k) => ({ key: k, title: SECTION_TITLES[k], body: '' })),
    participants: [],
    latitude: null,
    longitude: null,
  }
}

/** Formulaire pré-rempli pour modifier un rapport : ses sections (et les habituelles qui manquent), ses intervenants. */
export function journalToForm(journal: Journal): JournalForm {
  const sections: SectionDraft[] = (journal.sections ?? []).map((s) => ({ key: s.id ? `s${s.id}` : nextKey('s'), id: s.id ?? undefined, title: s.title, body: s.body ?? '' }))
  for (const k of Object.keys(SECTION_TITLES) as SectionKey[]) {
    if (!sections.some((s) => s.title.trim().toLowerCase() === SECTION_TITLES[k].toLowerCase())) sections.push({ key: k, title: SECTION_TITLES[k], body: '' })
  }
  return {
    title: journal.title,
    type: journal.type.value,
    date: journal.date ?? '',
    taskId: journal.task_id,
    projectId: journal.project_id,
    sections,
    participants: (journal.participants ?? []).map((p) => ({
      key: nextKey('p'), user_id: p.user_id, contact_id: p.contact_id, name: p.name, role: p.role ?? '', kind: p.kind,
    })),
    latitude: journal.latitude,
    longitude: journal.longitude,
  }
}

/** Ajoute un intervenant s'il n'y est pas déjà (même personne, même contact ou même nom libre). */
export function addParticipant(list: ParticipantDraft[], p: Omit<ParticipantDraft, 'key'>): ParticipantDraft[] {
  const same = (x: ParticipantDraft) =>
    (p.user_id !== null && x.user_id === p.user_id) ||
    (p.contact_id !== null && x.contact_id === p.contact_id) ||
    (p.kind === 'other' && x.kind === 'other' && x.name.trim().toLowerCase() === p.name.trim().toLowerCase())
  if (!p.name.trim() || list.some(same)) return list
  return [...list, { ...p, name: p.name.trim(), key: nextKey('p') }]
}

/**
 * Prépare le rapport à envoyer, ou renvoie ce qui manque (en français).
 * Une section déjà enregistrée est toujours renvoyée (sinon elle serait supprimée avec ses photos) ;
 * une nouvelle section n'est envoyée que si elle est remplie.
 */
export function buildJournalPayload(form: JournalForm, today: string): { payload?: JournalPayload & { title: string; date: string }; error?: string } {
  if (!form.title.trim()) return { error: 'Indiquez le titre du rapport.' }
  if (!form.projectId) return { error: 'Choisissez le projet du rapport.' }
  if (!form.date || form.date > today) return { error: 'La date ne peut pas être dans le futur.' }
  const sent = form.sections.filter((s) => s.id || s.body.trim())
  if (!sent.some((s) => s.body.trim())) return { error: 'Décrivez au moins les travaux réalisés.' }
  if (sent.some((s) => !s.title.trim())) return { error: 'Chaque section a besoin d\'un titre.' }

  const participants: JournalParticipantPayload[] = form.participants.map((p) => ({
    ...(p.user_id ? { user_id: p.user_id } : p.contact_id ? { contact_id: p.contact_id } : { name: p.name.trim() }),
    role: p.role.trim() || null,
  }))

  return {
    payload: {
      title: form.title.trim(),
      type: form.type,
      date: form.date,
      project_id: form.projectId,
      ...(form.taskId ? { task_id: form.taskId } : {}),
      sections: sent.map((s) => ({ ...(s.id ? { id: s.id } : {}), title: s.title.trim(), body: s.body.trim() })),
      participants,
      ...(form.latitude !== null && form.longitude !== null ? { latitude: form.latitude, longitude: form.longitude } : {}),
    },
  }
}

/**
 * Position, dans les sections envoyées, de chaque section du formulaire (null si elle n'est pas envoyée :
 * ses photos vont alors avec le rapport).
 */
export function sectionPositions(form: Pick<JournalForm, 'sections'>): Record<string, number | null> {
  let next = 0
  const result: Record<string, number | null> = {}
  for (const s of form.sections) result[s.key] = s.id || s.body.trim() ? next++ : null
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

/**
 * Projets proposés pour un rapport : ceux que le compte voit sur le téléphone (liste des projets,
 * ou à défaut ceux de ses tâches et de ses rapports), sans doublon, par nom.
 */
export function journalProjectOptions(sources: Array<Array<{ id: number; name: string } | null | undefined>>): Array<{ id: number; name: string }> {
  const byId = new Map<number, { id: number; name: string }>()
  for (const list of sources) for (const p of list) if (p && !byId.has(p.id)) byId.set(p.id, { id: p.id, name: p.name })
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, 'fr', { numeric: true }))
}

/** Copie locale d'un rapport modifié (affichée tout de suite, même hors ligne). */
export function applyJournalChanges(journal: Journal, payload: JournalPayload, project: { id: number; name: string } | null, participants?: ParticipantDraft[]): Journal {
  return {
    ...journal,
    participants: participants
      ? participants.map((p, i) => ({ id: -(i + 1), user_id: p.user_id, contact_id: p.contact_id, name: p.name, role: p.role.trim() || null, kind: p.kind }))
      : journal.participants,
    title: payload.title ?? journal.title,
    type: payload.type ? { ...journal.type, value: payload.type } : journal.type,
    date: payload.date ?? journal.date,
    project_id: payload.project_id ?? journal.project_id,
    project: project ?? journal.project,
    sections: payload.sections
      ? payload.sections.map((s, i) => {
          const old = journal.sections?.find((x) => x.id === s.id)
          return { ...(old ?? {}), id: s.id ?? (undefined as unknown as number), position: i, title: s.title, body: s.body ?? null, photos: old?.photos ?? [] } as NonNullable<Journal['sections']>[number]
        })
      : journal.sections,
  }
}
