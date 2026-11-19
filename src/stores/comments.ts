import { defineStore } from 'pinia'
import { ref } from 'vue'
import { ApiError, type Comment, type CommentableType, type Mentionable } from '@dash4/shared'
import { api } from '@/services/api'
import { kv, onWipe } from '@/offline/db'
import { mergeChanges, plain } from '@/offline/collection'
import { useSyncStore } from './sync'

const PHOTOS_KEY = 'comments.photos'
const threadKey = (type: CommentableType, id: number) => `comments.${type}.${id}`
const photoKey = (uuid: string, i: number) => `comments.photo.${uuid}.${i}`

interface Thread {
  items: Comment[]
  syncedAt: string | null
  people: Mentionable[]
}

/**
 * Commentaires des fiches ouvertes sur le téléphone : lus depuis la copie locale, écrits via la
 * file d'attente (avec leurs photos, envoyées une fois le commentaire arrivé sur le serveur).
 */
export const useCommentsStore = defineStore('comments', () => {
  const sync = useSyncStore()
  const threads = ref<Record<string, Thread>>({})
  /** uuid du commentaire → fiche et nombre de photos en attente. */
  const pendingPhotos = ref<Record<string, { type: CommentableType; id: number; count: number }>>({})
  let photosLoaded = false

  const thread = (type: CommentableType, id: number): Thread => threads.value[threadKey(type, id)] ?? { items: [], syncedAt: null, people: [] }

  async function save(type: CommentableType, id: number, t: Thread): Promise<void> {
    threads.value = { ...threads.value, [threadKey(type, id)]: t }
    await kv.set(threadKey(type, id), plain(t))
  }

  async function loadPhotos(): Promise<void> {
    if (photosLoaded) return
    pendingPhotos.value = (await kv.get<typeof pendingPhotos.value>(PHOTOS_KEY)) ?? {}
    photosLoaded = true
  }

  async function load(type: CommentableType, id: number): Promise<void> {
    await loadPhotos()
    if (threads.value[threadKey(type, id)]) return
    const stored = await kv.get<Thread>(threadKey(type, id))
    threads.value = { ...threads.value, [threadKey(type, id)]: stored ?? { items: [], syncedAt: null, people: [] } }
  }

  async function refresh(type: CommentableType, id: number): Promise<void> {
    await load(type, id)
    try {
      const t = thread(type, id)
      const result = await api.comments.list(type, id, t.syncedAt)
      const people = await api.comments.mentionable(type, id).catch(() => t.people)
      await save(type, id, { items: mergeChanges(t.syncedAt ? t.items : [], result.data), syncedAt: result.meta.server_time, people })
      await uploadPhotos()
    } catch (e) {
      // Hors ligne ou fiche plus accessible : on garde la copie locale
      if (e instanceof ApiError && e.status === 403) await save(type, id, { items: [], syncedAt: null, people: [] })
    }
  }

  async function uploadPhotos(): Promise<void> {
    for (const [uuid, p] of Object.entries({ ...pendingPhotos.value })) {
      const comment = thread(p.type, p.id).items.find((c) => c.client_uuid === uuid)
      if (!comment) continue
      for (let i = 0; i < p.count; i++) {
        const blob = await kv.get<Blob>(photoKey(uuid, i))
        if (blob) await api.documents.upload('comments', comment.id, blob, `photo-${i + 1}.jpg`)
        await kv.delete(photoKey(uuid, i))
      }
      const rest = { ...pendingPhotos.value }
      delete rest[uuid]
      pendingPhotos.value = rest
      await kv.set(PHOTOS_KEY, plain(rest))
      // Recharge le fil pour afficher les photos envoyées
      const t = thread(p.type, p.id)
      const result = await api.comments.list(p.type, p.id, t.syncedAt).catch(() => null)
      if (result) await save(p.type, p.id, { ...t, items: mergeChanges(t.items, result.data), syncedAt: result.meta.server_time })
    }
  }

  async function add(type: CommentableType, id: number, body: string, mentions: number[], photos: Blob[] = []): Promise<void> {
    await loadPhotos()
    const item = await sync.enqueue({
      type: 'comment',
      label: `Commentaire : ${body.slice(0, 50)}`,
      method: 'POST',
      path: `${type}/${id}/comments`,
      payload: { body, mentions },
    })
    if (photos.length) {
      await Promise.all(photos.map((p, i) => kv.set(photoKey(item.id, i), p)))
      pendingPhotos.value = { ...pendingPhotos.value, [item.id]: { type, id, count: photos.length } }
      await kv.set(PHOTOS_KEY, plain(pendingPhotos.value))
    }
  }

  async function remove(type: CommentableType, id: number, comment: Comment): Promise<void> {
    const t = thread(type, id)
    await save(type, id, { ...t, items: t.items.filter((c) => c.id !== comment.id) })
    await sync.enqueue({ type: 'comment', label: 'Commentaire supprimé', method: 'DELETE', path: `comments/${comment.id}`, payload: {} })
  }

  /** Commentaires de cette fiche encore dans la file d'attente. */
  const pendingFor = (type: CommentableType, id: number) =>
    sync.pending.filter((p) => p.method === 'POST' && p.path === `${type}/${id}/comments`)
  const photosWaiting = (uuid: string) => pendingPhotos.value[uuid]?.count ?? 0

  function reset(): void {
    threads.value = {}
    pendingPhotos.value = {}
    photosLoaded = false
  }

  sync.onFlushed(() => void uploadPhotos().catch(() => undefined))
  onWipe(reset)

  return { threads, thread, load, refresh, add, remove, pendingFor, photosWaiting, reset }
})
