<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  IonBackButton,
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
  IonRefresher,
  IonRefresherContent,
  IonSearchbar,
  IonSegment,
  IonSegmentButton,
  IonText,
  IonTitle,
  IonToolbar,
  toastController,
  type RefresherCustomEvent,
} from '@ionic/vue'
import { qrCodeOutline } from 'ionicons/icons'
import { loanDueText, TOOL_STATUS_LABELS } from '@dash4/shared'
import { useToolsStore } from '@/stores/tools'
import { useAuthStore } from '@/stores/auth'
import BarcodeScanner from '@/components/BarcodeScanner.vue'
import { matches } from '@/utils/home'
import { scannerSupported } from '@/utils/stock'
import { displayedStatus, toolColor } from '@/utils/tools'

/** Outillage : outils visibles par le compte (hors ligne), scan de l'étiquette QR pour ouvrir la fiche. */
const store = useToolsStore()
const auth = useAuthStore()
const router = useRouter()
const canScan = scannerSupported()
const scanOpen = ref(false)
const seeAll = auth.can('tools.view')
const segment = ref<'all' | 'available' | 'lent' | 'late' | 'mine'>(seeAll ? 'all' : 'mine')
const query = ref('')

onMounted(() => void store.load().then(() => store.refresh()).catch(() => undefined))

async function onRefresh(event: RefresherCustomEvent): Promise<void> {
  await store.refresh().catch(() => undefined)
  await event.target.complete()
}

const statusOf = (t: (typeof store.items)[number]) => displayedStatus(t, store.pendingFor(t.id))
const shown = computed(() =>
  store.visible
    .filter((t) => {
      const s = statusOf(t)
      if (segment.value === 'available') return s === 'available'
      if (segment.value === 'lent') return s === 'lent' || s === 'late'
      if (segment.value === 'late') return s === 'late'
      if (segment.value === 'mine') return t.current_loan?.borrower_id === auth.user?.id
      return true
    })
    .filter((t) => !query.value.trim() || matches(query.value, t.name, t.code, t.serial_number, t.article?.designation, t.current_loan?.borrower_label))
    .slice(0, 300),
)

async function onCode(code: string): Promise<void> {
  const found = store.byScan(code)
  if (found) {
    void router.push({ name: 'tool', params: { id: found.id } })
    return
  }
  query.value = code
  const toast = await toastController.create({ message: `Aucun outil avec le code ${code}.`, duration: 3000, color: 'warning' })
  await toast.present()
}
</script>

<template>
  <IonPage>
    <IonHeader>
      <IonToolbar>
        <IonButtons slot="start"><IonBackButton default-href="/accueil" text="Retour" /></IonButtons>
        <IonTitle>Outillage</IonTitle>
        <IonButtons slot="end">
          <IonButton v-if="canScan" aria-label="Scanner l'étiquette d'un outil" @click="scanOpen = true"><IonIcon slot="icon-only" :icon="qrCodeOutline" /></IonButton>
        </IonButtons>
      </IonToolbar>
      <IonToolbar v-if="seeAll">
        <IonSegment v-model="segment" scrollable>
          <IonSegmentButton value="all"><IonLabel>Tous</IonLabel></IonSegmentButton>
          <IonSegmentButton value="available"><IonLabel>Disponibles</IonLabel></IonSegmentButton>
          <IonSegmentButton value="lent"><IonLabel>Prêtés</IonLabel></IonSegmentButton>
          <IonSegmentButton v-if="store.lateCount" value="late"><IonLabel>En retard ({{ store.lateCount }})</IonLabel></IonSegmentButton>
          <IonSegmentButton v-if="store.mine.length" value="mine"><IonLabel>Chez moi</IonLabel></IonSegmentButton>
        </IonSegment>
      </IonToolbar>
      <IonToolbar><IonSearchbar v-model="query" :debounce="150" placeholder="Outil, numéro, emprunteur…" aria-label="Rechercher un outil" /></IonToolbar>
    </IonHeader>
    <IonContent>
      <IonRefresher slot="fixed" @ion-refresh="onRefresh"><IonRefresherContent /></IonRefresher>
      <IonList>
        <IonItem v-for="t in shown" :key="t.id" button :router-link="{ name: 'tool', params: { id: t.id } }">
          <IonLabel class="ion-text-wrap">
            <h2>{{ t.name }}</h2>
            <p>{{ [t.code, t.storage_location?.name].filter(Boolean).join(' · ') }}</p>
            <p v-if="t.current_loan">
              Chez {{ t.current_loan.borrower_label }} ·
              <IonText :color="toolColor(t.current_loan.state)">{{ loanDueText(t.current_loan) }}</IonText>
            </p>
          </IonLabel>
          <IonNote slot="end" :color="toolColor(statusOf(t))">{{ TOOL_STATUS_LABELS[statusOf(t)] }}</IonNote>
        </IonItem>
      </IonList>
      <p v-if="store.loaded && !shown.length" class="ion-padding ion-text-center">
        <IonText color="medium">{{ seeAll ? 'Aucun outil ne correspond.' : 'Aucun outil en prêt chez vous.' }}</IonText>
      </p>
      <BarcodeScanner v-model:open="scanOpen" title="Scanner un outil" @code="onCode" />
    </IonContent>
  </IonPage>
</template>
