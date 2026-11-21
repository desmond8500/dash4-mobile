<script setup lang="ts">
import MarkdownView from '@/components/MarkdownView.vue'
import { computed, onMounted, ref } from 'vue'
import {
  IonBackButton,
  IonBadge,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonNote,
  IonPage,
  IonSpinner,
  IonText,
  IonTextarea,
  IonTitle,
  IonToolbar,
  toastController,
} from '@ionic/vue'
import { useAuthStore } from '@/stores/auth'
import CommentsSection from '@/components/CommentsSection.vue'
import {
  cloudUploadOutline,
  documentOutline,
  linkOutline,
  navigateOutline,
  pinOutline,
} from 'ionicons/icons'
import type { Document } from '@dash4/shared'
import { api } from '@/services/api'
import { useProjectsStore } from '@/stores/projects'
import { useSyncStore } from '@/stores/sync'
import ClientLogo from '@/components/ClientLogo.vue'
import QuoteList from '@/components/QuoteList.vue'
import { useQuotesStore } from '@/stores/quotes'
import { directionsUrl, fileSize, periodLabel, projectStatusColor } from '@/utils/projects'

const props = defineProps<{ id: string }>()
const auth = useAuthStore()
const store = useProjectsStore()
const sync = useSyncStore()

const projectId = computed(() => Number(props.id))
const project = computed(() => store.find(projectId.value))
const pendingNotes = computed(() => store.pendingNotes(projectId.value))
const quotes = useQuotesStore()
const projectQuotes = computed(() => quotes.ofProject(projectId.value))
const route = computed(() =>
  project.value ? directionsUrl(project.value.latitude, project.value.longitude, project.value.address) : null,
)

const newNote = ref('')
const saving = ref(false)

// Documents : seulement avec le réseau (fichiers privés, non copiés sur le téléphone)
const documents = ref<Document[] | null>(null)
const documentsError = ref<string | null>(null)
const opening = ref<number | null>(null)

async function loadDocuments(): Promise<void> {
  documentsError.value = null
  try {
    documents.value = await api.documents.list('projects', projectId.value)
  } catch {
    documentsError.value = 'Documents disponibles seulement avec le réseau.'
  }
}

async function openDocument(doc: Document): Promise<void> {
  opening.value = doc.id
  try {
    const blob = await api.documents.download(doc)
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank')
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  } catch (e) {
    const toast = await toastController.create({ message: (e as Error).message, duration: 3000, position: 'top', color: 'danger' })
    await toast.present()
  } finally {
    opening.value = null
  }
}

async function addNote(): Promise<void> {
  const body = newNote.value.trim()
  if (!body) return
  saving.value = true
  try {
    await store.addNote(projectId.value, body)
    newNote.value = ''
    const toast = await toastController.create({
      message: sync.online ? 'Note ajoutée.' : 'Note enregistrée sur le téléphone, envoyée dès le retour du réseau.',
      duration: 2000,
      position: 'top',
    })
    await toast.present()
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  await store.load()
  if (project.value) void loadDocuments()
  void quotes.load().then(() => quotes.refresh()).catch(() => undefined)
})
</script>

