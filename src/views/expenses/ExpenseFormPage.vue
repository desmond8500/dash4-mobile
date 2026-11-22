<script setup lang="ts">
import SearchSelect from '@/components/SearchSelect.vue'
import { computed, onMounted, reactive, ref } from 'vue'
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
  IonSegment,
  IonSegmentButton,
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
import { useQuotesStore } from '@/stores/quotes'
import { useTasksStore } from '@/stores/tasks'
import { useJournalsStore } from '@/stores/journals'
import { journalProjectOptions } from '@/utils/journals'
import { useRoute } from 'vue-router'
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
  quoteId: null,
  method: 'cash',
  advanced: false,
  description: '',
})
const photo = ref<File | null>(null)
const preview = ref<string | null>(null)
const error = ref<string | null>(null)
const saving = ref(false)
// Rattachement obligatoire : un projet, ou un devis (gestionnaires ; le projet du devis suit)
const quotes = useQuotesStore()
const tasks = useTasksStore()
const journals = useJournalsStore()
const route = useRoute()
const canPickQuote = auth.canAny(['quotes.view', 'quotes.view.own']) && !auth.isTechnician
const linkTo = ref<'project' | 'quote'>('project')
/** Projets proposés : la liste des projets, sinon ceux des tâches et des rapports du compte (techniciens). */
const projectOptions = computed(() =>
  journalProjectOptions([
    projects.items.filter((p) => !p.deleted_at).map((p) => ({ id: p.id, name: p.name })),
    tasks.all.map((t) => t.project),
    journals.items.map((j) => j.project),
  ]),
)
const quoteOptions = computed(() =>
  quotes.items
    .filter((q) => ['sent', 'accepted', 'draft'].includes(q.status.value))
    .map((q) => ({ value: q.id, label: `${q.number} — ${q.title}`, detail: [q.client?.name, q.project?.name, q.status.label].filter(Boolean).join(' · ') })),
)
function onLinkChange(value: 'project' | 'quote'): void {
  linkTo.value = value
  if (value === 'project') form.quoteId = null
  else form.projectId = null
}
function onQuote(id: number | null): void {
  const quote = quotes.items.find((q) => q.id === id)
  form.projectId = quote?.project_id ?? null
}

onMounted(async () => {
  await Promise.all([store.load(), projects.load().catch(() => undefined), tasks.load().catch(() => undefined), journals.load().catch(() => undefined), canPickQuote ? quotes.load().catch(() => undefined) : undefined])
  if (store.spaces.length === 1) form.spaceId = store.spaces[0]!.id
  const projectId = Number(route.query.project_id)
  if (projectId) form.projectId = projectId
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
          <IonItem v-if="canPickQuote && quoteOptions.length" lines="none">
            <IonSegment :value="linkTo" @ion-change="onLinkChange($event.detail.value as 'project' | 'quote')">
              <IonSegmentButton value="project"><IonLabel>Projet</IonLabel></IonSegmentButton>
              <IonSegmentButton value="quote"><IonLabel>Devis</IonLabel></IonSegmentButton>
            </IonSegment>
          </IonItem>
          <SearchSelect
            v-if="linkTo === 'project'"
            v-model="form.projectId"
            label="Projet *"
            placeholder="Choisir le projet de la dépense"
            :options="projectOptions.map((p) => ({ value: p.id, label: p.name }))"
          />
          <SearchSelect v-else v-model="form.quoteId" label="Devis *" placeholder="Choisir le devis" :options="quoteOptions" @select="onQuote" />
          <IonItem v-if="!projectOptions.length && !quoteOptions.length" lines="none">
            <IonText color="medium"><p>Aucun projet sur le téléphone : ouvrez vos tâches ou vos projets avec le réseau.</p></IonText>
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
