'use client'

import Link from 'next/link'
import type { CSSProperties } from 'react'

type VistaActiva = 'calendario' | 'mis_ordenes' | 'presupuestos' | 'rutas'

type PlanificacionHeaderProps = {
  vistaActiva: VistaActiva
  tituloMes: string
  esAdminOOficina: boolean
  onMesAnterior: () => void
  onMesSiguiente: () => void
  onNuevoPresupuesto: () => void
  btnSecondary: CSSProperties
  btnPrimary: CSSProperties
  headerStyle: CSSProperties
}

export function PlanificacionHeader({
  vistaActiva,
  tituloMes,
  esAdminOOficina,
  onMesAnterior,
  onMesSiguiente,
  onNuevoPresupuesto,
  btnSecondary,
  btnPrimary,
  headerStyle,
}: PlanificacionHeaderProps) {
  return (
    <div className="px-6 py-4 flex items-center justify-between flex-wrap gap-3" style={headerStyle}>
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard"
          className="text-sm transition-colors"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#06b6d4')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
        >
          Dashboard
        </Link>
        <h1 className="font-bold text-lg" style={{ color: 'var(--text)' }}>
          Planificacion
        </h1>
      </div>

      {vistaActiva === 'calendario' && (
        <div className="flex items-center gap-3">
          <button onClick={onMesAnterior} className="text-sm px-3 py-2 rounded-xl" style={btnSecondary}>
            Anterior
          </button>
          <span className="font-mono font-bold text-sm min-w-40 text-center" style={{ color: 'var(--text)' }}>
            {tituloMes}
          </span>
          <button onClick={onMesSiguiente} className="text-sm px-3 py-2 rounded-xl" style={btnSecondary}>
            Siguiente
          </button>
        </div>
      )}

      {vistaActiva === 'presupuestos' && esAdminOOficina && (
        <button onClick={onNuevoPresupuesto} className="text-sm px-4 py-2 rounded-xl font-medium" style={btnPrimary}>
          + Nuevo presupuesto
        </button>
      )}
    </div>
  )
}
