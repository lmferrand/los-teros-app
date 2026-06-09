'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import type { Venta, Gasto } from '@/lib/tipos'
import { obtenerVenta, borrarVenta } from '@/lib/db/ventas'
import { listarGastos } from '@/lib/db/gastos'
import { crearOrden } from '@/lib/db/ordenes'
import { calcularVenta } from '@/lib/calculos'
import {
  eur, pct, fechaCorta, labelTipoTrabajo, nivelMargen, colorMargen, labelMargen,
} from '@/lib/dominio'
import { useVistaIva } from '@/lib/iva-vista'
import { EstadoChip, Campo, SkeletonLista } from '@/app/components/ui'
import Cronologia from '@/app/components/Cronologia'
import GastosSeccion from './GastosSeccion'

export default function FichaPresupuesto() {
  const params = useParams<{ id: string }>()
  const id = params.id
  const router = useRouter()
  const { conIva } = useVistaIva()

  const [venta, setVenta] = useState<Venta | null>(null)
  const [gastos, setGastos] = useState<Gasto[]>([])
  const [cargando, setCargando] = useState(true)
  const [borrando, setBorrando] = useState(false)
  const [generando, setGenerando] = useState(false)

  useEffect(() => {
    let activo = true
    Promise.all([obtenerVenta(id), listarGastos(id)]).then(([v, g]) => {
      if (!activo) return
      setVenta(v); setGastos(g); setCargando(false)
    })
    return () => { activo = false }
  }, [id])

  const calc = useMemo(() => (venta ? calcularVenta(venta, gastos) : null), [venta, gastos])

  async function eliminar() {
    if (!confirm('¿Eliminar este presupuesto y todos sus gastos? No se puede deshacer.')) return
    setBorrando(true)
    await borrarVenta(id)
    router.push('/presupuestos')
  }

  function tipoOtDesde(t: string | null): string {
    if (t === 'sustitucion_turbina') return 'sustitucion'
    if (t === 'reparacion') return 'mantenimiento'
    if (t === 'limpieza' || t === 'instalacion') return t
    return 'otro'
  }
  async function generarOT() {
    if (!venta) return
    setGenerando(true)
    try {
      const o = await crearOrden({
        cliente_id: venta.cliente_id,
        tipo: tipoOtDesde(venta.tipo_trabajo),
        estado: 'pendiente',
        prioridad: '2',
        fecha_programada: venta.fecha_prevista_ejecucion ? new Date(venta.fecha_prevista_ejecucion).toISOString() : null,
        descripcion: `Desde presupuesto ${venta.numero || ''} — ${venta.cliente || ''}`.trim(),
        observaciones: venta.observaciones || null,
      })
      router.push(`/ordenes/${o.id}`)
    } catch { setGenerando(false) }
  }

  if (cargando) return <SkeletonLista filas={4} />
  if (!venta || !calc) return <div className="card p-6 text-sm" style={{ color: 'var(--text-muted)' }}>No se encontró el presupuesto.</div>

  const margenPct = calc.margenRealPct ?? calc.margenEstPct
  const nivel = nivelMargen(margenPct)

  return (
    <div className="flex flex-col gap-5">
      {/* Cabecera */}
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <Link href="/presupuestos" className="text-sm inline-flex items-center gap-1 mb-2" style={{ color: 'var(--text-subtle)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m15 18-6-6 6-6" /></svg>
            Presupuestos
          </Link>
          <h1 className="titulo-hero" style={{ color: 'var(--text)' }}>{venta.cliente || 'Sin cliente'}</h1>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {venta.numero && <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{venta.numero}</span>}
            <EstadoChip estado={venta.estado} />
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={generarOT} disabled={generando} className="marca-gradiente rounded-xl px-4 py-2 font-semibold text-sm text-white" style={{ opacity: generando ? 0.7 : 1 }}>
            {generando ? 'Generando…' : 'Generar OT'}
          </button>
          <Link href={`/presupuestos/${id}/editar`} className="rounded-xl px-4 py-2 font-semibold text-sm" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text)' }}>
            Editar
          </Link>
          <button onClick={eliminar} disabled={borrando} className="rounded-xl px-3 py-2 font-semibold text-sm" style={{ background: 'color-mix(in srgb, var(--red) 10%, transparent)', color: 'var(--red)' }}>
            Eliminar
          </button>
        </div>
      </header>

      {/* Cronología */}
      <section className="card p-5">
        <Cronologia estado={venta.estado} />
      </section>

      {/* Alerta de margen */}
      {nivel !== 'correcto' && (
        <div className="card p-4 flex items-center gap-3" style={{ background: `color-mix(in srgb, ${colorMargen(margenPct)} 10%, var(--bg-card))`, borderColor: colorMargen(margenPct) }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={colorMargen(margenPct)} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
            <path d="M12 9v4m0 4h.01M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.7 3.86a2 2 0 0 0-3.42 0Z" />
          </svg>
          <div className="text-sm">
            <b style={{ color: colorMargen(margenPct) }}>{labelMargen(margenPct)}</b>
            <span style={{ color: 'var(--text-muted)' }}> — margen {pct(margenPct)} (regla: rojo &lt;30%, aviso 30–40%, correcto &gt;40%).</span>
          </div>
        </div>
      )}

      {/* Resumen económico — IVA siempre desglosado */}
      <section className="card p-5">
        <h2 className="font-semibold mb-4" style={{ color: 'var(--text)' }}>Resumen económico</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Cifra label="Base imponible" valor={eur(calc.baseImponible)} />
          <Cifra label={`IVA (${pct(calc.ivaPorcentaje)})`} valor={eur(calc.ivaImporte)} />
          <Cifra label="Total con IVA" valor={eur(calc.totalConIva)} destacado />
          <Cifra label="Cobrado" valor={eur(calc.importeCobrado)} color="var(--green)" />
          <Cifra label="Pendiente de cobro" valor={eur(calc.pendienteCobro)} color={calc.pendienteCobro > 0 ? 'var(--amber)' : 'var(--text)'} />
          <Cifra label="Pendiente de facturar" valor={eur(calc.pendienteFacturar)} color={calc.pendienteFacturar > 0 ? 'var(--amber)' : 'var(--text)'} />
          <Cifra label="Gastos estimados" valor={eur(conIva ? calc.gastosEstConIva : calc.gastosEstSinIva)} />
          <Cifra label="Gastos reales" valor={eur(conIva ? calc.gastosRealConIva : calc.gastosRealSinIva)} color={calc.sobrecoste ? 'var(--red)' : 'var(--text)'} />
        </div>
      </section>

      {/* Márgenes y desviaciones */}
      <section className="card p-5">
        <h2 className="font-semibold mb-4" style={{ color: 'var(--text)' }}>Márgenes y desviaciones <span className="text-xs font-normal" style={{ color: 'var(--text-subtle)' }}>(sin IVA)</span></h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Cifra label="Margen estimado" valor={eur(calc.margenEstSinIva)} sub={pct(calc.margenEstPct)} color={colorMargen(calc.margenEstPct)} />
          <Cifra label="Margen real" valor={eur(calc.margenRealSinIva)} sub={pct(calc.margenRealPct)} color={colorMargen(calc.margenRealPct)} />
          <Cifra label="Desviación gastos" valor={eur(calc.desviacionGastos)} color={calc.desviacionGastos > 0 ? 'var(--red)' : 'var(--green)'} />
          <Cifra label="Desviación horas" valor={`${calc.desviacionHoras > 0 ? '+' : ''}${calc.desviacionHoras} h`} color={calc.desviacionHoras > 0 ? 'var(--red)' : 'var(--text)'} />
        </div>
      </section>

      {/* Datos generales */}
      <section className="card p-5">
        <h2 className="font-semibold mb-4" style={{ color: 'var(--text)' }}>Datos</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Campo label="Empresa / local">{venta.empresa_local}</Campo>
          <Campo label="Tipo de trabajo">{labelTipoTrabajo(venta.tipo_trabajo)}</Campo>
          <Campo label="Responsable">{venta.responsable}</Campo>
          <Campo label="Contacto">{venta.contacto}</Campo>
          <Campo label="Teléfono">{venta.telefono}</Campo>
          <Campo label="Email">{venta.email}</Campo>
          <Campo label="Dirección">{venta.direccion}</Campo>
          <Campo label="Forma de cobro">{venta.forma_cobro}</Campo>
          <Campo label="Ref. bancaria">{venta.ref_bancaria}</Campo>
          <Campo label="Aceptación">{fechaCorta(venta.fecha_aceptacion)}</Campo>
          <Campo label="Prevista ejecución">{fechaCorta(venta.fecha_prevista_ejecucion)}</Campo>
          <Campo label="Inicio real">{fechaCorta(venta.fecha_inicio_real)}</Campo>
          <Campo label="Fin real">{fechaCorta(venta.fecha_fin_real)}</Campo>
          <Campo label="Prevista facturación">{fechaCorta(venta.fecha_prevista_facturacion)}</Campo>
          <Campo label="Real facturación">{fechaCorta(venta.fecha_real_facturacion)}</Campo>
          <Campo label="Nº factura">{venta.numero_factura}</Campo>
          <Campo label="Técnicos">{venta.tecnicos}</Campo>
          <Campo label="Horas prev./real">{`${venta.horas_previstas ?? '—'} / ${venta.horas_reales ?? '—'}`}</Campo>
          <Campo label="Turbina">
            {venta.requiere_turbina
              ? (venta.turbina_devuelta ? 'Devuelta' : venta.turbina_instalada ? 'Instalada · pendiente devolver' : 'Requiere')
              : 'No aplica'}
          </Campo>
        </div>
        {venta.observaciones && (
          <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
            <Campo label="Observaciones">{venta.observaciones}</Campo>
          </div>
        )}
      </section>

      {/* Gastos */}
      <GastosSeccion ventaId={id} onCambio={setGastos} />
    </div>
  )
}

function Cifra({ label, valor, sub, destacado, color }: { label: string; valor: string; sub?: string; destacado?: boolean; color?: string }) {
  return (
    <div className="rounded-xl p-3" style={{ background: destacado ? 'color-mix(in srgb, var(--brand-1) 8%, var(--bg))' : 'var(--bg)', border: '1px solid var(--border)' }}>
      <div className="text-[11px]" style={{ color: 'var(--text-subtle)' }}>{label}</div>
      <div className="font-semibold mt-0.5" style={{ color: color || (destacado ? 'var(--brand-1)' : 'var(--text)') }}>{valor}</div>
      {sub && <div className="text-xs font-semibold" style={{ color: color || 'var(--text-muted)' }}>{sub}</div>}
    </div>
  )
}
