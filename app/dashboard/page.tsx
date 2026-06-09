'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useSesion } from '@/lib/sesion'
import { useDatosFinancieros } from '@/lib/useDatos'
import {
  resumenMensual, mesActualClave,
  esMargenBajo, esSobrecoste, esCobradoNoProgramado, esTerminadoNoFacturado,
  esTurbinaSinDevolver, esBloqueado, esPendienteEjecutar, esListoFacturar,
} from '@/lib/agregados'
import { eur, pct, etiquetaMes, colorMargen, nivelMargen } from '@/lib/dominio'
import { SkeletonLista } from '@/app/components/ui'

function sumarMes(clave: string, meses: number): string {
  const [a, m] = clave.split('-').map(Number)
  const d = new Date(a, m - 1 + meses, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function DashboardPage() {
  const { perfil } = useSesion()
  const { datos, gastos, cargando, error } = useDatosFinancieros()
  const [clave, setClave] = useState(mesActualClave())

  const resumen = useMemo(() => resumenMensual(datos, gastos, clave), [datos, gastos, clave])

  const alertas = useMemo(() => ({
    margenBajo: datos.filter(esMargenBajo),
    sobrecoste: datos.filter(esSobrecoste),
    cobradoNoProgramado: datos.filter(esCobradoNoProgramado),
    terminadoNoFacturado: datos.filter(esTerminadoNoFacturado),
    turbina: datos.filter(esTurbinaSinDevolver),
    bloqueados: datos.filter(esBloqueado),
    pendientesEjecutar: datos.filter(esPendienteEjecutar),
    listosFacturar: datos.filter(esListoFacturar),
  }), [datos])

  const margenRealPct = resumen.ventasAceptadas > 0 ? (resumen.margenReal / resumen.ventasAceptadas) * 100 : null
  const margenEstPct = resumen.ventasAceptadas > 0 ? (resumen.margenEstimado / resumen.ventasAceptadas) * 100 : null

  return (
    <div>
      <header className="mb-5">
        <h1 className="titulo-hero" style={{ color: 'var(--text)' }}>
          Hola{perfil?.nombre ? `, ${perfil.nombre.split(' ')[0]}` : ''} 👋
        </h1>
        <p className="mt-1" style={{ color: 'var(--text-muted)' }}>
          ¿El mes va mal de verdad, o es solo desfase entre ventas, trabajos y facturación?
        </p>
      </header>

      {/* Selector de mes */}
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => setClave((c) => sumarMes(c, -1))} className="grid place-items-center rounded-lg" style={{ width: 34, height: 34, background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m15 18-6-6 6-6" /></svg>
        </button>
        <span className="font-semibold px-2" style={{ color: 'var(--text)', minWidth: 150, textAlign: 'center' }}>{etiquetaMes(clave)}</span>
        <button onClick={() => setClave((c) => sumarMes(c, 1))} className="grid place-items-center rounded-lg" style={{ width: 34, height: 34, background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m9 18 6-6-6-6" /></svg>
        </button>
        {clave !== mesActualClave() && (
          <button onClick={() => setClave(mesActualClave())} className="text-sm px-2" style={{ color: 'var(--brand-1)' }}>Hoy</button>
        )}
      </div>

      {error && <div className="card p-4 mb-4 text-sm" style={{ color: 'var(--red)' }}>{error}. ¿Has ejecutado el SQL en Supabase?</div>}

      {cargando ? (
        <SkeletonLista filas={4} />
      ) : (
        <>
          {/* TARJETA CLAVE — cómo va el mes de verdad (al margen del desfase) */}
          {(() => {
            const keyPct = margenRealPct ?? margenEstPct
            const nivel = nivelMargen(keyPct)
            const color = colorMargen(keyPct)
            const sinVentas = resumen.ventasAceptadas <= 0
            const veredicto = sinVentas ? 'Aún sin ventas aceptadas este mes'
              : nivel === 'correcto' ? 'Mes saludable' : nivel === 'preventivo' ? 'Margen ajustado, a vigilar' : 'Margen bajo este mes'
            return (
              <div className="card p-5 md:p-6 mb-4" style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--brand-1) 9%, var(--bg-card)), color-mix(in srgb, var(--teal) 7%, var(--bg-card)))', border: '1px solid color-mix(in srgb, var(--brand-1) 28%, var(--border))', boxShadow: 'var(--shadow-md)' }}>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0">
                    <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--brand-1)' }}>Negocio cerrado · {etiquetaMes(clave)}</div>
                    <div className="font-bold mt-1" style={{ color: 'var(--text)', fontSize: 'clamp(2rem, 5vw, 3rem)', lineHeight: 1.05 }}>{eur(resumen.ventasAceptadas)}</div>
                    <div className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{resumen.ventasAceptadasCount} presupuesto{resumen.ventasAceptadasCount === 1 ? '' : 's'} aceptado{resumen.ventasAceptadasCount === 1 ? '' : 's'} este mes</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="rounded-2xl px-4 py-3" style={{ background: `color-mix(in srgb, ${color} 16%, var(--bg-card))`, border: `1px solid ${color}` }}>
                      <div className="text-[11px] font-semibold uppercase" style={{ color }}>Margen real</div>
                      <div className="font-bold" style={{ color, fontSize: '1.9rem', lineHeight: 1.1 }}>{pct(keyPct)}</div>
                      <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{eur(resumen.margenReal)}</div>
                    </div>
                    <div className="text-sm font-semibold mt-2" style={{ color }}>{veredicto}</div>
                  </div>
                </div>
                <div className="text-xs mt-3 pt-3" style={{ color: 'var(--text-muted)', borderTop: '1px solid var(--border)' }}>
                  Refleja lo realmente vendido este mes, al margen de cuándo se cobre o facture.
                  {resumen.ventasFuturaFacturacion > 0 && <> De esto, <b style={{ color: 'var(--text)' }}>{eur(resumen.ventasFuturaFacturacion)}</b> se facturará en meses posteriores.</>}
                </div>
              </div>
            )
          })()}

          {/* KPIs del mes */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
            <Kpi label="Ventas aceptadas" valor={eur(resumen.ventasAceptadas)} sub={`${resumen.ventasAceptadasCount} presup.`} color="var(--brand-1)" />
            <Kpi label="Cobros recibidos" valor={eur(resumen.cobros)} color="var(--green)" />
            <Kpi label="Facturación emitida" valor={eur(resumen.facturacionEmitida)} color="var(--teal)" />
            <Kpi label="Facturación prevista" valor={eur(resumen.facturacionPrevista)} color="var(--violet)" />
            <Kpi label="Se facturará en meses futuros" valor={eur(resumen.ventasFuturaFacturacion)} sub="vendido este mes" color="var(--amber)" />
            <Kpi label="Gastos reales" valor={eur(resumen.gastosReales)} color="var(--red)" />
            <Kpi label="Margen estimado" valor={pct(margenEstPct)} sub={eur(resumen.margenEstimado)} color={colorMargen(margenEstPct)} />
            <Kpi label="Margen real" valor={pct(margenRealPct)} sub={eur(resumen.margenReal)} color={colorMargen(margenRealPct)} />
          </div>

          {/* Estado operativo (no acotado al mes) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            <Mini label="Pendientes de ejecutar" n={alertas.pendientesEjecutar.length} href="/presupuestos" color="var(--amber)" />
            <Mini label="Listos para facturar" n={alertas.listosFacturar.length} href="/presupuestos" color="var(--brand-1)" />
            <Mini label="Bloqueados (incidencias)" n={alertas.bloqueados.length} href="/alertas" color="var(--red)" />
            <Mini label="Margen < 30%" n={alertas.margenBajo.length} href="/alertas" color="var(--red)" />
          </div>

          {/* Avisos */}
          <h2 className="font-semibold mb-3" style={{ color: 'var(--text)' }}>Avisos</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Aviso titulo="Margen inferior al 30%" items={alertas.margenBajo} color="var(--red)" />
            <Aviso titulo="Gastos reales > previstos" items={alertas.sobrecoste} color="var(--red)" />
            <Aviso titulo="Cobrados pero no programados" items={alertas.cobradoNoProgramado} color="var(--amber)" />
            <Aviso titulo="Terminados sin facturar" items={alertas.terminadoNoFacturado} color="var(--amber)" />
            <Aviso titulo="Turbina pendiente de devolver" items={alertas.turbina} color="var(--violet)" />
          </div>
        </>
      )}
    </div>
  )
}

function Kpi({ label, valor, sub, color }: { label: string; valor: string; sub?: string; color: string }) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="inline-block rounded-full" style={{ width: 8, height: 8, background: color }} />
        <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{label}</span>
      </div>
      <div className="text-xl font-bold" style={{ color: 'var(--text)' }}>{valor}</div>
      {sub && <div className="text-xs mt-0.5" style={{ color: 'var(--text-subtle)' }}>{sub}</div>}
    </div>
  )
}

