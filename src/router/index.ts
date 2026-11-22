import { createRouter, createWebHistory } from '@ionic/vue-router'
import { useAuthStore } from '@/stores/auth'
import { onUnauthorized } from '@/services/api'
import { resolveNavigation } from './guard'
import TabsLayout from '@/views/TabsLayout.vue'
import type { RouteMeta } from 'vue-router'

/** Écrans clients : gestionnaires ayant le droit de voir les clients. */
const CLIENTS_META: RouteMeta = { accountTypes: ['manager'], permissions: ['clients.view', 'clients.view.own'] }

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/connexion',
      name: 'login',
      component: () => import('@/views/LoginPage.vue'),
      meta: { public: true },
    },
    {
      path: '/',
      component: TabsLayout,
      children: [
        { path: '', redirect: { name: 'home' } },
        {
          path: 'accueil',
          name: 'home',
          component: () => import('@/views/HomePage.vue'),
        },
        {
          path: 'demandes',
          name: 'client-requests',
          component: () => import('@/views/requests/RequestsPage.vue'),
          meta: { permissions: ['client_requests.view', 'client_requests.view.own'] },
        },
        {
          path: 'demandes/nouvelle',
          name: 'client-request-new',
          component: () => import('@/views/requests/RequestFormPage.vue'),
          meta: { permissions: ['client_requests.create'] },
        },
        {
          path: 'demandes/:id(\\d+)',
          name: 'client-request',
          component: () => import('@/views/requests/RequestDetailPage.vue'),
          props: true,
          meta: { permissions: ['client_requests.view', 'client_requests.view.own'] },
        },
        {
          path: 'clients',
          name: 'clients',
          component: () => import('@/views/clients/ClientsPage.vue'),
          meta: CLIENTS_META,
        },
        {
          path: 'clients/nouveau',
          name: 'client-new',
          component: () => import('@/views/clients/ClientFormPage.vue'),
          meta: { accountTypes: ['manager'], permissions: ['clients.create'] },
        },
        {
          path: 'clients/:id(\\d+)',
          name: 'client',
          component: () => import('@/views/clients/ClientDetailPage.vue'),
          props: true,
          meta: CLIENTS_META,
        },
        {
          path: 'clients/:id(\\d+)/contacts/nouveau',
          name: 'contact-new',
          component: () => import('@/views/clients/ContactFormPage.vue'),
          props: true,
          meta: { accountTypes: ['manager'], permissions: ['clients.create'] },
        },
        {
          path: 'projets',
          name: 'projects',
          component: () => import('@/views/projects/ProjectsPage.vue'),
          meta: { accountTypes: ['manager'], permissions: ['projects.view', 'projects.view.own'] },
        },
        {
          path: 'projets/:id(\\d+)',
          name: 'project',
          component: () => import('@/views/projects/ProjectDetailPage.vue'),
          props: true,
          meta: { accountTypes: ['manager'], permissions: ['projects.view', 'projects.view.own'] },
        },
        {
          path: 'devis/:id(\\d+)',
          name: 'quote',
          component: () => import('@/views/quotes/QuoteDetailPage.vue'),
          props: true,
          meta: { accountTypes: ['manager'], permissions: ['quotes.view', 'quotes.view.own'] },
        },
        {
          path: 'vehicules',
          name: 'vehicles',
          component: () => import('@/views/fleet/VehiclesPage.vue'),
          meta: { accountTypes: ['manager', 'technician'], permissions: ['vehicles.view', 'vehicles.view.own'] },
        },
        {
          path: 'vehicules/:id(\\d+)',
          name: 'vehicle',
          component: () => import('@/views/fleet/VehiclePage.vue'),
          props: true,
          meta: { accountTypes: ['manager', 'technician'], permissions: ['vehicles.view', 'vehicles.view.own'] },
        },
        {
          path: 'factures',
          name: 'invoices',
          component: () => import('@/views/invoices/InvoicesPage.vue'),
          meta: { accountTypes: ['manager'], permissions: ['invoices.view'] },
        },
        {
          path: 'factures/:id(\\d+)',
          name: 'invoice',
          component: () => import('@/views/invoices/InvoiceDetailPage.vue'),
          props: true,
          meta: { accountTypes: ['manager'], permissions: ['invoices.view'] },
        },
        {
          path: 'stock',
          name: 'stock',
          component: () => import('@/views/stock/StockPage.vue'),
          meta: { accountTypes: ['manager'], permissions: ['stock.view'] },
        },
        {
          path: 'stock/:id(\\d+)',
          name: 'stock-article',
          component: () => import('@/views/stock/ArticlePage.vue'),
          props: true,
          meta: { accountTypes: ['manager'], permissions: ['stock.view'] },
        },
        {
          path: 'depenses',
          name: 'expenses',
          component: () => import('@/views/expenses/ExpensesPage.vue'),
          meta: { permissions: ['accounting.view', 'accounting.view.own'] },
        },
        {
          path: 'depenses/nouvelle',
          name: 'expense-new',
          component: () => import('@/views/expenses/ExpenseFormPage.vue'),
          meta: { permissions: ['accounting.create', 'accounting.create.own'] },
        },
        {
          path: 'taches',
          name: 'tasks',
          component: () => import('@/views/tasks/TasksPage.vue'),
          meta: { permissions: ['tasks.view', 'tasks.view.own'] },
        },
        {
          path: 'taches/:id(\\d+)',
          name: 'task',
          component: () => import('@/views/tasks/TaskPage.vue'),
          props: true,
          meta: { permissions: ['tasks.view', 'tasks.view.own'] },
        },
        {
          path: 'rapports',
          name: 'journals',
          component: () => import('@/views/journals/JournalsPage.vue'),
          meta: { permissions: ['journals.view', 'journals.view.own'] },
        },
        {
          path: 'rapports/nouveau',
          name: 'journal-new',
          component: () => import('@/views/journals/JournalFormPage.vue'),
          meta: { permissions: ['journals.create'] },
        },
        {
          path: 'rapports/:id(\\d+)/modifier',
          name: 'journal-edit',
          component: () => import('@/views/journals/JournalFormPage.vue'),
          props: true,
          meta: { permissions: ['journals.update', 'journals.update.own'] },
        },
        {
          path: 'rapports/:id(\\d+)',
          name: 'journal',
          component: () => import('@/views/journals/JournalPage.vue'),
          props: true,
          meta: { permissions: ['journals.view', 'journals.view.own'] },
        },
        {
          path: 'acces',
          name: 'tech-space',
          component: () => import('@/views/tech/TechSpacePage.vue'),
          meta: { permissions: ['tech_shares.view', 'tech_shares.view.own', 'tech_access_requests.view', 'tech_access_requests.view.own'] },
        },
        {
          path: 'acces/info/:id(\\d+)',
          name: 'tech-share',
          component: () => import('@/views/tech/TechSharePage.vue'),
          props: true,
          meta: { permissions: ['tech_shares.view', 'tech_shares.view.own'] },
        },
        {
          path: 'acces/demande',
          name: 'access-request-new',
          component: () => import('@/views/tech/AccessRequestFormPage.vue'),
          meta: { permissions: ['tech_access_requests.create'] },
        },
        {
          path: 'chantier/:projectId(\\d+)',
          name: 'site',
          component: () => import('@/views/sites/SitePage.vue'),
          props: true,
          meta: { permissions: ['sites.view', 'sites.view.own'] },
        },
        {
          path: 'chantier/:projectId(\\d+)/plans/:planId(\\d+)',
          name: 'site-plan',
          component: () => import('@/views/sites/PlanPage.vue'),
          props: true,
          meta: { permissions: ['sites.view', 'sites.view.own'] },
        },
        {
          path: 'messages',
          name: 'messages',
          component: () => import('@/views/messages/MessagesPage.vue'),
        },
        {
          path: 'messages/:conversationKey',
          name: 'conversation',
          component: () => import('@/views/messages/ConversationPage.vue'),
          props: true,
        },
        {
          path: 'profil',
          name: 'profile',
          component: () => import('@/views/ProfilePage.vue'),
        },
      ],
    },
    { path: '/:pathMatch(.*)*', redirect: { name: 'home' } },
  ],
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  await auth.init()

  return resolveNavigation(to, {
    isAuthenticated: auth.isAuthenticated,
    accountType: auth.user?.account_type.value ?? null,
    canAny: auth.canAny,
  })
})

onUnauthorized(() => {
  void useAuthStore()
    .clear()
    .then(() => router.replace({ name: 'login' }))
})
