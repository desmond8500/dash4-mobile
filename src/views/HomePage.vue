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
  IonSearchbar,
  IonIcon,
  IonSegment,
  IonSegmentButton,
  IonText,
  type RefresherCustomEvent,
  toastController,
  useIonRouter,
} from '@ionic/vue'
import { computed, onMounted, ref } from 'vue'
import { useClientsStore } from '@/stores/clients'
import { useProjectsStore } from '@/stores/projects'
import { useQuotesStore } from '@/stores/quotes'
import { useStockStore } from '@/stores/stock'
import { homeSearch, quickActions, type QuickAction } from '@/utils/home'
import { hours, nextDays, sortForDay, taskColor } from '@/utils/tasks'
import { scannerSupported } from '@/utils/stock'
import BarcodeScanner from '@/components/BarcodeScanner.vue'
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

// --- Recherche dans tout ce qui est sur le téléphone (marche hors ligne) ------------------------
const clients = useClientsStore()
const projects = useProjectsStore()
const quotes = useQuotesStore()
const stock = useStockStore()
const query = ref('')
const results = computed(() =>
  homeSearch(query.value, {
    clients: clients.clients,
    contacts: clients.contacts,
    projects: projects.items,
    quotes: quotes.items,
    articles: stock.items,
    tasks: tasks.all,
  }),
)
const searching = computed(() => query.value.trim().length >= 2)

// --- Actions rapides de terrain ----------------------------------------------------------------
const actions = computed(() =>
  auth.user ? quickActions(auth.user.account_type.value, auth.canAny).filter((a) => a.route !== 'scan' || scannerSupported()) : [],
)
const scanOpen = ref(false)
function runAction(a: QuickAction): void {
  if (a.route === 'scan') scanOpen.value = true
  else ionRouter.push(a.route)
}
async function onCode(code: string): Promise<void> {
  const article = stock.byCode(code)
  if (article) {
    ionRouter.push({ name: 'stock-article', params: { id: article.id } })
    return
  }
  query.value = code
  const toast = await toastController.create({ message: `Aucun article avec le code ${code}.`, duration: 2500, position: 'top' })
  await toast.present()
}

// --- Planning : mes tâches (ou toute l'équipe) sur les 7 prochains jours --------------------
const days = computed(() => nextDays(new Date(), 7))
const day = ref(isoDay(new Date()))
const scope = ref<'mine' | 'all'>('mine')
const canSeeAll = computed(() => auth.can('tasks.view'))
const planned = computed(() => sortForDay((scope.value === 'all' ? tasks.all : tasks.mine).filter((t) => isOnDay(t, day.value))))
const countOn = (d: string) => (scope.value === 'all' ? tasks.all : tasks.mine).filter((t) => isOnDay(t, d)).length
function dayLabel(d: string): { name: string; num: string } {
  const date = new Date(`${d}T00:00:00`)
  const name = d === isoDay(new Date()) ? 'Auj.' : date.toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', '')
  return { name, num: String(date.getDate()) }
}

onMounted(() => {
  for (const store of [clients, projects, quotes, stock]) void store.load().then(() => store.refresh()).catch(() => undefined)
  void invoices.load().then(() => invoices.refresh()).catch(() => undefined)
  void fleet.load().then(() => fleet.refresh()).catch(() => undefined)
  void tasks.load().then(() => tasks.refresh()).catch(() => undefined)
  void notifications.refresh()
  void dashboard.load().then(() => dashboard.refresh())
})

async function onRefresh(event: RefresherCustomEvent): Promise<void> {
  await Promise.all([auth.refresh(), sync.flush(), clients.refresh().catch(() => undefined), projects.refresh().catch(() => undefined), quotes.refresh().catch(() => undefined), stock.refresh().catch(() => undefined), invoices.refresh().catch(() => undefined), fleet.refresh().catch(() => undefined), tasks.refresh().catch(() => undefined), notifications.refresh(), dashboard.refresh()])
  await event.target.complete()
}
</script>

