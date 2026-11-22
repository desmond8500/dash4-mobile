import { defineStore } from 'pinia'
import { ref } from 'vue'
import { ApiError, type PlanIcon } from '@dash4/shared'
import { api } from '@/services/api'
import { kv, onWipe } from '@/offline/db'
import { plain } from '@/offline/collection'

const LIST_KEY = 'planIcons.list'
const imageKey = (icon: PlanIcon) => `planIcons.image.${icon.id}.${icon.updated_at ?? ''}`

function toDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

/**
 * Icônes des plans sur le téléphone : la liste et les images (en data URL) sont gardées pour lire les plans
 * hors ligne ; sans image, le repère prend son symbole.
 */
export const usePlanIconsStore = defineStore('planIcons', () => {
  const icons = ref<PlanIcon[]>([])
  const images = ref<Record<number, string>>({})
  let loaded = false

  async function load(): Promise<void> {
    if (!loaded) {
      icons.value = (await kv.get<PlanIcon[]>(LIST_KEY)) ?? []
      loaded = true
      await readImages()
    }
    try {
      icons.value = await api.planIcons.list()
      await kv.set(LIST_KEY, plain(icons.value))
      await readImages(true)
    } catch (e) {
      if (!(e instanceof ApiError) || (e.status !== 0 && e.status !== 403)) throw e
    }
  }

  async function readImages(fetchMissing = false): Promise<void> {
    const next: Record<number, string> = {}
    for (const icon of icons.value.filter((i) => i.file_path)) {
      let url = await kv.get<string>(imageKey(icon))
      if (!url && fetchMissing) {
        url = await api.planIcons.file(icon).then(toDataUrl).catch(() => undefined)
        if (url) await kv.set(imageKey(icon), url)
      }
      if (url) next[icon.id] = url
    }
    images.value = next
  }

  const byId = (id: number | null | undefined) => (id ? icons.value.find((i) => i.id === id) ?? null : null)

  onWipe(() => {
    icons.value = []
    images.value = {}
    loaded = false
  })

  return { icons, images, load, byId }
})
