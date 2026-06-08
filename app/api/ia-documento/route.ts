import { NextResponse } from 'next/server'

// API de extracción con IA (Groq). PREPARADA, no conectada en v1.
//
// Cuando se quiera activar la IA real:
//  1. Leer el archivo del FormData ('archivo').
//  2. Si es imagen → modelo de visión (p. ej. meta-llama/llama-4-scout).
//     Si es PDF → extraer texto (pdfjs) y usar llama-3.3-70b-versatile.
//  3. Pedir al modelo un JSON con los campos y su nivel de confianza
//     (alta/media/baja) y devolverlo con la forma de `Extraccion`.
//  4. La clave está en process.env.GROQ_API_KEY (ya configurada en Vercel).
//
// Mientras tanto devuelve 501 para que el adaptador Groq haga fallback al
// extractor simulado en el cliente.

export async function POST() {
  return NextResponse.json(
    { error: 'Extracción con IA no conectada en esta versión. Se usa el extractor simulado.' },
    { status: 501 }
  )
}
