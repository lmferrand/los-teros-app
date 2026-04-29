'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { s } from '@/lib/styles'
import AppHeader from '@/app/components/AppHeader'

type RolFirma = 'empleado' | 'cliente'

function hoyISO() {
  return new Date().toISOString().slice(0, 10)
}

function fechaSoloDia(valor: string | null | undefined) {
  if (!valor) return hoyISO()
  const dt = new Date(valor)
  if (Number.isNaN(dt.getTime())) return hoyISO()
  return dt.toISOString().slice(0, 10)
}

function nombreClientePrincipal(cliente: any) {
  return String(cliente?.nombre_comercial || cliente?.nombre || '').trim()
}

function nombreClienteFiscal(cliente: any) {
  return String(cliente?.nombre_fiscal || cliente?.nombre || '').trim()
}

function cifCliente(cliente: any) {
  return String(cliente?.cif || '').trim()
}

function direccionCliente(cliente: any) {
  return String(cliente?.direccion || '').trim()
}

function poblacionCliente(cliente: any) {
  return String(cliente?.poblacion || '').trim()
}

function telefonoCliente(cliente: any) {
  return String(cliente?.telefono || cliente?.movil || '').trim()
}

function emailCliente(cliente: any) {
  return String(cliente?.email || '').trim()
}

function textoSeguro(v: unknown) {
  return String(v || '').trim()
}

function esErrorColumnasAlbaran(error: any) {
  const code = String(error?.code || '')
  const msg = String(error?.message || '').toLowerCase()
  return (
    code === '42703' ||
    code === 'PGRST204' ||
    msg.includes('razon_social') ||
    msg.includes('firma_cliente_url') ||
    msg.includes('firma_empleado_url')
  )
}

function esTablaServiciosNoDisponible(error: any) {
  const txt = String(error?.message || '').toLowerCase()
  return txt.includes('servicios_clientes') && (txt.includes('does not exist') || txt.includes('relation'))
}

