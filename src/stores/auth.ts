import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { ApiError, can as canFn, canAny as canAnyFn, isTechnician as isTechnicianFn } from '@dash4/shared'
import type { CurrentUser, LoginPayload } from '@dash4/shared'
import { api, tokenStorage } from '@/services/api'
import { kv, wipeLocalData } from '@/offline/db'

const USER_KEY = 'currentUser'

/**
 * Session sur le téléphone. L'utilisateur est gardé en cache local : l'application s'ouvre
 * même sans réseau. Au retour du réseau, il est rechargé depuis l'API ; si son type de compte
 * a changé, toutes les données locales sont effacées (PROFILS_PERMISSIONS.md, §6).
 */
export const useAuthStore = defineStore('auth', () => {
  const user = ref<CurrentUser | null>(null)
  const ready = ref(false)

  const isAuthenticated = computed(() => user.value !== null)
  const isTechnician = computed(() => isTechnicianFn(user.value))

  function can(permission: string): boolean {
    return canFn(user.value, permission)
  }

  function canAny(permissions: string[]): boolean {
    return canAnyFn(user.value, permissions)
  }

  async function init(): Promise<void> {
    if (ready.value) return
    try {
      if (!(await tokenStorage.get())) return

      user.value = (await kv.get<CurrentUser>(USER_KEY)) ?? null
      await refresh()
    } finally {
      ready.value = true
    }
  }

  /** Recharge l'utilisateur depuis l'API (sans effet hors ligne : on garde le cache). */
  async function refresh(): Promise<void> {
    try {
      const fresh = await api.auth.me()
      if (user.value && user.value.account_type.value !== fresh.account_type.value) {
        await wipeLocalData()
      }
      user.value = fresh
      await kv.set(USER_KEY, fresh)
    } catch (error) {
      if (error instanceof ApiError && error.status !== 0) {
        // Session refusée par l'API (expirée, compte désactivé) : déconnexion
        await clear()
      }
      // Sinon pas de réseau : on garde l'utilisateur en cache
    }
  }

  /** Mise à jour locale (profil modifié hors ligne, en attente d'envoi). */
  async function setLocal(next: CurrentUser): Promise<void> {
    user.value = next
    await kv.set(USER_KEY, JSON.parse(JSON.stringify(next)) as CurrentUser)
  }

  async function login(payload: Omit<LoginPayload, 'device_name'>): Promise<CurrentUser> {
    const cached = await kv.get<CurrentUser>(USER_KEY)
    const response = await api.auth.login({ ...payload, device_name: 'Application mobile' })

    // Un autre compte se connecte sur ce téléphone : rien de l'ancien compte ne doit rester
    if (cached && cached.id !== response.user.id) await wipeLocalData()

    user.value = response.user
    await kv.set(USER_KEY, response.user)
    ready.value = true
    return response.user
  }

  async function logout(): Promise<void> {
    try {
      await api.auth.logout()
    } catch {
      // Hors ligne ou jeton déjà invalide : on déconnecte quand même
    }
    await clear()
  }

  async function clear(): Promise<void> {
    user.value = null
    await tokenStorage.set(null)
    await wipeLocalData()
  }

  return { user, ready, isAuthenticated, isTechnician, can, canAny, init, refresh, setLocal, login, logout, clear }
})
