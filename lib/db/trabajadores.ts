import { supabase } from '../supabase'
import type { Trabajador } from '../trabajadores'

const T = () => (supabase as any).from('perfiles')

export async function listarPerfiles(): Promise<Trabajador[]> {
  const { data, error } = await T().select('id, nombre, rol, telefono, activo').order('nombre')
  if (error) throw error
  return (data || []) as Trabajador[]
}

export async function actualizarPerfil(id: string, datos: Partial<Trabajador>): Promise<void> {
  const { error } = await T().update(datos).eq('id', id)
  if (error) throw error
}

// Crear (con contraseña) y eliminar usan la API admin (service role) en el servidor.
export async function crearTrabajador(payload: { email: string; password: string; nombre: string; rol: string; telefono?: string }) {
  const res = await fetch('/api/trabajadores', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'No se pudo crear el trabajador')
  return data
}

export async function eliminarTrabajador(id: string) {
  const res = await fetch('/api/trabajadores', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'No se pudo eliminar')
}
