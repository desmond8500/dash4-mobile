<script setup lang="ts">
import { matches } from '@/utils/home'
import { computed, onMounted, ref } from 'vue'
import {
  IonBadge,
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
  type RefresherCustomEvent,
  IonSearchbar,
  IonButton,
  actionSheetController,
  alertController,
  toastController,
} from '@ionic/vue'
import { add, attachOutline, cloudOfflineOutline } from 'ionicons/icons'
import { formatMoney, type Expense } from '@dash4/shared'
import { api } from '@/services/api'
import { useSyncStore } from '@/stores/sync'
import { openLightbox } from '@/utils/lightbox'
import { useExpensesStore } from '@/stores/expenses'
import { expenseColor, expensesToReview } from '@/utils/expenses'

/** Mes dépenses (et celles de mes caisses) ; saisie hors ligne. */
const store = useExpensesStore()
const sync = useSyncStore()
const segment = ref<'mine' | 'all' | 'review'>(store.canDecide() ? 'review' : 'mine')
const query = ref('')
const search = (items: Expense[]) =>
  query.value.trim() ? items.filter((e) => matches(query.value, e.label, e.description, e.category?.name, e.project?.name, e.space?.name, e.creator?.full_name, e.amount)) : items
// À vérifier (comptabilité) : à valider, puis à rembourser
const review = computed(() => {
  const r = expensesToReview(store.sorted)
  return { toValidate: search(r.toValidate), toReimburse: search(r.toReimburse) }
})
const list = computed(() => {
  const items = segment.value === 'mine' ? store.mine : store.sorted
  return query.value.trim() ? items.filter((e) => matches(query.value, e.label, e.description, e.category?.name, e.project?.name, e.space?.name, e.creator?.full_name, e.amount)) : items
})

onMounted(async () => {
  await store.load()
  void store.refresh().catch(() => undefined)
})

async function onRefresh(event: RefresherCustomEvent): Promise<void> {
  await store.refresh().catch(() => undefined)
  await event.target.complete()
}

async function showReceipt(e: Expense): Promise<void> {
  if (!e.document) return
  if (!sync.online) {
    const toast = await toastController.create({ message: 'Le justificatif se consulte avec le réseau.', duration: 2500, position: 'top' })
    return void (await toast.present())
  }
  const blob = await api.documents.download(e.document).catch(() => null)
  if (blob) openLightbox([{ src: URL.createObjectURL(blob), caption: `${e.label} — ${formatMoney(e.amount)}` }])
}

async function refuse(e: Expense): Promise<void> {
  const alert = await alertController.create({
    header: 'Refuser la dépense',
    message: `${e.label} — ${formatMoney(e.amount)}`,
    inputs: [{ name: 'reason', type: 'textarea', placeholder: 'Motif (obligatoire) : reçu illisible, hors projet…' }],
    buttons: [
      { text: 'Annuler', role: 'cancel' },
      { text: 'Refuser', role: 'confirm', handler: (v: { reason?: string }) => !!v.reason?.trim() },
    ],
  })
  await alert.present()
  const { role, data } = await alert.onDidDismiss<{ values: { reason?: string } }>()
  if (role === 'confirm' && data?.values.reason?.trim()) await decide(e, 'reject', data.values.reason.trim())
}

async function decide(e: Expense, action: 'approve' | 'reject' | 'reimburse', reason: string | null = null): Promise<void> {
  await store.decide(e, action, reason)
  const done = { approve: 'Dépense validée', reject: 'Dépense refusée', reimburse: 'Remboursement noté' }[action]
  const toast = await toastController.create({ message: sync.online ? `${done}.` : `${done} : envoyé dès le retour du réseau.`, duration: 2000, position: 'top' })
  await toast.present()
}

/** Actions sur une dépense, selon les droits et son état. */
async function actions(e: Expense): Promise<void> {
  const buttons: Array<{ text: string; role?: string; handler?: () => void }> = []
  if (e.document) buttons.push({ text: 'Voir le justificatif', handler: () => void showReceipt(e) })
  if (store.canDecide()) {
    if (e.status.value === 'submitted' || e.status.value === 'rejected') buttons.push({ text: 'Valider', handler: () => void decide(e, 'approve') })
    if (e.status.value === 'submitted' || e.status.value === 'approved') buttons.push({ text: 'Refuser…', role: 'destructive', handler: () => void refuse(e) })
    if (e.to_reimburse) buttons.push({ text: `Rembourser ${e.creator?.full_name ?? ''}`.trim(), handler: () => void decide(e, 'reimburse') })
  }
  if (!buttons.length) return
  buttons.push({ text: 'Fermer', role: 'cancel' })
  const sheet = await actionSheetController.create({ header: `${e.label} — ${formatMoney(e.amount)}`, subHeader: [e.creator?.full_name, e.project?.name].filter(Boolean).join(' · '), buttons })
  await sheet.present()
}

const date = (iso: string | null) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '')
</script>

