'use client'

import { useTheme } from '@/lib/useTheme'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function Dashboard() {
  const [user, setUser] = useState<any>(null)
  const [perfil, setPerfil] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    otActivas: 0, otMes: 0, stockBajo: 0,
    equiposCampo: 0, clientesTeros: 0, clientesOlipro: 0, otPendientes: 0,
  })
  const [misOrdenes, setMisOrdenes] = useState<any[]>([])
  const [alertas, setAlertas] = useState<{ tipo: string; texto: string }[]>([])
  const router = useRouter()
  const { tema, toggleTema } = useTheme()

  useEffect(() => { cargarDatos() }, [])

  async function cargarDatos() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }
    setUser(session.user)

    let { data: perfilData } = await supabase.from('perfiles').select('*').eq('id', session.user.id).single()
    if (!perfilData) {
      const { data: nuevoPerfil } = await supabase.from('perfiles').insert({
        id: session.user.id,
        nombre: session.user.email?.split('@')[0] || 'Usuario',
        rol: 'tecnico',
      }).select().single()
      perfilData = nuevoPerfil
    }
    setPerfil(perfilData)

    const [ordenes, materiales, equipos] = await Promise.all([
      supabase.from('ordenes').select('*'),
      supabase.from('materiales').select('*'),
      supabase.from('equipos').select('*'),
    ])

    const { count: countTeros } = await (supabase.from('clientes') as any).select('*', { count: 'exact', head: true }).eq('empresa', 'teros')
    const { count: countOlipro } = await (supabase.from('clientes') as any).select('*', { count: 'exact', head: true }).eq('empresa', 'olipro')

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
      otActivas: otActivas.length, otMes: otMes.length,
      stockBajo: stockBajo.length, equiposCampo: equiposCampo.length,
      clientesTeros: countTeros || 0,
      clientesOlipro: countOlipro || 0,
      otPendientes: todasOrdenes.filter(o => o.estado === 'pendiente').length,
    })
    setMisOrdenes(misMisOrdenes)

    const nuevasAlertas: { tipo: string; texto: string }[] = []
    stockBajo.forEach(m => nuevasAlertas.push({ tipo: 'warning', texto: `Stock bajo: ${m.nombre} (${m.stock || 0} ${m.unidad || ''})` }))
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
    gerente: 'Gerente', oficina: 'Oficina', tecnico: 'Tecnico',
    almacen: 'Almacen', supervisor: 'Supervisor',
  }

  const esTecnico = perfil?.rol === 'tecnico' || perfil?.rol === 'almacen'

  const MODULOS = [
    { href: '/ordenes', icono: '📋', titulo: 'Ordenes', desc: 'Crear y gestionar', siempre: true },
    { href: '/planificacion', icono: '📅', titulo: 'Planificacion', desc: 'Calendario y rutas', siempre: true },
    { href: '/inventario', icono: '📦', titulo: 'Inventario', desc: 'Stock y materiales', siempre: true },
    { href: '/equipos', icono: '⚙️', titulo: 'Equipos', desc: 'Turbinas y motores', siempre: true },
    { href: '/albaranes', icono: '🧾', titulo: 'Albaranes', desc: 'Con fotos y firma', siempre: true },
    { href: '/asistente', icono: '🤖', titulo: 'Asistente IA', desc: 'Pregunta a la IA', siempre: true },
    { href: '/movimientos', icono: '📊', titulo: 'Movimientos', desc: 'Historial consumos', siempre: true },
    { href: '/clientes', icono: '🏢', titulo: 'Clientes', desc: 'Fichas y contacto', soloAdmin: true },
    { href: '/trabajadores', icono: '👷', titulo: 'Trabajadores', desc: 'Gestion personal', soloAdmin: true },
  ]

  const bgCard = tema === 'dark' ? '#0d1117' : '#ffffff'
  const bgMain = tema === 'dark' ? '#080b14' : '#f8fafc'
  const border = tema === 'dark' ? '#1e2d3d' : '#e2e8f0'
  const textColor = tema === 'dark' ? 'white' : '#0f172a'
  const textMuted = tema === 'dark' ? '#475569' : '#64748b'

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: bgMain }}>
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
        <p className="text-sm" style={{ color: textMuted }}>Cargando...</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen" style={{ background: bgMain }}>
      <div className="px-6 py-4 flex items-center justify-between flex-wrap gap-3" style={{ background: bgCard, borderBottom: `1px solid ${border}` }}>
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Los Teros" className="w-10 h-10 object-contain" style={{ mixBlendMode: tema === 'dark' ? 'screen' : 'normal' }} />
          <div>
            <h1 className="font-bold text-lg leading-tight" style={{ color: textColor }}>LOS TEROS</h1>
            <p className="text-xs" style={{ color: '#06b6d4' }}>Gestion Operativa</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-sm font-medium" style={{ color: textColor }}>{perfil?.nombre || user?.email}</p>
            <p className="text-xs" style={{ color: '#8b5cf6' }}>{ROLES[perfil?.rol] || perfil?.rol}</p>
          </div>
          <button onClick={toggleTema} className="text-sm px-3 py-1.5 rounded-lg transition-all"
            style={{ background: bgMain, color: textMuted, border: `1px solid ${border}` }}>
            {tema === 'dark' ? '☀️' : '🌙'}
          </button>
          <button onClick={handleLogout} className="text-sm px-3 py-1.5 rounded-lg transition-colors"
            style={{ background: bgMain, color: textMuted, border: `1px solid ${border}` }}>
            Salir
          </button>
        </div>
      </div>

      <div className="p-6 max-w-6xl mx-auto">
        <div className="mb-8">
          <h2 className="font-semibold text-xl mb-1" style={{ color: textColor }}>
            Hola, {perfil?.nombre?.split(' ')[0] || 'bienvenido'} 👋
          </h2>
          <p className="text-sm" style={{ color: textMuted }}>
            {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>

        {misOrdenes.length > 0 && (
          <div className="rounded-xl p-5 mb-6" style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.3)' }}>
            <h3 className="font-semibold mb-3 text-sm" style={{ color: '#a78bfa' }}>Mis ordenes pendientes</h3>
            <div className="flex flex-col gap-2">
              {misOrdenes.map(o => (
                <div key={o.id} className="flex items-center justify-between rounded-lg px-4 py-3" style={{ background: 'rgba(124,58,237,0.1)' }}>
                  <div>
                    <span className="font-mono text-xs mr-2" style={{ color: '#06b6d4' }}>{o.codigo}</span>
                    <span className="text-sm" style={{ color: textColor }}>{o.descripcion?.substring(0, 50) || '—'}</span>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{
                    background: o.estado === 'en_curso' ? 'rgba(234,179,8,0.2)' : 'rgba(124,58,237,0.2)',
                    color: o.estado === 'en_curso' ? '#fbbf24' : '#a78bfa'
                  }}>
                    {o.estado.replace('_', ' ')}
                  </span>
                </div>
              ))}
            </div>
            <a href="/planificacion" className="block mt-3 text-xs hover:opacity-80 transition-opacity" style={{ color: '#06b6d4' }}>
              Ver todas mis ordenes →
            </a>
          </div>
        )}

        {alertas.length > 0 && (
          <div className="mb-6 flex flex-col gap-2">
            {alertas.map((a, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm" style={{
                background: a.tipo === 'danger' ? 'rgba(239,68,68,0.1)' : 'rgba(234,179,8,0.1)',
                border: `1px solid ${a.tipo === 'danger' ? 'rgba(239,68,68,0.3)' : 'rgba(234,179,8,0.3)'}`,
                color: a.tipo === 'danger' ? '#f87171' : '#fbbf24'
              }}>
                <span>{a.tipo === 'danger' ? '🚨' : '⚠️'}</span>
                <span>{a.texto}</span>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
          {[
            { label: 'OT Activas', valor: stats.otActivas, sub: `${stats.otPendientes} pendientes`, color: '#06b6d4' },
            { label: 'Completadas mes', valor: stats.otMes, sub: 'este mes', color: '#10b981' },
            { label: 'Clientes Teros', valor: stats.clientesTeros, sub: 'Los Teros', color: '#06b6d4' },
            { label: 'Clientes Olipro', valor: stats.clientesOlipro, sub: 'Olipro', color: '#8b5cf6' },
            { label: 'Stock bajo', valor: stats.stockBajo, sub: 'materiales criticos', color: stats.stockBajo > 0 ? '#f59e0b' : '#10b981' },
            { label: 'Equipos en campo', valor: stats.equiposCampo, sub: 'en cliente', color: '#fb923c' },
          ].map((s, i) => (
            <div key={i} className="rounded-xl p-4" style={{ background: bgCard, border: `1px solid ${border}` }}>
              <p className="text-xs uppercase tracking-wider mb-2" style={{ color: textMuted }}>{s.label}</p>
              <p className="text-3xl font-bold" style={{ color: s.color }}>{s.valor}</p>
              <p className="text-xs mt-1" style={{ color: textMuted }}>{s.sub}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {MODULOS.filter(m => m.siempre || (!esTecnico && m.soloAdmin)).map(m => (
            <a key={m.href} href={m.href} className="rounded-xl p-5 block transition-all"
              style={{ background: bgCard, border: `1px solid ${border}` }}
              onMouseEnter={e => e.currentTarget.style.borderColor = '#7c3aed'}
              onMouseLeave={e => e.currentTarget.style.borderColor = border}>
              <div className="text-2xl mb-3">{m.icono}</div>
              <h2 className="font-semibold text-sm" style={{ color: textColor }}>{m.titulo}</h2>
              <p className="text-xs mt-1" style={{ color: textMuted }}>{m.desc}</p>
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}