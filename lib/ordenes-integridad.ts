import { supabase } from '@/lib/supabase'

type SupabaseError = {
  code?: string
  message?: string
}

type RpcConsumoRow = {
  movimiento_id?: string
  stock_actual?: number
}

type RpcSalidaRow = {
  movimiento_id?: string
}

type RpcDeleteOrderResult = {
  orden_id?: string
  stock_restaurado?: number
  movimientos_eliminados?: number
  fotos_eliminadas?: number
  albaranes_eliminados?: number
}

function esFuncionRpcNoDisponible(error: SupabaseError | null | undefined) {
  if (!error) return false
  const texto = `${error.code || ''} ${error.message || ''}`.toLowerCase()
  return (
    texto.includes('pgrst202') ||
    (texto.includes('function') && texto.includes('not found')) ||
    texto.includes('does not exist') ||
    texto.includes('could not find the function')
  )
}

function mensajeError(error: unknown, fallback: string) {
  if (error && typeof error === 'object' && 'message' in error) {
    const msg = String((error as { message?: string }).message || '').trim()
    if (msg) return msg
  }
  return fallback
}

function extraerPathStorageDesdeUrl(url: string) {
  const marcador = '/storage/v1/object/public/fotos-ordenes/'
  const idx = url.indexOf(marcador)
  if (idx < 0) return null
  const encodedPath = url.slice(idx + marcador.length)
  if (!encodedPath) return null
  return decodeURIComponent(encodedPath)
}

async function recalcularEstadoEquipo(equipoId: string) {
  const { data: ultimos } = await supabase
    .from('movimientos')
    .select('tipo, fecha')
    .eq('equipo_id', equipoId)
    .order('fecha', { ascending: false, nullsFirst: false })
    .limit(1)

  const tipo = ultimos?.[0]?.tipo
  if (tipo === 'salida') {
    await supabase.from('equipos').update({ estado: 'en_cliente' }).eq('id', equipoId)
    return
  }

  await supabase
    .from('equipos')
    .update({ estado: 'disponible', fecha_salida: null })
    .eq('id', equipoId)
}

export async function cargarMovimientosOrden(ordenId: string, codigoOt?: string | null) {
  const { data, error } = await supabase
    .from('movimientos')
    .select('*, materiales(nombre, unidad), equipos(codigo, tipo), perfiles(nombre)')
    .eq('orden_id', ordenId)
    .order('fecha', { ascending: false, nullsFirst: false })

  if (error) throw error
  const base = data || []
  if (!codigoOt) return base

  const [consumo, salida, porId] = await Promise.all([
    supabase
      .from('movimientos')
      .select('*, materiales(nombre, unidad), equipos(codigo, tipo), perfiles(nombre)')
      .is('orden_id', null)
      .ilike('observaciones', `%Consumo via QR desde OT ${codigoOt}%`)
      .order('fecha', { ascending: false, nullsFirst: false }),
    supabase
      .from('movimientos')
      .select('*, materiales(nombre, unidad), equipos(codigo, tipo), perfiles(nombre)')
      .is('orden_id', null)
      .ilike('observaciones', `%Salida via QR desde OT ${codigoOt}%`)
      .order('fecha', { ascending: false, nullsFirst: false }),
    supabase
      .from('movimientos')
      .select('*, materiales(nombre, unidad), equipos(codigo, tipo), perfiles(nombre)')
      .is('orden_id', null)
      .ilike('observaciones', `%[id:${ordenId}]%`)
      .order('fecha', { ascending: false, nullsFirst: false }),
  ])

  const extras = [...(consumo.data || []), ...(salida.data || []), ...(porId.data || [])]
  if (extras.length === 0) return base

  const mapa = new Map<string, any>()
  for (const mov of base) mapa.set(mov.id, mov)
  for (const mov of extras) {
    if (!mapa.has(mov.id)) mapa.set(mov.id, { ...mov, orden_id: ordenId })
  }

  return Array.from(mapa.values()).sort((a: any, b: any) => {
    const fa = a?.fecha ? new Date(a.fecha).getTime() : 0
    const fb = b?.fecha ? new Date(b.fecha).getTime() : 0
    return fb - fa
  })
}

