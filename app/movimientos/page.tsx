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
      supabase
        .from('movimientos')
        .select('*, materiales(nombre, unidad), equipos(codigo, tipo), ordenes(codigo), perfiles(nombre)')
        .order('fecha', { ascending: false })
        .limit(200),
      supabase.from('perfiles').select('*').order('nombre'),
    ])
    if (movs.data) setMovimientos(movs.data)
    if (tecs.data) setTecnicos(tecs.data)
    setLoading(false)
  }

  const TIPOS: any = {
    consumo: { label: 'Consumo material', clase: 'bg-orange-900 text-orange-300', icono: '📦' },
    salida: { label: 'Salida equipo', clase: 'bg-yellow-900 text-yellow-300', icono: '⚙️' },
    retorno: { label: 'Retorno equipo', clase: 'bg-green-900 text-green-300', icono: '↩️' },
    entrada: { label: 'Entrada stock', clase: 'bg-blue-900 text-blue-300', icono: '📥' },
    ajuste: { label: 'Ajuste stock', clase: 'bg-purple-900 text-purple-300', icono: '✏️' },
  }

  const movimientosFiltrados = movimientos.filter(m => {
    if (filtroTipo && m.tipo !== filtroTipo) return false
    if (filtroTecnico && m.tecnico_id !== filtroTecnico) return false
    return true
  })

  const totalConsumos = movimientos.filter(m => m.tipo === 'consumo').length
  const totalSalidas = movimientos.filter(m => m.tipo === 'salida').length
  const totalEntradas = movimientos.filter(m => m.tipo === 'entrada').length

  return (
    <div className="min-h-screen bg-gray-950">
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <a href="/dashboard" className="text-gray-400 hover:text-white text-sm">Dashboard</a>
          <h1 className="text-xl font-bold text-white">Movimientos</h1>
        </div>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-orange-950 border border-orange-800 rounded-xl p-4 text-center">
            <p className="text-orange-300 text-2xl font-bold">{totalConsumos}</p>
            <p className="text-orange-400 text-sm">Consumos material</p>
          </div>
          <div className="bg-yellow-950 border border-yellow-800 rounded-xl p-4 text-center">
            <p className="text-yellow-300 text-2xl font-bold">{totalSalidas}</p>
            <p className="text-yellow-400 text-sm">Salidas equipo</p>
          </div>
          <div className="bg-blue-950 border border-blue-800 rounded-xl p-4 text-center">
            <p className="text-blue-300 text-2xl font-bold">{totalEntradas}</p>
            <p className="text-blue-400 text-sm">Entradas stock</p>
          </div>
        </div>

        <div className="flex gap-3 mb-6 flex-wrap">
          <select
            value={filtroTipo}
            onChange={e => setFiltroTipo(e.target.value)}
            className="bg-gray-800 border border-gray-700 text-gray-300 text-sm rounded-lg px-3 py-2"
          >
            <option value="">Todos los tipos</option>
            <option value="consumo">Consumo material</option>
            <option value="salida">Salida equipo</option>
            <option value="retorno">Retorno equipo</option>
            <option value="entrada">Entrada stock</option>
            <option value="ajuste">Ajuste stock</option>
          </select>
          <select
            value={filtroTecnico}
            onChange={e => setFiltroTecnico(e.target.value)}
            className="bg-gray-800 border border-gray-700 text-gray-300 text-sm rounded-lg px-3 py-2"
          >
            <option value="">Todos los trabajadores</option>
            {tecnicos.map(t => (
              <option key={t.id} value={t.id}>{t.nombre}</option>
            ))}
          </select>
          {(filtroTipo || filtroTecnico) && (
            <button
              onClick={() => { setFiltroTipo(''); setFiltroTecnico('') }}
              className="bg-gray-800 hover:bg-gray-700 text-gray-400 px-3 py-2 rounded-lg text-sm"
            >
              Limpiar filtros
            </button>
          )}
        </div>

        {loading ? (
          <p className="text-gray-400">Cargando...</p>
        ) : movimientosFiltrados.length === 0 ? (
          <div className="text-center py-16 text-gray-500 bg-gray-900 rounded-xl border border-gray-800">
            <p className="text-4xl mb-3">📊</p>
            <p>No hay movimientos registrados.</p>
            <p className="text-xs mt-2">Los movimientos se registran automaticamente al escanear QR o ajustar stock.</p>
          </div>
        ) : (
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
              <p className="text-gray-400 text-sm">{movimientosFiltrados.length} movimientos</p>
            </div>
            <div className="flex flex-col divide-y divide-gray-800">
              {movimientosFiltrados.map(m => (
                <div key={m.id} className="px-4 py-4 hover:bg-gray-800 transition-colors">
                  <div className="flex items-start justify-between flex-wrap gap-3">
                    <div className="flex items-start gap-3">
                      <span className="text-2xl mt-0.5">{TIPOS[m.tipo]?.icono || '📋'}</span>
                      <div>
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${TIPOS[m.tipo]?.clase || 'bg-gray-800 text-gray-400'}`}>
                            {TIPOS[m.tipo]?.label || m.tipo}
                          </span>
                          {m.ordenes?.codigo && (
                            <span className="text-blue-400 font-mono text-xs">
                              OT: {m.ordenes.codigo}
                            </span>
                          )}
                        </div>
                        {m.materiales && (
                          <p className="text-white font-medium text-sm">
                            {m.materiales.nombre}
                            <span className="text-gray-400 font-normal ml-2">
                              — {m.cantidad} {m.materiales.unidad || 'uds'}
                            </span>
                          </p>
                        )}
                        {m.equipos && (
                          <p className="text-white font-medium text-sm">
                            {m.equipos.codigo}
                            <span className="text-gray-400 font-normal ml-2 capitalize">
                              — {m.equipos.tipo}
                            </span>
                          </p>
                        )}
                        {m.observaciones && (
                          <p className="text-gray-500 text-xs mt-1">{m.observaciones}</p>
                        )}
                        <p className="text-gray-500 text-xs mt-1">
                          Trabajador: {m.perfiles?.nombre || '—'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-gray-400 text-xs">
                        {m.fecha ? new Date(m.fecha).toLocaleDateString('es-ES', {
                          day: '2-digit', month: '2-digit', year: 'numeric'
                        }) : '—'}
                      </p>
                      <p className="text-gray-500 text-xs">
                        {m.fecha ? new Date(m.fecha).toLocaleTimeString('es-ES', {
                          hour: '2-digit', minute: '2-digit'
                        }) : ''}
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