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
