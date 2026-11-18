<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonPage,
  IonSegment,
  IonSegmentButton,
  IonText,
  IonTextarea,
  IonTitle,
  IonToggle,
  IonToolbar,
  toastController,
  useIonRouter,
} from '@ionic/vue'
import { closeCircle } from 'ionicons/icons'
import { CLIENT_REQUEST_SOURCE_LABELS } from '@dash4/shared'
import type { ClientRequestSource, Priority } from '@dash4/shared'
import { useAuthStore } from '@/stores/auth'
import { CLIENT_PERMISSIONS, useClientsStore } from '@/stores/clients'
import { useClientRequestsStore } from '@/stores/clientRequests'
import { useSyncStore } from '@/stores/sync'
import { matchesSearch } from '@/offline/collection'
import { buildRequestPayload } from '@/utils/requests'

const auth = useAuthStore()
const clients = useClientsStore()
const store = useClientRequestsStore()
const sync = useSyncStore()
const route = useRoute()
const ionRouter = useIonRouter()

// Un technicien ne voit pas la liste des clients : il note un nom et un téléphone
const canPickClient = computed(() => auth.canAny(CLIENT_PERMISSIONS) && !auth.isTechnician)

const form = reactive({
  body: '',
  clientId: null as number | null,
  contactName: '',
  contactPhone: '',
  source: 'phone' as ClientRequestSource,
  urgent: false,
})
const clientSearch = ref('')
const error = ref<string | null>(null)
const saving = ref(false)

const sources = Object.entries(CLIENT_REQUEST_SOURCE_LABELS) as Array<[ClientRequestSource, string]>
const selectedClient = computed(() => (form.clientId ? clients.findClient(form.clientId) : undefined))
const suggestions = computed(() =>
  clientSearch.value.trim().length < 2
    ? []
    : clients.sortedClients.filter((c) => matchesSearch(clientSearch.value, [c.name])).slice(0, 6),
)

onMounted(async () => {
  if (canPickClient.value) await clients.load()
  const fromClient = Number(route.query.client_id)
  if (fromClient) form.clientId = fromClient
})

function pickClient(id: number): void {
  form.clientId = id
  clientSearch.value = ''
}

async function save(): Promise<void> {
  error.value = null
  if (!form.body.trim()) {
    error.value = 'Écrivez la demande.'
    return
  }
  saving.value = true
  try {
    const priority: Priority = form.urgent ? 'high' : 'normal'
    await store.create(buildRequestPayload({ ...form, priority }))
    const toast = await toastController.create({
      message: sync.online ? 'Demande notée.' : 'Demande notée sur le téléphone, envoyée dès le retour du réseau.',
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
          <IonBackButton default-href="/demandes" text="Annuler" />
        </IonButtons>
        <IonTitle>Nouvelle demande</IonTitle>
        <IonButtons slot="end">
          <IonButton strong :disabled="saving" @click="save">Enregistrer</IonButton>
        </IonButtons>
      </IonToolbar>
    </IonHeader>

    <IonContent>
      <form @submit.prevent="save">
        <IonList inset>
          <IonItem>
            <IonTextarea
              v-model="form.body"
              label="Demande"
              label-placement="stacked"
              placeholder="Ex. : M. Diop veut deux caméras en plus"
              :auto-grow="true"
              :rows="3"
              autocapitalize="sentences"
            />
          </IonItem>
        </IonList>

        <IonList v-if="canPickClient" inset>
          <IonListHeader><IonLabel>Client</IonLabel></IonListHeader>
          <IonItem v-if="selectedClient">
            <IonLabel>{{ selectedClient.name }}</IonLabel>
            <IonButton slot="end" fill="clear" color="medium" aria-label="Retirer le client" @click="form.clientId = null">
              <IonIcon slot="icon-only" :icon="closeCircle" />
            </IonButton>
          </IonItem>
          <template v-else>
            <IonItem>
              <IonInput v-model="clientSearch" placeholder="Rechercher un client (facultatif)" :clear-input="true" />
            </IonItem>
            <IonItem v-for="c in suggestions" :key="c.id" button @click="pickClient(c.id)">
              <IonLabel>{{ c.name }}</IonLabel>
            </IonItem>
          </template>
        </IonList>

        <IonList v-if="!form.clientId" inset>
          <IonListHeader>
            <IonLabel>{{ canPickClient ? 'Ou personne à rappeler' : 'Personne à rappeler' }}</IonLabel>
          </IonListHeader>
          <IonItem>
            <IonInput v-model="form.contactName" label="Nom" label-placement="stacked" autocapitalize="words" />
          </IonItem>
          <IonItem>
            <IonInput
              v-model="form.contactPhone"
              label="Téléphone"
              label-placement="stacked"
              type="tel"
              inputmode="tel"
            />
          </IonItem>
        </IonList>

        <div class="ion-padding-horizontal">
          <IonSegment v-model="form.source" :scrollable="true">
            <IonSegmentButton v-for="[value, label] in sources" :key="value" :value="value">
              <IonLabel>{{ label }}</IonLabel>
            </IonSegmentButton>
          </IonSegment>
        </div>

        <IonList inset>
          <IonItem>
            <IonToggle v-model="form.urgent">Urgente</IonToggle>
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
