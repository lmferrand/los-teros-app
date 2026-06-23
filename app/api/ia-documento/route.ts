import { NextResponse } from 'next/server'
import { normalizarCampos, type Extraccion } from '@/lib/ia/extractor'

export const runtime = 'nodejs'
export const maxDuration = 60

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const MODELO_VISION = process.env.GROQ_MODEL_VISION || 'meta-llama/llama-4-scout-17b-16e-instruct'
const MODELO_TEXTO = process.env.GROQ_MODEL_TEXTO || 'llama-3.3-70b-versatile'

const PROMPT = `Eres un asistente que extrae datos de un PRESUPUESTO de una empresa de limpieza, instalaciones y mantenimiento.
Devuelve ÚNICAMENTE un objeto JSON válido, sin texto adicional ni explicaciones, con esta forma exacta:
{"campos":[{"clave":"<clave>","valor":"<texto>","confianza":"alta|media|baja"}]}
Usa solo las claves que realmente encuentres en el documento. Claves posibles:
- numero: número de presupuesto
- cliente: nombre del cliente
- empresa_local: empresa o local
- fecha_aceptacion: fecha del presupuesto en formato YYYY-MM-DD
- tipo_trabajo: uno de [limpieza, instalacion, reparacion, sustitucion_turbina, otro]
- descripcion: descripción DETALLADA y clara de lo que se va a realizar (el concepto del presupuesto: tareas, partidas, ubicaciones, equipos). Resume bien el trabajo para que un técnico sepa qué hacer.
- base_imponible: importe sin IVA (solo el número, sin símbolos)
- iva_porcentaje: porcentaje de IVA (solo el número, p.ej. 21)
- total_con_iva: total con IVA (solo el número)
- forma_cobro: forma de pago
- condiciones_pago: condiciones de pago
- materiales: materiales incluidos
- turbina: turbinas o equipos especiales
- condiciones_especiales: condiciones especiales
- observaciones: cualquier punto relevante para margen, ejecución, cobro o facturación
"confianza" indica cuán seguro estás de cada dato (alta/media/baja). Si un dato no aparece, omítelo.`

function extraerJson(texto: string): { campos: { clave: string; valor: unknown; confianza?: string }[] } | null {
  // Intenta parseo directo y, si falla, busca el primer bloque {...}.
  const intentos = [texto, texto.slice(texto.indexOf('{'), texto.lastIndexOf('}') + 1)]
  for (const t of intentos) {
    try {
      const o = JSON.parse(t)
      if (o && Array.isArray(o.campos)) return o
    } catch { /* siguiente intento */ }
  }
  return null
}

export async function POST(req: Request) {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'GROQ_API_KEY no configurada' }, { status: 501 })
  }

  let file: File | null = null
  try {
    const form = await req.formData()
    file = form.get('archivo') as File | null
  } catch {
    return NextResponse.json({ error: 'No se pudo leer el archivo' }, { status: 400 })
  }
  if (!file) return NextResponse.json({ error: 'Falta el archivo' }, { status: 400 })

  const esImagen = file.type.startsWith('image/')
  const esPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')

  // Construye los mensajes según el tipo de documento.
  let body: Record<string, unknown>
  try {
    if (esImagen) {
      const buf = Buffer.from(await file.arrayBuffer())
      const dataUrl = `data:${file.type};base64,${buf.toString('base64')}`
      body = {
        model: MODELO_VISION,
        temperature: 0.1,
        max_tokens: 2048,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: PROMPT },
              { type: 'image_url', image_url: { url: dataUrl } },
            ],
          },
        ],
      }
    } else if (esPdf) {
      const { getDocumentProxy, extractText } = await import('unpdf')
      const pdf = await getDocumentProxy(new Uint8Array(await file.arrayBuffer()))
      const { text } = await extractText(pdf, { mergePages: true })
      const recorte = (text || '').slice(0, 12000)
      if (!recorte.trim()) {
        return NextResponse.json({ error: 'No se pudo extraer texto del PDF (¿es escaneado? prueba con una imagen).' }, { status: 422 })
      }
      body = {
        model: MODELO_TEXTO,
        temperature: 0.1,
        max_tokens: 2048,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: PROMPT },
          { role: 'user', content: `Texto del documento:\n${recorte}` },
        ],
      }
    } else {
      return NextResponse.json({ error: 'Formato no soportado. Sube una imagen o un PDF.' }, { status: 415 })
    }
  } catch (e: any) {
    return NextResponse.json({ error: `Error preparando el documento: ${e.message || e}` }, { status: 500 })
  }

  // Llamada a Groq.
  let contenido: string
  try {
    const res = await fetch(GROQ_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok) {
      return NextResponse.json({ error: `Groq: ${data.error?.message || res.status}` }, { status: 502 })
    }
    contenido = data.choices?.[0]?.message?.content || ''
  } catch (e: any) {
    return NextResponse.json({ error: `Error llamando a Groq: ${e.message || e}` }, { status: 502 })
  }

  const parsed = extraerJson(contenido)
  if (!parsed) {
    return NextResponse.json({ error: 'La IA no devolvió datos legibles. Inténtalo de nuevo.' }, { status: 422 })
  }

  const extraccion: Extraccion = {
    campos: normalizarCampos(parsed.campos),
    resumen: `Documento "${file.name}" analizado con IA. Revisa los campos con confianza baja (resaltados) antes de crear el presupuesto.`,
  }
  return NextResponse.json(extraccion)
}
