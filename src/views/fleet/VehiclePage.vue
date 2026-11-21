<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonNote,
  IonPage,
  IonSpinner,
  IonText,
  IonTitle,
  IonToolbar,
  toastController,
} from '@ionic/vue'
import { alertText, formatKm, vehicleSubtitle, type Vehicle } from '@dash4/shared'
import MarkdownView from '@/components/MarkdownView.vue'
import { useFleetStore } from '@/stores/fleet'
import { formatDate } from '@/utils/projects'
import { mileageError, stateColor } from '@/utils/fleet'

/** Fiche d'un véhicule : papiers, entretiens à prévoir, relevé du compteur (hors ligne possible). */
const props = defineProps<{ id: string }>()
const store = useFleetStore()

const vehicle = ref<Vehicle | null>(null)
const offline = ref(false)
const loading = ref(true)
const error = ref<string | null>(null)
const km = ref<number | null>(null)
const note = ref('')
const formError = ref<string | null>(null)

const pending = computed(() => (vehicle.value ? store.pendingFor(vehicle.value.id) : []))
/** Compteur connu sur le téléphone : relevés en attente compris. */
const current = computed(() => Math.max(vehicle.value?.mileage ?? 0, ...pending.value.map((p) => p.km)))
const papers = computed(() => (vehicle.value?.papers ?? []).filter((p) => p.current))

async function load(): Promise<void> {
  try {
    const result = await store.detail(Number(props.id))
    vehicle.value = result.vehicle
    offline.value = result.offline
  } catch {
    error.value = 'Véhicule introuvable ou réservé.'
  } finally {
    loading.value = false
  }
}
onMounted(load)

async function save(): Promise<void> {
  if (!vehicle.value) return
  const value = km.value === null ? null : Math.round(Number(km.value))
  formError.value = mileageError(value, current.value)
  if (formError.value) return
  const today = new Date()
  const readOn = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  await store.recordMileage(vehicle.value, value!, note.value.trim() || null, readOn)
  km.value = null
  note.value = ''
  const toast = await toastController.create({ message: 'Relevé enregistré : il part dès que le réseau est là.', duration: 2500, position: 'bottom' })
  await toast.present()
}
</script>

<template>
  <IonPage>
    <IonHeader>
      <IonToolbar>
        <IonButtons slot="start"><IonBackButton default-href="/vehicules" text="Retour" /></IonButtons>
        <IonTitle>{{ vehicle?.name ?? 'Véhicule' }}</IonTitle>
      </IonToolbar>
    </IonHeader>
    <IonContent>
      <div v-if="loading" class="ion-padding ion-text-center"><IonSpinner /></div>
      <p v-else-if="error || !vehicle" class="ion-padding"><IonText color="medium">{{ error ?? 'Véhicule indisponible hors ligne.' }}</IonText></p>
      <template v-else>
        <p v-if="offline" class="ion-padding-horizontal"><IonText color="medium">Hors ligne : dernière copie gardée sur le téléphone.</IonText></p>
        <IonList>
          <IonItem>
            <IonLabel class="ion-text-wrap">
              <h2>{{ vehicleSubtitle(vehicle) || vehicle.kind.label }}</h2>
              <p>{{ vehicle.kind.label }}<template v-if="vehicle.fuel"> · {{ vehicle.fuel.label }}</template> · {{ vehicle.status.label }}</p>
              <p v-if="vehicle.driver">Conducteur : {{ vehicle.driver.full_name }}</p>
            </IonLabel>
            <IonNote slot="end">{{ formatKm(current) }}</IonNote>
          </IonItem>
          <IonItem v-for="(a, i) in vehicle.alerts ?? []" :key="i" lines="none">
            <IonLabel class="ion-text-wrap"><IonText :color="stateColor(a.state)">{{ alertText(a) }}</IonText></IonLabel>
          </IonItem>
        </IonList>

        <IonList v-if="vehicle.can.record_mileage">
          <IonListHeader><IonLabel>Relever le compteur</IonLabel></IonListHeader>
          <IonItem>
            <IonInput v-model="km" type="number" inputmode="numeric" label="Kilométrage" label-placement="stacked" :placeholder="String(current)" />
          </IonItem>
          <IonItem>
            <IonInput v-model="note" label="Note (facultatif)" label-placement="stacked" placeholder="Plein, trajet…" />
          </IonItem>
          <p v-if="formError" class="ion-padding-horizontal"><IonText color="danger">{{ formError }}</IonText></p>
          <div class="ion-padding-horizontal"><IonButton expand="block" @click="save">Enregistrer le relevé</IonButton></div>
          <IonItem v-for="(p, i) in pending" :key="`p${i}`" lines="none">
            <IonLabel><IonText color="medium">En attente d'envoi : {{ formatKm(p.km) }}</IonText></IonLabel>
          </IonItem>
        </IonList>

        <IonList>
          <IonListHeader><IonLabel>Papiers</IonLabel></IonListHeader>
          <IonItem v-for="p in papers" :key="p.id">
            <IonLabel class="ion-text-wrap">
              <h3>{{ p.title }}</h3>
              <p>{{ [p.number, p.provider].filter(Boolean).join(' · ') }}</p>
            </IonLabel>
            <IonNote slot="end" :color="p.state ? stateColor(p.state) : undefined">{{ p.expires_on ? formatDate(p.expires_on) : 'Sans échéance' }}</IonNote>
          </IonItem>
          <IonItem v-if="!papers.length" lines="none"><IonLabel><IonText color="medium">Aucun papier enregistré.</IonText></IonLabel></IonItem>
        </IonList>

        <IonList v-if="vehicle.upcoming?.length">
          <IonListHeader><IonLabel>Prochains entretiens</IonLabel></IonListHeader>
          <IonItem v-for="u in vehicle.upcoming" :key="u.type">
            <IonLabel class="ion-text-wrap">
              <h3>{{ u.label }}</h3>
              <p>{{ [u.next_on ? `le ${formatDate(u.next_on)}` : null, u.next_km ? `à ${formatKm(u.next_km)}` : null].filter(Boolean).join(' ou ') }}</p>
            </IonLabel>
            <IonNote slot="end" :color="stateColor(u.state)">{{ u.state === 'late' ? 'En retard' : u.state === 'soon' ? 'Bientôt' : 'Prévu' }}</IonNote>
          </IonItem>
        </IonList>

        <IonList v-if="vehicle.characteristics.length || vehicle.notes">
          <IonListHeader><IonLabel>Caractéristiques</IonLabel></IonListHeader>
          <IonItem v-for="(c, i) in vehicle.characteristics" :key="i">
            <IonLabel>{{ c.label }}</IonLabel>
            <IonNote slot="end">{{ c.value || '—' }}</IonNote>
          </IonItem>
          <IonItem v-if="vehicle.notes" lines="none"><IonLabel class="ion-text-wrap"><MarkdownView :text="vehicle.notes" /></IonLabel></IonItem>
        </IonList>
      </template>
    </IonContent>
  </IonPage>
</template>
