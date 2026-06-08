'use client'

import { useTheme } from '@/lib/useTheme'

export default function BotonTema() {
  const { tema, toggleTema } = useTheme()
  const oscuro = tema === 'dark'

  return (
    <button
      onClick={toggleTema}
      aria-label="Cambiar tema"
      title={oscuro ? 'Modo claro' : 'Modo oscuro'}
      className="fixed top-3 right-3 z-50 grid place-items-center rounded-full transition-colors"
      style={{
        width: 40,
        height: 40,
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        color: 'var(--text-muted)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      {oscuro ? (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4m11.4-11.4 1.4-1.4" />
        </svg>
      ) : (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
        </svg>
      )}
    </button>
  )
}
