<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
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
  IonSelect,
  IonSelectOption,
  IonText,
  IonTextarea,
  IonTitle,
  IonToolbar,
  alertController,
  toastController,
} from '@ionic/vue'
import { addOutline, closeCircleOutline } from 'ionicons/icons'
import { EQUIPMENT_STATUSES } from '@dash4/shared'
import SearchSelect from '@/components/SearchSelect.vue'
import { useSitesStore } from '@/stores/sites'
import { useStockStore } from '@/stores/stock'
import { useSyncStore } from '@/stores/sync'
import { buildEquipmentPayload, duplicateForm, equipmentToForm, newEquipmentForm, parentOptions, placeOptions, type EquipmentForm } from '@/utils/equipment'

/** Ajout ou modification d'un équipement du chantier, même sans réseau (envoyé via la file d'attente). */
const props = defineProps<{ projectId: string; equipmentId?: string }>()
const route = useRoute()
const router = useRouter()
const store = useSitesStore()
const stock = useStockStore()
const sync = useSyncStore()

const projectId = computed(() => Number(props.projectId))
const site = computed(() => store.sites[projectId.value] ?? null)
const existing = computed(() => {
  const id = Number(props.equipmentId)
  return id ? (site.value?.systems.flatMap((s) => s.equipment ?? []).find((e) => e.id === id) ?? null) : null
})
const form = reactive<EquipmentForm>(newEquipmentForm(Number(route.query.system) || null))
const error = ref<string | null>(null)
const ready = ref(false)

onMounted(async () => {
  await store.load(projectId.value)
  if (stock.allowed()) void stock.load()
  if (existing.value) Object.assign(form, equipmentToForm(existing.value))
  else {
    // Dupliquer : même fiche, sans n° de série ni valeurs propres à l'appareil
    const source = site.value?.systems.flatMap((s) => s.equipment ?? []).find((e) => e.id === Number(route.query.from))
    if (source) Object.assign(form, duplicateForm(equipmentToForm(source)))
    if (!form.systemId && site.value?.systems.length === 1) form.systemId = site.value.systems[0]!.id
    const parent = Number(route.query.parent)
    if (parent) form.parentId = parent
  }
  ready.value = true
})

// Changer de système : le parent n'est plus valable
watch(
  () => form.systemId,
  (next, prev) => {
    if (ready.value && prev !== undefined && next !== prev) form.parentId = null
  },
)

const places = computed(() => (site.value ? placeOptions(site.value) : []))
const parents = computed(() => (site.value ? parentOptions(site.value, form.systemId, existing.value?.id ?? null) : []))
const hasChildren = computed(() => !!existing.value && !!site.value?.systems.some((s) => (s.equipment ?? []).some((e) => e.parent_id === existing.value!.id)))
const articleOptions = computed(() => stock.active.map((a) => ({ value: a.id, label: a.designation, detail: [a.reference, a.brand?.name].filter(Boolean).join(' · ') })))

/** Article du stock choisi : nom et modèle repris s'ils sont vides. */
function onArticle(id: number | null): void {
  const article = stock.items.find((a) => a.id === id)
  if (!article) return
  if (!form.name.trim()) form.name = article.designation
  if (!form.model.trim() && article.reference) form.model = article.reference
}

function addCharacteristic(label = ''): void {
  form.characteristics.push({ label, value: '' })
}
const suggestions = ['Adresse IP', 'Identifiant', 'Mot de passe', 'Port', 'Version']
const missingSuggestions = computed(() => suggestions.filter((s) => !form.characteristics.some((c) => c.label.trim().toLowerCase() === s.toLowerCase())))

async function save(again = false): Promise<void> {
  if (!site.value) return
  const { payload, error: message } = buildEquipmentPayload(form, site.value)
  error.value = message ?? null
  if (!payload) return
  const article = stock.items.find((a) => a.id === payload.article_id)
  await store.saveEquipment(projectId.value, payload, existing.value?.id ?? null, article ? { id: article.id, designation: article.designation, reference: article.reference } : null)
  const toast = await toastController.create({
    message: sync.online ? 'Équipement enregistré.' : 'Équipement enregistré : envoyé dès le retour du réseau.',
    duration: 1800,
    position: 'top',
  })
  await toast.present()
  if (again) {
    // Un autre du même modèle : même système, emplacement et caractéristiques, sans n° de série
    if (existing.value) await router.replace({ name: 'equipment-new', params: { projectId: projectId.value }, query: { from: existing.value.id } })
    else Object.assign(form, duplicateForm(form))
    return
  }
  router.back()
}

async function remove(): Promise<void> {
  const e = existing.value
  if (!e) return
  const alert = await alertController.create({
    header: "Supprimer l'équipement",
    message: hasChildren.value ? `${e.name} et ses sous-équipements seront mis à la corbeille.` : `${e.name} sera mis à la corbeille.`,
    buttons: [
      { text: 'Annuler', role: 'cancel' },
      { text: 'Supprimer', role: 'destructive' },
    ],
  })
  await alert.present()
  if ((await alert.onDidDismiss()).role !== 'destructive') return
  await store.deleteEquipment(projectId.value, e.id)
  router.back()
}
</script>

