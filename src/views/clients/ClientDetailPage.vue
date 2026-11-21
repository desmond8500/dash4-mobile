<script setup lang="ts">
import { markdownToText } from '@dash4/shared'
import MarkdownView from '@/components/MarkdownView.vue'
import { computed, onMounted } from 'vue'
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonNote,
  IonPage,
  IonText,
  IonTitle,
  IonToolbar,
} from '@ionic/vue'
import {
  addCircleOutline,
  callOutline,
  cloudUploadOutline,
  locationOutline,
  mailOutline,
  personAddOutline,
} from 'ionicons/icons'
import type { Contact } from '@dash4/shared'
import { useAuthStore } from '@/stores/auth'
import { useClientsStore } from '@/stores/clients'
import { useClientRequestsStore } from '@/stores/clientRequests'
import { useProjectsStore } from '@/stores/projects'
import { mailHref, telHref } from '@/utils/links'
import ClientLogo from '@/components/ClientLogo.vue'
import QuoteList from '@/components/QuoteList.vue'
import InvoiceList from '@/components/InvoiceList.vue'
import { useInvoicesStore } from '@/stores/invoices'
import { useQuotesStore } from '@/stores/quotes'

const props = defineProps<{ id: string }>()
const auth = useAuthStore()
const store = useClientsStore()
const requests = useClientRequestsStore()
const projects = useProjectsStore()
const clientProjects = computed(() => projects.ofClient(Number(props.id)))
const quotes = useQuotesStore()
const clientQuotes = computed(() => quotes.ofClient(Number(props.id)))
const invoices = useInvoicesStore()
const clientInvoices = computed(() => invoices.ofClient(Number(props.id)))
const clientRequests = computed(() => requests.sorted.filter((r) => r.client_id === Number(props.id)))

const clientId = computed(() => Number(props.id))
const client = computed(() => store.findClient(clientId.value))
const contacts = computed(() => store.contactsOf(clientId.value))
const pendingContacts = computed(() =>
  store.pendingContacts.filter((item) => item.payload.client_id === clientId.value),
)

function contactPhones(contact: Contact): string[] {
  return [contact.phone, ...(contact.phones ?? []).map((p) => p.number)].filter((v): v is string => !!v)
}

function contactEmails(contact: Contact): string[] {
  return [contact.email, ...(contact.emails ?? []).map((e) => e.address)].filter((v): v is string => !!v)
}

onMounted(() => {
  void store.load()
  void requests.load()
  void projects.load()
  void quotes.load().then(() => quotes.refresh()).catch(() => undefined)
  void invoices.load().then(() => invoices.refresh()).catch(() => undefined)
})
</script>

