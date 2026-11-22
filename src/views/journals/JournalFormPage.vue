<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonNote,
  IonPage,
  IonSelect,
  IonSelectOption,
  IonText,
  IonTextarea,
  IonTitle,
  IonToggle,
  IonToolbar,
  alertController,
  toastController,
  useIonRouter,
} from '@ionic/vue'
import { add, cameraOutline, closeCircle, trashOutline } from 'ionicons/icons'
import { JOURNAL_TYPES, OPEN_TASK_STATUSES, type Journal } from '@dash4/shared'
import { useAuthStore } from '@/stores/auth'
import { useClientsStore } from '@/stores/clients'
import { useJournalsStore } from '@/stores/journals'
import { useProjectsStore } from '@/stores/projects'
import { useSyncStore } from '@/stores/sync'
import { useTasksStore } from '@/stores/tasks'
import { todayIso } from '@/utils/expenses'
import { openPhotos } from '@/utils/lightbox'
import SearchSelect from '@/components/SearchSelect.vue'
import {
  addParticipant,
  buildJournalPayload,
  journalProjectOptions,
  journalToForm,
  newJournalForm,
  sectionPositions,
  type JournalForm,
  type ParticipantDraft,
} from '@/utils/journals'

/**
 * Rapport d'intervention : nouveau (depuis une tâche ou non) ou modification d'un rapport existant.
 * Lié à un projet, avec ses intervenants (équipe, contacts du client ou noms libres), photos et position.
 * Tout marche hors ligne : l'envoi part au retour du réseau.
 */
const props = defineProps<{ id?: string }>()
const auth = useAuthStore()
const store = useJournalsStore()
const tasks = useTasksStore()
const projects = useProjectsStore()
const clients = useClientsStore()
const sync = useSyncStore()
const route = useRoute()
const ionRouter = useIonRouter()

const editing = ref<Journal | null>(null)
const form = ref<JournalForm>(newJournalForm(todayIso()))
/** Photos prises pour une section (par sa clé) ou pour le rapport en général. */
const photos = ref<Array<{ file: File; url: string; slot: string }>>([])
const ofSlot = (slot: string) => photos.value.filter((p) => p.slot === slot)
const withPosition = ref(false)
const locating = ref(false)
const error = ref<string | null>(null)
const saving = ref(false)
const notFound = ref(false)

const myTasks = computed(() => tasks.mine.filter((t) => OPEN_TASK_STATUSES.includes(t.status.value) || t.id === form.value.taskId))
const projectOptions = computed(() =>
  journalProjectOptions([
    projects.items.filter((p) => !p.deleted_at).map((p) => ({ id: p.id, name: p.name })),
    tasks.all.map((t) => t.project),
    store.items.map((j) => j.project),
  ]),
)
const projectOf = (id: number | null) => (id ? (projectOptions.value.find((p) => p.id === id) ?? null) : null)

// Intervenants : équipe, contacts du client du projet (gestionnaires), noms libres
const clientId = computed(() => {
  const p = form.value.projectId ? projects.items.find((x) => x.id === form.value.projectId) : undefined
  return p?.client_id ?? (form.value.taskId ? tasks.find(form.value.taskId)?.client_id : null) ?? null
})
const teamOptions = computed(() => store.team.filter((u) => !form.value.participants.some((p) => p.user_id === u.id)))
const contactOptions = computed(() =>
  clientId.value ? clients.contacts.filter((c) => c.client_id === clientId.value && !form.value.participants.some((p) => p.contact_id === c.id)) : [],
)
const freeName = ref('')
function addTeam(id: number | null): void {
  const u = store.team.find((x) => x.id === id)
  if (u) form.value.participants = addParticipant(form.value.participants, { user_id: u.id, contact_id: null, name: u.full_name, role: u.job_title ?? '', kind: 'team' })
}
function addContact(id: number | null): void {
  const c = clients.contacts.find((x) => x.id === id)
  if (c) form.value.participants = addParticipant(form.value.participants, { user_id: null, contact_id: c.id, name: c.full_name, role: c.job_title ?? '', kind: 'contact' })
}
function addFree(): void {
  form.value.participants = addParticipant(form.value.participants, { user_id: null, contact_id: null, name: freeName.value, role: '', kind: 'other' })
  freeName.value = ''
}
function removeParticipant(p: ParticipantDraft): void {
  form.value.participants = form.value.participants.filter((x) => x.key !== p.key)
}
const kindLabel = { team: 'Équipe', contact: 'Client', other: 'Autre' } as const

