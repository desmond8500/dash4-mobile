import { defineStore } from 'pinia'
import { ref } from 'vue'
import { ApiError, EQUIPMENT_STATUSES, type EquipmentStatus, type Site } from '@dash4/shared'
import { api } from '@/services/api'
import { kv, onWipe } from '@/offline/db'
import { plain } from '@/offline/collection'
import { useAuthStore } from './auth'
import { useSyncStore } from './sync'

const key = (projectId: number) => `sites.${projectId}`

export const SITE_PERMISSIONS = ['sites.view', 'sites.view.own']

/**
 * Chantiers consultés sur le téléphone (bâtiments, systèmes, équipements et leurs caractéristiques) :
 * gardés pour être lus sans réseau ; avancement et état des équipements envoyés via la file d'attente.
 */
export const useSitesStore = defineStore('sites', () => {
  const auth = useAuthStore()
  const sync = useSyncStore()
  const sites = ref<Record<number, Site>>({})
  const errors = ref<Record<number, string>>({})

  const allowed = () => auth.canAny(SITE_PERMISSIONS)

  async function save(projectId: number, site: Site): Promise<void> {
    sites.value = { ...sites.value, [projectId]: site }
    await kv.set(key(projectId), plain(site))
  }

  async function load(projectId: number): Promise<void> {
    if (sites.value[projectId] || !allowed()) return
    const stored = await kv.get<Site>(key(projectId))
    if (stored) sites.value = { ...sites.value, [projectId]: stored }
  }

  async function refresh(projectId: number): Promise<void> {
    if (!allowed()) return
    await load(projectId)
    try {
      await save(projectId, await api.sites.get(projectId))
      const rest = { ...errors.value }
      delete rest[projectId]
      errors.value = rest
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) {
        // Plus d'accès à ce chantier : rien ne reste sur le téléphone
        const rest = { ...sites.value }
        delete rest[projectId]
        sites.value = rest
        await kv.delete(key(projectId))
        errors.value = { ...errors.value, [projectId]: "Vous n'avez plus accès à ce chantier." }
      } else if (!(e instanceof ApiError && e.status === 0)) {
        errors.value = { ...errors.value, [projectId]: e instanceof Error ? e.message : 'Chargement impossible.' }
      }
    }
  }

  /** Relevé d'avancement : affiché tout de suite, envoyé dès que possible. */
  async function addProgress(projectId: number, systemId: number, percent: number, note: string | null): Promise<void> {
    const site = sites.value[projectId]
    const system = site?.systems.find((s) => s.id === systemId)
    if (!site || !system) return
    system.progress = percent
    site.progress = Math.round(site.systems.reduce((sum, s) => sum + s.progress, 0) / Math.max(site.systems.length, 1))
    await save(projectId, site)
    await sync.enqueue({
      type: 'site_progress',
      label: `Avancement ${system.name} : ${percent} %`,
      method: 'POST',
      path: `installed-systems/${systemId}/progress`,
      payload: { percent, note },
    })
  }

  async function setEquipmentStatus(projectId: number, equipmentId: number, status: EquipmentStatus): Promise<void> {
    const site = sites.value[projectId]
    const equipment = site?.systems.flatMap((s) => s.equipment ?? []).find((e) => e.id === equipmentId)
    if (!site || !equipment) return
    const label = EQUIPMENT_STATUSES.find((s) => s.value === status)?.label ?? status
    equipment.status = { value: status, label }
    await save(projectId, site)
    await sync.enqueue({ type: 'equipment', label: `${equipment.name} : ${label.toLowerCase()}`, method: 'PATCH', path: `equipment/${equipmentId}`, payload: { status } })
  }

  function reset(): void {
    sites.value = {}
    errors.value = {}
  }

  onWipe(reset)

  return { sites, errors, allowed, load, refresh, addProgress, setEquipmentStatus, reset }
})
