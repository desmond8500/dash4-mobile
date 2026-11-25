/** Lien d'appel : `tel:` sans espaces ni tirets. */
export function telHref(number: string): string {
  return `tel:${number.replace(/[^\d+]/g, '')}`
}

export function mailHref(address: string): string {
  return `mailto:${address.trim()}`
}

/** Initiales affichées quand le client n'a pas de logo, ou hors ligne : « Société Générale » → « SG ». */
export function initials(name: string): string {
  const words = name
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase()
  return (words[0]![0]! + words[1]![0]!).toUpperCase()
}

/** Tous les numéros et adresses d'un contact, sans doublon (champ principal puis listes). */
export function contactChannels(contact: {
  phone?: string | null
  email?: string | null
  phones?: Array<{ number: string }>
  emails?: Array<{ address: string }>
}): { phones: string[]; emails: string[] } {
  const unique = (values: Array<string | null | undefined>) => [...new Set(values.map((v) => v?.trim()).filter((v): v is string => !!v))]
  return {
    phones: unique([contact.phone, ...(contact.phones ?? []).map((p) => p.number)]),
    emails: unique([contact.email, ...(contact.emails ?? []).map((e) => e.address)]),
  }
}
