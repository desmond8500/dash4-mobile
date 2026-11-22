<script setup lang="ts">
import { matches } from '@/utils/home'
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import {
  IonBadge,
  IonButton,
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
  IonSegment,
  IonSegmentButton,
  IonText,
  IonTitle,
  IonToolbar,
  alertController,
  type RefresherCustomEvent,
  IonSearchbar,
} from '@ionic/vue'
import { add, cloudOfflineOutline, ellipseOutline, keyOutline } from 'ionicons/icons'
import type { TechAccessRequest } from '@dash4/shared'
import { useAuthStore } from '@/stores/auth'
import { useTechSpaceStore } from '@/stores/techSpace'
import { expiresIn } from '@/utils/techSpace'

/** Informations temporaires reçues (codes, matériel…) et demandes d'accès. */
const store = useTechSpaceStore()
const auth = useAuthStore()
const route = useRoute()
const segment = ref<'infos' | 'demandes'>(route.query.onglet === 'demandes' || !store.canShares() ? 'demandes' : 'infos')
const isTechnician = computed(() => auth.user?.account_type.value === 'technician')

onMounted(async () => {
  await store.load()
  void store.refresh()
})
async function onRefresh(event: RefresherCustomEvent): Promise<void> {
  await store.refresh()
  await event.target.complete()
}

const statusColor = (s: string) => (s === 'approved' ? 'success' : s === 'rejected' ? 'danger' : 'warning')
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '')

