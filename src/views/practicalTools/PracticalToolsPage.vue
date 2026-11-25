<script setup lang="ts">
import { IonContent, IonHeader, IonIcon, IonPage, IonTitle, IonToolbar } from '@ionic/vue'
import { languageOutline } from 'ionicons/icons'
import { PRACTICAL_TOOLS } from '@dash4/shared'
import CardList from '@/components/CardList.vue'

/** Outils pratiques : calculs et conversions qui marchent aussi hors ligne. */
const icons: Record<string, string> = { 'galaxy-dimension-text': languageOutline }
const tools = PRACTICAL_TOOLS.map((t) => ({ ...t, id: t.slug }))
</script>

<template>
  <IonPage>
    <IonHeader class="ion-no-border">
      <IonToolbar><IonTitle>Outils pratiques</IonTitle></IonToolbar>
    </IonHeader>
    <IonContent>
      <p class="intro">Calculs et conversions pour le terrain, utilisables sans réseau.</p>
      <CardList :items="tools" :to="(t) => ({ name: 'practical-tool', params: { slug: t.slug } })">
        <template #card="{ item }">
          <div class="card-head">
            <span class="tool-icon"><IonIcon :icon="icons[item.slug] ?? languageOutline" /></span>
            <div><span class="card-title">{{ item.name }}</span></div>
          </div>
          <div class="card-text">{{ item.description }}</div>
        </template>
      </CardList>
    </IonContent>
  </IonPage>
</template>

<style scoped>
.intro {
  margin: 0.75rem 1rem 0;
  color: var(--ion-color-medium);
  font-size: 0.9rem;
}
.tool-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.6rem;
  height: 2.6rem;
  border-radius: 10px;
  background: rgba(var(--ion-color-primary-rgb), 0.12);
  color: var(--ion-color-primary);
  font-size: 1.35rem;
}
</style>
