<script setup lang="ts" generic="T extends { id: number | string }">
import { useIonRouter } from '@ionic/vue'
import type { RouteLocationRaw } from 'vue-router'

/**
 * Liste affichée en cartes (une colonne sur téléphone, plusieurs sur tablette), comme sur le web.
 * Une carte ouvre sa fiche au toucher (`to`) ; les boutons dans une carte arrêtent le toucher (`@click.stop`).
 */
const props = withDefaults(
  defineProps<{ items: T[]; to?: (item: T) => RouteLocationRaw; cardClass?: string; minWidth?: string }>(),
  { minWidth: '16rem' },
)
const router = useIonRouter()
const open = (item: T) => props.to && router.push(props.to(item))
</script>

<template>
  <div class="card-list" :style="{ '--card-min': props.minWidth }">
    <article
      v-for="item in props.items"
      :key="item.id"
      class="entity-card"
      :class="[props.cardClass, { clickable: !!props.to }]"
      :tabindex="props.to ? 0 : undefined"
      :role="props.to ? 'link' : undefined"
      @click="open(item)"
      @keydown.enter.self="open(item)"
    >
      <slot name="card" :item="item" />
    </article>
  </div>
</template>

<style scoped>
.card-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(var(--card-min), 100%), 1fr));
  gap: 0.75rem;
  padding: 0.75rem 1rem;
}
</style>
