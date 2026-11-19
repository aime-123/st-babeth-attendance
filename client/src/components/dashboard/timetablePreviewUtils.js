export const getTimetablePreviewKind = (document) => {
  const contentType = String(document?.contentType || '').toLowerCase()
  const fileName = String(document?.fileName || '').toLowerCase()
  const extension = fileName.slice(fileName.lastIndexOf('.'))

  if (contentType.startsWith('image/') || ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg'].includes(extension)) {
    return 'image'
  }
  if (contentType === 'application/pdf' || extension === '.pdf') {
    return 'pdf'
  }
  if (contentType.startsWith('text/') || ['.csv', '.tsv', '.txt', '.md', '.json'].includes(extension)) {
    return 'text'
  }
  return 'unsupported'
}

const imageTypeByExtension = {
  '.bmp': 'image/bmp',
  '.gif': 'image/gif',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp'
}

const getImageContentType = (bytes, document, extension) => {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png'
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return 'image/gif'
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) return 'image/webp'
  if (bytes[0] === 0x42 && bytes[1] === 0x4d) return 'image/bmp'

  const declaredType = String(document.contentType || '').toLowerCase()
  return declaredType.startsWith('image/') ? declaredType : imageTypeByExtension[extension] || 'application/octet-stream'
}

export const createTimetablePreview = (document) => {
  const previewKind = getTimetablePreviewKind(document)
  const binary = atob(document.contentBase64)
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))
  const fileName = String(document.fileName || '').toLowerCase()
  const extension = fileName.slice(fileName.lastIndexOf('.'))
  const imageType = previewKind === 'image' ? getImageContentType(bytes, document, extension) : ''
  const contentType = previewKind === 'pdf' ? 'application/pdf' : previewKind === 'text' ? 'text/plain' : 'application/octet-stream'
  const blob = new Blob([bytes], { type: contentType })

  return {
    previewKind,
    previewUrl: previewKind === 'image'
      ? `data:${imageType};base64,${document.contentBase64}`
      : URL.createObjectURL(blob),
    textContent: previewKind === 'text' ? new TextDecoder().decode(bytes) : ''
  }
}
