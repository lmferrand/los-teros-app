'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import {
  obtenerOrden, borrarOrden, actualizarOrden, listarFotos, subirFotoOrden, borrarFotoOrden,
  listarIncidencias, crearIncidencia, borrarIncidencia, listarMovimientosOrden,
  type OrdenConRefs, type MovimientoOrden,
} from '@/lib/db/ordenes'
import { listarTrabajadores, listarMateriales, listarEquipos, crearMovimiento, fijarStock, cambiarEstadoEquipo } from '@/lib/db/inventario'
import type { FotoOrden, Incidencia } from '@/lib/ordenes'
import { ESTADOS_OT, ESTADOS_OT_LISTA, PRIORIDADES, labelTipoOt } from '@/lib/ordenes'
import type { Material, Equipo } from '@/lib/inventario'
import { labelUnidad } from '@/lib/inventario'
import { fechaCorta } from '@/lib/dominio'
import { comprimirImagen } from '@/lib/imagen'
import { Campo, SkeletonLista } from '@/app/components/ui'
import { OrdenForm, ChipEstadoOt } from '../page'

const inp: React.CSSProperties = { background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 10, padding: '8px 10px', fontSize: '0.9rem', width: '100%', marginTop: 3 }

export default function FichaOrden() {
  const id = useParams<{ id: string }>().id
  const router = useRouter()
  const [orden, setOrden] = useState<OrdenConRefs | null>(null)
  const [fotos, setFotos] = useState<FotoOrden[]>([])
  const [incidencias, setIncidencias] = useState<Incidencia[]>([])
  const [movs, setMovs] = useState<MovimientoOrden[]>([])
  const [tecnicos, setTecnicos] = useState<{ id: string; nombre: string | null }[]>([])
  const [cargando, setCargando] = useState(true)
  const [editar, setEditar] = useState(false)
  const [aviso, setAviso] = useState('')

  async function cargar() {
    const [o, f, inc, m, t] = await Promise.all([
      obtenerOrden(id), listarFotos(id), listarIncidencias(id), listarMovimientosOrden(id), listarTrabajadores(),
    ])
    setOrden(o); setFotos(f); setIncidencias(inc); setMovs(m); setTecnicos(t); setCargando(false)
  }
  useEffect(() => { cargar() }, [id])

  async function cambiarEstado(nuevo: string) {
    setAviso('')
    if (nuevo === 'completada') {
      const tieneProceso = fotos.some((f) => f.tipo === 'proceso')
      const tieneCierre = fotos.some((f) => f.tipo === 'cierre')
      if (!tieneProceso || !tieneCierre) {
        setAviso('Para completar la OT necesitas al menos una foto de proceso y una de cierre.')
        return
      }
    }
    await actualizarOrden(id, { estado: nuevo, fecha_cierre: nuevo === 'completada' ? new Date().toISOString() : null })
    cargar()
  }

  async function eliminar() {
    if (!confirm('¿Eliminar esta OT? Se borran sus fotos e incidencias (los movimientos de stock se conservan).')) return
    await borrarOrden(id)
    router.push('/ordenes')
  }

  if (cargando) return <SkeletonLista filas={4} />
  if (!orden) return <div className="card p-6 text-sm" style={{ color: 'var(--text-muted)' }}>No se encontró la OT.</div>

  const pr = PRIORIDADES[orden.prioridad || '2']

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <Link href="/ordenes" className="text-sm inline-flex items-center gap-1 mb-2" style={{ color: 'var(--text-subtle)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m15 18-6-6 6-6" /></svg>
            Órdenes
          </Link>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="titulo-hero" style={{ color: 'var(--text)' }}>{orden.clientes?.nombre || 'Sin cliente'}</h1>
            <ChipEstadoOt estado={orden.estado} />
          </div>
          <div className="text-sm mt-1 flex items-center gap-2 flex-wrap" style={{ color: 'var(--text-muted)' }}>
            <span>{orden.codigo}</span><span>·</span><span>{labelTipoOt(orden.tipo)}</span><span>·</span>
            <span style={{ color: pr?.color, fontWeight: 600 }}>Prioridad {pr?.label}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setEditar(true)} className="rounded-xl px-4 py-2 font-semibold text-sm" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text)' }}>Editar</button>
          <button onClick={eliminar} className="rounded-xl px-3 py-2 font-semibold text-sm" style={{ background: 'color-mix(in srgb, var(--red) 10%, transparent)', color: 'var(--red)' }}>Eliminar</button>
        </div>
      </header>

      {/* Estado */}
      <section className="card p-5">
        <h2 className="font-semibold mb-3" style={{ color: 'var(--text)' }}>Estado</h2>
        <div className="flex flex-wrap gap-2">
          {ESTADOS_OT_LISTA.map((e) => {
            const on = orden.estado === e
            const c = ESTADOS_OT[e].color
            return <button key={e} onClick={() => cambiarEstado(e)} className="text-sm font-semibold rounded-xl px-3 py-2" style={{ background: on ? `color-mix(in srgb, ${c} 16%, transparent)` : 'var(--bg)', color: on ? c : 'var(--text-muted)', border: `1px solid ${on ? c : 'var(--border)'}` }}>{ESTADOS_OT[e].label}</button>
          })}
        </div>
        {aviso && <div className="mt-3 text-sm rounded-lg px-3 py-2" style={{ background: 'color-mix(in srgb, var(--amber) 12%, transparent)', color: 'var(--amber)' }}>{aviso}</div>}
      </section>

      {/* Datos */}
      <section className="card p-5">
        <h2 className="font-semibold mb-4" style={{ color: 'var(--text)' }}>Datos</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Campo label="Fecha programada">{orden.fecha_programada ? `${fechaCorta(orden.fecha_programada)}${orden.hora_fija ? ' (hora fija)' : ''}` : '—'}</Campo>
          <Campo label="Duración">{orden.duracion_horas != null ? `${orden.duracion_horas} h` : '—'}</Campo>
          <Campo label="Técnico">{orden.perfiles?.nombre}</Campo>
          <Campo label="Fecha cierre">{fechaCorta(orden.fecha_cierre)}</Campo>
          <Campo label="Descripción">{orden.descripcion}</Campo>
          <Campo label="Materiales previstos">{orden.materiales_previstos}</Campo>
        </div>
        {orden.observaciones && <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--border)' }}><Campo label="Observaciones">{orden.observaciones}</Campo></div>}
      </section>

      {/* Fotos */}
      <FotosSeccion ordenId={id} fotos={fotos} onCambio={cargar} />

      {/* Consumos */}
      <ConsumosSeccion ordenId={id} movs={movs} onCambio={cargar} />

      {/* Incidencias */}
      <IncidenciasSeccion ordenId={id} incidencias={incidencias} tecnicos={tecnicos} estado={orden.estado} onCambio={cargar} />

      {editar && <OrdenForm orden={orden} tecnicos={tecnicos} onCerrar={() => setEditar(false)} onGuardado={() => { setEditar(false); cargar() }} />}
    </div>
  )
}

