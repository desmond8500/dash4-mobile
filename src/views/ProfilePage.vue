<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import {
  IonAvatar,
  IonButton,
  IonInput,
  IonInputPasswordToggle,
  IonChip,
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonNote,
  IonPage,
  IonTitle,
  IonToolbar,
  alertController,
  toastController,
  useIonRouter,
} from '@ionic/vue'
import { ApiError } from '@dash4/shared'
import type { Cv } from '@dash4/shared'
import { api } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import { useProfileStore } from '@/stores/profile'
import { useSyncStore } from '@/stores/sync'
import { profileChanges } from '@/utils/profile'

const auth = useAuthStore()
const sync = useSyncStore()
const profile = useProfileStore()
const ionRouter = useIonRouter()

const editing = ref(false)
const form = reactive({ firstname: '', lastname: '', phone: '' as string | null, job_title: '' as string | null })
const avatarInput = ref<HTMLInputElement | null>(null)
const pwd = reactive({ current_password: '', password: '', password_confirmation: '' })
const pwdOpen = ref(false)
const pwdSaving = ref(false)
const avatar = computed(() => profile.pendingAvatar ?? auth.user?.avatar_url ?? null)

onMounted(async () => {
  await profile.load()
  void profile.refresh()
})

async function toast(message: string, color = 'success'): Promise<void> {
  await (await toastController.create({ message, color, duration: 3000 })).present()
}

function startEdit(): void {
  const u = auth.user
  if (!u) return
  Object.assign(form, { firstname: u.firstname, lastname: u.lastname, phone: u.phone ?? '', job_title: u.job_title ?? '' })
  editing.value = true
}

async function saveProfile(): Promise<void> {
  if (!auth.user) return
  if (!form.firstname.trim() || !form.lastname.trim()) return void toast('Le prénom et le nom sont obligatoires.', 'warning')
  await profile.save(profileChanges(auth.user, form))
  editing.value = false
  await toast(sync.online ? 'Profil enregistré.' : 'Profil enregistré, il sera envoyé au retour du réseau.')
}

async function onAvatar(event: Event): Promise<void> {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  await profile.setAvatar(file)
  if (avatarInput.value) avatarInput.value.value = ''
}

async function changePassword(): Promise<void> {
  if (!sync.online) return void toast('Le changement de mot de passe demande le réseau.', 'warning')
  pwdSaving.value = true
  try {
    await toast(await api.profile.changePassword({ ...pwd }))
    Object.assign(pwd, { current_password: '', password: '', password_confirmation: '' })
    pwdOpen.value = false
  } catch (e) {
    await toast(e instanceof ApiError ? (Object.values(e.errors)[0]?.[0] ?? e.message) : (e as Error).message, 'danger')
  } finally {
    pwdSaving.value = false
  }
}

