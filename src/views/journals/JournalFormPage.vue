<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
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
  toastController,
  useIonRouter,
} from '@ionic/vue'
import { cameraOutline, closeCircle } from 'ionicons/icons'
import { JOURNAL_TYPES, OPEN_TASK_STATUSES } from '@dash4/shared'
import { useJournalsStore } from '@/stores/journals'
import { useSyncStore } from '@/stores/sync'
import { useTasksStore } from '@/stores/tasks'
import { todayIso } from '@/utils/expenses'
import { openPhotos } from '@/utils/lightbox'
import { buildJournalPayload, sectionPositions, SECTION_TITLES, type JournalForm, type SectionKey } from '@/utils/journals'

/** Nouveau rapport d'intervention, depuis une tâche ou non ; photos et position facultatives. */
const store = useJournalsStore()
const tasks = useTasksStore()
const sync = useSyncStore()
const route = useRoute()
const ionRouter = useIonRouter()

const form = reactive<JournalForm>({ title: '', type: 'intervention', date: todayIso(), taskId: null, done: '', todo: '', remarks: '', latitude: null, longitude: null })
/** Photos prises pour une section, ou pour le rapport en général. */
type PhotoSlot = SectionKey | 'general'
const photos = ref<Array<{ file: File; url: string; slot: PhotoSlot }>>([])
const sectionKeys = Object.keys(SECTION_TITLES) as SectionKey[]
const ofSlot = (slot: PhotoSlot) => photos.value.filter((p) => p.slot === slot)
const withPosition = ref(false)
const locating = ref(false)
const error = ref<string | null>(null)
const saving = ref(false)
const myTasks = computed(() => tasks.mine.filter((t) => OPEN_TASK_STATUSES.includes(t.status.value) || t.id === form.taskId))

onMounted(async () => {
  await Promise.all([store.load(), tasks.load()])
  const taskId = Number(route.query.task_id)
  const task = taskId ? tasks.find(taskId) : undefined
  if (task) {
    form.taskId = task.id
    form.title = task.title
  }
})

function onTask(id: number | null): void {
  form.taskId = id
  const task = id ? tasks.find(id) : undefined
  if (task && !form.title.trim()) form.title = task.title
}

function onPhotos(event: Event, slot: PhotoSlot): void {
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
    form.latitude = null
    form.longitude = null
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
      form.latitude = Math.round(pos.coords.latitude * 1e7) / 1e7
      form.longitude = Math.round(pos.coords.longitude * 1e7) / 1e7
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
  const { payload, error: problem } = buildJournalPayload(form, todayIso())
  error.value = problem ?? null
  if (!payload) return
  saving.value = true
  try {
    // Photo d'une section laissée vide : elle va avec le rapport
    const positions = sectionPositions(form)
    await store.create(payload, photos.value.map((p) => ({ blob: p.file, section: p.slot === 'general' ? null : positions[p.slot] })))
    const toast = await toastController.create({
      message: sync.online ? 'Rapport envoyé.' : 'Rapport gardé sur le téléphone, envoyé avec ses photos dès le retour du réseau.',
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
        <IonButtons slot="start"><IonBackButton default-href="/rapports" text="Annuler" /></IonButtons>
        <IonTitle>Nouveau rapport</IonTitle>
        <IonButtons slot="end"><IonButton strong :disabled="saving" @click="save">Enregistrer</IonButton></IonButtons>
      </IonToolbar>
    </IonHeader>

    <IonContent>
      <form @submit.prevent="save">
        <IonList inset>
          <IonItem v-if="myTasks.length">
            <IonSelect :value="form.taskId" label="Tâche" label-placement="stacked" interface="action-sheet" cancel-text="Annuler" @ion-change="onTask($event.detail.value)">
              <IonSelectOption :value="null">Sans tâche</IonSelectOption>
              <IonSelectOption v-for="t in myTasks" :key="t.id" :value="t.id">{{ t.title }}</IonSelectOption>
            </IonSelect>
          </IonItem>
          <IonItem><IonInput v-model="form.title" label="Titre" label-placement="stacked" autocapitalize="sentences" /></IonItem>
          <IonItem>
            <IonSelect v-model="form.type" label="Type" label-placement="stacked" interface="action-sheet" cancel-text="Annuler">
              <IonSelectOption v-for="t in JOURNAL_TYPES" :key="t.value" :value="t.value">{{ t.label }}</IonSelectOption>
            </IonSelect>
          </IonItem>
          <IonItem><IonInput v-model="form.date" type="date" label="Date" label-placement="stacked" :max="todayIso()" /></IonItem>
        </IonList>

        <IonList v-for="key in sectionKeys" :key="key" inset>
          <IonItem><IonTextarea v-model="form[key]" :label="SECTION_TITLES[key]" label-placement="stacked" :auto-grow="true" :rows="key === 'done' ? 3 : 1" autocapitalize="sentences" /></IonItem>
          <div v-if="ofSlot(key).length" class="photos">
            <div v-for="p in ofSlot(key)" :key="p.url" class="photo">
              <img :src="p.url" alt="" @click="openPhotos(photos, p.url)" />
              <IonButton fill="clear" size="small" color="danger" aria-label="Retirer" @click="removePhoto(p.url)"><IonIcon slot="icon-only" :icon="closeCircle" /></IonButton>
            </div>
          </div>
          <IonItem lines="none">
            <label class="photo-button small">
              <IonIcon :icon="cameraOutline" /> Photo
              <input type="file" accept="image/*" capture="environment" hidden @change="onPhotos($event, key)" />
            </label>
            <label slot="end" class="photo-button small">
              Galerie
              <input type="file" accept="image/*" multiple hidden @change="onPhotos($event, key)" />
            </label>
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
            <IonToggle :checked="withPosition" :disabled="locating" @ion-change="togglePosition($event.detail.checked)">Ajouter ma position</IonToggle>
          </IonItem>
          <IonItem v-if="form.latitude !== null" lines="none"><IonNote>{{ form.latitude }}, {{ form.longitude }}</IonNote></IonItem>
        </IonList>

        <div v-if="error" class="ion-padding-horizontal"><IonText color="danger"><p>{{ error }}</p></IonText></div>
        <div class="ion-padding"><IonButton expand="block" type="submit" :disabled="saving">Enregistrer le rapport</IonButton></div>
      </form>
    </IonContent>
  </IonPage>
</template>

<style scoped>
.photos {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.5rem;
  padding: 0 1rem;
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

.photos {
  padding-top: 0.5rem;
}
</style>
