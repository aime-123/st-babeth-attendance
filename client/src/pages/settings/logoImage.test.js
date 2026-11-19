import { describe, expect, it } from 'vitest'
import { removeConnectedWhiteBackground } from './logoImage'

describe('removeConnectedWhiteBackground', () => {
  it('removes the outer white background and preserves enclosed white logo details', () => {
    const pixels = new Uint8ClampedArray(25 * 4)
    const setPixel = (x, y, red, green, blue) => {
      const offset = (y * 5 + x) * 4
      pixels.set([red, green, blue, 255], offset)
    }

    for (let y = 0; y < 5; y += 1) {
      for (let x = 0; x < 5; x += 1) {
        setPixel(x, y, 255, 255, 255)
      }
    }
    setPixel(1, 1, 20, 100, 70)
    setPixel(2, 1, 20, 100, 70)
    setPixel(3, 1, 20, 100, 70)
    setPixel(1, 2, 20, 100, 70)
    setPixel(3, 2, 20, 100, 70)
    setPixel(1, 3, 20, 100, 70)
    setPixel(2, 3, 20, 100, 70)
    setPixel(3, 3, 20, 100, 70)

    removeConnectedWhiteBackground(pixels, 5, 5)

    expect(pixels[3]).toBe(0)
    expect(pixels[(2 * 5 + 2) * 4 + 3]).toBe(255)
    expect(pixels[(1 * 5 + 1) * 4 + 3]).toBe(255)
  })
})
