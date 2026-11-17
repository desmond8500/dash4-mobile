<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { IonBadge, IonIcon, IonLabel, IonPage, IonRouterOutlet, IonTabBar, IonTabButton, IonTabs } from '@ionic/vue'
import { useAuthStore } from '@/stores/auth'
import { useSyncStore } from '@/stores/sync'
import { visibleTabs } from '@/tabs'
import OfflineBanner from '@/components/OfflineBanner.vue'

const auth = useAuthStore()
const sync = useSyncStore()
const router = useRouter()

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
          <IonBadge v-if="tab.name === 'profile' && sync.pendingCount" color="warning">
            {{ sync.pendingCount }}
          </IonBadge>
        </IonTabButton>
      </IonTabBar>
    </IonTabs>
  </IonPage>
</template>
