'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useParams } from 'next/navigation'
import { s } from '@/lib/styles'

export default function ClienteDetalle() {
  const [cliente, setCliente] = useState<any>(null)
  const [ordenes, setOrdenes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [ordenAbierta, setOrdenAbierta] = useState<string | null>(null)
  const [fotasPorOrden, setFotosPorOrden] = useState<Record<string, any[]>>({})
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  useEffect(() => {
    verificarSesion()
    cargarDatos()
  }, [])

  async function verificarSesion() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) router.push('/login')
  }

  async function cargarDatos() {
    const [cli, ords] = await Promise.all([
      supabase.from('clientes').select('*').eq('id', id).single(),
      supabase.from('ordenes').select('*').eq('cliente_id', id).eq('estado', 'completada').order('fecha_programada', { ascending: false }),
    ])
    if (cli.data) setCliente(cli.data)
    if (ords.data) {
      setOrdenes(ords.data)
      const ordenIds = ords.data.map((o: any) => o.id)
      if (ordenIds.length > 0) {
        const { data: fotos } = await supabase.from('fotos_ordenes').select('*').in('orden_id', ordenIds)
        const fotosPorOrdenMap: Record<string, any[]> = {}
        for (const ot of ords.data) {
          fotosPorOrdenMap[ot.id] = (fotos || []).filter((f: any) => f.orden_id === ot.id)
        }
        setFotosPorOrden(fotosPorOrdenMap)
      }
    }
    setLoading(false)
  }

  function toggleOrden(ordenId: string) {
    setOrdenAbierta(prev => prev === ordenId ? null : ordenId)
  }

  const TIPOS_FOTO: any = {
    proceso: { label: 'Fotos del proceso', icono: '🔧', color: '#06b6d4' },
    cierre: { label: 'Fotos de cierre', icono: '✅', color: '#34d399' },
    albaran: { label: 'Albaran', icono: '🧾', color: '#a78bfa' },
    equipo_salida: { label: 'Equipo al salir', icono: '📤', color: '#fbbf24' },
    equipo_retorno: { label: 'Equipo al retornar', icono: '📥', color: '#fb923c' },
  }

  const TIPO_OT: any = {
    limpieza: { color: '#06b6d4', bg: 'rgba(6,182,212,0.15)' },
    sustitucion: { color: '#fbbf24', bg: 'rgba(234,179,8,0.15)' },
    mantenimiento: { color: '#34d399', bg: 'rgba(16,185,129,0.15)' },
    instalacion: { color: '#a78bfa', bg: 'rgba(124,58,237,0.15)' },
    revision: { color: '#fb923c', bg: 'rgba(249,115,22,0.15)' },
    otro: { color: '#64748b', bg: 'rgba(71,85,105,0.15)' },
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
      <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#7c3aed', borderTopColor: 'transparent' }}></div>
    </div>
  )

  if (!cliente) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
      <p style={{ color: 'var(--text-muted)' }}>Cliente no encontrado.</p>
    </div>
  )

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <div className="px-6 py-4 flex items-center gap-4" style={s.headerStyle}>
        <a href="/clientes" className="text-sm transition-colors" style={{ color: 'var(--text-muted)' }}
          onMouseEnter={e => e.currentTarget.style.color = '#06b6d4'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
          Clientes
        </a>
        <span style={{ color: 'var(--text-subtle)' }}>→</span>
        <h1 className="font-bold text-lg" style={{ color: 'var(--text)' }}>{cliente.nombre}</h1>
      </div>

      <div className="p-6 max-w-4xl mx-auto">
        <div className="rounded-2xl p-6 mb-6" style={s.cardStyle}>
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <h2 className="text-xl font-bold mb-3" style={{ color: 'var(--text)' }}>{cliente.nombre}</h2>
              <div className="flex flex-col gap-2">
                {cliente.direccion && (
                  <div className="flex items-center gap-2">
                    <span style={{ color: 'var(--text-muted)' }}>📍</span>
                    <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(cliente.direccion)}`}
                      target="_blank" rel="noreferrer" className="text-sm" style={{ color: '#06b6d4' }}>
                      {cliente.direccion}
                    </a>
                  </div>
                )}
                {cliente.telefono && (
                  <div className="flex items-center gap-2">
                    <span style={{ color: 'var(--text-muted)' }}>📞</span>
                    <a href={`tel:${cliente.telefono}`} className="text-sm font-medium" style={{ color: '#34d399' }}>
                      {cliente.telefono}
                    </a>
                  </div>
                )}
                {cliente.email && (
                  <div className="flex items-center gap-2">
                    <span style={{ color: 'var(--text-muted)' }}>✉️</span>
                    <a href={`mailto:${cliente.email}`} className="text-sm" style={{ color: '#06b6d4' }}>
                      {cliente.email}
                    </a>
                  </div>
                )}
                {cliente.notas && (
                  <p className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>{cliente.notas}</p>
                )}
              </div>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold" style={{ color: '#7c3aed' }}>{ordenes.length}</p>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>servicios completados</p>
            </div>
          </div>
        </div>

        <h2 className="font-semibold text-lg mb-4" style={{ color: 'var(--text)' }}>Historial de servicios</h2>

        {ordenes.length === 0 ? (
          <div className="text-center py-16 rounded-2xl" style={s.cardStyle}>
            <p className="text-4xl mb-3">📋</p>
            <p style={{ color: 'var(--text-muted)' }}>No hay servicios completados para este cliente.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {ordenes.map(o => {
              const fotos = fotasPorOrden[o.id] || []
              const abierta = ordenAbierta === o.id
              return (
                <div key={o.id} className="rounded-2xl overflow-hidden transition-all" style={s.cardStyle}>
                  <button
                    onClick={() => toggleOrden(o.id)}
                    className="w-full px-5 py-4 flex items-center justify-between text-left"
                    style={{ background: 'transparent' }}
                  >
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-mono text-sm" style={{ color: '#06b6d4' }}>{o.codigo}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full capitalize" style={{ background: TIPO_OT[o.tipo]?.bg, color: TIPO_OT[o.tipo]?.color }}>
                        {o.tipo}
                      </span>
                      <span className="text-sm" style={{ color: 'var(--text)' }}>
                        {o.fecha_programada ? new Date(o.fecha_programada).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399' }}>
                        Completada
                      </span>
                      {fotos.length > 0 && (
                        <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>{fotos.length} fotos</span>
                      )}
                    </div>
                    <span className="text-lg transition-transform" style={{ color: 'var(--text-muted)', transform: abierta ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                      ▾
                    </span>
                  </button>

                  {abierta && (
                    <div className="px-5 pb-5" style={{ borderTop: '1px solid var(--border)' }}>
                      {o.descripcion && (
                        <div className="rounded-xl p-3 mt-4 mb-4" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                          <p className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Trabajo realizado</p>
                          <p className="text-sm" style={{ color: 'var(--text)' }}>{o.descripcion}</p>
                        </div>
                      )}
                      {o.observaciones && (
                        <div className="rounded-xl p-3 mb-4" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                          <p className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Observaciones</p>
                          <p className="text-sm" style={{ color: 'var(--text)' }}>{o.observaciones}</p>
                        </div>
                      )}

                      {fotos.length === 0 ? (
                        <p className="text-sm mt-4" style={{ color: 'var(--text-subtle)' }}>Sin fotos registradas.</p>
                      ) : (
                        <div className="mt-4 flex flex-col gap-5">
                          {Object.entries(TIPOS_FOTO).map(([key, info]: any) => {
                            const fotasTipo = fotos.filter((f: any) => f.tipo === key)
                            if (fotasTipo.length === 0) return null
                            return (
                              <div key={key}>
                                <p className="text-xs uppercase tracking-wider mb-3 flex items-center gap-2" style={{ color: info.color }}>
                                  <span>{info.icono}</span> {info.label}
                                </p>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                  {fotasTipo.map((f: any) => (
                                    <a key={f.id} href={f.url} target="_blank" rel="noreferrer">
                                      <img src={f.url} alt={key} className="w-full h-28 object-cover rounded-xl transition-opacity hover:opacity-80"
                                        style={{ border: '1px solid var(--border)' }} />
                                    </a>
                                  ))}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}