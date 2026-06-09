import { supabase } from '../supabase'

const T = (n: string) => (supabase as any).from(n)

// Trae todas las filas de una consulta paginando (límite 1000 de Supabase).
async function traerTodo<T = any>(tabla: string, columnas: string): Promise<T[]> {
  const LOTE = 1000
  const out: T[] = []
  let desde = 0
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await T(tabla).select(columnas).range(desde, desde + LOTE - 1)
    if (error) throw error
    const filas = (data || []) as T[]
    out.push(...filas)
    if (filas.length < LOTE) break
    desde += LOTE
  }
  return out
}

export interface FechaServicio { cliente_id: string; fecha: string }

// Fechas de servicio desde el historial servicios_clientes.
export async function serviciosTodos(): Promise<FechaServicio[]> {
  const filas = await traerTodo<{ cliente_id: string | null; fecha_servicio: string | null }>(
    'servicios_clientes', 'cliente_id, fecha_servicio'
  )
  return filas
    .filter((f) => f.cliente_id && f.fecha_servicio)
    .map((f) => ({ cliente_id: f.cliente_id as string, fecha: f.fecha_servicio as string }))
}

// Fechas de servicio desde las órdenes de trabajo (fecha_programada).
export async function ordenesTodas(): Promise<FechaServicio[]> {
  const filas = await traerTodo<{ cliente_id: string | null; fecha_programada: string | null }>(
    'ordenes', 'cliente_id, fecha_programada'
  )
  return filas
    .filter((f) => f.cliente_id && f.fecha_programada)
    .map((f) => ({ cliente_id: f.cliente_id as string, fecha: f.fecha_programada as string }))
}

// Marca/desmarca el seguimiento de llamada de un cliente.
export async function marcarLlamada(clienteId: string, ok: boolean): Promise<void> {
  const { error } = await T('clientes')
    .update({ seguimiento_llamada_ok: ok, seguimiento_llamada_at: ok ? new Date().toISOString() : null })
    .eq('id', clienteId)
  if (error) throw error
}
