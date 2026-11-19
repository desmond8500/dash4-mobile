import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { AppNotification } from '@dash4/shared'
import { api } from '@/services/api'
import { kv, onWipe } from '@/offline/db'
import { plain } from '@/offline/collection'
import { useSyncStore } from './sync'

const KEY = 'notifications.items'

/** Notifications (mentions, tâches confiées, informations reçues…) : 30 dernières gardées sur le téléphone. */
export const useNotificationsStore = defineStore('notifications', () => {
  const sync = useSyncStore()
  const items = ref<AppNotification[]>([])
  const loaded = ref(false)
  const unread = computed(() => items.value.filter((n) => !n.read_at))

  async function load(): Promise<void> {
    if (loaded.value) return
    items.value = (await kv.get<AppNotification[]>(KEY)) ?? []
    loaded.value = true
  }

  async function refresh(): Promise<void> {
    await load()
    try {
      items.value = (await api.notifications.list({ per_page: 30 })).data
      await kv.set(KEY, plain(items.value))
    } catch {
      // hors ligne : on garde la copie locale
    }
  }

  async function markRead(id: string): Promise<void> {
    const n = items.value.find((x) => x.id === id)
    if (!n || n.read_at) return
    n.read_at = new Date().toISOString()
    await kv.set(KEY, plain(items.value))
    await sync.enqueue({ type: 'notification', label: 'Notification lue', method: 'POST', path: `notifications/${id}/read`, payload: {} })
  }

  function reset(): void {
    items.value = []
    loaded.value = false
  }

  sync.onFlushed(() => void refresh())
  onWipe(reset)

  return { items, unread, loaded, load, refresh, markRead, reset }
})
