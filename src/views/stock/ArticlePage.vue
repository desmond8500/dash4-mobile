<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  IonBackButton,
  IonBadge,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonNote,
  IonPage,
  IonSegment,
  IonSegmentButton,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonText,
  IonTitle,
  IonToolbar,
  toastController,
} from '@ionic/vue'
import { formatMoney, type Article, type StockMovementPayload } from '@dash4/shared'
import { useStockStore } from '@/stores/stock'
import { useProjectsStore } from '@/stores/projects'
import { useAuthStore } from '@/stores/auth'
import { formatQty, stockBadge } from '@/utils/stock'

/** Fiche article : stock à jour (mouvements en attente compris), entrée / sortie / inventaire hors ligne. */
const props = defineProps<{ id: string }>()
const store = useStockStore()
const projects = useProjectsStore()
const auth = useAuthStore()

const article = ref<Article | null>(null)
const offline = ref(false)
const loading = ref(true)
const error = ref<string | null>(null)

const type = ref<StockMovementPayload['type']>('out')
const quantity = ref<number | null>(1)
const reason = ref('')
const projectId = ref<number | null>(null)
const saving = ref(false)

const current = computed(() => (article.value ? store.quantityOf(store.find(article.value.id) ?? article.value) : 0))
const pending = computed(() => (article.value ? store.pendingMovements(article.value.id) : []))
const badge = computed(() => stockBadge({ quantity: current.value, is_low: !!article.value?.is_low }))
const canMove = computed(() => !!article.value?.can.move)
const projectOptions = computed(() => (auth.canAny(['projects.view', 'projects.view.own']) ? projects.active : []))

onMounted(async () => {
  void projects.load()
  try {
    const result = await store.detail(Number(props.id))
    article.value = result.article
    offline.value = result.offline
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    loading.value = false
  }
})

function setType(value: StockMovementPayload['type']): void {
  type.value = value
  quantity.value = value === 'inventory' ? current.value : 1
}

