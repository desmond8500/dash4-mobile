import { describe, expect, it, vi } from 'vitest'

const init = vi.fn()
const ctor = vi.fn()
vi.mock('photoswipe', () => ({
  default: class {
    constructor(options: unknown) {
      ctor(options)
    }
    on() {}
    init() {
      init()
    }
  },
}))
vi.mock('photoswipe/style.css', () => ({}))

describe('visionneuse de photos', () => {
  it('ouvre sur la photo touchée, avec son nom en légende', async () => {
    const { openPhotos } = await import('../src/utils/lightbox')
    // jsdom ne charge pas les images : on simule leur taille
    vi.stubGlobal('Image', class {
      naturalWidth = 800
      naturalHeight = 600
      onload: (() => void) | null = null
      set src(_v: string) {
        setTimeout(() => this.onload?.(), 0)
      }
    })
    await openPhotos([{ url: 'blob:a', name: 'Avant' }, { url: 'blob:b', name: 'Après' }], 'blob:b')
    const options = ctor.mock.calls[0]![0] as { index: number; dataSource: Array<{ src: string; alt: string; width: number }> }
    expect(options.index).toBe(1)
    expect(options.dataSource[1]).toMatchObject({ src: 'blob:b', alt: 'Après', width: 800 })
    expect(init).toHaveBeenCalled()
  })
})
