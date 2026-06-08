'use client'

import { useSesion } from '@/lib/sesion'

const KPIS_PLACEHOLDER = [
  { label: 'Ventas aceptadas del mes', color: 'var(--brand-1)' },
  { label: 'Cobros recibidos', color: 'var(--green)' },
  { label: 'Facturación emitida', color: 'var(--teal)' },
  { label: 'Facturación prevista', color: 'var(--violet)' },
  { label: 'Pendiente de ejecutar', color: 'var(--amber)' },
  { label: 'Listos para facturar', color: 'var(--brand-1)' },
  { label: 'Gastos reales del mes', color: 'var(--red)' },
  { label: 'Margen real del mes', color: 'var(--green)' },
]

export default function DashboardPage() {
  const { perfil } = useSesion()

  const hoy = new Date().toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })

  return (
    <div>
      <header className="mb-6">
        <p className="text-sm" style={{ color: 'var(--text-subtle)' }}>
          {hoy.charAt(0).toUpperCase() + hoy.slice(1)}
        </p>
        <h1 className="titulo-hero" style={{ color: 'var(--text)' }}>
          Hola{perfil?.nombre ? `, ${perfil.nombre.split(' ')[0]}` : ''} 👋
        </h1>
        <p className="mt-1" style={{ color: 'var(--text-muted)' }}>
          Dónde está parada la empresa este mes — de un vistazo.
        </p>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {KPIS_PLACEHOLDER.map((k) => (
          <div key={k.label} className="card card-hover p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="inline-block rounded-full" style={{ width: 8, height: 8, background: k.color }} />
              <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{k.label}</span>
            </div>
            <div className="skeleton" style={{ height: 28, width: '70%' }} />
          </div>
        ))}
      </div>

      <div
        className="card mt-6 p-5 text-sm flex items-start gap-3"
        style={{ background: 'color-mix(in srgb, var(--brand-1) 6%, var(--bg-card))' }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--brand-1)"
          strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
          <circle cx="12" cy="12" r="10" /><path d="M12 16v-4m0-4h.01" />
        </svg>
        <div style={{ color: 'var(--text-muted)' }}>
          <span className="font-semibold" style={{ color: 'var(--text)' }}>Cimientos listos.</span>{' '}
          Próximo paso: crear las tablas en Supabase y conectar los datos reales
          (ventas, cobros, gastos, IVA y márgenes). Estas tarjetas se rellenarán entonces.
        </div>
      </div>
    </div>
  )
}
