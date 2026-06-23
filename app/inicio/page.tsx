'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSesion } from '@/lib/sesion'
import { useDatosFinancieros } from '@/lib/useDatos'
import { resumenMensual, mesActualClave, esMargenBajo, esTerminadoNoFacturado, esCobroVencido } from '@/lib/agregados'
import { listarOrdenes, type OrdenConRefs } from '@/lib/db/ordenes'
import { listarMateriales } from '@/lib/db/inventario'
import { stockBajo, type Material } from '@/lib/inventario'
import { esMiOrden } from '@/lib/ordenes'
import { eur, pct, colorMargen } from '@/lib/dominio'
import { puedeVerFinanzas, esRestringido } from '@/lib/acceso'

const hoyISO = () => new Date().toISOString().slice(0, 10)

export default function InicioPage() {
  const { user, perfil } = useSesion()
  const { datos, gastos } = useDatosFinancieros()
  const [ordenes, setOrdenes] = useState<OrdenConRefs[]>([])
  const [materiales, setMateriales] = useState<Material[]>([])

  useEffect(() => {
    listarOrdenes().then(setOrdenes).catch(() => {})
    listarMateriales().then(setMateriales).catch(() => {})
  }, [])

  const resumen = useMemo(() => resumenMensual(datos, gastos, mesActualClave()), [datos, gastos])
  const margenRealPct = resumen.ventasAceptadas > 0 ? (resumen.margenReal / resumen.ventasAceptadas) * 100 : null

  const misOrdenes = esRestringido(perfil?.rol) ? ordenes.filter((o) => esMiOrden(o, user?.id)) : ordenes
  const otPendientes = misOrdenes.filter((o) => o.estado === 'pendiente' || o.estado === 'en_curso')
  const otHoy = misOrdenes.filter((o) => (o.fecha_programada || '').slice(0, 10) === hoyISO())
  const bajos = materiales.filter(stockBajo)
  const margenBajo = datos.filter(esMargenBajo)
  const sinFacturar = datos.filter(esTerminadoNoFacturado)
  const cobrosVencidos = datos.filter(esCobroVencido)

  const verFin = puedeVerFinanzas(perfil)
  const hoyTxt = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })

  const accesos = [
    { href: '/presupuestos', label: 'Presupuestos', color: 'var(--brand-1)', d: 'M9 12h6m-6 4h6m-6-8h6M6 2h9l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Z' },
    { href: '/ordenes', label: 'Órdenes', color: 'var(--teal)', d: 'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11' },
    { href: '/clientes', label: 'Clientes', color: 'var(--violet)', d: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8' },
    { href: '/inventario', label: 'Inventario', color: 'var(--amber)', d: 'M21 8V6a2 2 0 0 0-2-2h-3M3 8V6a2 2 0 0 1 2-2h3m-5 8v6a2 2 0 0 0 2 2h3m13-8v6a2 2 0 0 1-2 2h-3M8 12h8' },
    { href: '/sin-servicio', label: 'Recordatorios', color: 'var(--red)', d: 'M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9' },
    { href: '/documentos', label: 'Documentos IA', color: 'var(--green)', d: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Zm0 0v6h6' },
  ]

  return (
    <div>
      <header className="mb-5">
        <p className="text-sm capitalize" style={{ color: 'var(--text-subtle)' }}>{hoyTxt}</p>
        <h1 className="titulo-hero" style={{ color: 'var(--text)' }}>Hola{perfil?.nombre ? `, ${perfil.nombre.split(' ')[0]}` : ''} 👋</h1>
        <p className="mt-1" style={{ color: 'var(--text-muted)' }}>Tu empresa de un vistazo.</p>
      </header>

      {/* Este mes (solo quien puede ver finanzas) */}
      {verFin && (
        <>
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold" style={{ color: 'var(--text)' }}>Este mes</h2>
            <Link href="/dashboard" className="text-sm font-semibold" style={{ color: 'var(--brand-1)' }}>Ver dashboard →</Link>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <Kpi label="Ventas aceptadas" valor={eur(resumen.ventasAceptadas)} color="var(--brand-1)" />
            <Kpi label="Cobros" valor={eur(resumen.cobros)} color="var(--green)" />
            <Kpi label="Facturado" valor={eur(resumen.facturacionEmitida)} color="var(--teal)" />
            <Kpi label="Margen real" valor={pct(margenRealPct)} color={colorMargen(margenRealPct)} />
          </div>
        </>
      )}

      {/* Atención */}
      <h2 className="font-semibold mb-2" style={{ color: 'var(--text)' }}>Requiere atención</h2>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
        <Tile n={otHoy.length} label="Órdenes de hoy" href="/ordenes" color="var(--brand-1)" />
        <Tile n={otPendientes.length} label="Órdenes pendientes" href="/ordenes" color="var(--amber)" />
        <Tile n={bajos.length} label="Materiales con stock bajo" href="/inventario" color="var(--red)" />
        {verFin && <Tile n={cobrosVencidos.length} label="Cobros fuera de plazo" href="/alertas" color="var(--red)" />}
        {verFin && <Tile n={sinFacturar.length} label="Terminados sin facturar" href="/alertas" color="var(--amber)" />}
        {verFin && <Tile n={margenBajo.length} label="Margen inferior al 30%" href="/alertas" color="var(--red)" />}
      </div>

      {/* Accesos rápidos */}
      <h2 className="font-semibold mb-2" style={{ color: 'var(--text)' }}>Accesos rápidos</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {accesos.map((a) => (
          <Link key={a.href} href={a.href} className="card card-hover p-4 flex items-center gap-3">
            <span className="grid place-items-center rounded-xl shrink-0" style={{ width: 42, height: 42, background: `color-mix(in srgb, ${a.color} 14%, transparent)` }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={a.color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={a.d} /></svg>
            </span>
            <span className="font-semibold" style={{ color: 'var(--text)' }}>{a.label}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}

function Kpi({ label, valor, color }: { label: string; valor: string; color: string }) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="inline-block rounded-full" style={{ width: 8, height: 8, background: color }} />
        <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{label}</span>
      </div>
      <div className="text-xl font-bold" style={{ color: 'var(--text)' }}>{valor}</div>
    </div>
  )
}

function Tile({ n, label, href, color }: { n: number; label: string; href: string; color: string }) {
  return (
    <Link href={href} className="card card-hover p-4 flex items-center justify-between gap-2">
      <span className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span className="text-2xl font-bold shrink-0" style={{ color: n > 0 ? color : 'var(--text-subtle)' }}>{n}</span>
    </Link>
  )
}