export async function repararVinculoMovimientosOt(ordenId: string, codigoOt?: string | null) {
  if (!codigoOt && !ordenId) return 0

  const { data: consumoCodigo, error: errorConsumoCodigo } = await supabase
    .from('movimientos')
    .select('id, observaciones')
    .is('orden_id', null)
    .ilike('observaciones', `%Consumo via QR desde OT ${codigoOt}%`)

  const { data: salidaCodigo, error: errorSalidaCodigo } = await supabase
    .from('movimientos')
    .select('id, observaciones')
    .is('orden_id', null)
    .ilike('observaciones', `%Salida via QR desde OT ${codigoOt}%`)

  const { data: porId, error: errorPorId } = await supabase
    .from('movimientos')
    .select('id, observaciones')
    .is('orden_id', null)
    .ilike('observaciones', `%[id:${ordenId}]%`)

  if (errorConsumoCodigo || errorSalidaCodigo || errorPorId) return 0

  const ids = Array.from(
    new Set([
      ...(consumoCodigo || []).map((c) => c.id),
      ...(salidaCodigo || []).map((s) => s.id),
      ...(porId || []).map((m) => m.id),
    ])
  )
  if (ids.length === 0) return 0

  const { error: errorUpdate } = await supabase
    .from('movimientos')
    .update({ orden_id: ordenId })
    .in('id', ids)

  if (errorUpdate) return 0
  return ids.length
}

export async function eliminarArchivosFotosOrden(ordenId: string) {
  const { data: fotos, error } = await supabase
    .from('fotos_ordenes')
    .select('url')
    .eq('orden_id', ordenId)

  if (error || !fotos || fotos.length === 0) {
    return { total: 0, eliminadas: 0, errores: 0 }
  }

  const paths = Array.from(
    new Set(fotos.map((f) => extraerPathStorageDesdeUrl(f.url)).filter(Boolean) as string[])
  )
  if (paths.length === 0) return { total: 0, eliminadas: 0, errores: 0 }

  const { error: errorLote } = await supabase.storage.from('fotos-ordenes').remove(paths)
  if (!errorLote) {
    return { total: paths.length, eliminadas: paths.length, errores: 0 }
  }

  let eliminadas = 0
  for (const path of paths) {
    const { error: errorUno } = await supabase.storage.from('fotos-ordenes').remove([path])
    if (!errorUno) eliminadas++
  }
  return { total: paths.length, eliminadas, errores: paths.length - eliminadas }
}

