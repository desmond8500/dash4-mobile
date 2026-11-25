<script setup lang="ts">
import { computed, onMounted, ref, type Component } from 'vue'
import { IonBackButton, IonButtons, IonContent, IonHeader, IonItem, IonLabel, IonList, IonListHeader, IonNote, IonPage, IonTitle, IonToolbar } from '@ionic/vue'
import { ApiError, practicalTool, type PracticalToolLink } from '@dash4/shared'
import { api } from '@/services/api'
import { kv } from '@/offline/db'
import { plain } from '@/offline/collection'
import GalaxyDimensionTool from '@/components/practicalTools/GalaxyDimensionTool.vue'

/** Un outil pratique (calcul hors ligne), puis les marques, fournisseurs et articles liés (gérés sur le web). */
const props = defineProps<{ slug: string }>()
const tool = computed(() => practicalTool(props.slug))
const components: Record<string, Component> = { 'galaxy-dimension-text': GalaxyDimensionTool }
const links = ref<PracticalToolLink[]>([])
const TYPE_LABELS = { brands: 'Marque', providers: 'Fournisseur', articles: 'Article' }

onMounted(async () => {
  const key = `practicalTools.links.${props.slug}`
  try {
    links.value = (await api.practicalTools.list()).find((t) => t.slug === props.slug)?.links ?? []
    await kv.set(key, plain(links.value))
  } catch (e) {
    if (e instanceof ApiError && e.status !== 0 && e.status !== 503) return
    links.value = (await kv.get<PracticalToolLink[]>(key)) ?? []
  }
})
</script>

<template>
  <IonPage>
    <IonHeader>
      <IonToolbar>
        <IonButtons slot="start"><IonBackButton default-href="/outils-pratiques" text="Retour" /></IonButtons>
        <IonTitle>{{ tool?.name ?? 'Outil' }}</IonTitle>
      </IonToolbar>
    </IonHeader>
    <IonContent class="ion-padding">
      <template v-if="tool">
        <p class="description">{{ tool.description }}</p>
        <component :is="components[tool.slug]" />

        <IonList v-if="links.length" inset class="links">
          <IonListHeader><IonLabel>Lié à</IonLabel></IonListHeader>
          <IonItem
            v-for="l in links"
            :key="l.id"
            :router-link="l.type === 'articles' ? { name: 'stock-article', params: { id: l.target.id } } : undefined"
            :detail="l.type === 'articles'"
          >
            <IonLabel>
              <h3>{{ l.target.name }}</h3>
              <p v-if="l.target.reference">{{ l.target.reference }}</p>
            </IonLabel>
            <IonNote slot="end">{{ TYPE_LABELS[l.type] }}</IonNote>
          </IonItem>
        </IonList>
      </template>
      <p v-else>Outil introuvable.</p>
    </IonContent>
  </IonPage>
</template>

<style scoped>
.description {
  margin-top: 0;
  color: var(--ion-color-medium);
}
.links {
  margin: 1.5rem 0 0;
}
</style>
