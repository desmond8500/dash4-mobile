<script setup lang="ts">
import ViewModeButton from '@/components/ViewModeButton.vue'
import { useViewMode } from '@/composables/useViewMode'
import { matches } from '@/utils/home'
import { computed, onMounted, ref } from 'vue'
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonPage,
  IonPopover,
  IonRefresher,
  IonRefresherContent,
  IonSearchbar,
  IonText,
  IonTitle,
  IonToolbar,
  useIonRouter,
  type RefresherCustomEvent,
} from '@ionic/vue'
import {
  alertCircle,
  checkmarkCircle,
  checkmarkDoneOutline,
  ellipseOutline,
  ellipsisHorizontalCircleOutline,
  eyeOffOutline,
  eyeOutline,
  funnelOutline,
  notificationsOutline,
  peopleOutline,
  personOutline,
} from 'ionicons/icons'
import type { Task } from '@dash4/shared'
import { useAuthStore } from '@/stores/auth'
import { useSyncStore } from '@/stores/sync'
import { useTasksStore } from '@/stores/tasks'
import { groupTasks, isoDay, taskPill, type TaskSort } from '@/utils/tasks'

/**
 * Tâches groupées par jour (en retard, aujourd'hui, demain, la semaine, plus tard, sans date), en cartes
 * avec une case ronde pour terminer (ou rouvrir) et une pastille d'heure colorée. Le menu « … » règle
 * le tri, les terminées et, pour un gestionnaire, mes tâches ou toute l'équipe.
 */
const viewMode = useViewMode('tasks')
const store = useTasksStore()
const auth = useAuthStore()
const sync = useSyncStore()
const router = useIonRouter()
const today = isoDay(new Date())

const query = ref('')
const sort = ref<TaskSort>('time')
const showDone = ref(false)
// Un gestionnaire qui voit toutes les tâches regarde d'abord les siennes
const canSeeAll = computed(() => !auth.isTechnician && auth.can('tasks.view'))
const scope = ref<'mine' | 'all'>('mine')
const source = computed(() => (canSeeAll.value && scope.value === 'mine' ? store.mine : store.all))
const base = computed(() =>
  query.value.trim()
    ? source.value.filter((t) => matches(query.value, t.title, t.project?.name, t.client?.name, t.location, t.status.label, ...(t.assignees ?? []).map((a) => a.full_name)))
    : source.value,
)
const groups = computed(() => groupTasks(base.value, today, { sort: sort.value, showDone: showDone.value }))
const openCount = computed(() => groups.value.filter((g) => g.key !== 'done').reduce((n, g) => n + g.tasks.length, 0))

const subtitle = (t: Task) =>
  [t.location ?? t.project?.name ?? t.client?.name, t.subtasks_count ? `${t.subtasks_done}/${t.subtasks_count} sous-tâches` : null].filter(Boolean).join(' · ')

async function toggleDone(task: Task): Promise<void> {
  await store.setStatus(task, task.status.value === 'done' ? 'todo' : 'done')
}

onMounted(async () => {
  await store.load()
  void store.refresh().catch(() => undefined)
})

async function onRefresh(event: RefresherCustomEvent): Promise<void> {
  await store.refresh().catch(() => undefined)
  await event.target.complete()
}
</script>

