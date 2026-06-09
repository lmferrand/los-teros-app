'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSesion } from '@/lib/sesion'
import { tieneAcceso } from '@/lib/acceso'
import { Sidebar, MobileMenu } from './nav'

// Envuelve las páginas privadas con el chrome (sidebar en escritorio, menú
// deslizante en móvil) y centraliza el guard de autenticación: si no hay
// sesión, useSesion redirige a /login.
export default function SidebarLayout({ children }: { children: React.ReactNode }) {
  const { user, perfil, cargando } = useSesion()
  const pathname = usePathname()
  const modulo = pathname.split('/')[1] || 'inicio'
  const permitido = tieneAcceso(perfil, modulo)

  if (cargando || !user) {
    return (
      <div className="min-h-screen grid place-items-center">
        <div className="flex flex-col items-center gap-3">
          <div
            className="rounded-full animate-spin"
            style={{ width: 36, height: 36, border: '3px solid var(--border)', borderTopColor: 'var(--brand-1)' }}
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
      <header className="md:hidden sticky top-0 z-20 glass-header px-3 py-2.5 flex items-center gap-3">
        <MobileMenu perfil={perfil} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Los Teros" style={{ height: 30, width: 'auto' }} />
      </header>

      <main className="md:pl-64">
        <div className="mx-auto w-full max-w-6xl px-4 md:px-8 py-6 pb-10 animar-entrada">
          {permitido ? children : (
            <div className="card p-10 text-center flex flex-col items-center gap-3 mt-6">
              <div className="grid place-items-center rounded-2xl" style={{ width: 56, height: 56, background: 'var(--bg-subtle)' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--text-subtle)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
              </div>
              <div className="font-semibold" style={{ color: 'var(--text)' }}>Sin acceso a esta sección</div>
              <div className="text-sm" style={{ color: 'var(--text-muted)' }}>No tienes permiso para ver este módulo. Habla con tu gestor.</div>
              <Link href="/inicio" className="marca-gradiente rounded-xl px-4 py-2 font-semibold text-white text-sm mt-1">Ir al inicio</Link>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
