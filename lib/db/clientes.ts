import { supabase } from '../supabase'
import type { Cliente, ServicioCliente } from '../clientes'
import type { Venta } from '../tipos'

const T = (n: string) => (supabase as any).from(n)

// Carga TODOS los clientes (incluida la columna `empresa`, no tipada).
// Supabase devuelve máximo 1000 filas por petición, así que paginamos por lotes.
export async function listarClientes(): Promise<Cliente[]> {
  const LOTE = 1000
  const todos: Cliente[] = []
  let desde = 0
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await T('clientes')
      .select('*')
      .order('nombre')
      .range(desde, desde + LOTE - 1)
    if (error) throw error
    const filas = (data || []) as Cliente[]
    todos.push(...filas)
    if (filas.length < LOTE) break
    desde += LOTE
  }
  return todos
}

export async function obtenerCliente(id: string): Promise<Cliente | null> {
  const { data } = await T('clientes').select('*').eq('id', id).maybeSingle()
  return (data as Cliente) || null
}

export async function guardarCliente(id: string | null, datos: Partial<Cliente>): Promise<Cliente> {
  const q = id ? T('clientes').update(datos).eq('id', id) : T('clientes').insert(datos)
  const { data, error } = await q.select('*').single()
  if (error) throw error
  return data as Cliente
}

export async function borrarCliente(id: string): Promise<void> {
  const { error } = await T('clientes').delete().eq('id', id)
  if (error) throw error
}

// Otros locales con el mismo CIF (excluyendo el actual).
export async function localesMismoCif(cif: string, excluirId: string): Promise<Cliente[]> {
  const c = (cif || '').trim()
  if (!c) return []
  const { data } = await T('clientes').select('*').eq('cif', c).neq('id', excluirId).limit(50)
  return (data || []) as Cliente[]
}

// Historial de servicios (app antigua).
export async function serviciosDeCliente(clienteId: string): Promise<ServicioCliente[]> {
  const { data } = await T('servicios_clientes')
    .select('*')
    .eq('cliente_id', clienteId)
    .order('fecha_servicio', { ascending: false })
    .limit(100)
  return (data || []) as ServicioCliente[]
}

// Presupuestos/ventas del cliente (módulo financiero nuevo).
export async function ventasDeCliente(clienteId: string): Promise<Venta[]> {
  const { data } = await T('ventas')
    .select('*')
    .eq('cliente_id', clienteId)
    .order('fecha_aceptacion', { ascending: false, nullsFirst: false })
  return (data || []) as Venta[]
}
