<script setup lang="ts">
import { computed } from 'vue'
import {
  IonButton,
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
  useIonRouter,
} from '@ionic/vue'
import { useAuthStore } from '@/stores/auth'
import { useSyncStore } from '@/stores/sync'

const auth = useAuthStore()
const sync = useSyncStore()
const ionRouter = useIonRouter()

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
      <IonList v-if="auth.user" inset>
        <IonItem>
          <IonLabel>
            <h2>{{ auth.user.full_name }}</h2>
            <p>{{ auth.user.email }}</p>
            <p v-if="auth.user.job_title">{{ auth.user.job_title }}</p>
          </IonLabel>
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
