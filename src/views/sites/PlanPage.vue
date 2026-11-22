<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
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
  IonListHeader,
  IonModal,
  IonNote,
  IonPage,
  IonSearchbar,
  IonSpinner,
  IonText,
  IonTitle,
  IonToggle,
  IonToolbar,
} from '@ionic/vue'
import { add, chevronBack, chevronForward, contractOutline, layersOutline, listOutline, remove, searchOutline } from 'ionicons/icons'
import { groupLegend, markerColor, planLayers, planLegend, placeLabel, visibleMarkers } from '@dash4/shared'
import type { Equipment, PlanMarker } from '@dash4/shared'
import PlanGlyph from '@/components/PlanGlyph.vue'
import { useSitesStore } from '@/stores/sites'
import { usePlanIconsStore } from '@/stores/planIcons'
import { useSyncStore } from '@/stores/sync'
import { clampZoom, markerMatches, MAX_ZOOM, MIN_ZOOM, pinchZoom, scrollAfterZoom, scrollToPoint } from '@/utils/plans'

/**
 * Plan d'un chantier avec ses repères, lisible hors ligne une fois ouvert :
 * zoom à deux doigts, calques par système, légende, recherche d'un équipement sur le plan.
 */
const props = defineProps<{ projectId: string; planId: string }>()
const router = useRouter()
const store = useSitesStore()
const icons = usePlanIconsStore()
const sync = useSyncStore()
const projectId = computed(() => Number(props.projectId))
const plan = computed(() => (store.plans[projectId.value] ?? []).find((p) => p.id === Number(props.planId)) ?? null)
const site = computed(() => store.sites[projectId.value] ?? null)
const image = ref<{ url: string; pages: number } | null>(null)
const page = ref(1)
const zoom = ref(1)
const loading = ref(true)
const error = ref<string | null>(null)
const selected = ref<PlanMarker | null>(null)
const focused = ref<number | null>(null)
const panel = ref<'layers' | 'legend' | 'search' | null>(null)
const query = ref('')

// Équipements du chantier, par numéro
const equipmentById = computed(() => {
  const map = new Map<number, Equipment & { system: string }>()
  for (const s of site.value?.systems ?? []) for (const e of s.equipment ?? []) map.set(e.id, { ...e, system: s.name })
  return map
})
const equipment = (id: number | null) => (id ? equipmentById.value.get(id) : undefined)

// Calques : ceux masqués dans l'éditeur au départ, puis au choix sur le téléphone
const hidden = ref<string[]>([])
watch(plan, (p) => p && (hidden.value = [...(p.settings?.hidden_layers ?? [])]), { immediate: true })
const pageMarkers = computed(() => (plan.value?.markers ?? []).filter((m) => m.page === page.value))
const layers = computed(() => planLayers(pageMarkers.value, site.value?.systems ?? [], hidden.value))
function toggleLayer(key: string, visible: boolean): void {
  hidden.value = visible ? hidden.value.filter((k) => k !== key) : [...hidden.value, key]
}
const markers = computed(() => visibleMarkers(pageMarkers.value, hidden.value))

const legend = computed(() => groupLegend(planLegend(markers.value, icons.icons, (id) => equipment(id)?.name ?? null)))
const iconOf = (m: PlanMarker) => icons.byId(m.icon_id)
const showLabel = (m: PlanMarker) => plan.value?.settings?.labels !== false && m.show_label !== false

// Recherche sur toutes les pages du plan
const results = computed(() =>
  query.value.trim()
    ? (plan.value?.markers ?? []).filter((m) => markerMatches(m, equipment(m.equipment_id), query.value)).slice(0, 50)
    : [],
)
const markerName = (m: PlanMarker) => m.label ?? equipment(m.equipment_id)?.name ?? 'Repère'

// --- Zoom et déplacement ---------------------------------------------------------------------
const scroller = ref<HTMLElement | null>(null)
const stage = ref<HTMLElement | null>(null)

function setZoom(next: number, cx?: number, cy?: number): void {
  const el = scroller.value
  const old = zoom.value
  const z = clampZoom(next)
  if (!el || z === old) return
  const x = cx ?? el.clientWidth / 2
  const y = cy ?? el.clientHeight / 2
  const target = scrollAfterZoom({ left: el.scrollLeft, top: el.scrollTop }, x, y, old, z)
  zoom.value = z
  void nextTick(() => {
    el.scrollLeft = target.left
    el.scrollTop = target.top
  })
}

