<script setup lang="ts">
import { matches } from '@/utils/home'
import { computed, onMounted, ref } from 'vue'
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
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
import { alertText, formatKm, vehicleSubtitle } from '@dash4/shared'
import { useFleetStore } from '@/stores/fleet'
import { stateColor } from '@/utils/fleet'

/** Véhicules visibles par le compte (tout le parc, ou ceux dont on est le conducteur), consultables hors ligne. */
const store = useFleetStore()
onMounted(() => void store.load().then(() => store.refresh()).catch(() => undefined))

async function onRefresh(event: RefresherCustomEvent): Promise<void> {
  await store.refresh().catch(() => undefined)
  await event.target.complete()
}

const query = ref('')
const shown = computed(() =>
  query.value.trim() ? store.visible.filter((v) => matches(query.value, v.name, v.plate, v.brand, v.model, v.driver?.full_name)) : store.visible,
)
</script>

<template>
  <IonPage>
    <IonHeader>
      <IonToolbar>
        <IonButtons slot="start"><IonBackButton default-href="/accueil" text="Retour" /></IonButtons>
        <IonTitle>Véhicules</IonTitle>
      </IonToolbar>
      <IonToolbar v-if="store.visible.length > 3"><IonSearchbar v-model="query" :debounce="150" placeholder="Nom, immatriculation, conducteur…" aria-label="Rechercher" /></IonToolbar>
    </IonHeader>
    <IonContent>
      <IonRefresher slot="fixed" @ion-refresh="onRefresh"><IonRefresherContent /></IonRefresher>
      <IonList>
        <IonItem v-for="v in shown" :key="v.id" button :router-link="{ name: 'vehicle', params: { id: v.id } }">
          <IonLabel class="ion-text-wrap">
            <h2>{{ v.name }}</h2>
            <p>{{ vehicleSubtitle(v) || v.kind.label }} · {{ formatKm(v.mileage) }}</p>
            <p v-for="(a, i) in v.alerts ?? []" :key="i"><IonText :color="stateColor(a.state)">{{ alertText(a) }}</IonText></p>
          </IonLabel>
          <IonNote slot="end">{{ v.status.label }}</IonNote>
        </IonItem>
      </IonList>
      <p v-if="store.loaded && !store.visible.length" class="ion-padding ion-text-center">
        <IonText color="medium">Aucun véhicule. Un véhicule apparaît ici quand vous en êtes le conducteur attitré.</IonText>
      </p>
    </IonContent>
  </IonPage>
</template>
