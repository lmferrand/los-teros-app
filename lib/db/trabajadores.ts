import { supabase } from '../supabase'
import type { Trabajador } from '../trabajadores'

const T = () => (supabase as any).from('perfiles')

export async function listarPerfiles(): Promise<Trabajador[]> {
  const { data, error } = await T().select('id, nombre, rol, telefono, activo, permisos_modulos').order('nombre')
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

export async function listarEmails(): Promise<Record<string, string | undefined>> {
  const res = await fetch('/api/trabajadores', { method: 'GET' })
  const data = await res.json().catch(() => ({ emails: {} }))
  return data.emails || {}
}

export async function restablecerPassword(id: string, password: string) {
  const res = await fetch('/api/trabajadores', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, password }) })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'No se pudo restablecer la contraseña')
}

export async function eliminarTrabajador(id: string) {
  const res = await fetch('/api/trabajadores', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'No se pudo eliminar')
}
