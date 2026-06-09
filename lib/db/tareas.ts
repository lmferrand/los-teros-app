import { supabase } from '../supabase'
import type { Tarea } from '../tareas'

const T = () => (supabase as any).from('tareas')

export async function listarTareas(): Promise<Tarea[]> {
  const { data, error } = await T().select('*').order('fecha', { ascending: true, nullsFirst: false }).order('created_at', { ascending: false })
  if (error) throw error
  return (data || []) as Tarea[]
}

export async function crearTarea(datos: Partial<Tarea>): Promise<Tarea> {
  const { data, error } = await T().insert(datos).select('*').single()
  if (error) throw error
  return data as Tarea
}

export async function actualizarTarea(id: string, datos: Partial<Tarea>): Promise<void> {
  const { error } = await T().update(datos).eq('id', id)
  if (error) throw error
}

export async function borrarTarea(id: string): Promise<void> {
  const { error } = await T().delete().eq('id', id)
  if (error) throw error
}
