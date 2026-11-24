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
  IonSegment,
  IonSegmentButton,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonText,
  IonTextarea,
  IonTitle,
  IonToolbar,
  toastController,
} from '@ionic/vue'
import { loanDueText, TOOL_CONDITION_LABELS, TOOL_STATUS_LABELS, type Tool, type ToolCondition } from '@dash4/shared'
import MarkdownView from '@/components/MarkdownView.vue'
import SearchSelect from '@/components/SearchSelect.vue'
import { useToolsStore } from '@/stores/tools'
import { useProjectsStore } from '@/stores/projects'
import { formatDate } from '@/utils/projects'
import { displayedStatus, isoDateIn, toolColor } from '@/utils/tools'

/**
 * Fiche d'un outil (ouverte aussi en scannant son étiquette QR) : qui l'a, jusqu'à quand ; prêter, enregistrer
 * le retour avec l'état constaté, envoyer un rappel. Tout marche hors ligne : les actions partent au retour du réseau.
 */
const props = defineProps<{ id: string }>()
const store = useToolsStore()
const projects = useProjectsStore()

const tool = ref<Tool | null>(null)
const offline = ref(false)
const loading = ref(true)
const error = ref<string | null>(null)
const formError = ref<string | null>(null)

const pending = computed(() => (tool.value ? store.pendingFor(tool.value.id) : []))
const status = computed(() => (tool.value ? displayedStatus(tool.value, pending.value) : 'available'))
const loan = computed(() => tool.value?.current_loan ?? null)
const lendPending = computed(() => pending.value.some((p) => p.kind === 'lend'))
const returnPending = computed(() => pending.value.some((p) => p.kind === 'return'))
const canLend = computed(() => store.canLend() && !!tool.value?.can.lend)
const conditions = computed(() =>
  store.options?.conditions ?? (Object.entries(TOOL_CONDITION_LABELS) as Array<[ToolCondition, string]>).map(([value, label]) => ({ value, label })),
)

// Prêt
const who = ref<'user' | 'external'>('user')
const borrowerId = ref<number | null>(null)
const borrowerName = ref('')
const borrowerPhone = ref('')
const projectId = ref<number | null>(null)
const dueOn = ref(isoDateIn(7))
const notes = ref('')
const borrowerOptions = computed(() => (store.options?.borrowers ?? []).map((u) => ({ value: u.id, label: u.full_name })))
const projectOptions = computed(() => projects.items.filter((p) => !p.deleted_at).map((p) => ({ value: p.id, label: p.name })))

// Retour
const returnCondition = ref<ToolCondition>('good')
const returnNotes = ref('')

async function load(): Promise<void> {
  try {
    const result = await store.detail(Number(props.id))
    tool.value = result.tool
    offline.value = result.offline
    if (tool.value) returnCondition.value = tool.value.condition.value
  } catch {
    error.value = 'Outil introuvable, ou vous ne pouvez pas le voir.'
  } finally {
    loading.value = false
  }
}
onMounted(async () => {
  await store.load()
  await load()
  void projects.load().catch(() => undefined)
})

async function toast(message: string): Promise<void> {
  const t = await toastController.create({ message, duration: 2500, position: 'bottom' })
  await t.present()
}

async function lend(): Promise<void> {
  if (!tool.value) return
  formError.value = null
  if (who.value === 'user' && !borrowerId.value) return void (formError.value = "Choisissez à qui l'outil est prêté.")
  if (who.value === 'external' && !borrowerName.value.trim()) return void (formError.value = 'Indiquez le nom de la personne.')
  if (dueOn.value && dueOn.value < isoDateIn(0)) return void (formError.value = 'La date de retour ne peut pas être passée.')
  const label = who.value === 'user' ? (borrowerOptions.value.find((o) => o.value === borrowerId.value)?.label ?? '') : borrowerName.value.trim()
  await store.lend(
    tool.value,
    {
      ...(who.value === 'user' ? { borrower_id: borrowerId.value } : { borrower_name: borrowerName.value.trim(), borrower_phone: borrowerPhone.value.trim() || null }),
      project_id: projectId.value,
      due_on: dueOn.value || null,
      notes: notes.value.trim() || null,
    },
    label,
  )
  borrowerId.value = null
  borrowerName.value = ''
  borrowerPhone.value = ''
  notes.value = ''
  await toast(`Prêt enregistré à ${label} : il part dès que le réseau est là.`)
}

