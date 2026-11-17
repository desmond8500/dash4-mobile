import { createRouter, createWebHistory } from '@ionic/vue-router'
import { useAuthStore } from '@/stores/auth'
import { onUnauthorized } from '@/services/api'
import { resolveNavigation } from './guard'
import TabsLayout from '@/views/TabsLayout.vue'

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
