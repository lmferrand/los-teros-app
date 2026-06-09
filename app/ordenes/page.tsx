'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { listarOrdenes, crearOrden, actualizarOrden, type OrdenConRefs } from '@/lib/db/ordenes'
import { listarTrabajadores } from '@/lib/db/inventario'
import {
  TIPOS_OT, ESTADOS_OT, ESTADOS_OT_LISTA, PRIORIDADES, DURACIONES, labelTipoOt, type Orden,
} from '@/lib/ordenes'
import { fechaCorta } from '@/lib/dominio'
import { EstadoVacio, SkeletonLista } from '@/app/components/ui'

const inp: React.CSSProperties = { background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 10, padding: '9px 11px', fontSize: '0.9rem', width: '100%', marginTop: 3 }

export function ChipEstadoOt({ estado }: { estado: string | null }) {
  const e = ESTADOS_OT[estado || ''] || { label: estado || '—', color: 'var(--text-muted)' }
  return <span className="inline-flex items-center gap-1.5 rounded-full text-xs font-semibold px-2.5 py-1 whitespace-nowrap" style={{ background: `color-mix(in srgb, ${e.color} 14%, transparent)`, color: e.color }}><span className="inline-block rounded-full" style={{ width: 6, height: 6, background: e.color }} />{e.label}</span>
}

