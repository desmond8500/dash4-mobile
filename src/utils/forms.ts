import type { ClientPayload, ClientStatus, ClientType, ContactPayload } from '@dash4/shared'

const clean = (value: string) => value.trim() || null

/** Saisie rapide d'un client : un téléphone et un e-mail, qui deviennent les premiers de leurs listes. */
export function buildClientPayload(form: {
  name: string
  type: ClientType
  status: ClientStatus
  phone: string
  email: string
  address: string
  description: string
}): ClientPayload {
  const phone = form.phone.trim()
  const email = form.email.trim()
  return {
    name: form.name.trim(),
    type: form.type,
    status: form.status,
    address: clean(form.address),
    description: clean(form.description),
    phones: phone ? [{ label: null, number: phone }] : [],
    emails: email ? [{ label: null, address: email }] : [],
  }
}

export function buildContactPayload(
  form: { firstname: string; lastname: string; job_title: string; phone: string; email: string },
  clientId: number | null,
): ContactPayload {
  return {
    client_id: clientId,
    firstname: form.firstname.trim(),
    lastname: clean(form.lastname),
    job_title: clean(form.job_title),
    phone: clean(form.phone),
    email: clean(form.email),
  }
}
