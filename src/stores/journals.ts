import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { ApiError, type Assignee, type Journal, type JournalPayload, type QuoteEmailPayload } from '@dash4/shared'
import { api } from '@/services/api'
import { kv, onWipe } from '@/offline/db'
import { mergeChanges, pendingCreations, plain } from '@/offline/collection'
import { useAuthStore } from './auth'
import { useSyncStore } from './sync'
import { applyJournalChanges, normalizePendingPhotos, photoTarget, type ParticipantDraft } from '@/utils/journals'

const ITEMS_KEY = 'journals.items'
const SYNCED_AT_KEY = 'journals.syncedAt'
const PHOTOS_KEY = 'journals.photos'
const photoKey = (uuid: string, i: number) => `journals.photo.${uuid}.${i}`
const UPLOADS_KEY = 'journals.uploads'
const uploadKey = (key: string) => `journals.upload.${key}`
const TEAM_KEY = 'journals.team'

/** Photo ajoutée à un rapport déjà sur le serveur, en attente d'envoi. */
interface PendingUpload {
  key: string
  type: 'journals' | 'journal-sections'
  id: number
  name: string
}

export const JOURNAL_PERMISSIONS = ['journals.view', 'journals.view.own']

/**
 * Rapports d'intervention sur le téléphone : rédigés sans réseau, avec les photos gardées sur
 * le téléphone puis envoyées dès que le rapport est arrivé sur le serveur, chacune dans sa section.
 */
