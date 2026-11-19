<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
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
  IonRefresher,
  IonRefresherContent,
  IonSearchbar,
  IonSegment,
  IonSelect,
  IonSelectOption,
  IonSegmentButton,
  IonText,
  IonThumbnail,
  IonTitle,
  IonToolbar,
  toastController,
  type RefresherCustomEvent,
} from '@ionic/vue'
import { barcodeOutline, cubeOutline } from 'ionicons/icons'
import { useStockStore } from '@/stores/stock'
import BarcodeScanner from '@/components/BarcodeScanner.vue'
import { formatQty, locationsOf, scannerSupported, stockBadge } from '@/utils/stock'

/** Stock : recherche et scan sans réseau, stock bas. */
const store = useStockStore()
const router = useRouter()
const segment = ref<'all' | 'low'>('all')
const search = ref('')
const scanOpen = ref(false)
const canScan = scannerSupported()

const locationId = ref<number | null>(null)
const locations = computed(() => locationsOf(store.active))
const list = computed(() =>
  store
    .search(search.value, segment.value === 'low' ? store.low : store.active)
    .filter((a) => locationId.value === null || a.storage_location_id === locationId.value)
    .slice(0, 200),
)

const syncedLabel = computed(() =>
  store.syncedAt
    ? `Mis à jour le ${new Date(store.syncedAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}`
    : 'Pas encore synchronisé',
)

onMounted(async () => {
  await store.load()
  void store.refresh().catch(() => undefined)
})

async function onRefresh(event: RefresherCustomEvent): Promise<void> {
  await store.refresh().catch(() => undefined)
  await event.target.complete()
}

async function onCode(code: string): Promise<void> {
  const article = store.byCode(code)
  if (article) {
    void router.push({ name: 'stock-article', params: { id: article.id } })
    return
  }
  search.value = code
  const toast = await toastController.create({ message: `Aucun article avec le code ${code}.`, duration: 3000, color: 'warning' })
  await toast.present()
}
</script>

<template>
  <IonPage>
    <IonHeader>
      <IonToolbar>
        <IonTitle>Stock</IonTitle>
        <IonButtons v-if="canScan" slot="end">
          <IonButton aria-label="Scanner" @click="scanOpen = true"><IonIcon slot="icon-only" :icon="barcodeOutline" /></IonButton>
        </IonButtons>
      </IonToolbar>
      <IonToolbar>
        <IonSearchbar v-model="search" placeholder="Nom, référence, code-barres, marque" :debounce="150" />
      </IonToolbar>
      <IonToolbar>
        <IonSegment v-model="segment">
          <IonSegmentButton value="all"><IonLabel>Tous</IonLabel></IonSegmentButton>
          <IonSegmentButton value="low"><IonLabel>Stock bas ({{ store.low.length }})</IonLabel></IonSegmentButton>
        </IonSegment>
      </IonToolbar>
      <IonToolbar v-if="locations.length">
        <IonSelect v-model="locationId" label="Emplacement" interface="action-sheet" cancel-text="Annuler" class="ion-padding-horizontal">
          <IonSelectOption :value="null">Tous les emplacements</IonSelectOption>
          <IonSelectOption v-for="l in locations" :key="l.id" :value="l.id">{{ l.name }} ({{ l.count }})</IonSelectOption>
        </IonSelect>
      </IonToolbar>
    </IonHeader>

    <IonContent>
      <IonRefresher slot="fixed" @ion-refresh="onRefresh">
        <IonRefresherContent pulling-text="Tirer pour actualiser" refreshing-spinner="crescent" />
      </IonRefresher>
      <div class="ion-padding-horizontal ion-padding-top"><IonNote>{{ syncedLabel }}</IonNote></div>

      <IonList>
        <IonItem v-for="a in list" :key="a.id" :router-link="{ name: 'stock-article', params: { id: a.id } }" detail>
          <IonThumbnail slot="start">
            <img v-if="a.image_url" :src="a.image_url" alt="" />
            <IonIcon v-else :icon="cubeOutline" class="placeholder" />
          </IonThumbnail>
          <IonLabel class="ion-text-wrap">
            <h3>{{ a.designation }}</h3>
            <p>{{ [a.reference, a.brand?.name, a.location].filter(Boolean).join(' · ') }}</p>
          </IonLabel>
          <div slot="end" class="qty">
            <strong>{{ formatQty(store.quantityOf(a)) }}</strong> <span>{{ a.unit ?? '' }}</span>
            <IonBadge v-if="stockBadge({ quantity: store.quantityOf(a), is_low: a.is_low }).color !== 'success'" :color="stockBadge({ quantity: store.quantityOf(a), is_low: a.is_low }).color">
              {{ stockBadge({ quantity: store.quantityOf(a), is_low: a.is_low }).label }}
            </IonBadge>
          </div>
        </IonItem>
      </IonList>
      <div v-if="!list.length" class="ion-padding ion-text-center">
        <IonText color="medium"><p>{{ store.items.length ? 'Aucun article trouvé.' : 'Aucun article sur le téléphone : tirez pour actualiser avec le réseau.' }}</p></IonText>
      </div>

      <BarcodeScanner v-model:open="scanOpen" @code="onCode" />
    </IonContent>
  </IonPage>
</template>

<style scoped>
.qty {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.25rem;
}

.placeholder {
  width: 100%;
  height: 100%;
  color: var(--ion-color-medium);
}

ion-thumbnail img {
  object-fit: contain;
}
</style>
