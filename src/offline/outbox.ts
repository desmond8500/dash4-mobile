import { ApiError } from '@dash4/shared'

/**
 * File d'attente des actions faites hors ligne.
 *
 * Chaque action garde un identifiant unique (`id`), envoyé à l'API sous le nom `client_uuid` :
 * si un envoi est répété (réseau coupé au mauvais moment), l'API reconnaît l'action et ne crée pas de doublon.
 * Les actions sont envoyées dans l'ordre où elles ont été faites.
 */

export interface OutboxItem {
  /** Identifiant unique de l'action, envoyé comme `client_uuid`. */
  id: string
  /** Type d'action, pour l'affichage (ex. « report », « client_request »). */
  type: string
  /** Libellé affiché dans l'écran de synchronisation. */
  label: string
  method: 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  path: string
  payload: Record<string, unknown>
  createdAt: number
  attempts: number
  /** Dernière erreur renvoyée par l'API (action refusée, à corriger ou supprimer). */
  lastError?: string
}

export interface OutboxStore {
  all(): Promise<OutboxItem[]>
  put(item: OutboxItem): Promise<void>
  delete(id: string): Promise<void>
  clear(): Promise<void>
}

export type SendFn = (item: OutboxItem) => Promise<unknown>

export interface FlushResult {
  sent: number
  failed: number
  /** Vrai si l'envoi s'est arrêté faute de réseau ou de session valide. */
  interrupted: boolean
}

export function newClientUuid(): string {
  return globalThis.crypto.randomUUID()
}

export function createOutbox(store: OutboxStore, send: SendFn) {
  let flushing: Promise<FlushResult> | null = null

  async function enqueue(
    action: Pick<OutboxItem, 'type' | 'label' | 'method' | 'path' | 'payload'>,
  ): Promise<OutboxItem> {
    const id = newClientUuid()
    const item: OutboxItem = {
      ...action,
      id,
      // client_uuid seulement pour une création : l'API le refuse sur une modification
      payload: action.method === 'POST' ? { ...action.payload, client_uuid: id } : { ...action.payload },
      createdAt: Date.now(),
      attempts: 0,
    }
    await store.put(item)
    return item
  }

  async function flushOnce(): Promise<FlushResult> {
    const result: FlushResult = { sent: 0, failed: 0, interrupted: false }

    for (const item of await store.all()) {
      try {
        await send(item)
        await store.delete(item.id)
        result.sent++
      } catch (error) {
        const retryLater =
          !(error instanceof ApiError) || error.status === 0 || error.status === 401 || error.status === 429 || error.status >= 500

        if (retryLater) {
          // Pas de réseau, session expirée ou serveur indisponible : on réessaiera, dans le même ordre
          await store.put({ ...item, attempts: item.attempts + 1 })
          result.interrupted = true
          break
        }

        // Action refusée par l'API (validation, droits) : on la garde avec l'erreur et on passe à la suivante
        await store.put({ ...item, attempts: item.attempts + 1, lastError: error.message })
        result.failed++
      }
    }

    return result
  }

  /** Envoie les actions en attente. Un seul envoi à la fois. */
  function flush(): Promise<FlushResult> {
    flushing ??= flushOnce().finally(() => {
      flushing = null
    })
    return flushing
  }

  return {
    enqueue,
    flush,
    all: () => store.all(),
    remove: (id: string) => store.delete(id),
    clear: () => store.clear(),
  }
}

export type Outbox = ReturnType<typeof createOutbox>