async function returnTool(): Promise<void> {
  if (!tool.value || !loan.value) return
  await store.returnTool(tool.value, loan.value, returnCondition.value, returnNotes.value.trim() || null)
  returnNotes.value = ''
  await toast('Retour enregistré : il part dès que le réseau est là.')
}

async function remind(): Promise<void> {
  if (!tool.value || !loan.value) return
  await store.remind(tool.value, loan.value)
  await toast(`Rappel envoyé à ${loan.value.borrower_label}.`)
}
</script>

<template>
  <IonPage>
    <IonHeader>
      <IonToolbar>
        <IonButtons slot="start"><IonBackButton default-href="/outillage" text="Retour" /></IonButtons>
        <IonTitle>{{ tool?.name ?? 'Outil' }}</IonTitle>
      </IonToolbar>
    </IonHeader>
    <IonContent>
      <div v-if="loading" class="ion-padding ion-text-center"><IonSpinner /></div>
      <p v-else-if="error || !tool" class="ion-padding"><IonText color="medium">{{ error ?? 'Outil indisponible hors ligne : ouvrez l’outillage avec le réseau une première fois.' }}</IonText></p>
      <template v-else>
        <p v-if="offline" class="ion-padding-horizontal"><IonText color="medium">Hors ligne : dernière copie gardée sur le téléphone.</IonText></p>
        <IonList>
          <IonItem>
            <IonLabel class="ion-text-wrap">
              <h2>{{ tool.name }}</h2>
              <p>{{ [tool.code, tool.article?.brand, tool.serial_number ? `S/N ${tool.serial_number}` : null].filter(Boolean).join(' · ') }}</p>
              <p>{{ tool.condition.label }}<template v-if="tool.storage_location"> · rangé à {{ tool.storage_location.name }}</template></p>
            </IonLabel>
            <IonNote slot="end" :color="toolColor(status)">{{ TOOL_STATUS_LABELS[status] }}</IonNote>
          </IonItem>
          <IonItem v-for="(p, i) in pending" :key="`p${i}`" lines="none">
            <IonLabel class="ion-text-wrap"><IonText color="medium">En attente d'envoi : {{ p.label }}</IonText></IonLabel>
          </IonItem>
        </IonList>

        <IonList v-if="loan && !returnPending">
          <IonListHeader><IonLabel>Prêt en cours</IonLabel></IonListHeader>
          <IonItem>
            <IonLabel class="ion-text-wrap">
              <h3>Chez {{ loan.borrower_label }}</h3>
              <p v-if="loan.borrower_phone">{{ loan.borrower_phone }}</p>
              <p>Depuis le {{ formatDate(loan.lent_at) }}<template v-if="loan.project"> · {{ loan.project.name }}</template></p>
            </IonLabel>
            <IonNote slot="end" :color="toolColor(loan.state)">{{ loanDueText(loan) }}</IonNote>
          </IonItem>
          <IonItem v-if="loan.notes" lines="none"><IonLabel class="ion-text-wrap"><MarkdownView :text="loan.notes" /></IonLabel></IonItem>
          <template v-if="canLend">
            <IonItem>
              <IonSelect v-model="returnCondition" label="État au retour" label-placement="stacked" interface="action-sheet">
                <IonSelectOption v-for="c in conditions" :key="c.value" :value="c.value">{{ c.label }}</IonSelectOption>
              </IonSelect>
            </IonItem>
            <IonItem><IonTextarea v-model="returnNotes" label="Remarques (facultatif)" label-placement="stacked" auto-grow placeholder="Accessoires manquants, dégâts…" /></IonItem>
            <div class="ion-padding-horizontal actions">
              <IonButton expand="block" @click="returnTool">Enregistrer le retour</IonButton>
              <IonButton v-if="loan.borrower_id" expand="block" fill="outline" @click="remind">Envoyer un rappel</IonButton>
            </div>
          </template>
        </IonList>

        <IonList v-else-if="canLend && status === 'available' && !lendPending">
          <IonListHeader><IonLabel>Prêter l'outil</IonLabel></IonListHeader>
          <div class="ion-padding-horizontal">
            <IonSegment v-model="who">
              <IonSegmentButton value="user"><IonLabel>Équipe</IonLabel></IonSegmentButton>
              <IonSegmentButton value="external"><IonLabel>Extérieur</IonLabel></IonSegmentButton>
            </IonSegment>
          </div>
          <SearchSelect v-if="who === 'user'" v-model="borrowerId" label="Prêté à" placeholder="Choisir une personne" :options="borrowerOptions" />
          <template v-else>
            <IonItem><IonInput v-model="borrowerName" label="Nom" label-placement="stacked" autocapitalize="words" placeholder="Sous-traitant, client…" /></IonItem>
            <IonItem><IonInput v-model="borrowerPhone" type="tel" inputmode="tel" label="Téléphone" label-placement="stacked" /></IonItem>
          </template>
          <IonItem><IonInput v-model="dueOn" type="date" label="À rendre le" label-placement="stacked" :min="isoDateIn(0)" /></IonItem>
          <SearchSelect v-if="projectOptions.length" v-model="projectId" label="Pour le projet" null-label="Aucun" placeholder="Aucun" :options="projectOptions" />
          <IonItem><IonTextarea v-model="notes" label="Notes (facultatif)" label-placement="stacked" auto-grow /></IonItem>
          <p v-if="formError" class="ion-padding-horizontal"><IonText color="danger">{{ formError }}</IonText></p>
          <p v-if="!borrowerOptions.length && who === 'user'" class="ion-padding-horizontal"><IonNote>Liste de l'équipe pas encore sur le téléphone : ouvrez l'outillage avec le réseau.</IonNote></p>
          <div class="ion-padding-horizontal"><IonButton expand="block" @click="lend">Prêter</IonButton></div>
          <p class="ion-padding-horizontal"><IonNote>Un rappel part la veille et le jour du retour, puis tous les 3 jours de retard.</IonNote></p>
        </IonList>

        <p v-else-if="canLend && status === 'unavailable'" class="ion-padding-horizontal">
          <IonText color="warning">Outil « {{ tool.condition.label }} » : changez son état sur le web avant de le prêter.</IonText>
        </p>

        <IonList v-if="tool.loans?.length">
          <IonListHeader><IonLabel>Prêts</IonLabel></IonListHeader>
          <IonItem v-for="l in tool.loans" :key="l.id">
            <IonLabel class="ion-text-wrap">
              <h3>{{ l.borrower_label }}</h3>
              <p>Du {{ formatDate(l.lent_at) }}<template v-if="l.returned_at"> au {{ formatDate(l.returned_at) }}</template><template v-if="l.return_condition"> · {{ l.return_condition.label }}</template></p>
            </IonLabel>
            <IonNote v-if="!l.returned_at" slot="end" :color="toolColor(l.state)">{{ loanDueText(l) }}</IonNote>
          </IonItem>
        </IonList>

        <IonList v-if="tool.notes || tool.article">
          <IonListHeader><IonLabel>Fiche</IonLabel></IonListHeader>
          <IonItem v-if="tool.article">
            <IonLabel class="ion-text-wrap"><p>Article du stock</p><h3>{{ tool.article.designation }}</h3></IonLabel>
            <IonNote v-if="tool.article.reference" slot="end">{{ tool.article.reference }}</IonNote>
          </IonItem>
          <IonItem v-if="tool.notes" lines="none"><IonLabel class="ion-text-wrap"><MarkdownView :text="tool.notes" /></IonLabel></IonItem>
        </IonList>
      </template>
    </IonContent>
  </IonPage>
</template>

<style scoped>
.actions {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1rem;
}
</style>
