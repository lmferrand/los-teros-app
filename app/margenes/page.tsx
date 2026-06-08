'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useDatosFinancieros } from '@/lib/useDatos'
import { eur, pct, labelTipoTrabajo, colorMargen, nivelMargen } from '@/lib/dominio'
import { ChipMargen, SkeletonLista } from '@/app/components/ui'

export default function MargenesPage() {
  const { datos, cargando, error } = useDatosFinancieros()
  const [orden, setOrden] = useState<'peor' | 'mejor'>('peor')

  const lista = useMemo(() => {
    const arr = [...datos]
    arr.sort((a, b) => {
      const pa = a.calc.margenRealPct ?? a.calc.margenEstPct ?? 999
      const pb = b.calc.margenRealPct ?? b.calc.margenEstPct ?? 999
      return orden === 'peor' ? pa - pb : pb - pa
    })
    return arr
  }, [datos, orden])

  const resumen = useMemo(() => {
    const conBase = datos.filter((d) => d.calc.baseImponible > 0)
    const totalBase = conBase.reduce((a, d) => a + d.calc.baseImponible, 0)
    const totalMargen = conBase.reduce((a, d) => a + d.calc.margenRealSinIva, 0)
    const medio = totalBase > 0 ? (totalMargen / totalBase) * 100 : null
    return {
      medio,
      bajos: datos.filter((d) => nivelMargen(d.calc.margenRealPct ?? d.calc.margenEstPct) === 'bajo').length,
      correctos: datos.filter((d) => nivelMargen(d.calc.margenRealPct ?? d.calc.margenEstPct) === 'correcto').length,
    }
  }, [datos])

  return (
    <div>
      <header className="mb-5">
        <h1 className="titulo-hero" style={{ color: 'var(--text)' }}>Márgenes</h1>
        <p className="mt-1" style={{ color: 'var(--text-muted)' }}>Calculados sin IVA · rojo &lt;30%, aviso 30–40%, correcto &gt;40%</p>
      </header>

      {error && <div className="card p-4 mb-4 text-sm" style={{ color: 'var(--red)' }}>{error}</div>}

      {cargando ? <SkeletonLista /> : (
        <>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="card p-4">
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Margen medio real</div>
              <div className="text-xl font-bold" style={{ color: colorMargen(resumen.medio) }}>{pct(resumen.medio)}</div>
            </div>
            <div className="card p-4">
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Con margen &lt; 30%</div>
              <div className="text-xl font-bold" style={{ color: 'var(--red)' }}>{resumen.bajos}</div>
            </div>
            <div className="card p-4">
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Margen correcto</div>
              <div className="text-xl font-bold" style={{ color: 'var(--green)' }}>{resumen.correctos}</div>
            </div>
          </div>

          <div className="flex justify-end mb-3">
            <button onClick={() => setOrden((o) => (o === 'peor' ? 'mejor' : 'peor'))} className="text-sm rounded-lg px-3 py-1.5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
              Orden: {orden === 'peor' ? 'peor margen primero' : 'mejor margen primero'}
            </button>
          </div>

          <div className="flex flex-col gap-2">
            {lista.map(({ v, calc }) => {
              const p = calc.margenRealPct ?? calc.margenEstPct
              return (
                <Link key={v.id} href={`/presupuestos/${v.id}`} className="card card-hover p-4 flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold truncate" style={{ color: 'var(--text)' }}>{v.cliente || 'Sin cliente'}</div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{labelTipoTrabajo(v.tipo_trabajo)} · base {eur(calc.baseImponible)}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-semibold" style={{ color: colorMargen(p) }}>{eur(calc.margenRealSinIva)}</div>
                    <div className="text-[11px]" style={{ color: 'var(--text-subtle)' }}>margen real</div>
                  </div>
                  <ChipMargen valor={p} />
                </Link>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
