<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { IonBadge, IonIcon, IonLabel, IonPage, IonRouterOutlet, IonTabBar, IonTabButton, IonTabs } from '@ionic/vue'
import { useAuthStore } from '@/stores/auth'
import { useSyncStore } from '@/stores/sync'
import { visibleTabs } from '@/tabs'
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
  // Pas de temps réel côté serveur : nouveaux messages relevés chaque minute
  setInterval(() => {
    if (sync.online) void messaging.refresh()
  }, 60_000)
  void requests.refresh()
  void techSpace.refresh()
  void notifications.refresh()
})

const tabs = computed(() =>
  auth.user ? visibleTabs(auth.user.account_type.value, auth.canAny) : [],
)

function hrefFor(name: string): string {
  return router.resolve({ name }).href
}
</script>

<template>
  <IonPage>
    <OfflineBanner />
    <IonTabs>
      <IonRouterOutlet />
      <IonTabBar slot="bottom">
        <IonTabButton v-for="tab in tabs" :key="tab.name" :tab="tab.name" :href="hrefFor(tab.name)">
          <IonIcon :icon="tab.icon" aria-hidden="true" />
          <IonLabel>{{ tab.label }}</IonLabel>
          <IonBadge v-if="tab.name === 'messages' && messaging.unread" color="primary">{{ messaging.unread }}</IonBadge>
          <IonBadge v-if="tab.name === 'profile' && sync.pendingCount" color="warning">
            {{ sync.pendingCount }}
          </IonBadge>
          <IonBadge v-if="tab.name === 'client-requests' && requests.openCount" color="primary">
            {{ requests.openCount }}
          </IonBadge>
          <IonBadge v-if="tab.name === 'home' && notifications.unread.length" color="danger">
            {{ notifications.unread.length }}
          </IonBadge>
          <IonBadge v-if="tab.name === 'tech-space' && techSpace.unread + techSpace.toDecide.length" color="primary">
            {{ techSpace.unread + techSpace.toDecide.length }}
          </IonBadge>
        </IonTabButton>
      </IonTabBar>
    </IonTabs>
  </IonPage>
</template>
