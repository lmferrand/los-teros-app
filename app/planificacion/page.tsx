'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { listarOrdenes, type OrdenConRefs } from '@/lib/db/ordenes'
import { listarTrabajadores } from '@/lib/db/inventario'
import { listarTareas, crearTarea, actualizarTarea, borrarTarea } from '@/lib/db/tareas'
import { PRIORIDADES_TAREA, type Tarea } from '@/lib/tareas'
import { labelTipoOt, esMiOrden } from '@/lib/ordenes'
import { useSesion } from '@/lib/sesion'
import { esRestringido } from '@/lib/acceso'
import { useDatosFinancieros } from '@/lib/useDatos'
import { esTerminadoNoFacturado } from '@/lib/agregados'
import { ChipEstadoOt } from '@/app/ordenes/page'
import { SkeletonLista } from '@/app/components/ui'

const inp: React.CSSProperties = { background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 10, padding: '9px 11px', fontSize: '0.9rem', width: '100%', marginTop: 3 }
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const DIAS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
const pad = (n: number) => String(n).padStart(2, '0')

function claveDia(v: string | Date | null | undefined): string | null {
  if (!v) return null
  if (typeof v === 'string' && v.length >= 10 && !v.includes('T')) return v.slice(0, 10)
  const d = v instanceof Date ? v : new Date(v)
  if (isNaN(d.getTime())) return null
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
const hoyKey = () => claveDia(new Date())!

export default function PlanificacionPage() {
  const [ordenes, setOrdenes] = useState<OrdenConRefs[]>([])
  const [tareas, setTareas] = useState<Tarea[]>([])
  const [tecnicos, setTecnicos] = useState<{ id: string; nombre: string | null }[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const { user, perfil } = useSesion()
  const soloMias = esRestringido(perfil?.rol)
  const { datos } = useDatosFinancieros()

  const hoy = new Date()
  const [cursor, setCursor] = useState({ y: hoy.getFullYear(), m: hoy.getMonth() })
  const [sel, setSel] = useState(hoyKey())
  const [editTarea, setEditTarea] = useState<Tarea | 'nueva' | null>(null)

  async function cargar() {
    try {
      const [o, t, tr] = await Promise.all([listarOrdenes(), listarTareas(), listarTrabajadores()])
      setOrdenes(soloMias ? o.filter((x) => esMiOrden(x, user?.id)) : o)
      setTareas(t); setTecnicos(tr)
    } catch (e: any) { setError(e.message || 'Error') }
    finally { setCargando(false) }
  }
  useEffect(() => { cargar() }, [])

  const nombreTec = (id: string | null) => tecnicos.find((t) => t.id === id)?.nombre || ''

  const otPorDia = useMemo(() => {
    const m = new Map<string, OrdenConRefs[]>()
    for (const o of ordenes) { const k = claveDia(o.fecha_programada); if (!k) continue; (m.get(k) || m.set(k, []).get(k)!).push(o) }
    return m
  }, [ordenes])
  const tareasPorDia = useMemo(() => {
    const m = new Map<string, Tarea[]>()
    for (const t of tareas) { const k = claveDia(t.fecha); if (!k) continue; (m.get(k) || m.set(k, []).get(k)!).push(t) }
    return m
  }, [tareas])

  // Rejilla del mes (semana empieza en lunes).
  const celdas = useMemo(() => {
    const primero = new Date(cursor.y, cursor.m, 1)
    const offset = (primero.getDay() + 6) % 7
    const dias = new Date(cursor.y, cursor.m + 1, 0).getDate()
    const arr: (string | null)[] = []
    for (let i = 0; i < offset; i++) arr.push(null)
    for (let d = 1; d <= dias; d++) arr.push(`${cursor.y}-${pad(cursor.m + 1)}-${pad(d)}`)
    while (arr.length % 7 !== 0) arr.push(null)
    return arr
  }, [cursor])

  function mover(delta: number) {
    setCursor((c) => {
      const d = new Date(c.y, c.m + delta, 1)
      return { y: d.getFullYear(), m: d.getMonth() }
    })
  }

  const otsDia = otPorDia.get(sel) || []
  const tareasDia = (tareasPorDia.get(sel) || [])
  const k = hoyKey()

  // Tareas pendientes (orden por fecha; vencidas primero)
  const pendientes = useMemo(() => tareas.filter((t) => !t.hecha).sort((a, b) => (a.fecha || '9999').localeCompare(b.fecha || '9999')), [tareas])
  const vencidas = pendientes.filter((t) => t.fecha && t.fecha < k)

  // Avisos
  const activas = ordenes.filter((o) => o.estado === 'pendiente' || o.estado === 'en_curso')
  const sinFecha = activas.filter((o) => !o.fecha_programada)
  const sinTecnico = activas.filter((o) => !o.tecnico_id && !(o.tecnicos_ids && o.tecnicos_ids.length))
  const sinFacturar = datos.filter(esTerminadoNoFacturado)

  async function toggleTarea(t: Tarea) {
    await actualizarTarea(t.id, { hecha: !t.hecha })
    cargar()
  }

  return (
    <div>
      <header className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <h1 className="titulo-hero" style={{ color: 'var(--text)' }}>Planificación</h1>
        <button onClick={() => setEditTarea('nueva')} className="marca-gradiente inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-white font-semibold" style={{ boxShadow: 'var(--shadow-sm)' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          Nueva tarea
        </button>
      </header>

      {error && <div className="card p-4 mb-4 text-sm" style={{ color: 'var(--red)' }}>{error}. ¿Has ejecutado SQL_tareas.sql en Supabase?</div>}

      {/* Avisos */}
      {!cargando && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          <Aviso n={sinFecha.length} label="OTs sin fecha" href="/ordenes" color="var(--amber)" />
          <Aviso n={sinTecnico.length} label="OTs sin técnico" href="/ordenes" color="var(--amber)" />
          <Aviso n={vencidas.length} label="Tareas vencidas" color="var(--red)" />
          {!soloMias && <Aviso n={sinFacturar.length} label="Terminadas sin facturar" href="/alertas" color="var(--amber)" />}
        </div>
      )}

      {cargando ? <SkeletonLista filas={4} /> : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Calendario */}
          <section className="card p-4 lg:col-span-2">
            <div className="flex items-center justify-between mb-3">
              <button onClick={() => mover(-1)} className="grid place-items-center rounded-lg" style={{ width: 32, height: 32, background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>‹</button>
              <span className="font-semibold" style={{ color: 'var(--text)' }}>{MESES[cursor.m]} {cursor.y}</span>
              <button onClick={() => mover(1)} className="grid place-items-center rounded-lg" style={{ width: 32, height: 32, background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>›</button>
            </div>
            <div className="grid grid-cols-7 gap-1 mb-1">
              {DIAS.map((d) => <div key={d} className="text-center text-[11px] font-semibold py-1" style={{ color: 'var(--text-subtle)' }}>{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {celdas.map((c, i) => {
                if (!c) return <div key={i} />
                const dia = Number(c.slice(8))
                const nOt = (otPorDia.get(c) || []).length
                const nTar = (tareasPorDia.get(c) || []).filter((t) => !t.hecha).length
                const esHoy = c === k
                const esSel = c === sel
                return (
                  <button key={c} onClick={() => setSel(c)} className="rounded-lg flex flex-col items-center justify-start py-1.5" style={{
                    minHeight: 52,
                    background: esSel ? 'color-mix(in srgb, var(--brand-1) 12%, transparent)' : 'transparent',
                    border: esSel ? '1px solid var(--brand-1)' : '1px solid transparent',
                  }}>
                    <span className="text-sm grid place-items-center rounded-full" style={{ width: 24, height: 24, background: esHoy ? 'var(--brand-1)' : 'transparent', color: esHoy ? 'white' : 'var(--text)', fontWeight: esHoy ? 700 : 500 }}>{dia}</span>
                    <span className="flex gap-1 mt-1">
                      {nOt > 0 && <span className="inline-block rounded-full" style={{ width: 6, height: 6, background: 'var(--brand-1)' }} />}
                      {nTar > 0 && <span className="inline-block rounded-full" style={{ width: 6, height: 6, background: 'var(--teal)' }} />}
                    </span>
                  </button>
                )
              })}
            </div>
            <div className="flex gap-4 mt-3 text-[11px]" style={{ color: 'var(--text-subtle)' }}>
              <span className="flex items-center gap-1"><span className="inline-block rounded-full" style={{ width: 6, height: 6, background: 'var(--brand-1)' }} /> Órdenes</span>
              <span className="flex items-center gap-1"><span className="inline-block rounded-full" style={{ width: 6, height: 6, background: 'var(--teal)' }} /> Tareas</span>
            </div>
          </section>

          {/* Agenda del día */}
          <section className="card p-4">
            <h2 className="font-semibold mb-3" style={{ color: 'var(--text)' }}>{sel === k ? 'Hoy' : 'Agenda'} · {sel.slice(8)}/{sel.slice(5, 7)}</h2>
            {otsDia.length === 0 && tareasDia.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--text-subtle)' }}>Nada programado este día.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {otsDia.map((o) => (
                  <Link key={o.id} href={`/ordenes/${o.id}`} className="rounded-xl px-3 py-2" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{o.clientes?.nombre || 'Sin cliente'}</span>
                      <ChipEstadoOt estado={o.estado} />
                    </div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{labelTipoOt(o.tipo)}{o.perfiles?.nombre ? ` · ${o.perfiles.nombre}` : ''}</div>
                  </Link>
                ))}
                {tareasDia.map((t) => <FilaTarea key={t.id} t={t} nombreTec={nombreTec} onToggle={toggleTarea} onAbrir={() => setEditTarea(t)} />)}
              </div>
            )}
          </section>
        </div>
      )}

      {/* Tareas pendientes */}
      {!cargando && (
        <section className="card p-5 mt-4">
          <h2 className="font-semibold mb-3" style={{ color: 'var(--text)' }}>Tareas pendientes <span className="text-xs font-normal" style={{ color: 'var(--text-subtle)' }}>({pendientes.length})</span></h2>
          {pendientes.length === 0 ? <p className="text-sm" style={{ color: 'var(--text-subtle)' }}>No hay tareas pendientes. 👌</p> : (
            <div className="flex flex-col gap-2">
              {pendientes.map((t) => <FilaTarea key={t.id} t={t} nombreTec={nombreTec} vencida={!!(t.fecha && t.fecha < k)} onToggle={toggleTarea} onAbrir={() => setEditTarea(t)} />)}
            </div>
          )}
        </section>
      )}

      {editTarea && <TareaForm tarea={editTarea === 'nueva' ? null : editTarea} fechaDefecto={sel} tecnicos={tecnicos} onCerrar={() => setEditTarea(null)} onGuardado={() => { setEditTarea(null); cargar() }} />}
    </div>
  )
}

function Aviso({ n, label, href, color }: { n: number; label: string; href?: string; color: string }) {
  const inner = (
    <div className="card card-hover p-3 flex items-center justify-between gap-2 h-full">
      <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span className="text-2xl font-bold shrink-0" style={{ color: n > 0 ? color : 'var(--text-subtle)' }}>{n}</span>
    </div>
  )
  return href ? <Link href={href}>{inner}</Link> : inner
}

function FilaTarea({ t, nombreTec, vencida, onToggle, onAbrir }: { t: Tarea; nombreTec: (id: string | null) => string; vencida?: boolean; onToggle: (t: Tarea) => void; onAbrir: () => void }) {
  const pr = PRIORIDADES_TAREA[t.prioridad || '2']
  return (
    <div className="flex items-center gap-3 rounded-xl px-3 py-2" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
      <button onClick={() => onToggle(t)} className="grid place-items-center rounded-md shrink-0" style={{ width: 20, height: 20, border: `2px solid ${t.hecha ? 'var(--green)' : 'var(--border-strong)'}`, background: t.hecha ? 'var(--green)' : 'transparent' }}>
        {t.hecha && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><path d="M20 6 9 17l-5-5" /></svg>}
      </button>
      <button onClick={onAbrir} className="min-w-0 flex-1 text-left">
        <div className="text-sm font-medium truncate" style={{ color: 'var(--text)', textDecoration: t.hecha ? 'line-through' : 'none' }}>{t.titulo}</div>
        <div className="text-xs flex items-center gap-2 flex-wrap" style={{ color: 'var(--text-muted)' }}>
          <span style={{ color: pr.color, fontWeight: 600 }}>{pr.label}</span>
          {t.fecha && <span style={{ color: vencida ? 'var(--red)' : 'var(--text-muted)' }}>· {t.fecha.slice(8)}/{t.fecha.slice(5, 7)}{vencida ? ' (vencida)' : ''}</span>}
          {t.asignado_a && nombreTec(t.asignado_a) && <span>· {nombreTec(t.asignado_a)}</span>}
        </div>
      </button>
    </div>
  )
}

function TareaForm({ tarea, fechaDefecto, tecnicos, onCerrar, onGuardado }: { tarea: Tarea | null; fechaDefecto: string; tecnicos: { id: string; nombre: string | null }[]; onCerrar: () => void; onGuardado: () => void }) {
  const [d, setD] = useState({
    titulo: tarea?.titulo ?? '', descripcion: tarea?.descripcion ?? '', fecha: tarea?.fecha ?? fechaDefecto,
    prioridad: tarea?.prioridad ?? '2', asignado_a: tarea?.asignado_a ?? '', cliente_id: tarea?.cliente_id ?? '', orden_id: tarea?.orden_id ?? '',
  })
  const [clienteNombre, setClienteNombre] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [sug, setSug] = useState<{ id: string; nombre: string }[]>([])
  const [abierto, setAbierto] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const set = (k: string, v: any) => setD((p) => ({ ...p, [k]: v }))

  useEffect(() => {
    if (tarea?.cliente_id) (supabase as any).from('clientes').select('nombre').eq('id', tarea.cliente_id).maybeSingle().then(({ data }: any) => { if (data) setClienteNombre(data.nombre) })
  }, [tarea])
  useEffect(() => {
    const t = busqueda.trim()
    if (t.length < 2 || d.cliente_id) { setSug([]); return }
    let act = true
    const id = setTimeout(async () => { const { data } = await (supabase as any).from('clientes').select('id, nombre').ilike('nombre', `%${t}%`).limit(8); if (act) setSug(data || []) }, 220)
    return () => { act = false; clearTimeout(id) }
  }, [busqueda, d.cliente_id])

  async function guardar() {
    if (!d.titulo.trim()) return
    setGuardando(true)
    const { data } = await supabase.auth.getUser()
    const payload: Partial<Tarea> = {
      titulo: d.titulo, descripcion: d.descripcion || null, fecha: d.fecha || null, prioridad: d.prioridad,
      asignado_a: d.asignado_a || null, cliente_id: d.cliente_id || null, orden_id: d.orden_id || null,
    }
    try {
      if (tarea) await actualizarTarea(tarea.id, payload)
      else await crearTarea({ ...payload, creado_por: data.user?.id ?? null, hecha: false } as any)
      onGuardado()
    } catch { setGuardando(false) }
  }

  const L = ({ children }: { children: React.ReactNode }) => <span className="text-xs font-medium" style={{ color: 'var(--text-subtle)' }}>{children}</span>
  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center md:p-4" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={onCerrar}>
      <div className="w-full md:max-w-md rounded-t-2xl md:rounded-2xl p-5" style={{ background: 'var(--bg-card)', maxHeight: '92vh', overflowY: 'auto', boxShadow: 'var(--shadow-lg)' }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold" style={{ color: 'var(--text)' }}>{tarea ? 'Editar tarea' : 'Nueva tarea'}</h3>
          {tarea && <button onClick={async () => { if (confirm('¿Eliminar tarea?')) { await borrarTarea(tarea.id); onGuardado() } }} className="text-sm" style={{ color: 'var(--red)' }}>Eliminar</button>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="col-span-2"><L>Título</L><input value={d.titulo} onChange={(e) => set('titulo', e.target.value)} style={inp} /></label>
          <label className="col-span-2"><L>Descripción</L><textarea value={d.descripcion} onChange={(e) => set('descripcion', e.target.value)} rows={2} style={{ ...inp, resize: 'vertical' }} /></label>
          <label><L>Fecha</L><input type="date" value={d.fecha} onChange={(e) => set('fecha', e.target.value)} style={inp} /></label>
          <label><L>Prioridad</L><select value={d.prioridad} onChange={(e) => set('prioridad', e.target.value)} style={inp}>{Object.entries(PRIORIDADES_TAREA).map(([v, o]) => <option key={v} value={v}>{o.label}</option>)}</select></label>
          <label className="col-span-2"><L>Asignar a</L><select value={d.asignado_a} onChange={(e) => set('asignado_a', e.target.value)} style={inp}><option value="">Sin asignar</option>{tecnicos.map((t) => <option key={t.id} value={t.id}>{t.nombre || t.id.slice(0, 6)}</option>)}</select></label>
          <div className="col-span-2 relative">
            <L>Cliente (opcional)</L>
            <input value={d.cliente_id ? clienteNombre : busqueda} onChange={(e) => { set('cliente_id', ''); setClienteNombre(''); setBusqueda(e.target.value); setAbierto(true) }} onFocus={() => setAbierto(true)} onBlur={() => setTimeout(() => setAbierto(false), 150)} placeholder="Buscar cliente…" style={inp} />
            {abierto && sug.length > 0 && !d.cliente_id && (
              <div className="absolute z-20 mt-1 w-full rounded-xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)' }}>
                {sug.map((c) => <button key={c.id} type="button" onMouseDown={(e) => { e.preventDefault(); set('cliente_id', c.id); setClienteNombre(c.nombre); setAbierto(false) }} className="block w-full text-left px-3 py-2 text-sm hover:bg-[var(--bg-subtle)]" style={{ color: 'var(--text)' }}>{c.nombre}</button>)}
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-3 justify-end mt-5">
          <button onClick={onCerrar} className="rounded-xl px-4 py-2 font-semibold" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}>Cancelar</button>
          <button onClick={guardar} disabled={guardando} className="marca-gradiente rounded-xl px-4 py-2 font-semibold text-white" style={{ opacity: guardando ? 0.7 : 1 }}>{guardando ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </div>
    </div>
  )
}
