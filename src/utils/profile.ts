import type { CurrentUser, ProfilePayload } from '@dash4/shared'

/** Profil modifié localement en attendant l'envoi : le nom complet suit le prénom et le nom. */
export function applyProfile(user: CurrentUser, payload: ProfilePayload): CurrentUser {
  const next = { ...user, ...payload }
  return { ...next, full_name: `${next.firstname} ${next.lastname}`.trim() }
}

/** Seuls les champs changés partent au serveur. */
export function profileChanges(user: CurrentUser, form: Required<ProfilePayload>): ProfilePayload {
  const changes: ProfilePayload = {}
  if (form.firstname.trim() !== user.firstname) changes.firstname = form.firstname.trim()
  if (form.lastname.trim() !== user.lastname) changes.lastname = form.lastname.trim()
  if ((form.phone?.trim() || null) !== user.phone) changes.phone = form.phone?.trim() || null
  if ((form.job_title?.trim() || null) !== user.job_title) changes.job_title = form.job_title?.trim() || null
  return changes
}
