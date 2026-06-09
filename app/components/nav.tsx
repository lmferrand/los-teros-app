'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { cerrarSesion, type Perfil } from '@/lib/sesion'
import ToggleIva from './ToggleIva'

export interface ItemNav {
  href: string
  label: string
  icono: (props: { className?: string }) => React.ReactElement
}

const Ico = (d: string) => ({ className }: { className?: string }) => (
  <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
)

const FINANCIERO: ItemNav[] = [
  { href: '/dashboard', label: 'Dashboard', icono: Ico('M3 13h8V3H3v10Zm0 8h8v-6H3v6Zm10 0h8V11h-8v10Zm0-18v6h8V3h-8Z') },
  { href: '/presupuestos', label: 'Presupuestos', icono: Ico('M9 12h6m-6 4h6m-6-8h6M6 2h9l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Z') },
  { href: '/facturacion', label: 'Facturación', icono: Ico('M3 6h18M3 12h18M3 18h18M7 3v3m10-3v3M7 18v3m10-3v3') },
  { href: '/margenes', label: 'Márgenes', icono: Ico('M3 3v18h18M7 14l4-4 3 3 5-6') },
  { href: '/alertas', label: 'Alertas', icono: Ico('M12 9v4m0 4h.01M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.7 3.86a2 2 0 0 0-3.42 0Z') },
  { href: '/documentos', label: 'Documentos IA', icono: Ico('M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Zm0 0v6h6M9 15l2 2 4-4') },
]

const OPERACIONES: ItemNav[] = [
  { href: '/inventario', label: 'Inventario', icono: Ico('M21 8V6a2 2 0 0 0-2-2h-3M3 8V6a2 2 0 0 1 2-2h3m-5 8v6a2 2 0 0 0 2 2h3m13-8v6a2 2 0 0 1-2 2h-3M8 12h8') },
  { href: '/movimientos', label: 'Movimientos', icono: Ico('M7 16V4m0 0L3 8m4-4 4 4m6 0v12m0 0 4-4m-4 4-4-4') },
  { href: '/escanear', label: 'Escanear', icono: Ico('M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 12h10') },
]

const SECCIONES: { titulo: string; items: ItemNav[] }[] = [
  { titulo: 'Financiero', items: FINANCIERO },
  { titulo: 'Operaciones', items: OPERACIONES },
]

function activo(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + '/')
}

function Enlaces({ pathname, onNav }: { pathname: string; onNav?: () => void }) {
  return (
    <nav className="flex flex-col gap-4 flex-1 overflow-y-auto">
      {SECCIONES.map((sec) => (
        <div key={sec.titulo}>
          <div className="px-3 mb-1 text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-subtle)' }}>{sec.titulo}</div>
          <div className="flex flex-col gap-1">
            {sec.items.map((it) => {
              const Icono = it.icono
              const on = activo(pathname, it.href)
              return (
                <Link key={it.href} href={it.href} onClick={onNav} className={`nav-item ${on ? 'nav-item-activo' : ''}`}>
                  <Icono />
                  <span>{it.label}</span>
                </Link>
              )
            })}
          </div>
        </div>
      ))}
    </nav>
  )
}

function PieUsuario({ perfil, onNav }: { perfil: Perfil | null; onNav?: () => void }) {
  const router = useRouter()
  async function salir() {
    onNav?.()
    await cerrarSesion()
    router.replace('/login')
  }
  return (
    <div className="pt-3 mt-3" style={{ borderTop: '1px solid var(--border)' }}>
      <div className="px-2 mb-2">
        <div className="text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>{perfil?.nombre || 'Usuario'}</div>
        <div className="text-xs capitalize" style={{ color: 'var(--text-subtle)' }}>{perfil?.rol || 'interno'}</div>
      </div>
      <button onClick={salir} className="nav-item w-full text-left" style={{ color: 'var(--red)' }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4m7 14 5-5-5-5m5 5H9" />
        </svg>
        <span>Cerrar sesión</span>
      </button>
    </div>
  )
}

export function Sidebar({ perfil }: { perfil: Perfil | null }) {
  const pathname = usePathname()
  return (
    <aside className="hidden md:flex flex-col fixed inset-y-0 left-0 w-64 z-30 px-4 py-5" style={{ background: 'var(--bg-card)', borderRight: '1px solid var(--border)' }}>
      <div className="px-2 mb-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Los Teros" style={{ width: 128, height: 'auto' }} className="mb-1" />
        <div className="text-xs mb-3" style={{ color: 'var(--text-subtle)' }}>Control financiero</div>
        <ToggleIva />
      </div>
      <Enlaces pathname={pathname} />
      <PieUsuario perfil={perfil} />
    </aside>
  )
}

// Menú deslizante para móvil (botón hamburguesa + drawer).
export function MobileMenu({ perfil }: { perfil: Perfil | null }) {
  const pathname = usePathname()
  const [abierto, setAbierto] = useState(false)
  useEffect(() => { setAbierto(false) }, [pathname])

  return (
    <>
      <button onClick={() => setAbierto(true)} aria-label="Menú" className="grid place-items-center rounded-lg" style={{ width: 38, height: 38, background: 'var(--bg-subtle)', border: '1px solid var(--border)', color: 'var(--text)' }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M3 12h18M3 18h18" /></svg>
      </button>
      {abierto && (
        <div className="fixed inset-0 z-50 md:hidden" onClick={() => setAbierto(false)} style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="absolute inset-y-0 left-0 w-72 flex flex-col px-4 py-5 animar-entrada" style={{ background: 'var(--bg-card)', borderRight: '1px solid var(--border)' }} onClick={(e) => e.stopPropagation()}>
            <div className="px-2 mb-5 flex items-center justify-between">
              <div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo.png" alt="Los Teros" style={{ width: 120, height: 'auto' }} className="mb-1" />
                <div className="text-xs" style={{ color: 'var(--text-subtle)' }}>Control financiero</div>
              </div>
              <button onClick={() => setAbierto(false)} className="text-2xl leading-none px-2" style={{ color: 'var(--text-subtle)' }}>×</button>
            </div>
            <div className="px-2 mb-3"><ToggleIva /></div>
            <Enlaces pathname={pathname} onNav={() => setAbierto(false)} />
            <PieUsuario perfil={perfil} onNav={() => setAbierto(false)} />
          </div>
        </div>
      )}
    </>
  )
}