async function save(): Promise<void> {
  const a = article.value
  const qty = Number(quantity.value)
  if (!a || !(qty >= 0) || (type.value !== 'inventory' && qty <= 0)) return
  if (type.value === 'out' && qty > current.value) {
    const toast = await toastController.create({ message: `Stock insuffisant : ${formatQty(current.value)} en stock.`, duration: 3000, color: 'danger' })
    await toast.present()
    return
  }
  saving.value = true
  try {
    await store.move(a, { type: type.value, quantity: qty, reason: reason.value.trim() || null, project_id: projectId.value })
    reason.value = ''
    quantity.value = type.value === 'inventory' ? current.value : 1
    const toast = await toastController.create({ message: 'Mouvement enregistré (envoyé dès que le réseau est là).', duration: 2500, color: 'success' })
    await toast.present()
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <IonPage>
    <IonHeader>
      <IonToolbar>
        <IonButtons slot="start"><IonBackButton default-href="/stock" text="Retour" /></IonButtons>
        <IonTitle>{{ article?.designation ?? 'Article' }}</IonTitle>
      </IonToolbar>
    </IonHeader>

    <IonContent>
      <div v-if="loading" class="ion-padding ion-text-center"><IonSpinner /></div>
      <div v-else-if="!article" class="ion-padding ion-text-center">
        <IonText color="medium"><p>{{ error ?? "Cet article n'est pas sur le téléphone." }}</p></IonText>
      </div>

      <template v-else>
        <div v-if="offline" class="ion-padding-horizontal ion-padding-top"><IonNote>Hors ligne : dernière version connue.</IonNote></div>

        <div class="hero">
          <img v-if="article.image_url" :src="article.image_url" alt="" />
          <div>
            <div class="quantity"><strong>{{ formatQty(current) }}</strong> {{ article.unit ?? '' }}</div>
            <IonBadge :color="badge.color">{{ badge.label }}</IonBadge>
            <p v-if="article.min_quantity !== null"><IonNote>Seuil : {{ formatQty(article.min_quantity) }}</IonNote></p>
          </div>
        </div>

        <IonList inset>
          <IonItem v-if="article.reference"><IonLabel>Référence</IonLabel><IonNote slot="end">{{ article.reference }}</IonNote></IonItem>
          <IonItem v-if="article.barcode"><IonLabel>Code-barres</IonLabel><IonNote slot="end">{{ article.barcode }}</IonNote></IonItem>
          <IonItem><IonLabel>Catégorie</IonLabel><IonNote slot="end">{{ article.category.label }}</IonNote></IonItem>
          <IonItem v-if="article.brand"><IonLabel>Marque</IonLabel><IonNote slot="end">{{ article.brand.name }}</IonNote></IonItem>
          <IonItem v-if="article.location"><IonLabel>Emplacement</IonLabel><IonNote slot="end">{{ article.location }}</IonNote></IonItem>
          <IonItem v-if="article.unit_price !== undefined"><IonLabel>Prix de vente</IonLabel><IonNote slot="end">{{ formatMoney(article.unit_price) }}</IonNote></IonItem>
        </IonList>

        <IonList v-if="canMove" inset>
          <IonListHeader><IonLabel>Mouvement</IonLabel></IonListHeader>
          <IonItem lines="none">
            <IonSegment :value="type" @ion-change="setType($event.detail.value as StockMovementPayload['type'])">
              <IonSegmentButton value="out"><IonLabel>Sortie</IonLabel></IonSegmentButton>
              <IonSegmentButton value="in"><IonLabel>Entrée</IonLabel></IonSegmentButton>
              <IonSegmentButton value="inventory"><IonLabel>Inventaire</IonLabel></IonSegmentButton>
            </IonSegment>
          </IonItem>
          <IonItem>
            <IonInput v-model.number="quantity" type="number" inputmode="decimal" min="0" :label="type === 'inventory' ? 'Quantité comptée' : 'Quantité'" label-placement="stacked" />
          </IonItem>
          <IonItem>
            <IonInput v-model="reason" label="Motif" label-placement="stacked" :placeholder="type === 'out' ? 'Chantier, casse…' : ''" />
          </IonItem>
          <IonItem v-if="projectOptions.length && type !== 'inventory'">
            <IonSelect v-model="projectId" label="Projet" label-placement="stacked" interface="action-sheet" cancel-text="Annuler">
              <IonSelectOption :value="null">Aucun</IonSelectOption>
              <IonSelectOption v-for="p in projectOptions" :key="p.id" :value="p.id">{{ p.name }}</IonSelectOption>
            </IonSelect>
          </IonItem>
          <div class="ion-padding">
            <IonButton expand="block" :disabled="saving || quantity === null" @click="save">Enregistrer</IonButton>
          </div>
        </IonList>

        <IonList v-if="pending.length" inset>
          <IonListHeader><IonLabel>En attente d'envoi</IonLabel></IonListHeader>
          <IonItem v-for="p in pending" :key="p.id">
            <IonLabel class="ion-text-wrap">
              <p>{{ p.label }}</p>
              <p v-if="p.lastError"><IonText color="danger">{{ p.lastError }}</IonText></p>
            </IonLabel>
          </IonItem>
        </IonList>

        <IonList v-if="article.movements?.length" inset>
          <IonListHeader><IonLabel>Derniers mouvements</IonLabel></IonListHeader>
          <IonItem v-for="m in article.movements.slice(0, 20)" :key="m.id">
            <IonLabel class="ion-text-wrap">
              <h3>{{ m.type.label }}<template v-if="m.reason"> · {{ m.reason }}</template></h3>
              <p>{{ m.moved_at ? new Date(m.moved_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '' }}<template v-if="m.creator"> · {{ m.creator.full_name }}</template></p>
            </IonLabel>
            <IonNote slot="end" :color="m.quantity < 0 ? 'danger' : 'success'">{{ m.quantity > 0 ? '+' : '' }}{{ formatQty(m.quantity) }}</IonNote>
          </IonItem>
        </IonList>
      </template>
    </IonContent>
  </IonPage>
</template>

<style scoped>
.hero {
  display: flex;
  gap: 1rem;
  align-items: center;
  padding: 1rem 1rem 0;
}

.hero img {
  width: 96px;
  height: 96px;
  object-fit: contain;
}

.quantity strong {
  font-size: 2rem;
}
</style>
