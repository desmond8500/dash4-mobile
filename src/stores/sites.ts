import { defineStore } from 'pinia'
import { ref } from 'vue'
import { ApiError, EQUIPMENT_STATUSES, type EquipmentPayload, type EquipmentStatus, type Plan, type Site } from '@dash4/shared'
import { api } from '@/services/api'
import { kv, onWipe } from '@/offline/db'
import { plain } from '@/offline/collection'
import { useAuthStore } from './auth'
import { useSyncStore } from './sync'
import { canUseCachedPlan } from '@/utils/sites'
import { applyEquipment, removeEquipment } from '@/utils/equipment'

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
  const plans = ref<Record<number, Plan[]>>({})

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
    if (!site || !equipment || equipment.id < 0) return
    const label = EQUIPMENT_STATUSES.find((s) => s.value === status)?.label ?? status
    equipment.status = { value: status, label }
    await save(projectId, site)
    await sync.enqueue({ type: 'equipment', label: `${equipment.name} : ${label.toLowerCase()}`, method: 'PATCH', path: `equipment/${equipmentId}`, payload: { status } })
  }

  // Chantiers modifiés sur le téléphone : rechargés après l'envoi (vrais numéros des équipements créés)
  const touched = new Set<number>()
  sync.onFlushed(() => {
    for (const projectId of [...touched]) {
      touched.delete(projectId)
      void refresh(projectId)
    }
  })

  /**
   * Crée ou modifie un équipement : affiché tout de suite, envoyé dès que possible.
   * Un équipement créé hors ligne garde un numéro provisoire (négatif) jusqu'à l'envoi.
   */
  async function saveEquipment(
    projectId: number,
    payload: EquipmentPayload & { installed_system_id: number },
    equipmentId: number | null,
    article: { id: number; designation: string; reference: string | null } | null = null,
  ): Promise<void> {
    const site = sites.value[projectId]
    if (!site) return
    const existing = equipmentId ? (site.systems.flatMap((s) => s.equipment ?? []).find((e) => e.id === equipmentId) ?? null) : null
    const name = payload.name ?? article?.designation ?? existing?.name ?? 'Équipement'
    if (existing) {
      await sync.enqueue({ type: 'equipment', label: `Équipement modifié : ${name}`, method: 'PATCH', path: `equipment/${existing.id}`, payload: { ...payload } })
    } else {
      await sync.enqueue({ type: 'equipment', label: `Équipement ajouté : ${name}`, method: 'POST', path: `installed-systems/${payload.installed_system_id}/equipment`, payload: { ...payload } })
    }
    touched.add(projectId)
    await save(projectId, applyEquipment(site, payload, existing, -Date.now(), article))
  }

  async function deleteEquipment(projectId: number, equipmentId: number): Promise<void> {
    const site = sites.value[projectId]
    const equipment = site?.systems.flatMap((s) => s.equipment ?? []).find((e) => e.id === equipmentId)
    if (!site || !equipment || equipment.id < 0) return
    await sync.enqueue({ type: 'equipment', label: `Équipement supprimé : ${equipment.name}`, method: 'DELETE', path: `equipment/${equipmentId}`, payload: {} })
    touched.add(projectId)
    await save(projectId, removeEquipment(site, equipmentId))
  }

  /** Plans du chantier (liste et repères), gardés avec le chantier. */
  async function loadPlans(projectId: number): Promise<void> {
    if (!plans.value[projectId]) {
      const stored = await kv.get<Plan[]>(`sites.plans.${projectId}`)
      if (stored) plans.value = { ...plans.value, [projectId]: stored }
    }
    try {
      const list = await api.plans.list(projectId)
      plans.value = { ...plans.value, [projectId]: list }
      await kv.set(`sites.plans.${projectId}`, plain(list))
    } catch {
      // hors ligne : copie locale
    }
  }

  /** Fichier du plan : téléchargé une fois, puis lu depuis le téléphone (même hors ligne). */
  async function planFile(plan: Plan): Promise<Blob> {
    const cacheKey = `sites.planfile.${plan.id}`
    const cached = await kv.get<{ updated_at: string | null; blob: Blob }>(cacheKey)
    if (cached && canUseCachedPlan(cached, plan, sync.online)) return cached.blob
    try {
      const blob = await api.plans.file(plan)
      await kv.set(cacheKey, { updated_at: plan.updated_at, blob })
      return blob
    } catch (e) {
      if (cached) return cached.blob
      throw e
    }
  }

  function reset(): void {
    plans.value = {}
    sites.value = {}
    errors.value = {}
  }

  onWipe(reset)

  return { sites, errors, plans, allowed, load, refresh, loadPlans, planFile, addProgress, setEquipmentStatus, saveEquipment, deleteEquipment, reset }
})