let pinch: { distance: number; zoom: number } | null = null
const distance = (t: TouchList) => Math.hypot(t[0]!.clientX - t[1]!.clientX, t[0]!.clientY - t[1]!.clientY)
function onTouchStart(e: TouchEvent): void {
  if (e.touches.length === 2) pinch = { distance: distance(e.touches), zoom: zoom.value }
}
function onTouchMove(e: TouchEvent): void {
  if (!pinch || e.touches.length !== 2 || !scroller.value) return
  e.preventDefault()
  const rect = scroller.value.getBoundingClientRect()
  const cx = (e.touches[0]!.clientX + e.touches[1]!.clientX) / 2 - rect.left
  const cy = (e.touches[0]!.clientY + e.touches[1]!.clientY) / 2 - rect.top
  setZoom(pinchZoom(pinch.zoom, pinch.distance, distance(e.touches)), cx, cy)
}
function onTouchEnd(e: TouchEvent): void {
  if (e.touches.length < 2) pinch = null
}
// Double appui : zoom ×2 à cet endroit, ou retour à la vue entière
let lastTap = 0
function onTap(e: MouseEvent): void {
  const now = Date.now()
  if (now - lastTap < 300 && scroller.value) {
    const rect = scroller.value.getBoundingClientRect()
    setZoom(zoom.value >= 3 ? 1 : zoom.value * 2, e.clientX - rect.left, e.clientY - rect.top)
    lastTap = 0
  } else lastTap = now
}

/** Montre un repère : bonne page, zoom, centré, mis en évidence. */
async function focus(m: PlanMarker): Promise<void> {
  panel.value = null
  if (m.page !== page.value) await render(m.page)
  if (hidden.value.includes(m.layer_id === null ? 'none' : String(m.layer_id))) toggleLayer(m.layer_id === null ? 'none' : String(m.layer_id), true)
  zoom.value = Math.max(zoom.value, 2.5)
  await nextTick()
  await new Promise((r) => requestAnimationFrame(r))
  if (scroller.value && stage.value) {
    const target = scrollToPoint(m.x, m.y, { width: stage.value.clientWidth, height: stage.value.clientHeight }, { width: scroller.value.clientWidth, height: scroller.value.clientHeight })
    scroller.value.scrollTo({ ...target, behavior: 'smooth' })
  }
  focused.value = m.id
  setTimeout(() => focused.value === m.id && (focused.value = null), 2600)
}

async function render(pageNumber: number): Promise<void> {
  if (!plan.value) {
    loading.value = false
    error.value = sync.online ? 'Ce plan n’existe plus.' : "Ce plan n'est pas sur le téléphone : ouvrez-le une fois avec le réseau."
    return
  }
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
  await Promise.all([store.load(projectId.value), store.loadPlans(projectId.value), icons.load().catch(() => undefined)])
  void store.refresh(projectId.value)
  await render(1)
})
onBeforeUnmount(() => image.value && URL.revokeObjectURL(image.value.url))

function openEquipment(id: number): void {
  selected.value = null
  void router.push({ name: 'equipment-edit', params: { projectId: projectId.value, equipmentId: id } })
}
</script>

