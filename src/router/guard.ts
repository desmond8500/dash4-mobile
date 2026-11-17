import type { RouteLocationNormalized, RouteLocationRaw } from 'vue-router'

declare module 'vue-router' {
  interface RouteMeta {
    public?: boolean
    /** Types de compte autorisés (par défaut : tous). */
    accountTypes?: Array<'manager' | 'technician'>
    /** Au moins une de ces permissions est nécessaire. */
    permissions?: string[]
  }
}

export interface GuardState {
  isAuthenticated: boolean
  accountType: 'manager' | 'technician' | null
  canAny: (permissions: string[]) => boolean
}

export function resolveNavigation(to: RouteLocationNormalized, state: GuardState): true | RouteLocationRaw {
  if (to.meta.public) {
    return to.name === 'login' && state.isAuthenticated ? { name: 'home' } : true
  }

  if (!state.isAuthenticated || !state.accountType) {
    return { name: 'login' }
  }

  // Un écran réservé à l'autre type de compte n'est pas accessible, même par un lien direct
  if (to.meta.accountTypes && !to.meta.accountTypes.includes(state.accountType)) {
    return { name: 'home' }
  }

  if (to.meta.permissions?.length && !state.canAny(to.meta.permissions)) {
    return { name: 'home' }
  }

  return true
}
