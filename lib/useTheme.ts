'use client'

import { useEffect, useState } from 'react'

export function useTheme() {
  const [tema, setTema] = useState<'dark' | 'light'>('dark')

  useEffect(() => {
    const guardado = localStorage.getItem('tema') as 'dark' | 'light' || 'dark'
    setTema(guardado)
    document.documentElement.setAttribute('data-theme', guardado)
  }, [])

  function toggleTema() {
    const nuevo = tema === 'dark' ? 'light' : 'dark'
    setTema(nuevo)
    localStorage.setItem('tema', nuevo)
    document.documentElement.setAttribute('data-theme', nuevo)
  }

  return { tema, toggleTema }
}