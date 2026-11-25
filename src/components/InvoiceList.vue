<script setup lang="ts">
import { IonBadge, IonItem, IonLabel, IonList, IonListHeader, IonNote } from '@ionic/vue'
import { formatMoney, type Invoice } from '@dash4/shared'
import { invoiceBadge, isUnpaid } from '@/utils/invoices'
import CardList from '@/components/CardList.vue'

/** Factures d'un client, d'un projet ou d'un devis (fiches du mobile). */
const props = defineProps<{ invoices: Invoice[]; header?: string; cards?: boolean }>()
</script>

<template>
  <template v-if="props.cards && props.invoices.length">
    <IonListHeader><IonLabel>{{ props.header ?? 'Factures' }}</IonLabel></IonListHeader>
    <CardList :items="props.invoices" :to="(i) => ({ name: 'invoice', params: { id: i.id } })">
      <template #card="{ item }">
        <div class="card-head">
          <div>
            <span class="card-title">{{ item.number ?? 'Brouillon' }}</span>
            <span class="card-sub">{{ [item.client?.name, item.quote?.number].filter(Boolean).join(' · ') }}</span>
          </div>
        </div>
        <div class="card-text">{{ item.title }}</div>
        <div class="card-meta">
          <span v-if="item.due_at" :class="{ late: item.is_overdue }">Échéance {{ new Date(`${item.due_at}T00:00:00`).toLocaleDateString('fr-FR') }}</span>
          <span v-if="isUnpaid(item)">Reste {{ formatMoney(item.remaining_amount) }}</span>
        </div>
        <div class="card-foot">
          <IonBadge :color="invoiceBadge(item).color">{{ invoiceBadge(item).label }}</IonBadge>
          <span class="card-amount">{{ formatMoney(item.total) }}</span>
        </div>
      </template>
    </CardList>
  </template>
  <IonList v-else-if="props.invoices.length" inset>
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
