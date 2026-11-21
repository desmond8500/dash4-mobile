<script setup lang="ts">
import MarkdownView from '@/components/MarkdownView.vue'
import { computed, onMounted } from 'vue'
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
  IonNote,
  IonPage,
  IonText,
  IonTitle,
  IonToolbar,
  toastController,
} from '@ionic/vue'
import CommentsSection from '@/components/CommentsSection.vue'
import { banOutline, callOutline, checkmarkCircleOutline, playOutline, refreshOutline } from 'ionicons/icons'
import type { ClientRequestStatus } from '@dash4/shared'
import { useAuthStore } from '@/stores/auth'
import { useClientRequestsStore } from '@/stores/clientRequests'
import { useSyncStore } from '@/stores/sync'
import { isOverdue } from '@/offline/collection'
import { telHref } from '@/utils/links'
import { requesterLabel, statusColor } from '@/utils/requests'

const props = defineProps<{ id: string }>()
const auth = useAuthStore()
const store = useClientRequestsStore()
const sync = useSyncStore()

const request = computed(() => store.find(Number(props.id)))
const canManage = computed(() => auth.can('client_requests.update'))

function dateTime(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }) : ''
}

async function setStatus(status: ClientRequestStatus, assignToMe = false): Promise<void> {
  if (!request.value) return
  await store.setStatus(request.value.id, status, assignToMe)
  const toast = await toastController.create({
    message: sync.online ? 'Demande mise à jour.' : 'Modifiée sur le téléphone, envoyée dès le retour du réseau.',
    duration: 2000,
    position: 'top',
  })
  await toast.present()
}

onMounted(() => store.load())
</script>

<template>
  <IonPage>
    <IonHeader>
      <IonToolbar>
        <IonButtons slot="start">
          <IonBackButton default-href="/demandes" text="Demandes" />
        </IonButtons>
        <IonTitle>Demande</IonTitle>
      </IonToolbar>
    </IonHeader>

    <IonContent>
      <div v-if="!request" class="ion-padding ion-text-center">
        <IonText color="medium"><p>Cette demande n'est pas disponible sur le téléphone.</p></IonText>
      </div>

      <template v-else>
        <div class="ion-padding">
          <div class="badges">
            <IonBadge :color="statusColor(request.status.value)">{{ request.status.label }}</IonBadge>
            <IonBadge v-if="request.priority.value === 'high'" color="danger">Urgente</IonBadge>
            <IonBadge v-if="isOverdue(request)" color="danger">En retard</IonBadge>
          </div>
          <MarkdownView class="body" :text="request.body" />
        </div>

        <IonList inset>
          <IonItem :router-link="request.client && canManage ? { name: 'client', params: { id: request.client.id } } : undefined" :detail="!!request.client && canManage">
            <IonLabel>
              <p>Demandeur</p>
              <h3>{{ requesterLabel(request) }}</h3>
            </IonLabel>
          </IonItem>
          <IonItem v-if="request.contact_phone" :href="telHref(request.contact_phone)">
            <IonIcon slot="start" :icon="callOutline" color="primary" aria-hidden="true" />
            <IonLabel>{{ request.contact_phone }}</IonLabel>
          </IonItem>
          <IonItem>
            <IonLabel>Origine</IonLabel>
            <IonNote slot="end">{{ request.source.label }}</IonNote>
          </IonItem>
          <IonItem>
            <IonLabel>Notée</IonLabel>
            <IonNote slot="end">
              {{ dateTime(request.created_at) }}<template v-if="request.creator"> · {{ request.creator.full_name }}</template>
            </IonNote>
          </IonItem>
          <IonItem v-if="request.assignee">
            <IonLabel>En charge</IonLabel>
            <IonNote slot="end">{{ request.assignee.full_name }}</IonNote>
          </IonItem>
          <IonItem v-if="request.remind_at">
            <IonLabel>Rappel</IonLabel>
            <IonNote slot="end">{{ dateTime(request.remind_at) }}</IonNote>
          </IonItem>
          <IonItem v-if="request.processed_at">
            <IonLabel>{{ request.status.label }}</IonLabel>
            <IonNote slot="end">
              {{ dateTime(request.processed_at) }}<template v-if="request.processor"> · {{ request.processor.full_name }}</template>
            </IonNote>
          </IonItem>
        </IonList>

        <div v-if="canManage" class="ion-padding actions">
          <template v-if="request.status.value === 'new'">
            <IonButton expand="block" @click="setStatus('in_progress', true)">
              <IonIcon slot="start" :icon="playOutline" /> Prendre en charge
            </IonButton>
          </template>
          <template v-if="request.status.value === 'new' || request.status.value === 'in_progress'">
            <IonButton expand="block" color="success" @click="setStatus('done')">
              <IonIcon slot="start" :icon="checkmarkCircleOutline" /> Marquer traitée
            </IonButton>
            <IonButton expand="block" fill="outline" color="medium" @click="setStatus('dismissed')">
              <IonIcon slot="start" :icon="banOutline" /> Classer sans suite
            </IonButton>
          </template>
          <IonButton v-else expand="block" fill="outline" @click="setStatus('new')">
            <IonIcon slot="start" :icon="refreshOutline" /> Rouvrir
          </IonButton>
        </div>
        <CommentsSection type="client-requests" :id="request.id" />
      </template>
    </IonContent>
  </IonPage>
</template>

<style scoped>
.badges {
  display: flex;
  gap: 0.375rem;
  flex-wrap: wrap;
}

.body {
  font-size: 1.1rem;
  white-space: pre-line;
}

.actions {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
</style>
