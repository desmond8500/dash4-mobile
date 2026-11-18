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
