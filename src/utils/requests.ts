import type { ClientRequest, ClientRequestPayload, ClientRequestSource, ClientRequestStatus, Priority } from '@dash4/shared'

/** Qui a fait la demande : client, sinon nom, sinon téléphone. */
export function requesterLabel(request: Pick<ClientRequest, 'client' | 'contact_name' | 'contact_phone'>): string {
  return request.client?.name ?? request.contact_name ?? request.contact_phone ?? 'Demandeur non précisé'
}

/** Couleur Ionic du badge de statut. */
export function statusColor(status: ClientRequestStatus): string {
  switch (status) {
    case 'new':
      return 'primary'
    case 'in_progress':
      return 'warning'
    case 'done':
      return 'success'
    default:
      return 'medium'
  }
}

/** Saisie express : seul le texte est obligatoire ; un client choisi remplace le nom et le téléphone. */
export function buildRequestPayload(form: {
  body: string
  clientId: number | null
  contactName: string
  contactPhone: string
  source: ClientRequestSource
  priority: Priority
}): ClientRequestPayload {
  const clean = (v: string) => v.trim() || null
  return {
    body: form.body.trim(),
    client_id: form.clientId,
    contact_name: form.clientId ? null : clean(form.contactName),
    contact_phone: form.clientId ? null : clean(form.contactPhone),
    source: form.source,
    priority: form.priority,
  }
}