onMounted(async () => {
  await Promise.all([store.load(), tasks.load(), projects.load().catch(() => undefined), clients.load().catch(() => undefined)])
  void store.loadTeam()
  if (props.id) {
    const journal = store.find(Number(props.id))
    if (!journal) {
      notFound.value = true
      return
    }
    editing.value = journal
    form.value = journalToForm(journal)
    withPosition.value = journal.latitude !== null
    return
  }
  // Nouveau rapport : l'auteur est intervenant d'office ; depuis une tâche, son projet et ses intervenants
  if (auth.user) form.value.participants = addParticipant([], { user_id: auth.user.id, contact_id: null, name: auth.user.full_name, role: '', kind: 'team' })
  const projectId = Number(route.query.project_id)
  if (projectId) form.value.projectId = projectId
  const taskId = Number(route.query.task_id)
  if (taskId) onTask(taskId)
})

function onTask(id: number | null): void {
  form.value.taskId = id
  const task = id ? tasks.find(id) : undefined
  if (!task) return
  if (!form.value.title.trim()) form.value.title = task.title
  if (task.project_id) form.value.projectId = task.project_id
  for (const a of task.assignees ?? []) {
    form.value.participants = addParticipant(form.value.participants, { user_id: a.id, contact_id: null, name: a.full_name, role: '', kind: 'team' })
  }
}

// Sections : les habituelles, celles du rapport, et d'autres à ajouter
const newSectionTitle = ref('')
function addSection(): void {
  const title = newSectionTitle.value.trim()
  if (!title) return
  form.value.sections.push({ key: `new-${Date.now()}`, title, body: '' })
  newSectionTitle.value = ''
}
async function removeSection(key: string): Promise<void> {
  const section = form.value.sections.find((s) => s.key === key)
  if (!section) return
  if (section.id) {
    const alert = await alertController.create({
      header: 'Retirer la section',
      message: `« ${section.title} » et ses photos seront supprimées à l'enregistrement.`,
      buttons: [{ text: 'Annuler', role: 'cancel' }, { text: 'Retirer', role: 'destructive' }],
    })
    await alert.present()
    if ((await alert.onDidDismiss()).role !== 'destructive') return
  }
  form.value.sections = form.value.sections.filter((s) => s.key !== key)
  photos.value = photos.value.filter((p) => p.slot !== key)
}
/** En modification, une photo va dans une section déjà enregistrée (ou avec le rapport). */
const canPhoto = (s: { id?: number }) => !editing.value || !!s.id

function onPhotos(event: Event, slot: string): void {
  const input = event.target as HTMLInputElement
  for (const file of Array.from(input.files ?? [])) photos.value.push({ file, url: URL.createObjectURL(file), slot })
  input.value = ''
}
function removePhoto(url: string): void {
  URL.revokeObjectURL(url)
  photos.value = photos.value.filter((p) => p.url !== url)
}

function togglePosition(on: boolean): void {
  withPosition.value = on
  if (!on) {
    form.value.latitude = null
    form.value.longitude = null
    return
  }
  if (!navigator.geolocation) {
    error.value = "La position n'est pas disponible sur ce téléphone."
    withPosition.value = false
    return
  }
  locating.value = true
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      form.value.latitude = Math.round(pos.coords.latitude * 1e7) / 1e7
      form.value.longitude = Math.round(pos.coords.longitude * 1e7) / 1e7
      locating.value = false
    },
    () => {
      error.value = 'Position refusée ou introuvable.'
      withPosition.value = false
      locating.value = false
    },
    { enableHighAccuracy: true, timeout: 20000 },
  )
}

