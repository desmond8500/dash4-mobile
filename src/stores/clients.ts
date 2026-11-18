import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { ApiError } from '@dash4/shared'
import type { Client, ClientPayload, Contact, ContactPayload } from '@dash4/shared'
import { api } from '@/services/api'
import { kv, onWipe } from '@/offline/db'
import { mergeChanges, pendingCreations, plain, sortByFavoriteThenName } from '@/offline/collection'
import { useAuthStore } from './auth'
import { useSyncStore } from './sync'

const CLIENTS_KEY = 'clients.items'
const CONTACTS_KEY = 'contacts.items'
const SYNCED_AT_KEY = 'clients.syncedAt'

export const CLIENT_PERMISSIONS = ['clients.view', 'clients.view.own']

/**
 * Clients et contacts sur le téléphone. Lecture depuis le cache local (consultable sans réseau),
 * mise à jour par synchronisation incrémentale ; créations via la file d'attente.
 * Rien n'est téléchargé pour un compte sans droit sur les clients (un technicien, par exemple).
 */
export const useClientsStore = defineStore('clients', () => {
  const auth = useAuthStore()
  const sync = useSyncStore()

  const clients = ref<Client[]>([])
  const contacts = ref<Contact[]>([])
  const syncedAt = ref<string | null>(null)
  const loaded = ref(false)
  const syncing = ref(false)
  const error = ref<string | null>(null)

  const sortedClients = computed(() => sortByFavoriteThenName(clients.value))
  const pendingClients = computed(() => pendingCreations(sync.pending, 'clients'))
  const pendingContacts = computed(() => pendingCreations(sync.pending, 'contacts'))

  const allowed = () => auth.canAny(CLIENT_PERMISSIONS)

  async function load(): Promise<void> {
    if (loaded.value || !allowed()) return
    const [c, ct, at] = await Promise.all([
      kv.get<Client[]>(CLIENTS_KEY),
      kv.get<Contact[]>(CONTACTS_KEY),
      kv.get<string>(SYNCED_AT_KEY),
    ])
    clients.value = c ?? []
    contacts.value = ct ?? []
    syncedAt.value = at ?? null
    loaded.value = true
  }

  /** Récupère les changements depuis la dernière synchro (sans effet hors ligne). */
  async function refresh(): Promise<void> {
    if (!allowed() || syncing.value) return
    await load()
    syncing.value = true
    error.value = null
    try {
      const since = syncedAt.value
      const [c, ct] = await Promise.all([
        api.syncAll((f) => api.clients.list(f), since),
        api.syncAll((f) => api.contacts.list(f), since),
      ])
      clients.value = mergeChanges(since ? clients.value : [], c.items)
      contacts.value = mergeChanges(since ? contacts.value : [], ct.items)
      // L'heure la plus ancienne des deux : aucun changement ne peut être manqué
      syncedAt.value = [c.serverTime, ct.serverTime].sort()[0] ?? null
      await Promise.all([
        kv.set(CLIENTS_KEY, plain(clients.value)),
        kv.set(CONTACTS_KEY, plain(contacts.value)),
        kv.set(SYNCED_AT_KEY, syncedAt.value),
      ])
    } catch (e) {
      // Hors ligne : on garde la copie locale sans message
      if (!(e instanceof ApiError && e.status === 0)) {
        error.value = e instanceof Error ? e.message : 'Synchronisation impossible.'
      }
    } finally {
      syncing.value = false
    }
  }

  function findClient(id: number): Client | undefined {
    return clients.value.find((c) => c.id === id)
  }

  function contactsOf(clientId: number): Contact[] {
    return contacts.value
      .filter((c) => c.client_id === clientId)
      .sort((a, b) => a.full_name.localeCompare(b.full_name, 'fr'))
  }

  /** Création hors ligne possible : l'action part dès que le réseau est là. */
  async function createClient(payload: ClientPayload): Promise<void> {
    await sync.enqueue({
      type: 'client',
      label: `Nouveau client : ${payload.name}`,
      method: 'POST',
      path: 'clients',
      payload: plain(payload) as unknown as Record<string, unknown>,
    })
  }

  async function createContact(payload: ContactPayload): Promise<void> {
    await sync.enqueue({
      type: 'contact',
      label: `Nouveau contact : ${[payload.firstname, payload.lastname].filter(Boolean).join(' ')}`,
      method: 'POST',
      path: 'contacts',
      payload: plain(payload) as unknown as Record<string, unknown>,
    })
  }

  function reset(): void {
    clients.value = []
    contacts.value = []
    syncedAt.value = null
    loaded.value = false
    error.value = null
  }

  // Une création vient de partir : on récupère la fiche créée par le serveur
  sync.onFlushed(() => void refresh())
  onWipe(reset)

  return {
    clients,
    contacts,
    sortedClients,
    pendingClients,
    pendingContacts,
    syncedAt,
    loaded,
    syncing,
    error,
    load,
    refresh,
    findClient,
    contactsOf,
    createClient,
    createContact,
    reset,
  }
})
