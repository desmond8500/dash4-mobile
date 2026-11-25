import type { Task, TaskStatus } from '@dash4/shared'
import type { OutboxItem } from '@/offline/outbox'

export function taskColor(status: TaskStatus): string {
  switch (status) {
    case 'in_progress':
      return 'warning'
    case 'blocked':
      return 'danger'
    case 'done':
      return 'success'
    case 'cancelled':
      return 'dark'
    default:
      return 'medium'
  }
}

/**
 * Tâche telle qu'elle sera une fois les changements en attente envoyés (statut, sous-tâches
 * cochées), pour que l'écran suive ce que le technicien a fait même sans réseau.
 */
export function withPending(task: Task, pending: Array<Pick<OutboxItem, 'method' | 'path' | 'payload'>>): Task {
  let result = task
  for (const item of pending) {
    if (item.method !== 'PATCH') continue
    if (item.path === `tasks/${task.id}` && typeof item.payload.status === 'string') {
      result = { ...result, status: { value: item.payload.status as TaskStatus, label: STATUS_LABELS[item.payload.status as TaskStatus] } }
    }
    const sub = item.path.match(/^subtasks\/(\d+)$/)
    if (sub && typeof item.payload.is_done === 'boolean' && result.subtasks.some((s) => s.id === Number(sub[1]))) {
      const subtasks = result.subtasks.map((s) => (s.id === Number(sub[1]) ? { ...s, is_done: item.payload.is_done as boolean } : s))
      result = { ...result, subtasks, subtasks_done: subtasks.filter((s) => s.is_done).length }
    }
  }
  return result
}

const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'À faire',
  in_progress: 'En cours',
  blocked: 'Bloquée',
  done: 'Terminée',
  cancelled: 'Annulée',
}

const pad = (n: number) => String(n).padStart(2, '0')
export const isoDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

/** Planifiée ce jour-là (créneau sur plusieurs jours compris). */
export function isOnDay(task: Pick<Task, 'starts_at' | 'ends_at'>, day: string): boolean {
  if (!task.starts_at) return false
  return task.starts_at.slice(0, 10) <= day && day <= (task.ends_at ?? task.starts_at).slice(0, 10)
}

/** Les 7 jours à partir d'aujourd'hui. */
export function nextDays(from: Date, count = 7): string[] {
  return Array.from({ length: count }, (_, i) => isoDay(new Date(from.getFullYear(), from.getMonth(), from.getDate() + i)))
}

/** « 08:30 – 12:00 » pour ce jour-là. */
export function hours(task: Pick<Task, 'starts_at' | 'ends_at'>, day: string): string {
  if (!task.starts_at) return ''
  const start = task.starts_at.startsWith(day) ? task.starts_at.slice(11, 16) : null
  const end = task.ends_at?.startsWith(day) ? task.ends_at.slice(11, 16) : null
  if (start && end) return `${start} – ${end}`
  if (start) return start === '00:00' ? '' : `Dès ${start}`
  if (end) return `Jusqu'à ${end}`
  return 'Toute la journée'
}

/** Ordre d'affichage : en cours, puis par heure, puis urgentes. */
export function sortForDay(tasks: Task[]): Task[] {
  const rank = (t: Task) => (t.status.value === 'in_progress' ? 0 : t.status.value === 'done' || t.status.value === 'cancelled' ? 2 : 1)
  return [...tasks].sort((a, b) => rank(a) - rank(b) || (a.starts_at ?? '').localeCompare(b.starts_at ?? '') || Number(b.priority.value === 'high') - Number(a.priority.value === 'high'))
}

export type TaskSort = 'time' | 'priority'
export interface TaskGroup {
  key: string
  label: string
  /** Jour du groupe (pour les heures affichées), s'il y en a un. */
  day: string | null
  tasks: Task[]
}

const OPEN: TaskStatus[] = ['todo', 'in_progress', 'blocked']

/** Jour de référence d'une tâche : son début, sinon son échéance. */
function refDay(task: Task, today: string): string | null {
  if (isOnDay(task, today)) return today
  return task.starts_at?.slice(0, 10) ?? task.due_date ?? null
}

/**
 * Tâches groupées comme dans l'écran « Tâches » : En retard, Aujourd'hui, Demain, les jours de la semaine,
 * Plus tard, Sans date, puis Terminées (si demandé). Triées par heure ou par priorité (urgentes d'abord).
 */
export function groupTasks(tasks: Task[], today: string, options: { sort?: TaskSort; showDone?: boolean } = {}): TaskGroup[] {
  const days = nextDays(new Date(`${today}T00:00:00`))
  const tomorrow = days[1]!
  const groups = new Map<string, TaskGroup>()
  const add = (key: string, label: string, day: string | null, task: Task) => {
    if (!groups.has(key)) groups.set(key, { key, label, day, tasks: [] })
    groups.get(key)!.tasks.push(task)
  }

  for (const task of tasks) {
    if (!OPEN.includes(task.status.value)) continue
    const day = refDay(task, today)
    if (day === today) add('today', "Aujourd'hui", today, task)
    else if (task.is_overdue || (day && day < today)) add('late', 'En retard', null, task)
    else if (!day) add('undated', 'Sans date', null, task)
    else if (day === tomorrow) add('tomorrow', 'Demain', tomorrow, task)
    else if (days.includes(day)) add(day, dayName(day), day, task)
    else add('later', 'Plus tard', null, task)
  }
  if (options.showDone) {
    const done = tasks.filter((t) => t.status.value === 'done').sort((a, b) => (b.updated_at ?? '').localeCompare(a.updated_at ?? '')).slice(0, 30)
    for (const task of done) add('done', 'Terminées', null, task)
  }

  const order = ['late', 'today', 'tomorrow', ...days.slice(2), 'later', 'undated', 'done']
  const byPriority = (t: Task) => (t.priority.value === 'high' ? 0 : t.priority.value === 'low' ? 2 : 1)
  const when = (t: Task) => t.starts_at ?? (t.due_date ? `${t.due_date}T99` : '9999')
  return order
    .map((key) => groups.get(key))
    .filter((g): g is TaskGroup => !!g)
    .map((g) => ({
      ...g,
      tasks: g.key === 'done' ? g.tasks : [...g.tasks].sort((a, b) =>
        options.sort === 'priority'
          ? byPriority(a) - byPriority(b) || when(a).localeCompare(when(b))
          : when(a).localeCompare(when(b)) || byPriority(a) - byPriority(b),
      ),
    }))
}

function dayName(day: string): string {
  const label = new Date(`${day}T00:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

/**
 * Pastille d'une tâche (à droite de la carte) : heure du jour, sinon date ou échéance ;
 * rouge en retard ou urgente, jaune en cours ou bloquée, vert sinon, grise terminée.
 */
export function taskPill(task: Task, groupDay: string | null, today: string): { text: string; tone: 'danger' | 'warning' | 'success' | 'medium' } | null {
  const short = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
  const text =
    (groupDay && hours(task, groupDay)) ||
    (task.starts_at && task.starts_at.slice(0, 10) !== groupDay ? short(task.starts_at.slice(0, 10)) : '') ||
    (task.due_date ? `Échéance ${short(task.due_date)}` : '')
  const tone =
    task.status.value === 'done' ? 'medium'
    : task.is_overdue || task.priority.value === 'high' || (refDay(task, today) ?? today) < today ? 'danger'
    : task.status.value === 'in_progress' || task.status.value === 'blocked' ? 'warning'
    : 'success'
  if (!text) return task.priority.value === 'high' && task.status.value !== 'done' ? { text: 'Urgente', tone } : null
  return { text, tone }
}
