'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Venta, VentaInput } from '@/lib/tipos'
import { crearVenta, actualizarVenta } from '@/lib/db/ventas'
import { derivarIva } from '@/lib/calculos'
import { ESTADOS, ESTADO_LABEL, TIPOS_TRABAJO, FORMAS_COBRO, eur } from '@/lib/dominio'

type Datos = Record<string, any>

function aDatos(v?: Venta | null): Datos {
  return {
    numero: v?.numero ?? '',
    cliente: v?.cliente ?? '',
    cliente_id: v?.cliente_id ?? null,
    empresa_local: v?.empresa_local ?? '',
    contacto: v?.contacto ?? '',
    telefono: v?.telefono ?? '',
    email: v?.email ?? '',
    direccion: v?.direccion ?? '',
    tipo_trabajo: v?.tipo_trabajo ?? 'limpieza',
    responsable: v?.responsable ?? '',
    estado: v?.estado ?? 'presupuesto_aceptado',
    base_imponible: v?.base_imponible ?? null,
    iva_porcentaje: v?.iva_porcentaje ?? 21,
    importe_cobrado: v?.importe_cobrado ?? null,
    fecha_cobro: v?.fecha_cobro ?? '',
    forma_cobro: v?.forma_cobro ?? '',
    ref_bancaria: v?.ref_bancaria ?? '',
    fecha_aceptacion: v?.fecha_aceptacion ?? '',
    fecha_prevista_ejecucion: v?.fecha_prevista_ejecucion ?? '',
    fecha_inicio_real: v?.fecha_inicio_real ?? '',
    fecha_fin_real: v?.fecha_fin_real ?? '',
    fecha_prevista_facturacion: v?.fecha_prevista_facturacion ?? '',
    fecha_real_facturacion: v?.fecha_real_facturacion ?? '',
    numero_factura: v?.numero_factura ?? '',
    tecnicos: v?.tecnicos ?? '',
    horas_previstas: v?.horas_previstas ?? null,
    horas_reales: v?.horas_reales ?? null,
    dias_previstos: v?.dias_previstos ?? null,
    dias_reales: v?.dias_reales ?? null,
    requiere_turbina: v?.requiere_turbina ?? false,
    turbina_instalada: v?.turbina_instalada ?? false,
    turbina_devuelta: v?.turbina_devuelta ?? false,
    observaciones: v?.observaciones ?? '',
  }
}

