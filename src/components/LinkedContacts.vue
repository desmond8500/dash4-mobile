<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { IonIcon, IonItem, IonLabel, IonList, IonListHeader, IonNote } from '@ionic/vue'
import { callOutline, mailOutline } from 'ionicons/icons'
import { ApiError, type ContactableType, type RecordContact } from '@dash4/shared'
import { api } from '@/services/api'
import { kv } from '@/offline/db'
import { plain } from '@/offline/collection'
import { contactChannels, mailHref, telHref } from '@/utils/links'

/**
 * Contacts liés au projet ou au devis (rôle, téléphones, e-mails), en lecture : ils se gèrent sur le web.
 * Copie gardée à chaque ouverture pour appeler quelqu'un sans réseau ; effacée à la déconnexion avec le reste.
 */
const props = defineProps<{ type: ContactableType; id: number }>()
const links = ref<RecordContact[]>([])
const key = () => `recordContacts.${props.type}.${props.id}`

onMounted(async () => {
  try {
    links.value = await api.recordContacts.list(props.type, props.id)
    await kv.set(key(), plain(links.value))
  } catch (e) {
    if (e instanceof ApiError && e.status !== 0 && e.status !== 503) return
    links.value = (await kv.get<RecordContact[]>(key())) ?? []
  }
})
</script>

<template>
  <IonList v-if="links.length" inset>
    <IonListHeader><IonLabel>Contacts</IonLabel></IonListHeader>
    <template v-for="link in links" :key="link.id">
      <IonItem>
        <IonLabel class="ion-text-wrap">
          <h3>{{ link.contact.full_name }}</h3>
          <p v-if="link.contact.job_title || link.contact.company">{{ [link.contact.job_title, link.contact.company].filter(Boolean).join(' · ') }}</p>
        </IonLabel>
        <IonNote v-if="link.role" slot="end">{{ link.role }}</IonNote>
      </IonItem>
      <IonItem v-for="p in contactChannels(link.contact).phones" :key="`p-${link.id}-${p}`" :href="telHref(p)" lines="none" :detail="false">
        <IonIcon slot="start" :icon="callOutline" />
        <IonLabel>{{ p }}</IonLabel>
      </IonItem>
      <IonItem v-for="m in contactChannels(link.contact).emails" :key="`m-${link.id}-${m}`" :href="mailHref(m)" lines="none" :detail="false">
        <IonIcon slot="start" :icon="mailOutline" />
        <IonLabel>{{ m }}</IonLabel>
      </IonItem>
    </template>
  </IonList>
</template>
