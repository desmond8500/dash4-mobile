<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  IonBadge,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonNote,
  IonPage,
  IonProgressBar,
  IonRefresher,
  IonRefresherContent,
  IonSearchbar,
  IonText,
  IonTitle,
  IonToolbar,
  type RefresherCustomEvent,
  toastController,
} from '@ionic/vue'
import { cloudDownloadOutline, cloudDoneOutline, mapOutline } from 'ionicons/icons'
import type { Plan } from '@dash4/shared'
import { useSitesStore } from '@/stores/sites'
import { useSyncStore } from '@/stores/sync'
import { groupPlansByProject, isFileFresh, planPlace } from '@/utils/plans'

/** Tous les plans des chantiers visibles, rangés par projet ; à garder sur le téléphone pour le terrain. */
const store = useSitesStore()
const sync = useSyncStore()
const query = ref('')
const error = ref<string | null>(null)
const downloading = ref<{ done: number; total: number } | null>(null)

const groups = computed(() => groupPlansByProject(store.allPlans, query.value))
const offline = (p: Plan) => isFileFresh(store.files, p)
const missing = computed(() => store.allPlans.filter((p) => !offline(p)))

async function refresh(): Promise<void> {
  error.value = null
  try {
    await store.refreshAllPlans()
  } catch (e) {
    if (!store.allPlans.length) error.value = sync.online ? (e as Error).message : 'Hors ligne : la liste des plans sera chargée au retour du réseau.'
  }
}

onMounted(async () => {
  await store.loadAllPlans()
  await refresh()
})

async function onRefresh(event: RefresherCustomEvent): Promise<void> {
  await refresh()
  await event.target.complete()
}

/** Télécharge les plans (et leurs chantiers) pour les consulter sans réseau. */
async function keep(list: Plan[]): Promise<void> {
  if (!list.length || downloading.value) return
  if (!sync.online) {
    const toast = await toastController.create({ message: 'Il faut le réseau pour télécharger les plans.', duration: 2500, position: 'top' })
    return void (await toast.present())
  }
  downloading.value = { done: 0, total: list.length }
  const failed = await store.keepOffline(list, (done) => (downloading.value = { done, total: list.length }))
  downloading.value = null
  const toast = await toastController.create({
    message: failed ? `${list.length - failed} plan(s) gardé(s), ${failed} en échec.` : `${list.length} plan${list.length > 1 ? 's' : ''} disponible${list.length > 1 ? 's' : ''} hors ligne.`,
    duration: 2500,
    position: 'top',
  })
  await toast.present()
}
</script>

<template>
  <IonPage>
    <IonHeader>
      <IonToolbar>
        <IonTitle>Plans</IonTitle>
        <IonButtons slot="end">
          <IonButton v-if="missing.length" :disabled="!!downloading" @click="keep(missing)">
            <IonIcon slot="start" :icon="cloudDownloadOutline" />Tout garder
          </IonButton>
        </IonButtons>
      </IonToolbar>
      <IonToolbar>
        <IonSearchbar v-model="query" placeholder="Plan, projet, bâtiment, niveau…" :debounce="150" />
      </IonToolbar>
      <IonProgressBar v-if="downloading" :value="downloading.done / downloading.total" />
      <IonProgressBar v-else-if="store.plansSyncing" type="indeterminate" />
    </IonHeader>
    <IonContent>
      <IonRefresher slot="fixed" @ion-refresh="onRefresh"><IonRefresherContent /></IonRefresher>
      <div v-if="downloading" class="ion-padding-horizontal ion-padding-top">
        <IonNote>Téléchargement {{ downloading.done }} / {{ downloading.total }}…</IonNote>
      </div>

      <IonList v-for="g in groups" :key="g.project.id" inset>
        <IonListHeader>
          <IonLabel>{{ g.project.name }}</IonLabel>
          <IonButton v-if="g.plans.some((p) => !offline(p))" size="small" fill="clear" :disabled="!!downloading" @click="keep(g.plans.filter((p) => !offline(p)))">Garder</IonButton>
        </IonListHeader>
        <IonItem v-for="p in g.plans" :key="p.id" :router-link="{ name: 'site-plan', params: { projectId: p.project_id, planId: p.id } }" detail>
          <IonIcon slot="start" :icon="mapOutline" color="medium" />
          <IonLabel class="ion-text-wrap">
            <h3>{{ p.name }}</h3>
            <p>{{ [planPlace(p), p.kind === 'pdf' ? 'PDF' : 'Image', `${p.markers?.length ?? 0} repère${(p.markers?.length ?? 0) > 1 ? 's' : ''}`].filter(Boolean).join(' · ') }}</p>
          </IonLabel>
          <IonIcon v-if="offline(p)" slot="end" :icon="cloudDoneOutline" color="success" aria-label="Disponible hors ligne" />
          <IonBadge v-else-if="store.files[p.id] !== undefined" slot="end" color="warning">À mettre à jour</IonBadge>
        </IonItem>
      </IonList>

      <div v-if="!groups.length" class="ion-padding ion-text-center">
        <IonText color="medium">
          <p>{{ error ?? (query ? 'Aucun plan ne correspond.' : store.plansSyncing ? 'Chargement…' : 'Aucun plan sur vos chantiers.') }}</p>
        </IonText>
      </div>
    </IonContent>
  </IonPage>
</template>