<template>
  <IonPage>
    <IonHeader>
      <IonToolbar>
        <IonButtons slot="start"><IonBackButton :default-href="`/chantier/${projectId}`" text="Retour" /></IonButtons>
        <IonTitle>{{ existing ? 'Modifier l’équipement' : 'Nouvel équipement' }}</IonTitle>
      </IonToolbar>
    </IonHeader>
    <IonContent>
      <div v-if="!site" class="ion-padding ion-text-center">
        <IonText color="medium"><p>Ouvrez d'abord le chantier une fois avec le réseau.</p></IonText>
      </div>
      <div v-else-if="!site.can.manage" class="ion-padding ion-text-center">
        <IonText color="medium"><p>Vous ne pouvez pas modifier les équipements de ce chantier.</p></IonText>
      </div>
      <div v-else-if="props.equipmentId && !existing" class="ion-padding ion-text-center">
        <IonText color="medium"><p>Cet équipement n'est plus sur le chantier.</p></IonText>
      </div>

      <form v-else @submit.prevent="save()">
        <IonList inset>
          <IonItem>
            <IonSelect v-model="form.systemId" label="Système *" label-placement="stacked" interface="action-sheet" cancel-text="Annuler" placeholder="Choisir">
              <IonSelectOption v-for="s in site.systems" :key="s.id" :value="s.id">{{ s.name }}</IonSelectOption>
            </IonSelect>
          </IonItem>
          <SearchSelect
            v-if="parents.length && !hasChildren"
            v-model="form.parentId"
            label="Dans l'équipement"
            null-label="Aucun (équipement principal)"
            placeholder="Équipement principal"
            :options="parents.map((p) => ({ value: p.id, label: p.name, detail: [p.model, p.serial_number].filter(Boolean).join(' · ') }))"
          />
          <SearchSelect
            v-if="articleOptions.length"
            v-model="form.articleId"
            label="Article du stock"
            null-label="Aucun"
            :options="articleOptions"
            @select="onArticle"
          />
          <IonItem><IonInput v-model="form.name" label="Nom *" label-placement="stacked" placeholder="Caméra entrée, NVR, détecteur…" autocapitalize="sentences" /></IonItem>
          <IonItem><IonInput v-model="form.type" label="Type" label-placement="stacked" placeholder="Caméra dôme, centrale…" /></IonItem>
          <IonItem><IonInput v-model="form.model" label="Modèle" label-placement="stacked" /></IonItem>
          <IonItem><IonInput v-model="form.serialNumber" label="N° de série" label-placement="stacked" autocapitalize="characters" /></IonItem>
          <IonItem><IonInput v-model="form.quantity" type="number" inputmode="numeric" min="1" label="Quantité" label-placement="stacked" /></IonItem>
          <IonItem>
            <IonSelect v-model="form.status" label="État" label-placement="stacked" interface="action-sheet" cancel-text="Annuler">
              <IonSelectOption v-for="s in EQUIPMENT_STATUSES" :key="s.value" :value="s.value">{{ s.label }}</IonSelectOption>
            </IonSelect>
          </IonItem>
          <IonItem v-if="places.length">
            <IonSelect v-model="form.place" label="Emplacement" label-placement="stacked" interface="action-sheet" cancel-text="Annuler">
              <IonSelectOption value="">Non placé</IonSelectOption>
              <IonSelectOption v-for="p in places" :key="p.value" :value="p.value">{{ p.label }}</IonSelectOption>
            </IonSelect>
          </IonItem>
        </IonList>

        <IonList inset>
          <IonListHeader><IonLabel>Caractéristiques</IonLabel></IonListHeader>
          <IonItem v-for="(c, i) in form.characteristics" :key="i">
            <div class="char">
              <IonInput v-model="c.label" placeholder="Libellé" aria-label="Libellé" />
              <IonInput v-model="c.value" placeholder="Valeur" aria-label="Valeur" class="mono" />
            </div>
            <IonButton slot="end" fill="clear" color="medium" aria-label="Retirer" @click="form.characteristics.splice(i, 1)"><IonIcon slot="icon-only" :icon="closeCircleOutline" /></IonButton>
          </IonItem>
          <div class="ion-padding-horizontal ion-padding-bottom chips">
            <IonButton size="small" fill="outline" @click="addCharacteristic()"><IonIcon slot="start" :icon="addOutline" />Ajouter</IonButton>
            <IonButton v-for="s in missingSuggestions" :key="s" size="small" fill="clear" @click="addCharacteristic(s)">{{ s }}</IonButton>
          </div>
        </IonList>

        <IonList inset>
          <IonItem><IonTextarea v-model="form.description" label="Notes" label-placement="stacked" :auto-grow="true" /></IonItem>
        </IonList>

        <div v-if="error" class="ion-padding-horizontal"><IonText color="danger"><p>{{ error }}</p></IonText></div>
        <div class="ion-padding actions">
          <IonButton expand="block" type="submit">Enregistrer</IonButton>
          <IonButton expand="block" fill="outline" @click="save(true)">{{ existing ? 'Enregistrer et dupliquer' : 'Enregistrer et en ajouter un autre' }}</IonButton>
          <IonButton v-if="existing && site.can.delete" expand="block" fill="clear" color="danger" @click="remove">Supprimer l'équipement</IonButton>
        </div>
      </form>
    </IonContent>
  </IonPage>
</template>

<style scoped>
.char {
  display: grid;
  grid-template-columns: 1fr 1.4fr;
  gap: 0.5rem;
  width: 100%;
}

.mono {
  font-family: ui-monospace, monospace;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.actions {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
</style>
