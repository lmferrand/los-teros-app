'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { s } from '@/lib/styles'
import AppHeader from '@/app/components/AppHeader'
import {
  cargarMovimientosOrden,
  eliminarArchivosFotosOrden,
  eliminarMovimientoConIntegridad,
  eliminarOrdenConIntegridad,
  registrarConsumoMaterialOt,
  repararVinculoMovimientosOt,
} from '@/lib/ordenes-integridad'

function aDatetimeLocal(iso?: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 16)
}

function redondearMediaHora(value: string) {
  if (!value || !value.includes('T')) return value
  const [fechaPart, horaPart] = value.split('T')
  if (!fechaPart || !horaPart) return value

  const [hhStr, mmStr] = horaPart.split(':')
  const hh = Number(hhStr)
  const mm = Number(mmStr)
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return value

  const base = new Date(`${fechaPart}T00:00:00`)
  if (Number.isNaN(base.getTime())) return value

  const totalMin = hh * 60 + mm
  const redondeado = Math.round(totalMin / 30) * 30
  base.setMinutes(redondeado)

  const yyyy = base.getFullYear()
  const mes = String(base.getMonth() + 1).padStart(2, '0')
  const dia = String(base.getDate()).padStart(2, '0')
  const horas = String(base.getHours()).padStart(2, '0')
  const mins = String(base.getMinutes()).padStart(2, '0')
  return `${yyyy}-${mes}-${dia}T${horas}:${mins}`
}

function normalizarGradoIntervencion(valor: string | null | undefined) {
  const v = String(valor || '').trim().toLowerCase()
  if (v === '1' || v === '2' || v === '3') return v
  if (v === 'baja') return '1'
  if (v === 'alta' || v === 'urgente') return '3'
  return '2'
}

function textoGradoIntervencion(valor: string | null | undefined) {
  const grado = normalizarGradoIntervencion(valor)
  if (grado === '1') return 'Grado 1'
  if (grado === '3') return 'Grado 3'
  return 'Grado 2'
}

type TipoCliente = 'teros' | 'olipro'

function normalizarTipoCliente(valor: unknown): TipoCliente {
  const v = String(valor || '').trim().toLowerCase()
  if (v === 'olipro') return 'olipro'
  return 'teros'
}

function labelTipoCliente(valor: TipoCliente | '') {
  if (valor === 'olipro') return 'Clientes Olipro'
  if (valor === 'teros') return 'Clientes Teros'
  return 'Selecciona tipo'
}

function nombreComercialCliente(cliente: any) {
  return String(cliente?.nombre_comercial || cliente?.nombre || '').trim()
}

function nombreFiscalCliente(cliente: any) {
  return String(cliente?.nombre_fiscal || '').trim()
}

