'use client'

import { useEffect, useState } from 'react'

const TEMAS = {
  dark: {
    '--bg': '#080b14',
    '--bg-card': '#0d1117',
    '--border': '#1e2d3d',
    '--text': '#e2e8f0',
    '--text-muted': '#475569',
    '--text-subtle': '#334155',
  },
  light: {
    '--bg': '#f1f5f9',
    '--bg-card': '#ffffff',
    '--border': '#e2e8f0',
    '--text': '#0f172a',
    '--text-muted': '#64748b',
    '--text-subtle': '#94a3b8',
  }
}

function aplicarTema(t: 'dark' | 'light') {
  const vars = TEMAS[t]
  const root = document.documentElement
  Object.entries(vars).forEach(([key, value]) => {
    root.style.setProperty(key, value)
  })
  root.classList.toggle('light', t === 'light')
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [tema, setTema] = useState<'dark' | 'light'>('dark')

  useEffect(() => {
    const guardado = (localStorage.getItem('tema') as 'dark' | 'light') || 'dark'
    setTema(guardado)
    aplicarTema(guardado)
  }, [])

  function toggleTema() {
    const nuevo = tema === 'dark' ? 'light' : 'dark'
    setTema(nuevo)
    localStorage.setItem('tema', nuevo)
    aplicarTema(nuevo)
  }

  return (
    <>
      {children}
      <button
        onClick={toggleTema}
        className="fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full flex items-center justify-center text-xl shadow-lg transition-all hover:scale-110 active:scale-95"
        style={{
          background: tema === 'dark'
            ? 'linear-gradient(135deg, #7c3aed, #06b6d4)'
            : 'linear-gradient(135deg, #f59e0b, #ef4444)',
          boxShadow: tema === 'dark'
            ? '0 0 20px rgba(124,58,237,0.4)'
            : '0 0 20px rgba(245,158,11,0.4)',
        }}
        title={tema === 'dark' ? 'Modo claro' : 'Modo oscuro'}
      >
        {tema === 'dark' ? '☀️' : '🌙'}
      </button>
    </>
  )
}