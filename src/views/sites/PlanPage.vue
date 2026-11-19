<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonModal,
  IonNote,
  IonPage,
  IonSpinner,
  IonText,
  IonTitle,
  IonToolbar,
} from '@ionic/vue'
import { add, chevronBack, chevronForward, remove } from 'ionicons/icons'
import { placeLabel } from '@dash4/shared'
import type { PlanMarker } from '@dash4/shared'
import { useSitesStore } from '@/stores/sites'

/** Plan d'un chantier avec ses repères : toucher un repère montre l'équipement. Lisible hors ligne une fois ouvert. */
const props = defineProps<{ projectId: string; planId: string }>()
const store = useSitesStore()
const projectId = computed(() => Number(props.projectId))
const plan = computed(() => (store.plans[projectId.value] ?? []).find((p) => p.id === Number(props.planId)) ?? null)
const site = computed(() => store.sites[projectId.value] ?? null)
const image = ref<{ url: string; pages: number } | null>(null)
const page = ref(1)
const zoom = ref(1)
const loading = ref(true)
const error = ref<string | null>(null)
const selected = ref<PlanMarker | null>(null)

const markers = computed(() => (plan.value?.markers ?? []).filter((m) => m.page === page.value))
const equipment = (id: number | null) => site.value?.systems.flatMap((s) => (s.equipment ?? []).map((e) => ({ ...e, system: s.name }))).find((e) => e.id === id)

async function render(pageNumber: number): Promise<void> {
  if (!plan.value) return
  loading.value = true
  error.value = null
  try {
    const blob = await store.planFile(plan.value)
    if (image.value) URL.revokeObjectURL(image.value.url)
    if (plan.value.kind === 'pdf') {
      const { pdfPageImage } = await import('@/utils/pdf')
      const r = await pdfPageImage(await blob.arrayBuffer(), pageNumber)
      image.value = { url: r.url, pages: r.pages }
    } else {
      image.value = { url: URL.createObjectURL(blob), pages: 1 }
    }
    page.value = pageNumber
  } catch {
    error.value = "Le plan n'a pas pu être ouvert. Ouvrez-le une fois avec le réseau pour le garder sur le téléphone."
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await Promise.all([store.load(projectId.value), store.loadPlans(projectId.value)])
  await render(1)
})
onBeforeUnmount(() => image.value && URL.revokeObjectURL(image.value.url))
</script>

<template>
  <IonPage>
    <IonHeader>
      <IonToolbar>
        <IonButtons slot="start"><IonBackButton :default-href="`/chantier/${props.projectId}`" text="Retour" /></IonButtons>
        <IonTitle>{{ plan?.name ?? 'Plan' }}</IonTitle>
        <IonButtons slot="end">
          <IonButton :disabled="zoom <= 1" aria-label="Dézoomer" @click="zoom = Math.max(1, zoom - 0.5)"><IonIcon slot="icon-only" :icon="remove" /></IonButton>
          <IonButton :disabled="zoom >= 4" aria-label="Zoomer" @click="zoom = Math.min(4, zoom + 0.5)"><IonIcon slot="icon-only" :icon="add" /></IonButton>
        </IonButtons>
      </IonToolbar>
      <IonToolbar v-if="image && image.pages > 1">
        <IonButtons slot="start"><IonButton :disabled="page <= 1" @click="render(page - 1)"><IonIcon slot="icon-only" :icon="chevronBack" /></IonButton></IonButtons>
        <IonTitle size="small">Page {{ page }} / {{ image.pages }}</IonTitle>
        <IonButtons slot="end"><IonButton :disabled="page >= image.pages" @click="render(page + 1)"><IonIcon slot="icon-only" :icon="chevronForward" /></IonButton></IonButtons>
      </IonToolbar>
    </IonHeader>
    <IonContent>
      <div v-if="loading" class="center"><IonSpinner /></div>
      <div v-else-if="error" class="ion-padding"><IonText color="danger"><p>{{ error }}</p></IonText></div>
      <div v-else-if="image" class="scroll">
        <div class="stage" :style="{ width: `${zoom * 100}%` }">
          <img :src="image.url" :alt="plan?.name" draggable="false" />
          <button
            v-for="m in markers"
            :key="m.id"
            type="button"
            class="marker"
            :style="{ left: `${m.x * 100}%`, top: `${m.y * 100}%`, background: m.color ?? '#e11d48' }"
            @click="selected = m"
          >
            <span>{{ m.label ?? equipment(m.equipment_id)?.name ?? '' }}</span>
          </button>
        </div>
      </div>

      <IonModal :is-open="!!selected" :initial-breakpoint="0.45" :breakpoints="[0, 0.45, 0.9]" @did-dismiss="selected = null">
        <IonContent v-if="selected" class="ion-padding">
          <template v-if="equipment(selected.equipment_id)">
            <h2>{{ equipment(selected.equipment_id)!.name }}</h2>
            <IonNote>{{ equipment(selected.equipment_id)!.system }} · {{ equipment(selected.equipment_id)!.status.label }}</IonNote>
            <p v-if="site">{{ placeLabel(site, equipment(selected.equipment_id)!.level_id, equipment(selected.equipment_id)!.room_id) }}</p>
            <IonList>
              <IonItem v-for="c in equipment(selected.equipment_id)!.characteristics" :key="c.label">
                <IonLabel>{{ c.label }}</IonLabel><IonNote slot="end" class="mono">{{ c.value }}</IonNote>
              </IonItem>
              <IonItem v-if="equipment(selected.equipment_id)!.serial_number"><IonLabel>N° de série</IonLabel><IonNote slot="end" class="mono">{{ equipment(selected.equipment_id)!.serial_number }}</IonNote></IonItem>
            </IonList>
          </template>
          <template v-else><h2>{{ selected.label ?? 'Repère' }}</h2><IonNote>Repère sans équipement.</IonNote></template>
        </IonContent>
      </IonModal>
    </IonContent>
  </IonPage>
</template>

<style scoped>
.center {
  display: flex;
  justify-content: center;
  padding: 3rem 0;
}

.scroll {
  overflow: auto;
  height: 100%;
}

.stage {
  position: relative;
  min-width: 100%;
}

.stage img {
  display: block;
  width: 100%;
  user-select: none;
}

.marker {
  position: absolute;
  transform: translate(-50%, -50%);
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 2px solid #fff;
  box-shadow: 0 1px 4px rgb(0 0 0 / 0.45);
  padding: 0;
}

.marker span {
  position: absolute;
  left: 24px;
  top: -1px;
  white-space: nowrap;
  font-size: 0.7rem;
  font-weight: 600;
  color: #111827;
  background: rgb(255 255 255 / 0.85);
  padding: 0 0.25rem;
  border-radius: 3px;
}

.marker span:empty {
  display: none;
}

.mono {
  font-family: ui-monospace, monospace;
}
</style>
