import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { ApiError, type Vehicle } from '@dash4/shared'
import { api } from '@/services/api'
import { kv, onWipe } from '@/offline/db'
import { plain } from '@/offline/collection'
import { useAuthStore } from './auth'
import { useSyncStore } from './sync'
import { pendingMileages, sortVehicles } from '@/utils/fleet'

const ITEMS_KEY = 'fleet.items'
const detailKey = (id: number) => `fleet.detail.${id}`

export const FLEET_PERMISSIONS = ['vehicles.view', 'vehicles.view.own']

/**
 * Parc automobile sur le téléphone : les véhicules que le compte a le droit de voir (tout le parc, ou ceux
 * dont il est le conducteur), avec papiers et entretiens à surveiller. Les relevés du compteur passent par
 * la file d'attente : ils partent au retour du réseau. Aucun coût n'est gardé sans `costs.view` (l'API ne l'envoie pas).
 */
export const useFleetStore = defineStore('fleet', () => {
  const auth = useAuthStore()
  const sync = useSyncStore()

  const items = ref<Vehicle[]>([])
  const loaded = ref(false)
  const syncing = ref(false)

  const allowed = () => auth.canAny(FLEET_PERMISSIONS)
  const visible = computed(() => sortVehicles(items.value))
  const alertsCount = computed(() => items.value.filter((v) => (v.alerts ?? []).length).length)

  async function load(): Promise<void> {
    if (loaded.value || !allowed()) return
    items.value = (await kv.get<Vehicle[]>(ITEMS_KEY)) ?? []
    loaded.value = true
  }

  async function refresh(): Promise<void> {
    if (!allowed() || syncing.value) return
    await load()
    syncing.value = true
    try {
      items.value = await api.vehicles.list()
      await kv.set(ITEMS_KEY, plain(items.value))
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 0)) throw e
    } finally {
      syncing.value = false
    }
  }

  async function detail(id: number): Promise<{ vehicle: Vehicle | null; offline: boolean }> {
    if (!allowed()) return { vehicle: null, offline: false }
    try {
      const vehicle = await api.vehicles.get(id)
      await kv.set(detailKey(id), plain(vehicle))
      return { vehicle, offline: false }
    } catch (e) {
      if (e instanceof ApiError && e.status !== 0) throw e
      return { vehicle: (await kv.get<Vehicle>(detailKey(id))) ?? items.value.find((v) => v.id === id) ?? null, offline: true }
    }
  }

  /** Relevé du compteur, envoyé maintenant ou au retour du réseau (sans doublon grâce au `client_uuid`). */
  async function recordMileage(vehicle: Vehicle, km: number, note: string | null, readOn: string): Promise<void> {
    await sync.enqueue({
      type: 'vehicle-mileage',
      label: `Compteur ${vehicle.name} : ${km.toLocaleString('fr-FR')} km`,
      method: 'POST',
      path: `vehicles/${vehicle.id}/mileages`,
      payload: { km, note, read_on: readOn },
    })
  }

  /** Relevés en attente d'envoi pour ce véhicule. */
  const pendingFor = (vehicleId: number) => pendingMileages(sync.pending, vehicleId)

  sync.onFlushed(() => void refresh().catch(() => undefined))

  function reset(): void {
    items.value = []
    loaded.value = false
  }
  onWipe(reset)

  return { items, visible, alertsCount, loaded, syncing, allowed, load, refresh, detail, recordMileage, pendingFor, reset }
})
