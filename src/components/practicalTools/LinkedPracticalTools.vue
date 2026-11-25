<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { IonIcon, IonItem, IonLabel, IonList, IonListHeader } from '@ionic/vue'
import { calculatorOutline } from 'ionicons/icons'
import { ApiError, type RecordPracticalTool } from '@dash4/shared'
import { api } from '@/services/api'
import { kv } from '@/offline/db'
import { plain } from '@/offline/collection'

/**
 * Outils pratiques liés à l'article, à sa marque ou à son fournisseur (sans doublon), gardés pour le hors ligne.
 */
const props = defineProps<{ articleId: number; brandId?: number | null; providerId?: number | null }>()
const tools = ref<RecordPracticalTool[]>([])
const key = () => `practicalTools.article.${props.articleId}`

onMounted(async () => {
  try {
    const lists = await Promise.all([
      api.practicalTools.forRecord('articles', props.articleId),
      props.brandId ? api.practicalTools.forRecord('brands', props.brandId) : Promise.resolve([]),
      props.providerId ? api.practicalTools.forRecord('providers', props.providerId) : Promise.resolve([]),
    ])
    tools.value = lists.flat().filter((t, i, all) => all.findIndex((x) => x.tool === t.tool) === i)
    await kv.set(key(), plain(tools.value))
  } catch (e) {
    if (e instanceof ApiError && e.status !== 0 && e.status !== 503) return
    tools.value = (await kv.get<RecordPracticalTool[]>(key())) ?? []
  }
})
</script>

<template>
  <IonList v-if="tools.length" inset>
    <IonListHeader><IonLabel>Outils pratiques</IonLabel></IonListHeader>
    <IonItem v-for="t in tools" :key="t.tool" :router-link="{ name: 'practical-tool', params: { slug: t.tool } }" detail>
      <IonIcon slot="start" :icon="calculatorOutline" color="primary" />
      <IonLabel>{{ t.name }}</IonLabel>
    </IonItem>
  </IonList>
</template>
