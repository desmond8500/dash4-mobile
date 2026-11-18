<script setup lang="ts">
import {
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonItem,
  IonLabel,
  IonNote,
  IonContent,
  IonHeader,
  IonPage,
  IonRefresher,
  IonRefresherContent,
  IonTitle,
  IonToolbar,
  type RefresherCustomEvent,
} from '@ionic/vue'
import { onMounted } from 'vue'
import { formatMoney } from '@dash4/shared'
import { useAuthStore } from '@/stores/auth'
import { useSyncStore } from '@/stores/sync'
import { useInvoicesStore } from '@/stores/invoices'

const auth = useAuthStore()
const sync = useSyncStore()
const invoices = useInvoicesStore()

onMounted(() => void invoices.load().then(() => invoices.refresh()).catch(() => undefined))

async function onRefresh(event: RefresherCustomEvent): Promise<void> {
  await Promise.all([auth.refresh(), sync.flush(), invoices.refresh().catch(() => undefined)])
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
          Notez les demandes des clients sur place dans l'onglet Demandes, même sans réseau. Vos tâches,
          informations de chantier, rapports d'intervention et demandes d'accès arrivent dans les prochaines livraisons.
        </IonCardContent>
      </IonCard>

      <IonCard v-if="invoices.allowed()" button :router-link="{ name: 'invoices' }">
        <IonCardHeader>
          <IonCardTitle>Factures</IonCardTitle>
        </IonCardHeader>
        <IonCardContent>
          <IonItem lines="none">
            <IonLabel>À encaisser</IonLabel>
            <IonNote slot="end">{{ formatMoney(invoices.summary.toCollect) }}</IonNote>
          </IonItem>
          <IonItem lines="none">
            <IonLabel>En retard</IonLabel>
            <IonNote slot="end" :color="invoices.summary.overdueCount ? 'danger' : undefined">
              {{ formatMoney(invoices.summary.overdueAmount) }} ({{ invoices.summary.overdueCount }})
            </IonNote>
          </IonItem>
        </IonCardContent>
      </IonCard>

      <IonCard v-if="!auth.isTechnician">
        <IonCardHeader>
          <IonCardTitle>Espace gestionnaire</IonCardTitle>
        </IonCardHeader>
        <IonCardContent>
          Clients, contacts et demandes clients sont consultables et se saisissent même sans réseau. Projets,
          devis, stock et tâches arrivent dans les prochaines livraisons de la V1.
        </IonCardContent>
      </IonCard>
    </IonContent>
  </IonPage>
</template>
