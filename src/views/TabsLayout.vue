<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { IonBadge, IonContent, IonIcon, IonLabel, IonModal, IonPage, IonRouterOutlet, IonTabBar, IonTabButton, IonTabs } from '@ionic/vue'
import { appsOutline } from 'ionicons/icons'
import { useAuthStore } from '@/stores/auth'
import { useSyncStore } from '@/stores/sync'
import { splitTabs } from '@/tabs'
import { useClientRequestsStore } from '@/stores/clientRequests'
import { useTechSpaceStore } from '@/stores/techSpace'
import { useNotificationsStore } from '@/stores/notifications'
import { useMessagingStore } from '@/stores/messaging'
import OfflineBanner from '@/components/OfflineBanner.vue'

const auth = useAuthStore()
const sync = useSyncStore()
const router = useRouter()
const requests = useClientRequestsStore()
const techSpace = useTechSpaceStore()
const notifications = useNotificationsStore()
const messaging = useMessagingStore()

// Compteur de l'onglet Demandes, lu dans la copie locale (fonctionne hors ligne)
onMounted(async () => {
  await Promise.all([requests.load(), techSpace.load(), messaging.load()])
  void messaging.refresh()
  document.addEventListener('visibilitychange', onVisibility)
  messagesTimer = setInterval(refreshMessages, 60_000)
  void requests.refresh()
  void techSpace.refresh()
  void notifications.refresh()
})

// Pas de temps réel côté serveur : compteur des messages relevé chaque minute, seulement quand
// l'application est affichée et en ligne ; tout de suite quand on y revient.
let messagesTimer: ReturnType<typeof setInterval> | null = null
function refreshMessages(): void {
  if (sync.online && document.visibilityState === 'visible') void messaging.refresh()
}
function onVisibility(): void {
  refreshMessages()
}
onUnmounted(() => {
  if (messagesTimer) clearInterval(messagesTimer)
  document.removeEventListener('visibilitychange', onVisibility)
})

// Barre du bas : 4 entrées principales + « Plus » (le reste dans une feuille qui monte du bas)
const split = computed(() => (auth.user ? splitTabs(auth.user.account_type.value, auth.canAny) : { bar: [], more: [] }))
const route = useRoute()
const moreOpen = ref(false)

function hrefFor(name: string): string {
  return router.resolve({ name }).href
}

/** Pastille d'une entrée : nombre et couleur, ou null. */
function badgeFor(name: string): { count: number; color: string } | null {
  const count =
    name === 'messages' ? messaging.unread
    : name === 'profile' ? sync.pendingCount
    : name === 'client-requests' ? requests.openCount
    : name === 'home' ? notifications.unread.length
    : name === 'tech-space' ? techSpace.unread + techSpace.toDecide.length
    : 0
  if (!count) return null
  return { count, color: name === 'home' ? 'danger' : name === 'profile' ? 'warning' : 'primary' }
}

const moreBadge = computed(() => split.value.more.reduce((n, t) => n + (badgeFor(t.name)?.count ?? 0), 0))
/** « Plus » est actif quand l'écran affiché vient d'une de ses entrées. */
const moreActive = computed(() => split.value.more.some((t) => route.path === hrefFor(t.name) || route.path.startsWith(`${hrefFor(t.name)}/`)))

function go(name: string): void {
  moreOpen.value = false
  void router.push({ name })
}
</script>

<template>
  <IonPage>
    <OfflineBanner />
    <IonTabs>
      <IonRouterOutlet />
      <IonTabBar slot="bottom">
        <IonTabButton v-for="tab in split.bar" :key="tab.name" :tab="tab.name" :href="hrefFor(tab.name)">
          <IonIcon :icon="tab.icon" aria-hidden="true" />
          <IonLabel>{{ tab.label }}</IonLabel>
          <IonBadge v-if="badgeFor(tab.name)" :color="badgeFor(tab.name)!.color">{{ badgeFor(tab.name)!.count }}</IonBadge>
        </IonTabButton>
        <button v-if="split.more.length" type="button" class="more-button" :class="{ active: moreActive || moreOpen }" aria-label="Plus de rubriques" @click="moreOpen = true">
          <span class="more-icon">
            <IonIcon :icon="appsOutline" aria-hidden="true" />
            <IonBadge v-if="moreBadge" color="primary" class="more-badge">{{ moreBadge }}</IonBadge>
          </span>
          <span class="more-label">Plus</span>
        </button>
      </IonTabBar>
    </IonTabs>

    <IonModal :is-open="moreOpen" :initial-breakpoint="0.6" :breakpoints="[0, 0.6, 1]" handle-behavior="cycle" @did-dismiss="moreOpen = false">
      <IonContent class="ion-padding">
        <h2 class="more-title">Toutes les rubriques</h2>
        <div class="more-grid">
          <button v-for="tab in split.more" :key="tab.name" type="button" class="more-item" @click="go(tab.name)">
            <span class="more-item-icon">
              <IonIcon :icon="tab.icon" aria-hidden="true" />
              <IonBadge v-if="badgeFor(tab.name)" :color="badgeFor(tab.name)!.color" class="more-badge">{{ badgeFor(tab.name)!.count }}</IonBadge>
            </span>
            <span>{{ tab.label }}</span>
          </button>
        </div>
      </IonContent>
    </IonModal>
  </IonPage>
</template>

<style scoped>
.more-button {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  height: 100%;
  min-width: 0;
  border: none;
  background: transparent;
  color: var(--ion-tab-bar-color, var(--ion-color-step-600, #666));
  font-size: 10px;
  font-family: inherit;
  padding: 0;
}
.more-button.active {
  color: var(--ion-tab-bar-color-selected, var(--ion-color-primary));
}
.more-icon,
.more-item-icon {
  position: relative;
  display: inline-flex;
}
.more-icon ion-icon {
  font-size: 24px;
}
.more-badge {
  position: absolute;
  top: -4px;
  right: -12px;
  font-size: 10px;
}
.more-title {
  font-size: 1rem;
  margin: 0.25rem 0 1rem;
  color: var(--ion-color-medium);
}
.more-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.75rem;
}
.more-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.375rem;
  padding: 0.875rem 0.25rem;
  border: none;
  border-radius: 12px;
  background: var(--ion-color-light);
  color: var(--ion-text-color);
  font-size: 0.8rem;
  font-family: inherit;
}
.more-item:active {
  background: var(--ion-color-light-shade);
}
.more-item-icon ion-icon {
  font-size: 26px;
  color: var(--ion-color-primary);
}
</style>
