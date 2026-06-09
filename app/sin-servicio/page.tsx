'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { listarClientes } from '@/lib/db/clientes'
import { serviciosTodos, ordenesTodas, marcarLlamada } from '@/lib/db/recordatorios'
import { fechaCorta } from '@/lib/dominio'
import { EstadoVacio, SkeletonLista } from '@/app/components/ui'

interface FilaCliente {
  id: string
  nombre: string
  poblacion: string | null
  telefono: string | null
  ultima: Date
  dias: number
  contactado: boolean
  contactoAt: string | null
}

const UMBRALES = [
  { dias: 180, label: '6 meses' },
  { dias: 365, label: '1 año' },
  { dias: 730, label: '2 años' },
]

function tiempoSin(dias: number): string {
  if (dias >= 365) {
    const a = Math.floor(dias / 365)
    const m = Math.floor((dias % 365) / 30)
    return `${a} año${a > 1 ? 's' : ''}${m ? ` ${m} m` : ''}`
  }
  if (dias >= 30) return `${Math.floor(dias / 30)} meses`
  return `${dias} días`
}

export default function SinServicioPage() {
  const [clientes, setClientes] = useState<any[]>([])
  const [ultimaPorCliente, setUltimaPorCliente] = useState<Record<string, number>>({})
  const [umbral, setUmbral] = useState(365)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  async function cargar() {
    try {
      const [cli, servicios, ordenes] = await Promise.all([listarClientes(), serviciosTodos(), ordenesTodas()])
      const ultima: Record<string, number> = {}
      for (const s of [...servicios, ...ordenes]) {
        const t = new Date(`${s.fecha}T12:00:00`).getTime()
        if (isNaN(t)) continue
        if (!ultima[s.cliente_id] || t > ultima[s.cliente_id]) ultima[s.cliente_id] = t
      }
      setClientes(cli)
      setUltimaPorCliente(ultima)
    } catch (e: any) { setError(e.message || 'Error') }
    finally { setCargando(false) }
  }
  useEffect(() => { cargar() }, [])

  const ranking = useMemo<FilaCliente[]>(() => {
    const hoy = Date.now()
    const filas: FilaCliente[] = []
    for (const c of clientes) {
      const t = ultimaPorCliente[c.id]
      if (!t) continue // sin historial conocido
      const dias = Math.floor((hoy - t) / 86400000)
      if (dias <= umbral) continue
      const contactoAt = c.seguimiento_llamada_at ? String(c.seguimiento_llamada_at) : null
      // Si recibió un servicio después de la llamada, vuelve a pendiente.
      let contactado = Boolean(c.seguimiento_llamada_ok)
      if (contactado && contactoAt) {
        const llam = new Date(contactoAt).getTime()
        if (!isNaN(llam) && t > llam) contactado = false
      }
      filas.push({
        id: c.id, nombre: c.nombre, poblacion: c.poblacion ?? null,
        telefono: c.telefono || c.movil || null, ultima: new Date(t), dias, contactado, contactoAt,
      })
    }
    return filas.sort((a, b) => b.dias - a.dias)
  }, [clientes, ultimaPorCliente, umbral])

  const pendientes = ranking.filter((c) => !c.contactado)
  const contactados = ranking.filter((c) => c.contactado)

  async function marcar(id: string, ok: boolean) {
    // Optimista: actualiza el cliente en memoria.
    setClientes((prev) => prev.map((c) => c.id === id ? { ...c, seguimiento_llamada_ok: ok, seguimiento_llamada_at: ok ? new Date().toISOString() : null } : c))
    try { await marcarLlamada(id, ok) } catch { cargar() }
  }

  return (
    <div>
      <header className="mb-4">
        <h1 className="titulo-hero" style={{ color: 'var(--text)' }}>Recordatorio de servicio</h1>
        <p className="mt-1" style={{ color: 'var(--text-muted)' }}>Clientes que llevan tiempo sin un servicio. Llámalos y márcalos como contactados.</p>
      </header>

      {/* Umbral */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Sin servicio desde hace más de:</span>
        <div className="inline-flex rounded-xl p-1" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)' }}>
          {UMBRALES.map((u) => (
            <button key={u.dias} onClick={() => setUmbral(u.dias)} className="px-3 py-1.5 rounded-lg text-sm font-semibold" style={{ background: umbral === u.dias ? 'var(--bg-card)' : 'transparent', color: umbral === u.dias ? 'var(--brand-1)' : 'var(--text-muted)', boxShadow: umbral === u.dias ? 'var(--shadow-sm)' : 'none' }}>{u.label}</button>
          ))}
        </div>
      </div>

      {error && <div className="card p-4 mb-4 text-sm" style={{ color: 'var(--red)' }}>{error}</div>}

      {cargando ? <SkeletonLista /> : ranking.length === 0 ? (
        <EstadoVacio titulo="¡Todo al día!" texto={`Ningún cliente lleva más de ${UMBRALES.find((u) => u.dias === umbral)?.label} sin servicio (según el historial disponible).`} />
      ) : (
        <div className="flex flex-col gap-6">
          <Seccion titulo="Pendientes de contactar" color="var(--red)" filas={pendientes} accion={(c) => (
            <button onClick={() => marcar(c.id, true)} className="text-xs font-semibold rounded-lg px-2.5 py-1.5 marca-gradiente text-white">Marcar contactado</button>
          )} />
          <Seccion titulo="Contactados" color="var(--green)" filas={contactados} accion={(c) => (
            <button onClick={() => marcar(c.id, false)} className="text-xs font-semibold rounded-lg px-2.5 py-1.5" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>Reabrir</button>
          )} />
        </div>
      )}
    </div>
  )
}

function Seccion({ titulo, color, filas, accion }: { titulo: string; color: string; filas: FilaCliente[]; accion: (c: FilaCliente) => React.ReactNode }) {
  if (filas.length === 0) return null
  return (
    <section>
      <div className="flex items-center gap-2 mb-2">
        <span className="inline-block rounded-full" style={{ width: 9, height: 9, background: color }} />
        <h2 className="font-semibold" style={{ color: 'var(--text)' }}>{titulo}</h2>
        <span className="rounded-full text-xs font-bold px-2 py-0.5" style={{ background: `color-mix(in srgb, ${color} 14%, transparent)`, color }}>{filas.length}</span>
      </div>
      <div className="flex flex-col gap-2">
        {filas.map((c) => (
          <div key={c.id} className="card p-3.5 flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <Link href={`/clientes/${c.id}`} className="font-semibold truncate block hover:underline" style={{ color: 'var(--text)' }}>{c.nombre}</Link>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {c.poblacion ? `${c.poblacion} · ` : ''}último servicio {fechaCorta(c.ultima.toISOString())}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-sm font-bold" style={{ color }}>{tiempoSin(c.dias)}</div>
              <div className="text-[11px]" style={{ color: 'var(--text-subtle)' }}>sin servicio</div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {c.telefono && (
                <a href={`tel:${c.telefono}`} className="grid place-items-center rounded-lg" style={{ width: 34, height: 34, background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--brand-1)' }} title={`Llamar ${c.telefono}`}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z" /></svg>
                </a>
              )}
              {accion(c)}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
