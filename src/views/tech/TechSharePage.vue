<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import {
  IonBackButton,
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
import { api } from '@/services/api'
import { useSyncStore } from '@/stores/sync'
import { useTechSpaceStore } from '@/stores/techSpace'
import { expiresIn } from '@/utils/techSpace'

/**
 * Une information temporaire : texte lisible hors ligne ; les fichiers s'ouvrent avec le réseau
 * (ils ne sont pas gardés sur le téléphone). Ouverte par un destinataire : marquée lue.
 */
const props = defineProps<{ id: string }>()
const store = useTechSpaceStore()
const sync = useSyncStore()
const share = computed(() => store.findShare(Number(props.id)) ?? null)
const opening = ref<number | null>(null)

onMounted(async () => {
  await store.load()
  if (share.value) await store.markRead(share.value.id)
})
// Expirée pendant la consultation : elle disparaît de l'écran
watch(() => store.now, () => void store.purge())

async function openFile(doc: { id: number; name: string; download_path: string }): Promise<void> {
  opening.value = doc.id
  try {
    const url = URL.createObjectURL(await api.documents.download(doc))
    window.open(url, '_blank')
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  } finally {
    opening.value = null
  }
}
</script>

<template>
  <IonPage>
    <IonHeader>
      <IonToolbar>
        <IonButtons slot="start"><IonBackButton default-href="/acces" text="Retour" /></IonButtons>
        <IonTitle>{{ share?.title ?? 'Information' }}</IonTitle>
      </IonToolbar>
    </IonHeader>
    <IonContent>
      <div v-if="!share" class="ion-padding ion-text-center"><IonText color="medium"><p>Cette information a expiré ou n'est plus disponible.</p></IonText></div>
      <template v-else>
        <div class="ion-padding">
          <IonNote>{{ share.category.label }} · expire {{ expiresIn(share, store.now) }}</IonNote>
          <div v-if="share.content" class="content">{{ share.content }}</div>
          <p v-else><IonText color="medium">Pas de texte.</IonText></p>
        </div>
        <IonList inset>
          <IonItem v-if="share.task"><IonLabel>Tâche</IonLabel><IonNote slot="end">{{ share.task.title }}</IonNote></IonItem>
          <IonItem v-else-if="share.project"><IonLabel>Projet</IonLabel><IonNote slot="end">{{ share.project.name }}</IonNote></IonItem>
          <IonItem v-if="share.creator"><IonLabel>Envoyée par</IonLabel><IonNote slot="end">{{ share.creator.full_name }}</IonNote></IonItem>
        </IonList>
        <IonList v-if="share.files?.length" inset>
          <IonListHeader><IonLabel>Fichiers</IonLabel></IonListHeader>
          <IonItem v-for="f in share.files" :key="f.id" button :disabled="!sync.online || opening === f.id" @click="openFile(f)">
            <IonLabel>{{ f.name }}</IonLabel>
            <IonNote v-if="!sync.online" slot="end">avec le réseau</IonNote>
          </IonItem>
        </IonList>
        <IonList v-if="share.recipients?.length && !share.is_recipient" inset>
          <IonListHeader><IonLabel>Destinataires</IonLabel></IonListHeader>
          <IonItem v-for="r in share.recipients" :key="r.id"><IonLabel>{{ r.full_name }}</IonLabel><IonNote slot="end">{{ r.read_at ? 'lu' : 'pas encore lu' }}</IonNote></IonItem>
        </IonList>
      </template>
    </IonContent>
  </IonPage>
</template>

<style scoped>
.content {
  margin-top: 0.75rem;
  padding: 1rem;
  border-radius: 0.5rem;
  background: var(--ion-color-light);
  font-family: ui-monospace, monospace;
  font-size: 1.1rem;
  white-space: pre-wrap;
  user-select: text;
}
</style>
