import { homeOutline, personCircleOutline } from 'ionicons/icons'

/**
 * Onglets du bas de l'écran, selon le type de compte et les permissions.
 * Une seule application : les gestionnaires et les techniciens n'ont pas les mêmes onglets
 * (TODO §5, « Une seule app, contenu selon le type de compte »).
 * Les modules (tâches, rapports, demandes clients, devis…) seront ajoutés ici au fil des livraisons.
 */
export interface TabEntry {
  name: string
  label: string
  icon: string
  /** Types de compte qui voient l'onglet. */
  accountTypes: Array<'manager' | 'technician'>
  /** Au moins une de ces permissions (vide = tout compte du bon type). */
  permissions: string[]
}

export const TABS: TabEntry[] = [
  { name: 'home', label: 'Accueil', icon: homeOutline, accountTypes: ['manager', 'technician'], permissions: [] },
  { name: 'profile', label: 'Profil', icon: personCircleOutline, accountTypes: ['manager', 'technician'], permissions: [] },
]

export function visibleTabs(
  accountType: 'manager' | 'technician',
  canAny: (permissions: string[]) => boolean,
): TabEntry[] {
  return TABS.filter(
    (tab) => tab.accountTypes.includes(accountType) && (tab.permissions.length === 0 || canAny(tab.permissions)),
  )
}
