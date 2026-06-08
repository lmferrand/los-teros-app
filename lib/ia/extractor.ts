// Extracción de datos de documentos (presupuestos, condiciones, justificantes).
// El extractor activo intenta la IA real (Groq, vía app/api/ia-documento) y,
// si no está disponible, cae en una extracción SIMULADA de demostración.

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

// Definición de los campos que se intentan extraer (orden + metadatos).
// La usa tanto el simulador como la API para normalizar la salida del modelo.
export interface DefCampo {
  clave: string
  label: string
  tipo: TipoCampo
  mapeaAVenta: boolean
}

export const DEF_CAMPOS: DefCampo[] = [
  { clave: 'numero', label: 'Nº de presupuesto', tipo: 'texto', mapeaAVenta: true },
  { clave: 'cliente', label: 'Cliente', tipo: 'texto', mapeaAVenta: true },
  { clave: 'empresa_local', label: 'Empresa / local', tipo: 'texto', mapeaAVenta: true },
  { clave: 'fecha_aceptacion', label: 'Fecha del presupuesto', tipo: 'fecha', mapeaAVenta: true },
  { clave: 'tipo_trabajo', label: 'Tipo de trabajo', tipo: 'tipo_trabajo', mapeaAVenta: true },
  { clave: 'base_imponible', label: 'Base imponible', tipo: 'numero', mapeaAVenta: true },
  { clave: 'iva_porcentaje', label: '% IVA', tipo: 'numero', mapeaAVenta: true },
  { clave: 'total_con_iva', label: 'Total con IVA', tipo: 'numero', mapeaAVenta: false },
  { clave: 'forma_cobro', label: 'Forma de pago', tipo: 'texto', mapeaAVenta: true },
  { clave: 'condiciones_pago', label: 'Condiciones de pago', tipo: 'info', mapeaAVenta: false },
  { clave: 'materiales', label: 'Materiales incluidos', tipo: 'info', mapeaAVenta: false },
  { clave: 'turbina', label: 'Turbinas / equipos especiales', tipo: 'info', mapeaAVenta: false },
  { clave: 'condiciones_especiales', label: 'Condiciones especiales', tipo: 'info', mapeaAVenta: false },
  { clave: 'observaciones', label: 'Observaciones', tipo: 'info', mapeaAVenta: false },
]

export const DEF_POR_CLAVE: Record<string, DefCampo> = Object.fromEntries(
  DEF_CAMPOS.map((d) => [d.clave, d])
)

// Normaliza una lista cruda del modelo ({clave, valor, confianza}) a CampoExtraido[].
export function normalizarCampos(crudos: { clave: string; valor: unknown; confianza?: string }[]): CampoExtraido[] {
  const conf = (c?: string): Confianza => (c === 'alta' || c === 'media' || c === 'baja' ? c : 'media')
  return DEF_CAMPOS.flatMap((def) => {
    const found = crudos.find((c) => c.clave === def.clave)
    if (!found || found.valor == null || String(found.valor).trim() === '') return []
    return [{ ...def, valor: String(found.valor).trim(), confianza: conf(found.confianza) }]
  })
}

// ---------------- Implementación simulada (demo) ----------------

function aleatorio<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

export const extractorSimulado: ExtractorDocumentos = {
  async extraer(file: File): Promise<Extraccion> {
    await new Promise((r) => setTimeout(r, 1200))
    const base = 1500 + Math.floor(Math.random() * 80) * 100
    const iva = 21
    const crudos = [
      { clave: 'numero', valor: `P-2026-0${100 + Math.floor(Math.random() * 99)}`, confianza: 'alta' },
      { clave: 'cliente', valor: aleatorio(['Restaurante La Brasa', 'Hotel Meliá Centro', 'Panadería San Juan']), confianza: 'media' },
      { clave: 'empresa_local', valor: 'Local principal', confianza: 'baja' },
      { clave: 'fecha_aceptacion', valor: '2026-06-05', confianza: 'alta' },
      { clave: 'tipo_trabajo', valor: aleatorio(['limpieza', 'instalacion', 'reparacion']), confianza: 'media' },
      { clave: 'base_imponible', valor: String(base), confianza: 'alta' },
      { clave: 'iva_porcentaje', valor: String(iva), confianza: 'alta' },
      { clave: 'total_con_iva', valor: String(Math.round(base * (1 + iva / 100))), confianza: 'alta' },
      { clave: 'forma_cobro', valor: 'Transferencia', confianza: 'media' },
      { clave: 'condiciones_pago', valor: '50% al aceptar, 50% a la finalización', confianza: 'baja' },
      { clave: 'materiales', valor: 'Desengrasante industrial, filtros, bridas', confianza: 'baja' },
      { clave: 'turbina', valor: 'No requiere', confianza: 'media' },
      { clave: 'condiciones_especiales', valor: 'Trabajo nocturno fuera de horario comercial', confianza: 'baja' },
    ]
    return {
      campos: normalizarCampos(crudos),
      resumen: `(Modo demo) Documento "${file.name}" analizado con datos de ejemplo. Revisa los campos con confianza baja (resaltados).`,
    }
  },
}

// ---------------- Adaptador Groq (IA real) ----------------

export const extractorGroq: ExtractorDocumentos = {
  async extraer(file: File): Promise<Extraccion> {
    const fd = new FormData()
    fd.append('archivo', file)
    const res = await fetch('/api/ia-documento', { method: 'POST', body: fd })
    if (!res.ok) {
      const txt = await res.text().catch(() => '')
      throw new Error(`IA no disponible (${res.status}) ${txt}`)
    }
    return (await res.json()) as Extraccion
  },
}

// ---------------- Extractor activo: Groq con fallback a demo ----------------

export const extractorActivo: ExtractorDocumentos = {
  async extraer(file: File): Promise<Extraccion> {
    try {
      return await extractorGroq.extraer(file)
    } catch {
      return await extractorSimulado.extraer(file)
    }
  },
}
