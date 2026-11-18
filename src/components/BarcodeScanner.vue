<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { IonButton, IonButtons, IonContent, IonHeader, IonModal, IonNote, IonTitle, IonToolbar } from '@ionic/vue'

/**
 * Scan d'un code-barres ou QR code avec la caméra (API BarcodeDetector du navigateur, Chrome Android).
 * Sans cette API, le bouton n'apparaît pas : la recherche par texte reste possible.
 */
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ code: [value: string] }>()

type Detector = { detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue: string }>> }
const video = ref<HTMLVideoElement | null>(null)
const error = ref<string | null>(null)
let stream: MediaStream | null = null
let timer: ReturnType<typeof setInterval> | undefined

function stop(): void {
  clearInterval(timer)
  stream?.getTracks().forEach((t) => t.stop())
  stream = null
}

async function start(): Promise<void> {
  error.value = null
  const Ctor = (window as unknown as { BarcodeDetector?: new () => Detector }).BarcodeDetector
  if (!Ctor) {
    error.value = "Le scan n'est pas disponible sur cet appareil : cherchez l'article par son nom ou sa référence."
    return
  }
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
    if (!video.value) return
    video.value.srcObject = stream
    await video.value.play()
    const detector = new Ctor()
    timer = setInterval(async () => {
      if (!video.value) return
      const found = await detector.detect(video.value).catch(() => [])
      if (found[0]?.rawValue) {
        emit('code', found[0].rawValue)
        open.value = false
      }
    }, 300)
  } catch {
    error.value = "Impossible d'ouvrir la caméra : autorisez-la dans les réglages du navigateur."
  }
}

watch(open, (value) => (value ? setTimeout(start, 200) : stop()))
onBeforeUnmount(stop)
</script>

<template>
  <IonModal :is-open="open" @did-dismiss="open = false">
    <IonHeader>
      <IonToolbar>
        <IonTitle>Scanner un article</IonTitle>
        <IonButtons slot="end"><IonButton @click="open = false">Fermer</IonButton></IonButtons>
      </IonToolbar>
    </IonHeader>
    <IonContent class="ion-padding">
      <video ref="video" class="video" muted playsinline />
      <IonNote v-if="error" color="danger">{{ error }}</IonNote>
      <IonNote v-else>Placez le code-barres ou le QR code dans le cadre.</IonNote>
    </IonContent>
  </IonModal>
</template>

<style scoped>
.video {
  width: 100%;
  max-height: 60vh;
  background: #000;
  border-radius: 0.5rem;
}
</style>
