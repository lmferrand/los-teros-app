'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function Dashboard() {
  const [user, setUser] = useState<any>(null)
  const [perfil, setPerfil] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    otActivas: 0,
    otMes: 0,
    stockBajo: 0,
    equiposCampo: 0,
    clientes: 0,
    otPendientes: 0,
  })
  const [misOrdenes, setMisOrdenes] = useState<any[]>([])
  const [alertas, setAlertas] = useState<any[]>([])
  const router = useRouter()

  useEffect(() => {
    cargarDatos()
  }, [])

  async function cargarDatos() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }
    setUser(session.user)

    const { data: perfilData } = await supabase
      .from('perfiles')
      .select('*')
      .eq('id', session.user.id)
      .single()
    setPerfil(perfilData)

    const [ordenes, materiales, equipos, clientes] = await Promise.all([
      supabase.from('ordenes').select('*'),
      supabase.from('materiales').select('*'),
      supabase.from('equipos').select('*'),
      supabase.from('clientes').select('*'),
    ])

    const hoy = new Date()
    const mes = hoy.getMonth()
    const anio = hoy.getFullYear()
    const todasOrdenes = ordenes.data || []
    const todosMateriales = materiales.data || []
    const todosEquipos = equipos.data || []

    const otActivas = todasOrdenes.filter(o => o.estado === 'pendiente' || o.estado === 'en_curso')
    const otMes = todasOrdenes.filter(o => {
      if (!o.created_at || o.estado !== 'completada') return false
      const d = new Date(o.created_at)
      return d.getMonth() === mes && d.getFullYear() === anio
    })
    const stockBajo = todosMateriales.filter(m => (m.stock || 0) < (m.minimo || 0))
    const equiposCampo = todosEquipos.filter(e => e.estado === 'en_cliente')
    const misMisOrdenes = todasOrdenes.filter(o =>
      (o.tecnicos_ids?.includes(session.user.id) || o.tecnico_id === session.user.id) &&
      (o.estado === 'pendiente' || o.estado === 'en_curso')
    ).slice(0, 5)

    setStats({
      otActivas: otActivas.length,
      otMes: otMes.length,
      stockBajo: stockBajo.length,
      equiposCampo: equiposCampo.length,
      clientes: (clientes.data || []).length,
      otPendientes: todasOrdenes.filter(o => o.estado === 'pendiente').length,
    })

    setMisOrdenes(misMisOrdenes)

    const nuevasAlertas: { tipo: string; texto: string }[] = []
    stockBajo.forEach(m => {
      nuevasAlertas.push({ tipo: 'warning', texto: `Stock bajo: ${m.nombre} (${m.stock || 0} ${m.unidad || ''})` })
    })
    equiposCampo.forEach(e => {
      if (e.fecha_salida) {
        const dias = Math.floor((Date.now() - new Date(e.fecha_salida).getTime()) / 86400000)
        if (dias > 14) nuevasAlertas.push({ tipo: 'danger', texto: `${e.codigo} lleva ${dias} dias en cliente` })
      }
    })
    setAlertas(nuevasAlertas)
    setLoading(false)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const ROLES: any = {
    gerente: 'Gerente',
    oficina: 'Oficina',
    tecnico: 'Tecnico',
    almacen: 'Almacen',
    supervisor: 'Supervisor',
  }

  const esTecnico = perfil?.rol === 'tecnico' || perfil?.rol === 'almacen'

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <p className="text-white">Cargando...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-950">
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
  <img src="/logo.png" alt="Los Teros" className="w-12 h-12 object-contain" style={{mixBlendMode: 'screen'}} />
  <div>
    <h1 className="text-lg font-bold text-white leading-tight">LOS TEROS</h1>
    <p className="text-gray-400 text-xs">Gestion Operativa</p>
  </div>
