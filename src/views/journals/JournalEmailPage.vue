<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonCheckbox,
  IonChip,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonNote,
  IonPage,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonText,
  IonTextarea,
  IonTitle,
  IonToolbar,
  toastController,
  useIonRouter,
} from '@ionic/vue'
import { closeCircle } from 'ionicons/icons'
import type { QuoteEmailDraft } from '@dash4/shared'
import { api } from '@/services/api'
import { useJournalsStore } from '@/stores/journals'
import { useSyncStore } from '@/stores/sync'
import { addEmails, isEmail } from '@/utils/emails'

/** Envoi du rapport par e-mail (PDF joint) : destinataires proposés depuis le client et ses contacts. */
const props = defineProps<{ id: string }>()
const store = useJournalsStore()
const sync = useSyncStore()
const ionRouter = useIonRouter()
const journal = computed(() => store.find(Number(props.id)) ?? null)

const draft = ref<QuoteEmailDraft | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const to = ref<string[]>([])
const cc = ref<string[]>([])
const typed = ref({ to: '', cc: '' })
const subject = ref('')
const message = ref('')
const signatureId = ref<number | null>(null)
const sending = ref(false)

onMounted(async () => {
  await store.load()
  if (!journal.value) {
    error.value = "Ce rapport n'est pas sur le téléphone."
  } else if (!sync.online) {
    error.value = 'Il faut le réseau pour préparer l’e-mail (destinataires, signature).'
  } else {
    try {
      draft.value = await api.journals.emailDraft(journal.value.id)
      subject.value = draft.value.subject
      message.value = draft.value.message
      signatureId.value = draft.value.default_signature_id
      // Le premier destinataire proposé est coché d'office
      if (draft.value.suggestions[0]) to.value = [draft.value.suggestions[0].email]
    } catch (e) {
      error.value = (e as Error).message
    }
  }
  loading.value = false
})

function toggle(email: string, on: boolean): void {
  to.value = on ? addEmails(to.value, email) : to.value.filter((x) => x !== email)
}
function addTyped(field: 'to' | 'cc'): void {
  const list = field === 'to' ? to : cc
  list.value = addEmails(list.value, typed.value[field])
  typed.value[field] = ''
}
const invalid = computed(() => [typed.value.to, typed.value.cc].some((t) => t.trim() && !t.split(/[\s,;]+/).filter(Boolean).every(isEmail)))

async function send(): Promise<void> {
  if (!journal.value) return
  addTyped('to')
  addTyped('cc')
  if (!to.value.length) return void (error.value = 'Ajoutez au moins un destinataire.')
  if (!subject.value.trim()) return void (error.value = "Indiquez l'objet.")
  sending.value = true
  await store.sendEmail(journal.value, { to: to.value, cc: cc.value, subject: subject.value.trim(), message: message.value, signature_id: signatureId.value })
  const toast = await toastController.create({ message: sync.online ? 'Rapport envoyé.' : 'Envoi au retour du réseau.', duration: 2000, position: 'top' })
  await toast.present()
  sending.value = false
  ionRouter.back()
}
</script>

<template>
  <IonPage>
    <IonHeader>
      <IonToolbar>
        <IonButtons slot="start"><IonBackButton :default-href="`/rapports/${props.id}`" text="Retour" /></IonButtons>
        <IonTitle>Envoyer le rapport</IonTitle>
        <IonButtons slot="end"><IonButton strong :disabled="!draft || sending || invalid" @click="send">Envoyer</IonButton></IonButtons>
      </IonToolbar>
    </IonHeader>
    <IonContent>
      <div v-if="loading" class="ion-padding ion-text-center"><IonSpinner /></div>
      <div v-else-if="!draft" class="ion-padding ion-text-center"><IonText color="medium"><p>{{ error }}</p></IonText></div>
      <template v-else>
        <IonList v-if="draft.suggestions.length" inset>
          <IonListHeader><IonLabel>Destinataires proposés</IonLabel></IonListHeader>
          <IonItem v-for="s in draft.suggestions" :key="s.email">
            <IonCheckbox slot="start" :checked="to.includes(s.email)" :aria-label="s.email" @ion-change="toggle(s.email, $event.detail.checked)" />
            <IonLabel class="ion-text-wrap"><h3>{{ s.name }}</h3><p>{{ [s.label, s.email].filter(Boolean).join(' · ') }}</p></IonLabel>
          </IonItem>
        </IonList>

        <IonList inset>
          <IonItem>
            <IonInput v-model="typed.to" type="email" inputmode="email" label="À" label-placement="stacked" placeholder="adresse@exemple.sn" @keyup.enter="addTyped('to')" @ion-blur="addTyped('to')" />
          </IonItem>
          <div v-if="to.length" class="chips ion-padding-horizontal">
            <IonChip v-for="e in to" :key="e" @click="to = to.filter((x) => x !== e)">{{ e }}<IonIcon :icon="closeCircle" /></IonChip>
          </div>
          <IonItem>
            <IonInput v-model="typed.cc" type="email" inputmode="email" label="Copie" label-placement="stacked" @keyup.enter="addTyped('cc')" @ion-blur="addTyped('cc')" />
          </IonItem>
          <div v-if="cc.length" class="chips ion-padding-horizontal">
            <IonChip v-for="e in cc" :key="e" @click="cc = cc.filter((x) => x !== e)">{{ e }}<IonIcon :icon="closeCircle" /></IonChip>
          </div>
          <IonItem><IonInput v-model="subject" label="Objet" label-placement="stacked" /></IonItem>
          <IonItem><IonTextarea v-model="message" label="Message" label-placement="stacked" :auto-grow="true" :rows="6" /></IonItem>
          <IonItem v-if="draft.signatures.length">
            <IonSelect v-model="signatureId" label="Signature" label-placement="stacked" interface="action-sheet" cancel-text="Annuler">
              <IonSelectOption :value="null">Aucune</IonSelectOption>
              <IonSelectOption v-for="sig in draft.signatures" :key="sig.id" :value="sig.id">{{ sig.name }}</IonSelectOption>
            </IonSelect>
          </IonItem>
        </IonList>
        <div class="ion-padding-horizontal">
          <IonNote>Le rapport en PDF, avec les photos, est joint.</IonNote>
          <IonText v-if="invalid" color="danger"><p>Une adresse n'est pas valide.</p></IonText>
          <IonText v-else-if="error" color="danger"><p>{{ error }}</p></IonText>
        </div>
      </template>
    </IonContent>
  </IonPage>
</template>

<style scoped>
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}
</style>
