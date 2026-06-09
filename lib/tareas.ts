export interface Tarea {
  id: string
  titulo: string
  descripcion: string | null
  fecha: string | null
  prioridad: string | null
  hecha: boolean
  asignado_a: string | null
  cliente_id: string | null
  orden_id: string | null
  created_at?: string
}

export const PRIORIDADES_TAREA: Record<string, { label: string; color: string }> = {
  '1': { label: 'Baja', color: 'var(--text-muted)' },
  '2': { label: 'Media', color: 'var(--amber)' },
  '3': { label: 'Alta', color: 'var(--red)' },
}
