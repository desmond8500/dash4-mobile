<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonList,
  IonPage,
  IonSelect,
  IonSelectOption,
  IonText,
  IonTextarea,
  IonTitle,
  IonToolbar,
  toastController,
  useIonRouter,
} from '@ionic/vue'
import { OPEN_TASK_STATUSES } from '@dash4/shared'
import { useSyncStore } from '@/stores/sync'
import { useTasksStore } from '@/stores/tasks'
import { useTechSpaceStore } from '@/stores/techSpace'
import { todayIso } from '@/utils/expenses'
import { accessRequestError } from '@/utils/techSpace'

/** Demande d'accès (code, clé, badge…) : gardée sur le téléphone puis envoyée au chef de projet. */
const store = useTechSpaceStore()
const tasks = useTasksStore()
const sync = useSyncStore()
const route = useRoute()
const ionRouter = useIonRouter()

const form = reactive({ subject: '', reason: '', taskId: null as number | null, neededOn: '' })
const error = ref<string | null>(null)
const saving = ref(false)
const myTasks = computed(() => tasks.mine.filter((t) => OPEN_TASK_STATUSES.includes(t.status.value) || t.id === form.taskId))

onMounted(async () => {
  await Promise.all([store.load(), tasks.load()])
  const taskId = Number(route.query.task_id)
  if (taskId && tasks.find(taskId)) form.taskId = taskId
})

async function save(): Promise<void> {
  error.value = accessRequestError(form, todayIso())
  if (error.value) return
  saving.value = true
  try {
    await store.createRequest({
      subject: form.subject.trim(),
      reason: form.reason.trim() || null,
      task_id: form.taskId,
      needed_on: form.neededOn || null,
    })
    const toast = await toastController.create({
      message: sync.online ? 'Demande envoyée.' : 'Demande gardée sur le téléphone, envoyée dès le retour du réseau.',
      duration: 3000,
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
        <IonButtons slot="start"><IonBackButton default-href="/acces" text="Annuler" /></IonButtons>
        <IonTitle>Demander un accès</IonTitle>
        <IonButtons slot="end"><IonButton strong :disabled="saving" @click="save">Envoyer</IonButton></IonButtons>
      </IonToolbar>
    </IonHeader>
    <IonContent>
      <form @submit.prevent="save">
        <IonList inset>
          <IonItem><IonInput v-model="form.subject" label="Besoin" label-placement="stacked" placeholder="Code du portail, clé du local technique…" autocapitalize="sentences" /></IonItem>
          <IonItem><IonTextarea v-model="form.reason" label="Pourquoi" label-placement="stacked" :auto-grow="true" autocapitalize="sentences" /></IonItem>
          <IonItem v-if="myTasks.length">
            <IonSelect v-model="form.taskId" label="Tâche" label-placement="stacked" interface="action-sheet" cancel-text="Annuler">
              <IonSelectOption :value="null">Sans tâche</IonSelectOption>
              <IonSelectOption v-for="t in myTasks" :key="t.id" :value="t.id">{{ t.title }}</IonSelectOption>
            </IonSelect>
          </IonItem>
          <IonItem><IonInput v-model="form.neededOn" type="date" label="Pour le" label-placement="stacked" :min="todayIso()" /></IonItem>
        </IonList>
        <div v-if="error" class="ion-padding-horizontal"><IonText color="danger"><p>{{ error }}</p></IonText></div>
        <div class="ion-padding"><IonButton expand="block" type="submit" :disabled="saving">Envoyer la demande</IonButton></div>
      </form>
    </IonContent>
  </IonPage>
</template>
