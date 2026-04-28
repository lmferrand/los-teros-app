'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

const IA_HINT_KEY = 'ia-asistente-hint-v1'

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mostrarAyudaIA, setMostrarAyudaIA] = useState(false)
  const pathname = usePathname()
  const ocultarAsistente = pathname === '/login' || pathname.startsWith('/auth/')

  useEffect(() => {
    if (ocultarAsistente) return
    const yaMostrado = window.localStorage.getItem(IA_HINT_KEY) === '1'
    if (yaMostrado) return
    window.localStorage.setItem(IA_HINT_KEY, '1')
    setMostrarAyudaIA(true)
    const timeout = window.setTimeout(() => setMostrarAyudaIA(false), 9000)
    return () => window.clearTimeout(timeout)
  }, [ocultarAsistente])

  return (
    <>
      {children}

      {!ocultarAsistente && (
        <div className="fixed right-4 bottom-4 z-[80]" style={{ bottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
          {mostrarAyudaIA && (
            <div
              className="absolute right-0 bottom-20 w-72 rounded-2xl px-4 py-3 text-sm shadow-xl"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text)' }}
            >
              <button
                onClick={() => setMostrarAyudaIA(false)}
                className="absolute right-2 top-2 text-xs px-1 rounded"
                style={{ color: 'var(--text-muted)' }}
                aria-label="Cerrar mensaje"
              >
                x
              </button>
              <p className="pr-5 leading-relaxed">
                Este es el asistente de IA de la empresa. Puedes usarlo para consultar ordenes, inventario, clientes y planificacion.
              </p>
              <div
                className="absolute right-5 -bottom-2 w-3 h-3 rotate-45"
                style={{ background: 'var(--bg-card)', borderRight: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}
              />
            </div>
          )}

          <div className="relative group">
            <div
              className="pointer-events-none absolute right-0 bottom-[86px] px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap opacity-0 translate-y-1 transition-all duration-200 group-hover:opacity-100 group-hover:translate-y-0"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text)' }}
            >
              ¿En qué puedo ayudarte?
            </div>
            <Link
              href="/asistente"
              className="relative flex flex-col items-center justify-center transition-transform hover:scale-105 active:scale-95"
              title="Abrir asistente IA"
              aria-label="Abrir asistente IA"
            >
              <span className="-mb-0.5 text-[11px] leading-none font-bold tracking-wide" style={{ color: '#38bdf8' }}>
                IA
              </span>
              <div className="relative">
                <div
                  className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                  style={{
                    transform: 'scale(1.12)',
                    borderRadius: '9999px',
                    background: 'radial-gradient(circle, rgba(56,189,248,0.26) 0%, rgba(56,189,248,0.14) 42%, rgba(56,189,248,0) 72%)',
                    filter: 'blur(7px)',
                  }}
                />
                <Image
                  src="/assistant-ia-teros-clean.png"
                  alt="Asistente IA Los Teros"
                  width={60}
                  height={60}
                  className="pointer-events-none select-none relative"
                  style={{
                    objectFit: 'cover',
                    objectPosition: 'center',
                    backgroundColor: 'transparent',
                  }}
                />
              </div>
            </Link>
          </div>
        </div>
      )}
    </>
  )
}
