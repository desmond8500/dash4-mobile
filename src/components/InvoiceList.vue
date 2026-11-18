<script setup lang="ts">
import { IonBadge, IonItem, IonLabel, IonList, IonListHeader, IonNote } from '@ionic/vue'
import { formatMoney, type Invoice } from '@dash4/shared'
import { invoiceBadge, isUnpaid } from '@/utils/invoices'

/** Factures d'un client, d'un projet ou d'un devis (fiches du mobile). */
const props = defineProps<{ invoices: Invoice[]; header?: string }>()
</script>

<template>
  <IonList v-if="props.invoices.length" inset>
    <IonListHeader><IonLabel>{{ props.header ?? 'Factures' }}</IonLabel></IonListHeader>
    <IonItem v-for="i in props.invoices" :key="i.id" :router-link="{ name: 'invoice', params: { id: i.id } }" detail>
      <IonLabel class="ion-text-wrap">
        <h3>{{ i.number ?? 'Brouillon' }} · {{ i.title }}</h3>
        <p>
          <IonBadge :color="invoiceBadge(i).color">{{ invoiceBadge(i).label }}</IonBadge>
          <IonNote> {{ formatMoney(i.total) }}</IonNote>
          <IonNote v-if="isUnpaid(i)"> · reste {{ formatMoney(i.remaining_amount) }}</IonNote>
        </p>
      </IonLabel>
    </IonItem>
  </IonList>
</template>
