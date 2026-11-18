/** Lien d'appel : `tel:` sans espaces ni tirets. */
export function telHref(number: string): string {
  return `tel:${number.replace(/[^\d+]/g, '')}`
}

export function mailHref(address: string): string {
  return `mailto:${address.trim()}`
}
