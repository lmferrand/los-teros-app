'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function Albaranes() {
  const [albaranes, setAlbaranes] = useState<any[]>([])
  const [clientes, setClientes] = useState<any[]>([])
  const [ordenes, setOrdenes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [detalleId, setDetalleId] = useState<string | null>(null)
  const [subiendo, setSubiendo] = useState(false)
  const router = useRouter()

  const [clienteId, setClienteId] = useState('')
  const [ordenId, setOrdenId] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [estado, setEstado] = useState('pendiente')
  const [fecha, setFecha] = useState('')
  const [observaciones, setObservaciones] = useState('')

  useEffect(() => {
    verificarSesion()
    cargarDatos()
  }, [])

  async function verificarSesion() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) router.push('/login')
  }

  async function cargarDatos() {
    const [albs, clis, ords] = await Promise.all([
      supabase.from('albaranes').select('*, clientes(nombre), ordenes(codigo)').order('created_at', { ascending: false }),
      supabase.from('clientes').select('*').order('nombre'),
      supabase.from('ordenes').select('*').order('codigo'),
    ])
    if (albs.data) setAlbaranes(albs.data)
    if (clis.data) setClientes(clis.data)
    if (ords.data) setOrdenes(ords.data)
    setLoading(false)
  }

  function abrirFormNuevo() {
    setEditandoId(null); setClienteId(''); setOrdenId('')
    setDescripcion(''); setEstado('pendiente')
    setFecha(new Date().toISOString().slice(0, 10)); setObservaciones('')
    setMostrarForm(true)
  }

  function abrirFormEditar(a: any) {
    setEditandoId(a.id); setClienteId(a.cliente_id || ''); setOrdenId(a.orden_id || '')
    setDescripcion(a.descripcion || ''); setEstado(a.estado || 'pendiente')
    setFecha(a.fecha || new Date().toISOString().slice(0, 10)); setObservaciones(a.observaciones || '')
    setMostrarForm(true); setDetalleId(null)
  }

  async function generarNumero() {
    const { count } = await supabase.from('albaranes').select('*', { count: 'exact', head: true })
    const num = String((count || 0) + 1).padStart(4, '0')
    return `ALB-${new Date().getFullYear()}-${num}`
  }

  async function guardarAlbaran(e: React.FormEvent) {
    e.preventDefault()
    const datos = { cliente_id: clienteId || null, orden_id: ordenId || null, descripcion, estado, fecha, observaciones }
    if (editandoId) {
      await supabase.from('albaranes').update(datos).eq('id', editandoId)
    } else {
      const numero = await generarNumero()
      await supabase.from('albaranes').insert({ ...datos, numero, fotos_urls: [] })
    }
    setMostrarForm(false); setEditandoId(null); cargarDatos()
  }

  async function subirFoto(e: React.ChangeEvent<HTMLInputElement>, albanId: string) {
    const file = e.target.files?.[0]
    if (!file) return
    setSubiendo(true)
    const nombre_archivo = `${albanId}/${Date.now()}-${file.name}`
    const { data, error } = await supabase.storage.from('fotos-albaranes').upload(nombre_archivo, file)
    if (!error && data) {
      const { data: urlData } = supabase.storage.from('fotos-albaranes').getPublicUrl(nombre_archivo)
      const alb = albaranes.find(a => a.id === albanId)
      const fotosActuales = alb?.fotos_urls || []
      await supabase.from('albaranes').update({ fotos_urls: [...fotosActuales, urlData.publicUrl] }).eq('id', albanId)
      cargarDatos()
    }
    setSubiendo(false)
  }

  async function cambiarEstado(id: string, nuevoEstado: string) {
    await supabase.from('albaranes').update({ estado: nuevoEstado }).eq('id', id)
    cargarDatos()
  }

  async function marcarFirmado(id: string) {
    await supabase.from('albaranes').update({ firmado: true, estado: 'firmado' }).eq('id', id)
    cargarDatos()
  }

  async function eliminarAlbaran(id: string) {
    if (!confirm('Eliminar este albaran?')) return
    await supabase.from('albaranes').delete().eq('id', id)
    cargarDatos(); setDetalleId(null)
  }

  const ESTADOS: any = {
    pendiente: { color: '#fbbf24', bg: 'rgba(234,179,8,0.15)', label: 'Pendiente' },
    entregado: { color: '#06b6d4', bg: 'rgba(6,182,212,0.15)', label: 'Entregado' },
    firmado: { color: '#34d399', bg: 'rgba(16,185,129,0.15)', label: 'Firmado' },
    cancelado: { color: '#64748b', bg: 'rgba(71,85,105,0.15)', label: 'Cancelado' },
  }

  const albDetalle = detalleId ? albaranes.find(a => a.id === detalleId) : null
  const inputStyle = { background: '#080b14', border: '1px solid #1e2d3d', color: 'white' }
  const cardStyle = { background: '#0d1117', border: '1px solid #1e2d3d' }

  return (
    <div className="min-h-screen" style={{ background: '#080b14' }}>
      <div className="px-6 py-4 flex items-center justify-between flex-wrap gap-3" style={cardStyle}>
        <div className="flex items-center gap-4">
          <a href="/dashboard" className="text-sm transition-colors" style={{ color: '#475569' }}
            onMouseEnter={e => e.currentTarget.style.color = '#06b6d4'}
            onMouseLeave={e => e.currentTarget.style.color = '#475569'}>Dashboard</a>
          <h1 className="text-white font-bold text-lg">Albaranes</h1>
        </div>
        <button onClick={abrirFormNuevo} className="text-white text-sm px-4 py-2 rounded-xl font-medium"
          style={{ background: 'linear-gradient(135deg, #7c3aed, #06b6d4)' }}>
          + Nuevo albaran
        </button>
      </div>

      <div className="p-6 max-w-5xl mx-auto">
        {mostrarForm && (
          <div className="rounded-2xl p-6 mb-6" style={cardStyle}>
            <h2 className="text-white font-semibold mb-5">{editandoId ? 'Editar albaran' : 'Nuevo albaran'}</h2>
            <form onSubmit={guardarAlbaran} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: '#475569' }}>Cliente</label>
                <select value={clienteId} onChange={e => setClienteId(e.target.value)} className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={inputStyle}>
                  <option value="">Seleccionar cliente...</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: '#475569' }}>Orden de trabajo</label>
                <select value={ordenId} onChange={e => setOrdenId(e.target.value)} className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={inputStyle}>
                  <option value="">Sin OT asociada</option>
                  {ordenes.map(o => <option key={o.id} value={o.id}>{o.codigo}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: '#475569' }}>Fecha</label>
                <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} required className="w-full rounded-xl px-3 py-2 text-white text-sm outline-none" style={inputStyle} />
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: '#475569' }}>Estado</label>
                <select value={estado} onChange={e => setEstado(e.target.value)} className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={inputStyle}>
                  <option value="pendiente">Pendiente</option>
                  <option value="entregado">Entregado</option>
                  <option value="firmado">Firmado</option>
                  <option value="cancelado">Cancelado</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: '#475569' }}>Trabajo realizado</label>
                <textarea value={descripcion} onChange={e => setDescripcion(e.target.value)} required rows={3}
                  className="w-full rounded-xl px-3 py-2 text-white text-sm outline-none resize-none" style={inputStyle}
                  placeholder="Describe el trabajo realizado..." />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: '#475569' }}>Observaciones</label>
                <textarea value={observaciones} onChange={e => setObservaciones(e.target.value)} rows={2}
                  className="w-full rounded-xl px-3 py-2 text-white text-sm outline-none resize-none" style={inputStyle} />
              </div>
              <div className="md:col-span-2 flex gap-3">
                <button type="submit" className="text-white px-5 py-2 rounded-xl text-sm font-medium"
                  style={{ background: 'linear-gradient(135deg, #7c3aed, #06b6d4)' }}>
                  {editandoId ? 'Guardar cambios' : 'Crear albaran'}
                </button>
                <button type="button" onClick={() => { setMostrarForm(false); setEditandoId(null) }}
                  className="text-sm px-5 py-2 rounded-xl"
                  style={{ background: '#080b14', color: '#64748b', border: '1px solid #1e2d3d' }}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        )}

        {albDetalle && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.85)' }}>
            <div className="w-full max-w-2xl max-h-screen overflow-y-auto rounded-2xl" style={cardStyle}>
              <div className="sticky top-0 px-6 py-4 flex items-center justify-between rounded-t-2xl" style={{ background: '#0d1117', borderBottom: '1px solid #1e2d3d' }}>
                <div>
                  <span className="font-mono text-sm" style={{ color: '#06b6d4' }}>{albDetalle.numero}</span>
                  <h2 className="text-white font-bold text-lg">{albDetalle.clientes?.nombre || '—'}</h2>
                </div>
                <button onClick={() => setDetalleId(null)} className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ color: '#64748b', border: '1px solid #1e2d3d' }}>X</button>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {[
                    { label: 'Estado', val: <span className="text-xs px-2 py-1 rounded-full" style={{ background: ESTADOS[albDetalle.estado]?.bg, color: ESTADOS[albDetalle.estado]?.color }}>{ESTADOS[albDetalle.estado]?.label}</span> },
                    { label: 'Fecha', val: <span className="text-white text-sm">{albDetalle.fecha ? new Date(albDetalle.fecha).toLocaleDateString('es-ES') : '—'}</span> },
                    { label: 'OT asociada', val: <span className="font-mono text-sm" style={{ color: '#06b6d4' }}>{albDetalle.ordenes?.codigo || '—'}</span> },
                    { label: 'Firmado', val: <span className="text-sm font-semibold" style={{ color: albDetalle.firmado ? '#34d399' : '#64748b' }}>{albDetalle.firmado ? 'Si' : 'No'}</span> },
                  ].map((item, i) => (
                    <div key={i} className="rounded-xl p-3" style={{ background: '#080b14', border: '1px solid #1e2d3d' }}>
                      <p className="text-xs uppercase tracking-wider mb-1" style={{ color: '#475569' }}>{item.label}</p>
                      {item.val}
                    </div>
                  ))}
                </div>
                {albDetalle.descripcion && (
                  <div className="rounded-xl p-3 mb-4" style={{ background: '#080b14', border: '1px solid #1e2d3d' }}>
                    <p className="text-xs uppercase tracking-wider mb-2" style={{ color: '#475569' }}>Trabajo realizado</p>
                    <p className="text-white text-sm leading-relaxed">{albDetalle.descripcion}</p>
                  </div>
                )}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-white font-semibold">Fotos del albaran</h3>
                    <label className="text-xs px-3 py-1.5 rounded-xl cursor-pointer"
                      style={{ background: 'rgba(124,58,237,0.15)', color: '#a78bfa', border: '1px solid rgba(124,58,237,0.3)' }}>
                      {subiendo ? 'Subiendo...' : '+ Subir foto'}
                      <input type="file" accept="image/*" className="hidden" onChange={e => subirFoto(e, albDetalle.id)} disabled={subiendo} />
                    </label>
                  </div>
                  {(albDetalle.fotos_urls || []).length === 0 ? (
                    <p className="text-sm" style={{ color: '#334155' }}>Sin fotos todavia.</p>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      {(albDetalle.fotos_urls || []).map((url: string, i: number) => (
                        <a key={i} href={url} target="_blank" rel="noreferrer">
                          <img src={url} alt={`foto ${i + 1}`} className="w-full h-28 object-cover rounded-xl" style={{ border: '1px solid #1e2d3d' }} />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex gap-3 flex-wrap pt-4" style={{ borderTop: '1px solid #1e2d3d' }}>
                  {albDetalle.estado === 'pendiente' && (
                    <button onClick={() => { cambiarEstado(albDetalle.id, 'entregado'); setDetalleId(null) }}
                      className="text-sm px-4 py-2 rounded-xl"
                      style={{ background: 'rgba(6,182,212,0.15)', color: '#06b6d4', border: '1px solid rgba(6,182,212,0.3)' }}>
                      Marcar entregado
                    </button>
                  )}
                  {!albDetalle.firmado && (
                    <button onClick={() => { marcarFirmado(albDetalle.id); setDetalleId(null) }}
                      className="text-sm px-4 py-2 rounded-xl"
                      style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399', border: '1px solid rgba(16,185,129,0.3)' }}>
                      Marcar firmado
                    </button>
                  )}
                  <button onClick={() => abrirFormEditar(albDetalle)}
                    className="text-sm px-4 py-2 rounded-xl"
                    style={{ background: 'rgba(124,58,237,0.15)', color: '#a78bfa', border: '1px solid rgba(124,58,237,0.3)' }}>
                    Editar
                  </button>
                  <button onClick={() => eliminarAlbaran(albDetalle.id)}
                    className="text-sm px-4 py-2 rounded-xl"
                    style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
                    Eliminar
                  </button>
                  <button onClick={() => setDetalleId(null)}
                    className="text-sm px-4 py-2 rounded-xl ml-auto"
                    style={{ background: '#080b14', color: '#64748b', border: '1px solid #1e2d3d' }}>
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
        ) : albaranes.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-5xl mb-4">🧾</p>
            <p style={{ color: '#475569' }}>No hay albaranes. Crea el primero.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {albaranes.map(a => (
              <div key={a.id} onClick={() => setDetalleId(a.id)}
                className="rounded-2xl p-5 cursor-pointer transition-all" style={cardStyle}
                onMouseEnter={e => e.currentTarget.style.borderColor = '#7c3aed'}
                onMouseLeave={e => e.currentTarget.style.borderColor = '#1e2d3d'}>
                <div className="flex items-start justify-between flex-wrap gap-3">
                  <div>
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <span className="font-mono text-sm" style={{ color: '#06b6d4' }}>{a.numero}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: ESTADOS[a.estado]?.bg, color: ESTADOS[a.estado]?.color }}>
                        {ESTADOS[a.estado]?.label}
                      </span>
                      {a.firmado && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399' }}>Firmado</span>}
                    </div>
                    <p className="text-white font-semibold">{a.clientes?.nombre || '—'}</p>
                    <p className="text-sm mt-1" style={{ color: '#475569' }}>{(a.descripcion || '').substring(0, 80)}{(a.descripcion || '').length > 80 ? '...' : ''}</p>
                    <div className="flex gap-4 mt-2 text-xs flex-wrap" style={{ color: '#334155' }}>
                      {a.ordenes?.codigo && <span>OT: {a.ordenes.codigo}</span>}
                      <span>{(a.fotos_urls || []).length} fotos</span>
                      <span>{a.fecha ? new Date(a.fecha).toLocaleDateString('es-ES') : '—'}</span>
                    </div>
                  </div>
                  <span className="text-xs" style={{ color: '#334155' }}>Ver detalle →</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}