export default function OrdenesPage() {
  const [ordenes, setOrdenes] = useState<OrdenConRefs[]>([])
  const [tecnicos, setTecnicos] = useState<{ id: string; nombre: string | null }[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')
  const [fEstado, setFEstado] = useState('')
  const [fPrioridad, setFPrioridad] = useState('')
  const [editar, setEditar] = useState<OrdenConRefs | 'nuevo' | null>(null)

  async function cargar() {
    try {
      const [o, t] = await Promise.all([listarOrdenes(), listarTrabajadores()])
      setOrdenes(o); setTecnicos(t)
    } catch (e: any) { setError(e.message || 'Error') }
    finally { setCargando(false) }
  }
  useEffect(() => { cargar() }, [])

  const lista = useMemo(() => {
    const t = q.trim().toLowerCase()
    return ordenes.filter((o) => {
      if (fEstado && o.estado !== fEstado) return false
      if (fPrioridad && (o.prioridad || '2') !== fPrioridad) return false
      if (t && !`${o.codigo} ${o.clientes?.nombre || ''}`.toLowerCase().includes(t)) return false
      return true
    })
  }, [ordenes, q, fEstado, fPrioridad])

  return (
    <div>
      <header className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div>
          <h1 className="titulo-hero" style={{ color: 'var(--text)' }}>Órdenes de trabajo</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>{cargando ? 'Cargando…' : `${lista.length} de ${ordenes.length}`}</p>
        </div>
        <button onClick={() => setEditar('nuevo')} className="marca-gradiente inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-white font-semibold" style={{ boxShadow: 'var(--shadow-sm)' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          Nueva OT
        </button>
      </header>

      <div className="flex flex-wrap gap-2 items-center mb-4">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por código o cliente…" className="flex-1 min-w-[180px] rounded-lg px-3 py-2 text-sm" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text)' }} />
        <select value={fEstado} onChange={(e) => setFEstado(e.target.value)} className="rounded-lg px-2.5 py-2 text-sm" style={{ background: 'var(--bg-card)', border: `1px solid ${fEstado ? 'var(--brand-1)' : 'var(--border)'}`, color: 'var(--text)' }}>
          <option value="">Estado</option>
          {ESTADOS_OT_LISTA.map((e) => <option key={e} value={e}>{ESTADOS_OT[e].label}</option>)}
        </select>
        <select value={fPrioridad} onChange={(e) => setFPrioridad(e.target.value)} className="rounded-lg px-2.5 py-2 text-sm" style={{ background: 'var(--bg-card)', border: `1px solid ${fPrioridad ? 'var(--brand-1)' : 'var(--border)'}`, color: 'var(--text)' }}>
          <option value="">Prioridad</option>
          {Object.entries(PRIORIDADES).map(([v, o]) => <option key={v} value={v}>{o.label}</option>)}
        </select>
      </div>

      {error && <div className="card p-4 mb-4 text-sm" style={{ color: 'var(--red)' }}>{error}</div>}

      {cargando ? <SkeletonLista /> : lista.length === 0 ? (
        <EstadoVacio titulo="Sin órdenes" texto={ordenes.length ? 'Prueba con otros filtros.' : 'Crea la primera OT.'} />
      ) : (
        <div className="flex flex-col gap-2">
          {lista.map((o) => {
            const pr = PRIORIDADES[o.prioridad || '2']
            return (
              <Link key={o.id} href={`/ordenes/${o.id}`} className="card card-hover p-4 flex items-center gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold truncate" style={{ color: 'var(--text)' }}>{o.clientes?.nombre || 'Sin cliente'}</span>
                    <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>{o.codigo}</span>
                  </div>
                  <div className="text-xs mt-0.5 flex items-center gap-2 flex-wrap" style={{ color: 'var(--text-muted)' }}>
                    <span>{labelTipoOt(o.tipo)}</span>
                    {o.fecha_programada && <><span>·</span><span>{fechaCorta(o.fecha_programada)}</span></>}
                    {o.perfiles?.nombre && <><span>·</span><span>{o.perfiles.nombre}</span></>}
                  </div>
                </div>
                <span className="text-xs font-semibold" style={{ color: pr?.color }}>{pr?.label}</span>
                <ChipEstadoOt estado={o.estado} />
              </Link>
            )
          })}
        </div>
      )}

      {editar && <OrdenForm orden={editar === 'nuevo' ? null : editar} tecnicos={tecnicos} onCerrar={() => setEditar(null)} onGuardado={() => { setEditar(null); cargar() }} />}
    </div>
  )
}

export function OrdenForm({ orden, tecnicos, onCerrar, onGuardado }: { orden: Orden | null; tecnicos: { id: string; nombre: string | null }[]; onCerrar: () => void; onGuardado: () => void }) {
  const [d, setD] = useState({
    tipo: orden?.tipo ?? 'limpieza',
    cliente_id: orden?.cliente_id ?? '',
    clienteNombre: '',
    estado: orden?.estado ?? 'pendiente',
    prioridad: orden?.prioridad ?? '2',
    fecha_programada: orden?.fecha_programada ? new Date(orden.fecha_programada).toISOString().slice(0, 16) : '',
    duracion_horas: orden?.duracion_horas != null ? String(orden.duracion_horas) : '2',
    hora_fija: orden?.hora_fija ?? false,
    descripcion: orden?.descripcion ?? '',
    materiales_previstos: orden?.materiales_previstos ?? '',
    observaciones: orden?.observaciones ?? '',
    tecnicos_ids: orden?.tecnicos_ids ?? (orden?.tecnico_id ? [orden.tecnico_id] : []),
  })
  const [busqueda, setBusqueda] = useState('')
  const [sug, setSug] = useState<{ id: string; nombre: string }[]>([])
  const [abierto, setAbierto] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const set = (k: string, v: any) => setD((p) => ({ ...p, [k]: v }))

  // Carga el nombre del cliente actual al editar.
  useEffect(() => {
    if (orden?.cliente_id) {
      (supabase as any).from('clientes').select('nombre').eq('id', orden.cliente_id).maybeSingle().then(({ data }: any) => { if (data) setD((p) => ({ ...p, clienteNombre: data.nombre })) })
    }
  }, [orden])

  useEffect(() => {
    const t = busqueda.trim()
    if (t.length < 2) { setSug([]); return }
    let activo = true
    const tid = setTimeout(async () => {
      const { data } = await (supabase as any).from('clientes').select('id, nombre').ilike('nombre', `%${t}%`).limit(8)
      if (activo) setSug((data || []) as { id: string; nombre: string }[])
    }, 220)
    return () => { activo = false; clearTimeout(tid) }
  }, [busqueda])

  function toggleTecnico(id: string) {
    setD((p) => ({ ...p, tecnicos_ids: p.tecnicos_ids.includes(id) ? p.tecnicos_ids.filter((x: string) => x !== id) : [...p.tecnicos_ids, id] }))
  }

  async function guardar() {
    setGuardando(true)
    const payload: Partial<Orden> = {
      tipo: d.tipo, cliente_id: d.cliente_id || null, estado: d.estado, prioridad: d.prioridad,
      fecha_programada: d.fecha_programada ? new Date(d.fecha_programada).toISOString() : null,
      duracion_horas: parseFloat(d.duracion_horas) || null, hora_fija: d.hora_fija,
      descripcion: d.descripcion || null, materiales_previstos: d.materiales_previstos || null,
      observaciones: d.observaciones || null,
      tecnicos_ids: d.tecnicos_ids, tecnico_id: d.tecnicos_ids[0] || null,
      fecha_cierre: d.estado === 'completada' ? (orden?.fecha_cierre || new Date().toISOString()) : null,
    }
    try {
      if (orden) await actualizarOrden(orden.id, payload)
      else await crearOrden(payload)
      onGuardado()
    } catch { setGuardando(false) }
  }

  const L = ({ children }: { children: React.ReactNode }) => <span className="text-xs font-medium" style={{ color: 'var(--text-subtle)' }}>{children}</span>
  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center md:p-4" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={onCerrar}>
      <div className="w-full md:max-w-lg rounded-t-2xl md:rounded-2xl p-5" style={{ background: 'var(--bg-card)', maxHeight: '92vh', overflowY: 'auto', boxShadow: 'var(--shadow-lg)' }} onClick={(e) => e.stopPropagation()}>
        <h3 className="font-semibold mb-4" style={{ color: 'var(--text)' }}>{orden ? `Editar OT ${orden.codigo}` : 'Nueva OT'}</h3>
        <div className="grid grid-cols-2 gap-3">
          {/* Cliente */}
          <div className="col-span-2 relative">
            <L>Cliente</L>
            <input
              value={d.cliente_id ? d.clienteNombre : busqueda}
              onChange={(e) => { set('cliente_id', ''); set('clienteNombre', ''); setBusqueda(e.target.value); setAbierto(true) }}
              onFocus={() => setAbierto(true)} onBlur={() => setTimeout(() => setAbierto(false), 150)}
              placeholder="Escribe para buscar…" style={inp}
            />
            {abierto && sug.length > 0 && !d.cliente_id && (
              <div className="absolute z-20 mt-1 w-full rounded-xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)' }}>
                {sug.map((c) => (
                  <button key={c.id} type="button" onMouseDown={(e) => { e.preventDefault(); set('cliente_id', c.id); set('clienteNombre', c.nombre); setAbierto(false) }} className="block w-full text-left px-3 py-2 text-sm hover:bg-[var(--bg-subtle)]" style={{ color: 'var(--text)' }}>{c.nombre}</button>
                ))}
              </div>
            )}
          </div>
          <label><L>Tipo</L><select value={d.tipo} onChange={(e) => set('tipo', e.target.value)} style={inp}>{TIPOS_OT.map((t) => <option key={t.valor} value={t.valor}>{t.label}</option>)}</select></label>
          <label><L>Estado</L><select value={d.estado} onChange={(e) => set('estado', e.target.value)} style={inp}>{ESTADOS_OT_LISTA.map((e) => <option key={e} value={e}>{ESTADOS_OT[e].label}</option>)}</select></label>
          <label><L>Prioridad</L><select value={d.prioridad} onChange={(e) => set('prioridad', e.target.value)} style={inp}>{Object.entries(PRIORIDADES).map(([v, o]) => <option key={v} value={v}>{o.label}</option>)}</select></label>
          <label><L>Duración</L><select value={d.duracion_horas} onChange={(e) => set('duracion_horas', e.target.value)} style={inp}>{DURACIONES.map((x) => <option key={x.v} value={x.v}>{x.label}</option>)}</select></label>
          <label className="col-span-2"><L>Fecha programada</L><input type="datetime-local" value={d.fecha_programada} onChange={(e) => set('fecha_programada', e.target.value)} style={inp} /></label>
          <label className="col-span-2 flex items-center gap-2 mt-1" style={{ color: 'var(--text)' }}><input type="checkbox" checked={d.hora_fija} onChange={(e) => set('hora_fija', e.target.checked)} style={{ width: 16, height: 16, accentColor: 'var(--brand-1)' }} /><span className="text-sm">Hora fija</span></label>
          <div className="col-span-2">
            <L>Técnicos</L>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {tecnicos.length === 0 && <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>No hay trabajadores.</span>}
              {tecnicos.map((t) => {
                const on = d.tecnicos_ids.includes(t.id)
                return <button key={t.id} type="button" onClick={() => toggleTecnico(t.id)} className="text-xs rounded-full px-2.5 py-1" style={{ background: on ? 'color-mix(in srgb, var(--brand-1) 14%, transparent)' : 'var(--bg)', color: on ? 'var(--brand-1)' : 'var(--text-muted)', border: `1px solid ${on ? 'var(--brand-1)' : 'var(--border)'}` }}>{t.nombre || t.id.slice(0, 6)}</button>
              })}
            </div>
          </div>
          <label className="col-span-2"><L>Descripción</L><input value={d.descripcion} onChange={(e) => set('descripcion', e.target.value)} style={inp} /></label>
          <label className="col-span-2"><L>Materiales previstos</L><input value={d.materiales_previstos} onChange={(e) => set('materiales_previstos', e.target.value)} style={inp} /></label>
          <label className="col-span-2"><L>Observaciones</L><input value={d.observaciones} onChange={(e) => set('observaciones', e.target.value)} style={inp} /></label>
        </div>
        <div className="flex gap-3 justify-end mt-5">
          <button onClick={onCerrar} className="rounded-xl px-4 py-2 font-semibold" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}>Cancelar</button>
          <button onClick={guardar} disabled={guardando} className="marca-gradiente rounded-xl px-4 py-2 font-semibold text-white" style={{ opacity: guardando ? 0.7 : 1 }}>{guardando ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </div>
    </div>
  )
}
