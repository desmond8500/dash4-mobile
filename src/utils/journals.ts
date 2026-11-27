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
  /** « HH:MM » ou vide. */
  startTime: string
  endTime: string
  summary: string
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
    startTime: '',
    endTime: '',
    summary: '',
  }
}

const hhmm = (v: string | null) => (v ? (v.match(/(\d{2}):(\d{2})/)?.[0] ?? '') : '')

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
    startTime: hhmm(journal.starts_at),
    endTime: hhmm(journal.ends_at),
    summary: journal.summary ?? '',
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
  if (form.startTime && form.endTime && form.endTime <= form.startTime) return { error: "L'heure de fin doit être après l'heure de début." }

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
      starts_at: form.startTime ? `${form.date} ${form.startTime}` : null,
      ends_at: form.endTime ? `${form.date} ${form.endTime}` : null,
      summary: form.summary.trim() || null,
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
    starts_at: payload.starts_at !== undefined ? payload.starts_at : journal.starts_at,
    ends_at: payload.ends_at !== undefined ? payload.ends_at : journal.ends_at,
    summary: payload.summary !== undefined ? payload.summary : journal.summary,
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

/**
 * Nouveau rapport à partir d'un autre (intervention suivante sur le même chantier) :
 * même type, projet, tâche et intervenants ; sections reprises sans leurs photos ; date du jour, sans position.
 */
export function duplicateJournalForm(journal: Journal, today: string): JournalForm {
  const form = journalToForm(journal)
  return {
    ...form,
    title: journal.title,
    date: today,
    latitude: null,
    longitude: null,
    startTime: '',
    endTime: '',
    sections: form.sections.map((s) => ({ key: nextKey('s'), title: s.title, body: s.body })),
    participants: form.participants.map((p) => ({ ...p, key: nextKey('p') })),
  }
}

export interface JournalFilters {
  mine: boolean
  type: JournalType | null
  projectId: number | null
  query: string
}

/** Rapports filtrés : les miens (auteur ou intervenant), par type, par projet, par recherche. */
export function filterJournals(list: Journal[], f: JournalFilters, userId: number | null, matches: (q: string, ...t: Array<string | null | undefined>) => boolean): Journal[] {
  return list.filter(
    (j) =>
      (!f.mine || j.created_by === userId || (j.participants ?? []).some((p) => p.user_id === userId)) &&
      (!f.type || j.type.value === f.type) &&
      (!f.projectId || j.project_id === f.projectId) &&
      (!f.query.trim() || matches(f.query, j.title, j.type.label, j.project?.name, j.client?.name, j.task?.title, j.summary, ...(j.participants ?? []).map((p) => p.name))),
  )
}

/** Rapports regroupés par mois (« novembre 2026 »), dans l'ordre reçu. */
export function groupJournalsByMonth(list: Journal[]): Array<{ key: string; label: string; items: Journal[] }> {
  const groups: Array<{ key: string; label: string; items: Journal[] }> = []
  for (const j of list) {
    const key = (j.date ?? '').slice(0, 7) || 'sans-date'
    const label = key === 'sans-date' ? 'Sans date' : new Date(`${key}-01T00:00:00`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
    const last = groups[groups.length - 1]
    if (last?.key === key) last.items.push(j)
    else groups.push({ key, label: label.charAt(0).toUpperCase() + label.slice(1), items: [j] })
  }
  return groups
}

/** Horaires « 08:30 – 12:15 (3 h 45) ». */
export function journalHours(startsAt: string | null, endsAt: string | null): string | null {
  const time = (v: string | null) => (v ? (v.match(/(\d{2}):(\d{2})/)?.[0] ?? null) : null)
  const a = time(startsAt)
  const b = time(endsAt)
  if (!a && !b) return null
  if (!a || !b) return a ?? b
  const minutes = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5))
  const d = minutes(b) - minutes(a)
  if (d <= 0) return `${a} – ${b}`
  return `${a} – ${b} (${Math.floor(d / 60)} h ${String(d % 60).padStart(2, '0')})`
}
