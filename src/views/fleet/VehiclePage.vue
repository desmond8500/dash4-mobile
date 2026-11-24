<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { cameraOutline, carOutline } from 'ionicons/icons'
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonCheckbox,
  IonIcon,
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
import { alertText, formatKm, vehicleSubtitle, type Document, type Vehicle } from '@dash4/shared'
import { api } from '@/services/api'
import { openPhotos } from '@/utils/lightbox'
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
onMounted(() => void load().then(loadGallery))

// --- Photos ---------------------------------------------------------------------------------
const photoInput = ref<HTMLInputElement | null>(null)
const asMain = ref(false)
const gallery = ref<Array<{ url: string; name: string }>>([])
const pendingPhotos = computed(() => (vehicle.value ? store.pendingPhotosFor(vehicle.value.id) : 0))
const mainPhoto = computed(() => vehicle.value?.photo_url ?? null)

/** Photos de la galerie (documents image), quand le réseau est là. */
async function loadGallery(): Promise<void> {
  if (!vehicle.value || offline.value) return
  try {
    const docs = (await api.documents.list('vehicles', vehicle.value.id)).filter((d: Document) => (d.mime_type ?? '').startsWith('image/')).slice(0, 24)
    gallery.value = await Promise.all(docs.map(async (d) => ({ url: URL.createObjectURL(await api.documents.download(d)), name: d.name })))
  } catch {
    gallery.value = []
  }
}

async function onPhoto(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  input.value = ''
  if (!vehicle.value || !files.length) return
  for (const [i, file] of files.entries()) await store.addPhoto(vehicle.value, file, asMain.value && i === 0)
  asMain.value = false
  const toast = await toastController.create({ message: files.length > 1 ? `${files.length} photos enregistrées : elles partent dès que le réseau est là.` : 'Photo enregistrée : elle part dès que le réseau est là.', duration: 2500, position: 'bottom' })
  await toast.present()
  // Photo principale changée : on recharge la fiche
  setTimeout(() => void load().then(loadGallery), 1500)
}

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
        <div class="hero" :class="{ empty: !mainPhoto }">
          <img v-if="mainPhoto" :src="mainPhoto" :alt="`Photo de ${vehicle.name}`" @click="openPhotos([{ url: mainPhoto!, name: vehicle.name }, ...gallery], mainPhoto!)" />
          <IonIcon v-else :icon="carOutline" aria-hidden="true" />
        </div>
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

        <IonList v-if="vehicle.can.add_photos || gallery.length">
          <IonListHeader><IonLabel>Photos</IonLabel></IonListHeader>
          <div v-if="gallery.length" class="gallery ion-padding-horizontal">
            <img v-for="p in gallery" :key="p.url" :src="p.url" :alt="p.name" @click="openPhotos(gallery, p.url)" />
          </div>
          <template v-if="vehicle.can.add_photos">
            <IonItem lines="none">
              <IonCheckbox v-model="asMain" label-placement="end">En faire la photo principale</IonCheckbox>
            </IonItem>
            <div class="ion-padding-horizontal">
              <IonButton expand="block" fill="outline" @click="photoInput?.click()"><IonIcon slot="start" :icon="cameraOutline" />Prendre une photo</IonButton>
              <input ref="photoInput" type="file" accept="image/*" capture="environment" multiple hidden @change="onPhoto" />
            </div>
            <p v-if="pendingPhotos" class="ion-padding-horizontal"><IonText color="medium">{{ pendingPhotos }} photo(s) en attente d'envoi.</IonText></p>
            <p v-else class="ion-padding-horizontal"><IonText color="medium">État du véhicule, dégâts, compteur, papiers… Marche aussi sans réseau.</IonText></p>
          </template>
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

<style scoped>
.hero {
  height: 200px;
  background: var(--ion-color-light);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.hero img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.hero ion-icon {
  font-size: 4rem;
  color: var(--ion-color-medium);
}
.gallery {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.375rem;
  margin-bottom: 0.5rem;
}
.gallery img {
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
  border-radius: 0.5rem;
}
</style>
