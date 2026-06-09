'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { listarAlbaranes, crearAlbaran, actualizarAlbaran, obtenerCliente, datosDesdeCliente, type AlbaranConRefs } from '@/lib/db/albaranes'
import { ESTADOS_ALBARAN, ESTADOS_ALBARAN_LISTA, type Albaran } from '@/lib/albaranes'
import { fechaCorta } from '@/lib/dominio'
import { EstadoVacio, SkeletonLista } from '@/app/components/ui'

const inp: React.CSSProperties = { background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 10, padding: '9px 11px', fontSize: '0.9rem', width: '100%', marginTop: 3 }

export function ChipEstadoAlbaran({ estado }: { estado: string | null }) {
  const e = ESTADOS_ALBARAN[estado || ''] || { label: estado || '—', color: 'var(--text-muted)' }
  return <span className="inline-flex items-center gap-1.5 rounded-full text-xs font-semibold px-2.5 py-1 whitespace-nowrap" style={{ background: `color-mix(in srgb, ${e.color} 14%, transparent)`, color: e.color }}><span className="inline-block rounded-full" style={{ width: 6, height: 6, background: e.color }} />{e.label}</span>
}

export default function AlbaranesPage() {
  const [albaranes, setAlbaranes] = useState<AlbaranConRefs[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')
  const [fEstado, setFEstado] = useState('')
  const [nuevo, setNuevo] = useState(false)

  async function cargar() {
    try { setAlbaranes(await listarAlbaranes()) }
    catch (e: any) { setError(e.message || 'Error') }
    finally { setCargando(false) }
  }
  useEffect(() => { cargar() }, [])

  const lista = useMemo(() => {
    const t = q.trim().toLowerCase()
    return albaranes.filter((a) => {
      if (fEstado && a.estado !== fEstado) return false
      if (t && !`${a.numero || ''} ${a.clientes?.nombre || ''} ${a.razon_social || ''}`.toLowerCase().includes(t)) return false
      return true
    })
  }, [albaranes, q, fEstado])

  return (
    <div>
      <header className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div>
          <h1 className="titulo-hero" style={{ color: 'var(--text)' }}>Albaranes</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>{cargando ? 'Cargando…' : `${lista.length} de ${albaranes.length}`}</p>
        </div>
        <button onClick={() => setNuevo(true)} className="marca-gradiente inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-white font-semibold" style={{ boxShadow: 'var(--shadow-sm)' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          Nuevo albarán
        </button>
      </header>

      <div className="flex flex-wrap gap-2 items-center mb-4">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nº o cliente…" className="flex-1 min-w-[180px] rounded-lg px-3 py-2 text-sm" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text)' }} />
        <select value={fEstado} onChange={(e) => setFEstado(e.target.value)} className="rounded-lg px-2.5 py-2 text-sm" style={{ background: 'var(--bg-card)', border: `1px solid ${fEstado ? 'var(--brand-1)' : 'var(--border)'}`, color: 'var(--text)' }}>
          <option value="">Estado</option>
          {ESTADOS_ALBARAN_LISTA.map((e) => <option key={e} value={e}>{ESTADOS_ALBARAN[e].label}</option>)}
        </select>
      </div>

      {error && <div className="card p-4 mb-4 text-sm" style={{ color: 'var(--red)' }}>{error}</div>}

      {cargando ? <SkeletonLista /> : lista.length === 0 ? (
        <EstadoVacio titulo="Sin albaranes" texto={albaranes.length ? 'Prueba con otros filtros.' : 'Crea el primero.'} />
      ) : (
        <div className="flex flex-col gap-2">
          {lista.map((a) => (
            <Link key={a.id} href={`/albaranes/${a.id}`} className="card card-hover p-4 flex items-center gap-3 flex-wrap">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold truncate" style={{ color: 'var(--text)' }}>{a.razon_social || a.clientes?.nombre || 'Sin cliente'}</span>
                  <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>{a.numero}</span>
                </div>
                <div className="text-xs mt-0.5 flex items-center gap-2 flex-wrap" style={{ color: 'var(--text-muted)' }}>
                  <span>{fechaCorta(a.fecha)}</span>
                  {a.ordenes?.codigo && <><span>·</span><span>OT {a.ordenes.codigo}</span></>}
                  {a.firmado && <><span>·</span><span style={{ color: 'var(--teal)' }}>firmado</span></>}
                </div>
              </div>
              <ChipEstadoAlbaran estado={a.estado} />
            </Link>
          ))}
        </div>
      )}

      {nuevo && <AlbaranForm onCerrar={() => setNuevo(false)} onGuardado={() => { setNuevo(false); cargar() }} />}
    </div>
  )
}

const hoyISO = () => new Date().toISOString().slice(0, 10)
const L = ({ children }: { children: React.ReactNode }) => <span className="text-xs font-medium" style={{ color: 'var(--text-subtle)' }}>{children}</span>

export function AlbaranForm({ albaran, onCerrar, onGuardado }: { albaran?: Albaran | null; onCerrar: () => void; onGuardado: () => void }) {
  const [d, setD] = useState<any>({
    cliente_id: albaran?.cliente_id ?? '', orden_id: albaran?.orden_id ?? '',
    razon_social: albaran?.razon_social ?? '', cif: albaran?.cif ?? '', domicilio: albaran?.domicilio ?? '',
    localidad: albaran?.localidad ?? '', provincia: albaran?.provincia ?? '', telefono: albaran?.telefono ?? '', email: albaran?.email ?? '',
    fecha: albaran?.fecha ? albaran.fecha.slice(0, 10) : hoyISO(), estado: albaran?.estado ?? 'pendiente',
    descripcion: albaran?.descripcion ?? '', observaciones: albaran?.observaciones ?? '', responsable: albaran?.responsable ?? '', instalacion: albaran?.instalacion ?? '',
  })
  const [busqueda, setBusqueda] = useState(albaran?.razon_social ?? '')
  const [sug, setSug] = useState<{ id: string; nombre: string }[]>([])
  const [abierto, setAbierto] = useState(false)
  const [ordenes, setOrdenes] = useState<{ id: string; codigo: string | null }[]>([])
  const [guardando, setGuardando] = useState(false)
  const set = (k: string, v: any) => setD((p: any) => ({ ...p, [k]: v }))

  useEffect(() => { (supabase as any).from('ordenes').select('id, codigo').order('created_at', { ascending: false }).limit(200).then(({ data }: any) => setOrdenes(data || [])) }, [])
  useEffect(() => {
    const t = busqueda.trim()
    if (t.length < 2 || d.cliente_id) { setSug([]); return }
    let activo = true
    const tid = setTimeout(async () => {
      const { data } = await (supabase as any).from('clientes').select('id, nombre').ilike('nombre', `%${t}%`).limit(8)
      if (activo) setSug((data || []) as { id: string; nombre: string }[])
    }, 220)
    return () => { activo = false; clearTimeout(tid) }
  }, [busqueda, d.cliente_id])

  async function elegirCliente(id: string, nombre: string) {
    setBusqueda(nombre); setAbierto(false)
    const cli = await obtenerCliente(id)
    const datos = datosDesdeCliente(cli)
    setD((p: any) => ({ ...p, ...datos, provincia: p.provincia }))
  }

  async function guardar() {
    setGuardando(true)
    const payload: Partial<Albaran> = {
      cliente_id: d.cliente_id || null, orden_id: d.orden_id || null,
      razon_social: d.razon_social || null, cif: d.cif || null, domicilio: d.domicilio || null,
      localidad: d.localidad || null, provincia: d.provincia || null, telefono: d.telefono || null, email: d.email || null,
      fecha: d.fecha || null, estado: d.estado, descripcion: d.descripcion || null, observaciones: d.observaciones || null,
      responsable: d.responsable || null, instalacion: d.instalacion || null,
    }
    try {
      if (albaran) await actualizarAlbaran(albaran.id, payload)
      else await crearAlbaran(payload)
      onGuardado()
    } catch { setGuardando(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center md:p-4" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={onCerrar}>
      <div className="w-full md:max-w-lg rounded-t-2xl md:rounded-2xl p-5" style={{ background: 'var(--bg-card)', maxHeight: '92vh', overflowY: 'auto', boxShadow: 'var(--shadow-lg)' }} onClick={(e) => e.stopPropagation()}>
        <h3 className="font-semibold mb-4" style={{ color: 'var(--text)' }}>{albaran ? `Editar ${albaran.numero || 'albarán'}` : 'Nuevo albarán'}</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 relative">
            <L>Cliente</L>
            <input value={busqueda} onChange={(e) => { set('cliente_id', ''); setBusqueda(e.target.value); setAbierto(true) }} onFocus={() => setAbierto(true)} onBlur={() => setTimeout(() => setAbierto(false), 150)} placeholder="Buscar cliente…" style={inp} />
            {abierto && sug.length > 0 && (
              <div className="absolute z-20 mt-1 w-full rounded-xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)' }}>
                {sug.map((c) => <button key={c.id} type="button" onMouseDown={(e) => { e.preventDefault(); elegirCliente(c.id, c.nombre) }} className="block w-full text-left px-3 py-2 text-sm hover:bg-[var(--bg-subtle)]" style={{ color: 'var(--text)' }}>{c.nombre}</button>)}
              </div>
            )}
          </div>
          <label className="col-span-2"><L>Razón social</L><input value={d.razon_social} onChange={(e) => set('razon_social', e.target.value)} style={inp} /></label>
          <label><L>CIF</L><input value={d.cif} onChange={(e) => set('cif', e.target.value)} style={inp} /></label>
          <label><L>Teléfono</L><input value={d.telefono} onChange={(e) => set('telefono', e.target.value)} style={inp} /></label>
          <label className="col-span-2"><L>Domicilio</L><input value={d.domicilio} onChange={(e) => set('domicilio', e.target.value)} style={inp} /></label>
          <label><L>Localidad</L><input value={d.localidad} onChange={(e) => set('localidad', e.target.value)} style={inp} /></label>
          <label><L>Provincia</L><input value={d.provincia} onChange={(e) => set('provincia', e.target.value)} style={inp} /></label>
          <label className="col-span-2"><L>Email</L><input value={d.email} onChange={(e) => set('email', e.target.value)} style={inp} /></label>
          <label><L>Fecha</L><input type="date" value={d.fecha} onChange={(e) => set('fecha', e.target.value)} style={inp} /></label>
          <label><L>Estado</L><select value={d.estado} onChange={(e) => set('estado', e.target.value)} style={inp}>{ESTADOS_ALBARAN_LISTA.map((e) => <option key={e} value={e}>{ESTADOS_ALBARAN[e].label}</option>)}</select></label>
          <label className="col-span-2"><L>OT asociada</L><select value={d.orden_id} onChange={(e) => set('orden_id', e.target.value)} style={inp}><option value="">Sin OT</option>{ordenes.map((o) => <option key={o.id} value={o.id}>{o.codigo || o.id.slice(0, 8)}</option>)}</select></label>
          <label className="col-span-2"><L>Instalación</L><input value={d.instalacion} onChange={(e) => set('instalacion', e.target.value)} style={inp} /></label>
          <label className="col-span-2"><L>Descripción</L><textarea value={d.descripcion} onChange={(e) => set('descripcion', e.target.value)} rows={2} style={{ ...inp, resize: 'vertical' }} /></label>
          <label className="col-span-2"><L>Observaciones</L><input value={d.observaciones} onChange={(e) => set('observaciones', e.target.value)} style={inp} /></label>
          <label className="col-span-2"><L>Responsable</L><input value={d.responsable} onChange={(e) => set('responsable', e.target.value)} style={inp} /></label>
        </div>
        <div className="flex gap-3 justify-end mt-5">
          <button onClick={onCerrar} className="rounded-xl px-4 py-2 font-semibold" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}>Cancelar</button>
          <button onClick={guardar} disabled={guardando} className="marca-gradiente rounded-xl px-4 py-2 font-semibold text-white" style={{ opacity: guardando ? 0.7 : 1 }}>{guardando ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </div>
    </div>
  )
}
