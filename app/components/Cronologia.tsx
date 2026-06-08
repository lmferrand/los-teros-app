'use client'

import type { EstadoVenta } from '@/lib/tipos'
import { CRONOLOGIA, hitoAlcanzado } from '@/lib/dominio'

// Línea cronológica del presupuesto:
// Aceptado → Cobrado → Programado → Ejecutado → Pendiente de cierre →
// Listo para facturar → Facturado → Cerrado
export default function Cronologia({ estado }: { estado: EstadoVenta }) {
  return (
    <div className="flex items-start overflow-x-auto pb-2">
      {CRONOLOGIA.map((paso, i) => {
        const hecho = hitoAlcanzado(estado, i)
        const siguienteHecho = hitoAlcanzado(estado, i + 1)
        const esUltimo = i === CRONOLOGIA.length - 1
        return (
          <div key={paso.hito} className="flex items-start" style={{ minWidth: 78 }}>
            <div className="flex flex-col items-center" style={{ width: 78 }}>
              <div
                className="grid place-items-center rounded-full shrink-0"
                style={{
                  width: 28,
                  height: 28,
                  background: hecho ? 'var(--brand-1)' : 'var(--bg-subtle)',
                  color: hecho ? 'white' : 'var(--text-subtle)',
                  border: hecho ? 'none' : '1px solid var(--border)',
                }}
              >
                {hecho ? (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                ) : (
                  <span className="text-xs font-semibold">{i + 1}</span>
                )}
              </div>
              <span
                className="text-[10px] text-center mt-1.5 leading-tight px-1"
                style={{ color: hecho ? 'var(--text)' : 'var(--text-subtle)', fontWeight: hecho ? 600 : 500 }}
              >
                {paso.label}
              </span>
            </div>
            {!esUltimo && (
              <div
                className="h-0.5 rounded-full mt-3.5"
                style={{
                  width: 24,
                  marginLeft: -2,
                  marginRight: -2,
                  background: siguienteHecho ? 'var(--brand-1)' : 'var(--border)',
                }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