function pad(n: number): string {
  return String(n).padStart(2, '0')
}
function tonight(): string {
  const d = new Date()
  d.setHours(19, 0, 0, 0)
  if (d.getTime() - Date.now() < 3_600_000) d.setDate(d.getDate() + 1)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T19:00`
}

async function approve(r: TechAccessRequest): Promise<void> {
  const alert = await alertController.create({
    header: 'Accepter la demande',
    subHeader: `${r.subject} — ${r.user?.full_name ?? ''}`,
    message: "L'information est envoyée au technicien et effacée à l'heure indiquée. Laissez vide pour accepter sans l'envoyer.",
    inputs: [
      { name: 'content', type: 'textarea', placeholder: 'Code, emplacement de la clé…' },
      { name: 'expires', type: 'datetime-local', value: tonight() },
    ],
    buttons: [
      { text: 'Annuler', role: 'cancel' },
      {
        text: 'Accepter',
        handler: (v: { content?: string; expires?: string }) => {
          const content = v.content?.trim()
          const expires = v.expires ? new Date(v.expires) : null
          if (content && (!expires || expires.getTime() <= Date.now())) return false
          void store.decide(r.id, {
            decision: 'approved',
            share: content && expires ? { content, category: 'access', expires_at: expires.toISOString() } : null,
          })
          return true
        },
      },
    ],
  })
  await alert.present()
}
async function reject(r: TechAccessRequest): Promise<void> {
  const alert = await alertController.create({
    header: 'Refuser la demande',
    subHeader: r.subject,
    inputs: [{ name: 'response', type: 'textarea', placeholder: 'Raison du refus' }],
    buttons: [
      { text: 'Annuler', role: 'cancel' },
      {
        text: 'Refuser',
        role: 'destructive',
        handler: (v: { response?: string }) => {
          if (!v.response?.trim()) return false
          void store.decide(r.id, { decision: 'rejected', response: v.response.trim() })
          return true
        },
      },
    ],
  })
  await alert.present()
}

const query = ref('')
const shownShares = computed(() => (query.value.trim() ? store.active.filter((s) => matches(query.value, s.title, s.category.label, s.task?.title, s.project?.name)) : store.active))
const shownRequests = computed(() =>
  query.value.trim() ? store.sortedRequests.filter((r) => matches(query.value, r.subject, r.reason, r.task?.title, r.project?.name, r.user?.full_name)) : store.sortedRequests,
)
</script>

<template>
  <IonPage>
    <IonHeader>
      <IonToolbar><IonTitle>Accès et infos</IonTitle></IonToolbar>
      <IonToolbar><IonSearchbar v-model="query" :debounce="150" placeholder="Titre, tâche, projet…" aria-label="Rechercher" /></IonToolbar>
      <IonToolbar v-if="store.canShares() && store.canRequests()">
        <IonSegment v-model="segment">
          <IonSegmentButton value="infos"><IonLabel>Informations<IonBadge v-if="store.unread" color="primary" class="count">{{ store.unread }}</IonBadge></IonLabel></IonSegmentButton>
          <IonSegmentButton value="demandes"><IonLabel>Demandes<IonBadge v-if="store.toDecide.length" color="warning" class="count">{{ store.toDecide.length }}</IonBadge></IonLabel></IonSegmentButton>
        </IonSegment>
      </IonToolbar>
    </IonHeader>
    <IonContent>
      <IonRefresher slot="fixed" @ion-refresh="onRefresh">
        <IonRefresherContent pulling-text="Tirer pour actualiser" refreshing-spinner="crescent" />
      </IonRefresher>
      <div v-if="store.error" class="ion-padding-horizontal"><IonText color="danger"><p>{{ store.error }}</p></IonText></div>

      <template v-if="segment === 'infos'">
        <IonList inset>
          <IonItem v-for="s in shownShares" :key="s.id" :router-link="{ name: 'tech-share', params: { id: s.id } }" detail>
            <IonIcon slot="start" :icon="s.is_recipient && !s.read_at ? ellipseOutline : keyOutline" :color="s.is_recipient && !s.read_at ? 'primary' : 'medium'" />
            <IonLabel class="ion-text-wrap">
              <h3>{{ s.title }}</h3>
              <p>{{ [s.category.label, s.task?.title ?? s.project?.name].filter(Boolean).join(' · ') }}</p>
              <p>Expire {{ expiresIn(s, store.now) }}</p>
            </IonLabel>
          </IonItem>
        </IonList>
        <div v-if="!store.active.length" class="ion-padding ion-text-center">
          <IonText color="medium"><p>Aucune information en cours. Les codes et consignes qu'on vous envoie apparaissent ici, puis disparaissent à leur expiration.</p></IonText>
        </div>
      </template>

      <template v-else>
        <IonList v-if="store.pendingRequests.length" inset>
          <IonListHeader><IonLabel>En attente d'envoi</IonLabel></IonListHeader>
          <IonItem v-for="p in store.pendingRequests" :key="p.id">
            <IonIcon slot="start" :icon="cloudOfflineOutline" color="medium" />
            <IonLabel class="ion-text-wrap"><h3>{{ p.payload.subject }}</h3><p v-if="p.lastError"><IonText color="danger">{{ p.lastError }}</IonText></p></IonLabel>
          </IonItem>
        </IonList>
        <IonList inset>
          <IonItem v-for="r in shownRequests" :key="r.id">
            <IonLabel class="ion-text-wrap">
              <h3>{{ r.subject }}</h3>
              <p v-if="!isTechnician">{{ r.user?.full_name }}</p>
              <p>{{ [r.task?.title ?? r.project?.name, r.needed_on ? `pour le ${when(r.needed_on)}` : null].filter(Boolean).join(' · ') }}</p>
              <p v-if="r.reason" class="pre">{{ r.reason }}</p>
              <p v-if="r.response"><IonText color="medium">Réponse : {{ r.response }}</IonText></p>
              <div v-if="r.can.decide && r.status.value === 'pending'" class="actions">
                <IonButton size="small" color="success" @click="approve(r)">Accepter</IonButton>
                <IonButton size="small" color="danger" fill="outline" @click="reject(r)">Refuser</IonButton>
              </div>
            </IonLabel>
            <div slot="end" class="end">
              <IonBadge :color="statusColor(r.status.value)">{{ r.status.label }}</IonBadge>
              <IonNote>{{ when(r.created_at) }}</IonNote>
            </div>
          </IonItem>
        </IonList>
        <div v-if="!store.sortedRequests.length && !store.pendingRequests.length" class="ion-padding ion-text-center">
          <IonText color="medium"><p>Aucune demande. Besoin d'un code, d'une clé ou d'un badge ? Touchez +.</p></IonText>
        </div>
      </template>

      <IonFab v-if="auth.can('tech_access_requests.create')" slot="fixed" vertical="bottom" horizontal="end">
        <IonFabButton :router-link="{ name: 'access-request-new' }" aria-label="Demander un accès"><IonIcon :icon="add" /></IonFabButton>
      </IonFab>
    </IonContent>
  </IonPage>
</template>

<style scoped>
.end {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.25rem;
}

.actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.5rem;
}

.count {
  margin-left: 0.375rem;
}

.pre {
  white-space: pre-wrap;
}
</style>
