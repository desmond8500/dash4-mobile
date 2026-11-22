<script setup lang="ts">
import MarkdownView from '@/components/MarkdownView.vue'
import { computed, onMounted, ref } from 'vue'
import {
  IonBackButton,
  IonBadge,
  IonButton,
  IonButtons,
  IonSegment,
  IonSegmentButton,
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
import { formatMoney, groupLinesByCategory, type Quote, type QuoteLine } from '@dash4/shared'
import { kv } from '@/offline/db'
import { useAuthStore } from '@/stores/auth'
import { useQuotesStore } from '@/stores/quotes'
import { useInvoicesStore } from '@/stores/invoices'
import InvoiceList from '@/components/InvoiceList.vue'
import { formatDate } from '@/utils/projects'
import { quoteStatusColor } from '@/utils/quotes'

/** Devis en lecture sur le téléphone (la rédaction se fait sur le web). */
const props = defineProps<{ id: string }>()
const auth = useAuthStore()
const store = useQuotesStore()
const invoices = useInvoicesStore()
const quoteInvoices = computed(() => invoices.ofQuote(Number(props.id)))

const quote = ref<Quote | null>(null)
const offline = ref(false)
const loading = ref(true)
const error = ref<string | null>(null)
const showPrices = computed(() => auth.can('prices.view'))
const money = (v: number | undefined) => (v === undefined ? '' : formatMoney(v))
const qty = (v: number) => v.toLocaleString('fr-FR', { maximumFractionDigits: 2 })

// Ordre des lignes : celui du devis, ou par catégorie (centrales, organes, accessoires, câbles…) ; choix gardé
const ORDER_KEY = 'quotes.lineOrder'
const order = ref<'quote' | 'category'>('quote')
void kv.get<'quote' | 'category'>(ORDER_KEY).then((v) => v && (order.value = v))
function setOrder(value: 'quote' | 'category'): void {
  order.value = value
  void kv.set(ORDER_KEY, value)
}
const groupsOf = (lines: QuoteLine[]) => (order.value === 'category' ? groupLinesByCategory(lines) : [{ category: null, label: null, lines }])

// Vers le chantier : gestionnaires du chantier, devis rattaché à un projet
const canToSite = computed(() => !!quote.value?.project_id && auth.canAny(['sites.update', 'sites.update.own']))

onMounted(async () => {
  void invoices.load().then(() => invoices.refresh()).catch(() => undefined)
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

        <div class="ion-padding-horizontal tools">
          <IonSegment :value="order" @ion-change="setOrder($event.detail.value as 'quote' | 'category')">
            <IonSegmentButton value="quote"><IonLabel>Ordre du devis</IonLabel></IonSegmentButton>
            <IonSegmentButton value="category"><IonLabel>Par catégorie</IonLabel></IonSegmentButton>
          </IonSegment>
          <IonButton v-if="canToSite" expand="block" fill="outline" :router-link="{ name: 'quote-site', params: { id: quote.id } }">Créer les appareils du chantier</IonButton>
        </div>

        <IonList v-for="section in (quote.sections ?? []).filter((s) => s.is_visible)" :key="section.id" inset>
          <IonListHeader>
            <IonLabel>{{ section.title }}</IonLabel>
            <IonNote v-if="showPrices" class="ion-padding-end">{{ money(section.subtotal) }}</IonNote>
          </IonListHeader>
          <template v-for="group in groupsOf(section.lines)" :key="group.category ?? 'all'">
          <IonItem v-if="group.label" lines="none" class="category"><IonLabel color="medium">{{ group.label }} · {{ group.lines.length }}</IonLabel></IonItem>
          <IonItem v-for="line in group.lines" :key="line.id">
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
          </template>
          <IonItem v-if="!section.lines.length"><IonLabel color="medium">Aucune ligne.</IonLabel></IonItem>
        </IonList>

        <IonList v-if="showPrices && quote.remaining_to_invoice !== undefined && quote.invoices?.length" inset>
          <IonItem>
            <IonLabel>Reste à facturer (hors taxes)</IonLabel>
            <IonNote slot="end">{{ money(quote.remaining_to_invoice) }}</IonNote>
          </IonItem>
        </IonList>
        <InvoiceList :invoices="quoteInvoices" />

        <IonList v-if="quote.payment_terms" inset>
          <IonListHeader><IonLabel>Modalités de paiement</IonLabel></IonListHeader>
          <IonItem><IonLabel class="ion-text-wrap"><MarkdownView :text="quote.payment_terms" /></IonLabel></IonItem>
        </IonList>
      </template>
    </IonContent>
  </IonPage>
</template>

<style scoped>
.tools {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 0.75rem;
}

.category {
  --min-height: 2rem;
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.pre {
  white-space: pre-line;
}
</style>
