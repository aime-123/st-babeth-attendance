export const removeConnectedWhiteBackground = (pixels, width, height) => {
  const queue = new Int32Array(width * height)
  let readIndex = 0
  let writeIndex = 0

  const addBackgroundPixel = (pixelIndex) => {
    const offset = pixelIndex * 4
    if (pixels[offset + 3] === 0 || pixels[offset] < 225 || pixels[offset + 1] < 225 || pixels[offset + 2] < 225) {
      return
    }

    pixels[offset + 3] = 0
    queue[writeIndex] = pixelIndex
    writeIndex += 1
  }

  for (let x = 0; x < width; x += 1) {
    addBackgroundPixel(x)
    if (height > 1) {
      addBackgroundPixel((height - 1) * width + x)
    }
  }
  for (let y = 1; y < height - 1; y += 1) {
    addBackgroundPixel(y * width)
    if (width > 1) {
      addBackgroundPixel(y * width + width - 1)
    }
  }

  while (readIndex < writeIndex) {
    const pixelIndex = queue[readIndex]
    readIndex += 1
    const x = pixelIndex % width

    if (x > 0) addBackgroundPixel(pixelIndex - 1)
    if (x < width - 1) addBackgroundPixel(pixelIndex + 1)
    if (pixelIndex >= width) addBackgroundPixel(pixelIndex - width)
    if (pixelIndex < width * (height - 1)) addBackgroundPixel(pixelIndex + width)
  }

  return pixels
}

export const prepareLogoImage = (imageUrl, revokeSource = false) => new Promise((resolve, reject) => {
  const image = new Image()
  const releaseImageUrl = () => {
    if (revokeSource) {
      URL.revokeObjectURL(imageUrl)
    }
  }

  image.onload = () => {
    try {
      const scale = Math.min(1, 512 / Math.max(image.naturalWidth, image.naturalHeight))
      const width = Math.max(1, Math.round(image.naturalWidth * scale))
      const height = Math.max(1, Math.round(image.naturalHeight * scale))
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height

      const context = canvas.getContext('2d')
      if (!context) {
        throw new Error('Unable to prepare the logo image.')
      }

      context.drawImage(image, 0, 0, width, height)
      const imageData = context.getImageData(0, 0, width, height)
      removeConnectedWhiteBackground(imageData.data, width, height)
      context.putImageData(imageData, 0, 0)
      resolve(canvas.toDataURL('image/png'))
    } catch (error) {
      reject(error)
    } finally {
      releaseImageUrl()
    }
  }

  image.onerror = () => {
    releaseImageUrl()
    reject(new Error('Unable to read the selected logo image.'))
  }
  image.src = imageUrl
})