async function openCv(cv: Cv): Promise<void> {
  if (!sync.online) return void toast('Le PDF du CV demande le réseau.', 'warning')
  const url = URL.createObjectURL(await api.cvs.pdf(cv.id))
  window.open(url, '_blank')
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

const lastSyncLabel = computed(() =>
  sync.lastSync
    ? new Date(sync.lastSync).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
    : 'Pas encore',
)

async function logout(): Promise<void> {
  if (sync.pendingCount > 0) {
    const alert = await alertController.create({
      header: 'Actions non envoyées',
      message: `${sync.pendingCount} action(s) n'ont pas encore été envoyées et seront perdues si vous vous déconnectez.`,
      buttons: [
        { text: 'Annuler', role: 'cancel' },
        { text: 'Se déconnecter quand même', role: 'destructive' },
      ],
    })
    await alert.present()
    if ((await alert.onDidDismiss()).role !== 'destructive') return
  }

  await auth.logout()
  ionRouter.replace({ name: 'login' })
}
</script>

<template>
  <IonPage>
    <IonHeader>
      <IonToolbar>
        <IonTitle>Profil</IonTitle>
      </IonToolbar>
    </IonHeader>

    <IonContent>
      <IonList v-if="auth.user && !editing" inset>
        <IonItem>
          <IonAvatar slot="start" @click="avatarInput?.click()">
            <img v-if="avatar" :src="avatar" alt="" />
            <div v-else class="initials">{{ auth.user.firstname.charAt(0) }}{{ auth.user.lastname.charAt(0) }}</div>
          </IonAvatar>
          <input ref="avatarInput" type="file" accept="image/*" hidden @change="onAvatar" />
          <IonLabel>
            <h2>{{ auth.user.full_name }}</h2>
            <p>{{ auth.user.email }}</p>
            <p v-if="auth.user.phone">{{ auth.user.phone }}</p>
            <p v-if="auth.user.job_title">{{ auth.user.job_title }}</p>
            <p v-if="profile.pendingAvatar"><IonNote color="warning">Photo en attente d'envoi</IonNote></p>
          </IonLabel>
          <IonButton slot="end" fill="clear" @click="startEdit">Modifier</IonButton>
        </IonItem>
        <IonItem>
          <IonLabel>Type de compte</IonLabel>
          <IonNote slot="end">{{ auth.user.account_type.label }}</IonNote>
        </IonItem>
        <IonItem>
          <IonLabel>Profils</IonLabel>
          <div slot="end">
            <IonChip v-for="role in auth.user.roles" :key="role.name">{{ role.label }}</IonChip>
          </div>
        </IonItem>
      </IonList>

      <IonList v-if="editing" inset>
        <IonListHeader><IonLabel>Mon profil</IonLabel></IonListHeader>
        <IonItem><IonInput v-model="form.firstname" label="Prénom" label-placement="stacked" /></IonItem>
        <IonItem><IonInput v-model="form.lastname" label="Nom" label-placement="stacked" /></IonItem>
        <IonItem><IonInput v-model="form.phone" label="Téléphone" label-placement="stacked" type="tel" /></IonItem>
        <IonItem><IonInput v-model="form.job_title" label="Fonction" label-placement="stacked" /></IonItem>
        <div class="ion-padding row">
          <IonButton fill="clear" @click="editing = false">Annuler</IonButton>
          <IonButton @click="saveProfile">Enregistrer</IonButton>
        </div>
      </IonList>

      <IonList inset>
        <IonListHeader><IonLabel>Mes CV</IonLabel></IonListHeader>
        <IonItem v-for="cv in profile.cvs" :key="cv.id" button :detail="false" @click="openCv(cv)">
          <IonLabel>
            <h3>{{ cv.name }}</h3>
            <p>{{ cv.title || cv.fullname }}</p>
          </IonLabel>
          <IonNote slot="end">PDF</IonNote>
        </IonItem>
        <IonItem v-if="!profile.cvs.length">
          <IonLabel class="ion-text-wrap"><p>Aucun CV. Créez et modifiez vos CV depuis l'application web (Mon profil).</p></IonLabel>
        </IonItem>
      </IonList>

      <IonList inset>
        <IonItem button :detail="!pwdOpen" @click="pwdOpen = !pwdOpen">
          <IonLabel>Changer le mot de passe</IonLabel>
        </IonItem>
        <template v-if="pwdOpen">
          <IonItem>
            <IonInput v-model="pwd.current_password" type="password" label="Mot de passe actuel" label-placement="stacked" autocomplete="current-password">
              <IonInputPasswordToggle slot="end" />
            </IonInput>
          </IonItem>
          <IonItem>
            <IonInput v-model="pwd.password" type="password" label="Nouveau mot de passe" label-placement="stacked" autocomplete="new-password" helper-text="10 caractères, lettres et chiffres">
              <IonInputPasswordToggle slot="end" />
            </IonInput>
          </IonItem>
          <IonItem>
            <IonInput v-model="pwd.password_confirmation" type="password" label="Confirmation" label-placement="stacked" autocomplete="new-password" />
          </IonItem>
          <div class="ion-padding">
            <IonButton expand="block" :disabled="pwdSaving || !sync.online" @click="changePassword">Changer le mot de passe</IonButton>
            <IonNote v-if="!sync.online" color="warning">Réseau nécessaire.</IonNote>
          </div>
        </template>

<style scoped>
.initials {
  display: grid;
  place-items: center;
  width: 100%;
  height: 100%;
  background: var(--ion-color-light);
  font-weight: 600;
}
.row {
  display: flex;
  justify-content: flex-end;
}
</style>
      </IonList>

      <IonList inset>
        <IonListHeader>
          <IonLabel>Synchronisation</IonLabel>
        </IonListHeader>
        <IonItem>
          <IonLabel>Réseau</IonLabel>
          <IonNote slot="end" :color="sync.online ? 'success' : 'warning'">
            {{ sync.online ? 'Connecté' : 'Hors ligne' }}
          </IonNote>
        </IonItem>
        <IonItem>
          <IonLabel>Actions en attente</IonLabel>
          <IonNote slot="end">{{ sync.pendingCount }}</IonNote>
        </IonItem>
        <IonItem>
          <IonLabel>Dernier envoi</IonLabel>
          <IonNote slot="end">{{ lastSyncLabel }}</IonNote>
        </IonItem>
        <IonItem v-for="item in sync.failedItems" :key="item.id">
          <IonLabel color="danger">
            <h3>{{ item.label }}</h3>
            <p>{{ item.lastError }}</p>
          </IonLabel>
          <IonButton slot="end" fill="clear" color="danger" @click="sync.discard(item.id)">Supprimer</IonButton>
        </IonItem>
      </IonList>

      <div class="ion-padding">
        <IonButton expand="block" fill="outline" :disabled="!sync.online || sync.syncing" @click="sync.flush()">
          Envoyer maintenant
        </IonButton>
        <IonButton expand="block" color="danger" fill="clear" @click="logout">Se déconnecter</IonButton>
      </div>
    </IonContent>
  </IonPage>
</template>

<style scoped>
.initials {
  display: grid;
  place-items: center;
  width: 100%;
  height: 100%;
  background: var(--ion-color-light);
  font-weight: 600;
}
.row {
  display: flex;
  justify-content: flex-end;
}
</style>
