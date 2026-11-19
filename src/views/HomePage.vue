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
import { computed, onMounted } from 'vue'
import { formatMoney } from '@dash4/shared'
import { useAuthStore } from '@/stores/auth'
import { useSyncStore } from '@/stores/sync'
import { useInvoicesStore } from '@/stores/invoices'
import { useTasksStore } from '@/stores/tasks'
import { isOnDay, isoDay } from '@/utils/tasks'

const auth = useAuthStore()
const sync = useSyncStore()
const invoices = useInvoicesStore()
const tasks = useTasksStore()
const todayCount = computed(() => tasks.mine.filter((t) => isOnDay(t, isoDay(new Date()))).length)

onMounted(() => {
  void invoices.load().then(() => invoices.refresh()).catch(() => undefined)
  void tasks.load().then(() => tasks.refresh()).catch(() => undefined)
})

async function onRefresh(event: RefresherCustomEvent): Promise<void> {
  await Promise.all([auth.refresh(), sync.flush(), invoices.refresh().catch(() => undefined), tasks.refresh().catch(() => undefined)])
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

      <IonCard v-if="tasks.allowed()" button :router-link="{ name: 'tasks' }">
        <IonCardHeader>
          <IonCardTitle>Mes tâches</IonCardTitle>
        </IonCardHeader>
        <IonCardContent>
          <IonItem lines="none">
            <IonLabel>Aujourd'hui</IonLabel>
            <IonNote slot="end">{{ todayCount }}</IonNote>
          </IonItem>
          <IonItem lines="none">
            <IonLabel>À faire</IonLabel>
            <IonNote slot="end">{{ tasks.openMineCount }}</IonNote>
          </IonItem>
        </IonCardContent>
      </IonCard>

      <IonCard v-if="auth.isTechnician">
        <IonCardHeader>
          <IonCardTitle>Espace technicien</IonCardTitle>
        </IonCardHeader>
        <IonCardContent>
          Vos tâches, vos demandes clients et vos dépenses fonctionnent même sans réseau. Informations de chantier,
          rapports d'intervention et demandes d'accès arrivent dans les prochaines livraisons.
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
          Clients, demandes, projets, devis, stock, tâches et dépenses sont consultables même sans réseau.
          Les journaux d'intervention arrivent dans la prochaine livraison.
        </IonCardContent>
      </IonCard>
    </IonContent>
  </IonPage>
</template>