export const useJournalsStore = defineStore('journals', () => {
  const auth = useAuthStore()
  const sync = useSyncStore()

  const items = ref<Journal[]>([])
  const syncedAt = ref<string | null>(null)
  const loaded = ref(false)
  const syncing = ref(false)
  /** uuid du rapport → position de section de chaque photo en attente (null : photo du rapport). */
  const pendingPhotos = ref<Record<string, Array<number | null>>>({})
  const pendingUploads = ref<PendingUpload[]>([])
  /** Personnes de l'équipe, pour choisir les intervenants (gardées pour le hors ligne). */
  const team = ref<Assignee[]>([])

  const allowed = () => auth.canAny(JOURNAL_PERMISSIONS)
  const sorted = computed(() => items.value.filter((j) => !j.deleted_at).sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '') || b.id - a.id))
  const pending = computed(() => pendingCreations(sync.pending, 'journals'))

  async function load(): Promise<void> {
    if (loaded.value || !allowed()) return
    const [stored, at, photos, uploads, people] = await Promise.all([
      kv.get<Journal[]>(ITEMS_KEY),
      kv.get<string>(SYNCED_AT_KEY),
      kv.get<Record<string, number | Array<number | null>>>(PHOTOS_KEY),
      kv.get<PendingUpload[]>(UPLOADS_KEY),
      kv.get<Assignee[]>(TEAM_KEY),
    ])
    pendingUploads.value = uploads ?? []
    team.value = people ?? []
    items.value = stored ?? []
    syncedAt.value = at ?? null
    pendingPhotos.value = normalizePendingPhotos(photos)
    loaded.value = true
  }

  async function refresh(): Promise<void> {
    if (!allowed() || syncing.value) return
    await load()
    syncing.value = true
    try {
      const since = syncedAt.value
      const result = await api.syncAll((f) => api.journals.list(f), since)
      items.value = mergeChanges(since ? items.value : [], result.items)
      syncedAt.value = result.serverTime
      await Promise.all([kv.set(ITEMS_KEY, plain(items.value)), kv.set(SYNCED_AT_KEY, syncedAt.value)])
      await uploadPhotos()
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 0)) throw e
    } finally {
      syncing.value = false
    }
  }

  async function uploadPhotos(): Promise<void> {
    let uploaded = false
    // Photos ajoutées en modifiant un rapport
    for (const u of [...pendingUploads.value]) {
      const blob = await kv.get<Blob>(uploadKey(u.key))
      if (blob) await api.documents.upload(u.type, u.id, blob, `${u.name}.jpg`, u.name)
      await kv.delete(uploadKey(u.key))
      pendingUploads.value = pendingUploads.value.filter((x) => x.key !== u.key)
      await kv.set(UPLOADS_KEY, plain(pendingUploads.value))
      uploaded = true
    }
    for (const [uuid, positions] of Object.entries({ ...pendingPhotos.value })) {
      const journal = items.value.find((j) => j.client_uuid === uuid)
      if (!journal) continue
      for (const [i, position] of positions.entries()) {
        const blob = await kv.get<Blob>(photoKey(uuid, i))
        const target = photoTarget(journal, position)
        if (blob) await api.documents.upload(target.type, target.id, blob, `photo-${i + 1}.jpg`, `Photo ${i + 1} — ${journal.title}`)
        await kv.delete(photoKey(uuid, i))
        uploaded = true
      }
      const rest = { ...pendingPhotos.value }
      delete rest[uuid]
      pendingPhotos.value = rest
      await kv.set(PHOTOS_KEY, plain(rest))
    }
    // Les sections renvoient leurs photos : on recharge les rapports concernés
    if (uploaded) {
      const since = syncedAt.value
      const result = await api.syncAll((f) => api.journals.list(f), since)
      items.value = mergeChanges(items.value, result.items)
      syncedAt.value = result.serverTime
      await Promise.all([kv.set(ITEMS_KEY, plain(items.value)), kv.set(SYNCED_AT_KEY, syncedAt.value)])
    }
  }

  /** `photos` : chaque photo avec la position de sa section dans `payload.sections` (null : photo du rapport). */
  async function create(payload: JournalPayload & { title: string; date: string }, photos: Array<{ blob: Blob; section: number | null }> = []): Promise<void> {
    const item = await sync.enqueue({ type: 'journal', label: `Rapport : ${payload.title}`, method: 'POST', path: 'journals', payload: plain(payload) as unknown as Record<string, unknown> })
    if (photos.length) {
      await Promise.all(photos.map((p, i) => kv.set(photoKey(item.id, i), p.blob)))
      pendingPhotos.value = { ...pendingPhotos.value, [item.id]: photos.map((p) => p.section) }
      await kv.set(PHOTOS_KEY, plain(pendingPhotos.value))
    }
  }

  /**
   * Modifie un rapport déjà sur le serveur : envoyé maintenant ou au retour du réseau ; la copie du
   * téléphone change tout de suite. Les photos vont dans les sections existantes ou avec le rapport.
   */
  async function update(
    journal: Journal,
    payload: JournalPayload,
    project: { id: number; name: string } | null,
    participants: ParticipantDraft[],
    photos: Array<{ blob: Blob; type: 'journals' | 'journal-sections'; id: number }> = [],
  ): Promise<void> {
    await sync.enqueue({ type: 'journal-update', label: `Rapport modifié : ${payload.title ?? journal.title}`, method: 'PATCH', path: `journals/${journal.id}`, payload: plain(payload) as unknown as Record<string, unknown> })
    items.value = items.value.map((j) => (j.id === journal.id ? applyJournalChanges(j, payload, project, participants) : j))
    await kv.set(ITEMS_KEY, plain(items.value))
    if (photos.length) {
      const stamp = Date.now()
      const added: PendingUpload[] = photos.map((p, i) => ({ key: `${journal.id}-${stamp}-${i}`, type: p.type, id: p.id, name: `Photo — ${payload.title ?? journal.title}` }))
      await Promise.all(added.map((u, i) => kv.set(uploadKey(u.key), photos[i]!.blob)))
      pendingUploads.value = [...pendingUploads.value, ...added]
      await kv.set(UPLOADS_KEY, plain(pendingUploads.value))
      if (sync.online) void uploadPhotos().catch(() => undefined)
    }
  }

  /** Mise à la corbeille : retirée tout de suite du téléphone, envoyée dès que possible. */
  async function remove(journal: Journal): Promise<void> {
    await sync.enqueue({ type: 'journal-delete', label: `Rapport supprimé : ${journal.title}`, method: 'DELETE', path: `journals/${journal.id}`, payload: {} })
    items.value = items.value.filter((j) => j.id !== journal.id)
    await kv.set(ITEMS_KEY, plain(items.value))
  }

  /** Envoi par e-mail avec le PDF : part maintenant ou au retour du réseau. */
  async function sendEmail(journal: Journal, payload: QuoteEmailPayload): Promise<void> {
    await sync.enqueue({
      type: 'journal-send',
      label: `Rapport envoyé à ${payload.to.join(', ')} : ${journal.title}`,
      method: 'POST',
      path: `journals/${journal.id}/send`,
      payload: plain(payload) as unknown as Record<string, unknown>,
    })
  }

  /** Équipe à jour si le réseau est là, sinon la dernière liste gardée. */
  async function loadTeam(): Promise<Assignee[]> {
    await load()
    try {
      team.value = await api.assignees.list()
      await kv.set(TEAM_KEY, plain(team.value))
    } catch {
      // Hors ligne ou pas le droit : la liste gardée (éventuellement vide) sert
    }
    return team.value
  }

  const find = (id: number) => items.value.find((j) => j.id === id)
  const photosWaiting = (uuid: string | null, id?: number) =>
    (uuid ? (pendingPhotos.value[uuid]?.length ?? 0) : 0) + (id ? pendingUploads.value.filter((u) => u.key.startsWith(`${id}-`)).length : 0)

  function reset(): void {
    items.value = []
    syncedAt.value = null
    pendingPhotos.value = {}
    pendingUploads.value = []
    team.value = []
    loaded.value = false
  }

  sync.onFlushed(() => void refresh().catch(() => undefined))
  onWipe(reset)

  return { items, sorted, pending, syncedAt, loaded, syncing, team, allowed, load, refresh, create, update, remove, sendEmail, loadTeam, find, photosWaiting, reset }
})
