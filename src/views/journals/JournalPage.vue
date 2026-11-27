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
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonNote,
  IonPage,
  IonText,
  IonTitle,
  IonToolbar,
  IonIcon,
  actionSheetController,
  alertController,
  toastController,
  useIonRouter,
} from '@ionic/vue'
import { ellipsisHorizontal, locationOutline, mailOutline } from 'ionicons/icons'
import { journalHours } from '@/utils/journals'
import { useAuthStore } from '@/stores/auth'
import CommentsSection from '@/components/CommentsSection.vue'
import { openPhotos } from '@/utils/lightbox'
import type { Document } from '@dash4/shared'
import { api } from '@/services/api'
import { useJournalsStore } from '@/stores/journals'
import { useSyncStore } from '@/stores/sync'

/** Rapport d'intervention en lecture. */
const props = defineProps<{ id: string }>()
const store = useJournalsStore()
const sync = useSyncStore()
const journal = computed(() => store.find(Number(props.id)) ?? null)
const photos = ref<Array<{ name: string; url: string }>>([])
/** id de section → vignettes de ses photos. */
const sectionPhotos = ref<Record<number, Array<{ name: string; url: string }>>>({})
const images = (docs: Document[], max: number) => docs.filter((x) => x.mime_type?.startsWith('image/')).slice(0, max)
async function thumbs(docs: Document[]): Promise<Array<{ name: string; url: string }>> {
  const out: Array<{ name: string; url: string }> = []
  for (const d of docs) {
    const blob = await api.documents.download(d).catch(() => null)
    if (blob) out.push({ name: d.name, url: URL.createObjectURL(blob) })
  }
  return out
}

const auth = useAuthStore()
const ionRouter = useIonRouter()
const hours = computed(() => (journal.value ? journalHours(journal.value.starts_at, journal.value.ends_at) : null))
const mapUrl = computed(() => (journal.value?.latitude != null ? `https://www.google.com/maps?q=${journal.value.latitude},${journal.value.longitude}` : null))
const sentAt = (iso: string | null) => (iso ? new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '')

async function toast(message: string, color = 'dark'): Promise<void> {
  const t = await toastController.create({ message, duration: 2200, position: 'top', color })
  await t.present()
}

async function openPdf(): Promise<void> {
  if (!journal.value) return
  if (!sync.online) return void toast('Le PDF du rapport demande le réseau.', 'warning')
  try {
    const url = URL.createObjectURL(await api.journals.pdf(journal.value.id))
    window.open(url, '_blank')
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  } catch (e) {
    void toast((e as Error).message, 'danger')
  }
}

async function remove(): Promise<void> {
  const j = journal.value
  if (!j) return
  const alert = await alertController.create({
    header: 'Supprimer le rapport',
    message: `« ${j.title} » sera mis à la corbeille, avec ses photos.`,
    buttons: [{ text: 'Annuler', role: 'cancel' }, { text: 'Supprimer', role: 'destructive' }],
  })
  await alert.present()
  if ((await alert.onDidDismiss()).role !== 'destructive') return
  await store.remove(j)
  void toast(sync.online ? 'Rapport supprimé.' : 'Rapport supprimé : envoyé au retour du réseau.')
  ionRouter.navigate('/rapports', 'back', 'pop')
}

/** Actions du rapport selon les droits. */
async function actions(): Promise<void> {
  const j = journal.value
  if (!j) return
  const buttons: Array<{ text: string; role?: string; handler?: () => void }> = []
  if (j.can.update) buttons.push({ text: 'Modifier', handler: () => ionRouter.push(`/rapports/${j.id}/modifier`) })
  if (j.can.update) buttons.push({ text: 'Envoyer par e-mail', handler: () => ionRouter.push(`/rapports/${j.id}/envoyer`) })
  buttons.push({ text: 'Ouvrir le PDF', handler: () => void openPdf() })
  if (auth.can('journals.create')) buttons.push({ text: 'Dupliquer (nouveau rapport)', handler: () => ionRouter.push(`/rapports/nouveau?from=${j.id}`) })
  if (j.can.delete) buttons.push({ text: 'Supprimer', role: 'destructive', handler: () => void remove() })
  buttons.push({ text: 'Fermer', role: 'cancel' })
  const sheet = await actionSheetController.create({ header: j.title, buttons })
  await sheet.present()
}

onMounted(async () => {
  await store.load()
  if (!sync.online || !journal.value) return
  for (const s of journal.value.sections ?? []) {
    if (s.id && s.photos?.length) sectionPhotos.value = { ...sectionPhotos.value, [s.id]: await thumbs(images(s.photos, 9)) }
  }
  const docs: Document[] = await api.documents.list('journals', journal.value.id).catch(() => [])
  photos.value = await thumbs(images(docs, 12))
})
</script>

