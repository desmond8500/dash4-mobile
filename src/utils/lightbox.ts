import PhotoSwipe from 'photoswipe'
import 'photoswipe/style.css'

/**
 * Visionneuse plein écran (PhotoSwipe, licence MIT) : pincer pour zoomer, glisser d'une photo
 * à l'autre, glisser vers le bas pour fermer. Fonctionne hors ligne avec les photos du téléphone.
 */
export interface LightboxImage {
  src: string
  caption?: string
}

export function imageSize(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve({ width: img.naturalWidth || 1600, height: img.naturalHeight || 1200 })
    img.onerror = () => resolve({ width: 1600, height: 1200 })
    img.src = src
  })
}

export async function openLightbox(images: LightboxImage[], index = 0): Promise<void> {
  if (!images.length) return
  const slides: Array<{ src: string; alt: string; width: number; height: number }> = await Promise.all(
    images.map(async (i) => ({ src: i.src, alt: i.caption ?? '', ...(await imageSize(i.src)) })),
  )
  const pswp = new PhotoSwipe({
    dataSource: slides,
    index: Math.min(Math.max(index, 0), slides.length - 1),
    bgOpacity: 0.95,
    showHideAnimationType: 'fade',
    closeTitle: 'Fermer',
    zoomTitle: 'Zoomer',
    arrowPrevTitle: 'Précédente',
    arrowNextTitle: 'Suivante',
    errorMsg: "L'image n'a pas pu être chargée.",
    indexIndicatorSep: ' / ',
  })
  pswp.on('uiRegister', () => {
    pswp.ui?.registerElement({
      name: 'caption',
      order: 9,
      isButton: false,
      appendTo: 'root',
      onInit: (el) => {
        el.className = 'pswp__dash4-caption'
        const update = () => {
          el.textContent = pswp.currSlide?.data.alt ?? ''
        }
        pswp.on('change', update)
        update()
      },
    })
  })
  pswp.init()
}

/** Ouvre la visionneuse sur une liste de vignettes `{ url, name }` à partir de celle touchée. */
export function openPhotos(list: Array<{ url: string; name?: string }>, url: string): Promise<void> {
  return openLightbox(list.map((p) => ({ src: p.url, caption: p.name })), list.findIndex((p) => p.url === url))
}
