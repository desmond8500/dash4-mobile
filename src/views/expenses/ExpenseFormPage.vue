<script setup lang="ts">
import SearchSelect from '@/components/SearchSelect.vue'
import { onMounted, reactive, ref } from 'vue'
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
  IonPage,
  IonSelect,
  IonSelectOption,
  IonText,
  IonTextarea,
  IonTitle,
  IonToggle,
  IonToolbar,
  toastController,
  useIonRouter,
} from '@ionic/vue'
import { openLightbox } from '@/utils/lightbox'
import { PAYMENT_METHODS } from '@dash4/shared'
import { useAuthStore } from '@/stores/auth'
import { useExpensesStore } from '@/stores/expenses'
import { useProjectsStore } from '@/stores/projects'
import { useSyncStore } from '@/stores/sync'
import { buildExpensePayload, todayIso, type ExpenseForm } from '@/utils/expenses'

const store = useExpensesStore()
const projects = useProjectsStore()
const auth = useAuthStore()
const sync = useSyncStore()
const ionRouter = useIonRouter()

const form = reactive<ExpenseForm>({
  label: '',
  amount: null,
  spentAt: todayIso(),
  categoryId: null,
  spaceId: null,
  projectId: null,
  method: 'cash',
  advanced: false,
  description: '',
})
const photo = ref<File | null>(null)
const preview = ref<string | null>(null)
const error = ref<string | null>(null)
const saving = ref(false)
const canPickProject = auth.canAny(['projects.view', 'projects.view.own']) && !auth.isTechnician

onMounted(async () => {
  await store.load()
  if (canPickProject) await projects.load()
  if (store.spaces.length === 1) form.spaceId = store.spaces[0]!.id
})

function onPhoto(event: Event): void {
  const input = event.target as HTMLInputElement
  photo.value = input.files?.[0] ?? null
  if (preview.value) URL.revokeObjectURL(preview.value)
  preview.value = photo.value ? URL.createObjectURL(photo.value) : null
}

async function save(): Promise<void> {
  const { payload, error: problem } = buildExpensePayload(form, todayIso())
  error.value = problem ?? null
  if (!payload) return
  saving.value = true
  try {
    await store.create(payload, photo.value)
    const toast = await toastController.create({
      message: sync.online ? 'Dépense envoyée pour validation.' : 'Dépense notée sur le téléphone, envoyée dès le retour du réseau.',
      duration: 2500,
      position: 'top',
    })
    await toast.present()
    ionRouter.back()
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <IonPage>
    <IonHeader>
      <IonToolbar>
        <IonButtons slot="start"><IonBackButton default-href="/depenses" text="Annuler" /></IonButtons>
        <IonTitle>Nouvelle dépense</IonTitle>
        <IonButtons slot="end"><IonButton strong :disabled="saving" @click="save">Enregistrer</IonButton></IonButtons>
      </IonToolbar>
    </IonHeader>

    <IonContent>
      <form @submit.prevent="save">
        <IonList inset>
          <IonItem><IonInput v-model="form.label" label="Quoi ?" label-placement="stacked" placeholder="Taxi, carburant, câble…" autocapitalize="sentences" /></IonItem>
          <IonItem><IonInput v-model="form.amount" type="number" inputmode="numeric" label="Montant (F CFA)" label-placement="stacked" min="1" /></IonItem>
          <IonItem><IonInput v-model="form.spentAt" type="date" label="Date" label-placement="stacked" :max="todayIso()" /></IonItem>
          <IonItem>
            <IonSelect v-model="form.method" label="Payé par" label-placement="stacked" interface="action-sheet" cancel-text="Annuler">
              <IonSelectOption v-for="m in PAYMENT_METHODS" :key="m.value" :value="m.value">{{ m.label }}</IonSelectOption>
            </IonSelect>
          </IonItem>
          <IonItem>
            <IonToggle v-model="form.advanced">Payée avec mon argent (à me rembourser)</IonToggle>
          </IonItem>
        </IonList>

        <IonList inset>
          <IonItem v-if="store.categories.length">
            <IonSelect v-model="form.categoryId" label="Catégorie" label-placement="stacked" interface="action-sheet" cancel-text="Annuler">
              <IonSelectOption :value="null">Sans catégorie</IonSelectOption>
              <IonSelectOption v-for="c in store.categories" :key="c.id" :value="c.id">{{ c.name }}</IonSelectOption>
            </IonSelect>
          </IonItem>
          <IonItem v-if="store.spaces.length">
            <IonSelect v-model="form.spaceId" label="Caisse" label-placement="stacked" interface="action-sheet" cancel-text="Annuler">
              <IonSelectOption :value="null">Aucune</IonSelectOption>
              <IonSelectOption v-for="s in store.spaces" :key="s.id" :value="s.id">{{ s.name }}</IonSelectOption>
            </IonSelect>
          </IonItem>
          <SearchSelect v-if="canPickProject && projects.active.length" v-model="form.projectId" label="Projet" null-label="Aucun" :options="projects.active.map((p) => ({ value: p.id, label: p.name, detail: p.client?.name }))" />
          <IonItem><IonTextarea v-model="form.description" label="Détails" label-placement="stacked" :auto-grow="true" /></IonItem>
        </IonList>

        <IonList inset>
          <IonItem lines="none">
            <IonLabel>Justificatif (reçu, facture)</IonLabel>
            <label class="photo-button">
              {{ photo ? 'Changer' : 'Prendre une photo' }}
              <input type="file" accept="image/*" capture="environment" hidden @change="onPhoto" />
            </label>
          </IonItem>
          <img v-if="preview" :src="preview" alt="" class="preview" @click="openLightbox([{ src: preview!, caption: 'Justificatif' }])" />
        </IonList>

        <div v-if="error" class="ion-padding-horizontal"><IonText color="danger"><p>{{ error }}</p></IonText></div>
        <div class="ion-padding"><IonButton expand="block" type="submit" :disabled="saving">Enregistrer la dépense</IonButton></div>
      </form>
    </IonContent>
  </IonPage>
</template>

<style scoped>
.photo-button {
  color: var(--ion-color-primary);
  font-weight: 600;
  cursor: pointer;
}

.preview {
  display: block;
  max-width: 100%;
  max-height: 240px;
  margin: 0 auto 1rem;
  object-fit: contain;
}
</style>
