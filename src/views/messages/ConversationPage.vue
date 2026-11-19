<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonFooter,
  IonHeader,
  IonIcon,
  IonPage,
  IonTextarea,
  IonTitle,
  IonToolbar,
  actionSheetController,
  alertController,
  onIonViewDidEnter,
  onIonViewWillLeave,
} from '@ionic/vue'
import { attachOutline, cameraOutline, sendOutline, timeOutline } from 'ionicons/icons'
import { createPoller, messageTime, readBy, sameGroup } from '@dash4/shared'
import type { Document, Message } from '@dash4/shared'
import { api } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import { useMessagingStore } from '@/stores/messaging'
import { useSyncStore } from '@/stores/sync'
import { pendingConversations, pendingMessages } from '@/utils/messaging'
import { openPhotos } from '@/utils/lightbox'

const props = defineProps<{ conversationKey: string }>()
const auth = useAuthStore()
const store = useMessagingStore()
const sync = useSyncStore()

/** Id de la conversation, ou identifiant hors ligne tant qu'elle n'est pas arrivée sur le serveur. */
const keyParam = computed(() => props.conversationKey)
const id = ref<number | null>(null)
const text = ref('')
const photos = ref<Blob[]>([])
const content = ref<InstanceType<typeof IonContent> | null>(null)
const photoInput = ref<HTMLInputElement | null>(null)
const urls = ref<Record<number, string>>({})
// Relève : 5 s après un échange, puis 15, 30, 60 s si rien n'arrive. Arrêtée dès que l'écran
// n'est plus affiché (autre onglet, retour, application en arrière-plan).
const poller = createPoller(() => refresh())

const conversation = computed(() => store.conversations.find((c) => c.id === id.value) ?? null)
const pendingConv = computed(() => pendingConversations(sync.pending).find((p) => p.id === keyParam.value) ?? null)
const title = computed(() => conversation.value?.title ?? pendingConv.value?.label ?? 'Conversation')
const messages = computed(() => (id.value ? store.thread(id.value).items : []))
const waiting = computed(() => pendingMessages(sync.pending, [keyParam.value, ...(id.value ? [id.value] : [])]))
const isMine = (m: Message) => m.user_id === auth.user?.id
const lastMineId = computed(() => [...messages.value].reverse().find((m) => isMine(m) && !m.deleted_at)?.id ?? null)
const seenBy = (m: Message) => (conversation.value ? readBy(m, conversation.value.members) : [])

async function scrollDown(): Promise<void> {
  await nextTick()
  await content.value?.$el.scrollToBottom(200)
}

function thumbnails(): void {
  if (!sync.online) return
  for (const m of messages.value) {
    for (const d of m.files) {
      if ((d.mime_type ?? '').startsWith('image/') && !urls.value[d.id]) {
        urls.value = { ...urls.value, [d.id]: '' }
        void api.documents.download(d).then((b) => (urls.value = { ...urls.value, [d.id]: URL.createObjectURL(b) })).catch(() => undefined)
      }
    }
  }
}

/** true s'il y avait de nouveaux messages (la relève reste rapide). */
async function refresh(): Promise<boolean> {
  if (!id.value) id.value = await store.resolve(/^\d+$/.test(keyParam.value) ? Number(keyParam.value) : keyParam.value)
  if (!id.value || !sync.online) return false
  const fresh = await store.refreshThread(id.value)
  thumbnails()
  await store.markRead(id.value)
  if (fresh) await scrollDown()
  return fresh
}

function onVisibility(): void {
  if (document.visibilityState === 'visible') poller.start()
  else poller.stop()
}

onMounted(async () => {
  await store.load()
  if (/^\d+$/.test(keyParam.value)) id.value = Number(keyParam.value)
  else id.value = store.aliases[keyParam.value] ?? null
  if (id.value) await store.loadThread(id.value)
  thumbnails()
  await scrollDown()
  document.addEventListener('visibilitychange', onVisibility)
})
onIonViewDidEnter(() => poller.start())
onIonViewWillLeave(() => poller.stop())
onUnmounted(() => {
  poller.stop()
  document.removeEventListener('visibilitychange', onVisibility)
})

async function send(): Promise<void> {
  if (!text.value.trim() && !photos.value.length) return
  await store.send(id.value ?? keyParam.value, text.value, photos.value)
  text.value = ''
  photos.value = []
  poller.poke()
  await scrollDown()
}

function onPhoto(e: Event): void {
  photos.value = [...photos.value, ...Array.from((e.target as HTMLInputElement).files ?? [])]
  if (photoInput.value) photoInput.value.value = ''
}

async function openFile(d: Document, all: Document[]): Promise<void> {
  if (urls.value[d.id]) {
    const list = all.filter((x) => urls.value[x.id]).map((x) => ({ url: urls.value[x.id]!, name: x.name }))
    return openPhotos(list, urls.value[d.id]!)
  }
  if (!sync.online) return
  const url = URL.createObjectURL(await api.documents.download(d))
  window.open(url, '_blank')
}

