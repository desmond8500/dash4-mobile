import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '@dash4/shared'
import { createOutbox, type OutboxItem, type OutboxStore } from '../src/offline/outbox'

function memoryStore(): OutboxStore & { items: Map<string, OutboxItem> } {
  const items = new Map<string, OutboxItem>()
  return {
    items,
    all: async () => [...items.values()].sort((a, b) => a.createdAt - b.createdAt),
    put: async (item) => void items.set(item.id, item),
    delete: async (id) => void items.delete(id),
    clear: async () => items.clear(),
  }
}

const action = (label: string) => ({
  type: 'client_request',
  label,
  method: 'POST' as const,
  path: 'client-requests',
  payload: { body: label },
})

describe("file d'attente hors ligne", () => {
  it('ajoute un client_uuid à chaque action', async () => {
    const outbox = createOutbox(memoryStore(), vi.fn())
    const item = await outbox.enqueue(action('A'))

    expect(item.payload.client_uuid).toBe(item.id)
    expect(item.id).toMatch(/^[0-9a-f-]{36}$/)
  })

  it("n'ajoute pas de client_uuid à une modification", async () => {
    const outbox = createOutbox(memoryStore(), vi.fn())
    const item = await outbox.enqueue({ ...action('A'), method: 'PATCH', path: 'client-requests/3', payload: { status: 'done' } })

    expect(item.payload).toEqual({ status: 'done' })
  })

  it('envoie les actions dans l\'ordre puis les retire de la file', async () => {
    const store = memoryStore()
    const sent: string[] = []
    const outbox = createOutbox(store, async (item) => void sent.push(item.label))

    await outbox.enqueue(action('A'))
    await new Promise((r) => setTimeout(r, 2))
    await outbox.enqueue(action('B'))

    expect(await outbox.flush()).toEqual({ sent: 2, failed: 0, interrupted: false })
    expect(sent).toEqual(['A', 'B'])
    expect(store.items.size).toBe(0)
  })

  it('s\'arrête sans rien perdre quand le réseau manque', async () => {
    const store = memoryStore()
    const outbox = createOutbox(store, async () => {
      throw new ApiError(0, 'Impossible de joindre le serveur.')
    })
    await outbox.enqueue(action('A'))
    await outbox.enqueue(action('B'))

    const result = await outbox.flush()

    expect(result.interrupted).toBe(true)
    expect(store.items.size).toBe(2)
    expect((await outbox.all())[0]?.attempts).toBe(1)
  })

  it('garde une action refusée par l\'API avec son erreur et continue avec les suivantes', async () => {
    const store = memoryStore()
    const outbox = createOutbox(store, async (item) => {
      if (item.label === 'A') throw new ApiError(422, 'Le texte est obligatoire.')
    })
    await outbox.enqueue(action('A'))
    await new Promise((r) => setTimeout(r, 2))
    await outbox.enqueue(action('B'))

    expect(await outbox.flush()).toEqual({ sent: 1, failed: 1, interrupted: false })
    const [remaining] = await outbox.all()
    expect(remaining?.label).toBe('A')
    expect(remaining?.lastError).toBe('Le texte est obligatoire.')
  })

  it('ne lance pas deux envois en même temps', async () => {
    const send = vi.fn(() => new Promise((r) => setTimeout(r, 10)))
    const outbox = createOutbox(memoryStore(), send)
    await outbox.enqueue(action('A'))

    await Promise.all([outbox.flush(), outbox.flush()])

    expect(send).toHaveBeenCalledOnce()
  })
})