<template>
  <IonPage>
    <IonHeader class="ion-no-border">
      <IonToolbar>
        <IonTitle>Tâches</IonTitle>
        <IonButtons slot="end">
          <ViewModeButton v-model="viewMode" />
          <IonButton id="tasks-menu" aria-label="Options">
            <IonIcon slot="icon-only" :icon="ellipsisHorizontalCircleOutline" />
          </IonButton>
        </IonButtons>
      </IonToolbar>
      <IonToolbar>
        <IonSearchbar v-model="query" :debounce="150" placeholder="Tâche, projet, personne…" aria-label="Rechercher" />
      </IonToolbar>
    </IonHeader>

    <IonPopover trigger="tasks-menu" trigger-action="click" :dismiss-on-select="true" alignment="end" class="tasks-menu">
      <IonList lines="none">
        <IonItem button :detail="false" @click="sort = sort === 'time' ? 'priority' : 'time'">
          <IonIcon slot="start" :icon="funnelOutline" color="primary" />
          <IonLabel>Trier par</IonLabel>
          <IonNote slot="end" color="primary">{{ sort === 'time' ? 'Heure' : 'Priorité' }}</IonNote>
        </IonItem>
        <IonItem button :detail="false" @click="showDone = !showDone">
          <IonIcon slot="start" :icon="showDone ? eyeOffOutline : eyeOutline" color="primary" />
          <IonLabel>{{ showDone ? 'Masquer les terminées' : 'Afficher les terminées' }}</IonLabel>
        </IonItem>
        <IonItem v-if="canSeeAll" button :detail="false" @click="scope = scope === 'mine' ? 'all' : 'mine'">
          <IonIcon slot="start" :icon="scope === 'mine' ? peopleOutline : personOutline" color="primary" />
          <IonLabel>{{ scope === 'mine' ? "Toute l'équipe" : 'Seulement les miennes' }}</IonLabel>
        </IonItem>
        <IonItem button :detail="false" @click="router.push({ name: 'home' })">
          <IonIcon slot="start" :icon="checkmarkDoneOutline" color="primary" />
          <IonLabel>Planning de la semaine</IonLabel>
        </IonItem>
        <IonItem button :detail="false" @click="router.push({ name: 'profile' })">
          <IonIcon slot="start" :icon="notificationsOutline" color="primary" />
          <IonLabel>Notifications</IonLabel>
        </IonItem>
      </IonList>
    </IonPopover>

    <IonContent class="tasks-content">
      <IonRefresher slot="fixed" @ion-refresh="onRefresh">
        <IonRefresherContent pulling-text="Tirer pour actualiser" refreshing-spinner="crescent" />
      </IonRefresher>

      <p class="summary">
        {{ openCount }} tâche{{ openCount > 1 ? 's' : '' }} à faire<template v-if="canSeeAll"> · {{ scope === 'mine' ? 'les miennes' : "toute l'équipe" }}</template>
        <template v-if="sort === 'priority'"> · par priorité</template>
      </p>

      <section v-for="g in groups" :key="g.key" class="group">
        <h2 class="group-title" :class="{ late: g.key === 'late', done: g.key === 'done' }">
          {{ g.label }} <span class="group-count">{{ g.tasks.length }}</span>
        </h2>
        <div class="task-grid" :class="{ grid: viewMode === 'cards' }">
          <article
            v-for="t in g.tasks"
            :key="t.id"
            class="task-card"
            :class="{ finished: t.status.value === 'done' }"
            role="link"
            tabindex="0"
            @click="router.push({ name: 'task', params: { id: t.id } })"
            @keydown.enter.self="router.push({ name: 'task', params: { id: t.id } })"
          >
            <button
              type="button"
              class="check"
              :aria-label="t.status.value === 'done' ? `Rouvrir « ${t.title} »` : `Terminer « ${t.title} »`"
              @click.stop="toggleDone(t)"
            >
              <IonIcon :icon="t.status.value === 'done' ? checkmarkCircle : ellipseOutline" />
            </button>
            <div class="task-body">
              <span class="task-title">
                <IonIcon v-if="t.priority.value === 'high' && t.status.value !== 'done'" :icon="alertCircle" color="danger" aria-label="Urgente" />
                {{ t.title }}
              </span>
              <span v-if="subtitle(t)" class="task-sub">{{ subtitle(t) }}</span>
              <span v-if="canSeeAll && scope === 'all' && t.assignees?.length" class="task-sub">{{ t.assignees.map((a) => a.full_name).join(', ') }}</span>
            </div>
            <span v-if="taskPill(t, g.day, today)" class="pill" :class="`pill-${taskPill(t, g.day, today)!.tone}`">
              {{ taskPill(t, g.day, today)!.text }}
            </span>
          </article>
        </div>
      </section>

      <div v-if="!groups.length" class="ion-padding ion-text-center">
        <IonText color="medium">
          <p>{{ query ? 'Aucune tâche ne correspond.' : store.syncing ? 'Chargement…' : 'Rien à faire pour le moment.' }}</p>
        </IonText>
      </div>
      <p v-if="!sync.online" class="ion-text-center offline-note"><IonText color="medium">Hors ligne : les tâches terminées partiront au retour du réseau.</IonText></p>
    </IonContent>
  </IonPage>
</template>

<style scoped>
.summary {
  margin: 0.25rem 1rem 0;
  color: var(--ion-color-medium);
  font-size: 0.85rem;
}
.group {
  padding: 0 1rem;
}
.group-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 1.1rem 0 0.6rem;
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--ion-color-primary);
}
.group-title.late {
  color: var(--ion-color-danger);
}
.group-title.done {
  color: var(--ion-color-medium);
}
.group-count {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--ion-color-medium);
}
.task-grid {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}
.task-grid.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(16rem, 100%), 1fr));
}
.task-card {
  display: flex;
  align-items: flex-start;
  gap: 0.7rem;
  padding: 0.8rem 0.85rem;
  border: 1px solid var(--ion-color-step-150, #e5e7eb);
  border-radius: 8px;
  background: var(--ion-card-background, #fff);
  cursor: pointer;
}
.task-card:active {
  border-color: var(--ion-color-primary);
}
.task-card:focus-visible {
  outline: 2px solid var(--ion-color-primary);
  outline-offset: 2px;
}
.check {
  flex-shrink: 0;
  display: flex;
  padding: 0;
  margin-top: 0.05rem;
  border: none;
  background: none;
  font-size: 1.35rem;
  color: var(--ion-color-medium);
}
.finished .check {
  color: var(--ion-color-medium-tint);
}
.task-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}
.task-title {
  font-size: 1rem;
  color: var(--ion-text-color);
}
.task-title ion-icon {
  vertical-align: -2px;
}
.task-sub {
  font-size: 0.82rem;
  color: var(--ion-color-medium);
}
.finished .task-title,
.finished .task-sub {
  color: var(--ion-color-medium-tint);
}
.finished .task-title {
  text-decoration: line-through;
}
.offline-note {
  font-size: 0.85rem;
}
</style>
