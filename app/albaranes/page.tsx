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
    setEditandoId(null)
    setClienteId('')
    setOrdenId('')
    setDescripcion('')
    setEstado('pendiente')
    setFecha(new Date().toISOString().slice(0, 10))
    setObservaciones('')
    setMostrarForm(true)
  }

  function abrirFormEditar(a: any) {
    setEditandoId(a.id)
    setClienteId(a.cliente_id || '')
    setOrdenId(a.orden_id || '')
    setDescripcion(a.descripcion || '')
    setEstado(a.estado || 'pendiente')
    setFecha(a.fecha || new Date().toISOString().slice(0, 10))
    setObservaciones(a.observaciones || '')
    setMostrarForm(true)
    setDetalleId(null)
  }

  async function generarNumero() {
    const { count } = await supabase.from('albaranes').select('*', { count: 'exact', head: true })
    const num = String((count || 0) + 1).padStart(4, '0')
    return `ALB-${new Date().getFullYear()}-${num}`
  }

  async function guardarAlbaran(e: React.FormEvent) {
    e.preventDefault()
    const datos = {
      cliente_id: clienteId || null,
      orden_id: ordenId || null,
      descripcion,
      estado,
      fecha,
      observaciones,
    }
    if (editandoId) {
      await supabase.from('albaranes').update(datos).eq('id', editandoId)
    } else {
      const numero = await generarNumero()
      await supabase.from('albaranes').insert({ ...datos, numero, fotos_urls: [] })
    }
    setMostrarForm(false)
    setEditandoId(null)
    cargarDatos()
  }

  async function subirFoto(e: React.ChangeEvent<HTMLInputElement>, albanId: string) {
    const file = e.target.files?.[0]
    if (!file) return
    setSubiendo(true)
    const nombre_archivo = `${albanId}/${Date.now()}-${file.name}`
    const { data, error } = await supabase.storage
      .from('fotos-albaranes')
      .upload(nombre_archivo, file)
    if (!error && data) {
      const { data: urlData } = supabase.storage
        .from('fotos-albaranes')
        .getPublicUrl(nombre_archivo)
      const alb = albaranes.find(a => a.id === albanId)
      const fotosActuales = alb?.fotos_urls || []
      await supabase.from('albaranes').update({
        fotos_urls: [...fotosActuales, urlData.publicUrl]
      }).eq('id', albanId)
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
    cargarDatos()
    setDetalleId(null)
  }

  const ESTADOS: any = {
    pendiente: { clase: 'bg-yellow-900 text-yellow-300', label: 'Pendiente' },
    entregado: { clase: 'bg-blue-900 text-blue-300', label: 'Entregado' },
    firmado: { clase: 'bg-green-900 text-green-300', label: 'Firmado' },
    cancelado: { clase: 'bg-gray-800 text-gray-400', label: 'Cancelado' },
  }

  const albDetalle = detalleId ? albaranes.find(a => a.id === detalleId) : null

  return (
    <div className="min-h-screen bg-gray-950">
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <a href="/dashboard" className="text-gray-400 hover:text-white text-sm">Dashboard</a>
          <h1 className="text-xl font-bold text-white">Albaranes</h1>
        </div>
        <button onClick={abrirFormNuevo} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm">
          + Nuevo albaran
        </button>
      </div>

      <div className="p-6">
        {mostrarForm && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
            <h2 className="text-white font-semibold mb-4">{editandoId ? 'Editar albaran' : 'Nuevo albaran'}</h2>
            <form onSubmit={guardarAlbaran} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-gray-400 text-xs uppercase mb-1 block">Cliente</label>
                <select value={clienteId} onChange={e => setClienteId(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm">
                  <option value="">Seleccionar cliente...</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="text-gray-400 text-xs uppercase mb-1 block">Orden de trabajo</label>
                <select value={ordenId} onChange={e => setOrdenId(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm">
                  <option value="">Sin OT asociada</option>
                  {ordenes.map(o => <option key={o.id} value={o.id}>{o.codigo}</option>)}
                </select>
              </div>
              <div>
                <label className="text-gray-400 text-xs uppercase mb-1 block">Fecha</label>
                <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} required className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm" />
              </div>
              <div>
                <label className="text-gray-400 text-xs uppercase mb-1 block">Estado</label>
                <select value={estado} onChange={e => setEstado(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm">
                  <option value="pendiente">Pendiente</option>
                  <option value="entregado">Entregado</option>
                  <option value="firmado">Firmado</option>
                  <option value="cancelado">Cancelado</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="text-gray-400 text-xs uppercase mb-1 block">Descripcion del trabajo realizado</label>
                <textarea value={descripcion} onChange={e => setDescripcion(e.target.value)} required rows={3} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm" placeholder="Describe el trabajo realizado..." />
              </div>
              <div className="md:col-span-2">
                <label className="text-gray-400 text-xs uppercase mb-1 block">Observaciones</label>
                <textarea value={observaciones} onChange={e => setObservaciones(e.target.value)} rows={2} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm" placeholder="Notas adicionales..." />
              </div>
              <div className="md:col-span-2 flex gap-3">
                <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm">
                  {editandoId ? 'Guardar cambios' : 'Crear albaran'}
                </button>
                <button type="button" onClick={() => { setMostrarForm(false); setEditandoId(null) }} className="bg-gray-800 text-gray-400 px-4 py-2 rounded-lg text-sm">
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        )}

        {albDetalle && (
          <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4">
            <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-2xl max-h-screen overflow-y-auto">
              <div className="sticky top-0 bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between">
                <div>
                  <span className="text-blue-400 font-mono text-sm">{albDetalle.numero}</span>
                  <h2 className="text-white font-bold text-lg">{albDetalle.clientes?.nombre || '—'}</h2>
                </div>
                <button onClick={() => setDetalleId(null)} className="text-gray-400 hover:text-white text-xl">X</button>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-gray-800 rounded-lg p-3">
                    <p className="text-gray-400 text-xs mb-1">Estado</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${ESTADOS[albDetalle.estado]?.clase}`}>{ESTADOS[albDetalle.estado]?.label}</span>
                  </div>
                  <div className="bg-gray-800 rounded-lg p-3">
                    <p className="text-gray-400 text-xs mb-1">Fecha</p>
                    <p className="text-white text-sm">{albDetalle.fecha ? new Date(albDetalle.fecha).toLocaleDateString('es-ES') : '—'}</p>
                  </div>
                  <div className="bg-gray-800 rounded-lg p-3">
                    <p className="text-gray-400 text-xs mb-1">OT asociada</p>
                    <p className="text-white text-sm font-mono">{albDetalle.ordenes?.codigo || '—'}</p>
                  </div>
                  <div className="bg-gray-800 rounded-lg p-3">
                    <p className="text-gray-400 text-xs mb-1">Firmado</p>
                    <p className={`text-sm font-semibold ${albDetalle.firmado ? 'text-green-400' : 'text-gray-400'}`}>{albDetalle.firmado ? 'Si' : 'No'}</p>
                  </div>
                </div>

                {albDetalle.descripcion && (
                  <div className="bg-gray-800 rounded-lg p-3 mb-4">
                    <p className="text-gray-400 text-xs mb-1">Trabajo realizado</p>
                    <p className="text-white text-sm leading-relaxed">{albDetalle.descripcion}</p>
                  </div>
                )}

                {albDetalle.observaciones && (
                  <div className="bg-gray-800 rounded-lg p-3 mb-4">
                    <p className="text-gray-400 text-xs mb-1">Observaciones</p>
                    <p className="text-white text-sm">{albDetalle.observaciones}</p>
                  </div>
                )}

                <div className="mb-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-white font-semibold">Fotos del albaran</h3>
                    <label className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-lg text-xs cursor-pointer">
                      {subiendo ? 'Subiendo...' : '+ Subir foto'}
                      <input type="file" accept="image/*" className="hidden" onChange={e => subirFoto(e, albDetalle.id)} disabled={subiendo} />
                    </label>
                  </div>
                  {(albDetalle.fotos_urls || []).length === 0 ? (
                    <p className="text-gray-500 text-sm">Sin fotos. Sube la primera.</p>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      {(albDetalle.fotos_urls || []).map((url: string, i: number) => (
                        <a key={i} href={url} target="_blank" rel="noreferrer">
                          <img src={url} alt={`foto ${i + 1}`} className="w-full h-28 object-cover rounded-lg border border-gray-700 hover:opacity-80 transition-opacity" />
                        </a>
                      ))}
                    </div>
                  )}
                </div>

                <div className="border-t border-gray-800 pt-4 flex gap-3 flex-wrap">
                  {albDetalle.estado === 'pendiente' && (
                    <button onClick={() => { cambiarEstado(albDetalle.id, 'entregado'); setDetalleId(null) }} className="bg-blue-900 hover:bg-blue-800 text-blue-300 px-4 py-2 rounded-lg text-sm">
                      Marcar entregado
                    </button>
                  )}
                  {!albDetalle.firmado && (
                    <button onClick={() => { marcarFirmado(albDetalle.id); setDetalleId(null) }} className="bg-green-900 hover:bg-green-800 text-green-300 px-4 py-2 rounded-lg text-sm">
                      Marcar firmado
                    </button>
                  )}
                  <button onClick={() => abrirFormEditar(albDetalle)} className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-4 py-2 rounded-lg text-sm">
                    Editar
                  </button>
                  <button onClick={() => eliminarAlbaran(albDetalle.id)} className="bg-gray-800 hover:bg-gray-700 text-red-400 px-4 py-2 rounded-lg text-sm">
                    Eliminar
                  </button>
                  <button onClick={() => setDetalleId(null)} className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-4 py-2 rounded-lg text-sm ml-auto">
                    Cerrar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <p className="text-gray-400">Cargando...</p>
        ) : albaranes.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <p className="text-4xl mb-3">🧾</p>
            <p>No hay albaranes. Crea el primero.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {albaranes.map(a => (
              <div key={a.id} onClick={() => setDetalleId(a.id)} className="bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-xl p-5 cursor-pointer transition-colors">
                <div className="flex items-start justify-between flex-wrap gap-3">
                  <div>
                    <div className="flex items-center gap-3 mb-1 flex-wrap">
                      <span className="text-blue-400 font-mono text-sm">{a.numero}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${ESTADOS[a.estado]?.clase}`}>{ESTADOS[a.estado]?.label}</span>
                      {a.firmado && <span className="text-xs px-2 py-0.5 rounded-full bg-green-900 text-green-300">Firmado</span>}
                    </div>
                    <p className="text-white font-semibold">{a.clientes?.nombre || '—'}</p>
                    <p className="text-gray-400 text-sm mt-1">{(a.descripcion || '').substring(0, 80)}{(a.descripcion || '').length > 80 ? '...' : ''}</p>
                    <div className="flex gap-4 mt-2 text-xs text-gray-500">
                      {a.ordenes?.codigo && <span>OT: {a.ordenes.codigo}</span>}
                      <span>{(a.fotos_urls || []).length} fotos</span>
                      <span>{a.fecha ? new Date(a.fecha).toLocaleDateString('es-ES') : '—'}</span>
                    </div>
                  </div>
                  <span className="text-gray-500 text-xs">Ver detalle</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}