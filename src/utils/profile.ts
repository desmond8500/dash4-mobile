import type { CurrentUser, ProfilePayload } from '@dash4/shared'

/** Profil modifié localement en attendant l'envoi : le nom complet suit le prénom et le nom. */
export function applyProfile(user: CurrentUser, payload: ProfilePayload): CurrentUser {
  const { preferences, ...fields } = payload
  const next = { ...user, ...fields }
  if (preferences && user.preferences) {
    next.preferences = {
      theme: preferences.theme ?? user.preferences.theme,
      notifications: { ...user.preferences.notifications, ...preferences.notifications },
    }
  }
  return { ...next, full_name: `${next.firstname} ${next.lastname}`.trim() }
}

/** Seuls les champs changés partent au serveur. */
export function profileChanges(user: CurrentUser, form: Required<Omit<ProfilePayload, 'preferences'>>): ProfilePayload {
  const changes: ProfilePayload = {}
  if (form.firstname.trim() !== user.firstname) changes.firstname = form.firstname.trim()
  if (form.lastname.trim() !== user.lastname) changes.lastname = form.lastname.trim()
  if ((form.phone?.trim() || null) !== user.phone) changes.phone = form.phone?.trim() || null
  if ((form.job_title?.trim() || null) !== user.job_title) changes.job_title = form.job_title?.trim() || null
  return changes
}