<template>
  <IonPage>
    <IonHeader>
      <IonToolbar>
        <IonButtons slot="start">
          <IonBackButton default-href="/clients" text="Clients" />
        </IonButtons>
        <IonTitle>{{ client?.name ?? 'Client' }}</IonTitle>
      </IonToolbar>
    </IonHeader>

    <IonContent>
      <div v-if="!client" class="ion-padding ion-text-center">
        <IonText color="medium"><p>Ce client n'est pas disponible sur le téléphone.</p></IonText>
      </div>

      <template v-else>
        <IonList inset>
          <IonItem>
            <ClientLogo slot="start" :name="client.name" :url="client.logo_url" :size="56" />
            <IonLabel>
              <h1>{{ client.name }}</h1>
              <p>{{ client.type.label }} · {{ client.status.label }}</p>
            </IonLabel>
          </IonItem>
          <IonItem v-if="client.address">
            <IonIcon slot="start" :icon="locationOutline" aria-hidden="true" />
            <IonLabel class="ion-text-wrap">{{ client.address }}</IonLabel>
          </IonItem>
          <IonItem v-for="phone in client.phones" :key="`p${phone.id}`" :href="telHref(phone.number)">
            <IonIcon slot="start" :icon="callOutline" color="primary" aria-hidden="true" />
            <IonLabel>{{ phone.number }}</IonLabel>
            <IonNote v-if="phone.label" slot="end">{{ phone.label }}</IonNote>
          </IonItem>
          <IonItem v-for="email in client.emails" :key="`e${email.id}`" :href="mailHref(email.address)">
            <IonIcon slot="start" :icon="mailOutline" color="primary" aria-hidden="true" />
            <IonLabel>{{ email.address }}</IonLabel>
            <IonNote v-if="email.label" slot="end">{{ email.label }}</IonNote>
          </IonItem>
          <IonItem v-if="client.description">
            <IonLabel class="ion-text-wrap"><MarkdownView :text="client.description" /></IonLabel>
          </IonItem>
        </IonList>

        <QuoteList :quotes="clientQuotes" />
        <InvoiceList :invoices="clientInvoices" />

        <IonList v-if="clientProjects.length" inset>
          <IonListHeader><IonLabel>Projets</IonLabel></IonListHeader>
          <IonItem v-for="p in clientProjects" :key="p.id" :router-link="{ name: 'project', params: { id: p.id } }" detail>
            <IonLabel>
              <h3>{{ p.name }}</h3>
              <p>{{ p.status.label }}</p>
            </IonLabel>
          </IonItem>
        </IonList>

        <IonList v-if="auth.canAny(['client_requests.view', 'client_requests.create'])" inset>
          <IonListHeader>
            <IonLabel>Demandes</IonLabel>
            <IonButton
              v-if="auth.can('client_requests.create')"
              :router-link="{ name: 'client-request-new', query: { client_id: client.id } }"
            >
              <IonIcon slot="start" :icon="addCircleOutline" />
              Noter
            </IonButton>
          </IonListHeader>
          <IonItem
            v-for="r in clientRequests"
            :key="r.id"
            :router-link="{ name: 'client-request', params: { id: r.id } }"
            detail
          >
            <IonLabel class="ion-text-wrap">
              <h3>{{ markdownToText(r.body) }}</h3>
              <p>{{ r.status.label }} · {{ r.created_at ? new Date(r.created_at).toLocaleDateString('fr-FR') : '' }}</p>
            </IonLabel>
          </IonItem>
          <IonItem v-if="!clientRequests.length">
            <IonLabel color="medium">Aucune demande.</IonLabel>
          </IonItem>
        </IonList>

        <IonList inset>
          <IonListHeader>
            <IonLabel>Contacts</IonLabel>
            <IonButton
              v-if="auth.can('clients.create')"
              :router-link="{ name: 'contact-new', params: { id: client.id } }"
            >
              <IonIcon slot="start" :icon="personAddOutline" />
              Ajouter
            </IonButton>
          </IonListHeader>

          <IonItem v-for="item in pendingContacts" :key="item.id">
            <IonIcon slot="start" :icon="cloudUploadOutline" color="warning" aria-hidden="true" />
            <IonLabel>
              <h3>{{ item.payload.firstname }} {{ item.payload.lastname ?? '' }}</h3>
              <p>{{ item.lastError ?? 'En attente d\'envoi' }}</p>
            </IonLabel>
          </IonItem>

          <IonItem v-for="contact in contacts" :key="contact.id">
            <IonLabel class="ion-text-wrap">
              <h3>{{ contact.civility ? `${contact.civility.label} ` : '' }}{{ contact.full_name }}</h3>
              <p v-if="contact.job_title">{{ contact.job_title }}</p>
              <p v-for="number in contactPhones(contact)" :key="number">
                <a :href="telHref(number)">{{ number }}</a>
              </p>
              <p v-for="address in contactEmails(contact)" :key="address">
                <a :href="mailHref(address)">{{ address }}</a>
              </p>
            </IonLabel>
            <IonButton
              v-if="contactPhones(contact)[0]"
              slot="end"
              fill="clear"
              :href="telHref(contactPhones(contact)[0]!)"
              aria-label="Appeler"
            >
              <IonIcon slot="icon-only" :icon="callOutline" />
            </IonButton>
          </IonItem>

          <IonItem v-if="!contacts.length && !pendingContacts.length">
            <IonLabel color="medium">Aucun contact.</IonLabel>
          </IonItem>
        </IonList>
      </template>
    </IonContent>
  </IonPage>
</template>

<style scoped>
.notes {
  white-space: pre-line;
}

a {
  color: var(--ion-color-primary);
  text-decoration: none;
}
</style>
