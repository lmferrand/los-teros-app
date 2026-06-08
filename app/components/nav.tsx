'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cerrarSesion, type Perfil } from '@/lib/sesion'

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

export const ITEMS_NAV: ItemNav[] = [
  { href: '/dashboard', label: 'Dashboard', icono: Ico('M3 13h8V3H3v10Zm0 8h8v-6H3v6Zm10 0h8V11h-8v10Zm0-18v6h8V3h-8Z') },
  { href: '/presupuestos', label: 'Presupuestos', icono: Ico('M9 12h6m-6 4h6m-6-8h6M6 2h9l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Z') },
  { href: '/facturacion', label: 'Facturación', icono: Ico('M3 6h18M3 12h18M3 18h18M7 3v3m10-3v3M7 18v3m10-3v3') },
  { href: '/margenes', label: 'Márgenes', icono: Ico('M3 3v18h18M7 14l4-4 3 3 5-6') },
  { href: '/alertas', label: 'Alertas', icono: Ico('M12 9v4m0 4h.01M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.7 3.86a2 2 0 0 0-3.42 0Z') },
  { href: '/documentos', label: 'Documentos IA', icono: Ico('M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Zm0 0v6h6M9 15l2 2 4-4') },
]

function activo(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + '/')
}

export function Sidebar({ perfil }: { perfil: Perfil | null }) {
  const pathname = usePathname()
  const router = useRouter()

  async function salir() {
    await cerrarSesion()
    router.replace('/login')
  }

  return (
    <aside
      className="hidden md:flex flex-col fixed inset-y-0 left-0 w-64 z-30 px-4 py-5"
      style={{ background: 'var(--bg-card)', borderRight: '1px solid var(--border)' }}
    >
      <div className="px-2 mb-6">
        <div className="texto-gradiente font-bold text-xl tracking-tight">Los Teros</div>
        <div className="text-xs" style={{ color: 'var(--text-subtle)' }}>Control financiero</div>
      </div>

      <nav className="flex flex-col gap-1 flex-1">
        {ITEMS_NAV.map((it) => {
          const Icono = it.icono
          const on = activo(pathname, it.href)
          return (
            <Link key={it.href} href={it.href} className={`nav-item ${on ? 'nav-item-activo' : ''}`}>
              <Icono />
              <span>{it.label}</span>
            </Link>
          )
        })}
      </nav>

      <div className="pt-3 mt-3" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="px-2 mb-2">
          <div className="text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>
            {perfil?.nombre || 'Usuario'}
          </div>
          <div className="text-xs capitalize" style={{ color: 'var(--text-subtle)' }}>
            {perfil?.rol || 'interno'}
          </div>
        </div>
        <button onClick={salir} className="nav-item w-full text-left" style={{ color: 'var(--red)' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4m7 14 5-5-5-5m5 5H9" />
          </svg>
          <span>Cerrar sesión</span>
        </button>
      </div>
    </aside>
  )
}

export function BottomNav() {
  const pathname = usePathname()
  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-30 flex justify-around px-1 pt-1"
      style={{
        background: 'color-mix(in srgb, var(--bg-card) 92%, transparent)',
        backdropFilter: 'saturate(180%) blur(18px)',
        borderTop: '1px solid var(--border)',
        paddingBottom: 'max(6px, env(safe-area-inset-bottom))',
      }}
    >
      {ITEMS_NAV.map((it) => {
        const Icono = it.icono
        const on = activo(pathname, it.href)
        return (
          <Link
            key={it.href}
            href={it.href}
            className="flex flex-col items-center gap-0.5 py-1.5 px-2 rounded-lg flex-1"
            style={{ color: on ? 'var(--brand-1)' : 'var(--text-subtle)' }}
          >
            <Icono className="shrink-0" />
            <span className="text-[10px] font-medium leading-none text-center">
              {it.label.split(' ')[0]}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