</div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-white text-sm font-medium">{perfil?.nombre || user?.email}</p>
            <p className="text-gray-400 text-xs">{ROLES[perfil?.rol] || perfil?.rol}</p>
          </div>
          <button
            onClick={handleLogout}
            className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm"
          >
            Cerrar sesion
          </button>
        </div>
      </div>

      <div className="p-6">
        <div className="mb-6">
          <h2 className="text-white font-semibold text-lg mb-1">
            Hola, {perfil?.nombre?.split(' ')[0] || 'bienvenido'}
          </h2>
          <p className="text-gray-400 text-sm">
            {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>

        {misOrdenes.length > 0 && (
          <div className="bg-blue-950 border border-blue-800 rounded-xl p-5 mb-6">
            <h3 className="text-blue-300 font-semibold mb-3">Mis ordenes pendientes</h3>
            <div className="flex flex-col gap-2">
              {misOrdenes.map(o => (
                <div key={o.id} className="flex items-center justify-between bg-blue-900 bg-opacity-40 rounded-lg px-4 py-3">
                  <div>
                    <span className="text-blue-400 font-mono text-xs mr-2">{o.codigo}</span>
                    <span className="text-white text-sm">{o.descripcion?.substring(0, 50) || '—'}</span>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${o.estado === 'en_curso' ? 'bg-yellow-900 text-yellow-300' : 'bg-blue-900 text-blue-300'}`}>
                    {o.estado.replace('_', ' ')}
                  </span>
                </div>
              ))}
            </div>
            <a href="/planificacion" className="block mt-3 text-blue-400 text-xs hover:text-blue-300">
              Ver todas mis ordenes →
            </a>
          </div>
        )}

        {alertas.length > 0 && (
          <div className="mb-6">
            <h3 className="text-white font-semibold mb-3">Alertas</h3>
            <div className="flex flex-col gap-2">
              {alertas.map((a, i) => (
                <div key={i} className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${a.tipo === 'danger' ? 'bg-red-950 border-red-800 text-red-300' : 'bg-yellow-950 border-yellow-800 text-yellow-300'}`}>
                  <span>{a.tipo === 'danger' ? '🚨' : '⚠️'}</span>
                  <span className="text-sm">{a.texto}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <p className="text-gray-400 text-xs uppercase mb-2">OT Activas</p>
            <p className="text-3xl font-bold text-white">{stats.otActivas}</p>
            <p className="text-gray-500 text-xs mt-1">{stats.otPendientes} pendientes</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <p className="text-gray-400 text-xs uppercase mb-2">Completadas mes</p>
            <p className="text-3xl font-bold text-green-400">{stats.otMes}</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <p className="text-gray-400 text-xs uppercase mb-2">Clientes</p>
            <p className="text-3xl font-bold text-white">{stats.clientes}</p>
          </div>
          {!esTecnico && (
            <>
              <div className={`bg-gray-900 border rounded-xl p-5 ${stats.stockBajo > 0 ? 'border-yellow-700' : 'border-gray-800'}`}>
                <p className="text-gray-400 text-xs uppercase mb-2">Stock bajo</p>
                <p className={`text-3xl font-bold ${stats.stockBajo > 0 ? 'text-yellow-400' : 'text-white'}`}>{stats.stockBajo}</p>
                <p className="text-gray-500 text-xs mt-1">materiales criticos</p>
              </div>
              <div className={`bg-gray-900 border rounded-xl p-5 ${stats.equiposCampo > 0 ? 'border-blue-700' : 'border-gray-800'}`}>
                <p className="text-gray-400 text-xs uppercase mb-2">Equipos en cliente</p>
                <p className={`text-3xl font-bold ${stats.equiposCampo > 0 ? 'text-blue-400' : 'text-white'}`}>{stats.equiposCampo}</p>
              </div>
            </>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <a href="/ordenes" className="bg-gray-900 border border-gray-800 hover:border-blue-700 rounded-xl p-5 block transition-colors">
            <div className="text-2xl mb-3">📋</div>
            <h2 className="text-white font-semibold">Ordenes</h2>
            <p className="text-gray-400 text-xs mt-1">Crear y gestionar</p>
          </a>
          <a href="/planificacion" className="bg-gray-900 border border-gray-800 hover:border-blue-700 rounded-xl p-5 block transition-colors">
            <div className="text-2xl mb-3">📅</div>
            <h2 className="text-white font-semibold">Planificacion</h2>
            <p className="text-gray-400 text-xs mt-1">Calendario y mis OT</p>
          </a>
          <a href="/clientes" className="bg-gray-900 border border-gray-800 hover:border-blue-700 rounded-xl p-5 block transition-colors">
            <div className="text-2xl mb-3">🏢</div>
            <h2 className="text-white font-semibold">Clientes</h2>
            <p className="text-gray-400 text-xs mt-1">Fichas y historial</p>
          </a>
          <a href="/inventario" className="bg-gray-900 border border-gray-800 hover:border-blue-700 rounded-xl p-5 block transition-colors">
            <div className="text-2xl mb-3">📦</div>
            <h2 className="text-white font-semibold">Inventario</h2>
            <p className="text-gray-400 text-xs mt-1">Stock y materiales</p>
          </a>
          <a href="/equipos" className="bg-gray-900 border border-gray-800 hover:border-blue-700 rounded-xl p-5 block transition-colors">
            <div className="text-2xl mb-3">⚙️</div>
            <h2 className="text-white font-semibold">Equipos</h2>
            <p className="text-gray-400 text-xs mt-1">Turbinas y motores</p>
          </a>
          {!esTecnico && (
            <a href="/trabajadores" className="bg-gray-900 border border-gray-800 hover:border-blue-700 rounded-xl p-5 block transition-colors">
              <div className="text-2xl mb-3">👷</div>
              <h2 className="text-white font-semibold">Trabajadores</h2>
              <p className="text-gray-400 text-xs mt-1">Gestion de personal</p>
            </a>
          )}
        </div>
      </div>
    </div>
  )
}