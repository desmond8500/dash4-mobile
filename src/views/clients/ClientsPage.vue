<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  IonBadge,
  IonContent,
  IonFab,
  IonFabButton,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonNote,
  IonPage,
  IonRefresher,
  IonRefresherContent,
  IonSearchbar,
  IonSpinner,
  IonText,
  IonTitle,
  IonToolbar,
  type RefresherCustomEvent,
} from '@ionic/vue'
import { add, cloudUploadOutline, star } from 'ionicons/icons'
import { useAuthStore } from '@/stores/auth'
import { useClientsStore } from '@/stores/clients'
import { matchesSearch } from '@/offline/collection'
import ClientLogo from '@/components/ClientLogo.vue'

const auth = useAuthStore()
const store = useClientsStore()
const search = ref('')

const filtered = computed(() =>
  store.sortedClients.filter((c) =>
    matchesSearch(search.value, [
      c.name,
      c.address,
      ...(c.phones ?? []).map((p) => p.number),
      ...(c.emails ?? []).map((e) => e.address),
    ]),
  ),
)

const syncedLabel = computed(() =>
  store.syncedAt
    ? `Mis à jour le ${new Date(store.syncedAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}`
    : 'Pas encore synchronisé',
)

onMounted(async () => {
  await store.load()
  void store.refresh()
})

async function onRefresh(event: RefresherCustomEvent): Promise<void> {
  await store.refresh()
  await event.target.complete()
}
</script>

<template>
  <IonPage>
    <IonHeader>
      <IonToolbar>
        <IonTitle>Clients</IonTitle>
      </IonToolbar>
      <IonToolbar>
        <IonSearchbar v-model="search" placeholder="Nom, téléphone, e-mail" :debounce="150" />
      </IonToolbar>
    </IonHeader>

    <IonContent>
      <IonRefresher slot="fixed" @ion-refresh="onRefresh">
        <IonRefresherContent pulling-text="Tirer pour actualiser" refreshing-spinner="crescent" />
      </IonRefresher>

      <IonList v-if="store.pendingClients.length">
        <IonListHeader>
          <IonLabel>En attente d'envoi</IonLabel>
        </IonListHeader>
        <IonItem v-for="item in store.pendingClients" :key="item.id">
          <IonIcon slot="start" :icon="cloudUploadOutline" color="warning" aria-hidden="true" />
          <IonLabel>
            <h2>{{ item.payload.name }}</h2>
            <p v-if="item.lastError" class="error">{{ item.lastError }}</p>
            <p v-else>Sera envoyé dès que le réseau est disponible</p>
          </IonLabel>
        </IonItem>
      </IonList>

      <IonList>
        <IonItem
          v-for="client in filtered"
          :key="client.id"
          :router-link="{ name: 'client', params: { id: client.id } }"
          detail
        >
          <ClientLogo slot="start" :name="client.name" :url="client.logo_url" :size="40" />
          <IonLabel>
            <h2>
              <IonIcon v-if="client.is_favorite" :icon="star" color="warning" aria-label="Favori" />
              {{ client.name }}
            </h2>
            <p>{{ client.phones?.[0]?.number || client.address || client.type.label }}</p>
          </IonLabel>
          <IonBadge v-if="client.status.value !== 'active'" slot="end" color="medium">
            {{ client.status.label }}
          </IonBadge>
        </IonItem>
      </IonList>

      <div v-if="!filtered.length" class="ion-padding ion-text-center">
        <IonSpinner v-if="store.syncing && !store.clients.length" />
        <IonText v-else color="medium">
          <p>{{ search ? 'Aucun client ne correspond.' : 'Aucun client pour le moment.' }}</p>
        </IonText>
      </div>

      <div class="ion-padding ion-text-center">
        <IonNote>{{ syncedLabel }}</IonNote>
        <IonText v-if="store.error" color="danger"><p>{{ store.error }}</p></IonText>
      </div>

      <IonFab v-if="auth.can('clients.create')" slot="fixed" vertical="bottom" horizontal="end">
        <IonFabButton :router-link="{ name: 'client-new' }" aria-label="Nouveau client">
          <IonIcon :icon="add" />
        </IonFabButton>
      </IonFab>
    </IonContent>
  </IonPage>
</template>

<style scoped>
h2 ion-icon {
  vertical-align: -2px;
}

.error {
  color: var(--ion-color-danger);
}
</style>
