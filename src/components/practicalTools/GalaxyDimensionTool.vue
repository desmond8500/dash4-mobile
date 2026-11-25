<script setup lang="ts">
import { computed, ref } from 'vue'
import { IonButton, IonIcon, IonInput, IonItem, IonNote, IonText, toastController } from '@ionic/vue'
import { copyOutline } from 'ionicons/icons'
import { GALAXY_DIMENSION_MAX_LENGTH, galaxyDimensionText } from '@dash4/shared'

/** Texte → codes du clavier de la centrale Galaxy Dimension (calcul sur le téléphone, hors ligne). */
const text = ref('')
const converted = ref('')
const result = computed(() => (converted.value ? galaxyDimensionText(converted.value) : null))
const codesText = computed(() => result.value?.codes.join(' ') ?? '')

async function copy(): Promise<void> {
  let ok = true
  try {
    await navigator.clipboard.writeText(codesText.value)
  } catch {
    ok = false
  }
  await (await toastController.create({ message: ok ? 'Codes copiés.' : 'Copie impossible : sélectionnez les codes.', duration: 2000, color: ok ? 'success' : 'warning', position: 'top' })).present()
}
</script>

<template>
  <form class="galaxy" @submit.prevent="converted = text">
    <IonItem lines="none" class="field">
      <IonInput v-model="text" label="Entrez un texte :" label-placement="stacked" placeholder="Ex. Entrée principale" autocapitalize="off" :clear-input="true" />
    </IonItem>
    <IonNote class="hint">{{ Array.from(text ?? '').length }} caractère(s) — la centrale garde {{ GALAXY_DIMENSION_MAX_LENGTH }} caractères.</IonNote>
    <IonButton type="submit" class="convert" :disabled="!text?.trim()">Convertir</IonButton>
  </form>

  <section v-if="result" class="result" aria-live="polite">
    <div class="codes-row">
      <span class="codes">{{ codesText || '—' }}</span>
      <IonButton fill="clear" aria-label="Copier les codes" :disabled="!codesText" @click="copy"><IonIcon slot="icon-only" :icon="copyOutline" /></IonButton>
    </div>
    <IonText v-if="result.tooLong" color="warning"><p>{{ Array.from(converted).length }} caractères : la centrale ne garde que les {{ GALAXY_DIMENSION_MAX_LENGTH }} premiers.</p></IonText>
    <IonText v-if="result.unknown.length" color="danger"><p>Sans code sur la centrale (ignoré) : {{ result.unknown.map((c) => `« ${c} »`).join(', ') }}</p></IonText>
    <div class="chars">
      <div v-for="(c, i) in result.chars" :key="i" class="char" :class="{ unknown: !c.code, approx: c.approximated }">
        <span class="char-letter">{{ c.char === ' ' ? '␣' : c.char }}</span>
        <span class="char-code">{{ c.code ?? '?' }}</span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.galaxy {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}
.field {
  --background: var(--ion-card-background, #fff);
  border: 1px solid var(--ion-color-primary);
  border-radius: 8px;
}
.hint {
  font-size: 0.8rem;
  padding: 0 0.25rem;
}
.convert {
  align-self: center;
  min-width: 9rem;
  margin-top: 0.75rem;
  text-transform: uppercase;
  font-weight: 700;
}
.result {
  margin-top: 1.25rem;
  padding-top: 0.75rem;
  border-top: 3px solid var(--ion-color-primary);
}
.codes-row {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}
.codes {
  flex: 1;
  font-size: 1.35rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  word-spacing: 0.3em;
  overflow-wrap: anywhere;
}
.chars {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-top: 0.5rem;
}
.char {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 2.4rem;
  padding: 0.25rem 0.35rem;
  border: 1px solid var(--ion-color-step-150, #e5e7eb);
  border-radius: 6px;
  background: var(--ion-card-background, #fff);
}
.char.approx {
  border-color: var(--ion-color-warning);
}
.char.unknown {
  border-color: var(--ion-color-danger);
  color: var(--ion-color-danger);
}
.char-letter {
  font-size: 0.8rem;
  color: var(--ion-color-medium);
}
.char-code {
  font-weight: 700;
}
</style>