<template>
  <IonPage>
    <IonHeader>
      <IonToolbar>
        <IonTitle>Accueil</IonTitle>
      </IonToolbar>
      <IonToolbar>
        <IonSearchbar
          v-model="query"
          placeholder="Client, projet, devis, article…"
          :debounce="150"
          show-clear-button="focus"
          aria-label="Rechercher dans Dash4"
        />
      </IonToolbar>
    </IonHeader>

    <IonContent class="ion-padding">
      <IonRefresher slot="fixed" @ion-refresh="onRefresh">
        <IonRefresherContent pulling-text="Tirer pour actualiser" refreshing-spinner="crescent" />
      </IonRefresher>

      <!-- Résultats de recherche (données gardées sur le téléphone) -->
      <template v-if="searching">
        <IonCard v-for="g in results" :key="g.key">
          <IonCardHeader><IonCardTitle class="small-title">{{ g.label }}<IonNote v-if="g.total > g.hits.length"> · {{ g.total }} résultats</IonNote></IonCardTitle></IonCardHeader>
          <IonCardContent class="flush">
            <IonItem v-for="h in g.hits" :key="h.key" button lines="full" @click="ionRouter.push(h.route)">
              <IonLabel class="ion-text-wrap"><h3>{{ h.title }}</h3><p v-if="h.subtitle">{{ h.subtitle }}</p></IonLabel>
            </IonItem>
            <IonItem v-if="g.total > g.hits.length && g.key !== 'contacts'" button lines="none" detail @click="ionRouter.push({ name: g.key === 'articles' ? 'stock' : g.key === 'quotes' ? 'projects' : g.key })">
              <IonLabel color="primary">Voir la liste</IonLabel>
            </IonItem>
          </IonCardContent>
        </IonCard>
        <p v-if="!results.length" class="ion-text-center ion-padding">
          <IonText color="medium">Rien trouvé sur le téléphone pour « {{ query.trim() }} ». Tirez vers le bas pour mettre les données à jour.</IonText>
        </p>
      </template>

      <template v-else>
      <h2>Bonjour {{ auth.user?.firstname }}</h2>

      <!-- Actions rapides de terrain -->
      <div v-if="actions.length" class="actions">
        <button v-for="a in actions" :key="a.key" type="button" class="action" @click="runAction(a)">
          <IonIcon :icon="a.icon" aria-hidden="true" />
          <span>{{ a.label }}</span>
        </button>
      </div>

      <!-- Planning de la semaine -->
      <IonCard v-if="tasks.allowed()">
        <IonCardHeader class="planning-head">
          <IonCardTitle>Planning</IonCardTitle>
          <IonSegment v-if="canSeeAll" :value="scope" class="scope" @ion-change="(e) => (scope = e.detail.value as 'mine' | 'all')">
            <IonSegmentButton value="mine"><IonLabel>Moi</IonLabel></IonSegmentButton>
            <IonSegmentButton value="all"><IonLabel>Équipe</IonLabel></IonSegmentButton>
          </IonSegment>
        </IonCardHeader>
        <IonCardContent class="flush">
          <div class="days">
            <button v-for="d in days" :key="d" type="button" class="day" :class="{ active: d === day }" @click="day = d">
              <span class="day-name">{{ dayLabel(d).name }}</span>
              <span class="day-num">{{ dayLabel(d).num }}</span>
              <span class="day-dot" :class="{ on: countOn(d) > 0 }">{{ countOn(d) || '' }}</span>
            </button>
          </div>
          <IonItem v-for="t in planned" :key="t.id" button lines="full" :router-link="{ name: 'task', params: { id: t.id } }">
            <span slot="start" class="status-bar" :style="{ background: `var(--ion-color-${taskColor(t.status.value)})` }" />
            <IonLabel class="ion-text-wrap">
              <h3>{{ t.title }}</h3>
              <p>{{ [hours(t, day), t.project?.name].filter(Boolean).join(' · ') }}</p>
              <p v-if="scope === 'all' && t.assignees?.length">{{ t.assignees.map((a) => a.full_name).join(', ') }}</p>
            </IonLabel>
            <IonNote slot="end">{{ t.status.label }}</IonNote>
          </IonItem>
          <p v-if="!planned.length" class="ion-padding-horizontal ion-padding-bottom">
            <IonText color="medium">Rien de prévu ce jour-là.</IonText>
          </p>
          <IonItem button lines="none" detail :router-link="{ name: 'tasks' }">
            <IonLabel color="primary">Toutes mes tâches · {{ tasks.openMineCount }} à faire</IonLabel>
          </IonItem>
        </IonCardContent>
      </IonCard>

      <IonCard v-if="notifications.unread.length">
        <IonCardHeader><IonCardTitle>Notifications ({{ notifications.unread.length }})</IonCardTitle></IonCardHeader>
        <IonCardContent class="notifications">
          <IonItem v-for="n in notifications.unread.slice(0, 8)" :key="n.id" button lines="full" @click="openNotification(n)">
            <IonLabel class="ion-text-wrap"><h3>{{ n.title }}</h3><p>{{ n.body }}</p></IonLabel>
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

      </template>

      <BarcodeScanner v-model:open="scanOpen" @code="onCode" />

      <p v-if="!searching && dashboard.updatedAt && !sync.online" class="ion-text-center">
        <IonNote>Chiffres du {{ new Date(dashboard.updatedAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) }} (hors ligne)</IonNote>
      </p>
    </IonContent>
  </IonPage>
</template>

<style scoped>
.actions {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem;
  margin: 0 0 0.5rem;
}
.action {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  min-height: 78px;
  padding: 0.625rem 0.25rem;
  border: none;
  border-radius: 12px;
  background: var(--ion-color-primary);
  color: var(--ion-color-primary-contrast);
  font-family: inherit;
  font-size: 0.78rem;
  font-weight: 600;
  line-height: 1.15;
}
.action:nth-child(n + 4) {
  background: var(--ion-color-light);
  color: var(--ion-text-color);
}
.action ion-icon {
  font-size: 24px;
}
.action:active {
  filter: brightness(0.92);
}
.small-title {
  font-size: 1rem;
}
.flush {
  padding: 0 !important;
}
.planning-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}
.scope {
  width: 9rem;
}
.days {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 0.25rem;
  padding: 0 0.5rem 0.5rem;
}
.day {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.125rem;
  padding: 0.375rem 0;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: var(--ion-text-color);
  font-family: inherit;
}
.day.active {
  background: var(--ion-color-primary);
  color: var(--ion-color-primary-contrast);
}
.day-name {
  font-size: 0.7rem;
  text-transform: capitalize;
  opacity: 0.8;
}
.day-num {
  font-size: 1rem;
  font-weight: 700;
}
.day-dot {
  min-width: 1.1rem;
  height: 1.1rem;
  font-size: 0.65rem;
  line-height: 1.1rem;
  border-radius: 999px;
}
.day-dot.on {
  background: var(--ion-color-warning);
  color: #111;
}
.day.active .day-dot.on {
  background: var(--ion-color-primary-contrast);
  color: var(--ion-color-primary);
}
.status-bar {
  width: 4px;
  align-self: stretch;
  border-radius: 2px;
  margin-right: 0.5rem;
}
</style>
