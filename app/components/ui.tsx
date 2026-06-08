'use client'

import type { EstadoVenta } from '@/lib/tipos'
import { ESTADO_LABEL, ESTADO_COLOR, colorMargen, pct } from '@/lib/dominio'

// Chip de estado de la venta
export function EstadoChip({ estado }: { estado: EstadoVenta }) {
  const color = ESTADO_COLOR[estado]
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full text-xs font-semibold px-2.5 py-1 whitespace-nowrap"
      style={{ background: `color-mix(in srgb, ${color} 14%, transparent)`, color }}
    >
      <span className="inline-block rounded-full" style={{ width: 6, height: 6, background: color }} />
      {ESTADO_LABEL[estado]}
    </span>
  )
}

// Chip de % de margen con semáforo
export function ChipMargen({ valor, etiqueta }: { valor: number | null; etiqueta?: string }) {
  const color = colorMargen(valor)
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full text-xs font-semibold px-2.5 py-1 whitespace-nowrap"
      style={{ background: `color-mix(in srgb, ${color} 14%, transparent)`, color }}
    >
      {etiqueta && <span style={{ opacity: 0.8 }}>{etiqueta}</span>}
      {pct(valor)}
    </span>
  )
}

export function EstadoVacio({ titulo, texto, accion }: { titulo: string; texto?: string; accion?: React.ReactNode }) {
  return (
    <div className="card p-10 text-center flex flex-col items-center gap-3">
      <div className="grid place-items-center rounded-2xl" style={{ width: 56, height: 56, background: 'var(--bg-subtle)' }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--text-subtle)"
          strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 12h6m-6 4h6m-6-8h6M6 2h9l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Z" />
        </svg>
      </div>
      <div>
        <div className="font-semibold" style={{ color: 'var(--text)' }}>{titulo}</div>
        {texto && <div className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{texto}</div>}
      </div>
      {accion}
    </div>
  )
}

export function SkeletonLista({ filas = 5 }: { filas?: number }) {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: filas }).map((_, i) => (
        <div key={i} className="card p-4 flex items-center gap-4">
          <div className="skeleton" style={{ height: 18, width: '30%' }} />
          <div className="skeleton" style={{ height: 18, width: '20%', marginLeft: 'auto' }} />
          <div className="skeleton" style={{ height: 18, width: 80 }} />
        </div>
      ))}
    </div>
  )
}

// Campo etiqueta + valor para fichas
export function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-medium mb-0.5" style={{ color: 'var(--text-subtle)' }}>{label}</div>
      <div className="text-sm" style={{ color: 'var(--text)' }}>{children ?? '—'}</div>
    </div>
  )
}

// Botón con estilo de marca (link o acción)
export function botonPrimarioClase() {
  return 'inline-flex items-center gap-2 rounded-xl font-semibold px-4 py-2.5 text-white'
}
