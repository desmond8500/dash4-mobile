<script setup lang="ts">
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
import { callOutline, cloudUploadOutline, locationOutline, mailOutline, personAddOutline } from 'ionicons/icons'
import type { Contact } from '@dash4/shared'
import { useAuthStore } from '@/stores/auth'
import { useClientsStore } from '@/stores/clients'
import { mailHref, telHref } from '@/utils/links'

const props = defineProps<{ id: string }>()
const auth = useAuthStore()
const store = useClientsStore()

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

onMounted(() => store.load())
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
            <IonLabel class="ion-text-wrap notes">{{ client.description }}</IonLabel>
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