export async function registrarConsumoMaterialOt(params: {
  materialId: string
  cantidad: number
  tecnicoId: string
  ordenId: string | null
  observaciones: string
}) {
  const supabaseRpc = supabase as any
  const eventKey = crypto.randomUUID()

  const { data: rpcData, error: rpcError } = await supabaseRpc.rpc(
    'registrar_consumo_material_ot',
    {
      p_material_id: params.materialId,
      p_cantidad: params.cantidad,
      p_tecnico_id: params.tecnicoId,
      p_orden_id: params.ordenId,
      p_observaciones: params.observaciones,
      p_event_key: eventKey,
    }
  )

  if (!rpcError) {
    const fila = (Array.isArray(rpcData) ? rpcData[0] : rpcData) as RpcConsumoRow | undefined
    return {
      stockActual: Number(fila?.stock_actual || 0),
      movimientoId: fila?.movimiento_id || null,
    }
  }

  if (!esFuncionRpcNoDisponible(rpcError)) throw rpcError

  const { data: material, error: errorMaterial } = await supabase
    .from('materiales')
    .select('id, stock')
    .eq('id', params.materialId)
    .single()

  if (errorMaterial || !material) {
    throw new Error(mensajeError(errorMaterial, 'No se encontro el material.'))
  }

  const stockActual = Number(material.stock || 0)
  if (stockActual < params.cantidad) {
    throw new Error('Stock insuficiente para registrar el consumo.')
  }

  const nuevoStock = stockActual - params.cantidad

  const { error: errorUpdate } = await supabase
    .from('materiales')
    .update({ stock: nuevoStock })
    .eq('id', params.materialId)

  if (errorUpdate) throw errorUpdate

  const { data: movInsertado, error: errorInsertMov } = await supabase
    .from('movimientos')
    .insert({
      tipo: 'consumo',
      material_id: params.materialId,
      orden_id: params.ordenId,
      tecnico_id: params.tecnicoId,
      cantidad: params.cantidad,
      observaciones: params.observaciones,
      fecha: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (errorInsertMov) {
    await supabase.from('materiales').update({ stock: stockActual }).eq('id', params.materialId)
    throw errorInsertMov
  }

  return { stockActual: nuevoStock, movimientoId: movInsertado?.id || null }
}

export async function registrarSalidaEquipoOt(params: {
  equipoId: string
  tecnicoId: string
  ordenId: string | null
  observaciones: string
}) {
  const supabaseRpc = supabase as any
  const eventKey = crypto.randomUUID()

  const { data: rpcData, error: rpcError } = await supabaseRpc.rpc(
    'registrar_salida_equipo_ot',
    {
      p_equipo_id: params.equipoId,
      p_tecnico_id: params.tecnicoId,
      p_orden_id: params.ordenId,
      p_observaciones: params.observaciones,
      p_event_key: eventKey,
    }
  )

  if (!rpcError) {
    const fila = (Array.isArray(rpcData) ? rpcData[0] : rpcData) as RpcSalidaRow | undefined
    return { movimientoId: fila?.movimiento_id || null }
  }

  if (!esFuncionRpcNoDisponible(rpcError)) throw rpcError

  const { data: equipo, error: errorEquipo } = await supabase
    .from('equipos')
    .select('id, estado')
    .eq('id', params.equipoId)
    .single()

  if (errorEquipo || !equipo) {
    throw new Error(mensajeError(errorEquipo, 'No se encontro el equipo.'))
  }

  if (equipo.estado !== 'disponible') {
    throw new Error(`Este equipo no esta disponible (estado: ${equipo.estado}).`)
  }

  const { error: errorUpdate } = await supabase
    .from('equipos')
    .update({ estado: 'en_cliente', fecha_salida: new Date().toISOString() })
    .eq('id', params.equipoId)

  if (errorUpdate) throw errorUpdate

  const { data: movInsertado, error: errorInsertMov } = await supabase
    .from('movimientos')
    .insert({
      tipo: 'salida',
      equipo_id: params.equipoId,
      orden_id: params.ordenId,
      tecnico_id: params.tecnicoId,
      cantidad: 1,
      estado_equipo: 'en_cliente',
      observaciones: params.observaciones,
      fecha: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (errorInsertMov) {
    await supabase
      .from('equipos')
      .update({ estado: equipo.estado, fecha_salida: null })
      .eq('id', params.equipoId)
    throw errorInsertMov
  }

  return { movimientoId: movInsertado?.id || null }
}

export async function eliminarMovimientoConIntegridad(
  movimientoId: string,
  opciones?: {
    devolverMaterialAStock?: boolean
    registrarDevolucion?: boolean
    tecnicoId?: string | null
    codigoOt?: string | null
  }
) {
  const devolverMaterialAStock = opciones?.devolverMaterialAStock !== false

  const { data: movBase, error: errorMovBase } = await supabase
    .from('movimientos')
    .select('*')
    .eq('id', movimientoId)
    .single()

  if (errorMovBase || !movBase) {
    throw new Error(mensajeError(errorMovBase, 'No se encontro el movimiento.'))
  }

  if (!devolverMaterialAStock) {
    const { error: errorDelete } = await supabase.from('movimientos').delete().eq('id', movimientoId)
    if (errorDelete) throw errorDelete
    if (movBase.equipo_id) await recalcularEstadoEquipo(movBase.equipo_id)
    return
  }

  const supabaseRpc = supabase as any
  const { error: rpcError } = await supabaseRpc.rpc('eliminar_movimiento_con_integridad', {
    p_movimiento_id: movimientoId,
  })

  if (!rpcError) {
    if (opciones?.registrarDevolucion && movBase.tipo === 'consumo' && movBase.material_id && movBase.cantidad) {
      const obs = `Devolucion al inventario por borrado de movimiento (${movBase.id})${opciones?.codigoOt ? ` en OT ${opciones.codigoOt}` : ''}`
      await supabase.from('movimientos').insert({
        tipo: 'entrada',
        material_id: movBase.material_id,
        orden_id: movBase.orden_id,
        tecnico_id: opciones?.tecnicoId || movBase.tecnico_id || null,
        cantidad: movBase.cantidad,
        observaciones: obs,
        fecha: new Date().toISOString(),
      })
    }
    return
  }
  if (!esFuncionRpcNoDisponible(rpcError)) throw rpcError

  if (movBase.tipo === 'consumo' && movBase.material_id && movBase.cantidad) {
    const { data: material, error: errorMaterial } = await supabase
      .from('materiales')
      .select('stock')
      .eq('id', movBase.material_id)
      .single()
    if (errorMaterial || !material) {
      throw new Error(mensajeError(errorMaterial, 'No se encontro el material del movimiento.'))
    }
    const nuevoStock = Number(material.stock || 0) + Number(movBase.cantidad || 0)
    const { error: errorStock } = await supabase
      .from('materiales')
      .update({ stock: nuevoStock })
      .eq('id', movBase.material_id)
    if (errorStock) throw errorStock

    if (opciones?.registrarDevolucion) {
      const obs = `Devolucion al inventario por borrado de movimiento (${movBase.id})${opciones?.codigoOt ? ` en OT ${opciones.codigoOt}` : ''}`
      await supabase.from('movimientos').insert({
        tipo: 'entrada',
        material_id: movBase.material_id,
        orden_id: movBase.orden_id,
        tecnico_id: opciones?.tecnicoId || movBase.tecnico_id || null,
        cantidad: movBase.cantidad,
        observaciones: obs,
        fecha: new Date().toISOString(),
      })
    }
  }

  const { error: errorDelete } = await supabase.from('movimientos').delete().eq('id', movimientoId)
  if (errorDelete) throw errorDelete

  if (movBase.equipo_id) await recalcularEstadoEquipo(movBase.equipo_id)
}

export async function eliminarOrdenConIntegridad(ordenId: string) {
  const supabaseRpc = supabase as any
  const { data: rpcData, error: rpcError } = await supabaseRpc.rpc(
    'eliminar_orden_con_integridad',
    { p_orden_id: ordenId }
  )

  if (!rpcError) {
    const fila = (Array.isArray(rpcData) ? rpcData[0] : rpcData) as RpcDeleteOrderResult | undefined
    return {
      ordenId: fila?.orden_id || ordenId,
      stockRestaurado: Number(fila?.stock_restaurado || 0),
      movimientosEliminados: Number(fila?.movimientos_eliminados || 0),
      fotosEliminadas: Number(fila?.fotos_eliminadas || 0),
      albaranesEliminados: Number(fila?.albaranes_eliminados || 0),
    }
  }

  if (!esFuncionRpcNoDisponible(rpcError)) throw rpcError

  const { data: movimientos, error: errorMovs } = await supabase
    .from('movimientos')
    .select('*')
    .eq('orden_id', ordenId)

  if (errorMovs) throw errorMovs

  const stockPorMaterial = new Map<string, number>()
  const equiposARecalcular = new Set<string>()
  for (const mov of movimientos || []) {
    if (mov.tipo === 'consumo' && mov.material_id && mov.cantidad) {
      const acumulado = stockPorMaterial.get(mov.material_id) || 0
      stockPorMaterial.set(mov.material_id, acumulado + Number(mov.cantidad || 0))
    }
    if (mov.equipo_id) equiposARecalcular.add(mov.equipo_id)
  }

  let stockRestaurado = 0
  for (const [materialId, cantidad] of stockPorMaterial.entries()) {
    const { data: material, error: errorMaterial } = await supabase
      .from('materiales')
      .select('stock')
      .eq('id', materialId)
      .single()
    if (errorMaterial || !material) continue
    const nuevoStock = Number(material.stock || 0) + cantidad
    const { error: errorUpdate } = await supabase
      .from('materiales')
      .update({ stock: nuevoStock })
      .eq('id', materialId)
    if (!errorUpdate) stockRestaurado += cantidad
  }

  const movimientosEliminados = (movimientos || []).length

  const { data: fotos } = await supabase.from('fotos_ordenes').select('id').eq('orden_id', ordenId)
  const fotosEliminadas = (fotos || []).length
  const { error: errorFotos } = await supabase.from('fotos_ordenes').delete().eq('orden_id', ordenId)
  if (errorFotos) throw errorFotos

  const { data: albaranes } = await supabase.from('albaranes').select('id').eq('orden_id', ordenId)
  const albaranesEliminados = (albaranes || []).length
  const { error: errorAlbs } = await supabase.from('albaranes').delete().eq('orden_id', ordenId)
  if (errorAlbs) throw errorAlbs

  const { error: errorDeleteMovs } = await supabase.from('movimientos').delete().eq('orden_id', ordenId)
  if (errorDeleteMovs) throw errorDeleteMovs

  for (const equipoId of equiposARecalcular) {
    await recalcularEstadoEquipo(equipoId)
  }

  const { error: errorDeleteOt } = await supabase.from('ordenes').delete().eq('id', ordenId)
  if (errorDeleteOt) throw errorDeleteOt

  return {
    ordenId,
    stockRestaurado,
    movimientosEliminados,
    fotosEliminadas,
    albaranesEliminados,
  }
}
