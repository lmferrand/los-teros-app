'use client'

import { useEffect, useState } from 'react'

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [tema, setTema] = useState<'dark' | 'light'>('dark')
  const [montado, setMontado] = useState(false)

  useEffect(() => {
    const guardado = localStorage.getItem('tema') as 'dark' | 'light' || 'dark'
    setTema(guardado)
    aplicarTema(guardado)
    setMontado(true)
  }, [])

  function aplicarTema(t: 'dark' | 'light') {
    const root = document.documentElement
    if (t === 'light') {
      root.classList.add('light')
    } else {
      root.classList.remove('light')
    }
  }

  function toggleTema() {
    const nuevo = tema === 'dark' ? 'light' : 'dark'
    setTema(nuevo)
    localStorage.setItem('tema', nuevo)
    aplicarTema(nuevo)
  }

  if (!montado) return <>{children}</>

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