export default function Ordenes() {
  const [ordenes, setOrdenes] = useState<any[]>([])
  const [clientes, setClientes] = useState<any[]>([])
  const [tecnicos, setTecnicos] = useState<any[]>([])
  const [materiales, setMateriales] = useState<any[]>([])
  const [vehiculos, setVehiculos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [filtroEstado, setFiltroEstado] = useState('')
  const [ordenDetalle, setOrdenDetalle] = useState<any>(null)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [subiendo, setSubiendo] = useState(false)
  const [mostrarModalEliminar, setMostrarModalEliminar] = useState(false)
  const [ordenAEliminar, setOrdenAEliminar] = useState<any>(null)
  const [perfil, setPerfil] = useState<any>(null)
  const [userId, setUserId] = useState('')
  const [soloMias, setSoloMias] = useState(false)
  const [eliminandoOrden, setEliminandoOrden] = useState(false)
  const [movimientoEliminandoId, setMovimientoEliminandoId] = useState<string | null>(null)
  const [materialManualId, setMaterialManualId] = useState('')
  const [cantidadManual, setCantidadManual] = useState('1')
  const [notaManual, setNotaManual] = useState('')
  const [guardandoManual, setGuardandoManual] = useState(false)
  const ultimaSyncOtRef = useRef(0)
  const router = useRouter()

  const [tipo, setTipo] = useState('limpieza')
  const [tipoClienteOt, setTipoClienteOt] = useState<TipoCliente | ''>('')
  const [clienteId, setClienteId] = useState('')
  const [tecnicosSeleccionados, setTecnicosSeleccionados] = useState<string[]>([])
  const [vehiculoId, setVehiculoId] = useState('')
  const [tecnicoVehiculoId, setTecnicoVehiculoId] = useState('')
  const [fecha, setFecha] = useState('')
  const [prioridad, setPrioridad] = useState('2')
  const [estado, setEstado] = useState('pendiente')
  const [descripcion, setDescripcion] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [duracionHoras, setDuracionHoras] = useState('2')
  const [horaFija, setHoraFija] = useState(false)

  async function inicializar() {
    const ok = await verificarSesion()
    if (!ok) return
    await cargarDatos()
  }

  async function verificarSesion() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      router.push('/login')
      return false
    }

    setUserId(session.user.id)
    const { data: perfilData } = await supabase
      .from('perfiles')
      .select('*')
      .eq('id', session.user.id)
      .single()

    setPerfil(perfilData || null)
    if (perfilData?.rol === 'tecnico' || perfilData?.rol === 'almacen') {
      setSoloMias(true)
    }

    return true
  }

  async function cargarDatos() {
    const [ords, clis, tecs, mats, vehs] = await Promise.all([
      supabase.from('ordenes').select('*, clientes(nombre)').order('created_at', { ascending: false }),
      supabase.from('clientes').select('*').order('nombre'),
      supabase.from('perfiles').select('*').order('nombre'),
      supabase.from('materiales').select('id, nombre, stock, unidad').order('nombre'),
      supabase.from('vehiculos_flota').select('id, matricula, alias, marca, modelo, activo').eq('activo', true).order('matricula'),
    ])
    if (ords.data) setOrdenes(ords.data)
    if (clis.data) setClientes(clis.data)
    if (tecs.data) setTecnicos(tecs.data)
    if (mats.data) setMateriales(mats.data)
    if (vehs.data) setVehiculos(vehs.data)
    setLoading(false)
  }

  useEffect(() => {
    inicializar()
    // Carga inicial.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!ordenDetalle) return

    sincronizarDetalleSiOtActualizada()
    const timer = window.setInterval(() => {
      sincronizarDetalleSiOtActualizada()
    }, 1500)

    const onFocus = () => {
      sincronizarDetalleSiOtActualizada()
    }
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        sincronizarDetalleSiOtActualizada()
      }
    }

    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibility)
    }
    // Reacciona a cambios del detalle abierto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ordenDetalle?.id])

  useEffect(() => {
    if (!ordenDetalle) return
    if (materialManualId) return
    const primero = materiales.find((m: any) => Number(m.stock || 0) > 0)
    if (primero?.id) setMaterialManualId(primero.id)
  }, [ordenDetalle, materiales, materialManualId])

  useEffect(() => {
    if (!tecnicoVehiculoId) return
    if (tecnicosSeleccionados.includes(tecnicoVehiculoId)) return
    setTecnicoVehiculoId('')
  }, [tecnicosSeleccionados, tecnicoVehiculoId])

  useEffect(() => {
    if (!clienteId) return
    const clienteActual = clientes.find((c: any) => c.id === clienteId)
    if (!clienteActual) return
    if (!tipoClienteOt) return
    if (normalizarTipoCliente(clienteActual.tipo_cliente) !== tipoClienteOt) {
      setClienteId('')
    }
  }, [tipoClienteOt, clienteId, clientes])

  async function cargarFotosOrden(ordenId: string) {
    const { data } = await supabase.from('fotos_ordenes').select('*').eq('orden_id', ordenId).order('created_at')
    return data || []
  }

  function esAdmin() {
    return perfil?.rol === 'gerente' || perfil?.rol === 'oficina' || perfil?.rol === 'supervisor'
  }

  function esAsignado(orden: any) {
    if (!orden || !userId) return false
    return orden.tecnicos_ids?.includes(userId) || orden.tecnico_id === userId
  }

  function puedeGestionar(orden: any) {
    if (esAdmin()) return true
    return esAsignado(orden)
  }

  async function recargarDetalleOrden(ordenId: string) {
    const codigoOt = ordenDetalle?.codigo || null
    await repararVinculoMovimientosOt(ordenId, codigoOt)
    const [fotos, movimientos] = await Promise.all([
      cargarFotosOrden(ordenId),
      cargarMovimientosOrden(ordenId, codigoOt),
    ])
    setOrdenDetalle((prev: any) => (prev ? { ...prev, fotos, movimientos } : prev))
  }

  async function sincronizarDetalleSiOtActualizada() {
    if (!ordenDetalle) return
    const raw = sessionStorage.getItem('ot_actualizada')
    if (!raw) return

    try {
      const payload = JSON.parse(raw) as { ordenId?: string; ts?: number }
      const ts = Number(payload?.ts || 0)
      if (!payload?.ordenId || payload.ordenId !== ordenDetalle.id) return
      if (ts <= ultimaSyncOtRef.current) return

      ultimaSyncOtRef.current = ts
      await repararVinculoMovimientosOt(ordenDetalle.id, ordenDetalle.codigo || null)
      await recargarDetalleOrden(ordenDetalle.id)
    } catch {
      // Ignorar payload invalido
    }
  }

  async function eliminarFoto(foto: any) {
    if (!ordenDetalle || !puedeGestionar(ordenDetalle)) {
      alert('No tienes permiso para eliminar fotos de esta OT.')
      return
    }
    if (!confirm('Eliminar esta foto?')) return
    await supabase.from('fotos_ordenes').delete().eq('id', foto.id)
    if (foto.tipo === 'albaran') {
      const { data: albs } = await supabase.from('albaranes').select('id, fotos_urls').eq('orden_id', ordenDetalle.id)
      if (albs && albs.length > 0) {
        for (const alb of albs) {
          const nuevasFotos = (alb.fotos_urls || []).filter((u: string) => u !== foto.url)
          if (nuevasFotos.length === 0) {
            await supabase.from('albaranes').delete().eq('id', alb.id)
          } else {
            await supabase.from('albaranes').update({ fotos_urls: nuevasFotos }).eq('id', alb.id)
          }
        }
      }
    }
    await recargarDetalleOrden(ordenDetalle.id)
  }

  async function abrirDetalle(o: any) {
    await repararVinculoMovimientosOt(o.id, o.codigo)
    const [fotos, movimientos] = await Promise.all([
      cargarFotosOrden(o.id),
      cargarMovimientosOrden(o.id, o.codigo),
    ])
    setCantidadManual('1')
    setNotaManual('')
    setMaterialManualId('')
    setOrdenDetalle({ ...o, fotos, movimientos })
  }

  function abrirFormNuevo() {
    if (!esAdmin()) {
      alert('Solo gerencia/oficina puede crear OT.')
      return
    }
    setEditandoId(null)
    setTipo('limpieza'); setTipoClienteOt(''); setClienteId(''); setTecnicosSeleccionados([])
    setVehiculoId(''); setTecnicoVehiculoId('')
    setFecha(''); setPrioridad('2'); setEstado('pendiente')
    setDescripcion(''); setObservaciones(''); setDuracionHoras('2'); setHoraFija(false)
    setMostrarForm(true)
  }

  function abrirFormEditar(o: any) {
    if (!esAdmin()) {
      alert('Solo gerencia/oficina puede editar OT.')
      return
    }
    setEditandoId(o.id)
    const clienteActual = clientes.find((c: any) => c.id === o.cliente_id)
    setTipo(o.tipo || 'limpieza'); setTipoClienteOt(clienteActual ? normalizarTipoCliente(clienteActual.tipo_cliente) : ''); setClienteId(o.cliente_id || '')
    setTecnicosSeleccionados(o.tecnicos_ids || [])
    setVehiculoId(o.vehiculo_id || '')
    setTecnicoVehiculoId(o.tecnico_vehiculo_id || '')
    setFecha(redondearMediaHora(aDatetimeLocal(o.fecha_programada)))
    setPrioridad(normalizarGradoIntervencion(o.prioridad)); setEstado(o.estado || 'pendiente')
    setDescripcion(o.descripcion || ''); setObservaciones(o.observaciones || '')
    setDuracionHoras(String(o.duracion_horas || 2)); setHoraFija(o.hora_fija || false)
    setMostrarForm(true); setOrdenDetalle(null)
  }

  async function subirFoto(e: React.ChangeEvent<HTMLInputElement>, tipoFoto: string) {
    const file = e.target.files?.[0]
    if (!file || !ordenDetalle) return
    if (!puedeGestionar(ordenDetalle)) {
      alert('No tienes permiso para subir fotos en esta OT.')
      return
    }
    setSubiendo(true)
    try {
      let comprimida: Blob = file
      try { comprimida = await comprimirImagen(file) } catch { }
      const nombreArchivo = `orden_${ordenDetalle.id}/${tipoFoto}/${crypto.randomUUID()}.jpg`
      const { data, error } = await supabase.storage.from('fotos-ordenes').upload(nombreArchivo, comprimida, { contentType: 'image/jpeg' })
      if (error) { alert('Error al subir: ' + error.message); setSubiendo(false); return }
      if (data) {
        const { data: urlData } = supabase.storage.from('fotos-ordenes').getPublicUrl(nombreArchivo)
        const { data: { session } } = await supabase.auth.getSession()
        const { error: insertError } = await supabase.from('fotos_ordenes').insert({
          orden_id: ordenDetalle.id, tipo: tipoFoto, url: urlData.publicUrl, subida_por: session?.user?.id
        })
        if (insertError) { alert('Error al registrar foto: ' + insertError.message); setSubiendo(false); return }
        await recargarDetalleOrden(ordenDetalle.id)
        if (tipoFoto === 'albaran') {
          const { count } = await supabase.from('albaranes').select('*', { count: 'exact', head: true })
          const num = String((count || 0) + 1).padStart(4, '0')
          const { error: albError } = await supabase.from('albaranes').insert({
            numero: `ALB-${new Date().getFullYear()}-${num}`,
            cliente_id: ordenDetalle.cliente_id || null,
            orden_id: ordenDetalle.id,
            descripcion: ordenDetalle.descripcion || '',
            estado: 'pendiente',
            fecha: new Date().toISOString().slice(0, 10),
            fotos_urls: [urlData.publicUrl],
            observaciones: `Creado automaticamente desde OT ${ordenDetalle.codigo}`,
          })
          if (!albError) alert('Albaran creado automaticamente en Albaranes.')
          else alert('Error al crear albaran: ' + albError.message)
        }
      }
    } catch { alert('Error inesperado al subir la foto.') }
    setSubiendo(false)
  }

  async function comprimirImagen(file: File, maxWidth = 1200, calidad = 0.75): Promise<Blob> {
    return new Promise((resolve) => {
      const img = new Image()
      const url = URL.createObjectURL(file)
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let width = img.width; let height = img.height
        if (width > maxWidth) { height = Math.round((height * maxWidth) / width); width = maxWidth }
        canvas.width = width; canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx?.drawImage(img, 0, 0, width, height)
        canvas.toBlob((blob) => resolve(blob || file), 'image/jpeg', calidad)
        URL.revokeObjectURL(url)
      }
      img.src = url
    })
  }

  function toggleTecnico(id: string) {
    setTecnicosSeleccionados(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id])
  }

  async function generarCodigo(tipo: string) {
    const prefijos: any = { limpieza: 'LIM', sustitucion: 'SUS', mantenimiento: 'MAN', instalacion: 'INS', revision: 'REV', otro: 'OTR' }
    const { count } = await supabase.from('ordenes').select('*', { count: 'exact', head: true }).eq('tipo', tipo)
    const num = String((count || 0) + 1).padStart(4, '0')
    return `${prefijos[tipo] || 'OTR'}-${new Date().getFullYear()}-${num}`
  }

  async function guardarOrden(e: React.FormEvent) {
    e.preventDefault()
    if (!esAdmin()) {
      alert('No tienes permiso para guardar cambios en OT.')
      return
    }
    if (!tipoClienteOt) {
      alert('Primero selecciona si la OT es para Clientes Teros o Clientes Olipro.')
      return
    }
    if (!clienteId) {
      alert('Selecciona un cliente.')
      return
    }
    const clienteSeleccionado = clientes.find((c: any) => c.id === clienteId)
    if (!clienteSeleccionado) {
      alert('El cliente seleccionado ya no existe. Recarga la pantalla.')
      return
    }
    if (normalizarTipoCliente(clienteSeleccionado.tipo_cliente) !== tipoClienteOt) {
      alert('El cliente no pertenece al tipo seleccionado. Vuelve a elegir cliente.')
      return
    }

    const datos = {
      tipo, cliente_id: clienteId, tecnico_id: tecnicosSeleccionados[0] || null,
      tecnicos_ids: tecnicosSeleccionados, fecha_programada: fecha, prioridad, estado,
      vehiculo_id: vehiculoId || null,
      tecnico_vehiculo_id: tecnicoVehiculoId || null,
      descripcion, observaciones, duracion_horas: parseFloat(duracionHoras) || 2, hora_fija: horaFija,
    }
    if (editandoId) {
      await supabase.from('ordenes').update(datos).eq('id', editandoId)
    } else {
      const nuevoCodigo = await generarCodigo(tipo)
      await supabase.from('ordenes').insert({ ...datos, codigo: nuevoCodigo })
    }
    setMostrarForm(false); setEditandoId(null)
    setDescripcion(''); setObservaciones(''); setTipoClienteOt(''); setClienteId(''); setTecnicosSeleccionados([])
    setVehiculoId(''); setTecnicoVehiculoId('')
    cargarDatos()
  }

  async function cambiarEstado(id: string, nuevoEstado: string) {
    if (!ordenDetalle || !puedeGestionar(ordenDetalle)) {
      alert('No tienes permiso para cambiar el estado de esta OT.')
      return
    }
    if (nuevoEstado === 'completada' && ordenDetalle) {
      const fotos = ordenDetalle.fotos || []
      const fotosProceso = fotos.filter((f: any) => f.tipo === 'proceso')
      const fotosCierre = fotos.filter((f: any) => f.tipo === 'cierre')
      if (fotosProceso.length === 0) {
        alert('Debes subir al menos una foto del proceso antes de completar la orden.')
        return
      }
      if (fotosCierre.length === 0) {
        alert('Debes subir al menos una foto de cierre antes de completar la orden.')
        return
      }
    }
    await supabase.from('ordenes').update({ estado: nuevoEstado }).eq('id', id)
    cargarDatos()
    if (ordenDetalle?.id === id) setOrdenDetalle((prev: any) => ({ ...prev, estado: nuevoEstado }))
  }

  function pedirEliminarOrden(o: any) {
    if (!esAdmin()) {
      alert('Solo gerencia/oficina puede eliminar OT.')
      return
    }
    setOrdenAEliminar(o)
    setMostrarModalEliminar(true)
  }

  async function confirmarEliminarOrden() {
    if (!ordenAEliminar) return
    if (!esAdmin()) {
      alert('No tienes permiso para eliminar OT.')
      return
    }

    const id = ordenAEliminar.id
    setEliminandoOrden(true)
    try {
      await eliminarArchivosFotosOrden(id)
      await eliminarOrdenConIntegridad(id)
      setMostrarModalEliminar(false)
      setOrdenAEliminar(null)
      setOrdenDetalle(null)
      await cargarDatos()
    } catch (error) {
      alert(`No se pudo eliminar la OT: ${getMensajeError(error)}`)
    } finally {
      setEliminandoOrden(false)
    }
  }

  async function eliminarMovimiento(mov: any) {
    if (!ordenDetalle || !puedeGestionar(ordenDetalle)) {
      alert('No tienes permiso para eliminar este movimiento.')
      return
    }
    if (!confirm('Eliminar este movimiento?')) return

    let devolverMaterialAStock = true
    let registrarDevolucion = false
    if (mov.tipo === 'consumo' && mov.material_id) {
      devolverMaterialAStock = confirm('¿Regresa el material al inventario?\nAceptar = SI\nCancelar = NO')
      registrarDevolucion = devolverMaterialAStock
    }

    setMovimientoEliminandoId(mov.id)
    try {
      await eliminarMovimientoConIntegridad(mov.id, {
        devolverMaterialAStock,
        registrarDevolucion,
        tecnicoId: userId || null,
        codigoOt: ordenDetalle.codigo || null,
      })
      await recargarDetalleOrden(ordenDetalle.id)
    } catch (error) {
      alert(`No se pudo eliminar el movimiento: ${getMensajeError(error)}`)
    } finally {
      setMovimientoEliminandoId(null)
    }
  }

  async function registrarConsumoManual() {
    if (!ordenDetalle || !puedeGestionar(ordenDetalle)) {
      alert('No tienes permiso para registrar material en esta OT.')
      return
    }
    if (!userId) {
      alert('No se pudo identificar el tecnico actual.')
      return
    }
    if (!materialManualId) {
      alert('Selecciona un material.')
      return
    }

    const cantidad = Number(cantidadManual)
    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      alert('La cantidad debe ser mayor que 0.')
      return
    }

    setGuardandoManual(true)
    try {
      const material = materiales.find((m: any) => m.id === materialManualId)
      const observaciones = notaManual.trim()
        ? `Consumo manual OT ${ordenDetalle.codigo}: ${notaManual.trim()}`
        : `Consumo manual desde OT ${ordenDetalle.codigo} [id:${ordenDetalle.id}]`

      const { stockActual } = await registrarConsumoMaterialOt({
        materialId: materialManualId,
        cantidad,
        tecnicoId: userId,
        ordenId: ordenDetalle.id,
        observaciones,
      })

      setMateriales((prev: any[]) =>
        prev.map((m: any) => (m.id === materialManualId ? { ...m, stock: stockActual } : m))
      )
      setCantidadManual('1')
      setNotaManual('')
      await recargarDetalleOrden(ordenDetalle.id)
      alert(`Material registrado en OT${material?.nombre ? `: ${material.nombre}` : ''}.`)
    } catch (error) {
      alert(`No se pudo registrar el material: ${getMensajeError(error)}`)
    } finally {
      setGuardandoManual(false)
    }
  }

  function getMensajeError(error: unknown) {
    if (error && typeof error === 'object' && 'message' in error) {
      const msg = String((error as { message?: string }).message || '').trim()
      if (msg) return msg
    }
    return 'Error desconocido'
  }

  function getNombresTecnicos(ids: string[]) {
    if (!ids || ids.length === 0) return 'Sin asignar'
    return ids.map(id => tecnicos.find(t => t.id === id)?.nombre || '').filter(Boolean).join(', ')
  }

  function getNombreVehiculo(id?: string | null) {
    if (!id) return 'Sin vehiculo'
    const v = vehiculos.find((item: any) => item.id === id)
    if (!v) return 'Sin vehiculo'
    const etiqueta = [v.marca, v.modelo].filter(Boolean).join(' ').trim()
    return `${v.matricula}${etiqueta ? ` - ${etiqueta}` : ''}`
  }

  function getNombreTecnico(id?: string | null) {
    if (!id) return 'Sin asignar'
    return tecnicos.find((t: any) => t.id === id)?.nombre || 'Sin asignar'
  }

  function getClienteData(clienteId?: string | null) {
    if (!clienteId) return null
    return clientes.find((c: any) => c.id === clienteId) || null
  }

  function getEtiquetaFiscal(cliente: any) {
    const fiscal = nombreFiscalCliente(cliente)
    const cif = String(cliente?.cif || '').trim()
    if (fiscal && cif) return `${fiscal} - ${cif}`
    if (fiscal) return fiscal
    if (cif) return `CIF: ${cif}`
    return ''
  }

  const TIPOS_FOTO = [
    { key: 'proceso', label: 'Fotos del proceso' },
    { key: 'equipo_salida', label: 'Equipo al salir' },
    { key: 'equipo_retorno', label: 'Equipo al retornar' },
    { key: 'cierre', label: 'Fotos de cierre' },
    { key: 'albaran', label: 'Albaran' },
  ]

  const ESTADO_COLORS: any = {
    pendiente: { bg: 'rgba(124,58,237,0.2)', color: '#a78bfa' },
    en_curso: { bg: 'rgba(234,179,8,0.2)', color: '#fbbf24' },
    completada: { bg: 'rgba(16,185,129,0.2)', color: '#34d399' },
    cancelada: { bg: 'rgba(71,85,105,0.2)', color: '#64748b' },
  }

  const PRIORIDAD_COLORS: any = {
    '1': '#64748b',
    '2': '#06b6d4',
    '3': '#34d399',
    baja: '#64748b',
    normal: '#06b6d4',
    alta: '#34d399',
    urgente: '#34d399',
  }

  const filtradasPorEstado = filtroEstado ? ordenes.filter((o) => o.estado === filtroEstado) : ordenes
  const ordenesFiltradas = soloMias ? filtradasPorEstado.filter((o) => esAsignado(o)) : filtradasPorEstado
  const clientesPorTipo = tipoClienteOt
    ? clientes.filter((c: any) => normalizarTipoCliente(c.tipo_cliente) === tipoClienteOt)
    : []
  const materialesDisponibles = materiales.filter((m: any) => Number(m.stock || 0) > 0)
  const puedeCrearEditar = esAdmin()
  const puedeEliminar = esAdmin()

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>

      {mostrarModalEliminar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.85)' }}>
          <div className="w-full max-w-sm rounded-2xl p-6" style={s.cardStyle}>
            <p className="text-xl mb-2">🗑️</p>
            <p className="font-semibold mb-1" style={{ color: 'var(--text)' }}>Eliminar orden {ordenAEliminar?.codigo}</p>
            <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
              Se eliminaran fotos, albaranes y movimientos asociados. El stock de materiales se restaurara automaticamente. Esta accion no se puede deshacer.
            </p>
            <div className="flex gap-3">
              <button onClick={confirmarEliminarOrden}
                disabled={eliminandoOrden}
                className="flex-1 py-3 rounded-xl text-sm font-semibold"
                style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>
                {eliminandoOrden ? 'Eliminando...' : 'Eliminar'}
              </button>
              <button onClick={() => { setMostrarModalEliminar(false); setOrdenAEliminar(null) }}
                className="flex-1 py-3 rounded-xl text-sm font-semibold" style={s.btnSecondary}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      <AppHeader
        title="Ordenes de trabajo"
        rightSlot={
          <div className="flex items-center gap-3 flex-wrap">
            <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}
              className="text-sm rounded-xl px-3 py-2 outline-none" style={s.inputStyle}>
              <option value="">Todos los estados</option>
              <option value="pendiente">Pendiente</option>
              <option value="en_curso">En curso</option>
              <option value="completada">Completada</option>
              <option value="cancelada">Cancelada</option>
            </select>
            {!!userId && (
              <button onClick={() => setSoloMias(prev => !prev)} className="text-sm px-4 py-2 rounded-xl font-medium" style={s.btnSecondary}>
                {soloMias ? 'Ver todas' : 'Solo mis OTs'}
              </button>
            )}
            {puedeCrearEditar && (
              <button onClick={abrirFormNuevo} className="text-sm px-4 py-2 rounded-xl font-medium" style={s.btnPrimary}>
                + Nueva OT
              </button>
            )}
          </div>
        }
      />

      <div className="p-6 max-w-5xl mx-auto">
        {mostrarForm && puedeCrearEditar && (
          <div className="rounded-2xl p-6 mb-6" style={s.cardStyle}>
            <h2 className="font-semibold mb-5" style={{ color: 'var(--text)' }}>{editandoId ? 'Editar orden' : 'Nueva orden de trabajo'}</h2>
            <form onSubmit={guardarOrden} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-muted)' }}>Tipo</label>
                <select value={tipo} onChange={e => setTipo(e.target.value)} className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={s.inputStyle}>
                  <option value="limpieza">Limpieza</option>
                  <option value="sustitucion">Sustitucion</option>
                  <option value="mantenimiento">Mantenimiento</option>
                  <option value="instalacion">Instalacion</option>
                  <option value="revision">Revision</option>
                  <option value="otro">Otro</option>
                </select>
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-muted)' }}>Grupo de clientes</label>
                <select
                  value={tipoClienteOt}
                  onChange={e => setTipoClienteOt((e.target.value as TipoCliente) || '')}
                  required
                  className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                  style={s.inputStyle}
                >
                  <option value="">Seleccionar grupo...</option>
                  <option value="teros">Clientes Teros</option>
                  <option value="olipro">Clientes Olipro</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-muted)' }}>Cliente</label>
                <select
                  value={clienteId}
                  onChange={e => setClienteId(e.target.value)}
                  required
                  disabled={!tipoClienteOt}
                  className="w-full rounded-xl px-3 py-2 text-sm outline-none disabled:opacity-60"
                  style={s.inputStyle}
                >
                  <option value="">
                    {!tipoClienteOt ? 'Primero selecciona grupo de clientes...' : `Seleccionar cliente (${labelTipoCliente(tipoClienteOt)})...`}
                  </option>
                  {clientesPorTipo.map((c: any) => {
                    const nombreComercial = nombreComercialCliente(c) || 'Cliente sin nombre'
                    const fiscal = nombreFiscalCliente(c)
                    const cifTxt = String(c?.cif || '').trim()
                    const extra = [fiscal, cifTxt].filter(Boolean).join(' - ')
                    return (
                      <option key={c.id} value={c.id}>
                        {extra ? `${nombreComercial} · ${extra}` : nombreComercial}
                      </option>
                    )
                  })}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-muted)' }}>Trabajadores</label>
                <div className="flex flex-wrap gap-2">
                  {tecnicos.map(t => (
                    <button key={t.id} type="button" onClick={() => toggleTecnico(t.id)}
                      className="px-3 py-1.5 rounded-xl text-sm transition-all"
                      style={tecnicosSeleccionados.includes(t.id) ? s.btnPrimary : s.btnSecondary}>
                      {t.nombre}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-muted)' }}>Vehiculo asignado</label>
                <select value={vehiculoId} onChange={e => setVehiculoId(e.target.value)} className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={s.inputStyle}>
                  <option value="">Sin vehiculo</option>
                  {vehiculos.map((v: any) => (
                    <option key={v.id} value={v.id}>
                      {v.matricula} {v.alias ? `- ${v.alias}` : ''} {v.marca ? `(${v.marca})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-muted)' }}>Trabajador que usa vehiculo</label>
                <select
                  value={tecnicoVehiculoId}
                  onChange={e => setTecnicoVehiculoId(e.target.value)}
                  className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                  style={s.inputStyle}
                >
                  <option value="">Sin asignar</option>
                  {tecnicos
                    .filter((t: any) => tecnicosSeleccionados.includes(t.id))
                    .map((t: any) => (
                      <option key={t.id} value={t.id}>{t.nombre}</option>
                    ))}
                </select>
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-muted)' }}>Fecha programada</label>
                <input
                  type="datetime-local"
                  step={1800}
                  value={fecha}
                  onChange={e => setFecha(redondearMediaHora(e.target.value))}
                  required
                  className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                  style={s.inputStyle}
                />
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-muted)' }}>Grado de intervencion</label>
                <select value={prioridad} onChange={e => setPrioridad(normalizarGradoIntervencion(e.target.value))} className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={s.inputStyle}>
                  <option value="1">1 - Basico</option>
                  <option value="2">2 - Medio</option>
                  <option value="3">3 - Calidad alta</option>
                </select>
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-muted)' }}>Estado</label>
                <select value={estado} onChange={e => setEstado(e.target.value)} className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={s.inputStyle}>
                  <option value="pendiente">Pendiente</option>
                  <option value="en_curso">En curso</option>
                  <option value="completada">Completada</option>
                  <option value="cancelada">Cancelada</option>
                </select>
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-muted)' }}>Duracion estimada</label>
                <select value={duracionHoras} onChange={e => setDuracionHoras(e.target.value)} className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={s.inputStyle}>
                  <option value="0.5">30 min</option>
                  <option value="1">1 hora</option>
                  <option value="1.5">1.5 horas</option>
                  <option value="2">2 horas</option>
                  <option value="2.5">2.5 horas</option>
                  <option value="3">3 horas</option>
                  <option value="4">4 horas</option>
                  <option value="5">5 horas</option>
                  <option value="6">6 horas</option>
                  <option value="8">Jornada completa</option>
                </select>
              </div>
              <div className="flex items-center gap-3 rounded-xl px-3 py-2 mt-auto" style={s.inputStyle}>
                <input type="checkbox" id="hora-fija" checked={horaFija} onChange={e => setHoraFija(e.target.checked)} className="w-4 h-4" style={{ accentColor: '#7c3aed' }} />
                <label htmlFor="hora-fija" className="text-sm cursor-pointer" style={{ color: 'var(--text-muted)' }}>Hora fija con cliente</label>
              </div>
              <div className="md:col-span-2">
                <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-muted)' }}>Descripcion</label>
                <textarea value={descripcion} onChange={e => setDescripcion(e.target.value)} required rows={3}
                  className="w-full rounded-xl px-3 py-2 text-sm outline-none resize-none"
                  style={s.inputStyle} placeholder="Describe los trabajos a realizar..." />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-muted)' }}>Observaciones</label>
                <textarea value={observaciones} onChange={e => setObservaciones(e.target.value)} rows={2}
                  className="w-full rounded-xl px-3 py-2 text-sm outline-none resize-none"
                  style={s.inputStyle} placeholder="Instrucciones especiales..." />
              </div>
              <div className="md:col-span-2 flex gap-3">
                <button type="submit" className="px-5 py-2 rounded-xl text-sm font-medium" style={s.btnPrimary}>
                  {editandoId ? 'Guardar cambios' : 'Crear OT'}
                </button>
                <button type="button" onClick={() => { setMostrarForm(false); setEditandoId(null) }}
                  className="text-sm px-5 py-2 rounded-xl" style={s.btnSecondary}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        )}

        {ordenDetalle && (
          <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center" style={{ background: 'rgba(0,0,0,0.8)' }}>
            <div className="w-full md:max-w-2xl rounded-t-2xl md:rounded-2xl overflow-y-auto" style={{ ...s.cardStyle, maxHeight: '92vh' }}>
              <div className="sticky top-0 px-6 py-4 flex items-center justify-between rounded-t-2xl" style={s.headerStyle}>
                <div>
                  {(() => {
                    const cli = getClienteData(ordenDetalle.cliente_id)
                    const nombreComercial = nombreComercialCliente(cli || ordenDetalle?.clientes)
                    const fiscal = getEtiquetaFiscal(cli || ordenDetalle?.clientes)
                    const poblacion = String(cli?.poblacion || '').trim()
                    return (
                      <>
                        <span className="font-mono text-sm" style={{ color: '#06b6d4' }}>{ordenDetalle.codigo}</span>
                        <h2 className="font-bold text-lg" style={{ color: 'var(--text)' }}>{nombreComercial || '—'}</h2>
                        {(fiscal || poblacion) && (
                          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                            {[fiscal, poblacion].filter(Boolean).join(' · ')}
                          </p>
                        )}
                      </>
                    )
                  })()}
                </div>
                <button onClick={() => setOrdenDetalle(null)} className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}>X</button>
              </div>
              <div className="p-6 pb-16">
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {[
                    { label: 'Estado', val: <span className="text-xs px-2 py-1 rounded-full" style={{ background: ESTADO_COLORS[ordenDetalle.estado]?.bg, color: ESTADO_COLORS[ordenDetalle.estado]?.color }}>{ordenDetalle.estado.replace('_', ' ')}</span> },
                    { label: 'Grado de intervencion', val: <span className="text-sm font-medium" style={{ color: PRIORIDAD_COLORS[normalizarGradoIntervencion(ordenDetalle.prioridad)] }}>{textoGradoIntervencion(ordenDetalle.prioridad)}</span> },
                    { label: 'Tipo', val: <span className="text-sm capitalize" style={{ color: 'var(--text)' }}>{ordenDetalle.tipo}</span> },
                    { label: 'Fecha', val: <span className="text-sm" style={{ color: 'var(--text)' }}>{ordenDetalle.fecha_programada ? new Date(ordenDetalle.fecha_programada).toLocaleDateString('es-ES') : '—'}</span> },
                    { label: 'Vehiculo', val: <span className="text-sm" style={{ color: 'var(--text)' }}>{getNombreVehiculo(ordenDetalle.vehiculo_id)}</span> },
                    { label: 'Conductor', val: <span className="text-sm" style={{ color: 'var(--text)' }}>{getNombreTecnico(ordenDetalle.tecnico_vehiculo_id)}</span> },
                    { label: 'Duracion', val: <span className="text-sm" style={{ color: 'var(--text)' }}>{ordenDetalle.duracion_horas || 2}h</span> },
                    { label: 'Hora fija', val: <span className="text-sm font-medium" style={{ color: ordenDetalle.hora_fija ? '#f59e0b' : 'var(--text-muted)' }}>{ordenDetalle.hora_fija ? 'Si' : 'No'}</span> },
                  ].map((item, i) => (
                    <div key={i} className="rounded-xl p-3" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                      <p className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>{item.label}</p>
                      {item.val}
                    </div>
                  ))}
                </div>

                <div className="rounded-xl p-3 mb-4" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                  <p className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Trabajadores</p>
                  <p className="text-sm" style={{ color: 'var(--text)' }}>{getNombresTecnicos(ordenDetalle.tecnicos_ids || [])}</p>
                </div>

                {ordenDetalle.descripcion && (
                  <div className="rounded-xl p-3 mb-4" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                    <p className="text-xs uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Trabajos a realizar</p>
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--text)' }}>{ordenDetalle.descripcion}</p>
                  </div>
                )}

                {ordenDetalle.observaciones && (
                  <div className="rounded-xl p-3 mb-4" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                    <p className="text-xs uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Observaciones</p>
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--text)' }}>{ordenDetalle.observaciones}</p>
                  </div>
                )}

                <div className="rounded-2xl p-4 mb-4" style={{ background: 'rgba(6,182,212,0.05)', border: '1px solid rgba(6,182,212,0.2)' }}>
                  <p className="font-medium text-sm mb-1" style={{ color: '#06b6d4' }}>Inventario en OT</p>
                  <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
                    Puedes registrar material/equipo por QR o cargar material manualmente en esta OT.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <button onClick={() => router.push(`/escanear?orden=${ordenDetalle.id}`)}
                      disabled={!puedeGestionar(ordenDetalle)}
                      className="w-full py-2.5 rounded-xl text-sm font-medium disabled:opacity-50"
                      style={{ background: 'linear-gradient(135deg, #059669, #06b6d4)', color: 'white' }}>
                      Abrir escaner QR
                    </button>

                    <div className="rounded-xl p-3" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                      <p className="text-xs uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Alta manual de material</p>
                      <select
                        value={materialManualId}
                        onChange={(e) => setMaterialManualId(e.target.value)}
                        className="w-full rounded-lg px-2 py-2 text-sm mb-2 outline-none"
                        style={s.inputStyle}
                        disabled={!puedeGestionar(ordenDetalle) || guardandoManual}
                      >
                        <option value="">Selecciona material...</option>
                        {materialesDisponibles.map((mat: any) => (
                          <option key={mat.id} value={mat.id}>
                            {mat.nombre} ({mat.stock || 0} {mat.unidad || 'uds'})
                          </option>
                        ))}
                      </select>
                      <div className="flex gap-2 mb-2">
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={cantidadManual}
                          onChange={(e) => setCantidadManual(e.target.value)}
                          className="w-28 rounded-lg px-2 py-2 text-sm outline-none"
                          style={s.inputStyle}
                          placeholder="Cantidad"
                          disabled={!puedeGestionar(ordenDetalle) || guardandoManual}
                        />
                        <input
                          value={notaManual}
                          onChange={(e) => setNotaManual(e.target.value)}
                          className="flex-1 rounded-lg px-2 py-2 text-sm outline-none"
                          style={s.inputStyle}
                          placeholder="Nota (opcional)"
                          disabled={!puedeGestionar(ordenDetalle) || guardandoManual}
                        />
                      </div>
                      <button
                        onClick={registrarConsumoManual}
                        disabled={!puedeGestionar(ordenDetalle) || guardandoManual || !materialManualId}
                        className="w-full py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                        style={s.btnPrimary}
                      >
                        {guardandoManual ? 'Guardando...' : 'Registrar material manual'}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mb-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold" style={{ color: 'var(--text)' }}>Movimientos de inventario</h3>
                    <button
                      onClick={() => recargarDetalleOrden(ordenDetalle.id)}
                      className="text-xs px-3 py-1 rounded-lg"
                      style={{ background: 'var(--bg)', color: '#06b6d4', border: '1px solid var(--border)' }}
                    >
                      Actualizar
                    </button>
                  </div>
                  {(!ordenDetalle.movimientos || ordenDetalle.movimientos.length === 0) ? (
                    <div className="rounded-xl p-3" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                      <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>Sin movimientos vinculados a esta OT.</p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {ordenDetalle.movimientos.map((mov: any) => (
                        <div key={mov.id} className="rounded-xl p-3" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                          <div className="flex items-start justify-between gap-3 flex-wrap">
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: mov.tipo === 'consumo' ? '#fb923c' : '#fbbf24' }}>
                                {mov.tipo === 'consumo' ? 'Consumo material' : mov.tipo === 'salida' ? 'Salida equipo' : mov.tipo}
                              </p>
                              {mov.materiales && (
                                <p className="text-sm" style={{ color: 'var(--text)' }}>
                                  {mov.materiales.nombre} - {mov.cantidad || 0} {mov.materiales.unidad || 'uds'}
                                </p>
                              )}
                              {mov.equipos && (
                                <p className="text-sm" style={{ color: 'var(--text)' }}>
                                  {mov.equipos.codigo} - {mov.equipos.tipo}
                                </p>
                              )}
                              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                                {mov.perfiles?.nombre || 'Sin tecnico'} {mov.fecha ? `- ${new Date(mov.fecha).toLocaleString('es-ES')}` : ''}
                              </p>
                              {mov.observaciones && (
                                <p className="text-xs mt-1" style={{ color: 'var(--text-subtle)' }}>{mov.observaciones}</p>
                              )}
                            </div>
                            {puedeGestionar(ordenDetalle) && (
                              <button
                                onClick={() => eliminarMovimiento(mov)}
                                disabled={movimientoEliminandoId === mov.id}
                                className="text-xs px-3 py-1 rounded-lg"
                                style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}
                              >
                                {movimientoEliminandoId === mov.id ? 'Eliminando...' : 'Eliminar'}
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mb-4">
                  <h3 className="font-semibold mb-3" style={{ color: 'var(--text)' }}>Fotos</h3>
                  {subiendo && <p className="text-sm mb-3" style={{ color: '#06b6d4' }}>Subiendo foto...</p>}
                  {TIPOS_FOTO.map(tf => {
                    const fotosDelTipo = (ordenDetalle.fotos || []).filter((f: any) => f.tipo === tf.key)
                    return (
                      <div key={tf.key} className="mb-4">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{tf.label}</p>
                          {puedeGestionar(ordenDetalle) && (
                            <label className="text-xs px-3 py-1 rounded-lg cursor-pointer" style={{ background: 'var(--bg)', color: '#06b6d4', border: '1px solid var(--border)' }}>
                              + Foto
                              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => subirFoto(e, tf.key)} />
                            </label>
                          )}
                        </div>
                        {fotosDelTipo.length > 0 ? (
                          <div className="grid grid-cols-3 gap-2">
                            {fotosDelTipo.map((f: any) => (
                              <div key={f.id} className="relative">
                                <a href={f.url} target="_blank" rel="noreferrer">
                                  <img src={f.url} alt="foto" className="w-full h-24 object-cover rounded-xl" style={{ border: '1px solid var(--border)' }} />
                                </a>
                                {puedeGestionar(ordenDetalle) && (
                                  <button onClick={() => eliminarFoto(f)}
                                    className="absolute top-1 right-1 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                                    style={{ background: 'rgba(239,68,68,0.9)', color: 'white' }}>
                                    X
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>Sin fotos</p>
                        )}
                      </div>
                    )
                  })}
                </div>

                <div className="flex gap-3 flex-wrap pt-4" style={{ borderTop: '1px solid var(--border)' }}>
                  {ordenDetalle.estado === 'pendiente' && puedeGestionar(ordenDetalle) && (
                    <button onClick={() => cambiarEstado(ordenDetalle.id, 'en_curso')}
                      className="text-sm px-4 py-2 rounded-xl font-medium"
                      style={{ background: 'rgba(234,179,8,0.15)', color: '#fbbf24', border: '1px solid rgba(234,179,8,0.3)' }}>
                      Iniciar trabajo
                    </button>
                  )}
                  {ordenDetalle.estado === 'en_curso' && puedeGestionar(ordenDetalle) && (
                    <button onClick={() => cambiarEstado(ordenDetalle.id, 'completada')}
                      className="text-sm px-4 py-2 rounded-xl font-medium"
                      style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399', border: '1px solid rgba(16,185,129,0.3)' }}>
                      Completar
                    </button>
                  )}
                  {puedeCrearEditar && (
                    <button onClick={() => abrirFormEditar(ordenDetalle)}
                      className="text-sm px-4 py-2 rounded-xl"
                      style={{ background: 'rgba(124,58,237,0.15)', color: '#a78bfa', border: '1px solid rgba(124,58,237,0.3)' }}>
                      Editar OT
                    </button>
                  )}
                  {puedeEliminar && (
                    <button onClick={() => { setOrdenDetalle(null); setTimeout(() => pedirEliminarOrden(ordenDetalle), 100) }}
                      className="text-sm px-4 py-2 rounded-xl"
                      style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
                      Eliminar
                    </button>
                  )}
                  <button onClick={() => setOrdenDetalle(null)}
                    className="text-sm px-4 py-2 rounded-xl ml-auto" style={s.btnSecondary}>
                    Cerrar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#7c3aed', borderTopColor: 'transparent' }}></div>
          </div>
        ) : ordenesFiltradas.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-5xl mb-4">📋</p>
            <p style={{ color: 'var(--text-muted)' }}>No hay ordenes. Crea la primera.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {ordenesFiltradas.map(o => (
              <div key={o.id} onClick={() => abrirDetalle(o)}
                className="rounded-2xl p-5 cursor-pointer transition-all" style={s.cardStyle}
                onMouseEnter={e => e.currentTarget.style.borderColor = '#7c3aed'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
                <div className="flex items-start justify-between flex-wrap gap-3">
                  <div>
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <span className="font-mono text-sm" style={{ color: '#06b6d4' }}>{o.codigo}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: ESTADO_COLORS[o.estado]?.bg, color: ESTADO_COLORS[o.estado]?.color }}>
                        {o.estado.replace('_', ' ')}
                      </span>
                      <span className="text-xs font-medium" style={{ color: PRIORIDAD_COLORS[normalizarGradoIntervencion(o.prioridad)] }}>{textoGradoIntervencion(o.prioridad)}</span>
                      {o.hora_fija && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>Hora fija</span>}
                    </div>
                    {(() => {
                      const cli = getClienteData(o.cliente_id)
                      const nombreComercial = nombreComercialCliente(cli || o?.clientes)
                      const fiscal = getEtiquetaFiscal(cli || o?.clientes)
                      const poblacion = String(cli?.poblacion || '').trim()
                      return (
                        <>
                          <p className="font-medium" style={{ color: 'var(--text)' }}>{nombreComercial || '—'}</p>
                          {(fiscal || poblacion) && (
                            <p className="text-xs mt-0.5" style={{ color: 'var(--text-subtle)' }}>
                              {[fiscal, poblacion].filter(Boolean).join(' · ')}
                            </p>
                          )}
                        </>
                      )
                    })()}
                    <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{(o.descripcion || '').substring(0, 100)}{(o.descripcion || '').length > 100 ? '...' : ''}</p>
                    <div className="flex gap-4 mt-2 text-xs flex-wrap" style={{ color: 'var(--text-subtle)' }}>
                      <span>Trabajadores: {getNombresTecnicos(o.tecnicos_ids || [])}</span>
                      <span>Vehiculo: {getNombreVehiculo(o.vehiculo_id)}</span>
                      <span>Duracion: {o.duracion_horas || 2}h</span>
                      <span>Fecha: {o.fecha_programada ? new Date(o.fecha_programada).toLocaleDateString('es-ES') : '—'}</span>
                    </div>
                  </div>
                  <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>Ver detalle →</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
