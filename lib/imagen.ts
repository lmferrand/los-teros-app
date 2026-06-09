'use client'

// Comprime/redimensiona una imagen en el navegador antes de subirla a Storage.
// Devuelve un Blob JPEG. Si algo falla, devuelve el archivo original.
export async function comprimirImagen(file: File, maxLado = 1280, calidad = 0.82): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file)
    let { width, height } = bitmap
    if (width > maxLado || height > maxLado) {
      const escala = maxLado / Math.max(width, height)
      width = Math.round(width * escala)
      height = Math.round(height * escala)
    }
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0, width, height)
    const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', calidad))
    return blob || file
  } catch {
    return file
  }
}