export default function Albaranes() {
  const [albaranes, setAlbaranes] = useState<any[]>([])
  const [clientes, setClientes] = useState<any[]>([])
  const [ordenes, setOrdenes] = useState<any[]>([])
  const [tecnicos, setTecnicos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [detalleId, setDetalleId] = useState<string | null>(null)
  const [subiendo, setSubiendo] = useState(false)
  const [autorrellenando, setAutorrellenando] = useState(false)
  const [guardandoFirmaRol, setGuardandoFirmaRol] = useState<RolFirma | null>(null)
  const [rolFirmaModal, setRolFirmaModal] = useState<RolFirma | null>(null)
  const [albaranFirmaId, setAlbaranFirmaId] = useState<string | null>(null)
  const router = useRouter()
  const canvasFirmaRef = useRef<HTMLCanvasElement | null>(null)
  const dibujandoFirmaRef = useRef(false)
  const ultimoPuntoRef = useRef<{ x: number; y: number } | null>(null)
  const urlPrefillProcesadaRef = useRef<string | null>(null)

  const [clienteId, setClienteId] = useState('')
  const [ordenId, setOrdenId] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [estado, setEstado] = useState('pendiente')
  const [fecha, setFecha] = useState(hoyISO())
  const [observaciones, setObservaciones] = useState('')
  const [razonSocial, setRazonSocial] = useState('')
  const [cif, setCif] = useState('')
  const [domicilio, setDomicilio] = useState('')
  const [localidad, setLocalidad] = useState('')
  const [provincia, setProvincia] = useState('')
  const [telefono, setTelefono] = useState('')
  const [email, setEmail] = useState('')
  const [responsable, setResponsable] = useState('')
  const [instalacion, setInstalacion] = useState('')
  const [firmaEmpleadoUrl, setFirmaEmpleadoUrl] = useState('')
  const [firmaClienteUrl, setFirmaClienteUrl] = useState('')
  const [firmadoEmpleadoAt, setFirmadoEmpleadoAt] = useState<string | null>(null)
  const [firmadoClienteAt, setFirmadoClienteAt] = useState<string | null>(null)

  const verificarSesion = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) router.push('/login')
  }, [router])

  const cargarDatos = useCallback(async () => {
    const [albs, clis, ords, tecs] = await Promise.all([
      supabase
        .from('albaranes')
        .select('*, clientes(*), ordenes(id,codigo,estado,descripcion,fecha_programada,tecnicos_ids)')
        .order('created_at', { ascending: false }),
      supabase.from('clientes').select('*').order('nombre'),
      supabase
        .from('ordenes')
        .select('id,codigo,cliente_id,descripcion,fecha_programada,tecnicos_ids,clientes(*)')
        .order('created_at', { ascending: false }),
      supabase.from('perfiles').select('id,nombre').order('nombre'),
    ])
    if (albs.data) setAlbaranes(albs.data)
    if (clis.data) setClientes(clis.data)
    if (ords.data) setOrdenes(ords.data)
    if (tecs.data) setTecnicos(tecs.data)
    setLoading(false)
  }, [])

  useEffect(() => {
    void verificarSesion()
    void cargarDatos()
  }, [verificarSesion, cargarDatos])

  function resetFormulario() {
    setClienteId('')
    setOrdenId('')
    setDescripcion('')
    setEstado('pendiente')
    setFecha(hoyISO())
    setObservaciones('')
    setRazonSocial('')
    setCif('')
    setDomicilio('')
    setLocalidad('')
    setProvincia('')
    setTelefono('')
    setEmail('')
    setResponsable('')
    setInstalacion('')
    setFirmaEmpleadoUrl('')
    setFirmaClienteUrl('')
    setFirmadoEmpleadoAt(null)
    setFirmadoClienteAt(null)
  }

  function abrirFormNuevo(ordenPrefillId?: string) {
    setEditandoId(null)
    resetFormulario()
    setMostrarForm(true)
    if (ordenPrefillId) {
      void rellenarDesdeOrden(ordenPrefillId)
    }
  }

  function abrirFormEditar(a: any) {
    setEditandoId(a.id)
    setClienteId(a.cliente_id || '')
    setOrdenId(a.orden_id || '')
    setDescripcion(a.descripcion || '')
    setEstado(a.estado || 'pendiente')
    setFecha(a.fecha || hoyISO())
    setObservaciones(a.observaciones || '')
    setRazonSocial(a.razon_social || '')
    setCif(a.cif || '')
    setDomicilio(a.domicilio || '')
    setLocalidad(a.localidad || '')
    setProvincia(a.provincia || '')
    setTelefono(a.telefono || '')
    setEmail(a.email || '')
    setResponsable(a.responsable || '')
    setInstalacion(a.instalacion || '')
    setFirmaEmpleadoUrl(a.firma_empleado_url || '')
    setFirmaClienteUrl(a.firma_cliente_url || '')
    setFirmadoEmpleadoAt(a.firmado_empleado_at || null)
    setFirmadoClienteAt(a.firmado_cliente_at || null)
    setMostrarForm(true)
    setDetalleId(null)
  }

  async function generarNumero() {
    const { count } = await supabase.from('albaranes').select('*', { count: 'exact', head: true })
    const num = String((count || 0) + 1).padStart(4, '0')
    return `ALB-${new Date().getFullYear()}-${num}`
  }

  function tecnicoNombre(id: string | null | undefined) {
    if (!id) return ''
    return tecnicos.find((t: any) => t.id === id)?.nombre || ''
  }

  function nombresTecnicos(ids: string[] | null | undefined) {
    if (!Array.isArray(ids) || ids.length === 0) return ''
    return ids
      .map((id) => tecnicoNombre(id))
      .filter(Boolean)
      .join(', ')
  }

  async function obtenerOrdenCompleta(id: string) {
    const { data, error } = await (supabase.from('ordenes') as any)
      .select('id,codigo,cliente_id,descripcion,fecha_programada,tecnicos_ids,tecnico_id,clientes(*)')
      .eq('id', id)
      .single()
    if (error || !data) return null
    return data
  }

  async function rellenarDesdeOrden(id: string) {
    if (!id) {
      alert('Selecciona una OT primero.')
      return
    }
    setAutorrellenando(true)
    try {
      const ord = await obtenerOrdenCompleta(id)
      if (!ord) {
        alert('No se pudo cargar la OT para rellenar el albaran.')
        return
      }

      const cli = ord.clientes || {}
      const responsableOt =
        nombresTecnicos(ord.tecnicos_ids) ||
        tecnicoNombre(ord.tecnico_id) ||
        textoSeguro(responsable)

      setOrdenId(ord.id || id)
      setClienteId(ord.cliente_id || '')
      setFecha(fechaSoloDia(ord.fecha_programada))
      setDescripcion(textoSeguro(ord.descripcion) || textoSeguro(descripcion))
      setRazonSocial(nombreClienteFiscal(cli))
      setCif(cifCliente(cli))
      setDomicilio(direccionCliente(cli))
      setLocalidad(poblacionCliente(cli))
      setTelefono(telefonoCliente(cli))
      setEmail(emailCliente(cli))
      setResponsable(responsableOt)
      setInstalacion(nombreClientePrincipal(cli))
    } finally {
      setAutorrellenando(false)
    }
  }

  async function abrirRellenadoDesdeOt(ordenDestinoId: string) {
    if (!ordenDestinoId) return
    const existente = albaranes.find((a) => a.orden_id === ordenDestinoId)
    if (existente) {
      abrirFormEditar(existente)
      return
    }
    abrirFormNuevo(ordenDestinoId)
  }

  useEffect(() => {
    if (loading) return
    if (typeof window === 'undefined') return
    const url = new URL(window.location.href)
    const ordenParam = url.searchParams.get('orden')
    if (!ordenParam) return
    if (urlPrefillProcesadaRef.current === ordenParam) return
    urlPrefillProcesadaRef.current = ordenParam
    void abrirRellenadoDesdeOt(ordenParam)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, albaranes])

  async function guardarAlbaran(e: React.FormEvent) {
    e.preventDefault()
    const datos = {
      cliente_id: clienteId || null,
      orden_id: ordenId || null,
      descripcion,
      estado,
      fecha,
      observaciones,
      razon_social: razonSocial || null,
      cif: cif || null,
      domicilio: domicilio || null,
      localidad: localidad || null,
      provincia: provincia || null,
      telefono: telefono || null,
      email: email || null,
      responsable: responsable || null,
      instalacion: instalacion || null,
      firma_empleado_url: firmaEmpleadoUrl || null,
      firma_cliente_url: firmaClienteUrl || null,
      firmado_empleado_at: firmadoEmpleadoAt || null,
      firmado_cliente_at: firmadoClienteAt || null,
      firmado: Boolean(firmaClienteUrl),
    }

    if (editandoId) {
      const { error } = await (supabase.from('albaranes') as any).update(datos).eq('id', editandoId)
      if (error) {
        if (esErrorColumnasAlbaran(error)) {
          alert('Faltan columnas nuevas de albaranes en Supabase. Ejecuta la migración 20260429_albaranes_formulario_firmas.sql')
          return
        }
        alert('No se pudo guardar el albaran: ' + error.message)
        return
      }
    } else {
      const numero = await generarNumero()
      const { error } = await (supabase.from('albaranes') as any).insert({ ...datos, numero, fotos_urls: [] })
      if (error) {
        if (esErrorColumnasAlbaran(error)) {
          alert('Faltan columnas nuevas de albaranes en Supabase. Ejecuta la migración 20260429_albaranes_formulario_firmas.sql')
          return
        }
        alert('No se pudo crear el albaran: ' + error.message)
        return
      }
    }
    setMostrarForm(false)
    setEditandoId(null)
    await cargarDatos()
  }

  async function subirFoto(e: React.ChangeEvent<HTMLInputElement>, albaranId: string) {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    setSubiendo(true)
    try {
      const alb = albaranes.find((a) => a.id === albaranId)
      const fotosActuales = Array.isArray(alb?.fotos_urls) ? alb.fotos_urls : []
      const nuevas: string[] = []
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const nombreArchivo = `${albaranId}/${Date.now()}_${i}_${file.name}`
        const { data, error } = await supabase.storage.from('fotos-albaranes').upload(nombreArchivo, file)
        if (error || !data) continue
        const { data: urlData } = supabase.storage.from('fotos-albaranes').getPublicUrl(nombreArchivo)
        nuevas.push(urlData.publicUrl)
      }
      if (nuevas.length > 0) {
        await (supabase.from('albaranes') as any)
          .update({ fotos_urls: [...fotosActuales, ...nuevas] })
          .eq('id', albaranId)
      }
      await cargarDatos()
    } finally {
      setSubiendo(false)
      e.target.value = ''
    }
  }

  async function cambiarEstado(id: string, nuevoEstado: string) {
    await (supabase.from('albaranes') as any).update({ estado: nuevoEstado }).eq('id', id)
    await cargarDatos()
  }

  async function cerrarOtPorFirmaCliente(ordenAsociadaId: string | null | undefined) {
    if (!ordenAsociadaId) return
    await (supabase.from('ordenes') as any)
      .update({ estado: 'completada', fecha_cierre: new Date().toISOString() })
      .eq('id', ordenAsociadaId)
    await sincronizarServicioHistorialDesdeOt(ordenAsociadaId)
  }

  async function sincronizarServicioHistorialDesdeOt(ordenAsociadaId: string) {
    const numeroDocumento = `OT:${ordenAsociadaId}`
    const { data: existentes, error: errorExiste } = await supabase
      .from('servicios_clientes')
      .select('id')
      .eq('origen', 'ot_completada')
      .eq('numero_documento', numeroDocumento)
      .limit(1)

    if (errorExiste) {
      if (!esTablaServiciosNoDisponible(errorExiste)) {
        console.warn('No se pudo validar historial de servicios al firmar albaran:', errorExiste.message)
      }
      return
    }
    if ((existentes || []).length > 0) return

    const { data: orden, error: errorOrden } = await supabase
      .from('ordenes')
      .select('id,codigo,cliente_id,descripcion,fecha_cierre,fecha_programada,created_at')
      .eq('id', ordenAsociadaId)
      .single()
    if (errorOrden || !orden?.cliente_id) return

    const fechaBase = orden.fecha_cierre || orden.fecha_programada || orden.created_at || new Date().toISOString()
    const fechaObj = new Date(fechaBase)
    const fechaServicio = Number.isNaN(fechaObj.getTime())
      ? new Date().toISOString().slice(0, 10)
      : fechaObj.toISOString().slice(0, 10)

    const {
      data: { session },
    } = await supabase.auth.getSession()

    const { error: errorInsert } = await supabase.from('servicios_clientes').insert({
      cliente_id: orden.cliente_id,
      fecha_servicio: fechaServicio,
      origen: 'ot_completada',
      numero_documento: numeroDocumento,
      descripcion: orden.descripcion || `Servicio OT ${orden.codigo || ordenAsociadaId}`,
      importe: null,
      created_by: session?.user?.id || null,
      metadata: {
        orden_id: orden.id,
        codigo_ot: orden.codigo || null,
      },
    })
    if (errorInsert && !esTablaServiciosNoDisponible(errorInsert)) {
      console.warn('No se pudo registrar historial de servicio al firmar albaran:', errorInsert.message)
    }
  }

  function limpiarCanvasFirma() {
    const canvas = canvasFirmaRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineWidth = 2
    ctx.strokeStyle = '#0f172a'
  }

  function obtenerPosCanvas(ev: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasFirmaRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    const x = ((ev.clientX - rect.left) / rect.width) * canvas.width
    const y = ((ev.clientY - rect.top) / rect.height) * canvas.height
    return { x, y }
  }

  function iniciarDibujoFirma(ev: React.PointerEvent<HTMLCanvasElement>) {
    ev.preventDefault()
    const p = obtenerPosCanvas(ev)
    if (!p) return
    dibujandoFirmaRef.current = true
    ultimoPuntoRef.current = p
  }

  function moverDibujoFirma(ev: React.PointerEvent<HTMLCanvasElement>) {
    ev.preventDefault()
    if (!dibujandoFirmaRef.current) return
    const canvas = canvasFirmaRef.current
    const ctx = canvas?.getContext('2d')
    const p = obtenerPosCanvas(ev)
    if (!ctx || !p || !ultimoPuntoRef.current) return
    ctx.beginPath()
    ctx.moveTo(ultimoPuntoRef.current.x, ultimoPuntoRef.current.y)
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
    ultimoPuntoRef.current = p
  }

  function finalizarDibujoFirma(ev?: React.PointerEvent<HTMLCanvasElement>) {
    if (ev) ev.preventDefault()
    dibujandoFirmaRef.current = false
    ultimoPuntoRef.current = null
  }

  function abrirModalFirma(rol: RolFirma, albaranId: string) {
    setRolFirmaModal(rol)
    setAlbaranFirmaId(albaranId)
    requestAnimationFrame(() => {
      limpiarCanvasFirma()
    })
  }

  async function guardarFirmaDesdeCanvas() {
    if (!rolFirmaModal || !albaranFirmaId) return
    const canvas = canvasFirmaRef.current
    if (!canvas) return

    setGuardandoFirmaRol(rolFirmaModal)
    try {
      const dataUrl = canvas.toDataURL('image/png')
      const blob = await fetch(dataUrl).then((r) => r.blob())
      const path = `${albaranFirmaId}/firmas/${rolFirmaModal}_${Date.now()}.png`
      const { data, error } = await supabase.storage.from('fotos-albaranes').upload(path, blob, {
        contentType: 'image/png',
      })
      if (error || !data) {
        alert('No se pudo guardar la firma.')
        return
      }

      const { data: urlData } = supabase.storage.from('fotos-albaranes').getPublicUrl(path)
      const ahora = new Date().toISOString()
      const payload: any =
        rolFirmaModal === 'empleado'
          ? {
            firma_empleado_url: urlData.publicUrl,
            firmado_empleado_at: ahora,
          }
          : {
            firma_cliente_url: urlData.publicUrl,
            firmado_cliente_at: ahora,
            firmado: true,
            estado: 'firmado',
          }

      const { error: errUpdate } = await (supabase.from('albaranes') as any)
        .update(payload)
        .eq('id', albaranFirmaId)
      if (errUpdate) {
        if (esErrorColumnasAlbaran(errUpdate)) {
          alert('La base de datos aún no tiene campos de firma. Ejecuta la migración 20260429_albaranes_formulario_firmas.sql')
          return
        }
        alert('Firma guardada en Storage pero no se pudo registrar en el albaran.')
        return
      }

      if (rolFirmaModal === 'cliente') {
        const alb = albaranes.find((a) => a.id === albaranFirmaId)
        await cerrarOtPorFirmaCliente(alb?.orden_id)
      }

      setRolFirmaModal(null)
      setAlbaranFirmaId(null)
      await cargarDatos()
    } finally {
      setGuardandoFirmaRol(null)
    }
  }

  async function eliminarAlbaran(id: string) {
    if (!confirm('Eliminar este albaran?')) return
    await supabase.from('albaranes').delete().eq('id', id)
    await cargarDatos()
    setDetalleId(null)
  }

  const ESTADOS: Record<string, { color: string; bg: string; label: string }> = {
    pendiente: { color: '#fbbf24', bg: 'rgba(234,179,8,0.15)', label: 'Pendiente' },
    entregado: { color: '#06b6d4', bg: 'rgba(6,182,212,0.15)', label: 'Entregado' },
    firmado: { color: '#34d399', bg: 'rgba(16,185,129,0.15)', label: 'Firmado' },
    facturado: { color: '#34d399', bg: 'rgba(16,185,129,0.15)', label: 'Facturado' },
    cancelado: { color: '#64748b', bg: 'rgba(71,85,105,0.15)', label: 'Cancelado' },
  }

  const albDetalle = useMemo(
    () => (detalleId ? albaranes.find((a) => a.id === detalleId) : null),
    [detalleId, albaranes],
  )

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <AppHeader
        title="Albaranes"
        rightSlot={
          <button onClick={() => abrirFormNuevo()} className="text-sm px-4 py-2 rounded-xl font-medium" style={s.btnPrimary}>
            + Crear albaran
          </button>
        }
      />

      <div className="p-6 max-w-6xl mx-auto">
        {mostrarForm && (
          <div className="rounded-2xl p-6 mb-6" style={s.cardStyle}>
            <div className="flex items-center justify-between gap-2 flex-wrap mb-5">
              <h2 className="font-semibold" style={{ color: 'var(--text)' }}>
                {editandoId ? 'Editar albaran' : 'Crear albaran'}
              </h2>
              {ordenId && (
                <p className="text-xs" style={{ color: '#06b6d4' }}>
                  OT vinculada: {ordenes.find((o) => o.id === ordenId)?.codigo || ordenId}
                </p>
              )}
            </div>
            <form onSubmit={guardarAlbaran} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-muted)' }}>Orden de trabajo</label>
                <select
                  value={ordenId}
                  onChange={(e) => {
                    const id = e.target.value
                    setOrdenId(id)
                    if (!id) return
                    void rellenarDesdeOrden(id)
                  }}
                  className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                  style={s.inputStyle}
                >
                  <option value="">Sin OT asociada</option>
                  {ordenes.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.codigo} - {nombreClientePrincipal(o.clientes) || o.clientes?.nombre || 'Sin cliente'}
                    </option>
                  ))}
                </select>
                {autorrellenando && (
                  <p className="text-xs mt-2" style={{ color: '#06b6d4' }}>
                    Rellenando datos de la OT...
                  </p>
                )}
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-muted)' }}>Cliente</label>
                <select value={clienteId} onChange={(e) => setClienteId(e.target.value)} className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={s.inputStyle}>
                  <option value="">Seleccionar cliente...</option>
                  {clientes.map((c) => <option key={c.id} value={c.id}>{nombreClientePrincipal(c) || c.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-muted)' }}>Fecha</label>
                <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={s.inputStyle} />
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-muted)' }}>Estado</label>
                <select value={estado} onChange={(e) => setEstado(e.target.value)} className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={s.inputStyle}>
                  <option value="pendiente">Pendiente</option>
                  <option value="entregado">Entregado</option>
                  <option value="firmado">Firmado</option>
                  <option value="facturado">Facturado</option>
                  <option value="cancelado">Cancelado</option>
                </select>
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-muted)' }}>Razon social</label>
                <input value={razonSocial} onChange={(e) => setRazonSocial(e.target.value)} className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={s.inputStyle} />
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-muted)' }}>CIF</label>
                <input value={cif} onChange={(e) => setCif(e.target.value)} className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={s.inputStyle} />
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-muted)' }}>Domicilio</label>
                <input value={domicilio} onChange={(e) => setDomicilio(e.target.value)} className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={s.inputStyle} />
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-muted)' }}>Localidad</label>
                <input value={localidad} onChange={(e) => setLocalidad(e.target.value)} className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={s.inputStyle} />
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-muted)' }}>Provincia</label>
                <input value={provincia} onChange={(e) => setProvincia(e.target.value)} className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={s.inputStyle} />
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-muted)' }}>Telefono</label>
                <input value={telefono} onChange={(e) => setTelefono(e.target.value)} className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={s.inputStyle} />
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-muted)' }}>Email</label>
                <input value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={s.inputStyle} />
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-muted)' }}>Responsable</label>
                <input value={responsable} onChange={(e) => setResponsable(e.target.value)} className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={s.inputStyle} />
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-muted)' }}>Instalación a tratar</label>
                <input value={instalacion} onChange={(e) => setInstalacion(e.target.value)} className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={s.inputStyle} />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-muted)' }}>Descripción del trabajo</label>
                <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} required rows={4}
                  className="w-full rounded-xl px-3 py-2 text-sm outline-none resize-none"
                  style={s.inputStyle}
                  placeholder="Descripción del trabajo realizado..." />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-muted)' }}>Observaciones / recomendaciones</label>
                <textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)} rows={3}
                  className="w-full rounded-xl px-3 py-2 text-sm outline-none resize-none" style={s.inputStyle} />
              </div>
              <div className="md:col-span-2 flex gap-3">
                <button type="submit" className="px-5 py-2 rounded-xl text-sm font-medium" style={s.btnPrimary}>
                  {editandoId ? 'Guardar cambios' : 'Crear albaran'}
                </button>
                <button type="button" onClick={() => { setMostrarForm(false); setEditandoId(null) }}
                  className="text-sm px-5 py-2 rounded-xl" style={s.btnSecondary}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        )}

        {albDetalle && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.85)' }}>
            <div className="w-full max-w-4xl max-h-screen overflow-y-auto rounded-2xl" style={s.cardStyle}>
              <div className="sticky top-0 px-6 py-4 flex items-center justify-between rounded-t-2xl" style={s.headerStyle}>
                <div>
                  <span className="font-mono text-sm" style={{ color: '#06b6d4' }}>{albDetalle.numero}</span>
                  <h2 className="font-bold text-lg" style={{ color: 'var(--text)' }}>
                    {nombreClientePrincipal(albDetalle.clientes) || albDetalle.clientes?.nombre || '-'}
                  </h2>
                  {albDetalle.ordenes?.codigo && (
                    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                      OT: {albDetalle.ordenes.codigo}
                    </p>
                  )}
                </div>
                <button onClick={() => setDetalleId(null)} className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}>X</button>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                  {[
                    { label: 'Estado', val: <span className="text-xs px-2 py-1 rounded-full" style={{ background: ESTADOS[albDetalle.estado]?.bg, color: ESTADOS[albDetalle.estado]?.color }}>{ESTADOS[albDetalle.estado]?.label}</span> },
                    { label: 'Fecha', val: <span className="text-sm" style={{ color: 'var(--text)' }}>{albDetalle.fecha ? new Date(albDetalle.fecha).toLocaleDateString('es-ES') : '-'}</span> },
                    { label: 'Razon social', val: <span className="text-sm" style={{ color: 'var(--text)' }}>{albDetalle.razon_social || nombreClienteFiscal(albDetalle.clientes) || '-'}</span> },
                    { label: 'CIF', val: <span className="text-sm" style={{ color: 'var(--text)' }}>{albDetalle.cif || cifCliente(albDetalle.clientes) || '-'}</span> },
                    { label: 'Domicilio', val: <span className="text-sm" style={{ color: 'var(--text)' }}>{albDetalle.domicilio || direccionCliente(albDetalle.clientes) || '-'}</span> },
                    { label: 'Localidad', val: <span className="text-sm" style={{ color: 'var(--text)' }}>{albDetalle.localidad || poblacionCliente(albDetalle.clientes) || '-'}</span> },
                    { label: 'Provincia', val: <span className="text-sm" style={{ color: 'var(--text)' }}>{albDetalle.provincia || '-'}</span> },
                    { label: 'Telefono', val: <span className="text-sm" style={{ color: 'var(--text)' }}>{albDetalle.telefono || telefonoCliente(albDetalle.clientes) || '-'}</span> },
                    { label: 'Email', val: <span className="text-sm" style={{ color: 'var(--text)' }}>{albDetalle.email || emailCliente(albDetalle.clientes) || '-'}</span> },
                    { label: 'Responsable', val: <span className="text-sm" style={{ color: 'var(--text)' }}>{albDetalle.responsable || nombresTecnicos(albDetalle.ordenes?.tecnicos_ids) || '-'}</span> },
                    { label: 'Instalación', val: <span className="text-sm" style={{ color: 'var(--text)' }}>{albDetalle.instalacion || nombreClientePrincipal(albDetalle.clientes) || '-'}</span> },
                    {
                      label: 'Firmas',
                      val: (
                        <div className="flex flex-wrap gap-2">
                          <span className="text-xs px-2 py-1 rounded-full" style={{ background: albDetalle.firma_empleado_url ? 'rgba(16,185,129,0.15)' : 'rgba(71,85,105,0.15)', color: albDetalle.firma_empleado_url ? '#34d399' : '#94a3b8' }}>
                            Empleado {albDetalle.firma_empleado_url ? 'firmado' : 'pendiente'}
                          </span>
                          <span className="text-xs px-2 py-1 rounded-full" style={{ background: albDetalle.firma_cliente_url ? 'rgba(16,185,129,0.15)' : 'rgba(71,85,105,0.15)', color: albDetalle.firma_cliente_url ? '#34d399' : '#94a3b8' }}>
                            Cliente {albDetalle.firma_cliente_url ? 'firmado' : 'pendiente'}
                          </span>
                        </div>
                      ),
                    },
                  ].map((item, i) => (
                    <div key={i} className="rounded-xl p-3" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                      <p className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>{item.label}</p>
                      {item.val}
                    </div>
                  ))}
                </div>

                <div className="rounded-xl p-3 mb-4" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                  <p className="text-xs uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Descripción del trabajo</p>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text)' }}>
                    {albDetalle.descripcion || albDetalle.ordenes?.descripcion || '-'}
                  </p>
                </div>

                <div className="rounded-xl p-3 mb-4" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                  <p className="text-xs uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Observaciones / recomendaciones</p>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text)' }}>
                    {albDetalle.observaciones || '-'}
                  </p>
                </div>

                <div className="mb-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold" style={{ color: 'var(--text)' }}>Fotos del albaran</h3>
                    <label className="text-xs px-3 py-1.5 rounded-xl cursor-pointer"
                      style={{ background: 'rgba(124,58,237,0.15)', color: '#a78bfa', border: '1px solid rgba(124,58,237,0.3)' }}>
                      {subiendo ? 'Subiendo...' : '+ Subir fotos'}
                      <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => subirFoto(e, albDetalle.id)} disabled={subiendo} />
                    </label>
                  </div>
                  {(albDetalle.fotos_urls || []).length === 0 ? (
                    <p className="text-sm" style={{ color: 'var(--text-subtle)' }}>Sin fotos todavia.</p>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {(albDetalle.fotos_urls || []).map((url: string, i: number) => (
                        <a key={i} href={url} target="_blank" rel="noreferrer">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={url} alt={`foto ${i + 1}`} className="w-full h-24 object-cover rounded-xl" style={{ border: '1px solid var(--border)' }} />
                        </a>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                  <div className="rounded-xl p-3" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                    <p className="text-xs uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Firma empleado</p>
                    {albDetalle.firma_empleado_url ? (
                      <a href={albDetalle.firma_empleado_url} target="_blank" rel="noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={albDetalle.firma_empleado_url} alt="Firma empleado" className="w-full h-24 object-contain rounded-lg bg-white" />
                      </a>
                    ) : (
                      <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>Sin firma de empleado.</p>
                    )}
                    {albDetalle.firmado_empleado_at && (
                      <p className="text-[11px] mt-2" style={{ color: 'var(--text-subtle)' }}>
                        {new Date(albDetalle.firmado_empleado_at).toLocaleString('es-ES')}
                      </p>
                    )}
                  </div>
                  <div className="rounded-xl p-3" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                    <p className="text-xs uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Firma cliente</p>
                    {albDetalle.firma_cliente_url ? (
                      <a href={albDetalle.firma_cliente_url} target="_blank" rel="noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={albDetalle.firma_cliente_url} alt="Firma cliente" className="w-full h-24 object-contain rounded-lg bg-white" />
                      </a>
                    ) : (
                      <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>Sin firma de cliente.</p>
                    )}
                    {albDetalle.firmado_cliente_at && (
                      <p className="text-[11px] mt-2" style={{ color: 'var(--text-subtle)' }}>
                        {new Date(albDetalle.firmado_cliente_at).toLocaleString('es-ES')}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex gap-3 flex-wrap pt-4" style={{ borderTop: '1px solid var(--border)' }}>
                  {albDetalle.estado === 'pendiente' && (
                    <button onClick={() => { void cambiarEstado(albDetalle.id, 'entregado'); setDetalleId(null) }}
                      className="text-sm px-4 py-2 rounded-xl"
                      style={{ background: 'rgba(6,182,212,0.15)', color: '#06b6d4', border: '1px solid rgba(6,182,212,0.3)' }}>
                      Marcar entregado
                    </button>
                  )}
                  <button
                    onClick={() => abrirModalFirma('empleado', albDetalle.id)}
                    className="text-sm px-4 py-2 rounded-xl"
                    style={{ background: 'rgba(124,58,237,0.15)', color: '#a78bfa', border: '1px solid rgba(124,58,237,0.3)' }}
                  >
                    Firmar empleado
                  </button>
                  <button
                    onClick={() => abrirModalFirma('cliente', albDetalle.id)}
                    className="text-sm px-4 py-2 rounded-xl"
                    style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399', border: '1px solid rgba(16,185,129,0.3)' }}
                  >
                    Firmar cliente (cierra OT)
                  </button>
                  <button onClick={() => abrirFormEditar(albDetalle)} className="text-sm px-4 py-2 rounded-xl"
                    style={{ background: 'rgba(124,58,237,0.15)', color: '#a78bfa', border: '1px solid rgba(124,58,237,0.3)' }}>
                    Editar
                  </button>
                  <button onClick={() => eliminarAlbaran(albDetalle.id)} className="text-sm px-4 py-2 rounded-xl"
                    style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
                    Eliminar
                  </button>
                  <button onClick={() => setDetalleId(null)} className="text-sm px-4 py-2 rounded-xl ml-auto" style={s.btnSecondary}>
                    Cerrar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {rolFirmaModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.9)' }}>
            <div className="w-full max-w-2xl rounded-2xl p-5" style={s.cardStyle}>
              <h3 className="font-semibold mb-2" style={{ color: 'var(--text)' }}>
                Firma {rolFirmaModal === 'empleado' ? 'del empleado' : 'del cliente'}
              </h3>
              <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
                Dibuja la firma en el recuadro y pulsa guardar.
              </p>
              <div className="rounded-xl p-2 mb-3" style={{ background: '#ffffff', border: '1px solid #cbd5e1' }}>
                <canvas
                  ref={canvasFirmaRef}
                  width={1200}
                  height={340}
                  className="w-full h-44 rounded-lg touch-none"
                  onPointerDown={iniciarDibujoFirma}
                  onPointerMove={moverDibujoFirma}
                  onPointerUp={finalizarDibujoFirma}
                  onPointerLeave={finalizarDibujoFirma}
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={limpiarCanvasFirma}
                  className="text-sm px-4 py-2 rounded-xl"
                  style={s.btnSecondary}
                >
                  Limpiar
                </button>
                <button
                  onClick={() => void guardarFirmaDesdeCanvas()}
                  disabled={guardandoFirmaRol === rolFirmaModal}
                  className="text-sm px-4 py-2 rounded-xl disabled:opacity-60"
                  style={s.btnPrimary}
                >
                  {guardandoFirmaRol === rolFirmaModal ? 'Guardando...' : 'Guardar firma'}
                </button>
                <button
                  onClick={() => { setRolFirmaModal(null); setAlbaranFirmaId(null) }}
                  className="text-sm px-4 py-2 rounded-xl ml-auto"
                  style={s.btnSecondary}
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#7c3aed', borderTopColor: 'transparent' }}></div>
          </div>
        ) : albaranes.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-5xl mb-4">📄</p>
            <p style={{ color: 'var(--text-muted)' }}>No hay albaranes. Crea el primero.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {albaranes.map((a) => (
              <div key={a.id} className="rounded-2xl p-5 transition-all" style={s.cardStyle}>
                <div className="flex items-start justify-between flex-wrap gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <span className="font-mono text-sm" style={{ color: '#06b6d4' }}>{a.numero}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: ESTADOS[a.estado]?.bg, color: ESTADOS[a.estado]?.color }}>
                        {ESTADOS[a.estado]?.label || a.estado}
                      </span>
                      {a.firmado && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399' }}>Firmado</span>}
                    </div>
                    <p className="font-semibold" style={{ color: 'var(--text)' }}>
                      {nombreClientePrincipal(a.clientes) || a.clientes?.nombre || '-'}
                    </p>
                    <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                      {textoSeguro(a.descripcion).substring(0, 90)}{textoSeguro(a.descripcion).length > 90 ? '...' : ''}
                    </p>
                    <div className="flex gap-4 mt-2 text-xs flex-wrap" style={{ color: 'var(--text-subtle)' }}>
                      {a.ordenes?.codigo && <span>OT: {a.ordenes.codigo}</span>}
                      <span>{(a.fotos_urls || []).length} fotos</span>
                      <span>{a.fecha ? new Date(a.fecha).toLocaleDateString('es-ES') : '-'}</span>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {a.orden_id && (
                      <button
                        onClick={() => void abrirRellenadoDesdeOt(a.orden_id)}
                        className="text-xs px-3 py-1.5 rounded-xl"
                        style={{ background: 'rgba(6,182,212,0.12)', color: '#06b6d4', border: '1px solid rgba(6,182,212,0.3)' }}
                      >
                        Editar albaran
                      </button>
                    )}
                    <button
                      onClick={() => setDetalleId(a.id)}
                      className="text-xs px-3 py-1.5 rounded-xl"
                      style={{ background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)' }}
                    >
                      Ver detalle
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