<template>
  <IonPage>
    <IonHeader>
      <IonToolbar>
        <IonButtons slot="start"><IonBackButton default-href="/rapports" text="Retour" /></IonButtons>
        <IonTitle>{{ journal?.title ?? 'Rapport' }}</IonTitle>
        <IonButtons v-if="journal" slot="end">
          <IonButton v-if="journal.can.update" :router-link="{ name: 'journal-edit', params: { id: journal.id } }">Modifier</IonButton>
          <IonButton aria-label="Actions" @click="actions"><IonIcon slot="icon-only" :icon="ellipsisHorizontal" /></IonButton>
        </IonButtons>
      </IonToolbar>
    </IonHeader>
    <IonContent>
      <div v-if="!journal" class="ion-padding ion-text-center"><IonText color="medium"><p>Ce rapport n'est pas sur le téléphone.</p></IonText></div>
      <template v-else>
        <div class="ion-padding">
          <h2 class="title">{{ journal.title }}</h2>
          <IonBadge color="medium">{{ journal.type.label }}</IonBadge>
          <IonNote> {{ journal.date ? new Date(`${journal.date}T00:00:00`).toLocaleDateString('fr-FR') : '' }}</IonNote>
        </div>
        <IonList inset>
          <IonItem v-if="journal.project"><IonLabel>Projet</IonLabel><IonNote slot="end">{{ journal.project.name }}</IonNote></IonItem>
          <IonItem v-if="journal.client"><IonLabel>Client</IonLabel><IonNote slot="end">{{ journal.client.name }}</IonNote></IonItem>
          <IonItem v-if="journal.task"><IonLabel>Tâche</IonLabel><IonNote slot="end">{{ journal.task.title }}</IonNote></IonItem>
          <IonItem v-if="hours"><IonLabel>Horaires</IonLabel><IonNote slot="end">{{ hours }}</IonNote></IonItem>
          <IonItem v-if="journal.creator"><IonLabel>Rédigé par</IonLabel><IonNote slot="end">{{ journal.creator.full_name }}</IonNote></IonItem>
          <IonItem v-if="mapUrl" :href="mapUrl" target="_blank" detail>
            <IonIcon slot="start" :icon="locationOutline" color="medium" /><IonLabel>Position de l'intervention</IonLabel>
          </IonItem>
        </IonList>
        <IonList v-if="journal.summary" inset>
          <IonListHeader><IonLabel>Résumé</IonLabel></IonListHeader>
          <IonItem><IonLabel class="ion-text-wrap"><MarkdownView :text="journal.summary" /></IonLabel></IonItem>
        </IonList>
        <IonList v-if="journal.participants?.length" inset>
          <IonListHeader><IonLabel>Intervenants</IonLabel></IonListHeader>
          <IonItem v-for="p in journal.participants" :key="p.id">
            <IonLabel class="ion-text-wrap"><h3>{{ p.name }}</h3><p v-if="p.role">{{ p.role }}</p></IonLabel>
            <IonNote slot="end">{{ { team: 'Équipe', contact: 'Client', other: 'Autre' }[p.kind] }}</IonNote>
          </IonItem>
        </IonList>
        <IonList v-for="s in journal.sections ?? []" :key="s.id ?? s.title" inset>
          <IonListHeader><IonLabel>{{ s.title }}</IonLabel></IonListHeader>
          <IonItem><IonLabel class="ion-text-wrap"><MarkdownView :text="s.body" /></IonLabel></IonItem>
          <div v-if="s.id && sectionPhotos[s.id]?.length" class="photos ion-padding">
            <img v-for="p in sectionPhotos[s.id]" :key="p.url" :src="p.url" :alt="p.name" @click="openPhotos(sectionPhotos[s.id]!, p.url)" />
          </div>
          <IonItem v-else-if="s.photos?.length && !sync.online" lines="none"><IonNote>{{ s.photos.length }} photo(s), visibles avec le réseau.</IonNote></IonItem>
        </IonList>
        <div v-if="photos.length" class="photos ion-padding">
          <img v-for="p in photos" :key="p.url" :src="p.url" :alt="p.name" @click="openPhotos(photos, p.url)" />
        </div>
        <p v-else-if="store.photosWaiting(journal.client_uuid, journal.id)" class="ion-padding"><IonNote>{{ store.photosWaiting(journal.client_uuid, journal.id) }} photo(s) en attente d'envoi.</IonNote></p>
        <IonList v-if="journal.emails?.length" inset>
          <IonListHeader><IonLabel>Envois par e-mail</IonLabel></IonListHeader>
          <IonItem v-for="e in journal.emails" :key="e.id">
            <IonIcon slot="start" :icon="mailOutline" color="medium" />
            <IonLabel class="ion-text-wrap"><h3>{{ e.to.join(', ') }}</h3><p>{{ [sentAt(e.sent_at), e.sender?.full_name].filter(Boolean).join(' · ') }}</p></IonLabel>
          </IonItem>
        </IonList>
        <CommentsSection type="journals" :id="journal.id" />
      </template>
    </IonContent>
  </IonPage>
</template>

<style scoped>
.title {
  margin: 0 0 0.5rem;
}

.pre {
  white-space: pre-line;
}

.photos {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.5rem;
}

.photos img {
  width: 100%;
  border-radius: 0.375rem;
}
</style>
