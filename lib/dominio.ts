import type {
  EstadoVenta,
  TipoTrabajo,
  CategoriaGasto,
} from './tipos'

// ===================== Estados =====================

export const ESTADOS: EstadoVenta[] = [
  'presupuesto_aceptado',
  'cobrado_parcial',
  'cobrado_total',
  'pendiente_programar',
  'programado',
  'en_ejecucion',
  'trabajo_terminado',
  'pendiente_cierre',
  'listo_facturar',
  'facturado',
  'cerrado',
]

export const ESTADO_LABEL: Record<EstadoVenta, string> = {
  presupuesto_aceptado: 'Presupuesto aceptado',
  cobrado_parcial: 'Cobrado parcialmente',
  cobrado_total: 'Cobrado 100%',
  pendiente_programar: 'Pendiente de programar',
  programado: 'Programado',
  en_ejecucion: 'En ejecución',
  trabajo_terminado: 'Trabajo terminado',
  pendiente_cierre: 'Pendiente de cierre / devolución',
  listo_facturar: 'Listo para facturar',
  facturado: 'Facturado',
  cerrado: 'Cerrado',
}

// Color asociado a cada estado (para chips/badges).
export const ESTADO_COLOR: Record<EstadoVenta, string> = {
  presupuesto_aceptado: 'var(--brand-1)',
  cobrado_parcial: 'var(--amber)',
  cobrado_total: 'var(--green)',
  pendiente_programar: 'var(--amber)',
  programado: 'var(--brand-1)',
  en_ejecucion: 'var(--violet)',
  trabajo_terminado: 'var(--teal)',
  pendiente_cierre: 'var(--red)',
  listo_facturar: 'var(--brand-1)',
  facturado: 'var(--green)',
  cerrado: 'var(--text-subtle)',
}

// Línea cronológica simplificada (8 hitos del prompt).
export type HitoCronologia =
  | 'aceptado'
  | 'cobrado'
  | 'programado'
  | 'ejecutado'
  | 'pendiente_cierre'
  | 'listo_facturar'
  | 'facturado'
  | 'cerrado'

export const CRONOLOGIA: { hito: HitoCronologia; label: string }[] = [
  { hito: 'aceptado', label: 'Aceptado' },
  { hito: 'cobrado', label: 'Cobrado' },
  { hito: 'programado', label: 'Programado' },
  { hito: 'ejecutado', label: 'Ejecutado' },
  { hito: 'pendiente_cierre', label: 'Pendiente de cierre' },
  { hito: 'listo_facturar', label: 'Listo para facturar' },
  { hito: 'facturado', label: 'Facturado' },
  { hito: 'cerrado', label: 'Cerrado' },
]

// Índice de avance: hasta qué hito se considera alcanzado según el estado.
const ESTADO_A_HITO: Record<EstadoVenta, number> = {
  presupuesto_aceptado: 0,
  cobrado_parcial: 1,
  cobrado_total: 1,
  pendiente_programar: 1,
  programado: 2,
  en_ejecucion: 2,
  trabajo_terminado: 3,
  pendiente_cierre: 4,
  listo_facturar: 5,
  facturado: 6,
  cerrado: 7,
}

export function hitoAlcanzado(estado: EstadoVenta, indiceHito: number): boolean {
  return ESTADO_A_HITO[estado] >= indiceHito
}

// ===================== Catálogos =====================

export const TIPOS_TRABAJO: { valor: TipoTrabajo; label: string }[] = [
  { valor: 'limpieza', label: 'Limpieza' },
  { valor: 'instalacion', label: 'Instalación' },
  { valor: 'reparacion', label: 'Reparación' },
  { valor: 'sustitucion_turbina', label: 'Sustitución de turbina' },
  { valor: 'otro', label: 'Otro' },
]

export const FORMAS_COBRO = [
  'Transferencia',
  'Efectivo',
  'Tarjeta',
  'Pagaré',
  'Confirming',
  'Otro',
]

export const CATEGORIAS_GASTO: { valor: CategoriaGasto; label: string }[] = [
  { valor: 'mano_obra', label: 'Mano de obra' },
  { valor: 'material', label: 'Material' },
  { valor: 'turbina', label: 'Turbina' },
  { valor: 'desplazamiento', label: 'Desplazamiento' },
  { valor: 'dietas', label: 'Dietas' },
  { valor: 'subcontrata', label: 'Subcontrata' },
  { valor: 'software', label: 'Software' },
  { valor: 'compra_puntual', label: 'Compra puntual' },
  { valor: 'otro', label: 'Otro' },
]

export function labelTipoTrabajo(t: TipoTrabajo | null | undefined): string {
  return TIPOS_TRABAJO.find((x) => x.valor === t)?.label || '—'
}
export function labelCategoria(c: CategoriaGasto | null | undefined): string {
  return CATEGORIAS_GASTO.find((x) => x.valor === c)?.label || '—'
}

// ===================== Semáforo de margen =====================

export type NivelMargen = 'bajo' | 'preventivo' | 'correcto'

export function nivelMargen(pct: number | null | undefined): NivelMargen {
  if (pct == null) return 'preventivo'
  if (pct < 30) return 'bajo'
  if (pct <= 40) return 'preventivo'
  return 'correcto'
}

export function colorMargen(pct: number | null | undefined): string {
  const n = nivelMargen(pct)
  return n === 'bajo' ? 'var(--red)' : n === 'preventivo' ? 'var(--amber)' : 'var(--green)'
}

export function labelMargen(pct: number | null | undefined): string {
  const n = nivelMargen(pct)
  return n === 'bajo' ? 'Margen bajo' : n === 'preventivo' ? 'Aviso preventivo' : 'Margen correcto'
}

// ===================== Formato =====================

export function eur(n: number | null | undefined): string {
  const v = typeof n === 'number' && isFinite(n) ? n : 0
  return v.toLocaleString('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 })
}

export function pct(n: number | null | undefined): string {
  if (n == null || !isFinite(n)) return '—'
  return `${n.toLocaleString('es-ES', { maximumFractionDigits: 1 })}%`
}

export function fechaCorta(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
}

// Clave de mes 'YYYY-MM' a partir de una fecha ISO.
export function claveMes(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (isNaN(d.getTime())) return null
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function etiquetaMes(clave: string | null): string {
  if (!clave) return '—'
  const [a, m] = clave.split('-').map(Number)
  const d = new Date(a, (m || 1) - 1, 1)
  const txt = d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
  return txt.charAt(0).toUpperCase() + txt.slice(1)
}
