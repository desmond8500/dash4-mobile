<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonList,
  IonNote,
  IonPage,
  IonText,
  IonTitle,
  IonToolbar,
  toastController,
  useIonRouter,
} from '@ionic/vue'
import { useClientsStore } from '@/stores/clients'
import { useSyncStore } from '@/stores/sync'
import { buildContactPayload } from '@/utils/forms'

/** `id` : client auquel le contact est rattaché. */
const props = defineProps<{ id: string }>()
const store = useClientsStore()
const sync = useSyncStore()
const ionRouter = useIonRouter()

const client = computed(() => store.findClient(Number(props.id)))

const form = reactive({ firstname: '', lastname: '', job_title: '', phone: '', email: '' })
const error = ref<string | null>(null)
const saving = ref(false)

async function save(): Promise<void> {
  error.value = null
  if (!form.firstname.trim()) {
    error.value = 'Le prénom est obligatoire.'
    return
  }
  saving.value = true
  try {
    await store.createContact(buildContactPayload(form, Number(props.id)))
    const toast = await toastController.create({
      message: sync.online ? 'Contact enregistré.' : 'Contact enregistré sur le téléphone, envoyé dès le retour du réseau.',
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
        <IonButtons slot="start">
          <IonBackButton :default-href="`/clients/${props.id}`" text="Annuler" />
        </IonButtons>
        <IonTitle>Nouveau contact</IonTitle>
        <IonButtons slot="end">
          <IonButton strong :disabled="saving" @click="save">Enregistrer</IonButton>
        </IonButtons>
      </IonToolbar>
    </IonHeader>

    <IonContent>
      <form @submit.prevent="save">
        <div v-if="client" class="ion-padding-horizontal ion-padding-top">
          <IonNote>Client : {{ client.name }}</IonNote>
        </div>
        <IonList inset>
          <IonItem>
            <IonInput v-model="form.firstname" label="Prénom" label-placement="stacked" required autocapitalize="words" />
          </IonItem>
          <IonItem>
            <IonInput v-model="form.lastname" label="Nom" label-placement="stacked" autocapitalize="words" />
          </IonItem>
          <IonItem>
            <IonInput v-model="form.job_title" label="Fonction" label-placement="stacked" />
          </IonItem>
          <IonItem>
            <IonInput v-model="form.phone" label="Téléphone" label-placement="stacked" type="tel" inputmode="tel" />
          </IonItem>
          <IonItem>
            <IonInput v-model="form.email" label="E-mail" label-placement="stacked" type="email" inputmode="email" />
          </IonItem>
        </IonList>

        <div class="ion-padding">
          <IonText v-if="error" color="danger"><p>{{ error }}</p></IonText>
          <IonButton expand="block" type="submit" :disabled="saving">Enregistrer</IonButton>
        </div>
      </form>
    </IonContent>
  </IonPage>
</template>