export default function FormularioPresupuesto({ venta }: { venta?: Venta | null }) {
  const router = useRouter()
  const edicion = !!venta
  const [d, setD] = useState<Datos>(() => aDatos(venta))
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const set = (k: string, val: any) => setD((prev) => ({ ...prev, [k]: val }))

  const { ivaImporte, totalConIva } = useMemo(
    () => derivarIva(Number(d.base_imponible) || 0, Number(d.iva_porcentaje) || 0),
    [d.base_imponible, d.iva_porcentaje]
  )

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setGuardando(true)
    // Vaciar strings a null y derivar IVA
    const payload: VentaInput = {
      ...limpiar(d),
      iva_importe: ivaImporte,
      total_con_iva: totalConIva,
    }
    try {
      if (!edicion) {
        const { data } = await supabase.auth.getUser()
        payload.creado_por = data.user?.id ?? null
      }
      const res = edicion
        ? await actualizarVenta(venta!.id, payload)
        : await crearVenta(payload)
      router.push(`/presupuestos/${res.id}`)
    } catch (err: any) {
      setError(err.message || 'Error al guardar')
      setGuardando(false)
    }
  }

  return (
    <form onSubmit={guardar} className="flex flex-col gap-5">
      <header className="flex items-center justify-between">
        <h1 className="titulo-hero" style={{ color: 'var(--text)' }}>
          {edicion ? 'Editar presupuesto' : 'Nuevo presupuesto'}
        </h1>
      </header>

      {error && <div className="card p-3 text-sm" style={{ color: 'var(--red)' }}>{error}</div>}

      {/* Datos generales */}
      <Seccion titulo="Datos generales">
        <Grid>
          <Texto label="Nº de presupuesto" v={d.numero} on={(x) => set('numero', x)} />
          <AutocompleteCliente
            valor={d.cliente}
            onTexto={(x) => set('cliente', x)}
            onElegir={(nombre, id) => { set('cliente', nombre); set('cliente_id', id) }}
          />
          <Texto label="Empresa / local" v={d.empresa_local} on={(x) => set('empresa_local', x)} />
          <Texto label="Persona de contacto" v={d.contacto} on={(x) => set('contacto', x)} />
          <Texto label="Teléfono" v={d.telefono} on={(x) => set('telefono', x)} />
          <Texto label="Email" v={d.email} on={(x) => set('email', x)} />
          <Texto label="Dirección" v={d.direccion} on={(x) => set('direccion', x)} ancho />
          <SelectF label="Tipo de trabajo" v={d.tipo_trabajo} on={(x) => set('tipo_trabajo', x)}
            ops={TIPOS_TRABAJO.map((t) => ({ v: t.valor, l: t.label }))} />
          <Texto label="Responsable" v={d.responsable} on={(x) => set('responsable', x)} />
          <SelectF label="Estado" v={d.estado} on={(x) => set('estado', x)}
            ops={ESTADOS.map((e) => ({ v: e, l: ESTADO_LABEL[e] }))} />
        </Grid>
      </Seccion>

      {/* Económico */}
      <Seccion titulo="Económico">
        <Grid>
          <Numero label="Base imponible (sin IVA)" v={d.base_imponible} on={(x) => set('base_imponible', x)} />
          <Numero label="% IVA" v={d.iva_porcentaje} on={(x) => set('iva_porcentaje', x)} />
          <Numero label="Importe cobrado" v={d.importe_cobrado} on={(x) => set('importe_cobrado', x)} />
          <FechaF label="Fecha de cobro" v={d.fecha_cobro} on={(x) => set('fecha_cobro', x)} />
          <SelectF label="Forma de cobro" v={d.forma_cobro} on={(x) => set('forma_cobro', x)}
            ops={FORMAS_COBRO.map((f) => ({ v: f, l: f }))} permitirVacio />
          <Texto label="Referencia bancaria" v={d.ref_bancaria} on={(x) => set('ref_bancaria', x)} />
        </Grid>
        {/* Resumen IVA en vivo */}
        <div className="grid grid-cols-3 gap-3 mt-4">
          <Mini label="IVA" valor={eur(ivaImporte)} />
          <Mini label="Total con IVA" valor={eur(totalConIva)} destacado />
          <Mini label="Total sin IVA" valor={eur(Number(d.base_imponible) || 0)} />
        </div>
      </Seccion>

      {/* Fechas y facturación */}
      <Seccion titulo="Fechas y facturación">
        <Grid>
          <FechaF label="Fecha de aceptación" v={d.fecha_aceptacion} on={(x) => set('fecha_aceptacion', x)} />
          <FechaF label="Prevista de ejecución" v={d.fecha_prevista_ejecucion} on={(x) => set('fecha_prevista_ejecucion', x)} />
          <FechaF label="Inicio real" v={d.fecha_inicio_real} on={(x) => set('fecha_inicio_real', x)} />
          <FechaF label="Fin real" v={d.fecha_fin_real} on={(x) => set('fecha_fin_real', x)} />
          <FechaF label="Prevista de facturación" v={d.fecha_prevista_facturacion} on={(x) => set('fecha_prevista_facturacion', x)} />
          <FechaF label="Real de facturación" v={d.fecha_real_facturacion} on={(x) => set('fecha_real_facturacion', x)} />
          <Texto label="Nº de factura" v={d.numero_factura} on={(x) => set('numero_factura', x)} />
        </Grid>
      </Seccion>

      {/* Operativo */}
      <Seccion titulo="Operativo (informativo)">
        <Grid>
          <Texto label="Técnicos asignados" v={d.tecnicos} on={(x) => set('tecnicos', x)} ancho />
          <Numero label="Horas previstas" v={d.horas_previstas} on={(x) => set('horas_previstas', x)} />
          <Numero label="Horas reales" v={d.horas_reales} on={(x) => set('horas_reales', x)} />
          <Numero label="Días previstos" v={d.dias_previstos} on={(x) => set('dias_previstos', x)} />
          <Numero label="Días reales" v={d.dias_reales} on={(x) => set('dias_reales', x)} />
        </Grid>
        <div className="flex flex-wrap gap-4 mt-3">
          <Check label="Requiere turbina" v={d.requiere_turbina} on={(x) => set('requiere_turbina', x)} />
          <Check label="Turbina de sustitución instalada" v={d.turbina_instalada} on={(x) => set('turbina_instalada', x)} />
          <Check label="Turbina devuelta" v={d.turbina_devuelta} on={(x) => set('turbina_devuelta', x)} />
        </div>
      </Seccion>

      <Seccion titulo="Observaciones">
        <textarea
          value={d.observaciones}
          onChange={(e) => set('observaciones', e.target.value)}
          rows={3}
          className="w-full rounded-xl px-3 py-2 text-sm"
          style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}
        />
      </Seccion>

      <div className="flex gap-3 justify-end sticky bottom-0 py-3" style={{ background: 'linear-gradient(to top, var(--bg) 60%, transparent)' }}>
        <button type="button" onClick={() => router.back()} className="rounded-xl px-4 py-2.5 font-semibold"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text)' }}>
          Cancelar
        </button>
        <button type="submit" disabled={guardando} className="marca-gradiente rounded-xl px-5 py-2.5 font-semibold text-white"
          style={{ opacity: guardando ? 0.7 : 1, boxShadow: 'var(--shadow-sm)' }}>
          {guardando ? 'Guardando…' : edicion ? 'Guardar cambios' : 'Crear presupuesto'}
        </button>
      </div>
    </form>
  )
}

