'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { s } from '@/lib/styles'
import AppHeader from '@/app/components/AppHeader'
import { estandarizarNombreComercial, estandarizarNombreFiscal, limpiarTextoCliente } from '@/lib/clientes-normalizacion'

function nombreComercialCliente(c: any) {
  return String(c?.nombre_comercial || c?.nombre || '').trim()
}

function nombreFiscalCliente(c: any) {
  return String(c?.nombre_fiscal || '').trim()
}

function etiquetaOrigenServicio(origen: string | null | undefined) {
  const v = String(origen || '').trim().toLowerCase()
  if (v === 'ot_completada') return 'OT completada'
  if (v === 'factura_importada') return 'Factura importada'
  if (!v) return 'Historial'
  return v.replaceAll('_', ' ')
}

export default function ClienteDetalle() {
  const [cliente, setCliente] = useState<any>(null)
  const [serviciosImportados, setServiciosImportados] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [localesMismoCif, setLocalesMismoCif] = useState<any[]>([])
  const [perfil, setPerfil] = useState<any>(null)
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
    const [cli, serviciosRes] = await Promise.all([
      supabase.from('clientes').select('*').eq('id', id).single(),
      supabase
        .from('servicios_clientes')
        .select('*')
        .eq('cliente_id', id)
        .order('fecha_servicio', { ascending: false }),
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

    if (serviciosRes.error) {
      const txt = String(serviciosRes.error.message || '').toLowerCase()
      if (txt.includes('servicios_clientes') && (txt.includes('does not exist') || txt.includes('relation'))) {
        setServiciosImportados([])
      }
    } else {
      setServiciosImportados(serviciosRes.data || [])
    }

    setLoading(false)
  }

  function puedeEliminarServicios() {
    return perfil?.rol === 'gerente' || perfil?.rol === 'oficina' || perfil?.rol === 'supervisor'
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

  async function eliminarServicioImportado(idServicio: string) {
    if (!puedeEliminarServicios()) {
      alert('No tienes permiso para eliminar servicios importados.')
      return
    }
    if (!confirm('¿Eliminar este servicio importado?')) return

    const { error } = await supabase.from('servicios_clientes').delete().eq('id', idServicio)
    if (error) {
      alert('No se pudo eliminar el servicio importado: ' + error.message)
      return
    }
    setServiciosImportados((prev) => prev.filter((s) => s.id !== idServicio))
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
                {serviciosImportados.length}
              </p>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                servicios en historial
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

        <div className="rounded-2xl p-4 mb-6" style={s.cardStyle}>
          <p className="text-xs uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
            Servicios registrados (historial)
          </p>
          {serviciosImportados.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--text-subtle)' }}>
              No hay servicios registrados para este cliente.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {serviciosImportados.map((srv: any) => (
                <div
                  key={srv.id}
                  className="rounded-xl px-3 py-2 flex items-center justify-between gap-3 flex-wrap"
                  style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}
                >
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                      {srv.descripcion || 'Servicio registrado'}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {etiquetaOrigenServicio(srv.origen)}
                      {' - '}
                      {srv.fecha_servicio ? new Date(`${srv.fecha_servicio}T12:00:00`).toLocaleDateString('es-ES') : '-'}
                      {srv.numero_documento ? ` - Doc: ${srv.numero_documento}` : ''}
                      {typeof srv.importe === 'number' ? ` - Importe: ${srv.importe.toFixed(2)} EUR` : ''}
                    </p>
                  </div>
                  {puedeEliminarServicios() && (
                    <button
                      onClick={() => void eliminarServicioImportado(srv.id)}
                      className="text-xs px-2 py-1 rounded-lg"
                      style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}
                    >
                      Eliminar
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
