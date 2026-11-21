<script setup lang="ts">
import MarkdownView from '@/components/MarkdownView.vue'
import { onMounted, ref } from 'vue'
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
import { formatMoney, type Invoice } from '@dash4/shared'
import { useInvoicesStore } from '@/stores/invoices'
import { formatDate } from '@/utils/projects'
import { invoiceBadge } from '@/utils/invoices'

/** Facture en lecture sur le téléphone (émission et paiements sur le web). */
const props = defineProps<{ id: string }>()
const store = useInvoicesStore()

const invoice = ref<Invoice | null>(null)
const offline = ref(false)
const loading = ref(true)
const error = ref<string | null>(null)
const money = (v: number) => formatMoney(v)
const qty = (v: number) => v.toLocaleString('fr-FR', { maximumFractionDigits: 2 })

onMounted(async () => {
  try {
    const result = await store.detail(Number(props.id))
    invoice.value = result.invoice
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
          <IonBackButton default-href="/factures" text="Retour" />
        </IonButtons>
        <IonTitle>{{ invoice?.number ?? 'Facture' }}</IonTitle>
      </IonToolbar>
    </IonHeader>

    <IonContent>
      <div v-if="loading" class="ion-padding ion-text-center"><IonSpinner /></div>
      <div v-else-if="!invoice" class="ion-padding ion-text-center">
        <IonText color="medium">
          <p>{{ error ?? "Cette facture n'a pas encore été ouverte avec le réseau : elle n'est pas disponible hors ligne." }}</p>
        </IonText>
      </div>

      <template v-else>
        <div v-if="offline" class="ion-padding-horizontal ion-padding-top">
          <IonNote>Hors ligne : dernière version consultée.</IonNote>
        </div>

        <IonList inset>
          <IonItem>
            <IonLabel class="ion-text-wrap">
              <h1>{{ invoice.number ?? 'Brouillon' }}</h1>
              <h2>{{ invoice.title }}</h2>
              <p>{{ invoice.client?.name }}<template v-if="invoice.quote"> · devis {{ invoice.quote.number }}</template></p>
            </IonLabel>
            <IonBadge slot="end" :color="invoiceBadge(invoice).color">{{ invoiceBadge(invoice).label }}</IonBadge>
          </IonItem>
          <IonItem v-if="invoice.issued_at">
            <IonLabel>Date</IonLabel>
            <IonNote slot="end">{{ formatDate(invoice.issued_at) }}<template v-if="invoice.due_at"> · échéance {{ formatDate(invoice.due_at) }}</template></IonNote>
          </IonItem>
          <IonItem>
            <IonLabel>Total hors taxes</IonLabel>
            <IonNote slot="end">{{ money(invoice.subtotal) }}</IonNote>
          </IonItem>
          <IonItem v-if="invoice.tax_mode.value !== 'none'">
            <IonLabel>{{ invoice.tax_mode.value === 'vat' ? `TVA (${invoice.vat_rate} %)` : `Retenue BRS (${invoice.brs_rate} %)` }}</IonLabel>
            <IonNote slot="end">{{ invoice.tax_mode.value === 'brs' ? '− ' : '' }}{{ money(invoice.tax_amount) }}</IonNote>
          </IonItem>
          <IonItem>
            <IonLabel><strong>{{ invoice.tax_mode.value === 'vat' ? 'Total TTC' : invoice.tax_mode.value === 'brs' ? 'Net à payer' : 'Total' }}</strong></IonLabel>
            <IonNote slot="end" color="dark"><strong>{{ money(invoice.total) }}</strong></IonNote>
          </IonItem>
          <template v-if="invoice.status.value !== 'draft' && invoice.status.value !== 'cancelled'">
            <IonItem>
              <IonLabel>Déjà réglé</IonLabel>
              <IonNote slot="end">{{ money(invoice.paid_amount) }}</IonNote>
            </IonItem>
            <IonItem>
              <IonLabel><strong>Reste à payer</strong></IonLabel>
              <IonNote slot="end" :color="invoice.is_overdue ? 'danger' : 'dark'"><strong>{{ money(invoice.remaining_amount) }}</strong></IonNote>
            </IonItem>
          </template>
        </IonList>

        <IonList inset>
          <IonListHeader><IonLabel>Lignes</IonLabel></IonListHeader>
          <IonItem v-for="line in invoice.lines ?? []" :key="line.id">
            <IonLabel class="ion-text-wrap">
              <h3>{{ line.designation }}</h3>
              <p>{{ qty(line.quantity) }} {{ line.unit ?? '' }} × {{ money(line.unit_price) }}</p>
            </IonLabel>
            <IonNote slot="end">{{ money(line.line_total) }}</IonNote>
          </IonItem>
        </IonList>

        <IonList v-if="invoice.payments?.length" inset>
          <IonListHeader><IonLabel>Paiements reçus</IonLabel></IonListHeader>
          <IonItem v-for="p in invoice.payments" :key="p.id">
            <IonLabel class="ion-text-wrap">
              <h3>{{ p.method.label }}</h3>
              <p>{{ formatDate(p.paid_at) }}<template v-if="p.reference"> · {{ p.reference }}</template></p>
            </IonLabel>
            <IonNote slot="end">{{ money(p.amount) }}</IonNote>
          </IonItem>
        </IonList>

        <IonList v-if="invoice.payment_terms" inset>
          <IonListHeader><IonLabel>Modalités de paiement</IonLabel></IonListHeader>
          <IonItem><IonLabel class="ion-text-wrap"><MarkdownView :text="invoice.payment_terms" /></IonLabel></IonItem>
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
