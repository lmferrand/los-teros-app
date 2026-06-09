import { supabase } from '../supabase'
import type { Material, Equipo, Movimiento } from '../inventario'

const T = (n: string) => (supabase as any).from(n)

// ----------------- Materiales -----------------
export async function listarMateriales(): Promise<Material[]> {
  const { data, error } = await T('materiales').select('*').order('nombre')
  if (error) throw error
  return (data || []) as Material[]
}
export async function obtenerMaterial(id: string): Promise<Material | null> {
  const { data } = await T('materiales').select('*').eq('id', id).maybeSingle()
  return (data as Material) || null
}
export async function guardarMaterial(id: string | null, datos: Partial<Material>): Promise<Material> {
  const q = id ? T('materiales').update(datos).eq('id', id) : T('materiales').insert(datos)
  const { data, error } = await q.select('*').single()
  if (error) throw error
  return data as Material
}
export async function borrarMaterial(id: string): Promise<void> {
  const { error } = await T('materiales').delete().eq('id', id)
  if (error) throw error
}
export async function fijarStock(id: string, stock: number): Promise<void> {
  const { error } = await T('materiales').update({ stock }).eq('id', id)
  if (error) throw error
}

// ----------------- Equipos -----------------
export async function listarEquipos(): Promise<Equipo[]> {
  const { data, error } = await T('equipos').select('*').order('codigo')
  if (error) throw error
  return (data || []) as Equipo[]
}
export async function obtenerEquipo(id: string): Promise<Equipo | null> {
  const { data } = await T('equipos').select('*').eq('id', id).maybeSingle()
  return (data as Equipo) || null
}
export async function guardarEquipo(id: string | null, datos: Partial<Equipo>): Promise<Equipo> {
  const q = id ? T('equipos').update(datos).eq('id', id) : T('equipos').insert(datos)
  const { data, error } = await q.select('*').single()
  if (error) throw error
  return data as Equipo
}
export async function borrarEquipo(id: string): Promise<void> {
  const { error } = await T('equipos').delete().eq('id', id)
  if (error) throw error
}
export async function cambiarEstadoEquipo(id: string, estado: string): Promise<void> {
  const { error } = await T('equipos').update({ estado }).eq('id', id)
  if (error) throw error
}

// ----------------- Movimientos -----------------
export interface MovimientoConRefs extends Movimiento {
  materiales?: { nombre: string; unidad: string | null } | null
  equipos?: { codigo: string; tipo: string | null } | null
  ordenes?: { codigo: string | null } | null
  perfiles?: { nombre: string | null } | null
}

export async function listarMovimientos(limite = 200): Promise<MovimientoConRefs[]> {
  const { data, error } = await T('movimientos')
    .select('*, materiales(nombre, unidad), equipos(codigo, tipo), ordenes(codigo), perfiles(nombre)')
    .order('fecha', { ascending: false })
    .limit(limite)
  if (error) throw error
  return (data || []) as MovimientoConRefs[]
}

export async function crearMovimiento(datos: Partial<Movimiento>): Promise<Movimiento> {
  const { data, error } = await T('movimientos').insert(datos).select('*').single()
  if (error) throw error
  return data as Movimiento
}

// Búsqueda manual por código de equipo o referencia de material (para el escáner).
export async function buscarItemPorCodigo(texto: string): Promise<{ tipo: 'material'; material: Material } | { tipo: 'equipo'; equipo: Equipo } | null> {
  const t = texto.trim()
  if (!t) return null
  const { data: eqs } = await T('equipos').select('*').ilike('codigo', t).limit(1)
  if (eqs && eqs.length) return { tipo: 'equipo', equipo: eqs[0] as Equipo }
  const { data: mats } = await T('materiales').select('*').ilike('referencia', t).limit(1)
  if (mats && mats.length) return { tipo: 'material', material: mats[0] as Material }
  return null
}

// ----------------- Selectores (OT y trabajadores) -----------------
export async function listarOrdenes(): Promise<{ id: string; codigo: string | null }[]> {
  const { data } = await T('ordenes').select('id, codigo').order('codigo', { ascending: false }).limit(300)
  return (data || []) as { id: string; codigo: string | null }[]
}
export async function listarTrabajadores(): Promise<{ id: string; nombre: string | null }[]> {
  const { data } = await T('perfiles').select('id, nombre').order('nombre')
  return (data || []) as { id: string; nombre: string | null }[]
}

// Movimientos de un ítem concreto (para el historial en su ficha).
export async function listarMovimientosItem(campo: 'material_id' | 'equipo_id', id: string): Promise<MovimientoConRefs[]> {
  const { data } = await T('movimientos')
    .select('*, ordenes(codigo), perfiles(nombre)')
    .eq(campo, id)
    .order('fecha', { ascending: false })
    .limit(50)
  return (data || []) as MovimientoConRefs[]
}

// OT (y cliente) que tiene actualmente cada equipo, según la última "salida".
export async function otPorEquipo(): Promise<Record<string, { codigo: string | null; cliente: string | null }>> {
  const { data } = await T('movimientos')
    .select('equipo_id, fecha, ordenes(codigo, clientes(nombre))')
    .eq('tipo', 'salida')
    .not('orden_id', 'is', null)
    .order('fecha', { ascending: false })
  const mapa: Record<string, { codigo: string | null; cliente: string | null }> = {}
  for (const mov of (data || []) as any[]) {
    const eqId = String(mov?.equipo_id || '')
    if (!eqId || mapa[eqId]) continue // la primera (más reciente) gana
    const orden = Array.isArray(mov?.ordenes) ? mov.ordenes[0] : mov?.ordenes
    const cli = Array.isArray(orden?.clientes) ? orden.clientes[0] : orden?.clientes
    mapa[eqId] = { codigo: orden?.codigo ?? null, cliente: cli?.nombre ?? null }
  }
  return mapa
}

// ----------------- Foto de material (Storage) -----------------
const MARCADOR_FOTO = '/storage/v1/object/public/fotos-materiales/'

export function pathFotoDesdeUrl(url: string | null | undefined): string | null {
  if (!url) return null
  const i = url.indexOf(MARCADOR_FOTO)
  if (i < 0) return null
  return url.slice(i + MARCADOR_FOTO.length).split('?')[0]
}

export async function borrarFoto(url: string | null | undefined): Promise<void> {
  const path = pathFotoDesdeUrl(url)
  if (!path) return
  try { await supabase.storage.from('fotos-materiales').remove([path]) } catch { /* noop */ }
}

export async function subirFotoMaterial(blob: Blob, ext = 'jpg'): Promise<string> {
  const nombre = `materiales/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const { error } = await supabase.storage.from('fotos-materiales').upload(nombre, blob, {
    cacheControl: '3600',
    upsert: false,
    contentType: blob.type || 'image/jpeg',
  })
  if (error) throw error
  const { data } = supabase.storage.from('fotos-materiales').getPublicUrl(nombre)
  return data.publicUrl
}