<template>
  <IonPage>
    <IonHeader>
      <IonToolbar>
        <IonButtons slot="start"><IonBackButton :default-href="`/chantier/${props.projectId}`" text="Retour" /></IonButtons>
        <IonTitle>{{ plan?.name ?? 'Plan' }}</IonTitle>
        <IonButtons slot="end">
          <IonButton aria-label="Chercher sur le plan" @click="panel = 'search'"><IonIcon slot="icon-only" :icon="searchOutline" /></IonButton>
          <IonButton v-if="layers.length > 1" aria-label="Calques" @click="panel = 'layers'"><IonIcon slot="icon-only" :icon="layersOutline" /></IonButton>
          <IonButton v-if="legend.length" aria-label="Légende" @click="panel = 'legend'"><IonIcon slot="icon-only" :icon="listOutline" /></IonButton>
        </IonButtons>
      </IonToolbar>
      <IonToolbar v-if="image" class="tools">
        <IonButtons slot="start">
          <template v-if="image.pages > 1">
            <IonButton :disabled="page <= 1" aria-label="Page précédente" @click="render(page - 1)"><IonIcon slot="icon-only" :icon="chevronBack" /></IonButton>
            <span class="page">{{ page }} / {{ image.pages }}</span>
            <IonButton :disabled="page >= image.pages" aria-label="Page suivante" @click="render(page + 1)"><IonIcon slot="icon-only" :icon="chevronForward" /></IonButton>
          </template>
          <span v-else class="page">{{ markers.length }} repère{{ markers.length > 1 ? 's' : '' }}</span>
        </IonButtons>
        <IonButtons slot="end">
          <IonButton :disabled="zoom <= MIN_ZOOM" aria-label="Dézoomer" @click="setZoom(zoom / 1.5)"><IonIcon slot="icon-only" :icon="remove" /></IonButton>
          <span class="page">{{ Math.round(zoom * 100) }} %</span>
          <IonButton :disabled="zoom >= MAX_ZOOM" aria-label="Zoomer" @click="setZoom(zoom * 1.5)"><IonIcon slot="icon-only" :icon="add" /></IonButton>
          <IonButton :disabled="zoom === 1" aria-label="Vue entière" @click="setZoom(1)"><IonIcon slot="icon-only" :icon="contractOutline" /></IonButton>
        </IonButtons>
      </IonToolbar>
    </IonHeader>
    <IonContent :scroll-y="false">
      <div v-if="loading" class="center"><IonSpinner /></div>
      <div v-else-if="error" class="ion-padding"><IonText color="danger"><p>{{ error }}</p></IonText></div>
      <div
        v-else-if="image"
        ref="scroller"
        class="scroll"
        @touchstart="onTouchStart"
        @touchmove="onTouchMove"
        @touchend="onTouchEnd"
        @click="onTap"
      >
        <div ref="stage" class="stage" :style="{ width: `${zoom * 100}%` }">
          <img :src="image.url" :alt="plan?.name" draggable="false" />
          <button
            v-for="m in markers"
            :key="m.id"
            type="button"
            class="marker"
            :class="{ focused: focused === m.id }"
            :style="{ left: `${m.x * 100}%`, top: `${m.y * 100}%`, width: `max(22px, ${(m.size ?? 0.03) * 100}%)` }"
            :aria-label="markerName(m)"
            @click.stop="selected = m"
          >
            <PlanGlyph :icon="iconOf(m)" :color="markerColor(m, iconOf(m))" :image="iconOf(m) ? icons.images[iconOf(m)!.id] : null" :rotation="m.rotation ?? 0" :uid="`m${m.id}`" />
            <span v-if="showLabel(m)">{{ m.label ?? equipment(m.equipment_id)?.name ?? '' }}</span>
          </button>
        </div>
      </div>

      <!-- Repère touché : l'équipement -->
      <IonModal :is-open="!!selected" :initial-breakpoint="0.45" :breakpoints="[0, 0.45, 0.9]" @did-dismiss="selected = null">
        <IonContent v-if="selected" class="ion-padding">
          <template v-if="equipment(selected.equipment_id)">
            <h2>{{ equipment(selected.equipment_id)!.name }}</h2>
            <IonNote>{{ equipment(selected.equipment_id)!.system }} · {{ equipment(selected.equipment_id)!.status.label }}<template v-if="equipment(selected.equipment_id)!.quantity > 1"> · × {{ equipment(selected.equipment_id)!.quantity }}</template></IonNote>
            <p v-if="site">{{ placeLabel(site, equipment(selected.equipment_id)!.level_id, equipment(selected.equipment_id)!.room_id) }}</p>
            <p v-if="equipment(selected.equipment_id)!.model" class="muted">{{ [equipment(selected.equipment_id)!.type, equipment(selected.equipment_id)!.model].filter(Boolean).join(' · ') }}</p>
            <IonList>
              <IonItem v-for="c in equipment(selected.equipment_id)!.characteristics" :key="c.label">
                <IonLabel>{{ c.label }}</IonLabel><IonNote slot="end" class="mono">{{ c.value }}</IonNote>
              </IonItem>
              <IonItem v-if="equipment(selected.equipment_id)!.serial_number"><IonLabel>N° de série</IonLabel><IonNote slot="end" class="mono">{{ equipment(selected.equipment_id)!.serial_number }}</IonNote></IonItem>
            </IonList>
            <IonButton v-if="site?.can.manage && selected.equipment_id! > 0" expand="block" fill="outline" @click="openEquipment(selected.equipment_id!)">Modifier l'équipement</IonButton>
          </template>
          <template v-else><h2>{{ selected.label ?? 'Repère' }}</h2><IonNote>Repère sans équipement.</IonNote></template>
        </IonContent>
      </IonModal>

      <!-- Calques, légende, recherche -->
      <IonModal :is-open="!!panel" :initial-breakpoint="0.6" :breakpoints="[0, 0.6, 0.95]" @did-dismiss="panel = null">
        <IonContent>
          <template v-if="panel === 'layers'">
            <IonList>
              <IonListHeader><IonLabel>Calques</IonLabel></IonListHeader>
              <IonItem v-for="l in layers" :key="l.key">
                <IonToggle :checked="!l.hidden" justify="space-between" @ion-change="toggleLayer(l.key, $event.detail.checked)">{{ l.name }} <IonNote>· {{ l.count }}</IonNote></IonToggle>
              </IonItem>
            </IonList>
          </template>
          <template v-else-if="panel === 'legend'">
            <IonList v-for="g in legend" :key="g.category">
              <IonListHeader><IonLabel>{{ g.category }}</IonLabel><IonNote class="ion-padding-end">{{ g.count }}</IonNote></IonListHeader>
              <IonItem v-for="entry in g.entries" :key="entry.key">
                <span slot="start" class="legend-glyph"><PlanGlyph :icon="entry.icon" :color="entry.color" :image="entry.icon ? icons.images[entry.icon.id] : null" :uid="`l${entry.key}`" /></span>
                <IonLabel class="ion-text-wrap">{{ entry.name }}</IonLabel>
                <IonNote slot="end">{{ entry.count }}</IonNote>
              </IonItem>
            </IonList>
          </template>
          <template v-else-if="panel === 'search'">
            <IonSearchbar v-model="query" placeholder="Équipement, n° de série, adresse IP…" :debounce="100" />
            <IonList>
              <IonItem v-for="m in results" :key="m.id" button :detail="false" @click="focus(m)">
                <span slot="start" class="legend-glyph"><PlanGlyph :icon="iconOf(m)" :color="markerColor(m, iconOf(m))" :image="iconOf(m) ? icons.images[iconOf(m)!.id] : null" :uid="`s${m.id}`" /></span>
                <IonLabel class="ion-text-wrap">
                  <h3>{{ markerName(m) }}</h3>
                  <p>{{ [equipment(m.equipment_id)?.system, equipment(m.equipment_id)?.serial_number, image && image.pages > 1 ? `page ${m.page}` : null].filter(Boolean).join(' · ') }}</p>
                </IonLabel>
              </IonItem>
              <IonItem v-if="query.trim() && !results.length" lines="none"><IonLabel color="medium">Aucun repère ne correspond.</IonLabel></IonItem>
            </IonList>
          </template>
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

