import { supabase } from '../supabase'
import type { Albaran } from '../albaranes'
import type { Cliente } from '../clientes'

const T = () => (supabase as any).from('albaranes')
const BUCKET = 'fotos-albaranes'

export interface AlbaranConRefs extends Albaran {
  clientes?: { nombre: string | null } | null
  ordenes?: { codigo: string | null } | null
}

export async function listarAlbaranes(): Promise<AlbaranConRefs[]> {
  const { data, error } = await T()
    .select('*, clientes(nombre), ordenes(codigo)')
    .order('fecha', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data || []) as AlbaranConRefs[]
}

export async function obtenerAlbaran(id: string): Promise<AlbaranConRefs | null> {
  const { data } = await T().select('*, clientes(nombre), ordenes(codigo)').eq('id', id).maybeSingle()
  return (data as AlbaranConRefs) || null
}

async function generarNumero(): Promise<string> {
  const { count } = await T().select('*', { count: 'exact', head: true })
  return `ALB-${new Date().getFullYear()}-${String((count || 0) + 1).padStart(4, '0')}`
}

// Datos fiscales del albarán a partir de un cliente.
export function datosDesdeCliente(c: Partial<Cliente> | null): Partial<Albaran> {
  if (!c) return {}
  return {
    cliente_id: c.id ?? null,
    razon_social: c.nombre_fiscal || c.nombre || null,
    cif: c.cif || null,
    domicilio: c.direccion || null,
    localidad: c.poblacion || null,
    telefono: c.telefono || c.movil || null,
    email: c.email || null,
  }
}

export async function crearAlbaran(datos: Partial<Albaran>): Promise<Albaran> {
  const numero = datos.numero || (await generarNumero())
  const { data, error } = await T().insert({ ...datos, numero }).select('*').single()
  if (error) throw error
  return data as Albaran
}

export async function actualizarAlbaran(id: string, datos: Partial<Albaran>): Promise<Albaran> {
  const { data, error } = await T().update(datos).eq('id', id).select('*').single()
  if (error) throw error
  return data as Albaran
}

export async function borrarAlbaran(id: string): Promise<void> {
  const { error } = await T().delete().eq('id', id)
  if (error) throw error
}

// Storage (fotos y firmas).
async function subir(path: string, blob: Blob): Promise<string> {
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { cacheControl: '3600', upsert: false, contentType: blob.type || 'image/png' })
  if (error) throw error
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}
const rand = () => Math.random().toString(36).slice(2, 8)

export async function subirFotoAlbaran(albaranId: string, blob: Blob): Promise<string> {
  return subir(`albaranes/${albaranId}/foto-${Date.now()}-${rand()}.jpg`, blob)
}
export async function subirFirma(albaranId: string, rol: 'empleado' | 'cliente', blob: Blob): Promise<string> {
  return subir(`albaranes/${albaranId}/firma-${rol}-${Date.now()}.png`, blob)
}

export async function obtenerCliente(id: string): Promise<Cliente | null> {
  const { data } = await (supabase as any).from('clientes').select('*').eq('id', id).maybeSingle()
  return (data as Cliente) || null
}
