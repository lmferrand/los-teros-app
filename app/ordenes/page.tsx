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
    const nuevoCodigo = await generarCodigo(tipo)
    const { error } = await supabase.from('ordenes').insert({
      codigo: nuevoCodigo,
      tipo,
      cliente_id: clienteId,
      tecnico_id: tecnicosSeleccionados[0] || null,
      tecnicos_ids: tecnicosSeleccionados,
      fecha_programada: fecha,
      prioridad,
      estado,
      descripcion,
      observaciones,
    })
    if (!error) {
      setMostrarForm(false)
      setDescripcion('')
      setObservaciones('')
      setClienteId('')
      setTecnicosSeleccionados([])
      cargarDatos()
    }
  }

  async function cambiarEstado(id: string, nuevoEstado: string) {
    await supabase.from('ordenes').update({ estado: nuevoEstado }).eq('id', id)
    cargarDatos()
  }

  async function eliminarOrden(id: string) {
    if (!confirm('Eliminar esta orden?')) return
    await supabase.from('ordenes').delete().eq('id', id)
    cargarDatos()
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
            onClick={() => setMostrarForm(!mostrarForm)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm"
          >
            + Nueva OT
          </button>
        </div>
      </div>

      <div className="p-6">
        {mostrarForm && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
            <h2 className="text-white font-semibold mb-4">Nueva orden de trabajo</h2>
            <form onSubmit={guardarOrden} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-gray-400 text-xs uppercase mb-1 block">Tipo</label>
                <select
                  value={tipo}
                  onChange={e => setTipo(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                >
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
                <select
                  value={clienteId}
                  onChange={e => setClienteId(e.target.value)}
                  required
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                >
                  <option value="">Seleccionar cliente...</option>
                  {clientes.map(c => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="text-gray-400 text-xs uppercase mb-2 block">Trabajadores asignados</label>
                <div className="flex flex-wrap gap-2">
                  {tecnicos.map(t => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => toggleTecnico(t.id)}
                      className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                        tecnicosSeleccionados.includes(t.id)
                          ? 'bg-blue-600 border-blue-500 text-white'
                          : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'
                      }`}
                    >
                      {t.nombre}
                    </button>
                  ))}
                </div>
                {tecnicosSeleccionados.length > 0 && (
                  <p className="text-blue-400 text-xs mt-2">
                    Seleccionados: {getNombresTecnicos(tecnicosSeleccionados)}
                  </p>
                )}
              </div>
              <div>
                <label className="text-gray-400 text-xs uppercase mb-1 block">Fecha programada</label>
                <input
                  type="datetime-local"
                  value={fecha}
                  onChange={e => setFecha(e.target.value)}
                  required
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                />
              </div>
              <div>
                <label className="text-gray-400 text-xs uppercase mb-1 block">Prioridad</label>
                <select
                  value={prioridad}
                  onChange={e => setPrioridad(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                >
                  <option value="baja">Baja</option>
                  <option value="normal">Normal</option>
                  <option value="alta">Alta</option>
                  <option value="urgente">Urgente</option>
                </select>
              </div>
              <div>
                <label className="text-gray-400 text-xs uppercase mb-1 block">Estado</label>
                <select
                  value={estado}
                  onChange={e => setEstado(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                >
                  <option value="pendiente">Pendiente</option>
                  <option value="en_curso">En curso</option>
                  <option value="completada">Completada</option>
                  <option value="cancelada">Cancelada</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="text-gray-400 text-xs uppercase mb-1 block">Descripcion del trabajo</label>
                <textarea
                  value={descripcion}
                  onChange={e => setDescripcion(e.target.value)}
                  required
                  rows={3}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                  placeholder="Describe los trabajos a realizar..."
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-gray-400 text-xs uppercase mb-1 block">Observaciones</label>
                <textarea
                  value={observaciones}
                  onChange={e => setObservaciones(e.target.value)}
                  rows={2}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                  placeholder="Instrucciones especiales, acceso..."
                />
              </div>
              <div className="md:col-span-2 flex gap-3">
                <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm">
                  Guardar OT
                </button>
                <button type="button" onClick={() => setMostrarForm(false)} className="bg-gray-800 text-gray-400 px-4 py-2 rounded-lg text-sm">
                  Cancelar
                </button>
              </div>
            </form>
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
              <div key={o.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
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
                    <p className="text-gray-400 text-sm mt-1">{o.descripcion}</p>
                    <div className="flex gap-4 mt-2 text-xs text-gray-500 flex-wrap">
                      <span>Trabajadores: {getNombresTecnicos(o.tecnicos_ids || [])}</span>
                      <span>Fecha: {o.fecha_programada ? new Date(o.fecha_programada).toLocaleDateString('es-ES') : '—'}</span>
                      <span>Tipo: {o.tipo}</span>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {o.estado === 'pendiente' && (
                      <button onClick={() => cambiarEstado(o.id, 'en_curso')} className="bg-yellow-900 hover:bg-yellow-800 text-yellow-300 px-3 py-1 rounded text-xs">
                        Iniciar
                      </button>
                    )}
                    {o.estado === 'en_curso' && (
                      <button onClick={() => cambiarEstado(o.id, 'completada')} className="bg-green-900 hover:bg-green-800 text-green-300 px-3 py-1 rounded text-xs">
                        Completar
                      </button>
                    )}
                    <button onClick={() => eliminarOrden(o.id)} className="bg-gray-800 hover:bg-gray-700 text-red-400 px-3 py-1 rounded text-xs">
                      Eliminar
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