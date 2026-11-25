<script setup lang="ts">
import { IonButton, IonIcon } from '@ionic/vue'
import { gridOutline, listOutline } from 'ionicons/icons'
import type { ViewMode } from '@/composables/useViewMode'

/** Bouton de la barre du haut : liste ou cartes (le choix est gardé pour chaque écran). */
const mode = defineModel<ViewMode>({ required: true })
</script>

<template>
  <IonButton
    :aria-label="mode === 'cards' ? 'Afficher en liste' : 'Afficher en cartes'"
    :title="mode === 'cards' ? 'Liste' : 'Cartes'"
    @click="mode = mode === 'cards' ? 'table' : 'cards'"
  >
    <IonIcon slot="icon-only" :icon="mode === 'cards' ? listOutline : gridOutline" />
  </IonButton>
</template>