// Convierte strings vacíos a null y números string a number.
function limpiar(d: Datos): VentaInput {
  const out: Datos = {}
  for (const [k, v] of Object.entries(d)) {
    if (v === '' ) { out[k] = null; continue }
    out[k] = v
  }
  const numericos = ['base_imponible', 'iva_porcentaje', 'importe_cobrado', 'horas_previstas', 'horas_reales', 'dias_previstos', 'dias_reales']
  for (const n of numericos) {
    if (out[n] != null) out[n] = Number(out[n])
  }
  return out as VentaInput
}

/* ----------------------- Subcomponentes de formulario ----------------------- */

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="card p-5">
      <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-muted)' }}>{titulo}</h2>
      {children}
    </section>
  )
}
function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{children}</div>
}
const inputEstilo: React.CSSProperties = {
  background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)',
  borderRadius: 12, padding: '9px 12px', fontSize: '0.9rem', width: '100%', marginTop: 4,
}
function Texto({ label, v, on, ancho }: { label: string; v: any; on: (x: string) => void; ancho?: boolean }) {
  return (
    <div className={ancho ? 'md:col-span-2' : ''}>
      <span className="text-xs font-medium" style={{ color: 'var(--text-subtle)' }}>{label}</span>
      <input value={v ?? ''} onChange={(e) => on(e.target.value)} style={inputEstilo} />
    </div>
  )
}
function Numero({ label, v, on }: { label: string; v: any; on: (x: any) => void }) {
  return (
    <div>
      <span className="text-xs font-medium" style={{ color: 'var(--text-subtle)' }}>{label}</span>
      <input type="number" step="any" value={v ?? ''} onChange={(e) => on(e.target.value === '' ? '' : e.target.value)} style={inputEstilo} />
    </div>
  )
}
function FechaF({ label, v, on }: { label: string; v: any; on: (x: string) => void }) {
  return (
    <div>
      <span className="text-xs font-medium" style={{ color: 'var(--text-subtle)' }}>{label}</span>
      <input type="date" value={v ?? ''} onChange={(e) => on(e.target.value)} style={inputEstilo} />
    </div>
  )
}
function SelectF({ label, v, on, ops, permitirVacio }: { label: string; v: any; on: (x: string) => void; ops: { v: string; l: string }[]; permitirVacio?: boolean }) {
  return (
    <div>
      <span className="text-xs font-medium" style={{ color: 'var(--text-subtle)' }}>{label}</span>
      <select value={v ?? ''} onChange={(e) => on(e.target.value)} style={inputEstilo}>
        {permitirVacio && <option value="">—</option>}
        {ops.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
    </div>
  )
}
function Check({ label, v, on }: { label: string; v: boolean; on: (x: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer text-sm" style={{ color: 'var(--text)' }}>
      <input type="checkbox" checked={!!v} onChange={(e) => on(e.target.checked)} style={{ width: 16, height: 16, accentColor: 'var(--brand-1)' }} />
      {label}
    </label>
  )
}
function Mini({ label, valor, destacado }: { label: string; valor: string; destacado?: boolean }) {
  return (
    <div className="rounded-xl px-3 py-2" style={{ background: destacado ? 'color-mix(in srgb, var(--brand-1) 8%, var(--bg))' : 'var(--bg)', border: '1px solid var(--border)' }}>
      <div className="text-[11px]" style={{ color: 'var(--text-subtle)' }}>{label}</div>
      <div className="font-semibold" style={{ color: destacado ? 'var(--brand-1)' : 'var(--text)' }}>{valor}</div>
    </div>
  )
}

/* ----------------------- Autocomplete de cliente ----------------------- */

function AutocompleteCliente({ valor, onTexto, onElegir }: {
  valor: string
  onTexto: (x: string) => void
  onElegir: (nombre: string, id: string) => void
}) {
  const [sugerencias, setSugerencias] = useState<{ id: string; nombre: string }[]>([])
  const [abierto, setAbierto] = useState(false)

  useEffect(() => {
    const t = valor?.trim()
    if (!t || t.length < 2) { setSugerencias([]); return }
    let activo = true
    const tid = setTimeout(async () => {
      const { data } = await (supabase as any)
        .from('clientes')
        .select('id, nombre')
        .ilike('nombre', `%${t}%`)
        .limit(8)
      if (activo) setSugerencias((data || []) as { id: string; nombre: string }[])
    }, 220)
    return () => { activo = false; clearTimeout(tid) }
  }, [valor])

  return (
    <div className="relative">
      <span className="text-xs font-medium" style={{ color: 'var(--text-subtle)' }}>Cliente</span>
      <input
        value={valor ?? ''}
        onChange={(e) => { onTexto(e.target.value); setAbierto(true) }}
        onFocus={() => setAbierto(true)}
        onBlur={() => setTimeout(() => setAbierto(false), 150)}
        placeholder="Escribe para buscar…"
        style={inputEstilo}
      />
      {abierto && sugerencias.length > 0 && (
        <div className="absolute z-20 mt-1 w-full rounded-xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)' }}>
          {sugerencias.map((c) => (
            <button
              key={c.id}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); onElegir(c.nombre, c.id); setAbierto(false) }}
              className="block w-full text-left px-3 py-2 text-sm hover:bg-[var(--bg-subtle)]"
              style={{ color: 'var(--text)' }}
            >
              {c.nombre}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
