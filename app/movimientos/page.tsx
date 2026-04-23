'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function Movimientos() {
  const [movimientos, setMovimientos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroTecnico, setFiltroTecnico] = useState('')
  const [tecnicos, setTecnicos] = useState<any[]>([])
  const router = useRouter()

  useEffect(() => {
    verificarSesion()
    cargarDatos()
  }, [])

  async function verificarSesion() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) router.push('/login')
  }

  async function cargarDatos() {
    const [movs, tecs] = await Promise.all([
      supabase.from('movimientos').select('*, materiales(nombre, unidad), equipos(codigo, tipo), ordenes(codigo), perfiles(nombre)').order('fecha', { ascending: false }).limit(200),
      supabase.from('perfiles').select('*').order('nombre'),
    ])
    if (movs.data) setMovimientos(movs.data)
    if (tecs.data) setTecnicos(tecs.data)
    setLoading(false)
  }

  const TIPOS: any = {
    consumo: { label: 'Consumo material', color: '#fb923c', bg: 'rgba(249,115,22,0.15)', icono: '📦' },
    salida: { label: 'Salida equipo', color: '#fbbf24', bg: 'rgba(234,179,8,0.15)', icono: '⚙️' },
    retorno: { label: 'Retorno equipo', color: '#34d399', bg: 'rgba(16,185,129,0.15)', icono: '↩️' },
    entrada: { label: 'Entrada stock', color: '#06b6d4', bg: 'rgba(6,182,212,0.15)', icono: '📥' },
    ajuste: { label: 'Ajuste stock', color: '#a78bfa', bg: 'rgba(124,58,237,0.15)', icono: '✏️' },
  }

  const movimientosFiltrados = movimientos.filter(m => {
    if (filtroTipo && m.tipo !== filtroTipo) return false
    if (filtroTecnico && m.tecnico_id !== filtroTecnico) return false
    return true
  })

  const totalConsumos = movimientos.filter(m => m.tipo === 'consumo').length
  const totalSalidas = movimientos.filter(m => m.tipo === 'salida').length
  const totalEntradas = movimientos.filter(m => m.tipo === 'entrada').length

  const inputStyle = { background: '#080b14', border: '1px solid #1e2d3d', color: 'white' }
  const cardStyle = { background: '#0d1117', border: '1px solid #1e2d3d' }

  return (
    <div className="min-h-screen" style={{ background: '#080b14' }}>
      <div className="px-6 py-4 flex items-center justify-between flex-wrap gap-3" style={cardStyle}>
        <div className="flex items-center gap-4">
          <a href="/dashboard" className="text-sm transition-colors" style={{ color: '#475569' }}
            onMouseEnter={e => e.currentTarget.style.color = '#06b6d4'}
            onMouseLeave={e => e.currentTarget.style.color = '#475569'}>Dashboard</a>
          <h1 className="text-white font-bold text-lg">Movimientos</h1>
        </div>
      </div>

      <div className="p-6 max-w-5xl mx-auto">
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Consumos material', valor: totalConsumos, color: '#fb923c', bg: 'rgba(249,115,22,0.08)', border: 'rgba(249,115,22,0.2)' },
            { label: 'Salidas equipo', valor: totalSalidas, color: '#fbbf24', bg: 'rgba(234,179,8,0.08)', border: 'rgba(234,179,8,0.2)' },
            { label: 'Entradas stock', valor: totalEntradas, color: '#06b6d4', bg: 'rgba(6,182,212,0.08)', border: 'rgba(6,182,212,0.2)' },
          ].map((s, i) => (
            <div key={i} className="rounded-2xl p-4 text-center" style={{ background: s.bg, border: `1px solid ${s.border}` }}>
              <p className="text-3xl font-bold" style={{ color: s.color }}>{s.valor}</p>
              <p className="text-sm mt-1" style={{ color: s.color }}>{s.label}</p>
            </div>
          ))}
        </div>

        <div className="flex gap-3 mb-6 flex-wrap">
          <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}
            className="text-sm rounded-xl px-3 py-2 outline-none" style={inputStyle}>
            <option value="">Todos los tipos</option>
            <option value="consumo">Consumo material</option>
            <option value="salida">Salida equipo</option>
            <option value="retorno">Retorno equipo</option>
            <option value="entrada">Entrada stock</option>
            <option value="ajuste">Ajuste stock</option>
          </select>
          <select value={filtroTecnico} onChange={e => setFiltroTecnico(e.target.value)}
            className="text-sm rounded-xl px-3 py-2 outline-none" style={inputStyle}>
            <option value="">Todos los trabajadores</option>
            {tecnicos.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
          </select>
          {(filtroTipo || filtroTecnico) && (
            <button onClick={() => { setFiltroTipo(''); setFiltroTecnico('') }}
              className="text-sm px-4 py-2 rounded-xl"
              style={{ background: '#080b14', color: '#64748b', border: '1px solid #1e2d3d' }}>
              Limpiar filtros
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#7c3aed', borderTopColor: 'transparent' }}></div>
          </div>
        ) : movimientosFiltrados.length === 0 ? (
          <div className="text-center py-20 rounded-2xl" style={cardStyle}>
            <p className="text-5xl mb-4">📊</p>
            <p style={{ color: '#475569' }}>No hay movimientos registrados.</p>
            <p className="text-xs mt-2" style={{ color: '#334155' }}>Los movimientos se registran al escanear QR o ajustar stock.</p>
          </div>
        ) : (
          <div className="rounded-2xl overflow-hidden" style={cardStyle}>
            <div className="px-4 py-3" style={{ borderBottom: '1px solid #1e2d3d' }}>
              <p className="text-sm" style={{ color: '#475569' }}>{movimientosFiltrados.length} movimientos</p>
            </div>
            <div className="flex flex-col">
              {movimientosFiltrados.map(m => (
                <div key={m.id} className="px-4 py-4 transition-colors" style={{ borderBottom: '1px solid #1e2d3d' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(124,58,237,0.05)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <div className="flex items-start justify-between flex-wrap gap-3">
                    <div className="flex items-start gap-3">
                      <span className="text-2xl mt-0.5">{TIPOS[m.tipo]?.icono || '📋'}</span>
                      <div>
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: TIPOS[m.tipo]?.bg, color: TIPOS[m.tipo]?.color }}>
                            {TIPOS[m.tipo]?.label || m.tipo}
                          </span>
                          {m.ordenes?.codigo && (
                            <span className="font-mono text-xs" style={{ color: '#06b6d4' }}>OT: {m.ordenes.codigo}</span>
                          )}
                        </div>
                        {m.materiales && (
                          <p className="text-white font-medium text-sm">
                            {m.materiales.nombre}
                            <span className="font-normal ml-2" style={{ color: '#64748b' }}>
                              — {m.cantidad} {m.materiales.unidad || 'uds'}
                            </span>
                          </p>
                        )}
                        {m.equipos && (
                          <p className="text-white font-medium text-sm">
                            <span className="font-mono" style={{ color: '#06b6d4' }}>{m.equipos.codigo}</span>
                            <span className="font-normal ml-2 capitalize" style={{ color: '#64748b' }}>— {m.equipos.tipo}</span>
                          </p>
                        )}
                        {m.observaciones && <p className="text-xs mt-1" style={{ color: '#475569' }}>{m.observaciones}</p>}
                        <p className="text-xs mt-1" style={{ color: '#334155' }}>Trabajador: {m.perfiles?.nombre || '—'}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm" style={{ color: '#475569' }}>
                        {m.fecha ? new Date(m.fecha).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'}
                      </p>
                      <p className="text-xs" style={{ color: '#334155' }}>
                        {m.fecha ? new Date(m.fecha).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : ''}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}