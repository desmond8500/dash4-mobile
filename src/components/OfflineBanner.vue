<script setup lang="ts">
import { IonIcon } from '@ionic/vue'
import { cloudOfflineOutline } from 'ionicons/icons'
import { useSyncStore } from '@/stores/sync'

const sync = useSyncStore()
</script>

<template>
  <div v-if="!sync.online" class="offline-banner" role="status">
    <IonIcon :icon="cloudOfflineOutline" aria-hidden="true" />
    <span>
      Hors ligne
      <template v-if="sync.pendingCount">
        · {{ sync.pendingCount }} action{{ sync.pendingCount > 1 ? 's' : '' }} en attente d'envoi
      </template>
    </span>
  </div>
</template>

<style scoped>
.offline-banner {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: calc(var(--ion-safe-area-top, 0px) + 0.375rem) 1rem 0.375rem;
  background: var(--ion-color-warning);
  color: var(--ion-color-warning-contrast);
  font-size: 0.875rem;
  font-weight: 500;
}
</style>