async function save(): Promise<void> {
  const { payload, error: problem } = buildJournalPayload(form.value, todayIso())
  error.value = problem ?? null
  if (!payload) return
  if (editing.value && !withPosition.value) Object.assign(payload, { latitude: null, longitude: null })
  saving.value = true
  try {
    if (editing.value) {
      const journal = editing.value
      const sectionId = (key: string) => form.value.sections.find((s) => s.key === key)?.id
      await store.update(
        journal,
        payload,
        projectOf(form.value.projectId),
        form.value.participants,
        photos.value.map((p) => (p.slot !== 'general' && sectionId(p.slot) ? { blob: p.file, type: 'journal-sections' as const, id: sectionId(p.slot)! } : { blob: p.file, type: 'journals' as const, id: journal.id })),
      )
    } else {
      // Photo d'une section laissée vide : elle va avec le rapport
      const positions = sectionPositions(form.value)
      await store.create(payload, photos.value.map((p) => ({ blob: p.file, section: p.slot === 'general' ? null : (positions[p.slot] ?? null) })))
    }
    const toast = await toastController.create({
      message: sync.online
        ? editing.value ? 'Rapport modifié.' : 'Rapport envoyé.'
        : 'Gardé sur le téléphone, envoyé avec ses photos dès le retour du réseau.',
      duration: 3000,
      position: 'top',
    })
    await toast.present()
    ionRouter.back()
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <IonPage>
    <IonHeader>
      <IonToolbar>
        <IonButtons slot="start"><IonBackButton :default-href="props.id ? `/rapports/${props.id}` : '/rapports'" text="Annuler" /></IonButtons>
        <IonTitle>{{ props.id ? 'Modifier le rapport' : 'Nouveau rapport' }}</IonTitle>
        <IonButtons slot="end"><IonButton strong :disabled="saving || notFound" @click="save">Enregistrer</IonButton></IonButtons>
      </IonToolbar>
    </IonHeader>

    <IonContent>
      <p v-if="notFound" class="ion-padding"><IonText color="medium">Ce rapport n'est pas sur le téléphone : ouvrez la liste des rapports avec le réseau.</IonText></p>
      <form v-else @submit.prevent="save">
        <IonList inset>
          <IonItem v-if="myTasks.length && !editing">
            <IonSelect :value="form.taskId" label="Tâche" label-placement="stacked" interface="action-sheet" cancel-text="Annuler" @ion-change="onTask($event.detail.value)">
              <IonSelectOption :value="null">Sans tâche</IonSelectOption>
              <IonSelectOption v-for="t in myTasks" :key="t.id" :value="t.id">{{ t.title }}</IonSelectOption>
            </IonSelect>
          </IonItem>
          <SearchSelect v-model="form.projectId" label="Projet *" placeholder="Choisir le projet" :options="projectOptions.map((p) => ({ value: p.id, label: p.name }))" />
          <IonItem v-if="!projectOptions.length" lines="none">
            <IonNote>Aucun projet sur le téléphone : ouvrez vos tâches ou vos projets avec le réseau.</IonNote>
          </IonItem>
          <IonItem><IonInput v-model="form.title" label="Titre" label-placement="stacked" autocapitalize="sentences" /></IonItem>
          <IonItem>
            <IonSelect v-model="form.type" label="Type" label-placement="stacked" interface="action-sheet" cancel-text="Annuler">
              <IonSelectOption v-for="t in JOURNAL_TYPES" :key="t.value" :value="t.value">{{ t.label }}</IonSelectOption>
            </IonSelect>
          </IonItem>
          <IonItem><IonInput v-model="form.date" type="date" label="Date" label-placement="stacked" :max="todayIso()" /></IonItem>
        </IonList>

        <IonList inset>
          <IonListHeader><IonLabel>Intervenants</IonLabel></IonListHeader>
          <IonItem v-for="p in form.participants" :key="p.key">
            <IonLabel class="ion-text-wrap">
              <h3>{{ p.name }}</h3>
              <p>{{ kindLabel[p.kind] }}</p>
            </IonLabel>
            <IonInput v-model="p.role" slot="end" class="role" placeholder="Rôle" aria-label="Rôle" />
            <IonButton slot="end" fill="clear" color="danger" aria-label="Retirer" @click="removeParticipant(p)"><IonIcon slot="icon-only" :icon="closeCircle" /></IonButton>
          </IonItem>
          <SearchSelect
            v-if="teamOptions.length"
            action
            label="Ajouter un membre de l'équipe"
            placeholder="Choisir…"
            :options="teamOptions.map((u) => ({ value: u.id, label: u.full_name, detail: u.job_title }))"
            @select="addTeam"
          />
          <SearchSelect
            v-if="contactOptions.length"
            action
            label="Ajouter un contact du client"
            placeholder="Choisir…"
            :options="contactOptions.map((c) => ({ value: c.id, label: c.full_name, detail: c.job_title }))"
            @select="addContact"
          />
          <IonItem>
            <IonInput v-model="freeName" label="Autre intervenant (nom)" label-placement="stacked" placeholder="Sous-traitant, gardien…" @keyup.enter="addFree" />
            <IonButton slot="end" fill="clear" :disabled="!freeName.trim()" aria-label="Ajouter l'intervenant" @click="addFree"><IonIcon slot="icon-only" :icon="add" /></IonButton>
          </IonItem>
        </IonList>

        <IonList v-for="s in form.sections" :key="s.key" inset>
          <IonItem>
            <IonInput v-model="s.title" class="section-title" aria-label="Titre de la section" />
            <IonButton slot="end" fill="clear" color="medium" aria-label="Retirer la section" @click="removeSection(s.key)"><IonIcon slot="icon-only" :icon="trashOutline" /></IonButton>
          </IonItem>
          <IonItem><IonTextarea v-model="s.body" :auto-grow="true" :rows="s.key === 'done' ? 3 : 2" autocapitalize="sentences" :aria-label="s.title" placeholder="…" /></IonItem>
          <div v-if="ofSlot(s.key).length" class="photos">
            <div v-for="p in ofSlot(s.key)" :key="p.url" class="photo">
              <img :src="p.url" alt="" @click="openPhotos(photos, p.url)" />
              <IonButton fill="clear" size="small" color="danger" aria-label="Retirer" @click="removePhoto(p.url)"><IonIcon slot="icon-only" :icon="closeCircle" /></IonButton>
            </div>
          </div>
          <IonItem v-if="canPhoto(s)" lines="none">
            <label class="photo-button small">
              <IonIcon :icon="cameraOutline" /> Photo
              <input type="file" accept="image/*" capture="environment" hidden @change="onPhotos($event, s.key)" />
            </label>
            <label slot="end" class="photo-button small">
              Galerie
              <input type="file" accept="image/*" multiple hidden @change="onPhotos($event, s.key)" />
            </label>
          </IonItem>
          <IonItem v-else lines="none"><IonNote>Photos possibles une fois la section enregistrée.</IonNote></IonItem>
        </IonList>

        <IonList inset>
          <IonItem>
            <IonInput v-model="newSectionTitle" label="Ajouter une section" label-placement="stacked" placeholder="Matériel posé, mesures…" @keyup.enter="addSection" />
            <IonButton slot="end" fill="clear" :disabled="!newSectionTitle.trim()" aria-label="Ajouter la section" @click="addSection"><IonIcon slot="icon-only" :icon="add" /></IonButton>
          </IonItem>
        </IonList>

        <IonList inset>
          <IonListHeader><IonLabel>Autres photos</IonLabel></IonListHeader>
          <div class="photos">
            <div v-for="p in ofSlot('general')" :key="p.url" class="photo">
              <img :src="p.url" alt="" @click="openPhotos(photos, p.url)" />
              <IonButton fill="clear" size="small" color="danger" aria-label="Retirer" @click="removePhoto(p.url)"><IonIcon slot="icon-only" :icon="closeCircle" /></IonButton>
            </div>
          </div>
          <IonItem lines="none">
            <label class="photo-button">
              Prendre une photo
              <input type="file" accept="image/*" capture="environment" hidden @change="onPhotos($event, 'general')" />
            </label>
            <label slot="end" class="photo-button">
              Galerie
              <input type="file" accept="image/*" multiple hidden @change="onPhotos($event, 'general')" />
            </label>
          </IonItem>
          <IonItem>
            <IonToggle :checked="withPosition" :disabled="locating" @ion-change="togglePosition($event.detail.checked)">{{ editing ? 'Position du rapport' : 'Ajouter ma position' }}</IonToggle>
          </IonItem>
          <IonItem v-if="form.latitude !== null" lines="none"><IonNote>{{ form.latitude }}, {{ form.longitude }}</IonNote></IonItem>
        </IonList>

        <div v-if="error" class="ion-padding-horizontal"><IonText color="danger"><p>{{ error }}</p></IonText></div>
        <div class="ion-padding"><IonButton expand="block" type="submit" :disabled="saving">{{ editing ? 'Enregistrer les modifications' : 'Enregistrer le rapport' }}</IonButton></div>
      </form>
    </IonContent>
  </IonPage>
</template>

<style scoped>
.photos {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem;
  padding: 0.5rem 1rem 0;
}

.photo {
  position: relative;
}

.photo img {
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
  border-radius: 0.375rem;
}

.photo ion-button {
  position: absolute;
  top: -0.5rem;
  right: -0.5rem;
}

.photo-button {
  color: var(--ion-color-primary);
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}

.photo-button.small {
  font-size: 0.9rem;
}

.section-title {
  font-weight: 600;
}

.role {
  max-width: 7.5rem;
  text-align: right;
  font-size: 0.9rem;
}
</style>
