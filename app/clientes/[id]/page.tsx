'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  obtenerCliente, borrarCliente, localesMismoCif, serviciosDeCliente, ventasDeCliente,
} from '@/lib/db/clientes'
import { labelEmpresa, type Cliente, type ServicioCliente } from '@/lib/clientes'
import type { Venta } from '@/lib/tipos'
import { eur, fechaCorta } from '@/lib/dominio'
import { Campo, EstadoChip, SkeletonLista } from '@/app/components/ui'
import { ClienteForm } from '../page'

export default function FichaCliente() {
  const id = useParams<{ id: string }>().id
  const router = useRouter()
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [locales, setLocales] = useState<Cliente[]>([])
  const [ventas, setVentas] = useState<Venta[]>([])
  const [servicios, setServicios] = useState<ServicioCliente[]>([])
  const [cargando, setCargando] = useState(true)
  const [editar, setEditar] = useState(false)

  async function cargar() {
    const c = await obtenerCliente(id)
    setCliente(c)
    if (c) {
      const [loc, v, s] = await Promise.all([
        c.cif ? localesMismoCif(c.cif, c.id) : Promise.resolve([]),
        ventasDeCliente(c.id),
        serviciosDeCliente(c.id),
      ])
      setLocales(loc); setVentas(v); setServicios(s)
    }
    setCargando(false)
  }
  useEffect(() => { cargar() }, [id])

  async function eliminar() {
    if (!confirm('¿Eliminar este cliente?')) return
    await borrarCliente(id)
    router.push('/clientes')
  }

  if (cargando) return <SkeletonLista filas={4} />
  if (!cliente) return <div className="card p-6 text-sm" style={{ color: 'var(--text-muted)' }}>No se encontró el cliente.</div>

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <Link href="/clientes" className="text-sm inline-flex items-center gap-1 mb-2" style={{ color: 'var(--text-subtle)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m15 18-6-6 6-6" /></svg>
            Clientes
          </Link>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="titulo-hero" style={{ color: 'var(--text)' }}>{cliente.nombre}</h1>
            {cliente.empresa && <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: 'var(--bg-subtle)', color: 'var(--text-muted)' }}>{labelEmpresa(cliente.empresa)}</span>}
          </div>
          {cliente.nombre_fiscal && <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>{cliente.nombre_fiscal}</p>}
        </div>
        <div className="flex gap-2">
          <button onClick={() => setEditar(true)} className="rounded-xl px-4 py-2 font-semibold text-sm" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text)' }}>Editar</button>
          <button onClick={eliminar} className="rounded-xl px-3 py-2 font-semibold text-sm" style={{ background: 'color-mix(in srgb, var(--red) 10%, transparent)', color: 'var(--red)' }}>Eliminar</button>
        </div>
      </header>

      <section className="card p-5">
        <h2 className="font-semibold mb-4" style={{ color: 'var(--text)' }}>Datos</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Campo label="CIF">{cliente.cif}</Campo>
          <Campo label="Población">{cliente.poblacion}</Campo>
          <Campo label="Teléfono">{cliente.telefono}</Campo>
          <Campo label="Móvil">{cliente.movil}</Campo>
          <Campo label="Email">{cliente.email}</Campo>
          <Campo label="Dirección">{cliente.direccion}</Campo>
        </div>
        {cliente.notas && <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--border)' }}><Campo label="Notas">{cliente.notas}</Campo></div>}
      </section>

      {locales.length > 0 && (
        <section className="card p-5">
          <h2 className="font-semibold mb-3" style={{ color: 'var(--text)' }}>Otros locales con el mismo CIF <span className="text-xs font-normal" style={{ color: 'var(--text-subtle)' }}>({locales.length})</span></h2>
          <div className="flex flex-col gap-2">
            {locales.map((l) => (
              <Link key={l.id} href={`/clientes/${l.id}`} className="flex items-center justify-between rounded-xl px-3 py-2 hover:bg-[var(--bg-subtle)]" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                <span className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{l.nombre}</span>
                <span className="text-xs shrink-0 ml-2" style={{ color: 'var(--text-subtle)' }}>{l.poblacion || ''}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="card p-5">
        <h2 className="font-semibold mb-3" style={{ color: 'var(--text)' }}>Presupuestos <span className="text-xs font-normal" style={{ color: 'var(--text-subtle)' }}>({ventas.length})</span></h2>
        {ventas.length === 0 ? <p className="text-sm" style={{ color: 'var(--text-subtle)' }}>Sin presupuestos.</p> : (
          <div className="flex flex-col gap-2">
            {ventas.map((v) => (
              <Link key={v.id} href={`/presupuestos/${v.id}`} className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-[var(--bg-subtle)]" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{v.numero || 'Presupuesto'}</div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Aceptado {fechaCorta(v.fecha_aceptacion)}</div>
                </div>
                <span className="text-sm font-semibold shrink-0" style={{ color: 'var(--text)' }}>{eur(v.total_con_iva)}</span>
                <EstadoChip estado={v.estado} />
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="card p-5">
        <h2 className="font-semibold mb-3" style={{ color: 'var(--text)' }}>Historial de servicios <span className="text-xs font-normal" style={{ color: 'var(--text-subtle)' }}>({servicios.length})</span></h2>
        {servicios.length === 0 ? <p className="text-sm" style={{ color: 'var(--text-subtle)' }}>Sin servicios registrados.</p> : (
          <div className="flex flex-col gap-2">
            {servicios.map((s) => (
              <div key={s.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{s.descripcion || s.numero_documento || 'Servicio'}</div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{fechaCorta(s.fecha_servicio)}{s.origen ? ` · ${s.origen}` : ''}</div>
                </div>
                {s.importe != null && <span className="text-sm font-semibold shrink-0" style={{ color: 'var(--text)' }}>{eur(s.importe)}</span>}
              </div>
            ))}
          </div>
        )}
      </section>

      {editar && <ClienteForm cliente={cliente} onCerrar={() => setEditar(false)} onGuardado={() => { setEditar(false); cargar() }} />}
    </div>
  )
}
