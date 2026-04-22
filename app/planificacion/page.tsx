'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function Planificacion() {
  const [ordenes, setOrdenes] = useState<any[]>([])
  const [clientes, setClientes] = useState<any[]>([])
  const [tecnicos, setTecnicos] = useState<any[]>([])
  const [userId, setUserId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [mesActual, setMesActual] = useState(new Date())
  const [ordenSeleccionada, setOrdenSeleccionada] = useState<any>(null)
  const [vistaActiva, setVistaActiva] = useState<'calendario' | 'mis_ordenes'>('calendario')
  const router = useRouter()

  useEffect(() => {
    cargarDatos()
  }, [])

  async function cargarDatos() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }
    setUserId(session.user.id)
    const [ords, clis, tecs] = await Promise.all([
      supabase.from('ordenes').select('*').neq('estado', 'cancelada'),
      supabase.from('clientes').select('*'),
      supabase.from('perfiles').select('*'),
    ])
    if (ords.data) setOrdenes(ords.data)
    if (clis.data) setClientes(clis.data)
    if (tecs.data) setTecnicos(tecs.data)
    setLoading(false)
  }

  function getNombreCliente(id: string) {
    return clientes.find(c => c.id === id)?.nombre || '—'
  }

  function getNombresTecnicos(ids: string[]) {
    if (!ids || ids.length === 0) return 'Sin asignar'
    return ids.map(id => tecnicos.find(t => t.id === id)?.nombre || '').filter(Boolean).join(', ')
  }

  function mesAnterior() {
    const d = new Date(mesActual)
    d.setMonth(d.getMonth() - 1)
    setMesActual(d)
  }

  function mesSiguiente() {
    const d = new Date(mesActual)
    d.setMonth(d.getMonth() + 1)
    setMesActual(d)
  }

  function getDiasMes() {
    const anio = mesActual.getFullYear()
    const mes = mesActual.getMonth()
    const primerDia = new Date(anio, mes, 1)
    const ultimoDia = new Date(anio, mes + 1, 0)
    const dias: (Date | null)[] = []
    let diaSemana = primerDia.getDay()
    diaSemana = diaSemana === 0 ? 6 : diaSemana - 1
    for (let i = 0; i < diaSemana; i++) dias.push(null)
    for (let d = 1; d <= ultimoDia.getDate(); d++) dias.push(new Date(anio, mes, d))
    return dias
  }

  function getOrdenesDelDia(dia: Date) {
    return ordenes.filter(o => {
      if (!o.fecha_programada) return false
      const f = new Date(o.fecha_programada)
      return f.getDate() === dia.getDate() &&
        f.getMonth() === dia.getMonth() &&
        f.getFullYear() === dia.getFullYear()
    })
  }

  const misOrdenes = ordenes.filter(o =>
    o.tecnicos_ids?.includes(userId) || o.tecnico_id === userId
  ).sort((a, b) => new Date(a.fecha_programada).getTime() - new Date(b.fecha_programada).getTime())

  const misOrdenesPendientes = misOrdenes.filter(o => o.estado === 'pendiente' || o.estado === 'en_curso')
  const misOrdenesCompletadas = misOrdenes.filter(o => o.estado === 'completada')

  const COLORES: any = {
    limpieza: 'bg-blue-800 text-blue-200',
    sustitucion: 'bg-yellow-800 text-yellow-200',
    mantenimiento: 'bg-green-800 text-green-200',
    instalacion: 'bg-purple-800 text-purple-200',
    revision: 'bg-orange-800 text-orange-200',
    otro: 'bg-gray-800 text-gray-200',
  }

  const ESTADOS: any = {
    pendiente: 'bg-blue-900 text-blue-300',
    en_curso: 'bg-yellow-900 text-yellow-300',
    completada: 'bg-green-900 text-green-300',
    cancelada: 'bg-gray-800 text-gray-400',
  }

  const hoy = new Date()
  const tituloMes = mesActual.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }).toUpperCase()
  const dias = getDiasMes()

  const otsSemana = ordenes.filter(o => {
    if (!o.fecha_programada) return false
    const f = new Date(o.fecha_programada)
    const lunes = new Date(hoy)
    lunes.setDate(hoy.getDate() - (hoy.getDay() === 0 ? 6 : hoy.getDay() - 1))
    lunes.setHours(0, 0, 0, 0)
    const domingo = new Date(lunes)
    domingo.setDate(lunes.getDate() + 6)
    domingo.setHours(23, 59, 59)
    return f >= lunes && f <= domingo
  }).sort((a, b) => new Date(a.fecha_programada).getTime() - new Date(b.fecha_programada).getTime())

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <p className="text-white">Cargando...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-950">
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <a href="/dashboard" className="text-gray-400 hover:text-white text-sm">Dashboard</a>
          <h1 className="text-xl font-bold text-white">Planificacion</h1>
        </div>
        {vistaActiva === 'calendario' && (
          <div className="flex items-center gap-3">
            <button onClick={mesAnterior} className="bg-gray-800 hover:bg-gray-700 text-white px-3 py-2 rounded-lg text-sm">
              Anterior
            </button>
            <span className="text-white font-mono font-bold text-sm min-w-40 text-center">{tituloMes}</span>
            <button onClick={mesSiguiente} className="bg-gray-800 hover:bg-gray-700 text-white px-3 py-2 rounded-lg text-sm">
              Siguiente
            </button>
          </div>
        )}
      </div>

      <div className="p-6">
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setVistaActiva('calendario')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${vistaActiva === 'calendario' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
          >
            Calendario empresa
          </button>
          <button
            onClick={() => setVistaActiva('mis_ordenes')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${vistaActiva === 'mis_ordenes' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
          >
            Mis ordenes
            {misOrdenesPendientes.length > 0 && (
              <span className="ml-1 bg-blue-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                {misOrdenesPendientes.length}
              </span>
            )}
          </button>
        </div>

        {ordenSeleccionada && (
          <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4">
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-lg w-full max-h-screen overflow-y-auto">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <span className="text-blue-400 font-mono text-sm">{ordenSeleccionada.codigo}</span>
                  <h2 className="text-white font-bold text-lg mt-1">{getNombreCliente(ordenSeleccionada.cliente_id)}</h2>
                </div>
                <button onClick={() => setOrdenSeleccionada(null)} className="text-gray-400 hover:text-white text-xl">X</button>
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Tipo</span>
                  <span className="text-white capitalize">{ordenSeleccionada.tipo}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Estado</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${ESTADOS[ordenSeleccionada.estado]}`}>{ordenSeleccionada.estado.replace('_', ' ')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Prioridad</span>
                  <span className="text-white capitalize">{ordenSeleccionada.prioridad}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Fecha</span>
                  <span className="text-white text-xs">{new Date(ordenSeleccionada.fecha_programada).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Trabajadores</span>
                  <span className="text-white text-right text-xs">{getNombresTecnicos(ordenSeleccionada.tecnicos_ids || [])}</span>
                </div>
                {ordenSeleccionada.descripcion && (
                  <div>
                    <p className="text-gray-400 mb-1">Trabajos a realizar</p>
                    <p className="text-white bg-gray-800 rounded-lg p-3 text-xs leading-relaxed">{ordenSeleccionada.descripcion}</p>
                  </div>
                )}
                {ordenSeleccionada.observaciones && (
                  <div>
                    <p className="text-gray-400 mb-1">Observaciones</p>
                    <p className="text-white bg-gray-800 rounded-lg p-3 text-xs leading-relaxed">{ordenSeleccionada.observaciones}</p>
                  </div>
                )}
              </div>
              <div className="mt-5 flex gap-3">
                <button
                  onClick={() => { router.push('/ordenes'); setOrdenSeleccionada(null) }}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm"
                >
                  Ver en OT
                </button>
                <button
                  onClick={() => setOrdenSeleccionada(null)}
                  className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-4 py-2 rounded-lg text-sm"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}

        {vistaActiva === 'calendario' && (
          <>
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden mb-6">
              <div className="grid grid-cols-7 border-b border-gray-800">
                {['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'].map(d => (
                  <div key={d} className="text-center py-2 text-gray-500 text-xs font-bold uppercase tracking-wider">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {dias.map((dia, i) => {
                  if (!dia) return <div key={i} className="min-h-24 border-b border-r border-gray-800 bg-gray-950 opacity-30" />
                  const esHoy = dia.getDate() === hoy.getDate() && dia.getMonth() === hoy.getMonth() && dia.getFullYear() === hoy.getFullYear()
                  const otsDelDia = getOrdenesDelDia(dia)
                  return (
                    <div key={i} className={`min-h-24 border-b border-r border-gray-800 p-1.5 ${esHoy ? 'bg-blue-950' : ''}`}>
                      <p className={`text-xs font-bold mb-1 ${esHoy ? 'text-blue-400' : 'text-gray-500'}`}>{dia.getDate()}</p>
                      {otsDelDia.map(o => (
                        <button
                          key={o.id}
                          onClick={() => setOrdenSeleccionada(o)}
                          className={`w-full text-left text-xs px-1.5 py-1 rounded mb-1 truncate ${COLORES[o.tipo] || 'bg-gray-800 text-gray-200'}`}
                        >
                          {o.codigo}
                        </button>
                      ))}
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h2 className="text-white font-semibold mb-4">OT de esta semana</h2>
              {otsSemana.length === 0 ? (
                <p className="text-gray-500 text-sm">Sin trabajos programados esta semana</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {otsSemana.map(o => (
                    <div
                      key={o.id}
                      onClick={() => setOrdenSeleccionada(o)}
                      className="flex items-start justify-between p-4 bg-gray-800 rounded-xl cursor-pointer hover:bg-gray-700 transition-colors"
                    >
                      <div>
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-blue-400 font-mono text-xs">{o.codigo}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${COLORES[o.tipo]}`}>{o.tipo}</span>
                          {(o.tecnicos_ids?.includes(userId) || o.tecnico_id === userId) && (
                            <span className="text-xs bg-blue-900 text-blue-300 px-2 py-0.5 rounded-full">Mi OT</span>
                          )}
                        </div>
                        <p className="text-white font-medium text-sm">{getNombreCliente(o.cliente_id)}</p>
                        <p className="text-gray-400 text-xs mt-1">{(o.descripcion || '').substring(0, 80)}{(o.descripcion || '').length > 80 ? '...' : ''}</p>
                        <p className="text-gray-500 text-xs mt-1">Trabajadores: {getNombresTecnicos(o.tecnicos_ids || [])}</p>
                      </div>
                      <div className="text-right ml-4">
                        <p className="text-gray-400 text-xs">{new Date(o.fecha_programada).toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: '2-digit' })}</p>
                        <p className="text-gray-500 text-xs">{new Date(o.fecha_programada).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {vistaActiva === 'mis_ordenes' && (
          <div>
            <div className="mb-6">
              <h2 className="text-white font-semibold mb-1">Mis ordenes pendientes y en curso</h2>
              <p className="text-gray-500 text-sm mb-4">Solo las ordenes asignadas a ti</p>
              {misOrdenesPendientes.length === 0 ? (
                <div className="text-center py-12 text-gray-500 bg-gray-900 rounded-xl border border-gray-800">
                  <p className="text-3xl mb-2">✅</p>
                  <p>No tienes ordenes pendientes</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {misOrdenesPendientes.map(o => (
                    <div
                      key={o.id}
                      onClick={() => setOrdenSeleccionada(o)}
                      className="bg-gray-900 border border-gray-800 rounded-xl p-5 cursor-pointer hover:border-blue-800 transition-colors"
                    >
                      <div className="flex items-start justify-between flex-wrap gap-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="text-blue-400 font-mono text-sm">{o.codigo}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${ESTADOS[o.estado]}`}>{o.estado.replace('_', ' ')}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${COLORES[o.tipo]}`}>{o.tipo}</span>
                          </div>
                          <p className="text-white font-semibold">{getNombreCliente(o.cliente_id)}</p>
                          <p className="text-gray-400 text-sm mt-1">{(o.descripcion || '').substring(0, 120)}{(o.descripcion || '').length > 120 ? '...' : ''}</p>
                          {o.observaciones && (
                            <p className="text-yellow-400 text-xs mt-1">Nota: {o.observaciones}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-white text-sm font-medium">
                            {o.fecha_programada ? new Date(o.fecha_programada).toLocaleDateString('es-ES', { weekday: 'long', day: '2-digit', month: '2-digit' }) : '—'}
                          </p>
                          <p className="text-gray-400 text-xs">
                            {o.fecha_programada ? new Date(o.fecha_programada).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : ''}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {misOrdenesCompletadas.length > 0 && (
              <div>
                <h2 className="text-white font-semibold mb-4">Mis ordenes completadas</h2>
                <div className="flex flex-col gap-2">
                  {misOrdenesCompletadas.map(o => (
                    <div
                      key={o.id}
                      onClick={() => setOrdenSeleccionada(o)}
                      className="bg-gray-900 border border-gray-800 rounded-xl p-4 cursor-pointer hover:border-gray-700 transition-colors opacity-70"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-blue-400 font-mono text-xs mr-2">{o.codigo}</span>
                          <span className="text-white text-sm">{getNombreCliente(o.cliente_id)}</span>
                        </div>
                        <span className="bg-green-900 text-green-300 text-xs px-2 py-0.5 rounded-full">Completada</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}