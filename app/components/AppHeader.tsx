'use client'

import Link from 'next/link'
import { ReactNode } from 'react'
import { useTheme } from '@/lib/useTheme'
import { s } from '@/lib/styles'

type AppHeaderProps = {
  title: ReactNode
  leftSlot?: ReactNode
  rightSlot?: ReactNode
}

export default function AppHeader({ title, leftSlot, rightSlot }: AppHeaderProps) {
  const { tema, toggleTema } = useTheme()

  return (
    <div className="px-6 py-4 flex items-center justify-between flex-wrap gap-3" style={s.headerStyle}>
      <div className="flex items-center gap-4 min-w-0">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-sm font-medium transition-opacity hover:opacity-85"
          style={{ color: 'var(--text-muted)' }}
          title="Ir al inicio"
          aria-label="Ir al inicio"
        >
          <img src="/logo.png" alt="Los Teros" className="h-6 w-auto object-contain" />
          <span>Inicio</span>
        </Link>
        {leftSlot}
        <h1 className="font-bold text-lg leading-tight" style={{ color: 'var(--text)' }}>
          {title}
        </h1>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        {rightSlot}
        <button
          onClick={toggleTema}
          className="text-sm px-3 py-1.5 rounded-lg font-medium transition-transform hover:scale-[1.03] active:scale-[0.98]"
          style={{
            background: tema === 'dark'
              ? 'linear-gradient(135deg, #f59e0b, #ef4444)'
              : 'linear-gradient(135deg, #7c3aed, #06b6d4)',
            color: 'white',
            border: '1px solid rgba(255,255,255,0.22)',
          }}
          title={tema === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          aria-label={tema === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
        >
          {tema === 'dark' ? 'Claro' : 'Oscuro'}
        </button>
      </div>
    </div>
  )
}