<template>
  <IonPage>
    <IonHeader>
      <IonToolbar><IonTitle>Dépenses</IonTitle></IonToolbar>
      <IonToolbar><IonSearchbar v-model="query" :debounce="150" placeholder="Libellé, catégorie, projet, montant…" aria-label="Rechercher" /></IonToolbar>
      <IonToolbar v-if="store.spaces.length || store.canDecide()">
        <IonSegment v-model="segment" scrollable>
          <IonSegmentButton v-if="store.canDecide()" value="review">
            <IonLabel>À vérifier<template v-if="review.toValidate.length"> ({{ review.toValidate.length }})</template></IonLabel>
          </IonSegmentButton>
          <IonSegmentButton value="mine"><IonLabel>Les miennes</IonLabel></IonSegmentButton>
          <IonSegmentButton value="all"><IonLabel>{{ store.canDecide() ? 'Toutes' : 'Avec mes caisses' }}</IonLabel></IonSegmentButton>
        </IonSegment>
      </IonToolbar>
    </IonHeader>

    <IonContent>
      <IonRefresher slot="fixed" @ion-refresh="onRefresh">
        <IonRefresherContent pulling-text="Tirer pour actualiser" refreshing-spinner="crescent" />
      </IonRefresher>

      <IonList inset>
        <IonItem v-if="store.toReimburse">
          <IonLabel>À me rembourser</IonLabel>
          <IonNote slot="end" color="warning"><strong>{{ formatMoney(store.toReimburse) }}</strong></IonNote>
        </IonItem>
        <IonItem v-for="s in store.spaces" :key="s.id">
          <IonLabel>Caisse {{ s.name }}</IonLabel>
          <IonNote slot="end" :color="s.balance < 0 ? 'danger' : undefined">{{ formatMoney(s.balance) }}</IonNote>
        </IonItem>
      </IonList>

      <IonList v-if="store.pending.length" inset>
        <IonListHeader><IonLabel>En attente d'envoi</IonLabel></IonListHeader>
        <IonItem v-for="p in store.pending" :key="p.id">
          <IonIcon slot="start" :icon="cloudOfflineOutline" color="medium" />
          <IonLabel class="ion-text-wrap">
            <h3>{{ p.payload.label }}</h3>
            <p v-if="p.lastError"><IonText color="danger">{{ p.lastError }}</IonText></p>
            <p v-else-if="store.hasPendingReceipt(p.id)">Avec justificatif</p>
          </IonLabel>
          <IonNote slot="end">{{ formatMoney(Number(p.payload.amount)) }}</IonNote>
        </IonItem>
      </IonList>

      <template v-if="segment === 'review'">
        <IonList inset>
          <IonListHeader><IonLabel>À valider</IonLabel></IonListHeader>
          <IonItem v-for="e in review.toValidate" :key="e.id" button :detail="false" @click="actions(e)">
            <IonLabel class="ion-text-wrap">
              <h3>{{ e.label }} <IonIcon v-if="e.document" :icon="attachOutline" color="medium" /></h3>
              <p>{{ [date(e.spent_at), e.creator?.full_name, e.project?.name ?? (e.quote ? `Devis ${e.quote.number}` : null)].filter(Boolean).join(' · ') }}</p>
              <p v-if="!e.project && !e.quote"><IonText color="warning">Sans projet ni devis</IonText></p>
              <div class="review-actions">
                <IonButton size="small" color="success" @click.stop="decide(e, 'approve')">Valider</IonButton>
                <IonButton size="small" fill="outline" color="danger" @click.stop="refuse(e)">Refuser</IonButton>
                <IonButton v-if="e.document" size="small" fill="clear" @click.stop="showReceipt(e)">Justificatif</IonButton>
              </div>
            </IonLabel>
            <div slot="end" class="end"><strong>{{ formatMoney(e.amount) }}</strong><IonBadge v-if="e.advanced" color="warning">Avancée</IonBadge></div>
          </IonItem>
          <IonItem v-if="!review.toValidate.length" lines="none"><IonText color="medium"><p>Rien à valider.</p></IonText></IonItem>
        </IonList>
        <IonList v-if="review.toReimburse.length" inset>
          <IonListHeader><IonLabel>À rembourser</IonLabel></IonListHeader>
          <IonItem v-for="e in review.toReimburse" :key="e.id" button :detail="false" @click="actions(e)">
            <IonLabel class="ion-text-wrap">
              <h3>{{ e.creator?.full_name ?? '—' }}</h3>
              <p>{{ [e.label, date(e.spent_at), e.project?.name].filter(Boolean).join(' · ') }}</p>
            </IonLabel>
            <div slot="end" class="end">
              <strong>{{ formatMoney(e.amount) }}</strong>
              <IonButton size="small" fill="outline" @click.stop="decide(e, 'reimburse')">Rembourser</IonButton>
            </div>
          </IonItem>
        </IonList>
      </template>

      <IonList v-else inset>
        <IonItem v-for="e in list" :key="e.id" :button="!!e.document || store.canDecide()" :detail="false" @click="actions(e)">
          <IonLabel class="ion-text-wrap">
            <h3>{{ e.label }} <IonIcon v-if="e.document" :icon="attachOutline" color="medium" /></h3>
            <p>{{ [date(e.spent_at), e.category?.name, e.space?.name, e.project?.name].filter(Boolean).join(' · ') }}</p>
            <p v-if="e.rejection_reason"><IonText color="danger">Refusée : {{ e.rejection_reason }}</IonText></p>
          </IonLabel>
          <div slot="end" class="end">
            <strong>{{ formatMoney(e.amount) }}</strong>
            <IonBadge :color="e.to_reimburse ? 'warning' : expenseColor(e.status.value)">{{ e.to_reimburse ? 'À rembourser' : e.status.label }}</IonBadge>
          </div>
        </IonItem>
      </IonList>
      <div v-if="segment !== 'review' && !list.length && !store.pending.length" class="ion-padding ion-text-center">
        <IonText color="medium"><p>Aucune dépense. Touchez + pour en noter une, même sans réseau.</p></IonText>
      </div>

      <IonFab slot="fixed" vertical="bottom" horizontal="end">
        <IonFabButton :router-link="{ name: 'expense-new' }" aria-label="Nouvelle dépense"><IonIcon :icon="add" /></IonFabButton>
      </IonFab>
    </IonContent>
  </IonPage>
</template>

<style scoped>
.review-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  margin-top: 0.375rem;
}

.end {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.25rem;
}
</style>
