import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  ApiError,
  type AccessRequestDecision,
  type TechAccessRequest,
  type TechAccessRequestPayload,
  type TechShare,
} from '@dash4/shared'
import { api } from '@/services/api'
import { kv, onWipe } from '@/offline/db'
import { mergeChanges, pendingCreations, plain } from '@/offline/collection'
import { activeShares, isShareExpired, sortAccessRequests } from '@/utils/techSpace'
import { useAuthStore } from './auth'
import { useSyncStore } from './sync'

const SHARES_KEY = 'techShares.items'
const SHARES_AT_KEY = 'techShares.syncedAt'
const REQUESTS_KEY = 'accessRequests.items'
const REQUESTS_AT_KEY = 'accessRequests.syncedAt'

export const TECH_SHARE_PERMISSIONS = ['tech_shares.view', 'tech_shares.view.own']
export const ACCESS_REQUEST_PERMISSIONS = ['tech_access_requests.view', 'tech_access_requests.view.own']

/**
 * Espace technicien sur le téléphone : informations temporaires reçues (effacées du téléphone
 * dès leur expiration, même hors ligne) et demandes d'accès (créées et décidées via la file d'attente).
 */
export const useTechSpaceStore = defineStore('techSpace', () => {
  const auth = useAuthStore()
  const sync = useSyncStore()

  const shares = ref<TechShare[]>([])
  const requests = ref<TechAccessRequest[]>([])
  const sharesAt = ref<string | null>(null)
  const requestsAt = ref<string | null>(null)
  const loaded = ref(false)
  const syncing = ref(false)
  const error = ref<string | null>(null)
  /** Heure de référence, avancée chaque minute pour retirer les informations qui expirent. */
  const now = ref(new Date())

  const canShares = () => auth.canAny(TECH_SHARE_PERMISSIONS)
  const canRequests = () => auth.canAny(ACCESS_REQUEST_PERMISSIONS)
  const allowed = () => canShares() || canRequests()

  const active = computed(() => activeShares(shares.value, now.value))
  /** Reçues et pas encore lues : compteur de l'onglet. */
  const unread = computed(() => active.value.filter((s) => s.is_recipient && !s.read_at).length)
  const sortedRequests = computed(() => sortAccessRequests(requests.value))
  const toDecide = computed(() => requests.value.filter((r) => r.can.decide && r.status.value === 'pending'))
  const pendingRequests = computed(() => pendingCreations(sync.pending, 'tech-access-requests'))

  async function save(): Promise<void> {
    await Promise.all([
      kv.set(SHARES_KEY, plain(shares.value)),
      kv.set(SHARES_AT_KEY, sharesAt.value),
      kv.set(REQUESTS_KEY, plain(requests.value)),
      kv.set(REQUESTS_AT_KEY, requestsAt.value),
    ])
  }

  /** Retire du téléphone les informations expirées (leur contenu ne doit pas y rester). */
  async function purge(): Promise<void> {
    now.value = new Date()
    const kept = shares.value.filter((s) => !isShareExpired(s, now.value))
    if (kept.length !== shares.value.length) {
      shares.value = kept
      await kv.set(SHARES_KEY, plain(kept))
    }
  }

  let timer: ReturnType<typeof setInterval> | undefined
  async function load(): Promise<void> {
    if (loaded.value || !allowed()) return
    const [s, sAt, r, rAt] = await Promise.all([
      kv.get<TechShare[]>(SHARES_KEY),
      kv.get<string>(SHARES_AT_KEY),
      kv.get<TechAccessRequest[]>(REQUESTS_KEY),
      kv.get<string>(REQUESTS_AT_KEY),
    ])
    shares.value = s ?? []
    sharesAt.value = sAt ?? null
    requests.value = r ?? []
    requestsAt.value = rAt ?? null
    loaded.value = true
    await purge()
    timer ??= setInterval(() => void purge(), 60_000)
  }

  async function refresh(): Promise<void> {
    if (!allowed() || syncing.value) return
    await load()
    syncing.value = true
    error.value = null
    try {
      if (canShares()) {
        const since = sharesAt.value
        const result = await api.syncAll((f) => api.techShares.list(f), since)
        shares.value = mergeChanges(since ? shares.value : [], result.items)
        sharesAt.value = result.serverTime
      }
      if (canRequests()) {
        const since = requestsAt.value
        const result = await api.syncAll((f) => api.accessRequests.list(f), since)
        requests.value = mergeChanges(since ? requests.value : [], result.items)
        requestsAt.value = result.serverTime
      }
      // Les expirées arrivent sans contenu : on les retire avant d'enregistrer
      shares.value = shares.value.filter((s) => !isShareExpired(s))
      await save()
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 0)) error.value = e instanceof Error ? e.message : 'Synchronisation impossible.'
    } finally {
      syncing.value = false
    }
  }

  const findShare = (id: number) => active.value.find((s) => s.id === id)
  const findRequest = (id: number) => requests.value.find((r) => r.id === id)

  /** Ouverte par un destinataire : lue (envoyé dès que possible). */
  async function markRead(id: number): Promise<void> {
    const share = findShare(id)
    if (!share || !share.is_recipient || share.read_at) return
    share.read_at = new Date().toISOString()
    await kv.set(SHARES_KEY, plain(shares.value))
    await sync.enqueue({ type: 'tech_share', label: `Information lue : ${share.title}`, method: 'POST', path: `tech-shares/${id}/read`, payload: {} })
  }

  async function createRequest(payload: TechAccessRequestPayload): Promise<void> {
    await sync.enqueue({
      type: 'tech_access_request',
      label: `Demande d'accès : ${payload.subject}`,
      method: 'POST',
      path: 'tech-access-requests',
      payload: plain(payload) as unknown as Record<string, unknown>,
    })
  }

  /** Décision du chef de projet : affichée tout de suite, envoyée dès que possible. */
  async function decide(id: number, decision: AccessRequestDecision): Promise<void> {
    const request = findRequest(id)
    if (!request) return
    request.status = { value: decision.decision, label: decision.decision === 'approved' ? 'Acceptée' : 'Refusée' }
    request.response = decision.response ?? null
    request.can = { ...request.can, decide: false }
    await kv.set(REQUESTS_KEY, plain(requests.value))
    await sync.enqueue({
      type: 'tech_access_request',
      label: `Demande ${request.status.label.toLowerCase()} : ${request.subject}`,
      method: 'POST',
      path: `tech-access-requests/${id}/decide`,
      payload: plain(decision) as unknown as Record<string, unknown>,
    })
  }

  function reset(): void {
    shares.value = []
    requests.value = []
    sharesAt.value = null
    requestsAt.value = null
    loaded.value = false
    error.value = null
    if (timer) clearInterval(timer)
    timer = undefined
  }

  sync.onFlushed(() => void refresh())
  onWipe(reset)

  return {
    shares, active, unread, requests, sortedRequests, toDecide, pendingRequests, loaded, syncing, error, now,
    canShares, canRequests, allowed, load, refresh, purge, findShare, findRequest, markRead, createRequest, decide, reset,
  }
})
