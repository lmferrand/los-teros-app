'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { s } from '@/lib/styles'
import { eliminarArchivosFotosOrden, eliminarOrdenConIntegridad } from '@/lib/ordenes-integridad'
import AppHeader from '@/app/components/AppHeader'
import { estandarizarNombreComercial, estandarizarNombreFiscal, limpiarTextoCliente } from '@/lib/clientes-normalizacion'

function nombreComercialCliente(c: any) {
  return String(c?.nombre_comercial || c?.nombre || '').trim()
}

function nombreFiscalCliente(c: any) {
  return String(c?.nombre_fiscal || '').trim()
}

export default function ClienteDetalle() {
  const [cliente, setCliente] = useState<any>(null)
  const [ordenes, setOrdenes] = useState<any[]>([])
  const [fotosPorOrden, setFotosPorOrden] = useState<Record<string, any[]>>({})
  const [loading, setLoading] = useState(true)
  const [ordenAbierta, setOrdenAbierta] = useState<string | null>(null)
  const [localesMismoCif, setLocalesMismoCif] = useState<any[]>([])
  const [perfil, setPerfil] = useState<any>(null)
  const [mostrarModalBorrar, setMostrarModalBorrar] = useState(false)
  const [ordenABorrar, setOrdenABorrar] = useState<any>(null)
  const [eliminando, setEliminando] = useState(false)
  const [editandoCliente, setEditandoCliente] = useState(false)
  const [guardandoCliente, setGuardandoCliente] = useState(false)
  const [clienteForm, setClienteForm] = useState<any>({
    nombre: '',
    nombre_fiscal: '',
    cif: '',
    direccion: '',
    poblacion: '',
    telefono: '',
    movil: '',
    email: '',
    notas: '',
    empresa: 'teros',
  })
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  useEffect(() => {
    inicializar()
    // Solo carga inicial.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function inicializar() {
    const ok = await verificarSesion()
    if (!ok) return
    await cargarDatos()
  }

  async function verificarSesion() {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session) {
      router.push('/login')
      return false
    }
    const { data } = await supabase.from('perfiles').select('*').eq('id', session.user.id).single()
    setPerfil(data || null)
    return true
  }

  async function cargarDatos() {
    const [cli, ords] = await Promise.all([
      supabase.from('clientes').select('*').eq('id', id).single(),
      supabase.from('ordenes').select('*').eq('cliente_id', id).order('fecha_programada', { ascending: false }),
    ])

    if (cli.data) {
      setCliente(cli.data)
      const empresaCliente = String((cli.data as any)?.empresa || (cli.data as any)?.tipo_cliente || 'teros').toLowerCase() === 'olipro' ? 'olipro' : 'teros'
      setClienteForm({
        nombre: cli.data.nombre || '',
        nombre_fiscal: cli.data.nombre_fiscal || '',
        cif: cli.data.cif || '',
        direccion: cli.data.direccion || '',
        poblacion: cli.data.poblacion || '',
        telefono: cli.data.telefono || '',
        movil: cli.data.movil || '',
        email: cli.data.email || '',
        notas: cli.data.notas || '',
        empresa: empresaCliente,
      })
      const cif = String(cli.data.cif || '').trim()
      if (cif) {
        const { data: relacionados } = await supabase
          .from('clientes')
          .select('id, nombre, nombre_comercial, nombre_fiscal, direccion')
          .eq('cif', cif)
          .neq('id', id)
          .order('nombre')
        setLocalesMismoCif(relacionados || [])
      } else {
        setLocalesMismoCif([])
      }
    }
    if (ords.data) {
      setOrdenes(ords.data)
      const ordenIds = ords.data.map((o: any) => o.id)
      if (ordenIds.length > 0) {
        const { data: fotos } = await supabase.from('fotos_ordenes').select('*').in('orden_id', ordenIds)
        const mapa: Record<string, any[]> = {}
        for (const ot of ords.data) mapa[ot.id] = (fotos || []).filter((f: any) => f.orden_id === ot.id)
        setFotosPorOrden(mapa)
      } else {
        setFotosPorOrden({})
      }
    }

    setLoading(false)
  }

  function toggleOrden(ordenId: string) {
    setOrdenAbierta((prev) => (prev === ordenId ? null : ordenId))
  }

  function puedeEliminarServicios() {
    return perfil?.rol === 'gerente' || perfil?.rol === 'oficina' || perfil?.rol === 'supervisor'
  }

  function getMensajeError(error: unknown) {
    if (error && typeof error === 'object' && 'message' in error) {
      const msg = String((error as { message?: string }).message || '').trim()
      if (msg) return msg
    }
    return 'Error desconocido'
  }

  function normalizarCliente(input: any) {
    const nombreComercial = estandarizarNombreComercial(input?.nombre || '')
    const nombreFiscal = estandarizarNombreFiscal(input?.nombre_fiscal || nombreComercial)
    return {
      nombre: nombreComercial,
      nombre_fiscal: nombreFiscal,
      cif: limpiarTextoCliente(input?.cif || '').toUpperCase(),
      direccion: limpiarTextoCliente(input?.direccion || ''),
      poblacion: limpiarTextoCliente(input?.poblacion || '').toUpperCase(),
      telefono: limpiarTextoCliente(input?.telefono || ''),
      movil: limpiarTextoCliente(input?.movil || ''),
      email: String(input?.email || '').trim().toLowerCase(),
      notas: String(input?.notas || '').trim(),
      empresa: String(input?.empresa || 'teros').toLowerCase() === 'olipro' ? 'olipro' : 'teros',
    }
  }

  async function guardarClienteDetalle(e: React.FormEvent) {
    e.preventDefault()
    if (!cliente?.id) return
    const payload = normalizarCliente(clienteForm)
    if (!payload.nombre) {
      alert('El nombre comercial no puede estar vacio.')
      return
    }
    setGuardandoCliente(true)
    const { error } = await (supabase.from('clientes') as any).update(payload).eq('id', cliente.id)
    setGuardandoCliente(false)
    if (error) {
      alert('No se pudo guardar el cliente: ' + error.message)
      return
    }
    setEditandoCliente(false)
    await cargarDatos()
  }

  async function eliminarServicio(orden: any) {
    if (!puedeEliminarServicios()) {
      alert('No tienes permiso para eliminar servicios.')
      return
    }

    setEliminando(true)
    try {
      await eliminarArchivosFotosOrden(orden.id)
      await eliminarOrdenConIntegridad(orden.id)
      setMostrarModalBorrar(false)
      setOrdenABorrar(null)
      await cargarDatos()
    } catch (error) {
      alert(`No se pudo eliminar el servicio: ${getMensajeError(error)}`)
    } finally {
      setEliminando(false)
    }
  }

  const TIPOS_FOTO: any = {
    proceso: { label: 'Fotos del proceso', icono: 'P', color: '#06b6d4' },
    cierre: { label: 'Fotos de cierre', icono: 'C', color: '#34d399' },
    albaran: { label: 'Albaran', icono: 'A', color: '#a78bfa' },
    equipo_salida: { label: 'Equipo al salir', icono: 'S', color: '#fbbf24' },
    equipo_retorno: { label: 'Equipo al retornar', icono: 'R', color: '#fb923c' },
  }

  const TIPO_OT: any = {
    limpieza: { color: '#06b6d4', bg: 'rgba(6,182,212,0.15)' },
    sustitucion: { color: '#fbbf24', bg: 'rgba(234,179,8,0.15)' },
    mantenimiento: { color: '#34d399', bg: 'rgba(16,185,129,0.15)' },
    instalacion: { color: '#a78bfa', bg: 'rgba(124,58,237,0.15)' },
    revision: { color: '#fb923c', bg: 'rgba(249,115,22,0.15)' },
    otro: { color: '#64748b', bg: 'rgba(71,85,105,0.15)' },
  }

  const ESTADO_OT: any = {
    pendiente: { color: '#a78bfa', bg: 'rgba(124,58,237,0.15)', label: 'Pendiente' },
    en_curso: { color: '#fbbf24', bg: 'rgba(234,179,8,0.15)', label: 'En curso' },
    completada: { color: '#34d399', bg: 'rgba(16,185,129,0.15)', label: 'Completada' },
    cancelada: { color: '#64748b', bg: 'rgba(71,85,105,0.15)', label: 'Cancelada' },
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#7c3aed', borderTopColor: 'transparent' }}></div>
      </div>
    )
  }

  if (!cliente) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <p style={{ color: 'var(--text-muted)' }}>Cliente no encontrado.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      {mostrarModalBorrar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.85)' }}>
          <div className="w-full max-w-sm rounded-2xl p-6" style={s.cardStyle}>
            <p className="text-xl mb-2">X</p>
            <p className="font-semibold mb-1" style={{ color: 'var(--text)' }}>
              Eliminar servicio {ordenABorrar?.codigo}
            </p>
            <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
              Se eliminaran fotos, albaranes y movimientos vinculados. El stock de inventario se restaurara. Esta accion no se puede deshacer.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => eliminarServicio(ordenABorrar)}
                disabled={eliminando}
                className="flex-1 py-3 rounded-xl text-sm font-semibold"
                style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}
              >
                {eliminando ? 'Eliminando...' : 'Eliminar'}
              </button>
              <button
                onClick={() => {
                  setMostrarModalBorrar(false)
                  setOrdenABorrar(null)
                }}
                className="flex-1 py-3 rounded-xl text-sm font-semibold"
                style={s.btnSecondary}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      <AppHeader
        title={nombreComercialCliente(cliente) || cliente.nombre}
        leftSlot={
          <>
            <Link
              href="/clientes"
              className="text-sm transition-colors"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#06b6d4')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
            >
              Clientes
            </Link>
            <span style={{ color: 'var(--text-subtle)' }}>{'>'}</span>
          </>
        }
      />

      <div className="p-6 max-w-4xl mx-auto">
        <div className="rounded-2xl p-6 mb-6" style={s.cardStyle}>
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="flex-1 min-w-72">
              {!editandoCliente ? (
                <>
                  <h2 className="text-xl font-bold mb-3" style={{ color: 'var(--text)' }}>
                    {nombreComercialCliente(cliente) || cliente.nombre}
                  </h2>
                  <div className="flex flex-col gap-2">
                    {!!nombreFiscalCliente(cliente) && (
                      <p className="text-sm" style={{ color: 'var(--text-subtle)' }}>
                        Fiscal: {nombreFiscalCliente(cliente)}
                      </p>
                    )}
                    {cliente.cif && (
                      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                        CIF: {cliente.cif}
                      </p>
                    )}
                    {cliente.poblacion && (
                      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                        Poblacion: {cliente.poblacion}
                      </p>
                    )}
                    {cliente.direccion && (
                      <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(cliente.direccion)}`} target="_blank" rel="noreferrer" className="text-sm" style={{ color: '#06b6d4' }}>
                        {cliente.direccion}
                      </a>
                    )}
                    {cliente.telefono && (
                      <a href={`tel:${cliente.telefono}`} className="text-sm font-medium" style={{ color: '#34d399' }}>
                        {cliente.telefono}
                      </a>
                    )}
                    {cliente.movil && (
                      <a href={`tel:${cliente.movil}`} className="text-sm font-medium" style={{ color: '#22c55e' }}>
                        {cliente.movil}
                      </a>
                    )}
                    {cliente.email && (
                      <a href={`mailto:${cliente.email}`} className="text-sm" style={{ color: '#06b6d4' }}>
                        {cliente.email}
                      </a>
                    )}
                    {cliente.notas && (
                      <p className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>
                        {cliente.notas}
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <form onSubmit={guardarClienteDetalle} className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="md:col-span-2">
                    <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>Nombre Comercial</label>
                    <input value={clienteForm.nombre} onChange={(e) => setClienteForm((p: any) => ({ ...p, nombre: e.target.value }))} className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={s.inputStyle} required />
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>Nombre Fiscal</label>
                    <input value={clienteForm.nombre_fiscal} onChange={(e) => setClienteForm((p: any) => ({ ...p, nombre_fiscal: e.target.value }))} className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={s.inputStyle} />
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>CIF</label>
                    <input value={clienteForm.cif} onChange={(e) => setClienteForm((p: any) => ({ ...p, cif: e.target.value }))} className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={s.inputStyle} />
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>Direccion</label>
                    <input value={clienteForm.direccion} onChange={(e) => setClienteForm((p: any) => ({ ...p, direccion: e.target.value }))} className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={s.inputStyle} />
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>Poblacion</label>
                    <input value={clienteForm.poblacion} onChange={(e) => setClienteForm((p: any) => ({ ...p, poblacion: e.target.value }))} className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={s.inputStyle} />
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>Telefono</label>
                    <input value={clienteForm.telefono} onChange={(e) => setClienteForm((p: any) => ({ ...p, telefono: e.target.value }))} className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={s.inputStyle} />
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>Movil</label>
                    <input value={clienteForm.movil} onChange={(e) => setClienteForm((p: any) => ({ ...p, movil: e.target.value }))} className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={s.inputStyle} />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>Email</label>
                    <input value={clienteForm.email} onChange={(e) => setClienteForm((p: any) => ({ ...p, email: e.target.value }))} className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={s.inputStyle} />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>Notas</label>
                    <textarea value={clienteForm.notas} onChange={(e) => setClienteForm((p: any) => ({ ...p, notas: e.target.value }))} rows={3} className="w-full rounded-xl px-3 py-2 text-sm outline-none resize-none" style={s.inputStyle} />
                  </div>
                  <div className="md:col-span-2 flex gap-2">
                    <button type="submit" disabled={guardandoCliente} className="text-sm px-4 py-2 rounded-xl font-medium disabled:opacity-50" style={s.btnPrimary}>
                      {guardandoCliente ? 'Guardando...' : 'Guardar cliente'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditandoCliente(false)
                        setClienteForm({
                          nombre: cliente?.nombre || '',
                          nombre_fiscal: cliente?.nombre_fiscal || '',
                          cif: cliente?.cif || '',
                          direccion: cliente?.direccion || '',
                          poblacion: cliente?.poblacion || '',
                          telefono: cliente?.telefono || '',
                          movil: cliente?.movil || '',
                          email: cliente?.email || '',
                          notas: cliente?.notas || '',
                          empresa: cliente?.empresa || 'teros',
                        })
                      }}
                      className="text-sm px-4 py-2 rounded-xl"
                      style={s.btnSecondary}
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              )}
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold" style={{ color: '#7c3aed' }}>
                {ordenes.filter((o) => o.estado === 'completada').length}
              </p>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                servicios completados
              </p>
              {!editandoCliente && (
                <button
                  onClick={() => {
                    setClienteForm({
                      nombre: cliente?.nombre || '',
                      nombre_fiscal: cliente?.nombre_fiscal || '',
                      cif: cliente?.cif || '',
                      direccion: cliente?.direccion || '',
                      poblacion: cliente?.poblacion || '',
                      telefono: cliente?.telefono || '',
                      movil: cliente?.movil || '',
                      email: cliente?.email || '',
                      notas: cliente?.notas || '',
                      empresa: cliente?.empresa || 'teros',
                    })
                    setEditandoCliente(true)
                  }}
                  className="text-sm px-3 py-2 rounded-xl mt-3"
                  style={s.btnSecondary}
                >
                  Editar cliente
                </button>
              )}
            </div>
          </div>
        </div>

        {localesMismoCif.length > 0 && (
          <div className="rounded-2xl p-4 mb-6" style={{ ...s.cardStyle, background: 'rgba(6,182,212,0.06)' }}>
            <p className="text-xs uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
              Otros locales con este CIF
            </p>
            <div className="flex flex-col gap-2">
              {localesMismoCif.map((l: any) => (
                <Link key={l.id} href={`/clientes/${l.id}`} className="text-sm hover:underline" style={{ color: '#06b6d4' }}>
                  {nombreComercialCliente(l) || l.nombre}
                  {nombreFiscalCliente(l) ? ` (${nombreFiscalCliente(l)})` : ''}
                  {l.direccion ? ` - ${l.direccion}` : ''}
                </Link>
              ))}
            </div>
          </div>
        )}

        <h2 className="font-semibold text-lg mb-4" style={{ color: 'var(--text)' }}>
          Historial de servicios
        </h2>

        {ordenes.length === 0 ? (
          <div className="text-center py-16 rounded-2xl" style={s.cardStyle}>
            <p style={{ color: 'var(--text-muted)' }}>No hay servicios para este cliente.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {ordenes.map((o) => {
              const fotos = fotosPorOrden[o.id] || []
              const abierta = ordenAbierta === o.id
              return (
                <div key={o.id} className="rounded-2xl overflow-hidden transition-all" style={s.cardStyle}>
                  <div className="w-full px-5 py-4 flex items-center justify-between">
                    <button className="flex items-center gap-3 flex-wrap flex-1 text-left" onClick={() => toggleOrden(o.id)}>
                      <span className="font-mono text-sm" style={{ color: '#06b6d4' }}>
                        {o.codigo}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full capitalize" style={{ background: TIPO_OT[o.tipo]?.bg, color: TIPO_OT[o.tipo]?.color }}>
                        {o.tipo}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: ESTADO_OT[o.estado]?.bg, color: ESTADO_OT[o.estado]?.color }}>
                        {ESTADO_OT[o.estado]?.label}
                      </span>
                      <span className="text-sm" style={{ color: 'var(--text)' }}>
                        {o.fecha_programada ? new Date(o.fecha_programada).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '-'}
                      </span>
                      {fotos.length > 0 && (
                        <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>
                          {fotos.length} fotos
                        </span>
                      )}
                    </button>
                    <div className="flex items-center gap-2 ml-2">
                      {puedeEliminarServicios() && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setOrdenABorrar(o)
                            setMostrarModalBorrar(true)
                          }}
                          className="text-xs px-2 py-1 rounded-lg"
                          style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}
                        >
                          Eliminar
                        </button>
                      )}
                      <span className="text-lg" style={{ color: 'var(--text-muted)', display: 'inline-block', transition: 'transform 0.2s', transform: abierta ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                        v
                      </span>
                    </div>
                  </div>

                  {abierta && (
                    <div className="px-5 pb-5" style={{ borderTop: '1px solid var(--border)' }}>
                      {o.descripcion && (
                        <div className="rounded-xl p-3 mt-4 mb-4" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                          <p className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
                            Trabajo realizado
                          </p>
                          <p className="text-sm" style={{ color: 'var(--text)' }}>
                            {o.descripcion}
                          </p>
                        </div>
                      )}

                      {o.observaciones && (
                        <div className="rounded-xl p-3 mb-4" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                          <p className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>
                            Observaciones
                          </p>
                          <p className="text-sm" style={{ color: 'var(--text)' }}>
                            {o.observaciones}
                          </p>
                        </div>
                      )}

                      {fotos.length === 0 ? (
                        <p className="text-sm mt-4" style={{ color: 'var(--text-subtle)' }}>
                          Sin fotos registradas.
                        </p>
                      ) : (
                        <div className="mt-4 flex flex-col gap-5">
                          {Object.entries(TIPOS_FOTO).map(([key, info]: any) => {
                            const fotosTipo = fotos.filter((f: any) => f.tipo === key)
                            if (fotosTipo.length === 0) return null
                            return (
                              <div key={key}>
                                <p className="text-xs uppercase tracking-wider mb-3 flex items-center gap-2" style={{ color: info.color }}>
                                  <span>{info.icono}</span> {info.label}
                                </p>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                  {fotosTipo.map((f: any) => (
                                    <a key={f.id} href={f.url} target="_blank" rel="noreferrer">
                                      <img src={f.url} alt={key} className="w-full h-28 object-cover rounded-xl hover:opacity-80" style={{ border: '1px solid var(--border)' }} />
                                    </a>
                                  ))}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
