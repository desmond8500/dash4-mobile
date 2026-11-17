<script setup lang="ts">
import {
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonContent,
  IonHeader,
  IonPage,
  IonRefresher,
  IonRefresherContent,
  IonTitle,
  IonToolbar,
  type RefresherCustomEvent,
} from '@ionic/vue'
import { useAuthStore } from '@/stores/auth'
import { useSyncStore } from '@/stores/sync'

const auth = useAuthStore()
const sync = useSyncStore()

async function onRefresh(event: RefresherCustomEvent): Promise<void> {
  await Promise.all([auth.refresh(), sync.flush()])
  await event.target.complete()
}
</script>

<template>
  <IonPage>
    <IonHeader>
      <IonToolbar>
        <IonTitle>Accueil</IonTitle>
      </IonToolbar>
    </IonHeader>

    <IonContent class="ion-padding">
      <IonRefresher slot="fixed" @ion-refresh="onRefresh">
        <IonRefresherContent pulling-text="Tirer pour actualiser" refreshing-spinner="crescent" />
      </IonRefresher>

      <h2>Bonjour {{ auth.user?.firstname }}</h2>

      <IonCard v-if="auth.isTechnician">
        <IonCardHeader>
          <IonCardTitle>Espace technicien</IonCardTitle>
        </IonCardHeader>
        <IonCardContent>
          Vos tâches, informations de chantier, rapports d'intervention et demandes d'accès arrivent dans les
          prochaines livraisons. Tout fonctionnera aussi sans réseau.
        </IonCardContent>
      </IonCard>

      <IonCard v-else>
        <IonCardHeader>
          <IonCardTitle>Espace gestionnaire</IonCardTitle>
        </IonCardHeader>
        <IonCardContent>
          Clients, demandes clients, projets, devis, stock et tâches arrivent dans les prochaines livraisons de la
          V1. Tout fonctionnera aussi sans réseau.
        </IonCardContent>
      </IonCard>
    </IonContent>
  </IonPage>
</template>
