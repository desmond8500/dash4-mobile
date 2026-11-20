<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { IonButton, IonIcon, IonItem, IonLabel, IonList, IonListHeader, IonNote, IonText, IonTextarea, alertController } from '@ionic/vue'
import { cameraOutline, closeCircle, cloudOfflineOutline, createOutline, sendOutline, trashOutline } from 'ionicons/icons'
import { filterMentionable, insertMention, mentionedIds, mentionQuery, splitMentions } from '@dash4/shared'
import type { CommentableType, Mentionable } from '@dash4/shared'
import { api } from '@/services/api'
import { useCommentsStore } from '@/stores/comments'
import { useSyncStore } from '@/stores/sync'
import { openLightbox, openPhotos } from '@/utils/lightbox'

/** Commentaires d'une fiche : lecture hors ligne, @ pour mentionner, photos ; envoi via la file d'attente. */
const props = defineProps<{ type: CommentableType; id: number }>()
const store = useCommentsStore()
const sync = useSyncStore()

const text = ref('')
const cursor = ref(0)
const photos = ref<Array<{ file: File; url: string }>>([])
const thumbs = ref<Record<number, string>>({})
const thread = computed(() => store.thread(props.type, props.id))
const pending = computed(() => store.pendingFor(props.type, props.id))
const mention = computed(() => mentionQuery(text.value, cursor.value))
const suggestions = computed(() => (mention.value ? filterMentionable(thread.value.people, mention.value.query, 5) : []))

onMounted(async () => {
  await store.load(props.type, props.id)
  if (sync.online) {
    await store.refresh(props.type, props.id)
    for (const d of thread.value.items.flatMap((c) => c.files ?? []).filter((f) => f.mime_type?.startsWith('image/')).slice(0, 20)) {
      const blob = await api.documents.download(d).catch(() => null)
      if (blob) thumbs.value = { ...thumbs.value, [d.id]: URL.createObjectURL(blob) }
    }
  }
})

/** Photos d'un commentaire déjà affichées en vignette. */
function openComment(files: Array<{ id: number; name: string }>, id: number): void {
  const shown = files.filter((f) => thumbs.value[f.id])
  void openLightbox(shown.map((f) => ({ src: thumbs.value[f.id]!, caption: f.name })), shown.findIndex((f) => f.id === id))
}
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '')

function onInput(event: CustomEvent): void {
  text.value = (event.detail.value as string | null) ?? ''
  const native = (event.target as HTMLElement | null)?.querySelector('textarea')
  cursor.value = native?.selectionStart ?? text.value.length
}
function pick(person: Mentionable): void {
  if (!mention.value) return
  const result = insertMention(text.value, mention.value.start, cursor.value, person)
  text.value = result.text
  cursor.value = result.cursor
}
function onPhoto(event: Event): void {
  const input = event.target as HTMLInputElement
  for (const file of Array.from(input.files ?? [])) photos.value.push({ file, url: URL.createObjectURL(file) })
  input.value = ''
}
function removePhoto(url: string): void {
  URL.revokeObjectURL(url)
  photos.value = photos.value.filter((p) => p.url !== url)
}

async function send(): Promise<void> {
  const body = text.value.trim() || (photos.value.length ? 'Photo jointe' : '')
  if (!body) return
  await store.add(props.type, props.id, body, mentionedIds(body, thread.value.people), photos.value.map((p) => p.file))
  photos.value.forEach((p) => URL.revokeObjectURL(p.url))
  photos.value = []
  text.value = ''
  cursor.value = 0
}

async function edit(id: number): Promise<void> {
  const comment = thread.value.items.find((c) => c.id === id)
  if (!comment) return
  const alert = await alertController.create({
    header: 'Modifier le commentaire',
    inputs: [{ name: 'body', type: 'textarea', value: comment.body }],
    buttons: [{ text: 'Annuler', role: 'cancel' }, { text: 'Enregistrer', role: 'confirm' }],
  })
  await alert.present()
  const { role, data } = await alert.onDidDismiss()
  if (role === 'confirm') await store.edit(props.type, props.id, comment, String(data?.values?.body ?? ''))
}

