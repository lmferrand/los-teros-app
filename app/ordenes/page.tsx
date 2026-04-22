'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function Ordenes() {
  const [ordenes, setOrdenes] = useState<any[]>([])
  const [clientes, setClientes] = useState<any[]>([])
  const [tecnicos, setTecnicos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [filtroEstado, setFiltroEstado] = useState('')
  const [ordenDetalle, setOrdenDetalle] = useState<any>(null)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [subiendo, setSubiendo] = useState(false)
  const router = useRouter()

  const [tipo, setTipo] = useState('limpieza')
  const [clienteId, setClienteId] = useState('')
  const [tecnicosSeleccionados, setTecnicosSeleccionados] = useState<string[]>([])
  const [fecha, setFecha] = useState('')
  const [prioridad, setPrioridad] = useState('normal')
  const [estado, setEstado] = useState('pendiente')
  const [descripcion, setDescripcion] = useState('')
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
    const [ords, clis, tecs] = await Promise.all([
      supabase.from('ordenes').select('*, clientes(nombre)').order('created_at', { ascending: false }),
      supabase.from('clientes').select('*').order('nombre'),
      supabase.from('perfiles').select('*').order('nombre'),
    ])
    if (ords.data) setOrdenes(ords.data)
    if (clis.data) setClientes(clis.data)
    if (tecs.data) setTecnicos(tecs.data)
    setLoading(false)
  }

  async function cargarFotosOrden(ordenId: string) {
    const { data } = await supabase
      .from('fotos_ordenes')
      .select('*')
      .eq('orden_id', ordenId)
      .order('created_at')
    return data || []
  }

  async function abrirDetalle(o: any) {
    const fotos = await cargarFotosOrden(o.id)
    setOrdenDetalle({ ...o, fotos })
  }

  function abrirFormNuevo() {
    setEditandoId(null)
    setTipo('limpieza')
    setClienteId('')
    setTecnicosSeleccionados([])
    setFecha('')
    setPrioridad('normal')
    setEstado('pendiente')
    setDescripcion('')
    setObservaciones('')
    setMostrarForm(true)
  }

  function abrirFormEditar(o: any) {
    setEditandoId(o.id)
    setTipo(o.tipo || 'limpieza')
    setClienteId(o.cliente_id || '')
    setTecnicosSeleccionados(o.tecnicos_ids || [])
    setFecha(o.fecha_programada ? new Date(o.fecha_programada).toISOString().slice(0, 16) : '')
    setPrioridad(o.prioridad || 'normal')
    setEstado(o.estado || 'pendiente')
    setDescripcion(o.descripcion || '')
    setObservaciones(o.observaciones || '')
    setMostrarForm(true)
    setOrdenDetalle(null)
  }

  async function subirFoto(e: React.ChangeEvent<HTMLInputElement>, tipo: string) {
    const file = e.target.files?.[0]
    if (!file || !ordenDetalle) return
    setSubiendo(true)
    const nombre_archivo = `${ordenDetalle.id}/${tipo}/${Date.now()}-${file.name}`
    const { data, error } = await supabase.storage
      .from('fotos-ordenes')
      .upload(nombre_archivo, file)
    if (!error && data) {
      const { data: urlData } = supabase.storage
        .from('fotos-ordenes')
        .getPublicUrl(nombre_archivo)
      const { data: { session } } = await supabase.auth.getSession()
      await supabase.from('fotos_ordenes').insert({
        orden_id: ordenDetalle.id,
        tipo,
        url: urlData.publicUrl,
        subida_por: session?.user?.id,
      })
      const fotos = await cargarFotosOrden(ordenDetalle.id)
      setOrdenDetalle((prev: any) => ({ ...prev, fotos }))
    }
    setSubiendo(false)
  }

  function toggleTecnico(id: string) {
    setTecnicosSeleccionados(prev =>
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
    )
  }

  async function generarCodigo(tipo: string) {
    const prefijos: any = { limpieza: 'LIM', sustitucion: 'SUS', mantenimiento: 'MAN', instalacion: 'INS', revision: 'REV', otro: 'OTR' }
    const { count } = await supabase.from('ordenes').select('*', { count: 'exact', head: true }).eq('tipo', tipo)
    const num = String((count || 0) + 1).padStart(4, '0')
    return `${prefijos[tipo] || 'OTR'}-${new Date().getFullYear()}-${num}`
  }

  async function guardarOrden(e: React.FormEvent) {
    e.preventDefault()
    const datos = {
      tipo,
      cliente_id: clienteId,
      tecnico_id: tecnicosSeleccionados[0] || null,
      tecnicos_ids: tecnicosSeleccionados,
      fecha_programada: fecha,
      prioridad,
      estado,
      descripcion,
      observaciones,
    }
    if (editandoId) {
      await supabase.from('ordenes').update(datos).eq('id', editandoId)
    } else {
      const nuevoCodigo = await generarCodigo(tipo)
      await supabase.from('ordenes').insert({ ...datos, codigo: nuevoCodigo })
    }
    setMostrarForm(false)
    setEditandoId(null)
    setDescripcion('')
    setObservaciones('')
    setClienteId('')
    setTecnicosSeleccionados([])
    cargarDatos()
  }

  async function cambiarEstado(id: string, nuevoEstado: string) {
    await supabase.from('ordenes').update({ estado: nuevoEstado }).eq('id', id)
    cargarDatos()
    if (ordenDetalle?.id === id) {
      setOrdenDetalle((prev: any) => ({ ...prev, estado: nuevoEstado }))
    }
  }

  async function eliminarOrden(id: string) {
    if (!confirm('Eliminar esta orden?')) return
    await supabase.from('ordenes').delete().eq('id', id)
    cargarDatos()
    setOrdenDetalle(null)
  }

  function getNombresTecnicos(ids: string[]) {
    if (!ids || ids.length === 0) return 'Sin asignar'
    return ids.map(id => tecnicos.find(t => t.id === id)?.nombre || '').filter(Boolean).join(', ')
  }

  const ESTADOS: any = {
    pendiente: 'bg-blue-900 text-blue-300',
    en_curso: 'bg-yellow-900 text-yellow-300',
    completada: 'bg-green-900 text-green-300',
    cancelada: 'bg-gray-800 text-gray-400',
  }

  const PRIORIDADES: any = {
    baja: 'text-gray-400',
    normal: 'text-blue-400',
    alta: 'text-yellow-400',
    urgente: 'text-red-400',
  }

  const TIPOS_FOTO = [
    { key: 'proceso', label: 'Fotos del proceso' },
    { key: 'equipo_salida', label: 'Equipo al salir' },
    { key: 'equipo_retorno', label: 'Equipo al retornar' },
    { key: 'cierre', label: 'Fotos de cierre' },
    { key: 'albaran', label: 'Albaran' },
  ]

  const ordenesFiltradas = filtroEstado ? ordenes.filter(o => o.estado === filtroEstado) : ordenes

  return (
    <div className="min-h-screen bg-gray-950">
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <a href="/dashboard" className="text-gray-400 hover:text-white text-sm">Dashboard</a>
          <h1 className="text-xl font-bold text-white">Ordenes de trabajo</h1>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={filtroEstado}
            onChange={e => setFiltroEstado(e.target.value)}
            className="bg-gray-800 border border-gray-700 text-gray-300 text-sm rounded-lg px-3 py-2"
          >
            <option value="">Todos los estados</option>
            <option value="pendiente">Pendiente</option>
            <option value="en_curso">En curso</option>
            <option value="completada">Completada</option>
            <option value="cancelada">Cancelada</option>
          </select>
          <button
            onClick={abrirFormNuevo}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm"
          >
            + Nueva OT
          </button>
        </div>
      </div>

      <div className="p-6">
        {mostrarForm && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
            <h2 className="text-white font-semibold mb-4">
              {editandoId ? 'Editar orden de trabajo' : 'Nueva orden de trabajo'}
            </h2>
            <form onSubmit={guardarOrden} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-gray-400 text-xs uppercase mb-1 block">Tipo</label>
                <select value={tipo} onChange={e => setTipo(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm">
                  <option value="limpieza">Limpieza</option>
                  <option value="sustitucion">Sustitucion</option>
                  <option value="mantenimiento">Mantenimiento</option>
                  <option value="instalacion">Instalacion</option>
                  <option value="revision">Revision</option>
                  <option value="otro">Otro</option>
                </select>
              </div>
              <div>
                <label className="text-gray-400 text-xs uppercase mb-1 block">Cliente</label>
                <select value={clienteId} onChange={e => setClienteId(e.target.value)} required className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm">
                  <option value="">Seleccionar cliente...</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="text-gray-400 text-xs uppercase mb-2 block">Trabajadores asignados</label>
                <div className="flex flex-wrap gap-2">
                  {tecnicos.map(t => (
                    <button key={t.id} type="button" onClick={() => toggleTecnico(t.id)}
                      className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${tecnicosSeleccionados.includes(t.id) ? 'bg-blue-600 border-blue-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-400'}`}>
                      {t.nombre}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-gray-400 text-xs uppercase mb-1 block">Fecha programada</label>
                <input type="datetime-local" value={fecha} onChange={e => setFecha(e.target.value)} required className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm" />
              </div>
              <div>
                <label className="text-gray-400 text-xs uppercase mb-1 block">Prioridad</label>
                <select value={prioridad} onChange={e => setPrioridad(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm">
                  <option value="baja">Baja</option>
                  <option value="normal">Normal</option>
                  <option value="alta">Alta</option>
                  <option value="urgente">Urgente</option>
                </select>
              </div>
              <div>
                <label className="text-gray-400 text-xs uppercase mb-1 block">Estado</label>
                <select value={estado} onChange={e => setEstado(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm">
                  <option value="pendiente">Pendiente</option>
                  <option value="en_curso">En curso</option>
                  <option value="completada">Completada</option>
                  <option value="cancelada">Cancelada</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="text-gray-400 text-xs uppercase mb-1 block">Descripcion del trabajo</label>
                <textarea value={descripcion} onChange={e => setDescripcion(e.target.value)} required rows={3} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm" placeholder="Describe los trabajos a realizar..." />
              </div>
              <div className="md:col-span-2">
                <label className="text-gray-400 text-xs uppercase mb-1 block">Observaciones</label>
                <textarea value={observaciones} onChange={e => setObservaciones(e.target.value)} rows={2} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm" placeholder="Instrucciones especiales, acceso..." />
              </div>
              <div className="md:col-span-2 flex gap-3">
                <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm">
                  {editandoId ? 'Guardar cambios' : 'Crear OT'}
                </button>
                <button type="button" onClick={() => { setMostrarForm(false); setEditandoId(null) }} className="bg-gray-800 text-gray-400 px-4 py-2 rounded-lg text-sm">
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        )}

        {ordenDetalle && (
          <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4">
            <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-2xl max-h-screen overflow-y-auto">
              <div className="sticky top-0 bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between">
                <div>
                  <span className="text-blue-400 font-mono text-sm">{ordenDetalle.codigo}</span>
                  <h2 className="text-white font-bold text-lg">{ordenDetalle.clientes?.nombre || '—'}</h2>
                </div>
                <button onClick={() => setOrdenDetalle(null)} className="text-gray-400 hover:text-white text-xl">X</button>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
                  <div className="bg-gray-800 rounded-lg p-3">
                    <p className="text-gray-400 text-xs mb-1">Estado</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${ESTADOS[ordenDetalle.estado]}`}>{ordenDetalle.estado.replace('_', ' ')}</span>
                  </div>
                  <div className="bg-gray-800 rounded-lg p-3">
                    <p className="text-gray-400 text-xs mb-1">Prioridad</p>
                    <span className={`text-sm font-medium ${PRIORIDADES[ordenDetalle.prioridad]}`}>{ordenDetalle.prioridad}</span>
                  </div>
                  <div className="bg-gray-800 rounded-lg p-3">
                    <p className="text-gray-400 text-xs mb-1">Tipo</p>
                    <p className="text-white text-sm capitalize">{ordenDetalle.tipo}</p>
                  </div>
                  <div className="bg-gray-800 rounded-lg p-3">
                    <p className="text-gray-400 text-xs mb-1">Fecha</p>
                    <p className="text-white text-sm">{ordenDetalle.fecha_programada ? new Date(ordenDetalle.fecha_programada).toLocaleDateString('es-ES') : '—'}</p>
                  </div>
                </div>

                <div className="bg-gray-800 rounded-lg p-3 mb-4">
                  <p className="text-gray-400 text-xs mb-1">Trabajadores</p>
                  <p className="text-white text-sm">{getNombresTecnicos(ordenDetalle.tecnicos_ids || [])}</p>
                </div>

                {ordenDetalle.descripcion && (
                  <div className="bg-gray-800 rounded-lg p-3 mb-4">
                    <p className="text-gray-400 text-xs mb-1">Trabajos a realizar</p>
                    <p className="text-white text-sm leading-relaxed">{ordenDetalle.descripcion}</p>
                  </div>
                )}

                {ordenDetalle.observaciones && (
                  <div className="bg-gray-800 rounded-lg p-3 mb-4">
                    <p className="text-gray-400 text-xs mb-1">Observaciones</p>
                    <p className="text-white text-sm leading-relaxed">{ordenDetalle.observaciones}</p>
                  </div>
                )}

                <div className="border-t border-gray-800 pt-4 mb-4">
                  <h3 className="text-white font-semibold mb-3">Fotos</h3>
                  {subiendo && <p className="text-blue-400 text-sm mb-3">Subiendo foto...</p>}
                  {TIPOS_FOTO.map(tf => {
                    const fotosDelTipo = (ordenDetalle.fotos || []).filter((f: any) => f.tipo === tf.key)
                    return (
                      <div key={tf.key} className="mb-4">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-gray-400 text-xs uppercase">{tf.label}</p>
                          <label className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1 rounded text-xs cursor-pointer">
                            + Subir foto
                            <input type="file" accept="image/*" className="hidden" onChange={e => subirFoto(e, tf.key)} />
                          </label>
                        </div>
                        {fotosDelTipo.length > 0 ? (
                          <div className="grid grid-cols-3 gap-2">
                            {fotosDelTipo.map((f: any) => (
                              <a key={f.id} href={f.url} target="_blank" rel="noreferrer">
                                <img src={f.url} alt="foto" className="w-full h-24 object-cover rounded-lg border border-gray-700 hover:opacity-80 transition-opacity" />
                              </a>
                            ))}
                          </div>
                        ) : (
                          <p className="text-gray-600 text-xs">Sin fotos</p>
                        )}
                      </div>
                    )
                  })}
                </div>

                <div className="border-t border-gray-800 pt-4 flex gap-3 flex-wrap">
                  {ordenDetalle.estado === 'pendiente' && (
                    <button onClick={() => cambiarEstado(ordenDetalle.id, 'en_curso')} className="bg-yellow-900 hover:bg-yellow-800 text-yellow-300 px-4 py-2 rounded-lg text-sm">
                      Iniciar trabajo
                    </button>
                  )}
                  {ordenDetalle.estado === 'en_curso' && (
                    <button onClick={() => cambiarEstado(ordenDetalle.id, 'completada')} className="bg-green-900 hover:bg-green-800 text-green-300 px-4 py-2 rounded-lg text-sm">
                      Completar
                    </button>
                  )}
                  <button onClick={() => abrirFormEditar(ordenDetalle)} className="bg-blue-900 hover:bg-blue-800 text-blue-300 px-4 py-2 rounded-lg text-sm">
                    Editar OT
                  </button>
                  <button onClick={() => eliminarOrden(ordenDetalle.id)} className="bg-gray-800 hover:bg-gray-700 text-red-400 px-4 py-2 rounded-lg text-sm">
                    Eliminar
                  </button>
                  <button onClick={() => setOrdenDetalle(null)} className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-4 py-2 rounded-lg text-sm ml-auto">
                    Cerrar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <p className="text-gray-400">Cargando...</p>
        ) : ordenesFiltradas.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <p className="text-4xl mb-3">📋</p>
            <p>No hay ordenes. Crea la primera.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {ordenesFiltradas.map(o => (
              <div key={o.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5 cursor-pointer hover:border-gray-700 transition-colors" onClick={() => abrirDetalle(o)}>
                <div className="flex items-start justify-between flex-wrap gap-3">
                  <div>
                    <div className="flex items-center gap-3 mb-1 flex-wrap">
                      <span className="text-blue-400 font-mono text-sm">{o.codigo}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${ESTADOS[o.estado] || 'bg-gray-800 text-gray-400'}`}>
                        {o.estado.replace('_', ' ')}
                      </span>
                      <span className={`text-xs font-medium ${PRIORIDADES[o.prioridad] || 'text-gray-400'}`}>
                        {o.prioridad}
                      </span>
                    </div>
                    <p className="text-white font-medium">{o.clientes?.nombre || '—'}</p>
                    <p className="text-gray-400 text-sm mt-1">{(o.descripcion || '').substring(0, 100)}{(o.descripcion || '').length > 100 ? '...' : ''}</p>
                    <div className="flex gap-4 mt-2 text-xs text-gray-500 flex-wrap">
                      <span>Trabajadores: {getNombresTecnicos(o.tecnicos_ids || [])}</span>
                      <span>Fecha: {o.fecha_programada ? new Date(o.fecha_programada).toLocaleDateString('es-ES') : '—'}</span>
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