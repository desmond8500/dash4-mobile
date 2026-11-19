<script setup lang="ts">
import { onMounted } from 'vue'
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
  IonText,
  IonTitle,
  IonToolbar,
  type RefresherCustomEvent,
} from '@ionic/vue'
import { add, cloudOfflineOutline, imagesOutline } from 'ionicons/icons'
import { useAuthStore } from '@/stores/auth'
import { useJournalsStore } from '@/stores/journals'

/** Rapports d'intervention : les miens, ceux en attente d'envoi. */
const store = useJournalsStore()
const auth = useAuthStore()

onMounted(async () => {
  await store.load()
  void store.refresh().catch(() => undefined)
})
async function onRefresh(event: RefresherCustomEvent): Promise<void> {
  await store.refresh().catch(() => undefined)
  await event.target.complete()
}
const date = (iso: string | null) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }) : '')
</script>

<template>
  <IonPage>
    <IonHeader>
      <IonToolbar><IonTitle>Rapports</IonTitle></IonToolbar>
    </IonHeader>
    <IonContent>
      <IonRefresher slot="fixed" @ion-refresh="onRefresh">
        <IonRefresherContent pulling-text="Tirer pour actualiser" refreshing-spinner="crescent" />
      </IonRefresher>

      <IonList v-if="store.pending.length" inset>
        <IonListHeader><IonLabel>En attente d'envoi</IonLabel></IonListHeader>
        <IonItem v-for="p in store.pending" :key="p.id">
          <IonIcon slot="start" :icon="cloudOfflineOutline" color="medium" />
          <IonLabel class="ion-text-wrap">
            <h3>{{ p.payload.title }}</h3>
            <p v-if="store.photosWaiting(p.id)">{{ store.photosWaiting(p.id) }} photo(s)</p>
            <p v-if="p.lastError"><IonText color="danger">{{ p.lastError }}</IonText></p>
          </IonLabel>
        </IonItem>
      </IonList>

      <IonList inset>
        <IonItem v-for="j in store.sorted" :key="j.id" :router-link="{ name: 'journal', params: { id: j.id } }" detail>
          <IonLabel class="ion-text-wrap">
            <h3>{{ j.title }}</h3>
            <p>{{ [date(j.date), j.project?.name ?? j.client?.name].filter(Boolean).join(' · ') }}</p>
          </IonLabel>
          <div slot="end" class="end">
            <IonBadge color="medium">{{ j.type.label }}</IonBadge>
            <IonNote v-if="j.photos_count || store.photosWaiting(j.client_uuid)"><IonIcon :icon="imagesOutline" /> {{ (j.photos_count ?? 0) + store.photosWaiting(j.client_uuid) }}</IonNote>
          </div>
        </IonItem>
      </IonList>
      <div v-if="!store.sorted.length && !store.pending.length" class="ion-padding ion-text-center">
        <IonText color="medium"><p>Aucun rapport. Touchez + après une intervention, même sans réseau.</p></IonText>
      </div>

      <IonFab v-if="auth.can('journals.create')" slot="fixed" vertical="bottom" horizontal="end">
        <IonFabButton :router-link="{ name: 'journal-new' }" aria-label="Nouveau rapport"><IonIcon :icon="add" /></IonFabButton>
      </IonFab>
    </IonContent>
  </IonPage>
</template>

<style scoped>
.end {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.25rem;
}
</style>
