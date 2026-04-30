type CompressOptions = {
  maxWidth?: number
  maxHeight?: number
  targetBytes?: number
  initialQuality?: number
  minQuality?: number
  outputType?: 'image/webp' | 'image/jpeg'
}

export type CompressedUploadImage = {
  blob: Blob
  contentType: string
  extension: string
  originalBytes: number
  compressedBytes: number
  wasCompressed: boolean
}

const NO_COMPRESS_TYPES = new Set(['image/svg+xml', 'image/gif'])

function extensionFromName(name: string) {
  const ext = String(name || '').split('.').pop()?.toLowerCase().trim()
  if (!ext) return null
  return ext.replace(/[^a-z0-9]/g, '') || null
}

function extensionFromMime(mime: string) {
  if (mime === 'image/webp') return 'webp'
  if (mime === 'image/jpeg') return 'jpg'
  if (mime === 'image/png') return 'png'
  return 'bin'
}

function mimeFromExtension(ext: string | null | undefined) {
  const v = String(ext || '').toLowerCase()
  if (v === 'jpg' || v === 'jpeg') return 'image/jpeg'
  if (v === 'webp') return 'image/webp'
  if (v === 'png') return 'image/png'
  return 'application/octet-stream'
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number) {
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality)
  })
}

async function loadImageFromFile(file: File) {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve(image)
      image.onerror = () => reject(new Error('No se pudo abrir la imagen para comprimir.'))
      image.src = url
    })
    return img
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function compressImageForUpload(file: File, options: CompressOptions = {}): Promise<CompressedUploadImage> {
  const originalBytes = Number(file.size || 0)
  const originalExt = extensionFromName(file.name)
  const originalMime = file.type || mimeFromExtension(originalExt)

  if (!originalMime.startsWith('image/') || NO_COMPRESS_TYPES.has(originalMime)) {
    return {
      blob: file,
      contentType: originalMime,
      extension: originalExt || 'bin',
      originalBytes,
      compressedBytes: originalBytes,
      wasCompressed: false,
    }
  }

  const maxWidth = Math.max(640, Number(options.maxWidth || 1600))
  const maxHeight = Math.max(640, Number(options.maxHeight || 1600))
  const targetBytes = Math.max(80 * 1024, Number(options.targetBytes || 320 * 1024))
  const minQuality = Math.min(0.95, Math.max(0.3, Number(options.minQuality || 0.45)))
  const initialQuality = Math.min(0.98, Math.max(minQuality, Number(options.initialQuality || 0.82)))
  const requestedType = options.outputType || 'image/webp'

  const img = await loadImageFromFile(file)
  let width = img.naturalWidth || img.width
  let height = img.naturalHeight || img.height
  const scale = Math.min(1, maxWidth / width, maxHeight / height)
  width = Math.max(1, Math.round(width * scale))
  height = Math.max(1, Math.round(height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    return {
      blob: file,
      contentType: originalMime,
      extension: originalExt || 'bin',
      originalBytes,
      compressedBytes: originalBytes,
      wasCompressed: false,
    }
  }

  ctx.drawImage(img, 0, 0, width, height)

  const outputType = requestedType
  let mejor: Blob | null = null
  let quality = initialQuality

  while (quality >= minQuality - 0.0001) {
    const blob = await canvasToBlob(canvas, outputType, quality)
    if (!blob) break
    if (!mejor || blob.size < mejor.size) mejor = blob
    if (blob.size <= targetBytes) {
      mejor = blob
      break
    }
    quality -= 0.08
  }

  if (mejor && mejor.size > targetBytes && canvas.width > 900) {
    const reduceScale = 0.86
    const w2 = Math.max(1, Math.round(canvas.width * reduceScale))
    const h2 = Math.max(1, Math.round(canvas.height * reduceScale))
    const c2 = document.createElement('canvas')
    c2.width = w2
    c2.height = h2
    const c2ctx = c2.getContext('2d')
    if (c2ctx) {
      c2ctx.drawImage(canvas, 0, 0, w2, h2)
      const blob2 = await canvasToBlob(c2, outputType, Math.max(minQuality, initialQuality - 0.12))
      if (blob2 && (!mejor || blob2.size < mejor.size)) mejor = blob2
    }
  }

  if (!mejor) {
    const fallback = await canvasToBlob(canvas, 'image/jpeg', Math.max(minQuality, 0.74))
    if (fallback) mejor = fallback
  }

  if (!mejor) {
    return {
      blob: file,
      contentType: originalMime,
      extension: originalExt || 'bin',
      originalBytes,
      compressedBytes: originalBytes,
      wasCompressed: false,
    }
  }

  const contentType = mejor.type || outputType
  const extension = extensionFromMime(contentType)
  return {
    blob: mejor,
    contentType,
    extension,
    originalBytes,
    compressedBytes: mejor.size,
    wasCompressed: mejor.size < originalBytes,
  }
}
