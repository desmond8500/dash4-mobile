<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonPage,
  IonSegment,
  IonSegmentButton,
  IonSpinner,
  IonTitle,
  IonToolbar,
  toastController,
} from '@ionic/vue'
import { documentOutline, linkOutline } from 'ionicons/icons'
import { ApiError, type Document, type Link, type Note } from '@dash4/shared'
import { api } from '@/services/api'
import { kv } from '@/offline/db'
import { plain } from '@/offline/collection'
import MarkdownView from '@/components/MarkdownView.vue'

/**
 * Documentation d'un article du stock (fiche technique, notice, liens, notes) depuis un équipement du chantier,
 * en lecture, techniciens compris. Liens et notes restent lisibles hors ligne ; les documents s'ouvrent avec le réseau.
 */
const props = defineProps<{ id: string }>()
const articleId = computed(() => Number(props.id))
const name = ref<string>((history.state?.articleName as string | undefined) ?? 'Article')
const tab = ref<'documents' | 'links' | 'notes'>('documents')

const documents = ref<Document[] | null>(null)
const links = ref<Link[]>([])
const notes = ref<Note[]>([])
const offline = ref(false)
const opening = ref<number | null>(null)
const key = () => `articleDocs.${articleId.value}`

onMounted(async () => {
  try {
    const [article, d, l, n] = await Promise.all([
      api.articles.get(articleId.value),
      api.documents.list('articles', articleId.value),
      api.links.list('articles', articleId.value),
      api.notes.list('articles', articleId.value),
    ])
    name.value = article.designation
    documents.value = d
    links.value = l
    notes.value = n
    await kv.set(key(), plain({ name: name.value, documents: d, links: l, notes: n }))
  } catch (e) {
    if (e instanceof ApiError && e.status !== 0 && e.status !== 503) {
      await (await toastController.create({ message: e.message, duration: 3000, position: 'top', color: 'danger' })).present()
      documents.value = []
      return
    }
    offline.value = true
    const cached = await kv.get<{ name: string; documents: Document[]; links: Link[]; notes: Note[] }>(key())
    if (cached) {
      name.value = cached.name
      documents.value = cached.documents
      links.value = cached.links
      notes.value = cached.notes
    } else {
      documents.value = []
    }
  }
  // Ouvre directement l'onglet qui a du contenu
  if (!documents.value?.length) tab.value = links.value.length ? 'links' : notes.value.length ? 'notes' : 'documents'
})

async function openDocument(doc: Document): Promise<void> {
  opening.value = doc.id
  try {
    const url = URL.createObjectURL(await api.documents.download(doc))
    window.open(url, '_blank')
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  } catch (e) {
    const message = offline.value ? 'Le document s\'ouvre avec le réseau.' : (e as Error).message
    await (await toastController.create({ message, duration: 3000, position: 'top', color: 'danger' })).present()
  } finally {
    opening.value = null
  }
}
</script>

<template>
  <IonPage>
    <IonHeader>
      <IonToolbar>
        <IonButtons slot="start"><IonBackButton default-href="/plans" text="Retour" /></IonButtons>
        <IonTitle>{{ name }}</IonTitle>
      </IonToolbar>
      <IonToolbar>
        <IonSegment v-model="tab">
          <IonSegmentButton value="documents"><IonLabel>Documents{{ documents?.length ? ` (${documents.length})` : '' }}</IonLabel></IonSegmentButton>
          <IonSegmentButton value="links"><IonLabel>Liens{{ links.length ? ` (${links.length})` : '' }}</IonLabel></IonSegmentButton>
          <IonSegmentButton value="notes"><IonLabel>Notes{{ notes.length ? ` (${notes.length})` : '' }}</IonLabel></IonSegmentButton>
        </IonSegment>
      </IonToolbar>
    </IonHeader>
    <IonContent>
      <p v-if="offline" class="offline"><IonNote>Hors ligne : dernière version enregistrée sur le téléphone.</IonNote></p>

      <div v-if="documents === null" class="ion-padding ion-text-center"><IonSpinner name="crescent" /></div>

      <IonList v-else-if="tab === 'documents'" inset>
        <IonItem v-for="doc in documents" :key="doc.id" button :disabled="opening === doc.id" @click="openDocument(doc)">
          <IonIcon slot="start" :icon="documentOutline" color="primary" />
          <IonLabel class="ion-text-wrap">{{ doc.name }}</IonLabel>
          <IonSpinner v-if="opening === doc.id" slot="end" name="crescent" />
        </IonItem>
        <IonItem v-if="!documents.length" lines="none"><IonNote>Aucun document pour cet article.</IonNote></IonItem>
      </IonList>

      <IonList v-else-if="tab === 'links'" inset>
        <IonItem v-for="link in links" :key="link.id" :href="link.url" target="_blank" rel="noopener noreferrer" detail>
          <IonIcon slot="start" :icon="linkOutline" color="primary" />
          <IonLabel class="ion-text-wrap">
            <h3>{{ link.label || link.url }}</h3>
            <p v-if="link.label">{{ link.url }}</p>
          </IonLabel>
        </IonItem>
        <IonItem v-if="!links.length" lines="none"><IonNote>Aucun lien pour cet article.</IonNote></IonItem>
      </IonList>

      <template v-else>
        <IonList inset>
          <IonItem v-for="note in notes" :key="note.id" lines="full">
            <IonLabel class="ion-text-wrap">
              <MarkdownView :text="note.body" />
              <p class="note-meta">{{ note.creator?.full_name }}<template v-if="note.created_at"> · {{ new Date(note.created_at).toLocaleDateString('fr-FR') }}</template></p>
            </IonLabel>
          </IonItem>
          <IonItem v-if="!notes.length" lines="none"><IonNote>Aucune note pour cet article.</IonNote></IonItem>
        </IonList>
      </template>
    </IonContent>
  </IonPage>
</template>

<style scoped>
.offline {
  margin: 0.75rem 1rem 0;
}
.note-meta {
  margin-top: 0.35rem;
  font-size: 0.8rem;
}
</style>
