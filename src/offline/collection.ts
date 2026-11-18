import type { OutboxItem } from './outbox'

/** Fiche synchronisée depuis l'API (`updated_since` renvoie aussi les suppressions). */
export interface Syncable {
  id: number
  deleted_at: string | null
}

/**
 * Applique les changements reçus à la copie locale : remplace les fiches modifiées,
 * ajoute les nouvelles et retire celles supprimées sur le serveur.
 */
export function mergeChanges<T extends Syncable>(items: T[], changes: T[]): T[] {
  const byId = new Map(items.map((item) => [item.id, item]))
  for (const change of changes) {
    if (change.deleted_at) byId.delete(change.id)
    else byId.set(change.id, change)
  }
  return [...byId.values()]
}

/** Texte comparable : minuscules, sans accents, sans espaces superflus. */
export function normalize(text: string | null | undefined): string {
  return (text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/** Vrai si chaque mot recherché apparaît dans un des champs (sans tenir compte des accents). */
export function matchesSearch(query: string, fields: Array<string | null | undefined>): boolean {
  const words = normalize(query).split(' ').filter(Boolean)
  if (words.length === 0) return true
  const haystack = fields.map(normalize).join(' ')
  // Les numéros se cherchent aussi sans espaces : « 770000 » trouve « 77 00 00 »
  const compact = haystack.replace(/\s/g, '')
  return words.every((word) => haystack.includes(word) || compact.includes(word))
}

/** Favoris d'abord, puis ordre alphabétique français. */
export function sortByFavoriteThenName<T extends { is_favorite: boolean; name: string }>(items: T[]): T[] {
  return [...items].sort(
    (a, b) => Number(b.is_favorite) - Number(a.is_favorite) || a.name.localeCompare(b.name, 'fr'),
  )
}

/** Créations encore dans la file d'attente, pour les afficher avant leur envoi. */
export function pendingCreations(items: OutboxItem[], path: string): OutboxItem[] {
  return items.filter((item) => item.method === 'POST' && item.path === path)
}

/** Copie simple, enregistrable dans IndexedDB (les objets réactifs de Vue ne le sont pas). */
export function plain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}
