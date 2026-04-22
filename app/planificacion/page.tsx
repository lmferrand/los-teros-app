'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function Planificacion() {
  const [ordenes, setOrdenes] = useState<any[]>([])
  const [clientes, setClientes] = useState<any[]>([])
  const [tecnicos, setTecnicos] = useState<any[]>([])
  const [presupuestos, setPresupuestos] = useState<any[]>([])
  const [userId, setUserId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [mesActual, setMesActual] = useState(new Date())
  const [ordenSeleccionada, setOrdenSeleccionada] = useState<any>(null)
  const [vistaActiva, setVistaActiva] = useState<'calendario' | 'mis_ordenes' | 'presupuestos'>('calendario')
  const [mostrarFormPres, setMostrarFormPres] = useState(false)
  const [editandoPres, setEditandoPres] = useState<any>(null)
  const router = useRouter()

  const [presClienteId, setPresClienteId] = useState('')
  const [presTitulo, setPresTitulo] = useState('')
  const [presImporte, setPresImporte] = useState('0')
  const [presEstado, setPresEstado] = useState('enviado')
  const [presFecha, setPresFecha] = useState('')
  const [presObs, setPresObs] = useState('')

  useEffect(() => {
    cargarDatos()
  }, [])

  async function cargarDatos() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }
    setUserId(session.user.id)
    const [ords, clis, tecs, pres] = await Promise.all([
      supabase.from('ordenes').select('*').neq('estado', 'cancelada'),
      supabase.from('clientes').select('*'),
      supabase.from('perfiles').select('*'),
      supabase.from('presupuestos').select('*, clientes(nombre)').order('created_at', { ascending: false }),
    ])
    if (ords.data) setOrdenes(ords.data)
    if (clis.data) setClientes(clis.data)
    if (tecs.data) setTecnicos(tecs.data)
    if (pres.data) setPresupuestos(pres.data)
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

  const ESTADOS_OT: any = {
    pendiente: 'bg-blue-900 text-blue-300',
    en_curso: 'bg-yellow-900 text-yellow-300',
    completada: 'bg-green-900 text-green-300',
    cancelada: 'bg-gray-800 text-gray-400',
  }

  const ESTADOS_PRES: any = {
    enviado: { clase: 'bg-blue-900 text-blue-300 border border-blue-700', label: 'Enviado' },
    pendiente: { clase: 'bg-yellow-900 text-yellow-300 border border-yellow-700', label: 'Pendiente respuesta' },
    aceptado: { clase: 'bg-green-900 text-green-300 border border-green-700', label: 'Aceptado' },
    rechazado: { clase: 'bg-red-900 text-red-300 border border-red-700', label: 'Rechazado' },
    expirado: { clase: 'bg-gray-800 text-gray-400 border border-gray-700', label: 'Expirado' },
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

  async function generarNumeroPres() {
    const { count } = await supabase.from('presupuestos').select('*', { count: 'exact', head: true })
    const num = String((count || 0) + 1).padStart(4, '0')
    return `PRES-${new Date().getFullYear()}-${num}`
  }

  function abrirFormPres(p?: any) {
    if (p) {
      setEditandoPres(p)
      setPresClienteId(p.cliente_id || '')
      setPresTitulo(p.titulo || '')
      setPresImporte(String(p.importe || 0))
      setPresEstado(p.estado || 'enviado')
      setPresFecha(p.fecha_envio || new Date().toISOString().slice(0, 10))
      setPresObs(p.observaciones || '')
    } else {
      setEditandoPres(null)
      setPresClienteId('')
      setPresTitulo('')
      setPresImporte('0')
      setPresEstado('enviado')
      setPresFecha(new Date().toISOString().slice(0, 10))
      setPresObs('')
    }
    setMostrarFormPres(true)
  }

  async function guardarPresupuesto(e: React.FormEvent) {
    e.preventDefault()
    const datos = {
      cliente_id: presClienteId || null,
      titulo: presTitulo,
      importe: parseFloat(presImporte) || 0,
      estado: presEstado,
      fecha_envio: presFecha,
      observaciones: presObs,
    }
    if (editandoPres) {
      await supabase.from('presupuestos').update(datos).eq('id', editandoPres.id)
    } else {
      const numero = await generarNumeroPres()
      await supabase.from('presupuestos').insert({ ...datos, numero })
    }
    setMostrarFormPres(false)
    setEditandoPres(null)
    cargarDatos()
  }

  async function cambiarEstadoPres(id: string, nuevoEstado: string) {
    await supabase.from('presupuestos').update({ estado: nuevoEstado }).eq('id', id)
    cargarDatos()
  }

  async function eliminarPres(id: string) {
    if (!confirm('Eliminar este presupuesto?')) return
    await supabase.from('presupuestos').delete().eq('id', id)
    cargarDatos()
  }

  const presEnviados = presupuestos.filter(p => p.estado === 'enviado').length
  const presAceptados = presupuestos.filter(p => p.estado === 'aceptado').length
  const presPendientes = presupuestos.filter(p => p.estado === 'pendiente').length

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
            <button onClick={mesAnterior} className="bg-gray-800 hover:bg-gray-700 text-white px-3 py-2 rounded-lg text-sm">Anterior</button>
            <span className="text-white font-mono font-bold text-sm min-w-40 text-center">{tituloMes}</span>
            <button onClick={mesSiguiente} className="bg-gray-800 hover:bg-gray-700 text-white px-3 py-2 rounded-lg text-sm">Siguiente</button>
          </div>
        )}
        {vistaActiva === 'presupuestos' && (
          <button onClick={() => abrirFormPres()} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm">
            + Nuevo presupuesto
          </button>
        )}
      </div>

      <div className="p-6">
        <div className="flex gap-2 mb-6 flex-wrap">
          <button onClick={() => setVistaActiva('calendario')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${vistaActiva === 'calendario' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
            Calendario empresa
          </button>
          <button onClick={() => setVistaActiva('mis_ordenes')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${vistaActiva === 'mis_ordenes' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
            Mis ordenes
            {misOrdenesPendientes.length > 0 && (
              <span className="ml-1 bg-blue-500 text-white text-xs px-1.5 py-0.5 rounded-full">{misOrdenesPendientes.length}</span>
            )}
          </button>
          <button onClick={() => setVistaActiva('presupuestos')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${vistaActiva === 'presupuestos' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
            Presupuestos
            {presEnviados > 0 && (
              <span className="ml-1 bg-yellow-600 text-white text-xs px-1.5 py-0.5 rounded-full">{presEnviados}</span>
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
                <div className="flex justify-between"><span className="text-gray-400">Tipo</span><span className="text-white capitalize">{ordenSeleccionada.tipo}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Estado</span><span className={`text-xs px-2 py-0.5 rounded-full ${ESTADOS_OT[ordenSeleccionada.estado]}`}>{ordenSeleccionada.estado.replace('_', ' ')}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Prioridad</span><span className="text-white capitalize">{ordenSeleccionada.prioridad}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Fecha</span><span className="text-white text-xs">{new Date(ordenSeleccionada.fecha_programada).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Trabajadores</span><span className="text-white text-right text-xs">{getNombresTecnicos(ordenSeleccionada.tecnicos_ids || [])}</span></div>
                {ordenSeleccionada.descripcion && (
                  <div><p className="text-gray-400 mb-1">Trabajos a realizar</p><p className="text-white bg-gray-800 rounded-lg p-3 text-xs leading-relaxed">{ordenSeleccionada.descripcion}</p></div>
                )}
                {ordenSeleccionada.observaciones && (
                  <div><p className="text-gray-400 mb-1">Observaciones</p><p className="text-white bg-gray-800 rounded-lg p-3 text-xs leading-relaxed">{ordenSeleccionada.observaciones}</p></div>
                )}
              </div>
              <div className="mt-5 flex gap-3">
                <button onClick={() => { router.push('/ordenes'); setOrdenSeleccionada(null) }} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm">Ver en OT</button>
                <button onClick={() => setOrdenSeleccionada(null)} className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-4 py-2 rounded-lg text-sm">Cerrar</button>
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
                        <button key={o.id} onClick={() => setOrdenSeleccionada(o)} className={`w-full text-left text-xs px-1.5 py-1 rounded mb-1 truncate ${COLORES[o.tipo] || 'bg-gray-800 text-gray-200'}`}>
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
                    <div key={o.id} onClick={() => setOrdenSeleccionada(o)} className="flex items-start justify-between p-4 bg-gray-800 rounded-xl cursor-pointer hover:bg-gray-700 transition-colors">
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
                    <div key={o.id} onClick={() => setOrdenSeleccionada(o)} className="bg-gray-900 border border-gray-800 rounded-xl p-5 cursor-pointer hover:border-blue-800 transition-colors">
                      <div className="flex items-start justify-between flex-wrap gap-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="text-blue-400 font-mono text-sm">{o.codigo}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${ESTADOS_OT[o.estado]}`}>{o.estado.replace('_', ' ')}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${COLORES[o.tipo]}`}>{o.tipo}</span>
                          </div>
                          <p className="text-white font-semibold">{getNombreCliente(o.cliente_id)}</p>
                          <p className="text-gray-400 text-sm mt-1">{(o.descripcion || '').substring(0, 120)}{(o.descripcion || '').length > 120 ? '...' : ''}</p>
                          {o.observaciones && <p className="text-yellow-400 text-xs mt-1">Nota: {o.observaciones}</p>}
                        </div>
                        <div className="text-right">
                          <p className="text-white text-sm font-medium">{o.fecha_programada ? new Date(o.fecha_programada).toLocaleDateString('es-ES', { weekday: 'long', day: '2-digit', month: '2-digit' }) : '—'}</p>
                          <p className="text-gray-400 text-xs">{o.fecha_programada ? new Date(o.fecha_programada).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : ''}</p>
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
                    <div key={o.id} onClick={() => setOrdenSeleccionada(o)} className="bg-gray-900 border border-gray-800 rounded-xl p-4 cursor-pointer hover:border-gray-700 transition-colors opacity-70">
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

        {vistaActiva === 'presupuestos' && (
          <div>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-blue-950 border border-blue-800 rounded-xl p-4 text-center">
                <p className="text-blue-300 text-2xl font-bold">{presEnviados}</p>
                <p className="text-blue-400 text-sm">Enviados</p>
              </div>
              <div className="bg-yellow-950 border border-yellow-800 rounded-xl p-4 text-center">
                <p className="text-yellow-300 text-2xl font-bold">{presPendientes}</p>
                <p className="text-yellow-400 text-sm">Pendientes</p>
              </div>
              <div className="bg-green-950 border border-green-800 rounded-xl p-4 text-center">
                <p className="text-green-300 text-2xl font-bold">{presAceptados}</p>
                <p className="text-green-400 text-sm">Aceptados</p>
              </div>
            </div>

            {mostrarFormPres && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
                <h2 className="text-white font-semibold mb-4">{editandoPres ? 'Editar presupuesto' : 'Nuevo presupuesto'}</h2>
                <form onSubmit={guardarPresupuesto} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-gray-400 text-xs uppercase mb-1 block">Cliente</label>
                    <select value={presClienteId} onChange={e => setPresClienteId(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm">
                      <option value="">Sin cliente</option>
                      {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs uppercase mb-1 block">Descripcion</label>
                    <input value={presTitulo} onChange={e => setPresTitulo(e.target.value)} required className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm" placeholder="Limpieza campanas industriales..." />
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs uppercase mb-1 block">Importe (EUR)</label>
                    <input type="number" value={presImporte} onChange={e => setPresImporte(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm" min="0" step="0.01" />
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs uppercase mb-1 block">Fecha envio</label>
                    <input type="date" value={presFecha} onChange={e => setPresFecha(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm" />
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs uppercase mb-1 block">Estado</label>
                    <select value={presEstado} onChange={e => setPresEstado(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm">
                      <option value="enviado">Enviado</option>
                      <option value="pendiente">Pendiente respuesta</option>
                      <option value="aceptado">Aceptado</option>
                      <option value="rechazado">Rechazado</option>
                      <option value="expirado">Expirado</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs uppercase mb-1 block">Observaciones</label>
                    <input value={presObs} onChange={e => setPresObs(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm" placeholder="Notas adicionales..." />
                  </div>
                  <div className="md:col-span-2 flex gap-3">
                    <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm">
                      {editandoPres ? 'Guardar cambios' : 'Crear presupuesto'}
                    </button>
                    <button type="button" onClick={() => { setMostrarFormPres(false); setEditandoPres(null) }} className="bg-gray-800 text-gray-400 px-4 py-2 rounded-lg text-sm">
                      Cancelar
                    </button>
                  </div>
                </form>
              </div>
            )}

            {presupuestos.length === 0 ? (
              <div className="text-center py-16 text-gray-500 bg-gray-900 rounded-xl border border-gray-800">
                <p className="text-3xl mb-2">📄</p>
                <p>No hay presupuestos. Crea el primero.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {presupuestos.map(p => (
                  <div key={p.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                    <div className="flex items-start justify-between flex-wrap gap-3 mb-3">
                      <div>
                        <div className="flex items-center gap-3 mb-1 flex-wrap">
                          <span className="text-blue-400 font-mono text-sm">{p.numero}</span>
                          <span className={`text-xs px-2 py-1 rounded-full ${ESTADOS_PRES[p.estado]?.clase}`}>
                            {ESTADOS_PRES[p.estado]?.label}
                          </span>
                        </div>
                        <p className="text-white font-semibold">{p.titulo}</p>
                        <p className="text-gray-400 text-sm">{p.clientes?.nombre || '—'}</p>
                        {p.observaciones && <p className="text-gray-500 text-xs mt-1">{p.observaciones}</p>}
                      </div>
                      <div className="text-right">
                        <p className="text-white font-bold font-mono text-lg">{(p.importe || 0).toFixed(2)} EUR</p>
                        <p className="text-gray-500 text-xs">{p.fecha_envio ? new Date(p.fecha_envio).toLocaleDateString('es-ES') : '—'}</p>
                      </div>
                    </div>
                    <div className="border-t border-gray-800 pt-3 flex flex-wrap gap-2">
                      <p className="text-gray-500 text-xs mr-2 self-center">Cambiar estado:</p>
                      {Object.entries(ESTADOS_PRES).map(([key, val]: any) => (
                        <button
                          key={key}
                          onClick={() => cambiarEstadoPres(p.id, key)}
                          className={`text-xs px-3 py-1 rounded-full border transition-opacity ${val.clase} ${p.estado === key ? 'opacity-100 ring-2 ring-white ring-opacity-30' : 'opacity-50 hover:opacity-80'}`}
                        >
                          {val.label}
                        </button>
                      ))}
                      <button onClick={() => abrirFormPres(p)} className="ml-auto bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1 rounded text-xs">
                        Editar
                      </button>
                      <button onClick={() => eliminarPres(p.id)} className="bg-gray-800 hover:bg-gray-700 text-red-400 px-3 py-1 rounded text-xs">
                        Eliminar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}