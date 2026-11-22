import { defineStore } from 'pinia'
import { ref } from 'vue'
import { ApiError, EQUIPMENT_STATUSES, splitEquipmentLocally, type EquipmentPayload, type QuoteSitePayload, type EquipmentStatus, type Plan, type Site } from '@dash4/shared'
import { api } from '@/services/api'
import { kv, onWipe } from '@/offline/db'
import { plain } from '@/offline/collection'
import { useAuthStore } from './auth'
import { useSyncStore } from './sync'
import { canUseCachedPlan } from '@/utils/sites'
import { applyEquipment, removeEquipment } from '@/utils/equipment'
import { staleFileIds } from '@/utils/plans'

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

  /** Éclate un groupe en appareils identiques de quantité 1 (copies provisoires jusqu'à l'envoi). */
  async function splitEquipment(projectId: number, equipmentId: number): Promise<void> {
    const site = sites.value[projectId]
    const equipment = site?.systems.flatMap((s) => s.equipment ?? []).find((e) => e.id === equipmentId)
    if (!site || !equipment || equipment.id < 0 || equipment.quantity <= 1) return
    await sync.enqueue({ type: 'equipment', label: `Groupe éclaté : ${equipment.quantity} × ${equipment.name}`, method: 'POST', path: `equipment/${equipmentId}/split`, payload: {} })
    touched.add(projectId)
    const base = -Date.now()
    await save(projectId, splitEquipmentLocally(site, equipmentId, (i) => base - i))
  }

  /** Appareils créés depuis un devis : envoyés dès que possible, puis le chantier est rechargé. */
  async function fromQuote(projectId: number, quote: { id: number; number: string }, payload: QuoteSitePayload, count: number): Promise<void> {
    await sync.enqueue({ type: 'equipment', label: `Devis ${quote.number} vers le chantier : ${count} appareil${count > 1 ? 's' : ''}`, method: 'POST', path: `quotes/${quote.id}/site-equipment`, payload: { ...payload } })
    touched.add(projectId)
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

  // --- Tous les plans visibles (page Plans) et fichiers gardés sur le téléphone -------------------------
  const ALL_KEY = 'sites.plans.all'
  const FILES_KEY = 'sites.planfiles'
  const allPlans = ref<Plan[]>([])
  /** Fichiers gardés : numéro du plan → `updated_at` de la version gardée. */
  const files = ref<Record<string, string | null>>({})
  const plansLoaded = ref(false)
  const plansSyncing = ref(false)

  async function loadAllPlans(): Promise<void> {
    if (!plansLoaded.value) {
      allPlans.value = (await kv.get<Plan[]>(ALL_KEY)) ?? []
      files.value = (await kv.get<Record<string, string | null>>(FILES_KEY)) ?? {}
      plansLoaded.value = true
    }
  }

  /** Liste à jour ; les fichiers des plans supprimés ou plus visibles sont effacés du téléphone. */
  async function refreshAllPlans(): Promise<void> {
    await loadAllPlans()
    plansSyncing.value = true
    try {
      const list = await api.plans.all()
      allPlans.value = list
      await kv.set(ALL_KEY, plain(list))
      // Chaque chantier garde aussi sa liste (page du plan hors ligne)
      const byProject = new Map<number, Plan[]>()
      for (const p of list) byProject.set(p.project_id, [...(byProject.get(p.project_id) ?? []), p])
      for (const [projectId, items] of byProject) {
        plans.value = { ...plans.value, [projectId]: items }
        await kv.set(`sites.plans.${projectId}`, plain(items))
      }
      const stale = staleFileIds(files.value, list)
      if (stale.length) {
        for (const id of stale) await kv.delete(`sites.planfile.${id}`)
        files.value = Object.fromEntries(Object.entries(files.value).filter(([id]) => !stale.includes(Number(id))))
        await kv.set(FILES_KEY, { ...files.value })
      }
    } finally {
      plansSyncing.value = false
    }
  }

  async function rememberFile(plan: Plan): Promise<void> {
    files.value = { ...files.value, [plan.id]: plan.updated_at }
    await kv.set(FILES_KEY, { ...files.value })
  }

  /** Garde des plans pour le hors ligne : fichiers et chantiers (équipements des repères). */
  async function keepOffline(list: Plan[], progress: (done: number) => void = () => undefined): Promise<number> {
    let done = 0
    let failed = 0
    for (const projectId of new Set(list.map((p) => p.project_id))) await refresh(projectId)
    for (const plan of list) {
      try {
        await planFile(plan)
      } catch {
        failed++
      }
      progress(++done)
    }
    return failed
  }

  /** Fichier du plan : téléchargé une fois, puis lu depuis le téléphone (même hors ligne). */
  async function planFile(plan: Plan): Promise<Blob> {
    const cacheKey = `sites.planfile.${plan.id}`
    const cached = await kv.get<{ updated_at: string | null; blob: Blob }>(cacheKey)
    if (cached && canUseCachedPlan(cached, plan, sync.online)) return cached.blob
    try {
      const blob = await api.plans.file(plan)
      await kv.set(cacheKey, { updated_at: plan.updated_at, blob })
      await rememberFile(plan)
      return blob
    } catch (e) {
      if (cached) return cached.blob
      throw e
    }
  }

  function reset(): void {
    allPlans.value = []
    files.value = {}
    plansLoaded.value = false
    plans.value = {}
    sites.value = {}
    errors.value = {}
  }

  onWipe(reset)

  return { sites, errors, plans, allowed, load, refresh, loadPlans, planFile, addProgress, setEquipmentStatus, saveEquipment, deleteEquipment, splitEquipment, fromQuote, allPlans, files, plansSyncing, loadAllPlans, refreshAllPlans, keepOffline, reset }
})
