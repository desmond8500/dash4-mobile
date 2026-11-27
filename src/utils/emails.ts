const EMAIL = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/

export function isEmail(value: string): boolean {
  return EMAIL.test(value.trim())
}

/** Ajoute les adresses valides tapées (séparées par espace, virgule ou point-virgule), sans doublon. */
export function addEmails(list: string[], typed: string): string[] {
  const next = [...list]
  for (const raw of typed.split(/[\s,;]+/)) {
    const email = raw.trim().toLowerCase()
    if (isEmail(email) && !next.some((x) => x.toLowerCase() === email)) next.push(email)
  }
  return next
}
