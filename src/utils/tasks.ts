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
