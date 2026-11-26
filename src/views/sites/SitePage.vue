<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  IonAccordion,
  IonAccordionGroup,
  IonBackButton,
  IonBadge,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonPage,
  IonProgressBar,
  IonRefresher,
  IonRefresherContent,
  IonSearchbar,
  IonText,
  IonTitle,
  IonToolbar,
  actionSheetController,
  alertController,
  toastController,
  type RefresherCustomEvent,
  IonIcon,
} from '@ionic/vue'
import { documentTextOutline } from 'ionicons/icons'
import { EQUIPMENT_STATUSES, equipmentTotals, equipmentTree, placeLabel } from '@dash4/shared'
import type { Equipment, InstalledSystem } from '@dash4/shared'
import { useSitesStore } from '@/stores/sites'
import { useAuthStore } from '@/stores/auth'
import { useSyncStore } from '@/stores/sync'
import { equipmentMatches, statusColor } from '@/utils/sites'

/** Chantier d'un projet sur le téléphone : systèmes, équipements et caractéristiques, lisibles sans réseau. */
const props = defineProps<{ projectId: string }>()
const store = useSitesStore()
const sync = useSyncStore()
const id = computed(() => Number(props.projectId))
const site = computed(() => store.sites[id.value] ?? null)
const search = ref('')

onMounted(async () => {
  await store.load(id.value)
  void store.refresh(id.value)
  void store.loadPlans(id.value)
})
const plans = computed(() => store.plans[id.value] ?? [])
async function onRefresh(event: RefresherCustomEvent): Promise<void> {
  await store.refresh(id.value)
  await event.target.complete()
}

const visibleEquipment = (s: InstalledSystem) => equipmentTree((s.equipment ?? []).filter((e) => equipmentMatches(e, search.value)))

async function copy(text: string): Promise<void> {
  await navigator.clipboard?.writeText(text).catch(() => undefined)
  const toast = await toastController.create({ message: 'Copié.', duration: 1200, position: 'top' })
  await toast.present()
}

async function progress(s: InstalledSystem): Promise<void> {
  const alert = await alertController.create({
    header: `Avancement — ${s.name}`,
    inputs: [
      { name: 'percent', type: 'number', min: 0, max: 100, value: s.progress, placeholder: 'Pourcentage' },
      { name: 'note', type: 'textarea', placeholder: 'Note (facultatif)' },
    ],
    buttons: [
      { text: 'Annuler', role: 'cancel' },
      {
        text: 'Enregistrer',
        handler: (v: { percent?: string; note?: string }) => {
          const percent = Math.round(Number(v.percent))
          if (!Number.isFinite(percent) || percent < 0 || percent > 100) return false
          void store.addProgress(id.value, s.id, percent, v.note?.trim() || null)
          return true
        },
      },
    ],
  })
  await alert.present()
}

const router = useRouter()
const auth = useAuthStore()
const canStock = computed(() => auth.can('stock.view'))
/** Documentation (documents, liens, notes) de l'article du stock lié à l'équipement. */
function openArticleDocs(e: Equipment): void {
  if (!e.article) return
  void router.push({ name: 'article-docs', params: { id: e.article.id }, state: { articleName: e.article.designation } })
}
function edit(e: Equipment): void {
  void router.push({ name: 'equipment-edit', params: { projectId: id.value, equipmentId: e.id } })
}

async function changeStatus(e: Equipment): Promise<void> {
  const sheet = await actionSheetController.create({
    header: e.name,
    buttons: [
      ...EQUIPMENT_STATUSES.map((s) => ({ text: s.label, handler: () => void store.setEquipmentStatus(id.value, e.id, s.value) })),
      { text: 'Annuler', role: 'cancel' },
    ],
  })
  await sheet.present()
}
</script>

