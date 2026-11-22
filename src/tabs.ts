import { keyOutline, bookOutline, checkboxOutline, briefcaseOutline, businessOutline, carOutline, chatbubblesOutline, cubeOutline, documentTextOutline, homeOutline, walletOutline, personCircleOutline, chatbubbleEllipsesOutline } from 'ionicons/icons'

/**
 * Onglets du bas de l'écran, selon le type de compte et les permissions.
 * Une seule application : les gestionnaires et les techniciens n'ont pas les mêmes onglets
 * (TODO §5, « Une seule app, contenu selon le type de compte »).
 * Les modules (tâches, rapports, demandes clients, devis…) seront ajoutés ici au fil des livraisons.
 * Un technicien n'a pas l'onglet Clients : il ne verra que les clients de ses tâches, depuis ses tâches.
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
  {
    name: 'tasks',
    label: 'Tâches',
    icon: checkboxOutline,
    accountTypes: ['manager', 'technician'],
    permissions: ['tasks.view', 'tasks.view.own'],
  },
  {
    name: 'journals',
    label: 'Rapports',
    icon: bookOutline,
    accountTypes: ['manager', 'technician'],
    permissions: ['journals.view', 'journals.view.own'],
  },
  {
    name: 'tech-space',
    label: 'Accès',
    icon: keyOutline,
    accountTypes: ['manager', 'technician'],
    permissions: ['tech_shares.view', 'tech_shares.view.own', 'tech_access_requests.view', 'tech_access_requests.view.own'],
  },
  {
    name: 'client-requests',
    label: 'Demandes',
    icon: chatbubblesOutline,
    accountTypes: ['manager', 'technician'],
    permissions: ['client_requests.view', 'client_requests.view.own'],
  },
  {
    name: 'clients',
    label: 'Clients',
    icon: businessOutline,
    accountTypes: ['manager'],
    permissions: ['clients.view', 'clients.view.own'],
  },
  {
    name: 'projects',
    label: 'Projets',
    icon: briefcaseOutline,
    accountTypes: ['manager'],
    permissions: ['projects.view', 'projects.view.own'],
  },
  {
    name: 'stock',
    label: 'Stock',
    icon: cubeOutline,
    accountTypes: ['manager'],
    permissions: ['stock.view'],
  },
  {
    name: 'invoices',
    label: 'Factures',
    icon: documentTextOutline,
    accountTypes: ['manager'],
    permissions: ['invoices.view'],
  },
  {
    name: 'vehicles',
    label: 'Véhicules',
    icon: carOutline,
    accountTypes: ['manager', 'technician'],
    permissions: ['vehicles.view', 'vehicles.view.own'],
  },
  {
    name: 'expenses',
    label: 'Dépenses',
    icon: walletOutline,
    accountTypes: ['manager', 'technician'],
    permissions: ['accounting.view', 'accounting.view.own'],
  },
  { name: 'messages', label: 'Messages', icon: chatbubbleEllipsesOutline, accountTypes: ['manager', 'technician'], permissions: [] },
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

/** Nombre d'entrées dans la barre du bas, le bouton « Plus » compris. */
export const TAB_BAR_SIZE = 5

/**
 * Entrées les plus utiles en bas de l'écran, par type de compte (dans cet ordre, si le compte les voit).
 * Le reste va dans le menu « Plus ».
 */
export const PRIMARY: Record<'manager' | 'technician', string[]> = {
  manager: ['home', 'projects', 'tasks', 'messages', 'client-requests', 'clients'],
  technician: ['home', 'tasks', 'journals', 'messages', 'tech-space'],
}

/**
 * Barre du bas (au plus 4 entrées + « Plus ») et menu « Plus » (le reste, dans l'ordre des onglets).
 * Avec 5 entrées ou moins en tout, pas de menu : tout tient dans la barre.
 */
export function splitTabs(
  accountType: 'manager' | 'technician',
  canAny: (permissions: string[]) => boolean,
): { bar: TabEntry[]; more: TabEntry[] } {
  const all = visibleTabs(accountType, canAny)
  if (all.length <= TAB_BAR_SIZE) return { bar: all, more: [] }
  const order = PRIMARY[accountType]
  const bar = order
    .map((name) => all.find((t) => t.name === name))
    .filter((t): t is TabEntry => !!t)
    .slice(0, TAB_BAR_SIZE - 1)
  // Moins de 4 entrées prioritaires visibles : on complète avec les premières du reste
  for (const tab of all) {
    if (bar.length >= TAB_BAR_SIZE - 1) break
    if (!bar.includes(tab)) bar.push(tab)
  }
  const ordered = all.filter((t) => bar.includes(t))
  return { bar: ordered, more: all.filter((t) => !bar.includes(t)) }
}
