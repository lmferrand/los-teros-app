'use client'

import type { CSSProperties } from 'react'

type TabItem = {
  key: string
  label: string
  badge?: number
}

type PlanificacionTabsProps = {
  tabs: TabItem[]
  vistaActiva: string
  onCambiarVista: (key: string) => void
  btnPrimary: CSSProperties
  btnSecondary: CSSProperties
}

export function PlanificacionTabs({
  tabs,
  vistaActiva,
  onCambiarVista,
  btnPrimary,
  btnSecondary,
}: PlanificacionTabsProps) {
  return (
    <div className="flex gap-2 mb-6 flex-wrap">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onCambiarVista(tab.key)}
          className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
          style={vistaActiva === tab.key ? btnPrimary : btnSecondary}
        >
          {tab.label}
          {tab.badge && tab.badge > 0 ? (
            <span className="ml-1 text-xs px-1.5 py-0.5 rounded-full" style={{ background: '#7c3aed', color: 'white' }}>
              {tab.badge}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  )
}
