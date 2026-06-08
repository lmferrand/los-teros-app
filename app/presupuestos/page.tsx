'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { listarVentas } from '@/lib/db/ventas'
import { listarTodosGastos } from '@/lib/db/gastos'
import type { Venta, Gasto } from '@/lib/tipos'
import { calcularVenta } from '@/lib/calculos'
import {
  ESTADOS, ESTADO_LABEL, TIPOS_TRABAJO, labelTipoTrabajo, eur, fechaCorta,
} from '@/lib/dominio'
import { useVistaIva } from '@/lib/iva-vista'
import { EstadoChip, ChipMargen, EstadoVacio, SkeletonLista } from '@/app/components/ui'

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

export default function PresupuestosPage() {
  const { conIva } = useVistaIva()
  const [ventas, setVentas] = useState<Venta[]>([])
  const [gastos, setGastos] = useState<Gasto[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  // Filtros
  const [q, setQ] = useState('')
  const [fEstado, setFEstado] = useState('')
  const [fTipo, setFTipo] = useState('')
  const [fResponsable, setFResponsable] = useState('')
  const [fAnio, setFAnio] = useState('')
  const [fAmbito, setFAmbito] = useState('') // '' | '1'..'12' | 'T1'..'T4'
  const [soloMargenBajo, setSoloMargenBajo] = useState(false)

  useEffect(() => {
    let activo = true
    Promise.all([listarVentas(), listarTodosGastos()])
      .then(([v, g]) => {
        if (!activo) return
        setVentas(v)
        setGastos(g)
      })
      .catch((e) => activo && setError(e.message || 'Error al cargar'))
      .finally(() => activo && setCargando(false))
    return () => { activo = false }
  }, [])

  const gastosPorVenta = useMemo(() => {
    const m = new Map<string, Gasto[]>()
    for (const g of gastos) {
      const arr = m.get(g.venta_id) || []
      arr.push(g)
      m.set(g.venta_id, arr)
    }
    return m
  }, [gastos])

  const responsables = useMemo(
    () => Array.from(new Set(ventas.map((v) => v.responsable).filter(Boolean))) as string[],
    [ventas]
  )
  const anios = useMemo(() => {
    const s = new Set<number>()
    for (const v of ventas) {
      if (v.fecha_aceptacion) s.add(new Date(v.fecha_aceptacion).getFullYear())
    }
    return Array.from(s).sort((a, b) => b - a)
  }, [ventas])

  const lista = useMemo(() => {
    const texto = q.trim().toLowerCase()
    return ventas
      .map((v) => ({ v, calc: calcularVenta(v, gastosPorVenta.get(v.id) || []) }))
      .filter(({ v, calc }) => {
        if (fEstado && v.estado !== fEstado) return false
        if (fTipo && v.tipo_trabajo !== fTipo) return false
        if (fResponsable && v.responsable !== fResponsable) return false
        if (soloMargenBajo && !(calc.margenRealPct != null && calc.margenRealPct < 30)) return false
        if (texto) {
          const blob = `${v.numero || ''} ${v.cliente || ''} ${v.empresa_local || ''}`.toLowerCase()
          if (!blob.includes(texto)) return false
        }
        if (fAnio || fAmbito) {
          if (!v.fecha_aceptacion) return false
          const d = new Date(v.fecha_aceptacion)
          if (fAnio && d.getFullYear() !== Number(fAnio)) return false
          if (fAmbito) {
            const mes = d.getMonth() + 1
            if (fAmbito.startsWith('T')) {
              const t = Number(fAmbito.slice(1))
              const trimestre = Math.floor((mes - 1) / 3) + 1
              if (trimestre !== t) return false
            } else if (mes !== Number(fAmbito)) {
              return false
            }
          }
        }
        return true
      })
  }, [ventas, gastosPorVenta, q, fEstado, fTipo, fResponsable, fAnio, fAmbito, soloMargenBajo])

  const hayFiltros = q || fEstado || fTipo || fResponsable || fAnio || fAmbito || soloMargenBajo

  return (
    <div>
      <header className="flex items-center justify-between gap-3 mb-5 flex-wrap">
        <div>
          <h1 className="titulo-hero" style={{ color: 'var(--text)' }}>Presupuestos</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {cargando ? 'Cargando…' : `${lista.length} de ${ventas.length}`}
          </p>
        </div>
        <Link href="/presupuestos/nuevo" className="marca-gradiente inline-flex items-center gap-2 rounded-xl font-semibold px-4 py-2.5 text-white" style={{ boxShadow: 'var(--shadow-sm)' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          Nuevo presupuesto
        </Link>
      </header>

      {/* Filtros */}
      <div className="card p-3 mb-4 flex flex-wrap gap-2 items-center">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar nº o cliente…"
          className="flex-1 min-w-[180px] rounded-lg px-3 py-2 text-sm"
          style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}
        />
        <Select valor={fEstado} onChange={setFEstado} placeholder="Estado">
          {ESTADOS.map((e) => <option key={e} value={e}>{ESTADO_LABEL[e]}</option>)}
        </Select>
        <Select valor={fTipo} onChange={setFTipo} placeholder="Tipo">
          {TIPOS_TRABAJO.map((t) => <option key={t.valor} value={t.valor}>{t.label}</option>)}
        </Select>
        <Select valor={fResponsable} onChange={setFResponsable} placeholder="Responsable">
          {responsables.map((r) => <option key={r} value={r}>{r}</option>)}
        </Select>
        <Select valor={fAnio} onChange={setFAnio} placeholder="Año">
          {anios.map((a) => <option key={a} value={String(a)}>{a}</option>)}
        </Select>
        <Select valor={fAmbito} onChange={setFAmbito} placeholder="Periodo">
          <optgroup label="Trimestre">
            {['T1', 'T2', 'T3', 'T4'].map((t) => <option key={t} value={t}>{t}</option>)}
          </optgroup>
          <optgroup label="Mes">
            {MESES.map((m, i) => <option key={m} value={String(i + 1)}>{m}</option>)}
          </optgroup>
        </Select>
        <button
          onClick={() => setSoloMargenBajo((v) => !v)}
          className="rounded-lg px-3 py-2 text-sm font-semibold whitespace-nowrap"
          style={{
            background: soloMargenBajo ? 'color-mix(in srgb, var(--red) 14%, transparent)' : 'var(--bg)',
            color: soloMargenBajo ? 'var(--red)' : 'var(--text-muted)',
            border: `1px solid ${soloMargenBajo ? 'var(--red)' : 'var(--border)'}`,
          }}
        >
          Margen &lt; 30%
        </button>
        {hayFiltros && (
          <button
            onClick={() => { setQ(''); setFEstado(''); setFTipo(''); setFResponsable(''); setFAnio(''); setFAmbito(''); setSoloMargenBajo(false) }}
            className="text-sm px-2 py-2"
            style={{ color: 'var(--text-subtle)' }}
          >
            Limpiar
          </button>
        )}
      </div>

      {error && (
        <div className="card p-4 mb-4 text-sm" style={{ color: 'var(--red)' }}>
          {error}. ¿Has ejecutado el SQL en Supabase?
        </div>
      )}

      {cargando ? (
        <SkeletonLista />
      ) : lista.length === 0 ? (
        <EstadoVacio
          titulo={ventas.length === 0 ? 'Aún no hay presupuestos' : 'Sin resultados'}
          texto={ventas.length === 0 ? 'Crea el primero o ejecuta el SQL con datos de ejemplo.' : 'Prueba a cambiar los filtros.'}
        />
      ) : (
        <div className="flex flex-col gap-2.5">
          {lista.map(({ v, calc }) => (
            <Link key={v.id} href={`/presupuestos/${v.id}`} className="card card-hover p-4 block">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold truncate" style={{ color: 'var(--text)' }}>
                      {v.cliente || 'Sin cliente'}
                    </span>
                    {v.numero && (
                      <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>{v.numero}</span>
                    )}
                  </div>
                  <div className="text-xs mt-0.5 flex items-center gap-2 flex-wrap" style={{ color: 'var(--text-muted)' }}>
                    <span>{labelTipoTrabajo(v.tipo_trabajo)}</span>
                    <span>·</span>
                    <span>Aceptado {fechaCorta(v.fecha_aceptacion)}</span>
                    {v.responsable && (<><span>·</span><span>{v.responsable}</span></>)}
                  </div>
                </div>

                <div className="text-right">
                  <div className="font-semibold" style={{ color: 'var(--text)' }}>
                    {eur(conIva ? calc.totalConIva : calc.baseImponible)}
                  </div>
                  <div className="text-[11px]" style={{ color: 'var(--text-subtle)' }}>
                    {conIva ? 'con IVA' : 'sin IVA'}
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <EstadoChip estado={v.estado} />
                  <ChipMargen valor={calc.margenRealPct ?? calc.margenEstPct} etiqueta="margen" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

function Select({ valor, onChange, placeholder, children }: {
  valor: string
  onChange: (v: string) => void
  placeholder: string
  children: React.ReactNode
}) {
  return (
    <select
      value={valor}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg px-2.5 py-2 text-sm"
      style={{
        background: 'var(--bg)',
        border: `1px solid ${valor ? 'var(--brand-1)' : 'var(--border)'}`,
        color: valor ? 'var(--text)' : 'var(--text-muted)',
      }}
    >
      <option value="">{placeholder}</option>
      {children}
    </select>
  )
}
