import type { Conversation, Message } from '@dash4/shared'
import type { OutboxItem } from '@/offline/outbox'

/** Clé d'une conversation : son id, ou l'identifiant hors ligne d'une conversation pas encore envoyée. */
export type ConversationKey = number | string

/** Conversation privée déjà connue avec cette personne. */
export function findDirect(list: Conversation[], otherId: number): Conversation | undefined {
  return list.find((c) => c.type === 'direct' && c.members.some((m) => m.id === otherId))
}

/** Messages encore dans la file d'attente pour cette conversation (par son id ou son identifiant hors ligne). */
export function pendingMessages(pending: OutboxItem[], keys: ConversationKey[]): OutboxItem[] {
  const paths = new Set(keys.map((k) => `conversations/${k}/messages`))
  return pending.filter((p) => p.method === 'POST' && paths.has(p.path))
}

/** Conversations créées hors ligne, pas encore arrivées sur le serveur. */
export function pendingConversations(pending: OutboxItem[]): OutboxItem[] {
  return pending.filter((p) => p.method === 'POST' && p.path === 'conversations')
}

/** Fusion des messages relevés : suppressions gardées (affichées « Message supprimé »), triés. */
export function mergeThread(current: Message[], incoming: Message[]): Message[] {
  const byId = new Map(current.map((m) => [m.id, m]))
  for (const m of incoming) byId.set(m.id, m)
  return [...byId.values()].sort((a, b) => a.id - b.id)
}

/** Total des non lus, pour le badge de l'onglet. */
export function unreadTotal(list: Pick<Conversation, 'unread_count'>[]): number {
  return list.reduce((t, c) => t + c.unread_count, 0)
}
