<script setup lang="ts">
import ViewModeButton from '@/components/ViewModeButton.vue'
import CardList from '@/components/CardList.vue'
import { useViewMode } from '@/composables/useViewMode'
import { matches } from '@/utils/home'
import { computed, onMounted, ref } from 'vue'
import {
  IonBadge,
  IonButton,
  IonButtons,
  IonContent,
  IonFab,
  IonFabButton,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonNote,
  IonPage,
  IonRefresher,
  IonRefresherContent,
  IonText,
  IonTitle,
  IonToolbar,
  type RefresherCustomEvent,
  IonSearchbar,
  IonSegment,
  IonSegmentButton,
  IonSelect,
  IonSelectOption,
} from '@ionic/vue'
import { JOURNAL_TYPES, type JournalType } from '@dash4/shared'
import { filterJournals, groupJournalsByMonth, journalProjectOptions } from '@/utils/journals'
import { add, calendarOutline, cloudOfflineOutline, imagesOutline, peopleOutline } from 'ionicons/icons'
import { useAuthStore } from '@/stores/auth'
import { useJournalsStore } from '@/stores/journals'

/** Rapports d'intervention : les miens, ceux en attente d'envoi. */
const viewMode = useViewMode('journals')
const store = useJournalsStore()
const auth = useAuthStore()

onMounted(async () => {
  await store.load()
  void store.refresh().catch(() => undefined)
})
async function onRefresh(event: RefresherCustomEvent): Promise<void> {
  await store.refresh().catch(() => undefined)
  await event.target.complete()
}
const date = (iso: string | null) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }) : '')

// Filtres : les miens (auteur ou intervenant), type, projet, recherche
const query = ref('')
const mine = ref(false)
const type = ref<JournalType | null>(null)
const projectId = ref<number | null>(null)
const projects = computed(() => journalProjectOptions([store.sorted.map((j) => j.project)]))
const shown = computed(() => filterJournals(store.sorted, { mine: mine.value, type: type.value, projectId: projectId.value, query: query.value }, auth.user?.id ?? null, matches))
const months = computed(() => groupJournalsByMonth(shown.value))
const filtered = computed(() => mine.value || !!type.value || !!projectId.value || !!query.value.trim())
function clearFilters(): void {
  mine.value = false
  type.value = null
  projectId.value = null
  query.value = ''
}
</script>

