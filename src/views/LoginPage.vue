<script setup lang="ts">
import { reactive, ref } from 'vue'
import {
  IonButton,
  IonContent,
  IonInput,
  IonInputPasswordToggle,
  IonList,
  IonNote,
  IonPage,
  IonSpinner,
  useIonRouter,
} from '@ionic/vue'
import { ApiError } from '@dash4/shared'
import { useAuthStore } from '@/stores/auth'
import { useSyncStore } from '@/stores/sync'

const auth = useAuthStore()
const sync = useSyncStore()
const ionRouter = useIonRouter()

const form = reactive({ email: '', password: '' })
const loading = ref(false)
const error = ref<string | null>(null)

async function submit(): Promise<void> {
  error.value = null
  loading.value = true
  try {
    await auth.login(form)
    ionRouter.replace({ name: 'home' })
  } catch (e) {
    error.value = e instanceof ApiError ? (e.fieldError('email') ?? e.message) : 'Connexion impossible. Réessayez.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <IonPage>
    <IonContent class="ion-padding">
      <form class="login" @submit.prevent="submit">
        <h1>Dash4</h1>
        <p class="muted">Connectez-vous pour continuer.</p>

        <IonNote v-if="!sync.online" color="warning">
          Pas de réseau : la première connexion demande une connexion internet.
        </IonNote>
        <IonNote v-if="error" color="danger" role="alert">{{ error }}</IonNote>

        <IonList lines="none">
          <IonInput
            v-model="form.email"
            label="Adresse e-mail"
            label-placement="floating"
            fill="outline"
            type="email"
            inputmode="email"
            autocomplete="username"
            required
          />
          <IonInput
            v-model="form.password"
            class="password"
            label="Mot de passe"
            label-placement="floating"
            fill="outline"
            type="password"
            autocomplete="current-password"
            required
          >
            <IonInputPasswordToggle slot="end" />
          </IonInput>
        </IonList>

        <IonButton type="submit" expand="block" :disabled="loading || !sync.online">
          <IonSpinner v-if="loading" name="crescent" />
          <span v-else>Se connecter</span>
        </IonButton>

      </form>
    </IonContent>
  </IonPage>
</template>

<style scoped>
.login {
  max-width: 400px;
  margin: 15vh auto 0;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

h1 {
  margin: 0;
  color: var(--ion-color-primary);
  font-weight: 700;
}

p {
  margin: 0;
}

.password {
  margin-top: 1rem;
}
</style>
