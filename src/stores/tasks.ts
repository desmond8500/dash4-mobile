import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { ApiError, OPEN_TASK_STATUSES, type Task, type TaskStatus } from '@dash4/shared'
import { api } from '@/services/api'
import { kv, onWipe } from '@/offline/db'
import { mergeChanges, plain } from '@/offline/collection'
import { withPending } from '@/utils/tasks'
import { useAuthStore } from './auth'
import { useSyncStore } from './sync'

const ITEMS_KEY = 'tasks.items'
const SYNCED_AT_KEY = 'tasks.syncedAt'

export const TASK_PERMISSIONS = ['tasks.view', 'tasks.view.own']

/**
 * Tâches sur le téléphone : celles que le compte peut voir (pour un technicien, celles qui lui
 * sont affectées). Hors ligne : statut, sous-tâches et notes passent par la file d'attente,
 * et l'écran montre tout de suite le résultat.
 */
export const useTasksStore = defineStore('tasks', () => {
  const auth = useAuthStore()
  const sync = useSyncStore()

  const items = ref<Task[]>([])
  const syncedAt = ref<string | null>(null)
  const loaded = ref(false)
  const syncing = ref(false)

  const allowed = () => auth.canAny(TASK_PERMISSIONS)
  /** Avec les changements pas encore envoyés. */
  const all = computed(() => items.value.filter((t) => !t.deleted_at).map((t) => withPending(t, sync.pending)))
  const mine = computed(() => all.value.filter((t) => t.assignees?.some((a) => a.id === auth.user?.id)))
  const open = computed(() => all.value.filter((t) => OPEN_TASK_STATUSES.includes(t.status.value)))
  const openMineCount = computed(() => mine.value.filter((t) => OPEN_TASK_STATUSES.includes(t.status.value)).length)

  async function load(): Promise<void> {
    if (loaded.value || !allowed()) return
    const [stored, at] = await Promise.all([kv.get<Task[]>(ITEMS_KEY), kv.get<string>(SYNCED_AT_KEY)])
    items.value = stored ?? []
    syncedAt.value = at ?? null
    loaded.value = true
  }

  async function refresh(): Promise<void> {
    if (!allowed() || syncing.value) return
    await load()
    syncing.value = true
    try {
      const since = syncedAt.value
      const result = await api.syncAll((f) => api.tasks.list(f), since)
      items.value = mergeChanges(since ? items.value : [], result.items)
      syncedAt.value = result.serverTime
      await Promise.all([kv.set(ITEMS_KEY, plain(items.value)), kv.set(SYNCED_AT_KEY, syncedAt.value)])
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 0)) throw e
    } finally {
      syncing.value = false
    }
  }

  const find = (id: number) => all.value.find((t) => t.id === id)

  async function setStatus(task: Task, status: TaskStatus): Promise<void> {
    await sync.enqueue({ type: 'task', label: `Tâche « ${task.title} » : ${status === 'done' ? 'terminée' : status === 'in_progress' ? 'en cours' : status === 'blocked' ? 'bloquée' : 'rouverte'}`, method: 'PATCH', path: `tasks/${task.id}`, payload: { status } })
  }

  async function toggleSubtask(task: Task, subtaskId: number, done: boolean): Promise<void> {
    const sub = task.subtasks.find((s) => s.id === subtaskId)
    await sync.enqueue({ type: 'subtask', label: `${done ? 'Fait' : 'À refaire'} : ${sub?.title ?? 'sous-tâche'}`, method: 'PATCH', path: `subtasks/${subtaskId}`, payload: { is_done: done } })
  }

  async function addNote(task: Task, body: string): Promise<void> {
    await sync.enqueue({ type: 'note', label: `Note sur « ${task.title} » : ${body.slice(0, 40)}`, method: 'POST', path: `tasks/${task.id}/notes`, payload: { body } })
  }

  function reset(): void {
    items.value = []
    syncedAt.value = null
    loaded.value = false
  }

  sync.onFlushed(() => void refresh().catch(() => undefined))
  onWipe(reset)

  return { items, all, mine, open, openMineCount, syncedAt, loaded, syncing, allowed, load, refresh, find, setStatus, toggleSubtask, addNote, reset }
})
