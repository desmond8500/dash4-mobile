<script setup lang="ts">
import { reactive, ref } from 'vue'
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
import { CLIENT_STATUS_LABELS, CLIENT_TYPE_LABELS } from '@dash4/shared'
import type { ClientStatus, ClientType } from '@dash4/shared'
import { useClientsStore } from '@/stores/clients'
import { useSyncStore } from '@/stores/sync'
import { buildClientPayload } from '@/utils/forms'

const store = useClientsStore()
const sync = useSyncStore()
const ionRouter = useIonRouter()

const form = reactive({
  name: '',
  type: 'company' as ClientType,
  status: 'prospect' as ClientStatus,
  phone: '',
  email: '',
  address: '',
  description: '',
})
const error = ref<string | null>(null)
const saving = ref(false)

const types = Object.entries(CLIENT_TYPE_LABELS)
const statuses = Object.entries(CLIENT_STATUS_LABELS)

async function save(): Promise<void> {
  error.value = null
  if (!form.name.trim()) {
    error.value = 'Le nom est obligatoire.'
    return
  }
  saving.value = true
  try {
    await store.createClient(buildClientPayload(form))
    const toast = await toastController.create({
      message: sync.online ? 'Client enregistré.' : 'Client enregistré sur le téléphone, envoyé dès le retour du réseau.',
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
          <IonBackButton default-href="/clients" text="Annuler" />
        </IonButtons>
        <IonTitle>Nouveau client</IonTitle>
        <IonButtons slot="end">
          <IonButton strong :disabled="saving" @click="save">Enregistrer</IonButton>
        </IonButtons>
      </IonToolbar>
    </IonHeader>

    <IonContent>
      <form @submit.prevent="save">
        <IonList inset>
          <IonItem>
            <IonInput v-model="form.name" label="Nom" label-placement="stacked" required autocapitalize="words" />
          </IonItem>
          <IonItem>
            <IonSelect v-model="form.type" label="Type" interface="action-sheet" cancel-text="Annuler">
              <IonSelectOption v-for="[value, label] in types" :key="value" :value="value">{{ label }}</IonSelectOption>
            </IonSelect>
          </IonItem>
          <IonItem>
            <IonSelect v-model="form.status" label="Statut" interface="action-sheet" cancel-text="Annuler">
              <IonSelectOption v-for="[value, label] in statuses" :key="value" :value="value">
                {{ label }}
              </IonSelectOption>
            </IonSelect>
          </IonItem>
        </IonList>

        <IonList inset>
          <IonItem>
            <IonInput v-model="form.phone" label="Téléphone" label-placement="stacked" type="tel" inputmode="tel" />
          </IonItem>
          <IonItem>
            <IonInput v-model="form.email" label="E-mail" label-placement="stacked" type="email" inputmode="email" />
          </IonItem>
          <IonItem>
            <IonInput v-model="form.address" label="Adresse" label-placement="stacked" />
          </IonItem>
          <IonItem>
            <IonTextarea v-model="form.description" label="Notes" label-placement="stacked" :auto-grow="true" />
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
