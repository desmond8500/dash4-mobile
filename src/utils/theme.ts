import { isDarkTheme, type Theme } from '@dash4/shared'

const media = typeof matchMedia !== 'undefined' ? matchMedia('(prefers-color-scheme: dark)') : null
let current: Theme = 'system'

/** Applique le thème du compte (palette sombre d'Ionic par la classe `ion-palette-dark`). */
export function applyTheme(theme: Theme | undefined): void {
  current = theme ?? 'system'
  document.documentElement.classList.toggle('ion-palette-dark', isDarkTheme(current, media?.matches ?? false))
}

// « Comme l'appareil » : suit le changement de thème du téléphone
media?.addEventListener?.('change', () => applyTheme(current))
