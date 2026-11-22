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
} from '@ionic/vue'
import { add, attachOutline, cloudOfflineOutline } from 'ionicons/icons'
import { formatMoney } from '@dash4/shared'
import { useExpensesStore } from '@/stores/expenses'
import { expenseColor } from '@/utils/expenses'

/** Mes dépenses (et celles de mes caisses) ; saisie hors ligne. */
const store = useExpensesStore()
const segment = ref<'mine' | 'all'>('mine')
const query = ref('')
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

const date = (iso: string | null) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '')
</script>

<template>
  <IonPage>
    <IonHeader>
      <IonToolbar><IonTitle>Dépenses</IonTitle></IonToolbar>
      <IonToolbar><IonSearchbar v-model="query" :debounce="150" placeholder="Libellé, catégorie, projet, montant…" aria-label="Rechercher" /></IonToolbar>
      <IonToolbar v-if="store.spaces.length">
        <IonSegment v-model="segment">
          <IonSegmentButton value="mine"><IonLabel>Les miennes</IonLabel></IonSegmentButton>
          <IonSegmentButton value="all"><IonLabel>Avec mes caisses</IonLabel></IonSegmentButton>
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

      <IonList inset>
        <IonItem v-for="e in list" :key="e.id">
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
      <div v-if="!list.length && !store.pending.length" class="ion-padding ion-text-center">
        <IonText color="medium"><p>Aucune dépense. Touchez + pour en noter une, même sans réseau.</p></IonText>
      </div>

      <IonFab slot="fixed" vertical="bottom" horizontal="end">
        <IonFabButton :router-link="{ name: 'expense-new' }" aria-label="Nouvelle dépense"><IonIcon :icon="add" /></IonFabButton>
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
</style>
