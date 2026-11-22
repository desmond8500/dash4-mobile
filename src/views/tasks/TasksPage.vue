<script setup lang="ts">
import { matches } from '@/utils/home'
import { computed, onMounted, ref } from 'vue'
import {
  IonBadge,
  IonContent,
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
  IonSegment,
  IonSegmentButton,
  IonText,
  IonTitle,
  IonToolbar,
  type RefresherCustomEvent,
  IonSearchbar,
} from '@ionic/vue'
import { alertCircle } from 'ionicons/icons'
import { OPEN_TASK_STATUSES, type Task } from '@dash4/shared'
import { useAuthStore } from '@/stores/auth'
import { useTasksStore } from '@/stores/tasks'
import { hours, isOnDay, isoDay, nextDays, sortForDay, taskColor } from '@/utils/tasks'

/** Mes tâches : aujourd'hui, les 7 prochains jours, toutes les ouvertes, terminées. */
const store = useTasksStore()
const auth = useAuthStore()
const segment = ref<'today' | 'week' | 'open' | 'done'>('today')
const today = isoDay(new Date())
// Un gestionnaire qui voit toutes les tâches regarde d'abord les siennes
const query = ref('')
const all = computed(() => (auth.isTechnician || !auth.can('tasks.view') ? store.all : store.mine))
const base = computed(() =>
  query.value.trim() ? all.value.filter((t) => matches(query.value, t.title, t.project?.name, t.status.label, ...(t.assignees ?? []).map((a) => a.full_name))) : all.value,
)

const todayTasks = computed(() => sortForDay(base.value.filter((t) => isOnDay(t, today) || (t.is_overdue && OPEN_TASK_STATUSES.includes(t.status.value)))))
const week = computed(() =>
  nextDays(new Date())
    .map((day) => ({ day, tasks: sortForDay(base.value.filter((t) => isOnDay(t, day))) }))
    .filter((d) => d.tasks.length),
)
const openTasks = computed(() => base.value.filter((t) => OPEN_TASK_STATUSES.includes(t.status.value)))
const doneTasks = computed(() => base.value.filter((t) => t.status.value === 'done').slice(0, 50))
const dayLabel = (d: string) => (d === today ? "Aujourd'hui" : new Date(`${d}T00:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }))
const place = (t: Task) => t.location ?? t.project?.name ?? t.client?.name ?? ''

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
    <IonHeader>
      <IonToolbar><IonTitle>Tâches</IonTitle></IonToolbar>
      <IonToolbar><IonSearchbar v-model="query" :debounce="150" placeholder="Tâche, projet, personne…" aria-label="Rechercher" /></IonToolbar>
      <IonToolbar>
        <IonSegment v-model="segment" scrollable>
          <IonSegmentButton value="today"><IonLabel>Aujourd'hui</IonLabel></IonSegmentButton>
          <IonSegmentButton value="week"><IonLabel>7 jours</IonLabel></IonSegmentButton>
          <IonSegmentButton value="open"><IonLabel>À faire ({{ openTasks.length }})</IonLabel></IonSegmentButton>
          <IonSegmentButton value="done"><IonLabel>Terminées</IonLabel></IonSegmentButton>
        </IonSegment>
      </IonToolbar>
    </IonHeader>

    <IonContent>
      <IonRefresher slot="fixed" @ion-refresh="onRefresh">
        <IonRefresherContent pulling-text="Tirer pour actualiser" refreshing-spinner="crescent" />
      </IonRefresher>

      <template v-if="segment === 'week'">
        <IonList v-for="d in week" :key="d.day" inset>
          <IonListHeader><IonLabel class="capitalize">{{ dayLabel(d.day) }}</IonLabel></IonListHeader>
          <IonItem v-for="t in d.tasks" :key="t.id" :router-link="{ name: 'task', params: { id: t.id } }" detail>
            <IonLabel class="ion-text-wrap">
              <h3><IonIcon v-if="t.priority.value === 'high'" :icon="alertCircle" color="danger" /> {{ t.title }}</h3>
              <p>{{ [hours(t, d.day), place(t)].filter(Boolean).join(' · ') }}</p>
            </IonLabel>
            <IonBadge slot="end" :color="taskColor(t.status.value)">{{ t.status.label }}</IonBadge>
          </IonItem>
        </IonList>
        <div v-if="!week.length" class="ion-padding ion-text-center"><IonText color="medium"><p>Rien de planifié ces 7 prochains jours.</p></IonText></div>
      </template>

      <IonList v-else inset>
        <IonItem
          v-for="t in segment === 'today' ? todayTasks : segment === 'open' ? openTasks : doneTasks"
          :key="t.id"
          :router-link="{ name: 'task', params: { id: t.id } }"
          detail
        >
          <IonLabel class="ion-text-wrap">
            <h3><IonIcon v-if="t.priority.value === 'high'" :icon="alertCircle" color="danger" /> {{ t.title }}</h3>
            <p>{{ [segment === 'today' ? hours(t, today) : t.starts_at ? new Date(t.starts_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : null, place(t)].filter(Boolean).join(' · ') }}</p>
            <p v-if="t.subtasks_count"><IonNote>{{ t.subtasks_done }}/{{ t.subtasks_count }} sous-tâches</IonNote></p>
            <p v-if="t.is_overdue"><IonText color="danger">En retard</IonText></p>
          </IonLabel>
          <IonBadge slot="end" :color="taskColor(t.status.value)">{{ t.status.label }}</IonBadge>
        </IonItem>
      </IonList>
      <div
        v-if="segment !== 'week' && !(segment === 'today' ? todayTasks : segment === 'open' ? openTasks : doneTasks).length"
        class="ion-padding ion-text-center"
      >
        <IonText color="medium">
          <p>{{ store.items.length ? (segment === 'today' ? "Rien de prévu aujourd'hui." : 'Aucune tâche.') : 'Aucune tâche sur le téléphone : tirez pour actualiser avec le réseau.' }}</p>
        </IonText>
      </div>
    </IonContent>
  </IonPage>
</template>

<style scoped>
.capitalize {
  text-transform: capitalize;
}
</style>
