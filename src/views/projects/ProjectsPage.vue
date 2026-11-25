<script setup lang="ts">
import ViewModeButton from '@/components/ViewModeButton.vue'
import CardList from '@/components/CardList.vue'
import { useViewMode } from '@/composables/useViewMode'
import { computed, onMounted, ref } from 'vue'
import {
  IonBadge,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonPage,
  IonRefresher,
  IonRefresherContent,
  IonSearchbar,
  IonSegment,
  IonSegmentButton,
  IonText,
  IonTitle,
  IonToolbar,
  type RefresherCustomEvent,
} from '@ionic/vue'
import { calendarOutline, personOutline, star } from 'ionicons/icons'
import { useProjectsStore } from '@/stores/projects'
import { matchesSearch } from '@/offline/collection'
import ClientLogo from '@/components/ClientLogo.vue'
import { projectStatusColor } from '@/utils/projects'

const viewMode = useViewMode('projects')
const store = useProjectsStore()
const segment = ref<'active' | 'all'>('active')
const search = ref('')

const list = computed(() =>
  (segment.value === 'active' ? store.active : store.sorted).filter((p) =>
    matchesSearch(search.value, [p.name, p.client?.name, p.address]),
  ),
)

const syncedLabel = computed(() =>
  store.syncedAt
    ? `Mis à jour le ${new Date(store.syncedAt).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}`
    : 'Pas encore synchronisé',
)

onMounted(async () => {
  await store.load()
  void store.refresh()
})

async function onRefresh(event: RefresherCustomEvent): Promise<void> {
  await store.refresh()
  await event.target.complete()
}
</script>

<template>
  <IonPage>
    <IonHeader>
      <IonToolbar>
        <IonTitle>Projets</IonTitle>
        <IonButtons slot="end"><ViewModeButton v-model="viewMode" /></IonButtons>
      </IonToolbar>
      <IonToolbar>
        <IonSegment v-model="segment">
          <IonSegmentButton value="active"><IonLabel>En cours</IonLabel></IonSegmentButton>
          <IonSegmentButton value="all"><IonLabel>Tous</IonLabel></IonSegmentButton>
        </IonSegment>
      </IonToolbar>
      <IonToolbar>
        <IonSearchbar v-model="search" placeholder="Projet, client, adresse" :debounce="150" />
      </IonToolbar>
    </IonHeader>

    <IonContent>
      <IonRefresher slot="fixed" @ion-refresh="onRefresh">
        <IonRefresherContent pulling-text="Tirer pour actualiser" refreshing-spinner="crescent" />
      </IonRefresher>

      <CardList v-if="viewMode === 'cards'" :items="list" :to="(p) => ({ name: 'project', params: { id: p.id } })">
        <template #card="{ item }">
          <div class="card-head">
            <ClientLogo :name="item.name" :url="item.logo_url" :size="44" />
            <div>
              <span class="card-title"><IonIcon v-if="item.is_favorite" :icon="star" color="warning" aria-label="Favori" /> {{ item.name }}</span>
              <span class="card-sub">{{ item.client?.name }}</span>
            </div>
          </div>
          <div class="card-meta">
            <span><IonIcon :icon="personOutline" /> {{ item.manager?.full_name ?? 'Pas de chef de projet' }}</span>
            <span v-if="item.start_date || item.end_date"><IonIcon :icon="calendarOutline" /> {{ [item.start_date, item.end_date].filter(Boolean).map((d) => new Date(`${d}T00:00:00`).toLocaleDateString('fr-FR')).join(' → ') }}</span>
          </div>
          <div class="card-foot"><IonBadge :color="projectStatusColor(item.status.value)">{{ item.status.label }}</IonBadge></div>
        </template>
      </CardList>
      <IonList v-else>
        <IonItem v-for="p in list" :key="p.id" :router-link="{ name: 'project', params: { id: p.id } }" detail>
          <ClientLogo slot="start" :name="p.name" :url="p.logo_url" :size="40" />
          <IonLabel>
            <h2>
              <IonIcon v-if="p.is_favorite" :icon="star" color="warning" aria-label="Favori" />
              {{ p.name }}
            </h2>
            <p>{{ p.client?.name }}<template v-if="p.manager"> · {{ p.manager.full_name }}</template></p>
          </IonLabel>
          <IonBadge slot="end" :color="projectStatusColor(p.status.value)">{{ p.status.label }}</IonBadge>
        </IonItem>
      </IonList>

      <div v-if="!list.length" class="ion-padding ion-text-center">
        <IonText color="medium"><p>{{ search ? 'Aucun projet ne correspond.' : 'Aucun projet.' }}</p></IonText>
      </div>

      <div class="ion-padding ion-text-center">
        <IonNote>{{ syncedLabel }}</IonNote>
        <IonText v-if="store.error" color="danger"><p>{{ store.error }}</p></IonText>
      </div>
    </IonContent>
  </IonPage>
</template>

<style scoped>
h2 ion-icon {
  vertical-align: -2px;
}
</style>
