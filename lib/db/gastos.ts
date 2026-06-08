import { supabase } from '../supabase'
import type { Gasto, GastoInput } from '../tipos'

const tabla = () => (supabase as any).from('gastos')

export async function listarGastos(ventaId: string): Promise<Gasto[]> {
  const { data, error } = await tabla()
    .select('*')
    .eq('venta_id', ventaId)
    .order('fecha', { ascending: false, nullsFirst: false })
  if (error) throw error
  return (data || []) as Gasto[]
}

// Todos los gastos (para agregados del dashboard / vista de márgenes).
export async function listarTodosGastos(): Promise<Gasto[]> {
  const { data, error } = await tabla().select('*')
  if (error) throw error
  return (data || []) as Gasto[]
}

export async function crearGasto(input: GastoInput): Promise<Gasto> {
  const { data, error } = await tabla().insert(input).select('*').single()
  if (error) throw error
  return data as Gasto
}

export async function actualizarGasto(id: string, input: GastoInput): Promise<Gasto> {
  const { data, error } = await tabla().update(input).eq('id', id).select('*').single()
  if (error) throw error
  return data as Gasto
}

export async function borrarGasto(id: string): Promise<void> {
  const { error } = await tabla().delete().eq('id', id)
  if (error) throw error
}
