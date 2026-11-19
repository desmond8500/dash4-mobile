import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Cv, ProfilePayload } from '@dash4/shared'
import { api } from '@/services/api'
import { kv, onWipe } from '@/offline/db'
import { plain } from '@/offline/collection'
import { applyProfile } from '@/utils/profile'
import { useAuthStore } from './auth'
import { useSyncStore } from './sync'

const CVS_KEY = 'profile.cvs'
const AVATAR_KEY = 'profile.avatar'

/**
 * Espace personnel sur le téléphone : profil modifiable hors ligne (file d'attente), photo gardée
 * puis envoyée au retour du réseau, liste de ses CV (le PDF demande le réseau ; l'édition se fait sur le web).
 * Le mot de passe ne passe jamais par la file : il n'est pas stocké sur le téléphone.
 */
export const useProfileStore = defineStore('profile', () => {
  const auth = useAuthStore()
  const sync = useSyncStore()
  const cvs = ref<Cv[]>([])
  const pendingAvatar = ref<string | null>(null)

  async function load(): Promise<void> {
    cvs.value = (await kv.get<Cv[]>(CVS_KEY)) ?? []
    const blob = await kv.get<Blob>(AVATAR_KEY)
    pendingAvatar.value = blob ? URL.createObjectURL(blob) : null
  }

  async function refresh(): Promise<void> {
    try {
      cvs.value = await api.cvs.mine()
      await kv.set(CVS_KEY, plain(cvs.value))
      await uploadAvatar()
    } catch {
      // hors ligne : dernière liste connue
    }
  }

  async function save(changes: ProfilePayload): Promise<void> {
    if (!auth.user || Object.keys(changes).length === 0) return
    await auth.setLocal(applyProfile(auth.user, changes))
    await sync.enqueue({ type: 'profile', label: 'Modification du profil', method: 'PATCH', path: 'me', payload: changes })
  }

  async function setAvatar(blob: Blob): Promise<void> {
    await kv.set(AVATAR_KEY, blob)
    pendingAvatar.value = URL.createObjectURL(blob)
    await uploadAvatar().catch(() => undefined)
  }

  async function uploadAvatar(): Promise<void> {
    const blob = await kv.get<Blob>(AVATAR_KEY)
    if (!blob || !sync.online) return
    await auth.setLocal(await api.profile.uploadAvatar(blob, 'photo.jpg'))
    await kv.delete(AVATAR_KEY)
    pendingAvatar.value = null
  }

  sync.onFlushed(() => {
    void auth.refresh()
    void uploadAvatar().catch(() => undefined)
  })
  onWipe(() => {
    cvs.value = []
    pendingAvatar.value = null
  })

  return { cvs, pendingAvatar, load, refresh, save, setAvatar }
})
