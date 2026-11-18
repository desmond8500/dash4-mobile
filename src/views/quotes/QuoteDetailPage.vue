<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  IonBackButton,
  IonBadge,
  IonButtons,
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonNote,
  IonPage,
  IonSpinner,
  IonText,
  IonTitle,
  IonToolbar,
} from '@ionic/vue'
import { formatMoney, type Quote } from '@dash4/shared'
import { useAuthStore } from '@/stores/auth'
import { useQuotesStore } from '@/stores/quotes'
import { formatDate } from '@/utils/projects'
import { quoteStatusColor } from '@/utils/quotes'

/** Devis en lecture sur le téléphone (la rédaction se fait sur le web). */
const props = defineProps<{ id: string }>()
const auth = useAuthStore()
const store = useQuotesStore()

const quote = ref<Quote | null>(null)
const offline = ref(false)
const loading = ref(true)
const error = ref<string | null>(null)
const showPrices = computed(() => auth.can('prices.view'))
const money = (v: number | undefined) => (v === undefined ? '' : formatMoney(v))
const qty = (v: number) => v.toLocaleString('fr-FR', { maximumFractionDigits: 2 })

onMounted(async () => {
  try {
    const result = await store.detail(Number(props.id))
    quote.value = result.quote
    offline.value = result.offline
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <IonPage>
    <IonHeader>
      <IonToolbar>
        <IonButtons slot="start">
          <IonBackButton default-href="/clients" text="Retour" />
        </IonButtons>
        <IonTitle>{{ quote?.number ?? 'Devis' }}</IonTitle>
      </IonToolbar>
    </IonHeader>

    <IonContent>
      <div v-if="loading" class="ion-padding ion-text-center"><IonSpinner /></div>
      <div v-else-if="!quote" class="ion-padding ion-text-center">
        <IonText color="medium">
          <p>{{ error ?? "Ce devis n'a pas encore été ouvert avec le réseau : il n'est pas disponible hors ligne." }}</p>
        </IonText>
      </div>

      <template v-else>
        <div v-if="offline" class="ion-padding-horizontal ion-padding-top">
          <IonNote>Hors ligne : dernière version consultée.</IonNote>
        </div>

        <IonList inset>
          <IonItem>
            <IonLabel class="ion-text-wrap">
              <h1>{{ quote.number }}</h1>
              <h2>{{ quote.title }}</h2>
              <p>{{ quote.client?.name }}<template v-if="quote.project"> · {{ quote.project.name }}</template></p>
            </IonLabel>
            <IonBadge slot="end" :color="quoteStatusColor(quote.status.value)">{{ quote.status.label }}</IonBadge>
          </IonItem>
          <IonItem>
            <IonLabel>Date</IonLabel>
            <IonNote slot="end">{{ formatDate(quote.issued_at) }}<template v-if="quote.valid_until"> · valable au {{ formatDate(quote.valid_until) }}</template></IonNote>
          </IonItem>
          <template v-if="showPrices">
            <IonItem>
              <IonLabel>Total hors taxes</IonLabel>
              <IonNote slot="end">{{ money(quote.subtotal) }}</IonNote>
            </IonItem>
            <IonItem v-if="quote.discount_amount">
              <IonLabel>Remise ({{ quote.discount_rate }} %)</IonLabel>
              <IonNote slot="end">− {{ money(quote.discount_amount) }}</IonNote>
            </IonItem>
            <IonItem v-if="quote.tax_mode.value !== 'none'">
              <IonLabel>{{ quote.tax_mode.value === 'vat' ? `TVA (${quote.vat_rate} %)` : `Retenue BRS (${quote.brs_rate} %)` }}</IonLabel>
              <IonNote slot="end">{{ quote.tax_mode.value === 'brs' ? '− ' : '' }}{{ money(quote.tax_amount) }}</IonNote>
            </IonItem>
            <IonItem>
              <IonLabel><strong>{{ quote.tax_mode.value === 'vat' ? 'Total TTC' : quote.tax_mode.value === 'brs' ? 'Net à payer' : 'Total' }}</strong></IonLabel>
              <IonNote slot="end" color="dark"><strong>{{ money(quote.total) }}</strong></IonNote>
            </IonItem>
          </template>
        </IonList>

        <IonList v-for="section in (quote.sections ?? []).filter((s) => s.is_visible)" :key="section.id" inset>
          <IonListHeader>
            <IonLabel>{{ section.title }}</IonLabel>
            <IonNote v-if="showPrices" class="ion-padding-end">{{ money(section.subtotal) }}</IonNote>
          </IonListHeader>
          <IonItem v-for="line in section.lines" :key="line.id">
            <IonLabel class="ion-text-wrap">
              <h3>{{ line.designation }}</h3>
              <p v-if="line.reference">{{ line.reference }}</p>
              <p>
                {{ qty(line.quantity) }} {{ line.unit ?? '' }}
                <template v-if="showPrices"> × {{ money(line.unit_price) }}</template>
              </p>
            </IonLabel>
            <IonNote v-if="showPrices" slot="end">{{ money(line.line_total) }}</IonNote>
          </IonItem>
          <IonItem v-if="!section.lines.length"><IonLabel color="medium">Aucune ligne.</IonLabel></IonItem>
        </IonList>

        <IonList v-if="quote.payment_terms" inset>
          <IonListHeader><IonLabel>Modalités de paiement</IonLabel></IonListHeader>
          <IonItem><IonLabel class="ion-text-wrap pre">{{ quote.payment_terms }}</IonLabel></IonItem>
        </IonList>
      </template>
    </IonContent>
  </IonPage>
</template>

<style scoped>
.pre {
  white-space: pre-line;
}
</style>