/* ----------------- Fotos ----------------- */
function FotosSeccion({ ordenId, fotos, onCambio }: { ordenId: string; fotos: FotoOrden[]; onCambio: () => void }) {
  const [subiendo, setSubiendo] = useState('')
  async function subir(file: File, tipo: string) {
    setSubiendo(tipo)
    try {
      const blob = await comprimirImagen(file)
      const { data } = await supabase.auth.getUser()
      await subirFotoOrden(ordenId, blob, tipo, data.user?.id ?? null)
      onCambio()
    } finally { setSubiendo('') }
  }
  const grupos = [{ tipo: 'proceso', label: 'Proceso' }, { tipo: 'cierre', label: 'Cierre' }]
  return (
    <section className="card p-5">
      <h2 className="font-semibold mb-3" style={{ color: 'var(--text)' }}>Fotos</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {grupos.map((g) => {
          const fs = fotos.filter((f) => f.tipo === g.tipo)
          return (
            <div key={g.tipo}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{g.label} ({fs.length})</span>
                <label className="text-xs font-semibold rounded-lg px-2.5 py-1.5 cursor-pointer" style={{ background: 'var(--bg-subtle)', color: 'var(--brand-1)' }}>
                  {subiendo === g.tipo ? 'Subiendo…' : '+ Añadir'}
                  <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) subir(f, g.tipo) }} />
                </label>
              </div>
              <div className="flex flex-wrap gap-2">
                {fs.length === 0 && <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>Sin fotos.</span>}
                {fs.map((f) => (
                  <div key={f.id} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <a href={f.url} target="_blank" rel="noreferrer"><img src={f.url} alt="foto" style={{ width: 84, height: 84, objectFit: 'cover', borderRadius: 10, border: '1px solid var(--border)' }} /></a>
                    <button onClick={async () => { await borrarFotoOrden(f.id); onCambio() }} className="absolute -top-1.5 -right-1.5 grid place-items-center rounded-full text-white" style={{ width: 20, height: 20, background: 'var(--red)', fontSize: 12 }}>×</button>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

/* ----------------- Consumos ----------------- */
function ConsumosSeccion({ ordenId, movs, onCambio }: { ordenId: string; movs: MovimientoOrden[]; onCambio: () => void }) {
  const [abrir, setAbrir] = useState(false)
  return (
    <section className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold" style={{ color: 'var(--text)' }}>Materiales y equipos usados</h2>
        <button onClick={() => setAbrir(true)} className="text-sm font-semibold rounded-lg px-3 py-1.5" style={{ background: 'var(--bg-subtle)', color: 'var(--brand-1)' }}>+ Registrar</button>
      </div>
      {movs.length === 0 ? <p className="text-sm" style={{ color: 'var(--text-subtle)' }}>Nada registrado en esta OT.</p> : (
        <div className="flex flex-col gap-2">
          {movs.map((m) => (
            <div key={m.id} className="flex items-center gap-3 rounded-xl px-3 py-2" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{m.materiales?.nombre || (m.equipos ? `Equipo ${m.equipos.codigo}` : '—')}</div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{m.tipo}{m.cantidad != null ? ` · ${m.cantidad} ${labelUnidad(m.materiales?.unidad)}` : ''} · {fechaCorta(m.fecha)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
      {abrir && <ConsumoForm ordenId={ordenId} onCerrar={() => setAbrir(false)} onHecho={() => { setAbrir(false); onCambio() }} />}
    </section>
  )
}

function ConsumoForm({ ordenId, onCerrar, onHecho }: { ordenId: string; onCerrar: () => void; onHecho: () => void }) {
  const [materiales, setMateriales] = useState<Material[]>([])
  const [equipos, setEquipos] = useState<Equipo[]>([])
  const [modo, setModo] = useState<'material' | 'equipo'>('material')
  const [materialId, setMaterialId] = useState('')
  const [equipoId, setEquipoId] = useState('')
  const [cantidad, setCantidad] = useState('1')
  const [guardando, setGuardando] = useState(false)
  useEffect(() => { listarMateriales().then(setMateriales); listarEquipos().then(setEquipos) }, [])

  async function guardar() {
    const cant = parseFloat(cantidad) || 0
    if (modo === 'material' && !materialId) return
    if (modo === 'equipo' && !equipoId) return
    setGuardando(true)
    try {
      await crearMovimiento({
        tipo: modo === 'equipo' ? 'salida' : 'consumo',
        material_id: modo === 'material' ? materialId : null, equipo_id: modo === 'equipo' ? equipoId : null,
        orden_id: ordenId, cantidad: cant, observaciones: 'Consumo en OT', fecha: new Date().toISOString(),
      })
      if (modo === 'material') {
        const m = materiales.find((x) => x.id === materialId)
        await fijarStock(materialId, Math.max(0, (m?.stock ?? 0) - cant))
      } else {
        await cambiarEstadoEquipo(equipoId, 'en_cliente')
      }
      onHecho()
    } catch { setGuardando(false) }
  }
  const L = ({ children }: { children: React.ReactNode }) => <span className="text-xs font-medium" style={{ color: 'var(--text-subtle)' }}>{children}</span>
  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center md:p-4" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={onCerrar}>
      <div className="w-full md:max-w-md rounded-t-2xl md:rounded-2xl p-5" style={{ background: 'var(--bg-card)', maxHeight: '92vh', overflowY: 'auto', boxShadow: 'var(--shadow-lg)' }} onClick={(e) => e.stopPropagation()}>
        <h3 className="font-semibold mb-4" style={{ color: 'var(--text)' }}>Registrar consumo</h3>
        <div className="inline-flex rounded-xl p-1 mb-3" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)' }}>
          {(['material', 'equipo'] as const).map((mo) => <button key={mo} onClick={() => setModo(mo)} className="px-3 py-1.5 rounded-lg text-sm font-semibold capitalize" style={{ background: modo === mo ? 'var(--bg-card)' : 'transparent', color: modo === mo ? 'var(--brand-1)' : 'var(--text-muted)' }}>{mo}</button>)}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {modo === 'material' ? (
            <>
              <label className="col-span-2"><L>Material</L><select value={materialId} onChange={(e) => setMaterialId(e.target.value)} style={inp}><option value="">Selecciona…</option>{materiales.map((m) => <option key={m.id} value={m.id}>{m.nombre} ({m.stock ?? 0} {labelUnidad(m.unidad)})</option>)}</select></label>
              <label><L>Cantidad</L><input type="number" step="any" value={cantidad} onChange={(e) => setCantidad(e.target.value)} style={inp} /></label>
            </>
          ) : (
            <label className="col-span-2"><L>Equipo (salida)</L><select value={equipoId} onChange={(e) => setEquipoId(e.target.value)} style={inp}><option value="">Selecciona…</option>{equipos.map((eq) => <option key={eq.id} value={eq.id}>{eq.codigo}</option>)}</select></label>
          )}
        </div>
        <div className="flex gap-3 justify-end mt-5">
          <button onClick={onCerrar} className="rounded-xl px-4 py-2 font-semibold" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}>Cancelar</button>
          <button onClick={guardar} disabled={guardando} className="marca-gradiente rounded-xl px-4 py-2 font-semibold text-white" style={{ opacity: guardando ? 0.7 : 1 }}>{guardando ? 'Guardando…' : 'Registrar'}</button>
        </div>
      </div>
    </div>
  )
}

/* ----------------- Incidencias ----------------- */
function IncidenciasSeccion({ ordenId, incidencias, tecnicos, estado, onCambio }: { ordenId: string; incidencias: Incidencia[]; tecnicos: { id: string; nombre: string | null }[]; estado: string | null; onCambio: () => void }) {
  const [abrir, setAbrir] = useState(false)
  const nombreTec = (id: string | null) => tecnicos.find((t) => t.id === id)?.nombre || ''
  return (
    <section className="card p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold" style={{ color: 'var(--text)' }}>Incidencias</h2>
        <button onClick={() => setAbrir(true)} className="text-sm font-semibold rounded-lg px-3 py-1.5" style={{ background: 'var(--bg-subtle)', color: 'var(--brand-1)' }}>+ Nueva</button>
      </div>
      {incidencias.length === 0 ? <p className="text-sm" style={{ color: 'var(--text-subtle)' }}>Sin incidencias.</p> : (
        <div className="flex flex-col gap-2">
          {incidencias.map((inc) => (
            <div key={inc.id} className="rounded-xl px-3 py-2.5" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  {inc.descripcion && <div className="text-sm" style={{ color: 'var(--text)' }}>{inc.descripcion}</div>}
                  <div className="text-xs" style={{ color: 'var(--text-subtle)' }}>{fechaCorta(inc.created_at)}{nombreTec(inc.tecnico_id) ? ` · ${nombreTec(inc.tecnico_id)}` : ''}</div>
                  {inc.audio_url && <audio controls src={inc.audio_url} className="mt-2" style={{ height: 34, maxWidth: '100%' }} />}
                </div>
                {inc.foto_url && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <a href={inc.foto_url} target="_blank" rel="noreferrer"><img src={inc.foto_url} alt="incidencia" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 10 }} /></a>
                )}
                <button onClick={async () => { if (confirm('¿Eliminar incidencia?')) { await borrarIncidencia(inc.id); onCambio() } }} className="text-xs shrink-0" style={{ color: 'var(--red)' }}>×</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {abrir && <IncidenciaForm ordenId={ordenId} tecnicos={tecnicos} estado={estado} onCerrar={() => setAbrir(false)} onHecho={() => { setAbrir(false); onCambio() }} />}
    </section>
  )
}

function IncidenciaForm({ ordenId, tecnicos, estado, onCerrar, onHecho }: { ordenId: string; tecnicos: { id: string; nombre: string | null }[]; estado: string | null; onCerrar: () => void; onHecho: () => void }) {
  const [descripcion, setDescripcion] = useState('')
  const [tecnicoId, setTecnicoId] = useState('')
  const [fotoFile, setFotoFile] = useState<File | null>(null)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioUrl, setAudioUrl] = useState('')
  const [grabando, setGrabando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const recRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  async function toggleGrabar() {
    if (grabando) {
      recRef.current?.stop()
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const rec = new MediaRecorder(stream)
      chunksRef.current = []
      rec.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data) }
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        setAudioBlob(blob); setAudioUrl(URL.createObjectURL(blob))
        stream.getTracks().forEach((t) => t.stop())
        setGrabando(false)
      }
      recRef.current = rec
      rec.start()
      setGrabando(true)
    } catch {
      alert('No se pudo acceder al micrófono.')
    }
  }

  async function guardar() {
    if (!descripcion.trim() && !audioBlob && !fotoFile) { alert('Añade una descripción, foto o audio.'); return }
    setGuardando(true)
    try {
      const fotoBlob = fotoFile ? await comprimirImagen(fotoFile) : null
      const { data } = await supabase.auth.getUser()
      await crearIncidencia({ ordenId, tecnicoId: tecnicoId || data.user?.id || null, descripcion, estadoOrden: estado, fotoBlob, audioBlob })
      onHecho()
    } catch { setGuardando(false) }
  }
  const L = ({ children }: { children: React.ReactNode }) => <span className="text-xs font-medium" style={{ color: 'var(--text-subtle)' }}>{children}</span>
  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center md:p-4" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={onCerrar}>
      <div className="w-full md:max-w-md rounded-t-2xl md:rounded-2xl p-5" style={{ background: 'var(--bg-card)', maxHeight: '92vh', overflowY: 'auto', boxShadow: 'var(--shadow-lg)' }} onClick={(e) => e.stopPropagation()}>
        <h3 className="font-semibold mb-4" style={{ color: 'var(--text)' }}>Nueva incidencia</h3>
        <label className="block mb-3"><L>Descripción</L><textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={2} style={{ ...inp, resize: 'vertical' }} /></label>
        <label className="block mb-3"><L>Técnico</L><select value={tecnicoId} onChange={(e) => setTecnicoId(e.target.value)} style={inp}><option value="">Yo</option>{tecnicos.map((t) => <option key={t.id} value={t.id}>{t.nombre || t.id.slice(0, 6)}</option>)}</select></label>
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          <button onClick={toggleGrabar} className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold" style={{ background: grabando ? 'color-mix(in srgb, var(--red) 14%, transparent)' : 'var(--bg)', color: grabando ? 'var(--red)' : 'var(--text)', border: `1px solid ${grabando ? 'var(--red)' : 'var(--border)'}` }}>
            <span className="inline-block rounded-full" style={{ width: 9, height: 9, background: grabando ? 'var(--red)' : 'var(--text-muted)' }} />
            {grabando ? 'Detener grabación' : audioBlob ? 'Regrabar audio' : 'Grabar audio'}
          </button>
          <label className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold cursor-pointer" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}>
            {fotoFile ? 'Foto ✓' : 'Adjuntar foto'}
            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => setFotoFile(e.target.files?.[0] || null)} />
          </label>
        </div>
        {audioUrl && <audio controls src={audioUrl} className="w-full mb-3" style={{ height: 36 }} />}
        <div className="flex gap-3 justify-end mt-2">
          <button onClick={onCerrar} className="rounded-xl px-4 py-2 font-semibold" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}>Cancelar</button>
          <button onClick={guardar} disabled={guardando || grabando} className="marca-gradiente rounded-xl px-4 py-2 font-semibold text-white" style={{ opacity: (guardando || grabando) ? 0.6 : 1 }}>{guardando ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </div>
    </div>
  )
}
