<script setup lang="ts">
import { codeFontSize, planSymbol, type PlanIcon } from '@dash4/shared'

/** Symbole d'un repère ou d'une ligne de légende : image de l'icône, ou forme colorée avec son code (DOF, CDI…). */
const props = defineProps<{ icon: PlanIcon | null; color: string; image?: string | null; rotation?: number; uid: string }>()
</script>

<template>
  <img v-if="props.icon?.file_path && props.image" :src="props.image" alt="" class="glyph" :style="{ transform: `rotate(${props.rotation ?? 0}deg)` }" />
  <svg v-else class="glyph" viewBox="-1 -1 26 26" aria-hidden="true" :style="{ transform: `rotate(${props.rotation ?? 0}deg)` }">
    <path :d="planSymbol(props.icon?.symbol).path" fill-rule="evenodd" :fill="props.color" stroke="#fff" stroke-width="1.4" paint-order="stroke" />
    <template v-if="props.icon?.secondary_color">
      <clipPath :id="`half-${props.uid}`"><rect x="-1" y="12" width="26" height="13" /></clipPath>
      <path :d="planSymbol(props.icon.symbol).path" fill-rule="evenodd" :fill="props.icon.secondary_color" :clip-path="`url(#half-${props.uid})`" />
    </template>
    <text
      v-if="props.icon?.code"
      x="12"
      :y="12 + codeFontSize(props.icon.code, props.icon.symbol) * 0.36"
      text-anchor="middle"
      font-family="Arial, Helvetica, sans-serif"
      font-weight="700"
      :font-size="codeFontSize(props.icon.code, props.icon.symbol)"
      :fill="props.icon.text_color ?? '#ffffff'"
    >{{ props.icon.code }}</text>
  </svg>
</template>

<style scoped>
.glyph {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}
</style>
