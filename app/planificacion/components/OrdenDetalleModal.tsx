'use client'

import type { CSSProperties } from 'react'

type OrdenDetalleModalProps = {
  orden: any | null
  estadosOt: Record<string, { bg: string; color: string }>
  getNombreClienteOt: (ot: any) => string
  getNombresTecnicos: (ids: string[]) => string
  btnPrimary: CSSProperties
  btnSecondary: CSSProperties
  onClose: () => void
  onVerEnOt: () => void
}

export function OrdenDetalleModal({
  orden,
  estadosOt,
  getNombreClienteOt,
  getNombresTecnicos,
  btnPrimary,
  btnSecondary,
  onClose,
  onVerEnOt,
}: OrdenDetalleModalProps) {
  if (!orden) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center" style={{ background: 'rgba(0,0,0,0.85)' }}>
      <div className="w-full md:max-w-lg rounded-t-2xl md:rounded-2xl overflow-y-auto" style={{ maxHeight: '92vh', background: 'var(--card)', border: '1px solid var(--border)' }}>
        <div className="sticky top-0 px-6 py-4 flex items-start justify-between rounded-t-2xl" style={{ background: 'var(--card)', borderBottom: '1px solid var(--border)' }}>
          <div>
            <span className="font-mono text-sm" style={{ color: '#06b6d4' }}>{orden.codigo}</span>
            <h2 className="font-bold text-lg mt-1" style={{ color: 'var(--text)' }}>{getNombreClienteOt(orden)}</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center mt-1"
            style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}
          >
            X
          </button>
        </div>
        <div className="p-6 pb-16">
          {[
            { label: 'Tipo', val: <span className="text-white capitalize">{orden.tipo}</span> },
            {
              label: 'Estado',
              val: (
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: estadosOt[orden.estado]?.bg, color: estadosOt[orden.estado]?.color }}>
                  {String(orden.estado || '').replace('_', ' ')}
                </span>
              ),
            },
            { label: 'Duración', val: <span style={{ color: 'var(--text)' }}>{orden.duracion_horas || 2}h</span> },
            {
              label: 'Fecha',
              val: (
                <span className="text-xs" style={{ color: 'var(--text)' }}>
                  {new Date(orden.fecha_programada).toLocaleDateString('es-ES', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              ),
            },
            { label: 'Trabajadores', val: <span className="text-xs" style={{ color: 'var(--text)' }}>{getNombresTecnicos(orden.tecnicos_ids || [])}</span> },
          ].map((item, i) => (
            <div key={i} className="flex justify-between items-center py-2" style={{ borderBottom: '1px solid var(--border)' }}>
              <span style={{ color: 'var(--text-muted)' }} className="text-sm">{item.label}</span>
              {item.val}
            </div>
          ))}
          {orden.descripcion && (
            <div className="mt-4">
              <p className="text-xs uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Trabajos</p>
              <p className="text-sm rounded-xl p-3 leading-relaxed" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}>
                {orden.descripcion}
              </p>
            </div>
          )}
          <div className="flex gap-3 mt-5">
            <button onClick={onVerEnOt} className="text-sm px-4 py-2 rounded-xl font-medium" style={btnPrimary}>
              Ver en OT
            </button>
            <button onClick={onClose} className="text-sm px-4 py-2 rounded-xl" style={btnSecondary}>
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
