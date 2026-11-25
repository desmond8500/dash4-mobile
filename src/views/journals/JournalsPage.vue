<script setup lang="ts">
import ViewModeButton from '@/components/ViewModeButton.vue'
import CardList from '@/components/CardList.vue'
import { useViewMode } from '@/composables/useViewMode'
import { matches } from '@/utils/home'
import { computed, onMounted, ref } from 'vue'
import {
  IonBadge,
  IonButtons,
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
  IonSearchbar,
} from '@ionic/vue'
import { add, calendarOutline, cloudOfflineOutline, imagesOutline, peopleOutline } from 'ionicons/icons'
import { useAuthStore } from '@/stores/auth'
import { useJournalsStore } from '@/stores/journals'

/** Rapports d'intervention : les miens, ceux en attente d'envoi. */
const viewMode = useViewMode('journals')
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

const query = ref('')
const shown = computed(() =>
  query.value.trim()
    ? store.sorted.filter((j) => matches(query.value, j.title, j.type.label, j.project?.name, j.client?.name, j.task?.title, ...(j.participants ?? []).map((p) => p.name)))
    : store.sorted,
)
</script>

<template>
  <IonPage>
    <IonHeader>
      <IonToolbar><IonTitle>Rapports</IonTitle>
        <IonButtons slot="end"><ViewModeButton v-model="viewMode" /></IonButtons></IonToolbar>
      <IonToolbar><IonSearchbar v-model="query" :debounce="150" placeholder="Titre, projet, client, intervenant…" aria-label="Rechercher" /></IonToolbar>
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

      <CardList v-if="viewMode === 'cards'" :items="shown" :to="(j) => ({ name: 'journal', params: { id: j.id } })">
        <template #card="{ item }">
          <div class="card-head">
            <div>
              <span class="card-title">{{ item.title }}</span>
              <span class="card-sub">{{ [item.project?.name, item.client?.name].filter(Boolean).join(' · ') }}</span>
            </div>
          </div>
          <div class="card-meta">
            <span><IonIcon :icon="calendarOutline" /> {{ date(item.date) }}</span>
            <span v-if="item.participants?.length"><IonIcon :icon="peopleOutline" /> {{ item.participants.map((p) => p.name).join(', ') }}</span>
            <span v-if="item.photos_count || store.photosWaiting(item.client_uuid)"><IonIcon :icon="imagesOutline" /> {{ (item.photos_count ?? 0) + store.photosWaiting(item.client_uuid) }} photo(s)</span>
          </div>
          <div class="card-foot"><IonBadge color="medium">{{ item.type.label }}</IonBadge></div>
        </template>
      </CardList>
      <IonList v-else inset>
        <IonItem v-for="j in shown" :key="j.id" :router-link="{ name: 'journal', params: { id: j.id } }" detail>
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
