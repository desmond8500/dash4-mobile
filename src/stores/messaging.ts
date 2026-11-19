import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { ApiError, lastMessageId, type Conversation, type ConversationPayload, type Message, type MessagingUser } from '@dash4/shared'
import { api } from '@/services/api'
import { kv, onWipe } from '@/offline/db'
import { plain } from '@/offline/collection'
import { findDirect, mergeThread, unreadTotal, type ConversationKey } from '@/utils/messaging'
import { useSyncStore } from './sync'

const LIST_KEY = 'messaging.conversations'
const USERS_KEY = 'messaging.users'
const ALIASES_KEY = 'messaging.aliases'
const PHOTOS_KEY = 'messaging.photos'
const threadKey = (id: number) => `messaging.thread.${id}`
const photoKey = (uuid: string, i: number) => `messaging.photo.${uuid}.${i}`

interface Thread {
  items: Message[]
  syncedAt: string | null
}

/**
 * Messagerie sur le téléphone : conversations et messages lus depuis la copie locale, envois via la
 * file d'attente (photos comprises, envoyées dès que le message est arrivé). Une conversation créée
 * hors ligne est désignée par son identifiant hors ligne jusqu'à ce que le serveur la connaisse.
 */
export const useMessagingStore = defineStore('messaging', () => {
  const sync = useSyncStore()
  const conversations = ref<Conversation[]>([])
  const users = ref<MessagingUser[]>([])
  const threads = ref<Record<number, Thread>>({})
  /** identifiant hors ligne → id sur le serveur */
  const aliases = ref<Record<string, number>>({})
  const pendingPhotos = ref<Record<string, { conversation: ConversationKey; count: number }>>({})
  let loaded = false

  const unread = computed(() => unreadTotal(conversations.value))

  async function load(): Promise<void> {
    if (loaded) return
    const [list, people, al, photos] = await Promise.all([
      kv.get<Conversation[]>(LIST_KEY),
      kv.get<MessagingUser[]>(USERS_KEY),
      kv.get<Record<string, number>>(ALIASES_KEY),
      kv.get<typeof pendingPhotos.value>(PHOTOS_KEY),
    ])
    conversations.value = list ?? []
    users.value = people ?? []
    aliases.value = al ?? {}
    pendingPhotos.value = photos ?? {}
    loaded = true
  }

  async function refresh(): Promise<void> {
    await load()
    try {
      const res = await api.messaging.conversations()
      conversations.value = res.data
      await kv.set(LIST_KEY, plain(res.data))
      if (!users.value.length) await refreshUsers()
    } catch {
      // hors ligne : dernière liste connue
    }
  }

  async function refreshUsers(): Promise<void> {
    try {
      users.value = await api.messaging.users()
      await kv.set(USERS_KEY, plain(users.value))
    } catch {
      // idem
    }
  }

  /** Id serveur d'une conversation (demande au serveur pour une conversation créée hors ligne). */
  async function resolve(key: ConversationKey): Promise<number | null> {
    if (typeof key === 'number') return key
    if (aliases.value[key]) return aliases.value[key]!
    if (!sync.online) return null
    try {
      const c = await api.messaging.get(key)
      aliases.value = { ...aliases.value, [key]: c.id }
      await kv.set(ALIASES_KEY, plain(aliases.value))
      if (!conversations.value.some((x) => x.id === c.id)) conversations.value = [c, ...conversations.value]
      return c.id
    } catch {
      return null
    }
  }

  const thread = (id: number): Thread => threads.value[id] ?? { items: [], syncedAt: null }

  async function loadThread(id: number): Promise<void> {
    if (threads.value[id]) return
    threads.value = { ...threads.value, [id]: (await kv.get<Thread>(threadKey(id))) ?? { items: [], syncedAt: null } }
  }

  async function saveThread(id: number, t: Thread): Promise<void> {
    threads.value = { ...threads.value, [id]: t }
    await kv.set(threadKey(id), plain({ items: t.items.slice(-300), syncedAt: t.syncedAt }))
  }

  /** Relève les nouveaux messages (ou les 50 derniers la première fois). Renvoie true s'il y en a. */
  async function refreshThread(id: number): Promise<boolean> {
    await loadThread(id)
    const t = thread(id)
    try {
      const page = t.items.length
        ? await api.messaging.messages(id, { after_id: lastMessageId(t.items), updated_since: t.syncedAt ?? undefined })
        : await api.messaging.messages(id)
      const c = conversations.value.find((x) => x.id === id)
      if (c) for (const r of page.meta.reads) {
        const m = c.members.find((x) => x.id === r.user_id)
        if (m) m.last_read_message_id = r.last_read_message_id
      }
      await saveThread(id, { items: mergeThread(t.items, page.data), syncedAt: page.meta.server_time })
      await uploadPhotos()
      return page.data.length > 0
    } catch (e) {
      if (e instanceof ApiError && (e.status === 403 || e.status === 404)) {
        await saveThread(id, { items: [], syncedAt: null })
        conversations.value = conversations.value.filter((x) => x.id !== id)
      }
      return false
    }
  }

  async function send(key: ConversationKey, body: string, photos: Blob[] = []): Promise<void> {
    const text = body.trim()
    if (!text && !photos.length) return
    const id = typeof key === 'number' ? key : (aliases.value[key] ?? key)
    const item = await sync.enqueue({
      type: 'message',
      label: `Message : ${(text || 'photo').slice(0, 50)}`,
      method: 'POST',
      path: `conversations/${id}/messages`,
      payload: { body: text || null, with_files: photos.length > 0 },
    })
    if (photos.length) {
      await Promise.all(photos.map((p, i) => kv.set(photoKey(item.id, i), p)))
      pendingPhotos.value = { ...pendingPhotos.value, [item.id]: { conversation: id, count: photos.length } }
      await kv.set(PHOTOS_KEY, plain(pendingPhotos.value))
    }
  }

  async function uploadPhotos(): Promise<void> {
    for (const [uuid, p] of Object.entries({ ...pendingPhotos.value })) {
      const id = await resolve(p.conversation)
      if (!id) continue
      const message = thread(id).items.find((m) => m.client_uuid === uuid)
      if (!message) continue
      for (let i = 0; i < p.count; i++) {
        const blob = await kv.get<Blob>(photoKey(uuid, i))
        if (blob) await api.documents.upload('messages', message.id, blob, `photo-${i + 1}.jpg`)
        await kv.delete(photoKey(uuid, i))
      }
      const rest = { ...pendingPhotos.value }
      delete rest[uuid]
      pendingPhotos.value = rest
      await kv.set(PHOTOS_KEY, plain(rest))
      const t = thread(id)
      const page = await api.messaging.messages(id, { updated_since: t.syncedAt ?? undefined }).catch(() => null)
      if (page) await saveThread(id, { items: mergeThread(t.items, page.data), syncedAt: page.meta.server_time })
    }
  }

  /**
   * Démarre une conversation : une conversation privée connue est reprise ; sinon elle part dans la
   * file d'attente et l'écran l'ouvre par son identifiant hors ligne.
   */
  async function start(payload: Omit<ConversationPayload, 'client_uuid'>): Promise<ConversationKey> {
    if (payload.type === 'direct') {
      const known = findDirect(conversations.value, payload.user_ids[0]!)
      if (known) return known.id
    }
    const names = users.value.filter((u) => payload.user_ids.includes(u.id)).map((u) => u.full_name)
    const item = await sync.enqueue({
      type: 'conversation',
      label: payload.type === 'direct' ? `Conversation avec ${names[0] ?? ''}` : `Groupe ${payload.title ?? ''}`,
      method: 'POST',
      path: 'conversations',
      payload: { ...payload },
    })
    return item.id
  }

  async function markRead(id: number): Promise<void> {
    const c = conversations.value.find((x) => x.id === id)
    if (!c || c.unread_count === 0) return
    c.unread_count = 0
    await kv.set(LIST_KEY, plain(conversations.value))
    await sync.enqueue({ type: 'message', label: 'Conversation lue', method: 'POST', path: `conversations/${id}/read`, payload: {} })
  }

  async function edit(id: number, message: Message, body: string): Promise<void> {
    const t = thread(id)
    await saveThread(id, { ...t, items: t.items.map((m) => (m.id === message.id ? { ...m, body, edited_at: new Date().toISOString() } : m)) })
    await sync.enqueue({ type: 'message', label: 'Message modifié', method: 'PATCH', path: `messages/${message.id}`, payload: { body } })
  }

  async function remove(id: number, message: Message): Promise<void> {
    const t = thread(id)
    await saveThread(id, { ...t, items: t.items.map((m) => (m.id === message.id ? { ...m, body: null, files: [], deleted_at: new Date().toISOString(), can: { update: false } } : m)) })
    await sync.enqueue({ type: 'message', label: 'Message supprimé', method: 'DELETE', path: `messages/${message.id}`, payload: {} })
  }

  const photosWaiting = (uuid: string) => pendingPhotos.value[uuid]?.count ?? 0

  function reset(): void {
    conversations.value = []
    users.value = []
    threads.value = {}
    aliases.value = {}
    pendingPhotos.value = {}
    loaded = false
  }

  sync.onFlushed(() => {
    void refresh()
    void uploadPhotos().catch(() => undefined)
  })
  onWipe(reset)

  return { conversations, users, threads, aliases, unread, load, refresh, refreshUsers, resolve, thread, loadThread, refreshThread, send, start, markRead, edit, remove, photosWaiting }
})