async function remove(id: number): Promise<void> {
  const comment = thread.value.items.find((c) => c.id === id)
  if (!comment) return
  const alert = await alertController.create({
    header: 'Supprimer le commentaire ?',
    buttons: [
      { text: 'Annuler', role: 'cancel' },
      { text: 'Supprimer', role: 'destructive', handler: () => void store.remove(props.type, props.id, comment) },
    ],
  })
  await alert.present()
}
</script>

<template>
  <IonList inset>
    <IonListHeader><IonLabel>Commentaires</IonLabel></IonListHeader>
    <IonItem v-for="c in thread.items" :key="c.id">
      <IonLabel class="ion-text-wrap">
        <p class="body"><template v-for="(part, i) in splitMentions(c.body, c.mentions ?? [])" :key="i"><strong v-if="part.mention" class="mention">{{ part.text }}</strong><template v-else>{{ part.text }}</template></template></p>
        <div v-if="c.files?.length" class="photos">
          <template v-for="f in c.files" :key="f.id">
            <img v-if="thumbs[f.id]" :src="thumbs[f.id]" :alt="f.name" @click="openComment(c.files ?? [], f.id)" />
            <IonNote v-else>📎 {{ f.name }}</IonNote>
          </template>
        </div>
        <p><IonNote>{{ c.author?.full_name }} · {{ when(c.created_at) }}<template v-if="c.edited_at"> · modifié</template></IonNote></p>
      </IonLabel>
      <IonButton v-if="c.can.update" slot="end" fill="clear" color="medium" aria-label="Modifier" @click="edit(c.id)"><IonIcon slot="icon-only" :icon="createOutline" /></IonButton>
      <IonButton v-if="c.can.delete" slot="end" fill="clear" color="medium" aria-label="Supprimer" @click="remove(c.id)"><IonIcon slot="icon-only" :icon="trashOutline" /></IonButton>
    </IonItem>
    <IonItem v-for="p in pending" :key="p.id">
      <IonIcon slot="start" :icon="cloudOfflineOutline" color="medium" />
      <IonLabel class="ion-text-wrap">
        <p class="body">{{ p.payload.body }}</p>
        <p v-if="store.photosWaiting(p.id)"><IonNote>{{ store.photosWaiting(p.id) }} photo(s)</IonNote></p>
        <p v-if="p.lastError"><IonText color="danger">{{ p.lastError }}</IonText></p>
      </IonLabel>
    </IonItem>
    <IonItem v-if="!thread.items.length && !pending.length" lines="none"><IonNote>Aucun commentaire. Tapez @ pour mentionner quelqu'un.</IonNote></IonItem>

    <IonItem>
      <IonTextarea :value="text" placeholder="Écrire un commentaire…" :auto-grow="true" autocapitalize="sentences" @ion-input="onInput" />
    </IonItem>
    <IonItem v-for="p in suggestions" :key="p.id" button :detail="false" @click="pick(p)">
      <IonLabel>@{{ p.full_name }}<p v-if="p.job_title">{{ p.job_title }}</p></IonLabel>
    </IonItem>
    <div v-if="photos.length" class="photos ion-padding-horizontal">
      <div v-for="p in photos" :key="p.url" class="photo">
        <img :src="p.url" alt="" @click="openPhotos(photos, p.url)" />
        <IonButton fill="clear" size="small" color="danger" aria-label="Retirer" @click="removePhoto(p.url)"><IonIcon slot="icon-only" :icon="closeCircle" /></IonButton>
      </div>
    </div>
    <IonItem lines="none">
      <label class="photo-button">
        <IonIcon :icon="cameraOutline" /> Photo
        <input type="file" accept="image/*" capture="environment" hidden @change="onPhoto" />
      </label>
      <IonButton slot="end" :disabled="!text.trim() && !photos.length" @click="send"><IonIcon slot="start" :icon="sendOutline" />Envoyer</IonButton>
    </IonItem>
    <IonItem v-if="!sync.online && !thread.people.length" lines="none"><IonNote>Les personnes à mentionner s'affichent avec le réseau.</IonNote></IonItem>
  </IonList>
</template>

<style scoped>
.body {
  white-space: pre-wrap;
  color: var(--ion-text-color);
}

.mention {
  color: var(--ion-color-primary);
}

.photos {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
  margin: 0.375rem 0;
}

.photos img {
  width: 84px;
  height: 84px;
  object-fit: cover;
  border-radius: 0.375rem;
}

.photo {
  position: relative;
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
</style>
