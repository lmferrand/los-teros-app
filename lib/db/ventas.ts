import { supabase } from '../supabase'
import type { Venta, VentaInput } from '../tipos'

// Encapsula el acceso a la tabla `ventas`. La UI no toca supabase directamente.
const tabla = () => (supabase as any).from('ventas')

export async function listarVentas(): Promise<Venta[]> {
  const { data, error } = await tabla()
    .select('*')
    .order('fecha_aceptacion', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data || []) as Venta[]
}

export async function obtenerVenta(id: string): Promise<Venta | null> {
  const { data, error } = await tabla().select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return (data as Venta) || null
}

export async function crearVenta(input: VentaInput): Promise<Venta> {
  const { data, error } = await tabla().insert(input).select('*').single()
  if (error) throw error
  return data as Venta
}

export async function actualizarVenta(id: string, input: VentaInput): Promise<Venta> {
  const { data, error } = await tabla()
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data as Venta
}

export async function borrarVenta(id: string): Promise<void> {
  // Los gastos se borran en cascada (ON DELETE CASCADE en el SQL).
  const { error } = await tabla().delete().eq('id', id)
  if (error) throw error
}