function Mini({ label, n, href, color }: { label: string; n: number; href: string; color: string }) {
  return (
    <Link href={href} className="card card-hover p-4 flex items-center justify-between">
      <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span className="text-2xl font-bold" style={{ color }}>{n}</span>
    </Link>
  )
}

function Aviso({ titulo, items, color }: { titulo: string; items: { v: { id: string; cliente: string | null; numero: string | null } }[]; color: string }) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="font-semibold text-sm" style={{ color: 'var(--text)' }}>{titulo}</span>
        <span className="rounded-full text-xs font-bold px-2 py-0.5" style={{ background: `color-mix(in srgb, ${color} 14%, transparent)`, color }}>{items.length}</span>
      </div>
      {items.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-subtle)' }}>Sin avisos.</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {items.slice(0, 4).map(({ v }) => (
            <Link key={v.id} href={`/presupuestos/${v.id}`} className="text-sm flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-[var(--bg-subtle)]" style={{ color: 'var(--text)' }}>
              <span className="truncate">{v.cliente || 'Sin cliente'}</span>
              {v.numero && <span className="text-xs shrink-0 ml-2" style={{ color: 'var(--text-subtle)' }}>{v.numero}</span>}
            </Link>
          ))}
          {items.length > 4 && <span className="text-xs px-2" style={{ color: 'var(--text-subtle)' }}>+{items.length - 4} más</span>}
        </div>
      )}
    </div>
  )
}