<template>
  <IonPage>
    <IonHeader>
      <IonToolbar><IonTitle>Rapports</IonTitle>
        <IonButtons slot="end"><ViewModeButton v-model="viewMode" /></IonButtons></IonToolbar>
      <IonToolbar><IonSearchbar v-model="query" :debounce="150" placeholder="Titre, projet, client, intervenant…" aria-label="Rechercher" /></IonToolbar>
      <IonToolbar>
        <IonSegment :value="mine ? 'mine' : 'all'" @ion-change="mine = $event.detail.value === 'mine'">
          <IonSegmentButton value="all"><IonLabel>Tous</IonLabel></IonSegmentButton>
          <IonSegmentButton value="mine"><IonLabel>Les miens</IonLabel></IonSegmentButton>
        </IonSegment>
      </IonToolbar>
      <IonToolbar class="filters">
        <IonSelect v-model="type" aria-label="Type" interface="action-sheet" cancel-text="Annuler" placeholder="Tous les types" class="filter">
          <IonSelectOption :value="null">Tous les types</IonSelectOption>
          <IonSelectOption v-for="t in JOURNAL_TYPES" :key="t.value" :value="t.value">{{ t.label }}</IonSelectOption>
        </IonSelect>
        <IonSelect v-if="projects.length > 1" v-model="projectId" aria-label="Projet" interface="action-sheet" cancel-text="Annuler" placeholder="Tous les projets" class="filter">
          <IonSelectOption :value="null">Tous les projets</IonSelectOption>
          <IonSelectOption v-for="p in projects" :key="p.id" :value="p.id">{{ p.name }}</IonSelectOption>
        </IonSelect>
      </IonToolbar>
    </IonHeader>
    <IonContent>
      <IonRefresher slot="fixed" @ion-refresh="onRefresh">
        <IonRefresherContent pulling-text="Tirer pour actualiser" refreshing-spinner="crescent" />
      </IonRefresher>

      <IonList v-if="store.pending.length" inset>
        <IonListHeader><IonLabel>En attente d'envoi</IonLabel></IonListHeader>
        <IonItem v-for="p in store.pending" :key="p.id">
          <IonIcon slot="start" :icon="cloudOfflineOutline" color="medium" />
          <IonLabel class="ion-text-wrap">
            <h3>{{ p.payload.title }}</h3>
            <p v-if="store.photosWaiting(p.id)">{{ store.photosWaiting(p.id) }} photo(s)</p>
            <p v-if="p.lastError"><IonText color="danger">{{ p.lastError }}</IonText></p>
          </IonLabel>
        </IonItem>
      </IonList>

      <CardList v-if="viewMode === 'cards'" :items="shown" :to="(j) => ({ name: 'journal', params: { id: j.id } })">
        <template #card="{ item }">
          <div class="card-head">
            <div>
              <span class="card-title">{{ item.title }}</span>
              <span class="card-sub">{{ [item.project?.name, item.client?.name].filter(Boolean).join(' · ') }}</span>
            </div>
          </div>
          <div class="card-meta">
            <span><IonIcon :icon="calendarOutline" /> {{ date(item.date) }}</span>
            <span v-if="item.participants?.length"><IonIcon :icon="peopleOutline" /> {{ item.participants.map((p) => p.name).join(', ') }}</span>
            <span v-if="item.photos_count || store.photosWaiting(item.client_uuid)"><IonIcon :icon="imagesOutline" /> {{ (item.photos_count ?? 0) + store.photosWaiting(item.client_uuid) }} photo(s)</span>
          </div>
          <div class="card-foot"><IonBadge color="medium">{{ item.type.label }}</IonBadge></div>
        </template>
      </CardList>
      <template v-else>
      <IonList v-for="m in months" :key="m.key" inset>
        <IonListHeader><IonLabel>{{ m.label }}</IonLabel><IonNote class="ion-padding-end">{{ m.items.length }}</IonNote></IonListHeader>
        <IonItem v-for="j in m.items" :key="j.id" :router-link="{ name: 'journal', params: { id: j.id } }" detail>
          <IonLabel class="ion-text-wrap">
            <h3>{{ j.title }}</h3>
            <p>{{ [date(j.date), j.project?.name ?? j.client?.name].filter(Boolean).join(' · ') }}</p>
          </IonLabel>
          <div slot="end" class="end">
            <IonBadge color="medium">{{ j.type.label }}</IonBadge>
            <IonNote v-if="j.photos_count || store.photosWaiting(j.client_uuid)"><IonIcon :icon="imagesOutline" /> {{ (j.photos_count ?? 0) + store.photosWaiting(j.client_uuid) }}</IonNote>
          </div>
        </IonItem>
      </IonList>
      </template>
      <div v-if="!store.sorted.length && !store.pending.length" class="ion-padding ion-text-center">
        <IonText color="medium"><p>Aucun rapport. Touchez + après une intervention, même sans réseau.</p></IonText>
      </div>
      <div v-else-if="store.sorted.length && !shown.length" class="ion-padding ion-text-center">
        <IonText color="medium"><p>Aucun rapport ne correspond.</p></IonText>
        <IonButton fill="clear" @click="clearFilters">Retirer les filtres</IonButton>
      </div>
      <p v-else-if="filtered && shown.length" class="ion-text-center"><IonNote>{{ shown.length }} rapport{{ shown.length > 1 ? 's' : '' }}</IonNote></p>

      <IonFab v-if="auth.can('journals.create')" slot="fixed" vertical="bottom" horizontal="end">
        <IonFabButton :router-link="{ name: 'journal-new' }" aria-label="Nouveau rapport"><IonIcon :icon="add" /></IonFabButton>
      </IonFab>
    </IonContent>
  </IonPage>
</template>

<style scoped>
.filters {
  --padding-start: 0.75rem;
  --padding-end: 0.75rem;
}

.filters ion-select.filter {
  display: inline-flex;
  max-width: 50%;
  font-size: 0.9rem;
}

.end {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.25rem;
}
</style>