<template>
  <IonPage>
    <IonHeader>
      <IonToolbar>
        <IonButtons slot="start">
          <IonBackButton default-href="/projets" text="Projets" />
        </IonButtons>
        <IonTitle>{{ project?.name ?? 'Projet' }}</IonTitle>
      </IonToolbar>
    </IonHeader>

    <IonContent>
      <div v-if="!project" class="ion-padding ion-text-center">
        <IonText color="medium"><p>Ce projet n'est pas disponible sur le téléphone.</p></IonText>
      </div>

      <template v-else>
        <IonList inset>
          <IonItem>
            <ClientLogo slot="start" :name="project.name" :url="project.logo_url" :size="56" />
            <IonLabel class="ion-text-wrap">
              <h1>{{ project.name }}</h1>
              <p>{{ project.client?.name }}</p>
            </IonLabel>
            <IonBadge slot="end" :color="projectStatusColor(project.status.value)">{{ project.status.label }}</IonBadge>
          </IonItem>
          <IonItem v-if="auth.canAny(['sites.view', 'sites.view.own'])" :router-link="{ name: 'site', params: { projectId: project.id } }" detail>
            <IonLabel>Chantier : systèmes et équipements</IonLabel>
          </IonItem>
          <IonItem v-if="project.client" :router-link="{ name: 'client', params: { id: project.client.id } }" detail>
            <IonLabel>Fiche du client</IonLabel>
          </IonItem>
          <IonItem v-if="project.manager">
            <IonLabel>Chef de projet</IonLabel>
            <IonNote slot="end">{{ project.manager.full_name }}</IonNote>
          </IonItem>
          <IonItem v-if="project.start_date || project.end_date">
            <IonLabel>Période</IonLabel>
            <IonNote slot="end">{{ periodLabel(project.start_date, project.end_date) }}</IonNote>
          </IonItem>
          <IonItem v-if="route" :href="route" target="_blank" detail>
            <IonIcon slot="start" :icon="navigateOutline" color="primary" aria-hidden="true" />
            <IonLabel class="ion-text-wrap">{{ project.address || 'Itinéraire vers le chantier' }}</IonLabel>
          </IonItem>
          <IonItem v-if="project.description">
            <IonLabel class="ion-text-wrap"><MarkdownView :text="project.description" /></IonLabel>
          </IonItem>
        </IonList>

        <IonList inset>
          <IonListHeader><IonLabel>Notes</IonLabel></IonListHeader>
          <template v-if="project.can_update">
            <IonItem>
              <IonTextarea v-model="newNote" placeholder="Ajouter une note (même sans réseau)" :auto-grow="true" />
            </IonItem>
            <IonItem v-if="newNote.trim()" lines="none">
              <IonButton slot="end" :disabled="saving" @click="addNote">Ajouter</IonButton>
            </IonItem>
          </template>
          <IonItem v-for="item in pendingNotes" :key="item.id">
            <IonIcon slot="start" :icon="cloudUploadOutline" color="warning" aria-hidden="true" />
            <IonLabel class="ion-text-wrap">
              <MarkdownView class="body" :text="String(item.payload.body ?? '')" />
              <p>{{ item.lastError ?? "En attente d'envoi" }}</p>
            </IonLabel>
          </IonItem>
          <IonItem v-for="note in project.notes ?? []" :key="note.id">
            <IonIcon v-if="note.is_pinned" slot="start" :icon="pinOutline" color="primary" aria-label="Épinglée" />
            <IonLabel class="ion-text-wrap">
              <MarkdownView class="body" :text="note.body" />
              <p>
                {{ note.creator?.full_name ?? '—' }} ·
                {{ note.created_at ? new Date(note.created_at).toLocaleDateString('fr-FR') : '' }}
              </p>
            </IonLabel>
          </IonItem>
          <IonItem v-if="!(project.notes ?? []).length && !pendingNotes.length">
            <IonLabel color="medium">Aucune note.</IonLabel>
          </IonItem>
        </IonList>

        <QuoteList :quotes="projectQuotes" />

        <IonList v-if="(project.links ?? []).length" inset>
          <IonListHeader><IonLabel>Liens</IonLabel></IonListHeader>
          <IonItem v-for="link in project.links" :key="link.id" :href="link.url" target="_blank" rel="noopener noreferrer" detail>
            <IonIcon slot="start" :icon="linkOutline" aria-hidden="true" />
            <IonLabel class="ion-text-wrap">{{ link.label || link.url }}</IonLabel>
          </IonItem>
        </IonList>

        <IonList inset>
          <IonListHeader><IonLabel>Documents</IonLabel></IonListHeader>
          <IonItem v-if="documentsError">
            <IonLabel color="medium" class="ion-text-wrap">{{ documentsError }}</IonLabel>
            <IonButton slot="end" fill="clear" @click="loadDocuments">Réessayer</IonButton>
          </IonItem>
          <IonItem v-else-if="documents === null">
            <IonSpinner name="crescent" />
          </IonItem>
          <template v-else>
            <IonItem v-for="doc in documents" :key="doc.id" button :disabled="opening === doc.id" @click="openDocument(doc)">
              <IonIcon slot="start" :icon="documentOutline" aria-hidden="true" />
              <IonLabel class="ion-text-wrap">
                <h3>{{ doc.name }}</h3>
                <p>{{ fileSize(doc.size) }}</p>
              </IonLabel>
              <IonSpinner v-if="opening === doc.id" slot="end" name="crescent" />
            </IonItem>
            <IonItem v-if="!documents.length">
              <IonLabel color="medium">Aucun document.</IonLabel>
            </IonItem>
          </template>
        </IonList>
        <CommentsSection type="projects" :id="project.id" />
      </template>
    </IonContent>
  </IonPage>
</template>

<style scoped>
.pre {
  white-space: pre-line;
}

.body {
  color: var(--ion-text-color);
}
</style>
