// Extracción de datos de documentos (presupuestos, condiciones, justificantes).
// v1: implementación SIMULADA. La interfaz y el adaptador Groq quedan listos
// para conectar IA real más adelante (app/api/ia-documento/route.ts).

export type Confianza = 'alta' | 'media' | 'baja'

export type TipoCampo = 'texto' | 'numero' | 'fecha' | 'tipo_trabajo' | 'info'

export interface CampoExtraido {
  clave: string          // clave (coincide con columna de `ventas` cuando aplica)
  label: string
  valor: string
  confianza: Confianza
  tipo: TipoCampo
  mapeaAVenta: boolean   // si se vuelca al crear/actualizar la venta
}

export interface Extraccion {
  campos: CampoExtraido[]
  resumen?: string
}

export interface ExtractorDocumentos {
  extraer(file: File): Promise<Extraccion>
}

// ---------------- Implementación simulada ----------------

function aleatorio<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

export const extractorSimulado: ExtractorDocumentos = {
  async extraer(file: File): Promise<Extraccion> {
    // Simula el tiempo de análisis de la IA.
    await new Promise((r) => setTimeout(r, 1400))

    const base = 1500 + Math.floor(Math.random() * 80) * 100
    const iva = 21
    const cliente = aleatorio(['Restaurante La Brasa', 'Hotel Meliá Centro', 'Panadería San Juan', 'Clínica Dental Sonríe'])

    const campos: CampoExtraido[] = [
      { clave: 'numero', label: 'Nº de presupuesto', valor: `P-2026-0${100 + Math.floor(Math.random() * 99)}`, confianza: 'alta', tipo: 'texto', mapeaAVenta: true },
      { clave: 'cliente', label: 'Cliente', valor: cliente, confianza: 'media', tipo: 'texto', mapeaAVenta: true },
      { clave: 'empresa_local', label: 'Empresa / local', valor: 'Local principal', confianza: 'baja', tipo: 'texto', mapeaAVenta: true },
      { clave: 'fecha_aceptacion', label: 'Fecha del presupuesto', valor: '2026-06-05', confianza: 'alta', tipo: 'fecha', mapeaAVenta: true },
      { clave: 'tipo_trabajo', label: 'Tipo de trabajo', valor: aleatorio(['limpieza', 'instalacion', 'reparacion']), confianza: 'media', tipo: 'tipo_trabajo', mapeaAVenta: true },
      { clave: 'base_imponible', label: 'Base imponible', valor: String(base), confianza: 'alta', tipo: 'numero', mapeaAVenta: true },
      { clave: 'iva_porcentaje', label: '% IVA', valor: String(iva), confianza: 'alta', tipo: 'numero', mapeaAVenta: true },
      { clave: 'total_con_iva', label: 'Total con IVA', valor: String(Math.round(base * (1 + iva / 100))), confianza: 'alta', tipo: 'numero', mapeaAVenta: false },
      { clave: 'forma_cobro', label: 'Forma de pago', valor: 'Transferencia', confianza: 'media', tipo: 'texto', mapeaAVenta: true },
      { clave: 'condiciones_pago', label: 'Condiciones de pago', valor: '50% al aceptar, 50% a la finalización', confianza: 'baja', tipo: 'info', mapeaAVenta: false },
      { clave: 'materiales', label: 'Materiales incluidos', valor: 'Desengrasante industrial, filtros, bridas', confianza: 'baja', tipo: 'info', mapeaAVenta: false },
      { clave: 'turbina', label: 'Turbinas / equipos especiales', valor: 'No requiere', confianza: 'media', tipo: 'info', mapeaAVenta: false },
      { clave: 'condiciones_especiales', label: 'Condiciones especiales', valor: 'Trabajo nocturno fuera de horario comercial', confianza: 'baja', tipo: 'info', mapeaAVenta: false },
    ]

    return {
      campos,
      resumen: `Documento "${file.name}" analizado. Revisa los campos con confianza baja (resaltados) antes de crear el presupuesto.`,
    }
  },
}

// ---------------- Adaptador Groq (listo para conectar) ----------------
// Llama a la API route del servidor, que usaría GROQ_API_KEY y el modelo de
// visión. En v1 la route no está conectada; si falla, no se usa.

export const extractorGroq: ExtractorDocumentos = {
  async extraer(file: File): Promise<Extraccion> {
    const fd = new FormData()
    fd.append('archivo', file)
    const res = await fetch('/api/ia-documento', { method: 'POST', body: fd })
    if (!res.ok) throw new Error('IA no disponible')
    return (await res.json()) as Extraccion
  },
}

// Extractor activo en v1.
export const extractorActivo: ExtractorDocumentos = extractorSimulado
