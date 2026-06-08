'use client'

import { useSesion } from '@/lib/sesion'
import { Sidebar, BottomNav } from './nav'
import ToggleIva from './ToggleIva'

// Envuelve las páginas privadas con el chrome (sidebar + barra móvil) y
// centraliza el guard de autenticación: si no hay sesión, useSesion redirige
// a /login.
export default function SidebarLayout({ children }: { children: React.ReactNode }) {
  const { user, perfil, cargando } = useSesion()

  if (cargando || !user) {
    return (
      <div className="min-h-screen grid place-items-center">
        <div className="flex flex-col items-center gap-3">
          <div
            className="rounded-full animate-spin"
            style={{
              width: 36,
              height: 36,
              border: '3px solid var(--border)',
              borderTopColor: 'var(--brand-1)',
            }}
          />
          <div className="text-sm" style={{ color: 'var(--text-subtle)' }}>Cargando…</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <Sidebar perfil={perfil} />

      {/* Cabecera móvil */}
      <header
        className="md:hidden sticky top-0 z-20 glass-header px-4 py-3 flex items-center justify-between"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Los Teros" style={{ height: 34, width: 'auto' }} />
        <ToggleIva compacto />
      </header>

      <main className="md:pl-64">
        <div className="mx-auto w-full max-w-6xl px-4 md:px-8 py-6 pb-28 md:pb-10 animar-entrada">
          {children}
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
