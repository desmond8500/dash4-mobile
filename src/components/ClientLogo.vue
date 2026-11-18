<script setup lang="ts">
import { ref, watch } from 'vue'
import { initials } from '@/utils/links'

/** Logo du client ; initiales s'il n'en a pas ou si l'image ne se charge pas (hors ligne). */
const props = withDefaults(defineProps<{ name: string; url?: string | null; size?: number }>(), { size: 40 })

const broken = ref(false)
watch(
  () => props.url,
  () => (broken.value = false),
)
</script>

<template>
  <span
    class="client-logo"
    :style="{ width: `${props.size}px`, height: `${props.size}px`, fontSize: `${props.size * 0.38}px` }"
  >
    <img v-if="props.url && !broken" :src="props.url" alt="" @error="broken = true" />
    <span v-else aria-hidden="true">{{ initials(props.name) }}</span>
  </span>
</template>

<style scoped>
.client-logo {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border-radius: 8px;
  overflow: hidden;
  background: var(--ion-color-light);
  color: var(--ion-color-medium-shade);
  font-weight: 600;
}

.client-logo img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: #fff;
}
</style>
