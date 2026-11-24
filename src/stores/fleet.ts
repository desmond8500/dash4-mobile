import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { ApiError, type Vehicle } from '@dash4/shared'
import { api } from '@/services/api'
import { kv, onWipe } from '@/offline/db'
import { plain } from '@/offline/collection'
import { useAuthStore } from './auth'
import { useSyncStore } from './sync'
import { pendingMileages, sortVehicles } from '@/utils/fleet'

const ITEMS_KEY = 'fleet.items'
const PHOTOS_KEY = 'fleet.photos.pending'
const photoKey = (id: string) => `fleet.photo.${id}`
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
  /** Photos prises sur le téléphone, envoyées dès que le réseau est là (galerie du véhicule). */
  const pendingPhotos = ref<Array<{ id: string; vehicleId: number; main?: boolean }>>([])
  const loaded = ref(false)
  const syncing = ref(false)

  const allowed = () => auth.canAny(FLEET_PERMISSIONS)
  const visible = computed(() => sortVehicles(items.value))
  const alertsCount = computed(() => items.value.filter((v) => (v.alerts ?? []).length).length)

  async function load(): Promise<void> {
    if (loaded.value || !allowed()) return
    items.value = (await kv.get<Vehicle[]>(ITEMS_KEY)) ?? []
    pendingPhotos.value = (await kv.get<Array<{ id: string; vehicleId: number; main?: boolean }>>(PHOTOS_KEY)) ?? []
    loaded.value = true
  }

  async function refresh(): Promise<void> {
    if (!allowed() || syncing.value) return
    await load()
    syncing.value = true
    try {
      items.value = await api.vehicles.list()
      await kv.set(ITEMS_KEY, plain(items.value))
      await uploadPhotos()
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

  /**
   * Photo du véhicule (état, dégâts, compteur…) prise sur le téléphone : gardée sur le téléphone et envoyée
   * dans la galerie du véhicule dès que le réseau est là. `main` : devient aussi la photo principale.
   */
  async function addPhoto(vehicle: Vehicle, photo: Blob, main = false): Promise<void> {
    const id = globalThis.crypto.randomUUID()
    await kv.set(photoKey(id), photo)
    pendingPhotos.value = [...pendingPhotos.value, { id, vehicleId: vehicle.id, ...(main ? { main: true } : {}) }]
    await kv.set(PHOTOS_KEY, plain(pendingPhotos.value))
    await uploadPhotos().catch(() => undefined)
  }

  async function uploadPhotos(): Promise<void> {
    if (!sync.online) return
    for (const p of [...pendingPhotos.value]) {
      const blob = await kv.get<Blob>(photoKey(p.id))
      if (blob) {
        try {
          if (p.main) {
            const updated = await api.photos.upload('vehicles', p.vehicleId, blob, 'vehicule.jpg')
            items.value = items.value.map((v) => (v.id === updated.id ? updated : v))
            await kv.set(ITEMS_KEY, plain(items.value))
          } else {
            await api.documents.upload('vehicles', p.vehicleId, blob, `photo-${new Date().toISOString().slice(0, 10)}.jpg`)
          }
        } catch (e) {
          // Plus de réseau : on réessaiera ; refus de l'API (droit retiré, fichier refusé) : la photo est abandonnée
          if (e instanceof ApiError && e.status === 0) return
        }
      }
      await kv.delete(photoKey(p.id))
      pendingPhotos.value = pendingPhotos.value.filter((x) => x.id !== p.id)
      await kv.set(PHOTOS_KEY, plain(pendingPhotos.value))
    }
  }

  /** Photos en attente d'envoi pour ce véhicule. */
  const pendingPhotosFor = (vehicleId: number) => pendingPhotos.value.filter((p) => p.vehicleId === vehicleId).length

  /** Relevés en attente d'envoi pour ce véhicule. */
  const pendingFor = (vehicleId: number) => pendingMileages(sync.pending, vehicleId)

  sync.onFlushed(() => void refresh().catch(() => undefined))
  // Au retour du réseau, même sans autre action en attente
  watch(() => sync.online, (online) => online && void uploadPhotos().catch(() => undefined))

  function reset(): void {
    items.value = []
    pendingPhotos.value = []
    loaded.value = false
  }
  onWipe(reset)

  return { items, visible, alertsCount, loaded, syncing, allowed, load, refresh, detail, recordMileage, pendingFor, addPhoto, pendingPhotosFor, reset }
})
