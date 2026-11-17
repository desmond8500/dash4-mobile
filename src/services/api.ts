import { Preferences } from '@capacitor/preferences'
import { createApiClient, type TokenStorage } from '@dash4/shared'

const TOKEN_KEY = 'dash4.token'

/**
 * Jeton enregistré avec Capacitor Preferences (stockage de l'application sur le téléphone,
 * localStorage dans le navigateur). À remplacer par un stockage chiffré (Keychain / Keystore)
 * avant la publication sur les stores.
 */
export const tokenStorage: TokenStorage = {
  get: async () => (await Preferences.get({ key: TOKEN_KEY })).value,
  set: async (token) => {
    if (token) await Preferences.set({ key: TOKEN_KEY, value: token })
    else await Preferences.remove({ key: TOKEN_KEY })
  },
}

let unauthorizedHandler: () => void = () => {}

export function onUnauthorized(handler: () => void): void {
  unauthorizedHandler = handler
}

export const api = createApiClient({
  baseUrl: import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api',
  storage: tokenStorage,
  onUnauthorized: () => unauthorizedHandler(),
})
