<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  IonAvatar,
  IonBadge,
  IonButton,
  IonButtons,
  IonContent,
  IonFab,
  IonFabButton,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonModal,
  IonNote,
  IonPage,
  IonRefresher,
  IonRefresherContent,
  IonSearchbar,
  IonSegment,
  IonSegmentButton,
  IonSelect,
  IonSelectOption,
  IonTitle,
  IonToolbar,
  toastController,
  useIonRouter,
  type RefresherCustomEvent,
} from '@ionic/vue'
import { cloudUploadOutline, createOutline, peopleOutline } from 'ionicons/icons'
import { filterConversations, messageTime } from '@dash4/shared'
import type { ConversationType } from '@dash4/shared'
import { useAuthStore } from '@/stores/auth'
import { useMessagingStore } from '@/stores/messaging'
import { useSyncStore } from '@/stores/sync'
import { pendingConversations } from '@/utils/messaging'

const auth = useAuthStore()
const store = useMessagingStore()
const sync = useSyncStore()
const router = useIonRouter()
const search = ref('')
const newOpen = ref(false)
const type = ref<ConversationType>('direct')
const person = ref<number | null>(null)
const people = ref<number[]>([])
const title = ref('')

const list = computed(() => filterConversations(store.conversations, search.value))
const waiting = computed(() => pendingConversations(sync.pending))

onMounted(async () => {
  await store.load()
  void store.refresh()
  if (!store.users.length) void store.refreshUsers()
})

async function onRefresh(e: RefresherCustomEvent): Promise<void> {
  await Promise.all([store.refresh(), store.refreshUsers()])
  await e.target.complete()
}

const other = (c: (typeof store.conversations)[number]) => c.members.find((m) => m.id !== auth.user?.id)
const initials = (name: string) => name.split(' ').map((p) => p.charAt(0)).join('').slice(0, 2).toUpperCase()

async function create(): Promise<void> {
  if (type.value === 'direct' && !person.value) return
  if (type.value === 'group' && (!people.value.length || !title.value.trim())) {
    await (await toastController.create({ message: 'Donnez un nom au groupe et choisissez des participants.', color: 'warning', duration: 2500 })).present()
    return
  }
  const key = await store.start(
    type.value === 'direct' ? { type: 'direct', user_ids: [person.value!] } : { type: 'group', user_ids: people.value, title: title.value.trim() },
  )
  newOpen.value = false
  person.value = null
  people.value = []
  title.value = ''
  router.push({ name: 'conversation', params: { conversationKey: String(key) } })
}
</script>

<template>
  <IonPage>
    <IonHeader>
      <IonToolbar>
        <IonTitle>Messages</IonTitle>
      </IonToolbar>
      <IonToolbar>
        <IonSearchbar v-model="search" placeholder="Rechercher" />
      </IonToolbar>
    </IonHeader>
    <IonContent>
      <IonRefresher slot="fixed" @ion-refresh="onRefresh"><IonRefresherContent /></IonRefresher>
      <IonList>
        <IonItem v-for="p in waiting" :key="p.id" button @click="router.push({ name: 'conversation', params: { conversationKey: p.id } })">
          <IonIcon slot="start" :icon="cloudUploadOutline" color="warning" />
          <IonLabel>
            <h2>{{ p.label }}</h2>
            <p>En attente d'envoi</p>
          </IonLabel>
        </IonItem>
        <IonItem v-for="c in list" :key="c.id" button @click="router.push({ name: 'conversation', params: { conversationKey: String(c.id) } })">
          <IonAvatar slot="start">
            <img v-if="c.type === 'direct' && other(c)?.avatar_url" :src="other(c)!.avatar_url!" alt="" />
            <div v-else class="initials">
              <IonIcon v-if="c.type === 'group'" :icon="peopleOutline" />
              <template v-else>{{ initials(c.title) }}</template>
            </div>
          </IonAvatar>
          <IonLabel :class="{ unread: c.unread_count > 0 }">
            <h2>{{ c.title }}</h2>
            <p>{{ c.last_message?.excerpt ?? c.project?.name ?? 'Nouvelle conversation' }}</p>
          </IonLabel>
          <div slot="end" class="side">
            <IonNote>{{ messageTime(c.last_message_at) }}</IonNote>
            <IonBadge v-if="c.unread_count" color="primary">{{ c.unread_count }}</IonBadge>
          </div>
        </IonItem>
      </IonList>
      <p v-if="!list.length && !waiting.length" class="ion-padding ion-text-center empty">Aucune conversation.</p>

      <IonFab slot="fixed" vertical="bottom" horizontal="end">
        <IonFabButton aria-label="Nouvelle conversation" @click="newOpen = true"><IonIcon :icon="createOutline" /></IonFabButton>
      </IonFab>

      <IonModal :is-open="newOpen" @did-dismiss="newOpen = false">
        <IonHeader>
          <IonToolbar>
            <IonButtons slot="start"><IonButton @click="newOpen = false">Annuler</IonButton></IonButtons>
            <IonTitle>Nouvelle conversation</IonTitle>
            <IonButtons slot="end"><IonButton strong @click="create">Démarrer</IonButton></IonButtons>
          </IonToolbar>
        </IonHeader>
        <IonContent class="ion-padding">
          <IonSegment v-model="type">
            <IonSegmentButton value="direct"><IonLabel>Privée</IonLabel></IonSegmentButton>
            <IonSegmentButton value="group"><IonLabel>Groupe</IonLabel></IonSegmentButton>
          </IonSegment>
          <IonList>
            <IonItem v-if="type === 'direct'">
              <IonSelect v-model="person" label="Avec" label-placement="stacked" interface="action-sheet" placeholder="Choisir une personne">
                <IonSelectOption v-for="u in store.users" :key="u.id" :value="u.id">{{ u.full_name }}</IonSelectOption>
              </IonSelect>
            </IonItem>
            <template v-else>
              <IonItem><IonInput v-model="title" label="Nom du groupe" label-placement="stacked" /></IonItem>
              <IonItem>
                <IonSelect v-model="people" label="Participants" label-placement="stacked" multiple placeholder="Choisir">
                  <IonSelectOption v-for="u in store.users" :key="u.id" :value="u.id">{{ u.full_name }}</IonSelectOption>
                </IonSelect>
              </IonItem>
            </template>
          </IonList>
          <p v-if="!store.users.length" class="empty">La liste des personnes se charge avec le réseau.</p>
        </IonContent>
      </IonModal>
    </IonContent>
  </IonPage>
</template>

<style scoped>
.initials {
  display: grid;
  place-items: center;
  width: 100%;
  height: 100%;
  background: var(--ion-color-light);
  font-weight: 600;
}
.unread h2,
.unread p {
  font-weight: 700;
  color: var(--ion-text-color);
}
.side {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
}
.empty {
  color: var(--ion-color-medium);
}
</style>
