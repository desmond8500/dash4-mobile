import type { TechAccessRequest, TechShare } from '@dash4/shared'

/**
 * Informations temporaires sur le téléphone : une information expirée (date passée à l'heure
 * du téléphone, ou expirée sur le serveur) est retirée du téléphone, même sans réseau.
 */
export function isShareExpired(share: Pick<TechShare, 'expired' | 'expires_at' | 'deleted_at'>, now: Date = new Date()): boolean {
  return share.expired || !!share.deleted_at || (!!share.expires_at && new Date(share.expires_at).getTime() <= now.getTime())
}

/** Ne garde que les informations en cours, les plus proches de l'expiration d'abord. */
export function activeShares<T extends Pick<TechShare, 'expired' | 'expires_at' | 'deleted_at' | 'id'>>(shares: T[], now: Date = new Date()): T[] {
  return shares
    .filter((s) => !isShareExpired(s, now))
    .sort((a, b) => (a.expires_at ?? '9999').localeCompare(b.expires_at ?? '9999') || b.id - a.id)
}

const pad = (n: number) => String(n).padStart(2, '0')

/** « dans 25 min », « aujourd'hui à 18:00 », « demain à 08:15 », « le 25/11 à 08:00 ». */
export function expiresIn(share: Pick<TechShare, 'expires_at' | 'expires_with_task'>, now: Date = new Date()): string {
  if (!share.expires_at) return share.expires_with_task ? "jusqu'à la fin de la tâche" : 'sans expiration'
  const at = new Date(share.expires_at)
  const minutes = Math.round((at.getTime() - now.getTime()) / 60_000)
  if (minutes < 60) return `dans ${Math.max(minutes, 0)} min`
  const time = `${pad(at.getHours())}:${pad(at.getMinutes())}`
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const days = Math.round((day(at) - day(now)) / 86_400_000)
  if (days === 0) return `aujourd'hui à ${time}`
  if (days === 1) return `demain à ${time}`
  return `le ${pad(at.getDate())}/${pad(at.getMonth() + 1)} à ${time}`
}

/** Demandes : en attente d'abord, puis les plus récentes. */
export function sortAccessRequests<T extends Pick<TechAccessRequest, 'status' | 'created_at' | 'id'>>(items: T[]): T[] {
  return [...items].sort(
    (a, b) =>
      Number(b.status.value === 'pending') - Number(a.status.value === 'pending') ||
      (b.created_at ?? '').localeCompare(a.created_at ?? '') ||
      b.id - a.id,
  )
}

/** Vérifie la demande avant de la mettre dans la file d'attente. */
export function accessRequestError(form: { subject: string; neededOn: string }, today: string): string | null {
  if (!form.subject.trim()) return "Indiquez ce dont vous avez besoin (code, clé, badge…)."
  if (form.neededOn && form.neededOn < today) return 'La date souhaitée ne peut pas être passée.'
  return null
}
