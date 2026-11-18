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
