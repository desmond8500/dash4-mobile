<script setup lang="ts">
import { IonBadge, IonItem, IonLabel, IonList, IonListHeader, IonNote } from '@ionic/vue'
import { formatMoney, type Quote } from '@dash4/shared'
import { useAuthStore } from '@/stores/auth'
import { quoteStatusColor } from '@/utils/quotes'

/** Devis d'un client ou d'un projet (fiches du mobile). */
const props = defineProps<{ quotes: Quote[] }>()
const auth = useAuthStore()
</script>

<template>
  <IonList v-if="props.quotes.length" inset>
    <IonListHeader><IonLabel>Devis</IonLabel></IonListHeader>
    <IonItem v-for="q in props.quotes" :key="q.id" :router-link="{ name: 'quote', params: { id: q.id } }" detail>
      <IonLabel class="ion-text-wrap">
        <h3>{{ q.number }} · {{ q.title }}</h3>
        <p>
          <IonBadge :color="quoteStatusColor(q.status.value)">{{ q.status.label }}</IonBadge>
          <IonNote v-if="auth.can('prices.view') && q.total !== undefined"> {{ formatMoney(q.total) }}</IonNote>
        </p>
      </IonLabel>
    </IonItem>
  </IonList>
</template>
