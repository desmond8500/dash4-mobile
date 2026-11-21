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
  useIonRouter,
} from '@ionic/vue'
import { computed, onMounted } from 'vue'
import { formatMoney } from '@dash4/shared'
import { useAuthStore } from '@/stores/auth'
import { useSyncStore } from '@/stores/sync'
import { useInvoicesStore } from '@/stores/invoices'
import { useFleetStore } from '@/stores/fleet'
import { useTasksStore } from '@/stores/tasks'
import { useNotificationsStore } from '@/stores/notifications'
import { useDashboardStore } from '@/stores/dashboard'
import { homeTiles } from '@/utils/dashboard'
import { notificationRoute } from '@/utils/notifications'
import type { AppNotification } from '@dash4/shared'
import { isOnDay, isoDay } from '@/utils/tasks'

const auth = useAuthStore()
const sync = useSyncStore()
const invoices = useInvoicesStore()
const fleet = useFleetStore()
const tasks = useTasksStore()
const notifications = useNotificationsStore()
const dashboard = useDashboardStore()
const tiles = computed(() => homeTiles(dashboard.widgets))
const ionRouter = useIonRouter()

async function openNotification(n: AppNotification): Promise<void> {
  await notifications.markRead(n.id)
  const target = notificationRoute(n)
  if (target) ionRouter.push(target)
}
const todayCount = computed(() => tasks.mine.filter((t) => isOnDay(t, isoDay(new Date()))).length)

onMounted(() => {
  void invoices.load().then(() => invoices.refresh()).catch(() => undefined)
  void fleet.load().then(() => fleet.refresh()).catch(() => undefined)
  void tasks.load().then(() => tasks.refresh()).catch(() => undefined)
  void notifications.refresh()
  void dashboard.load().then(() => dashboard.refresh())
})

async function onRefresh(event: RefresherCustomEvent): Promise<void> {
  await Promise.all([auth.refresh(), sync.flush(), invoices.refresh().catch(() => undefined), fleet.refresh().catch(() => undefined), tasks.refresh().catch(() => undefined), notifications.refresh(), dashboard.refresh()])
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

      <IonCard v-if="notifications.unread.length">
        <IonCardHeader><IonCardTitle>Notifications ({{ notifications.unread.length }})</IonCardTitle></IonCardHeader>
        <IonCardContent class="notifications">
          <IonItem v-for="n in notifications.unread.slice(0, 8)" :key="n.id" button lines="full" @click="openNotification(n)">
            <IonLabel class="ion-text-wrap"><h3>{{ n.title }}</h3><p>{{ n.body }}</p></IonLabel>
          </IonItem>
        </IonCardContent>
      </IonCard>

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

      <IonCard v-if="tiles.length">
        <IonCardHeader><IonCardTitle>En bref</IonCardTitle></IonCardHeader>
        <IonCardContent>
          <IonItem v-for="t in tiles" :key="t.label" button lines="none" :detail="true" @click="ionRouter.push(t.route)">
            <IonLabel>{{ t.label }}</IonLabel>
            <IonNote slot="end" :color="t.tone">{{ t.value }}</IonNote>
          </IonItem>
        </IonCardContent>
      </IonCard>

      <IonCard v-if="fleet.allowed() && fleet.visible.length" button :router-link="{ name: 'vehicles' }">
        <IonCardHeader>
          <IonCardTitle>{{ fleet.visible.length === 1 ? 'Mon véhicule' : 'Véhicules' }}</IonCardTitle>
        </IonCardHeader>
        <IonCardContent>
          <IonItem lines="none">
            <IonLabel>{{ fleet.visible.length === 1 ? fleet.visible[0]!.name : `${fleet.visible.length} véhicules` }}</IonLabel>
            <IonNote slot="end" :color="fleet.alertsCount ? 'warning' : undefined">{{ fleet.alertsCount ? `${fleet.alertsCount} à surveiller` : 'Rien à signaler' }}</IonNote>
          </IonItem>
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

      <p v-if="dashboard.updatedAt && !sync.online" class="ion-text-center">
        <IonNote>Chiffres du {{ new Date(dashboard.updatedAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) }} (hors ligne)</IonNote>
      </p>
    </IonContent>
  </IonPage>
</template>