<template>
  <IonPage>
    <IonHeader>
      <IonToolbar>
        <IonButtons slot="start"><IonBackButton default-href="/" text="Retour" /></IonButtons>
        <IonTitle>{{ site?.project.name ?? 'Chantier' }}</IonTitle>
      </IonToolbar>
      <IonToolbar v-if="site?.systems.length">
        <IonSearchbar v-model="search" placeholder="Équipement, adresse IP, n° de série…" :debounce="150" />
      </IonToolbar>
    </IonHeader>
    <IonContent>
      <IonRefresher slot="fixed" @ion-refresh="onRefresh">
        <IonRefresherContent pulling-text="Tirer pour actualiser" refreshing-spinner="crescent" />
      </IonRefresher>
      <div v-if="store.errors[id]" class="ion-padding-horizontal"><IonText color="danger"><p>{{ store.errors[id] }}</p></IonText></div>
      <div v-if="!site" class="ion-padding ion-text-center">
        <IonText color="medium"><p>{{ sync.online ? 'Chargement du chantier…' : "Ce chantier n'est pas encore sur le téléphone : ouvrez-le une fois avec le réseau." }}</p></IonText>
      </div>

      <template v-else>
        <div class="ion-padding summary">
          <div><strong>{{ site.progress }} %</strong><IonNote> avancement global</IonNote></div>
          <IonProgressBar :value="site.progress / 100" />
          <IonNote>{{ site.systems.length }} système(s) · {{ site.equipment_count }} équipement(s) · {{ site.buildings.length }} bâtiment(s)</IonNote>
        </div>

        <IonList v-if="plans.length" inset>
          <IonItem v-for="p in plans" :key="p.id" :router-link="{ name: 'site-plan', params: { projectId: id, planId: p.id } }" detail>
            <IonLabel>{{ p.name }}<p>{{ p.kind === 'pdf' ? 'PDF' : 'Image' }} · {{ p.markers?.length ?? 0 }} repère(s)</p></IonLabel>
          </IonItem>
        </IonList>

        <p v-if="!site.systems.length" class="ion-padding"><IonText color="medium">Aucun système installé sur ce chantier.</IonText></p>
        <IonAccordionGroup :multiple="true">
          <IonAccordion v-for="s in site.systems" :key="s.id" :value="String(s.id)">
            <IonItem slot="header">
              <IonLabel class="ion-text-wrap">
                <h2>{{ s.name }}</h2>
                <p>{{ equipmentTotals(s.equipment ?? []).map((t) => `${t.quantity} × ${t.label}`).join(' · ') || 'Aucun équipement' }}</p>
                <IonProgressBar :value="s.progress / 100" class="bar" />
              </IonLabel>
              <IonBadge slot="end" color="medium">{{ s.progress }} %</IonBadge>
            </IonItem>
            <div slot="content">
              <div v-if="site.can.manage" class="ion-padding-horizontal ion-padding-top tools">
                <IonButton size="small" fill="outline" @click="progress(s)">Relever l'avancement</IonButton>
                <IonButton size="small" fill="outline" :router-link="{ name: 'equipment-new', params: { projectId: id }, query: { system: s.id } }">Ajouter un équipement</IonButton>
              </div>
              <IonList>
                <template v-for="node in visibleEquipment(s)" :key="node.item.id">
                  <IonItem
                    v-for="e in [node.item, ...node.children]"
                    :key="e.id"
                    :class="{ child: e.parent_id }"
                    :button="site.can.manage && e.id > 0"
                    :detail="false"
                    @click="site.can.manage && e.id > 0 && edit(e)"
                  >
                    <IonLabel class="ion-text-wrap">
                      <h3>{{ e.quantity > 1 ? `${e.quantity} × ` : '' }}{{ e.name }}</h3>
                      <p>{{ [e.type, e.model, e.serial_number ? `N° ${e.serial_number}` : null].filter(Boolean).join(' · ') }}</p>
                      <p v-if="e.id < 0"><IonText color="medium">En attente d'envoi</IonText></p>
                      <p v-if="placeLabel(site, e.level_id, e.room_id)">{{ placeLabel(site, e.level_id, e.room_id) }}</p>
                      <p v-if="e.article && canStock" class="article-doc">
                        <a href="#" @click.prevent.stop="openArticleDocs(e)"><IonIcon :icon="documentTextOutline" /> {{ e.article.designation }} · documents, liens, notes</a>
                      </p>
                      <p v-for="c in e.characteristics" :key="c.label" class="char" @click.stop="copy(c.value)">
                        <span>{{ c.label }} :</span> <strong>{{ c.value }}</strong>
                      </p>
                    </IonLabel>
                    <IonBadge slot="end" :color="statusColor(e.status.value)" @click.stop="site.can.manage && e.id > 0 && changeStatus(e)">{{ e.status.label }}</IonBadge>
                  </IonItem>
                </template>
                <IonItem v-if="search && !visibleEquipment(s).length" lines="none"><IonNote>Aucun équipement ne correspond.</IonNote></IonItem>
              </IonList>
            </div>
          </IonAccordion>
        </IonAccordionGroup>
      </template>
    </IonContent>
  </IonPage>
</template>

<style scoped>
.summary {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.tools {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.bar {
  margin-top: 0.375rem;
}

.child {
  --padding-start: 2rem;
}

.article-doc a {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  color: var(--ion-color-primary);
  text-decoration: none;
}
.char {
  font-family: ui-monospace, monospace;
}
</style>
