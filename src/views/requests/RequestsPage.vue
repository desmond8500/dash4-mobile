<script setup lang="ts">
import ViewModeButton from '@/components/ViewModeButton.vue'
import CardList from '@/components/CardList.vue'
import { useViewMode } from '@/composables/useViewMode'
import { computed, onMounted, ref } from 'vue'
import {
  IonBadge,
  IonButtons,
  IonContent,
  IonFab,
  IonFabButton,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonNote,
  IonPage,
  IonRefresher,
  IonRefresherContent,
  IonSearchbar,
  IonSegment,
  IonSegmentButton,
  IonText,
  IonTitle,
  IonToolbar,
  type RefresherCustomEvent,
} from '@ionic/vue'
import { add, alertCircle, arrowUp, callOutline, cloudUploadOutline, personOutline } from 'ionicons/icons'
import type { ClientRequest } from '@dash4/shared'
import { useAuthStore } from '@/stores/auth'
import { useClientRequestsStore } from '@/stores/clientRequests'
import { isOverdue, matchesSearch } from '@/offline/collection'
import { requesterLabel, statusColor } from '@/utils/requests'

const viewMode = useViewMode('client_requests')
const auth = useAuthStore()
const store = useClientRequestsStore()
const segment = ref<'open' | 'closed'>('open')
const search = ref('')

const list = computed(() =>
  (segment.value === 'open' ? store.open : store.closed).filter((r) =>
    matchesSearch(search.value, [r.body, r.client?.name, r.contact_name, r.contact_phone]),
  ),
)

const syncedLabel = computed(() =>
  store.syncedAt
    ? `Mis à jour le ${new Date(store.syncedAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}`
    : 'Pas encore synchronisé',
)

function shortDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''
}

const overdue = (r: ClientRequest) => isOverdue(r)

onMounted(async () => {
  await store.load()
  void store.refresh()
})

async function onRefresh(event: RefresherCustomEvent): Promise<void> {
  await store.refresh()
  await event.target.complete()
}
</script>

<template>
  <IonPage>
    <IonHeader>
      <IonToolbar>
        <IonTitle>Demandes</IonTitle>
        <IonButtons slot="end"><ViewModeButton v-model="viewMode" /></IonButtons>
      </IonToolbar>
      <IonToolbar>
        <IonSegment v-model="segment">
          <IonSegmentButton value="open">
            <IonLabel>À traiter ({{ store.openCount }})</IonLabel>
          </IonSegmentButton>
          <IonSegmentButton value="closed">
            <IonLabel>Traitées</IonLabel>
          </IonSegmentButton>
        </IonSegment>
      </IonToolbar>
      <IonToolbar>
        <IonSearchbar v-model="search" placeholder="Texte, client, nom, téléphone" :debounce="150" />
      </IonToolbar>
    </IonHeader>

    <IonContent>
      <IonRefresher slot="fixed" @ion-refresh="onRefresh">
        <IonRefresherContent pulling-text="Tirer pour actualiser" refreshing-spinner="crescent" />
      </IonRefresher>

      <IonList v-if="segment === 'open' && store.pending.length">
        <IonListHeader>
          <IonLabel>En attente d'envoi</IonLabel>
        </IonListHeader>
        <IonItem v-for="item in store.pending" :key="item.id">
          <IonIcon slot="start" :icon="cloudUploadOutline" color="warning" aria-hidden="true" />
          <IonLabel class="ion-text-wrap">
            <h3>{{ item.payload.body }}</h3>
            <p v-if="item.lastError" class="error">{{ item.lastError }}</p>
            <p v-else>Sera envoyée dès que le réseau est disponible</p>
          </IonLabel>
        </IonItem>
      </IonList>

      <CardList v-if="viewMode === 'cards'" :items="list" :to="(r) => ({ name: 'client-request', params: { id: r.id } })">
        <template #card="{ item }">
          <div class="card-head">
            <IonIcon v-if="item.priority.value === 'high'" :icon="arrowUp" color="danger" aria-label="Urgente" />
            <div>
              <span class="card-title">{{ requesterLabel(item) }}</span>
              <span class="card-sub">{{ item.source.label }} · {{ shortDate(item.created_at) }}</span>
            </div>
          </div>
          <div class="card-text">{{ item.body }}</div>
          <div class="card-meta">
            <span><IonIcon :icon="personOutline" /> {{ item.assignee?.full_name ?? 'Personne en charge' }}</span>
            <span v-if="!item.client && item.contact_phone"><IonIcon :icon="callOutline" /> {{ item.contact_phone }}</span>
          </div>
          <div class="card-foot">
            <IonBadge :color="statusColor(item.status.value)">{{ item.status.label }}</IonBadge>
            <IonBadge v-if="overdue(item)" color="danger"><IonIcon :icon="alertCircle" /> En retard</IonBadge>
          </div>
        </template>
      </CardList>
      <IonList v-else>
        <IonItem
          v-for="request in list"
          :key="request.id"
          :router-link="{ name: 'client-request', params: { id: request.id } }"
          detail
        >
          <IonIcon
            v-if="request.priority.value === 'high'"
            slot="start"
            :icon="arrowUp"
            color="danger"
            aria-label="Urgente"
          />
          <IonLabel class="ion-text-wrap">
            <h3 class="body">{{ request.body }}</h3>
            <p>{{ requesterLabel(request) }} · {{ request.source.label }} · {{ shortDate(request.created_at) }}</p>
            <p v-if="request.assignee">En charge : {{ request.assignee.full_name }}</p>
          </IonLabel>
          <div slot="end" class="badges">
            <IonBadge :color="statusColor(request.status.value)">{{ request.status.label }}</IonBadge>
            <IonBadge v-if="overdue(request)" color="danger">
              <IonIcon :icon="alertCircle" /> En retard
            </IonBadge>
          </div>
        </IonItem>
      </IonList>

      <div v-if="!list.length && !(segment === 'open' && store.pending.length)" class="ion-padding ion-text-center">
        <IonText color="medium">
          <p>{{ segment === 'open' ? 'Rien à traiter.' : 'Aucune demande traitée.' }}</p>
        </IonText>
      </div>

      <div class="ion-padding ion-text-center">
        <IonNote>{{ syncedLabel }}</IonNote>
        <IonText v-if="store.error" color="danger"><p>{{ store.error }}</p></IonText>
      </div>

      <IonFab v-if="auth.can('client_requests.create')" slot="fixed" vertical="bottom" horizontal="end">
        <IonFabButton :router-link="{ name: 'client-request-new' }" aria-label="Noter une demande">
          <IonIcon :icon="add" />
        </IonFabButton>
      </IonFab>
    </IonContent>
  </IonPage>
</template>

<style scoped>
.body {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  white-space: normal;
}

.badges {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.25rem;
}

.error {
  color: var(--ion-color-danger);
}
</style>
