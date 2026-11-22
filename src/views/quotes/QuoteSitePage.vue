<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  IonBackButton,
  IonBadge,
  IonButton,
  IonButtons,
  IonCheckbox,
  IonContent,
  IonFooter,
  IonHeader,
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
  IonTitle,
  IonToggle,
  IonToolbar,
  toastController,
} from '@ionic/vue'
import { quoteSiteCount, quoteSitePayload, quoteSitePlan, type Quote, type QuoteSiteSection } from '@dash4/shared'
import { useQuotesStore } from '@/stores/quotes'
import { useSitesStore } from '@/stores/sites'
import { useSyncStore } from '@/stores/sync'

/**
 * Appareils du chantier depuis un devis : chaque section va dans un système (existant ou nouveau),
 * seule la quantité sans appareil est créée. Envoyé via la file d'attente, même sans réseau.
 */
const props = defineProps<{ id: string }>()
const router = useRouter()
const quotes = useQuotesStore()
const sites = useSitesStore()
const sync = useSyncStore()

const quote = ref<Quote | null>(null)
const plan = ref<QuoteSiteSection[]>([])
const split = ref(true)
const loading = ref(true)
const error = ref<string | null>(null)
const saving = ref(false)

const site = computed(() => (quote.value?.project_id ? (sites.sites[quote.value.project_id] ?? null) : null))

onMounted(async () => {
  try {
    quote.value = (await quotes.detail(Number(props.id))).quote
    if (!quote.value) throw new Error("Ce devis n'a pas encore été ouvert avec le réseau.")
    if (!quote.value.project_id) throw new Error("Rattachez d'abord le devis à un projet.")
    await sites.load(quote.value.project_id)
    if (!site.value) throw new Error("Ouvrez d'abord le chantier du projet une fois avec le réseau.")
    if (!site.value.can.manage) throw new Error('Vous ne pouvez pas modifier ce chantier.')
    plan.value = quoteSitePlan(quote.value, site.value)
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    loading.value = false
  }
})

const NEW = -1
function setTarget(section: QuoteSiteSection, value: number): void {
  section.installedSystemId = value === NEW ? null : value
  section.systemName = value === NEW ? section.title : (site.value?.systems.find((s) => s.id === value)?.name ?? section.title)
}
const count = computed(() => quoteSiteCount(plan.value, split.value))
const units = computed(() => quoteSiteCount(plan.value, true))
const tooMany = computed(() => split.value && units.value > 500)

async function submit(): Promise<void> {
  if (!quote.value?.project_id || !count.value || tooMany.value) return
  saving.value = true
  try {
    await sites.fromQuote(quote.value.project_id, quote.value, quoteSitePayload(plan.value, split.value), count.value)
    const toast = await toastController.create({
      message: sync.online ? `${count.value} appareil${count.value > 1 ? 's' : ''} envoyé${count.value > 1 ? 's' : ''} au chantier.` : 'Enregistré : les appareils seront créés dès le retour du réseau.',
      duration: 2500,
      position: 'top',
    })
    await toast.present()
    await router.replace({ name: 'site', params: { projectId: quote.value.project_id } })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <IonPage>
    <IonHeader>
      <IonToolbar>
        <IonButtons slot="start"><IonBackButton :default-href="`/devis/${props.id}`" text="Retour" /></IonButtons>
        <IonTitle>Vers le chantier</IonTitle>
      </IonToolbar>
    </IonHeader>
    <IonContent>
      <div v-if="loading" class="ion-padding ion-text-center"><IonSpinner /></div>
      <div v-else-if="error" class="ion-padding ion-text-center"><IonText color="medium"><p>{{ error }}</p></IonText></div>
      <template v-else-if="quote && site">
        <div class="ion-padding-horizontal ion-padding-top">
          <IonNote>
            {{ quote.number }} → chantier de {{ quote.project?.name }}. Seule la quantité qui n'a pas encore d'appareil est créée ; la main-d'œuvre n'est pas proposée.
          </IonNote>
        </div>
        <div v-if="!plan.length" class="ion-padding ion-text-center"><IonText color="medium"><p>Ce devis n'a pas de matériel.</p></IonText></div>

        <IonList v-for="section in plan" :key="section.sectionId" inset>
          <IonListHeader><IonLabel>{{ section.title }}</IonLabel></IonListHeader>
          <IonItem>
            <IonSelect
              :value="section.installedSystemId ?? NEW"
              label="Système du chantier"
              label-placement="stacked"
              interface="action-sheet"
              cancel-text="Annuler"
              @ion-change="setTarget(section, Number($event.detail.value))"
            >
              <IonSelectOption v-for="s in site.systems" :key="s.id" :value="s.id">{{ s.name }}</IonSelectOption>
              <IonSelectOption :value="NEW">Nouveau système : {{ section.title }}</IonSelectOption>
            </IonSelect>
          </IonItem>
          <IonItem v-if="section.installedSystemId === null">
            <IonInput v-model="section.systemName" label="Nom du nouveau système" label-placement="stacked" />
          </IonItem>
          <IonItem v-for="l in section.lines" :key="l.line.id" :disabled="!l.remaining">
            <IonCheckbox slot="start" :checked="l.selected" :disabled="!l.remaining" :aria-label="l.line.designation" @ion-change="l.selected = $event.detail.checked" />
            <IonLabel class="ion-text-wrap">
              <h3>{{ l.line.designation }}</h3>
              <p>{{ [l.line.category.label, l.line.reference].filter(Boolean).join(' · ') }}</p>
            </IonLabel>
            <IonBadge v-if="l.remaining" slot="end" color="primary">{{ l.remaining }}</IonBadge>
            <IonNote v-else slot="end">déjà créé</IonNote>
          </IonItem>
        </IonList>

        <IonList v-if="plan.length" inset>
          <IonItem>
            <IonToggle v-model="split" justify="space-between">
              <IonLabel class="ion-text-wrap">
                Un appareil par unité
                <p>Pour noter le n° de série et l'adresse IP de chacun. Sinon un appareil avec la quantité.</p>
              </IonLabel>
            </IonToggle>
          </IonItem>
        </IonList>
        <div v-if="tooMany" class="ion-padding-horizontal"><IonText color="warning"><p>Plus de 500 unités : désactivez « Un appareil par unité ».</p></IonText></div>
      </template>
    </IonContent>
    <IonFooter v-if="plan.length">
      <IonToolbar>
        <IonButton expand="block" class="ion-margin-horizontal" :disabled="!count || tooMany || saving" @click="submit">
          {{ count ? `Créer ${count} appareil${count > 1 ? 's' : ''}` : 'Rien de coché' }}
        </IonButton>
      </IonToolbar>
    </IonFooter>
  </IonPage>
</template>
