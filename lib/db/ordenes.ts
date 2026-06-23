import { supabase } from '../supabase'
import type { Orden, FotoOrden, Incidencia } from '../ordenes'
import type { Venta } from '../tipos'

const T = (n: string) => (supabase as any).from(n)
const BUCKET = 'fotos-ordenes'

export interface OrdenConRefs extends Orden {
  clientes?: { nombre: string | null } | null
  perfiles?: { nombre: string | null } | null
}

export async function listarOrdenes(): Promise<OrdenConRefs[]> {
  const { data, error } = await T('ordenes')
    .select('*, clientes(nombre), perfiles!tecnico_id(nombre)')
    .order('fecha_programada', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data || []) as OrdenConRefs[]
}

export async function obtenerOrden(id: string): Promise<OrdenConRefs | null> {
  const { data } = await T('ordenes').select('*, clientes(nombre), perfiles!tecnico_id(nombre)').eq('id', id).maybeSingle()
  return (data as OrdenConRefs) || null
}

function tipoOtDesdeVenta(t: string | null): string {
  if (t === 'sustitucion_turbina') return 'sustitucion'
  if (t === 'reparacion') return 'mantenimiento'
  if (t === 'limpieza' || t === 'instalacion') return t
  return 'otro'
}

// Crea la OT a partir de un presupuesto (mapeo estándar).
export async function crearOtDesdePresupuesto(venta: Venta): Promise<Orden> {
  return crearOrden({
    cliente_id: venta.cliente_id,
    venta_id: venta.id,
    tipo: tipoOtDesdeVenta(venta.tipo_trabajo),
    estado: 'pendiente',
    prioridad: '2',
    fecha_programada: venta.fecha_prevista_ejecucion ? new Date(venta.fecha_prevista_ejecucion).toISOString() : null,
    // La descripción de la OT detalla QUÉ se va a realizar (concepto del presupuesto).
    descripcion: (venta.observaciones && venta.observaciones.trim())
      ? venta.observaciones
      : `${venta.tipo_trabajo || 'Trabajo'} para ${venta.cliente || 'cliente'}`.trim(),
    observaciones: `Generado desde el presupuesto ${venta.numero || ''}`.trim(),
  })
}

// Si el presupuesto está en "programado" y no tiene OT, la crea. Tolerante si
// aún no existe la columna venta_id (no rompe nada).
export async function asegurarOtAlProgramar(venta: Venta): Promise<void> {
  if (venta.estado !== 'programado') return
  try {
    const existe = await ordenPorVenta(venta.id)
    if (!existe) await crearOtDesdePresupuesto(venta)
  } catch { /* sin columna venta_id aún: se ignora */ }
}

// OT vinculada a un presupuesto (si existe). Tolerante si aún no hay columna venta_id.
export async function ordenPorVenta(ventaId: string): Promise<{ id: string; codigo: string } | null> {
  try {
    const { data, error } = await T('ordenes').select('id, codigo').eq('venta_id', ventaId).order('created_at', { ascending: false })
    if (error) return null
    return data && data[0] ? data[0] : null
  } catch { return null }
}

async function generarCodigo(): Promise<string> {
  const { count } = await T('ordenes').select('*', { count: 'exact', head: true })
  return `OT-${new Date().getFullYear()}-${String((count || 0) + 1).padStart(4, '0')}`
}

export async function crearOrden(datos: Partial<Orden>): Promise<Orden> {
  const codigo = datos.codigo || (await generarCodigo())
  const { data, error } = await T('ordenes').insert({ ...datos, codigo }).select('*').single()
  if (error) throw error
  return data as Orden
}

export async function actualizarOrden(id: string, datos: Partial<Orden>): Promise<Orden> {
  const { data, error } = await T('ordenes').update(datos).eq('id', id).select('*').single()
  if (error) throw error
  return data as Orden
}

export async function borrarOrden(id: string): Promise<void> {
  // Borra fotos e incidencias asociadas; los movimientos NO se borran (trazabilidad).
  await T('fotos_ordenes').delete().eq('orden_id', id)
  await T('incidencias_ordenes').delete().eq('orden_id', id)
  const { error } = await T('ordenes').delete().eq('id', id)
  if (error) throw error
}

// ----------------- Storage -----------------
async function subir(path: string, blob: Blob): Promise<string> {
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { cacheControl: '3600', upsert: false, contentType: blob.type || 'application/octet-stream' })
  if (error) throw error
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}
function rand() { return Math.random().toString(36).slice(2, 8) }

// ----------------- Fotos -----------------
export async function listarFotos(ordenId: string): Promise<FotoOrden[]> {
  const { data } = await T('fotos_ordenes').select('*').eq('orden_id', ordenId).order('created_at', { ascending: true })
  return (data || []) as FotoOrden[]
}
export async function subirFotoOrden(ordenId: string, blob: Blob, tipo: string, userId: string | null): Promise<void> {
  const url = await subir(`ordenes/${ordenId}/${tipo}-${Date.now()}-${rand()}.jpg`, blob)
  const { error } = await T('fotos_ordenes').insert({ orden_id: ordenId, tipo, url, subida_por: userId })
  if (error) throw error
}
export async function borrarFotoOrden(id: string): Promise<void> {
  const { error } = await T('fotos_ordenes').delete().eq('id', id)
  if (error) throw error
}

// ----------------- Incidencias -----------------
export async function listarIncidencias(ordenId: string): Promise<Incidencia[]> {
  const { data } = await T('incidencias_ordenes').select('*').eq('orden_id', ordenId).order('created_at', { ascending: false })
  return (data || []) as Incidencia[]
}
export async function crearIncidencia(opts: {
  ordenId: string; tecnicoId: string | null; descripcion: string; estadoOrden: string | null; fotoBlob?: Blob | null; audioBlob?: Blob | null
}): Promise<void> {
  let foto_url: string | null = null
  let audio_url = ''
  if (opts.fotoBlob) foto_url = await subir(`incidencias/${opts.ordenId}/foto-${Date.now()}-${rand()}.jpg`, opts.fotoBlob)
  if (opts.audioBlob) audio_url = await subir(`incidencias/${opts.ordenId}/audio-${Date.now()}-${rand()}.webm`, opts.audioBlob)
  const { error } = await T('incidencias_ordenes').insert({
    orden_id: opts.ordenId, tecnico_id: opts.tecnicoId, estado_orden: opts.estadoOrden,
    descripcion: opts.descripcion || null, foto_url, audio_url,
  })
  if (error) throw error
}
export async function borrarIncidencia(id: string): Promise<void> {
  const { error } = await T('incidencias_ordenes').delete().eq('id', id)
  if (error) throw error
}

// ----------------- Materiales/equipos consumidos en la OT -----------------
export interface MovimientoOrden {
  id: string; tipo: string; cantidad: number | null; observaciones: string | null; fecha: string | null
  materiales?: { nombre: string; unidad: string | null } | null
  equipos?: { codigo: string } | null
}
export async function listarMovimientosOrden(ordenId: string): Promise<MovimientoOrden[]> {
  const { data } = await T('movimientos')
    .select('id, tipo, cantidad, observaciones, fecha, materiales(nombre, unidad), equipos(codigo)')
    .eq('orden_id', ordenId)
    .order('fecha', { ascending: false })
  return (data || []) as MovimientoOrden[]
}
