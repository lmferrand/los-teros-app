// Dominio de Órdenes de Trabajo (OT). Reutiliza las tablas ordenes,
// fotos_ordenes e incidencias_ordenes existentes en Supabase.

export interface Orden {
  id: string
  codigo: string
  tipo: string
  cliente_id: string | null
  venta_id: string | null
  tecnico_id: string | null
  tecnicos_ids: string[] | null
  estado: string | null
  prioridad: string | null
  fecha_programada: string | null
  fecha_cierre: string | null
  duracion_horas: number | null
  hora_fija: boolean | null
  descripcion: string | null
  materiales_previstos: string | null
  observaciones: string | null
  created_at?: string | null
}

export interface FotoOrden {
  id: string
  orden_id: string | null
  tipo: string | null
  url: string
  subida_por: string | null
  created_at: string | null
}

export interface Incidencia {
  id: string
  orden_id: string
  tecnico_id: string | null
  estado_orden: string | null
  descripcion: string | null
  audio_url: string
  foto_url: string | null
  created_at: string
}

export const TIPOS_OT = [
  { valor: 'limpieza', label: 'Limpieza' },
  { valor: 'instalacion', label: 'Instalación' },
  { valor: 'sustitucion', label: 'Sustitución' },
  { valor: 'mantenimiento', label: 'Mantenimiento' },
  { valor: 'revision', label: 'Revisión' },
  { valor: 'otro', label: 'Otro' },
]

export const ESTADOS_OT: Record<string, { label: string; color: string }> = {
  pendiente: { label: 'Pendiente', color: 'var(--amber)' },
  en_curso: { label: 'En curso', color: 'var(--brand-1)' },
  completada: { label: 'Completada', color: 'var(--green)' },
  cancelada: { label: 'Cancelada', color: 'var(--text-subtle)' },
}
export const ESTADOS_OT_LISTA = ['pendiente', 'en_curso', 'completada', 'cancelada']

export const PRIORIDADES: Record<string, { label: string; color: string }> = {
  '1': { label: 'Baja', color: 'var(--text-muted)' },
  '2': { label: 'Media', color: 'var(--amber)' },
  '3': { label: 'Alta', color: 'var(--red)' },
}

export const DURACIONES = [
  { v: 0.5, label: '30 min' }, { v: 1, label: '1 hora' }, { v: 1.5, label: '1.5 horas' },
  { v: 2, label: '2 horas' }, { v: 3, label: '3 horas' }, { v: 4, label: '4 horas' },
  { v: 5, label: '5 horas' }, { v: 6, label: '6 horas' }, { v: 8, label: 'Jornada completa' },
]

export function labelTipoOt(v: string | null | undefined) {
  return TIPOS_OT.find((t) => t.valor === v)?.label || (v || '—')
}
// ¿La OT está asignada a este usuario (técnico)?
export function esMiOrden(o: { tecnico_id?: string | null; tecnicos_ids?: string[] | null }, userId: string | null | undefined): boolean {
  if (!userId) return false
  return o.tecnico_id === userId || !!(o.tecnicos_ids && o.tecnicos_ids.includes(userId))
}

export function normalizarPrioridad(v: string | null | undefined): string {
  if (v === 'baja' || v === '1') return '1'
  if (v === 'alta' || v === 'urgente' || v === '3') return '3'
  return '2'
}
