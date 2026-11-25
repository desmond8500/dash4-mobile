<script setup lang="ts">
import ViewModeButton from '@/components/ViewModeButton.vue'
import CardList from '@/components/CardList.vue'
import { useViewMode } from '@/composables/useViewMode'
import { computed, onMounted, ref } from 'vue'
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
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
import { formatMoney } from '@dash4/shared'
import InvoiceList from '@/components/InvoiceList.vue'
import { useInvoicesStore } from '@/stores/invoices'
import { isUnpaid } from '@/utils/invoices'

/** Factures en lecture : à encaisser, en retard, toutes. */
const viewMode = useViewMode('invoices')
const store = useInvoicesStore()
const filter = ref<'unpaid' | 'overdue' | 'all'>('unpaid')
const search = ref('')

const list = computed(() => {
  const term = search.value.trim().toLowerCase()
  return store.visible
    .filter((i) => (filter.value === 'unpaid' ? isUnpaid(i) : filter.value === 'overdue' ? i.is_overdue : true))
    .filter((i) => !term || [i.number, i.title, i.client?.name].some((v) => v?.toLowerCase().includes(term)))
})

onMounted(() => void store.load().then(() => store.refresh()).catch(() => undefined))

async function onRefresh(event: RefresherCustomEvent): Promise<void> {
  await store.refresh().catch(() => undefined)
  await event.target.complete()
}
</script>

<template>
  <IonPage>
    <IonHeader>
      <IonToolbar>
        <IonButtons slot="start"><IonBackButton default-href="/accueil" text="Retour" /></IonButtons>
        <IonTitle>Factures</IonTitle>
        <IonButtons slot="end"><ViewModeButton v-model="viewMode" /></IonButtons>
      </IonToolbar>
      <IonToolbar>
        <IonSegment v-model="filter">
          <IonSegmentButton value="unpaid"><IonLabel>À encaisser</IonLabel></IonSegmentButton>
          <IonSegmentButton value="overdue"><IonLabel>En retard</IonLabel></IonSegmentButton>
          <IonSegmentButton value="all"><IonLabel>Toutes</IonLabel></IonSegmentButton>
        </IonSegment>
      </IonToolbar>
    </IonHeader>

    <IonContent>
      <IonRefresher slot="fixed" @ion-refresh="onRefresh">
        <IonRefresherContent pulling-text="Tirer pour actualiser" refreshing-spinner="crescent" />
      </IonRefresher>

      <IonList inset>
        <IonItem>
          <IonLabel>À encaisser</IonLabel>
          <IonNote slot="end">{{ formatMoney(store.summary.toCollect) }} ({{ store.summary.unpaidCount }})</IonNote>
        </IonItem>
        <IonItem>
          <IonLabel>En retard</IonLabel>
          <IonNote slot="end" :color="store.summary.overdueCount ? 'danger' : undefined">
            {{ formatMoney(store.summary.overdueAmount) }} ({{ store.summary.overdueCount }})
          </IonNote>
        </IonItem>
      </IonList>

      <IonSearchbar v-model="search" placeholder="Numéro, titre, client" :debounce="200" />
      <InvoiceList :invoices="list" :header="`${list.length} facture(s)`" :cards="viewMode === 'cards'" />
      <div v-if="!list.length" class="ion-padding ion-text-center">
        <IonText color="medium"><p>Aucune facture.</p></IonText>
      </div>
    </IonContent>
  </IonPage>
</template>
