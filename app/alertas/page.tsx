'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { useDatosFinancieros } from '@/lib/useDatos'
import {
  esMargenBajo, esSobrecoste, esCobradoNoProgramado, esTerminadoNoFacturado,
  esTurbinaSinDevolver, type VentaCalc,
} from '@/lib/agregados'
import { eur, pct, fechaCorta } from '@/lib/dominio'
import { EstadoChip, SkeletonLista } from '@/app/components/ui'

export default function AlertasPage() {
  const { datos, cargando, error } = useDatosFinancieros()

  const grupos = useMemo(() => [
    { titulo: 'Margen inferior al 30%', color: 'var(--red)', items: datos.filter(esMargenBajo), detalle: (d: VentaCalc) => pct(d.calc.margenRealPct ?? d.calc.margenEstPct) },
    { titulo: 'Gastos reales por encima de lo previsto', color: 'var(--red)', items: datos.filter(esSobrecoste), detalle: (d: VentaCalc) => `+${eur(d.calc.desviacionGastos)}` },
    { titulo: 'Cobrados pero no programados', color: 'var(--amber)', items: datos.filter(esCobradoNoProgramado), detalle: (d: VentaCalc) => `Cobrado ${eur(d.calc.importeCobrado)}` },
    { titulo: 'Trabajos terminados sin facturar', color: 'var(--amber)', items: datos.filter(esTerminadoNoFacturado), detalle: (d: VentaCalc) => `Pdte. facturar ${eur(d.calc.pendienteFacturar)}` },
    { titulo: 'Turbina pendiente de devolver', color: 'var(--violet)', items: datos.filter(esTurbinaSinDevolver), detalle: () => 'Instalada · no devuelta' },
  ], [datos])

  const total = grupos.reduce((a, g) => a + g.items.length, 0)

  return (
    <div>
      <header className="mb-5">
        <h1 className="titulo-hero" style={{ color: 'var(--text)' }}>Alertas</h1>
        <p className="mt-1" style={{ color: 'var(--text-muted)' }}>{cargando ? 'Cargando…' : `${total} avisos en total`}</p>
      </header>

      {error && <div className="card p-4 mb-4 text-sm" style={{ color: 'var(--red)' }}>{error}</div>}

      {cargando ? <SkeletonLista /> : (
        <div className="flex flex-col gap-5">
          {grupos.map((g) => (
            <section key={g.titulo} className="card p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="inline-block rounded-full" style={{ width: 9, height: 9, background: g.color }} />
                <h2 className="font-semibold" style={{ color: 'var(--text)' }}>{g.titulo}</h2>
                <span className="rounded-full text-xs font-bold px-2 py-0.5 ml-auto" style={{ background: `color-mix(in srgb, ${g.color} 14%, transparent)`, color: g.color }}>{g.items.length}</span>
              </div>
              {g.items.length === 0 ? (
                <p className="text-sm" style={{ color: 'var(--text-subtle)' }}>Nada por aquí. 👌</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {g.items.map((d) => (
                    <Link key={d.v.id} href={`/presupuestos/${d.v.id}`} className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-[var(--bg-subtle)]" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{d.v.cliente || 'Sin cliente'}</div>
                        <div className="text-xs flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
                          {d.v.numero && <span>{d.v.numero}</span>}
                          <span>·</span><span>Aceptado {fechaCorta(d.v.fecha_aceptacion)}</span>
                        </div>
                      </div>
                      <span className="text-sm font-semibold shrink-0" style={{ color: g.color }}>{g.detalle(d)}</span>
                      <EstadoChip estado={d.v.estado} />
                    </Link>
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
