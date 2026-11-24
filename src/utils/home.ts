import type { Article, Client, Contact, Project, Quote, Task } from '@dash4/shared'
import { add, barcodeOutline, bookOutline, businessOutline, constructOutline, keyOutline, mapOutline, personAddOutline, walletOutline } from 'ionicons/icons'

/** Accueil : recherche dans les données du téléphone (marche hors ligne) et actions rapides de terrain. */

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Chaque mot cherché se trouve dans l'un des textes (accents et majuscules ignorés). */
export function matches(query: string, ...texts: Array<string | number | null | undefined>): boolean {
  const words = fold(query).split(/\s+/).filter(Boolean)
  if (!words.length) return false
  const hay = fold(texts.filter((t) => t !== null && t !== undefined && t !== '').join(' '))
  return words.every((w) => hay.includes(w))
}

export interface SearchHit {
  key: string
  title: string
  subtitle: string
  route: { name: string; params?: Record<string, string | number> }
}

export interface SearchGroup {
  key: 'clients' | 'contacts' | 'projects' | 'quotes' | 'articles' | 'tasks'
  label: string
  hits: SearchHit[]
  /** Résultats en tout (seuls les premiers sont montrés). */
  total: number
}

export interface SearchData {
  clients?: Client[]
  contacts?: Contact[]
  projects?: Project[]
  quotes?: Quote[]
  articles?: Article[]
  tasks?: Task[]
}

/**
 * Recherche dans tout ce qui est gardé sur le téléphone (2 caractères au moins) : clients, contacts,
 * projets, devis, articles (référence, code-barres), tâches. Seuls les groupes avec des résultats sont renvoyés.
 */
export function homeSearch(query: string, data: SearchData, limit = 4): SearchGroup[] {
  if (fold(query).trim().length < 2) return []
  const group = <T>(key: SearchGroup['key'], label: string, list: T[] | undefined, texts: (x: T) => Array<string | number | null | undefined>, hit: (x: T) => SearchHit): SearchGroup | null => {
    const found = (list ?? []).filter((x) => matches(query, ...texts(x)))
    return found.length ? { key, label, hits: found.slice(0, limit).map(hit), total: found.length } : null
  }
  const clientName = (id: number | null) => (id ? data.clients?.find((c) => c.id === id)?.name : null) ?? ''
  return [
    group('clients', 'Clients', data.clients, (c) => [c.name, ...(c.phones ?? []).map((p) => p.number)], (c) => ({
      key: `client-${c.id}`, title: c.name, subtitle: (c.phones ?? [])[0]?.number ?? '', route: { name: 'client', params: { id: c.id } },
    })),
    group('contacts', 'Contacts', data.contacts, (c) => [c.full_name, c.email, c.phone, clientName(c.client_id)], (c) => ({
      key: `contact-${c.id}`, title: c.full_name, subtitle: [clientName(c.client_id), c.phone].filter(Boolean).join(' · '),
      route: c.client_id ? { name: 'client', params: { id: c.client_id } } : { name: 'clients' },
    })),
    group('projects', 'Projets', data.projects, (p) => [p.name, p.client?.name], (p) => ({
      key: `project-${p.id}`, title: p.name, subtitle: [p.client?.name, p.status.label].filter(Boolean).join(' · '), route: { name: 'project', params: { id: p.id } },
    })),
    group('quotes', 'Devis', data.quotes, (q) => [q.number, q.title, q.client?.name, q.project?.name], (q) => ({
      key: `quote-${q.id}`, title: `${q.number} — ${q.title}`, subtitle: [q.client?.name, q.status.label].filter(Boolean).join(' · '), route: { name: 'quote', params: { id: q.id } },
    })),
    group('articles', 'Articles', data.articles, (a) => [a.designation, a.reference, a.barcode], (a) => ({
      key: `article-${a.id}`, title: a.designation, subtitle: [a.reference, `${(a.quantity ?? 0).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} ${a.unit || 'u'} en stock`].filter(Boolean).join(' · '),
      route: { name: 'stock-article', params: { id: a.id } },
    })),
    group('tasks', 'Tâches', data.tasks, (t) => [t.title, t.project?.name], (t) => ({
      key: `task-${t.id}`, title: t.title, subtitle: [t.project?.name, t.status.label].filter(Boolean).join(' · '), route: { name: 'task', params: { id: t.id } },
    })),
  ].filter((g): g is SearchGroup => g !== null)
}

export interface QuickAction {
  key: string
  label: string
  icon: string
  /** Route à ouvrir, ou `scan` pour le scanner d'articles. */
  route: { name: string } | 'scan'
  accountTypes: Array<'manager' | 'technician'>
  permissions: string[]
}

export const QUICK_ACTIONS: QuickAction[] = [
  { key: 'request', label: 'Noter une demande', icon: add, route: { name: 'client-request-new' }, accountTypes: ['manager', 'technician'], permissions: ['client_requests.create'] },
  { key: 'journal', label: 'Nouveau rapport', icon: bookOutline, route: { name: 'journal-new' }, accountTypes: ['manager', 'technician'], permissions: ['journals.create'] },
  { key: 'scan', label: 'Scanner un article', icon: barcodeOutline, route: 'scan', accountTypes: ['manager'], permissions: ['stock.view'] },
  { key: 'expense', label: 'Noter une dépense', icon: walletOutline, route: { name: 'expense-new' }, accountTypes: ['manager', 'technician'], permissions: ['accounting.create', 'accounting.create.own'] },
  { key: 'client', label: 'Nouveau client', icon: personAddOutline, route: { name: 'client-new' }, accountTypes: ['manager'], permissions: ['clients.create'] },
  { key: 'access', label: "Demander un accès", icon: keyOutline, route: { name: 'access-request-new' }, accountTypes: ['technician'], permissions: ['tech_access_requests.create'] },
  { key: 'clients', label: 'Clients', icon: businessOutline, route: { name: 'clients' }, accountTypes: ['manager'], permissions: ['clients.view', 'clients.view.own'] },
  { key: 'plans', label: 'Plans', icon: mapOutline, route: { name: 'plans' }, accountTypes: ['manager', 'technician'], permissions: ['sites.view', 'sites.view.own'] },
  { key: 'tools', label: 'Outillage', icon: constructOutline, route: { name: 'tools' }, accountTypes: ['manager', 'technician'], permissions: ['tools.view', 'tools.view.own'] },
]

/** Actions rapides du compte (au plus `max`, dans l'ordre d'importance). */
export function quickActions(accountType: 'manager' | 'technician', canAny: (p: string[]) => boolean, max = 6): QuickAction[] {
  return QUICK_ACTIONS.filter((a) => a.accountTypes.includes(accountType) && canAny(a.permissions)).slice(0, max)
}
