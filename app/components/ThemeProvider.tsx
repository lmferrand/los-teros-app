'use client'

import { usePathname } from 'next/navigation'
import { useTheme } from '@/lib/useTheme'
import BotonTema from './BotonTema'
import SidebarLayout from './SidebarLayout'

// Rutas públicas: sin chrome (sidebar/barra) ni guard de sesión.
const RUTAS_PUBLICAS = ['/', '/login', '/auth']

function esPublica(pathname: string) {
  return RUTAS_PUBLICAS.some((r) => pathname === r || pathname.startsWith(r + '/'))
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Mantiene el tema aplicado y reactivo.
  useTheme()
  const pathname = usePathname()
  const publica = esPublica(pathname)

  return (
    <>
      {publica ? children : <SidebarLayout>{children}</SidebarLayout>}
      {publica && <BotonTema />}
    </>
  )
}
