import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { DashboardWidgets } from '@dash4/shared'
import { api } from '@/services/api'
import { kv, onWipe } from '@/offline/db'
import { plain } from '@/offline/collection'

const KEY = 'dashboard.widgets'

/** Chiffres du tableau de bord (selon les droits du compte), gardés pour l'accueil hors ligne. */
export const useDashboardStore = defineStore('dashboard', () => {
  const widgets = ref<DashboardWidgets>({})
  const updatedAt = ref<string | null>(null)

  async function load(): Promise<void> {
    const stored = await kv.get<{ widgets: DashboardWidgets; at: string }>(KEY)
    if (stored) {
      widgets.value = stored.widgets
      updatedAt.value = stored.at
    }
  }

  async function refresh(): Promise<void> {
    try {
      widgets.value = (await api.dashboard.get()).widgets
      updatedAt.value = new Date().toISOString()
      await kv.set(KEY, plain({ widgets: widgets.value, at: updatedAt.value }))
    } catch {
      // hors ligne : derniers chiffres connus
    }
  }

  onWipe(() => {
    widgets.value = {}
    updatedAt.value = null
  })

  return { widgets, updatedAt, load, refresh }
})