.tools {
  --min-height: 40px;
}

.page {
  font-size: 0.85rem;
  color: var(--ion-color-medium);
  padding: 0 0.25rem;
}

.scroll {
  overflow: auto;
  height: 100%;
  touch-action: pan-x pan-y;
  -webkit-overflow-scrolling: touch;
}

.stage {
  position: relative;
  min-width: 100%;
}

.stage > img {
  display: block;
  width: 100%;
  user-select: none;
}

.marker {
  position: absolute;
  transform: translate(-50%, -50%);
  aspect-ratio: 1;
  border: none;
  background: none;
  padding: 0;
  filter: drop-shadow(0 1px 2px rgb(0 0 0 / 0.35));
}

.marker.focused::after {
  content: '';
  position: absolute;
  inset: -45%;
  border: 3px solid var(--ion-color-warning);
  border-radius: 50%;
  animation: pulse 0.9s ease-out 3;
}

@keyframes pulse {
  from {
    transform: scale(0.6);
    opacity: 1;
  }
  to {
    transform: scale(1.4);
    opacity: 0;
  }
}

.marker span {
  position: absolute;
  left: 50%;
  top: 100%;
  transform: translateX(-50%);
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

.legend-glyph {
  display: inline-block;
  width: 26px;
  height: 26px;
  margin-inline-end: 0.75rem;
}

.mono {
  font-family: ui-monospace, monospace;
}

.muted {
  color: var(--ion-color-medium);
}
</style>
