<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonModal,
  IonNote,
  IonSearchbar,
  IonText,
  IonTitle,
  IonToolbar,
} from '@ionic/vue'
import { matches } from '@/utils/home'

/**
 * Liste de choix avec recherche, pour les longues listes (projets, personnes, contacts, tâches…).
 * Un champ affiche le choix ; le toucher ouvre une fenêtre avec une barre de recherche.
 * `action` : bouton d'ajout (le champ reste vide après un choix, seul l'évènement `select` compte).
 */
export interface SearchOption {
  value: number
  label: string
  detail?: string | null
}

const model = defineModel<number | null>({ default: null })
const props = withDefaults(
  defineProps<{ options: SearchOption[]; label: string; placeholder?: string; nullLabel?: string | null; action?: boolean; disabled?: boolean }>(),
  { placeholder: 'Choisir…', nullLabel: null, action: false, disabled: false },
)
const emit = defineEmits<{ select: [value: number | null] }>()

const open = ref(false)
const query = ref('')
const current = computed(() => props.options.find((o) => o.value === model.value) ?? null)
const shown = computed(() => (query.value.trim() ? props.options.filter((o) => matches(query.value, o.label, o.detail)) : props.options))

function choose(value: number | null): void {
  if (!props.action) model.value = value
  emit('select', value)
  open.value = false
  query.value = ''
}
</script>

<template>
  <IonItem button :detail="true" :disabled="props.disabled" @click="open = true">
    <IonLabel class="ion-text-wrap">
      <p>{{ props.label }}</p>
      <h3 v-if="!props.action && current">{{ current.label }}</h3>
      <h3 v-else-if="!props.action && props.nullLabel && model === null">{{ props.nullLabel }}</h3>
      <h3 v-else><IonText color="medium">{{ props.placeholder }}</IonText></h3>
    </IonLabel>
  </IonItem>

  <IonModal :is-open="open" @did-dismiss="open = false">
    <IonHeader>
      <IonToolbar>
        <IonTitle>{{ props.label }}</IonTitle>
        <IonButtons slot="end"><IonButton @click="open = false">Fermer</IonButton></IonButtons>
      </IonToolbar>
      <IonToolbar>
        <IonSearchbar v-model="query" placeholder="Rechercher…" :debounce="100" aria-label="Rechercher dans la liste" />
      </IonToolbar>
    </IonHeader>
    <IonContent>
      <IonList>
        <IonItem v-if="props.nullLabel && !query.trim()" button @click="choose(null)">
          <IonLabel>{{ props.nullLabel }}</IonLabel>
        </IonItem>
        <IonItem v-for="o in shown" :key="o.value" button @click="choose(o.value)">
          <IonLabel class="ion-text-wrap">
            <h3>{{ o.label }}</h3>
            <p v-if="o.detail">{{ o.detail }}</p>
          </IonLabel>
          <IonNote v-if="!props.action && o.value === model" slot="end" color="primary">✓</IonNote>
        </IonItem>
      </IonList>
      <p v-if="!shown.length" class="ion-padding ion-text-center"><IonText color="medium">Rien ne correspond.</IonText></p>
    </IonContent>
  </IonModal>
</template>