async function actions(m: Message): Promise<void> {
  if (!m.can.update || !id.value) return
  const sheet = await actionSheetController.create({
    buttons: [
      { text: 'Modifier', data: 'edit' },
      { text: 'Supprimer', role: 'destructive', data: 'delete' },
      { text: 'Annuler', role: 'cancel' },
    ],
  })
  await sheet.present()
  const { data } = await sheet.onDidDismiss()
  if (data === 'delete') await store.remove(id.value, m)
  if (data === 'edit') {
    const alert = await alertController.create({
      header: 'Modifier le message',
      inputs: [{ name: 'body', type: 'textarea', value: m.body ?? '' }],
      buttons: [{ text: 'Annuler', role: 'cancel' }, { text: 'Enregistrer', role: 'confirm' }],
    })
    await alert.present()
    const res = await alert.onDidDismiss()
    const body = (res.data?.values?.body as string | undefined)?.trim()
    if (res.role === 'confirm' && body) await store.edit(id.value, m, body)
  }
}
</script>

<template>
  <IonPage>
    <IonHeader>
      <IonToolbar>
        <IonButtons slot="start"><IonBackButton default-href="/messages" text="" /></IonButtons>
        <IonTitle>
          {{ title }}
          <div v-if="conversation?.project" class="sub">{{ conversation.project.name }}</div>
        </IonTitle>
      </IonToolbar>
    </IonHeader>
    <IonContent ref="content" class="ion-padding">
      <p v-if="!id && !sync.online" class="hint">Conversation créée hors ligne : elle partira au retour du réseau.</p>
      <div v-for="(m, i) in messages" :key="m.id" class="msg" :class="{ mine: isMine(m), grouped: sameGroup(messages[i - 1], m) }">
        <span v-if="!isMine(m) && conversation?.type === 'group' && !sameGroup(messages[i - 1], m)" class="author">{{ m.author?.full_name }}</span>
        <div class="bubble" :class="{ deleted: m.deleted_at }" @click="actions(m)">
          <template v-if="m.deleted_at">Message supprimé</template>
          <template v-else>
            <p v-if="m.body" class="body">{{ m.body }}</p>
            <div v-if="m.files.length" class="files">
              <button v-for="d in m.files" :key="d.id" type="button" class="file" @click.stop="openFile(d, m.files)">
                <img v-if="urls[d.id]" :src="urls[d.id]" :alt="d.name" />
                <template v-else><IonIcon :icon="attachOutline" /> {{ d.name }}</template>
              </button>
            </div>
          </template>
          <span class="meta">{{ messageTime(m.created_at) }}<template v-if="m.edited_at"> · modifié</template></span>
        </div>
        <span v-if="m.id === lastMineId && seenBy(m).length" class="seen">Vu</span>
      </div>
      <div v-for="p in waiting" :key="p.id" class="msg mine">
        <div class="bubble pending">
          <p class="body">{{ (p.payload as { body?: string }).body || 'Photo' }}</p>
          <span class="meta"><IonIcon :icon="timeOutline" /> {{ p.lastError ? 'Refusé : ' + p.lastError : 'En attente' }}<template v-if="store.photosWaiting(p.id)"> · {{ store.photosWaiting(p.id) }} photo(s)</template></span>
        </div>
      </div>
      <p v-if="!messages.length && !waiting.length" class="hint">Écrivez le premier message.</p>
    </IonContent>
    <IonFooter>
      <IonToolbar>
        <div v-if="photos.length" class="photos">{{ photos.length }} photo(s) jointe(s) <a @click="photos = []">retirer</a></div>
        <div class="composer">
          <IonButton fill="clear" aria-label="Photo" @click="photoInput?.click()"><IonIcon :icon="cameraOutline" /></IonButton>
          <input ref="photoInput" type="file" accept="image/*" multiple hidden @change="onPhoto" />
          <IonTextarea v-model="text" :auto-grow="true" :rows="1" placeholder="Message" class="input" />
          <IonButton fill="clear" aria-label="Envoyer" :disabled="!text.trim() && !photos.length" @click="send"><IonIcon :icon="sendOutline" /></IonButton>
        </div>
      </IonToolbar>
    </IonFooter>
  </IonPage>
</template>

<style scoped>
.sub {
  font-size: 0.75rem;
  font-weight: normal;
  color: var(--ion-color-medium);
}
.msg {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  margin-top: 8px;
}
.msg.grouped {
  margin-top: 2px;
}
.msg.mine {
  align-items: flex-end;
}
.author {
  font-size: 0.75rem;
  color: var(--ion-color-medium);
  margin-left: 8px;
}
.bubble {
  max-width: 80%;
  padding: 8px 12px;
  border-radius: 16px;
  background: var(--ion-color-light);
}
.mine .bubble {
  background: var(--ion-color-primary);
  color: var(--ion-color-primary-contrast);
}
.bubble.pending {
  opacity: 0.7;
}
.bubble.deleted {
  font-style: italic;
  background: none;
  color: var(--ion-color-medium);
  border: 1px dashed var(--ion-color-medium);
}
.body {
  margin: 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.meta {
  display: block;
  text-align: right;
  font-size: 0.65rem;
  opacity: 0.8;
  margin-top: 2px;
}
.files {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 4px;
}
.file {
  border: none;
  background: rgba(0, 0, 0, 0.06);
  border-radius: 8px;
  padding: 4px;
  color: inherit;
}
.file img {
  display: block;
  max-width: 180px;
  max-height: 160px;
  border-radius: 6px;
}
.seen {
  font-size: 0.7rem;
  color: var(--ion-color-medium);
}
.hint {
  text-align: center;
  color: var(--ion-color-medium);
}
.composer {
  display: flex;
  align-items: flex-end;
}
.input {
  flex: 1;
}
.photos {
  font-size: 0.8rem;
  padding: 0 12px;
}
</style>
