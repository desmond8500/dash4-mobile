<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  IonBackButton,
  IonBadge,
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
} from '@ionic/vue'
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
          <IonItem v-if="journal.participants?.length">
            <IonLabel class="ion-text-wrap"><p>Intervenants</p><h3>{{ journal.participants.map((p) => p.name).join(', ') }}</h3></IonLabel>
          </IonItem>
        </IonList>
        <IonList v-for="s in journal.sections ?? []" :key="s.id ?? s.title" inset>
          <IonListHeader><IonLabel>{{ s.title }}</IonLabel></IonListHeader>
          <IonItem><IonLabel class="ion-text-wrap pre">{{ s.body }}</IonLabel></IonItem>
          <div v-if="s.id && sectionPhotos[s.id]?.length" class="photos ion-padding">
            <img v-for="p in sectionPhotos[s.id]" :key="p.url" :src="p.url" :alt="p.name" />
          </div>
          <IonItem v-else-if="s.photos?.length && !sync.online" lines="none"><IonNote>{{ s.photos.length }} photo(s), visibles avec le réseau.</IonNote></IonItem>
        </IonList>
        <div v-if="photos.length" class="photos ion-padding">
          <img v-for="p in photos" :key="p.url" :src="p.url" :alt="p.name" />
        </div>
        <p v-else-if="store.photosWaiting(journal.client_uuid)" class="ion-padding"><IonNote>{{ store.photosWaiting(journal.client_uuid) }} photo(s) en attente d'envoi.</IonNote></p>
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
