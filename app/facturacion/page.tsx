'use client'

import { useMemo } from 'react'
import { useDatosFinancieros } from '@/lib/useDatos'
import { eur, claveMes, etiquetaMes } from '@/lib/dominio'
import { SkeletonLista } from '@/app/components/ui'

interface FilaMes {
  clave: string
  venta: number
  cobro: number
  ejecucion: number
  factPrevista: number
  factReal: number
}

export default function FacturacionPage() {
  const { datos, cargando, error } = useDatosFinancieros()

  const filas = useMemo<FilaMes[]>(() => {
    const mapa = new Map<string, FilaMes>()
    const fila = (c: string) => {
      let f = mapa.get(c)
      if (!f) { f = { clave: c, venta: 0, cobro: 0, ejecucion: 0, factPrevista: 0, factReal: 0 }; mapa.set(c, f) }
      return f
    }
    for (const { v, calc } of datos) {
      const cVenta = claveMes(v.fecha_aceptacion)
      if (cVenta) fila(cVenta).venta += calc.baseImponible
      const cCobro = claveMes(v.fecha_cobro)
      if (cCobro) fila(cCobro).cobro += v.importe_cobrado || 0
      const cEjec = claveMes(v.fecha_fin_real)
      if (cEjec) fila(cEjec).ejecucion += calc.baseImponible
      const cPrev = claveMes(v.fecha_prevista_facturacion)
      if (cPrev && !calc.facturada) fila(cPrev).factPrevista += calc.totalConIva
      const cReal = claveMes(v.fecha_real_facturacion)
      if (cReal) fila(cReal).factReal += calc.totalConIva
    }
    return Array.from(mapa.values()).sort((a, b) => a.clave.localeCompare(b.clave))
  }, [datos])

  const tot = filas.reduce((a, f) => ({
    venta: a.venta + f.venta, cobro: a.cobro + f.cobro, ejecucion: a.ejecucion + f.ejecucion,
    factPrevista: a.factPrevista + f.factPrevista, factReal: a.factReal + f.factReal,
  }), { venta: 0, cobro: 0, ejecucion: 0, factPrevista: 0, factReal: 0 })

  const cols = [
    { k: 'venta', label: 'Venta', color: 'var(--brand-1)' },
    { k: 'cobro', label: 'Cobro', color: 'var(--green)' },
    { k: 'ejecucion', label: 'Ejecución', color: 'var(--violet)' },
    { k: 'factPrevista', label: 'Fact. prevista', color: 'var(--amber)' },
    { k: 'factReal', label: 'Fact. real', color: 'var(--teal)' },
  ] as const

  return (
    <div>
      <header className="mb-5">
        <h1 className="titulo-hero" style={{ color: 'var(--text)' }}>Facturación prevista</h1>
        <p className="mt-1" style={{ color: 'var(--text-muted)' }}>
          El desfase de un vistazo: cuándo se vende, se cobra, se ejecuta y se factura.
          <span className="block text-xs mt-0.5" style={{ color: 'var(--text-subtle)' }}>Venta y ejecución sin IVA · facturación y cobro con IVA.</span>
        </p>
      </header>

      {error && <div className="card p-4 mb-4 text-sm" style={{ color: 'var(--red)' }}>{error}</div>}

      {cargando ? <SkeletonLista /> : filas.length === 0 ? (
        <div className="card p-6 text-sm" style={{ color: 'var(--text-muted)' }}>Sin datos.</div>
      ) : (
        <div className="card p-0 overflow-x-auto">
          <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th className="text-left font-semibold px-4 py-3" style={{ color: 'var(--text-muted)' }}>Mes</th>
                {cols.map((c) => (
                  <th key={c.k} className="text-right font-semibold px-4 py-3 whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="inline-block rounded-full" style={{ width: 7, height: 7, background: c.color }} />
                      {c.label}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filas.map((f) => (
                <tr key={f.clave} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td className="px-4 py-3 font-medium whitespace-nowrap" style={{ color: 'var(--text)' }}>{etiquetaMes(f.clave)}</td>
                  {cols.map((c) => (
                    <td key={c.k} className="px-4 py-3 text-right tabular-nums" style={{ color: f[c.k] ? 'var(--text)' : 'var(--text-subtle)' }}>
                      {f[c.k] ? eur(f[c.k]) : '—'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: 'var(--bg-subtle)' }}>
                <td className="px-4 py-3 font-bold" style={{ color: 'var(--text)' }}>Total</td>
                {cols.map((c) => (
                  <td key={c.k} className="px-4 py-3 text-right font-bold tabular-nums" style={{ color: 'var(--text)' }}>{eur(tot[c.k])}</td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}
