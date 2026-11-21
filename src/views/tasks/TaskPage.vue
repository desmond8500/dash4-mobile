<script setup lang="ts">
import MarkdownView from '@/components/MarkdownView.vue'
import { computed, onMounted, ref } from 'vue'
import {
  IonBackButton,
  IonBadge,
  IonButton,
  IonButtons,
  IonCheckbox,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonNote,
  IonPage,
  IonText,
  IonTextarea,
  IonTitle,
  IonToolbar,
  toastController,
} from '@ionic/vue'
import CommentsSection from '@/components/CommentsSection.vue'
import { cameraOutline, cloudOfflineOutline, navigateOutline } from 'ionicons/icons'
import type { Note, TaskStatus } from '@dash4/shared'
import { api } from '@/services/api'
import { useSyncStore } from '@/stores/sync'
import { useTasksStore } from '@/stores/tasks'
import { useAuthStore } from '@/stores/auth'
import { pendingCreations } from '@/offline/collection'
import { hours, taskColor } from '@/utils/tasks'

/** Fiche tâche : commencer, terminer, cocher les sous-tâches, noter, photographier — même sans réseau. */
const props = defineProps<{ id: string }>()
const store = useTasksStore()
const sync = useSyncStore()
const auth = useAuthStore()

const task = computed(() => store.find(Number(props.id)) ?? null)
const notes = ref<Note[]>([])
const note = ref('')
const uploading = ref(false)
const pendingNotes = computed(() => pendingCreations(sync.pending, `tasks/${props.id}/notes`))
const mapUrl = computed(() => {
  const p = task.value?.project
  if (p?.latitude != null) return `https://www.google.com/maps/dir/?api=1&destination=${p.latitude},${p.longitude}`
  const address = task.value?.location ?? p?.address ?? task.value?.client?.address
  return address ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}` : null
})
const actions = computed<Array<{ status: TaskStatus; label: string; color: string }>>(() => {
  switch (task.value?.status.value) {
    case 'todo':
      return [{ status: 'in_progress', label: 'Commencer', color: 'primary' }, { status: 'done', label: 'Terminer', color: 'success' }]
    case 'in_progress':
      return [{ status: 'done', label: 'Terminer', color: 'success' }, { status: 'blocked', label: 'Bloquée', color: 'danger' }]
    case 'blocked':
      return [{ status: 'in_progress', label: 'Reprendre', color: 'primary' }]
    default:
      return [{ status: 'in_progress', label: 'Rouvrir', color: 'medium' }]
  }
})
const day = computed(() => task.value?.starts_at?.slice(0, 10) ?? '')

onMounted(async () => {
  await store.load()
  if (!task.value) await store.refresh().catch(() => undefined)
  if (sync.online) notes.value = await api.notes.list('tasks', Number(props.id)).catch(() => [])
})

async function toast(message: string, color = 'success'): Promise<void> {
  const t = await toastController.create({ message, duration: 2500, color, position: 'top' })
  await t.present()
}

async function setStatus(status: TaskStatus): Promise<void> {
  if (!task.value) return
  await store.setStatus(task.value, status)
  if (status === 'done') await toast(sync.online ? 'Tâche terminée.' : 'Tâche terminée, envoyée dès le retour du réseau.')
}

async function addNote(): Promise<void> {
  const body = note.value.trim()
  if (!body || !task.value) return
  await store.addNote(task.value, body)
  note.value = ''
}

/** Photo : envoyée tout de suite (il faut le réseau). */
async function onPhoto(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file || !task.value) return
  if (!sync.online) {
    await toast("Pas de réseau : prenez la photo plus tard, ou notez ce que vous avez vu.", 'warning')
    return
  }
  uploading.value = true
  try {
    await api.documents.upload('tasks', task.value.id, file, file.name || 'photo.jpg', `Photo — ${task.value.title}`)
    await toast('Photo ajoutée.')
  } catch (e) {
    await toast((e as Error).message, 'danger')
  } finally {
    uploading.value = false
  }
}
</script>

<template>
  <IonPage>
    <IonHeader>
      <IonToolbar>
        <IonButtons slot="start"><IonBackButton default-href="/taches" text="Retour" /></IonButtons>
        <IonTitle>{{ task?.title ?? 'Tâche' }}</IonTitle>
      </IonToolbar>
    </IonHeader>

    <IonContent>
      <div v-if="!task" class="ion-padding ion-text-center">
        <IonText color="medium"><p>Cette tâche n'est pas sur le téléphone.</p></IonText>
      </div>

      <template v-else>
        <div class="ion-padding head">
          <h2>{{ task.title }}</h2>
          <IonBadge :color="taskColor(task.status.value)">{{ task.status.label }}</IonBadge>
          <IonBadge v-if="task.priority.value === 'high'" color="danger">Urgente</IonBadge>
          <IonBadge v-if="task.is_overdue" color="danger">En retard</IonBadge>
        </div>

        <div v-if="task.can.progress" class="ion-padding-horizontal actions">
          <IonButton v-for="a in actions" :key="a.status" :color="a.color" @click="setStatus(a.status)">{{ a.label }}</IonButton>
          <IonButton v-if="auth.can('journals.create')" fill="outline" :router-link="{ name: 'journal-new', query: { task_id: task.id } }">Rédiger le rapport</IonButton>
          <IonButton v-if="task.project_id && auth.canAny(['sites.view', 'sites.view.own'])" fill="outline" :router-link="{ name: 'site', params: { projectId: task.project_id } }">Équipements du chantier</IonButton>
        </div>

        <IonList inset>
          <IonItem v-if="task.starts_at">
            <IonLabel>Quand</IonLabel>
            <IonNote slot="end">
              {{ new Date(task.starts_at).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }) }} {{ hours(task, day) }}
            </IonNote>
          </IonItem>
          <IonItem v-if="task.due_date">
            <IonLabel>Échéance</IonLabel>
            <IonNote slot="end" :color="task.is_overdue ? 'danger' : undefined">{{ new Date(`${task.due_date}T00:00:00`).toLocaleDateString('fr-FR') }}</IonNote>
          </IonItem>
          <IonItem v-if="task.project"><IonLabel>Projet</IonLabel><IonNote slot="end">{{ task.project.name }}</IonNote></IonItem>
          <IonItem v-if="task.client"><IonLabel>Client</IonLabel><IonNote slot="end">{{ task.client.name }}</IonNote></IonItem>
          <IonItem v-if="task.location ?? task.project?.address ?? task.client?.address">
            <IonLabel class="ion-text-wrap">
              <p>Lieu</p>
              <h3>{{ task.location ?? task.project?.address ?? task.client?.address }}</h3>
            </IonLabel>
          </IonItem>
          <IonItem v-if="mapUrl" :href="mapUrl" target="_blank" detail>
            <IonIcon slot="start" :icon="navigateOutline" color="primary" />
            <IonLabel>Itinéraire</IonLabel>
          </IonItem>
          <IonItem v-if="task.assignees?.length">
            <IonLabel>Avec</IonLabel>
            <IonNote slot="end">{{ task.assignees.map((a) => a.full_name).join(', ') }}</IonNote>
          </IonItem>
        </IonList>

        <IonList v-if="task.description" inset>
          <IonItem><IonLabel class="ion-text-wrap"><MarkdownView :text="task.description" /></IonLabel></IonItem>
        </IonList>

        <IonList v-if="task.subtasks.length" inset>
          <IonListHeader><IonLabel>Sous-tâches {{ task.subtasks_done }}/{{ task.subtasks_count }}</IonLabel></IonListHeader>
          <IonItem v-for="s in task.subtasks" :key="s.id">
            <IonCheckbox
              :checked="s.is_done"
              :disabled="!task.can.progress"
              label-placement="end"
              justify="start"
              @ion-change="store.toggleSubtask(task!, s.id, $event.detail.checked)"
            >
              <span :class="{ done: s.is_done }">{{ s.title }}</span>
            </IonCheckbox>
          </IonItem>
        </IonList>

        <IonList inset>
          <IonListHeader><IonLabel>Notes et photos</IonLabel></IonListHeader>
          <template v-if="task.can.progress">
            <IonItem>
              <IonTextarea v-model="note" placeholder="Ce qui a été fait, ce qui manque…" :auto-grow="true" autocapitalize="sentences" />
              <IonButton slot="end" fill="clear" :disabled="!note.trim()" @click="addNote">Ajouter</IonButton>
            </IonItem>
            <IonItem lines="none">
              <IonIcon slot="start" :icon="cameraOutline" color="primary" />
              <label class="photo">
                {{ uploading ? 'Envoi…' : 'Prendre une photo' }}
                <input type="file" accept="image/*" capture="environment" hidden :disabled="uploading" @change="onPhoto" />
              </label>
            </IonItem>
          </template>
          <IonItem v-for="p in pendingNotes" :key="p.id">
            <IonIcon slot="start" :icon="cloudOfflineOutline" color="medium" />
            <IonLabel class="ion-text-wrap"><p>{{ p.payload.body }}</p></IonLabel>
          </IonItem>
          <IonItem v-for="n in notes" :key="n.id">
            <IonLabel class="ion-text-wrap">
              <p>{{ n.body }}</p>
              <p><IonNote>{{ n.creator?.full_name }} · {{ n.created_at ? new Date(n.created_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '' }}</IonNote></p>
            </IonLabel>
          </IonItem>
        </IonList>
        <CommentsSection type="tasks" :id="task.id" />
      </template>
    </IonContent>
  </IonPage>
</template>

<style scoped>
.head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}

.head h2 {
  width: 100%;
  margin: 0;
}

.actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.done {
  text-decoration: line-through;
  color: var(--ion-color-medium);
}

.pre {
  white-space: pre-line;
}

.photo {
  color: var(--ion-color-primary);
  font-weight: 600;
  cursor: pointer;
}
</style>
