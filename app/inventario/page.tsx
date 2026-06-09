'use client'

import { useEffect, useMemo, useState } from 'react'
import QRCode from 'qrcode'
import {
  listarMateriales, guardarMaterial, borrarMaterial, fijarStock,
  listarEquipos, guardarEquipo, borrarEquipo, cambiarEstadoEquipo,
  crearMovimiento, subirFotoMaterial, borrarFoto, otPorEquipo,
  listarMovimientosItem, type MovimientoConRefs,
} from '@/lib/db/inventario'
import {
  CATEGORIAS_MATERIAL, UNIDADES, TIPOS_EQUIPO, ESTADOS_EQUIPO, TIPOS_MOVIMIENTO,
  labelCategoria, labelUnidad, labelTipoEquipo, stockBajo,
  payloadQrMaterial, payloadQrEquipo,
  type Material, type Equipo,
} from '@/lib/inventario'
import { comprimirImagen } from '@/lib/imagen'
import { exportarExcel } from '@/lib/export'
import { fechaCorta } from '@/lib/dominio'
import { EstadoVacio, SkeletonLista } from '@/app/components/ui'

const inp: React.CSSProperties = { background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 10, padding: '9px 11px', fontSize: '0.9rem', width: '100%', marginTop: 3 }
const shadowLg = 'var(--shadow-lg)'

type Historial = { titulo: string; campo: 'material_id' | 'equipo_id'; id: string } | null

export default function InventarioPage() {
  const [vista, setVista] = useState<'materiales' | 'equipos'>('materiales')
  const [materiales, setMateriales] = useState<Material[]>([])
  const [equipos, setEquipos] = useState<Equipo[]>([])
  const [otEq, setOtEq] = useState<Record<string, { codigo: string | null; cliente: string | null }>>({})
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')
  const [fCat, setFCat] = useState('')
  const [fEstadoEq, setFEstadoEq] = useState('')
  const [editMat, setEditMat] = useState<Material | 'nuevo' | null>(null)
  const [editEq, setEditEq] = useState<Equipo | 'nuevo' | null>(null)
  const [ajuste, setAjuste] = useState<Material | null>(null)
  const [qr, setQr] = useState<{ titulo: string; sub: string; url: string } | null>(null)
  const [historial, setHistorial] = useState<Historial>(null)

  async function cargar() {
    try {
      const [m, e, ot] = await Promise.all([listarMateriales(), listarEquipos(), otPorEquipo()])
      setMateriales(m); setEquipos(e); setOtEq(ot)
    } catch (err: any) { setError(err.message || 'Error al cargar') }
    finally { setCargando(false) }
  }
  useEffect(() => { cargar() }, [])

  const texto = q.trim().toLowerCase()
  const matFiltrados = useMemo(() => materiales.filter((m) => {
    if (fCat && m.categoria !== fCat) return false
    if (texto && !`${m.nombre} ${m.referencia || ''} ${m.ubicacion || ''}`.toLowerCase().includes(texto)) return false
    return true
  }), [materiales, fCat, texto])
  const eqFiltrados = useMemo(() => equipos.filter((e) => {
    if (fEstadoEq && e.estado !== fEstadoEq) return false
    if (texto && !`${e.codigo} ${e.marca || ''} ${e.modelo || ''}`.toLowerCase().includes(texto)) return false
    return true
  }), [equipos, fEstadoEq, texto])

  const bajos = useMemo(() => materiales.filter(stockBajo), [materiales])
  const totalesEq = useMemo(() => {
    const t = { disponible: 0, en_cliente: 0, pend: 0 }
    for (const e of equipos) {
      const c = e.cantidad_disponible || 0
      if (e.estado === 'disponible') t.disponible += c
      else if (e.estado === 'en_cliente') t.en_cliente += c
      else if (e.estado === 'pendiente_limpieza' || e.estado === 'pendiente_revision') t.pend += c
    }
    return t
  }, [equipos])

  async function abrirQrMaterial(m: Material) {
    const url = await QRCode.toDataURL(payloadQrMaterial(m), { width: 360, margin: 2 })
    setQr({ titulo: m.nombre, sub: `Ref: ${m.referencia || '-'} · ${m.stock ?? 0} ${labelUnidad(m.unidad)}`, url })
  }
  async function abrirQrEquipo(e: Equipo) {
    const url = await QRCode.toDataURL(payloadQrEquipo(e), { width: 360, margin: 2 })
    setQr({ titulo: e.codigo, sub: labelTipoEquipo(e.tipo), url })
  }

  async function imprimirTodos() {
    const mats = await Promise.all(materiales.map(async (m) => ({ m, url: await QRCode.toDataURL(payloadQrMaterial(m), { width: 180, margin: 1 }) })))
    const eqs = await Promise.all(equipos.map(async (e) => ({ e, url: await QRCode.toDataURL(payloadQrEquipo(e), { width: 180, margin: 1 }) })))
    abrirVentanaImpresion(`
      <h1>Los Teros · QR de inventario</h1>
      <button onclick="window.print()">Imprimir</button>
      <h2>Materiales (${mats.length})</h2><div class="grid">
      ${mats.map(({ m, url }) => `<div class="item"><img src="${url}"><h3>${m.nombre}</h3><p>Ref: ${m.referencia || '-'}</p></div>`).join('')}
      </div><h2>Equipos (${eqs.length})</h2><div class="grid">
      ${eqs.map(({ e, url }) => `<div class="item"><img src="${url}"><h3>${e.codigo}</h3><p>${labelTipoEquipo(e.tipo)}</p></div>`).join('')}</div>`)
  }

  function exportar() {
    if (vista === 'materiales') {
      exportarExcel('inventario-materiales.xlsx', [{
        nombre: 'Materiales',
        filas: materiales.map((m) => ({
          Nombre: m.nombre, Referencia: m.referencia || '', Categoria: labelCategoria(m.categoria),
          Stock: m.stock ?? 0, Unidad: labelUnidad(m.unidad), Minimo: m.minimo ?? 0,
          'Stock bajo': stockBajo(m) ? 'SÍ' : '', Ubicacion: m.ubicacion || '', Notas: m.notas || '',
        })),
      }])
    } else {
      exportarExcel('inventario-equipos.xlsx', [{
        nombre: 'Equipos',
        filas: equipos.map((e) => ({
          Codigo: e.codigo, Tipo: labelTipoEquipo(e.tipo), Marca: e.marca || '', Modelo: e.modelo || '',
          Estado: ESTADOS_EQUIPO[e.estado || '']?.label || e.estado || '', Cantidad: e.cantidad_disponible,
          OT: otEq[e.id]?.codigo || '', Cliente: otEq[e.id]?.cliente || '', Ubicacion: e.ubicacion || '',
        })),
      }])
    }
  }

  return (
    <div>
      <header className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <h1 className="titulo-hero" style={{ color: 'var(--text)' }}>Inventario</h1>
        <div className="flex gap-2 flex-wrap">
          <button onClick={exportar} className="rounded-xl px-3 py-2.5 text-sm font-semibold" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text)' }}>Excel</button>
          <button onClick={imprimirTodos} className="rounded-xl px-3 py-2.5 text-sm font-semibold" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text)' }}>Imprimir QR</button>
          <button onClick={() => (vista === 'materiales' ? setEditMat('nuevo') : setEditEq('nuevo'))} className="marca-gradiente inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-white font-semibold" style={{ boxShadow: 'var(--shadow-sm)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
            {vista === 'materiales' ? 'Material' : 'Equipo'}
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="inline-flex rounded-xl p-1 mb-4" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)' }}>
        {(['materiales', 'equipos'] as const).map((v) => (
          <button key={v} onClick={() => setVista(v)} className="px-4 py-1.5 rounded-lg text-sm font-semibold capitalize transition-colors"
            style={{ background: vista === v ? 'var(--bg-card)' : 'transparent', color: vista === v ? 'var(--brand-1)' : 'var(--text-muted)', boxShadow: vista === v ? 'var(--shadow-sm)' : 'none' }}>
            {v} ({v === 'materiales' ? materiales.length : equipos.length})
          </button>
        ))}
      </div>

      {/* Buscador + filtros */}
      <div className="flex flex-wrap gap-2 items-center mb-4">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar…" className="flex-1 min-w-[160px] rounded-lg px-3 py-2 text-sm" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text)' }} />
        {vista === 'materiales' ? (
          <select value={fCat} onChange={(e) => setFCat(e.target.value)} className="rounded-lg px-2.5 py-2 text-sm" style={{ background: 'var(--bg-card)', border: `1px solid ${fCat ? 'var(--brand-1)' : 'var(--border)'}`, color: 'var(--text)' }}>
            <option value="">Categoría</option>
            {CATEGORIAS_MATERIAL.map((c) => <option key={c.valor} value={c.valor}>{c.label}</option>)}
          </select>
        ) : (
          <select value={fEstadoEq} onChange={(e) => setFEstadoEq(e.target.value)} className="rounded-lg px-2.5 py-2 text-sm" style={{ background: 'var(--bg-card)', border: `1px solid ${fEstadoEq ? 'var(--brand-1)' : 'var(--border)'}`, color: 'var(--text)' }}>
            <option value="">Estado</option>
            {Object.entries(ESTADOS_EQUIPO).map(([v, o]) => <option key={v} value={v}>{o.label}</option>)}
          </select>
        )}
      </div>

      {error && <div className="card p-4 mb-4 text-sm" style={{ color: 'var(--red)' }}>{error}</div>}

      {/* Resumen */}
      {!cargando && vista === 'materiales' && bajos.length > 0 && (
        <div className="card p-4 mb-4" style={{ background: 'color-mix(in srgb, var(--red) 7%, var(--bg-card))', borderColor: 'var(--red)' }}>
          <div className="font-semibold text-sm mb-2" style={{ color: 'var(--red)' }}>⚠ Stock bajo · {bajos.length} materiales</div>
          <div className="flex flex-wrap gap-2">
            {bajos.map((m) => (
              <button key={m.id} onClick={() => setAjuste(m)} className="text-xs rounded-lg px-2.5 py-1.5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text)' }}>
                {m.nombre}: <b style={{ color: 'var(--red)' }}>{m.stock ?? 0}</b>/{m.minimo} · <span style={{ color: 'var(--brand-1)' }}>pedir {Math.max(0, (m.minimo ?? 0) - (m.stock ?? 0))}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {!cargando && vista === 'equipos' && (
        <div className="grid grid-cols-3 gap-3 mb-4">
          {[['Disponibles', totalesEq.disponible, 'var(--green)'], ['En cliente', totalesEq.en_cliente, 'var(--brand-1)'], ['Pendientes', totalesEq.pend, 'var(--violet)']].map(([l, v, c]) => (
            <div key={l as string} className="card p-3 text-center">
              <div className="text-2xl font-bold" style={{ color: c as string }}>{v as number}</div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{l as string}</div>
            </div>
          ))}
        </div>
      )}

      {cargando ? <SkeletonLista /> : vista === 'materiales' ? (
        matFiltrados.length === 0 ? <EstadoVacio titulo="Sin materiales" texto={materiales.length ? 'Prueba con otra búsqueda.' : 'Crea el primero.'} /> : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {matFiltrados.map((m) => (
              <div key={m.id} className="card p-3 flex gap-3">
                <div className="rounded-xl overflow-hidden shrink-0" style={{ width: 64, height: 64, background: 'var(--bg-subtle)' }}>
                  {m.foto_url
                    /* eslint-disable-next-line @next/next/no-img-element */
                    ? <img src={m.foto_url} alt={m.nombre} style={{ width: 64, height: 64, objectFit: 'cover' }} />
                    : <div className="grid place-items-center h-full text-xs" style={{ color: 'var(--text-subtle)' }}>sin foto</div>}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold truncate" style={{ color: 'var(--text)' }}>{m.nombre}</span>
                    {stockBajo(m) && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'color-mix(in srgb, var(--red) 14%, transparent)', color: 'var(--red)' }}>BAJO · pedir {Math.max(0, (m.minimo ?? 0) - (m.stock ?? 0))}</span>}
                  </div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{labelCategoria(m.categoria)}{m.referencia ? ` · ${m.referencia}` : ''}{m.ubicacion ? ` · ${m.ubicacion}` : ''}</div>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="font-bold" style={{ color: stockBajo(m) ? 'var(--red)' : 'var(--text)' }}>{m.stock ?? 0}</span>
                    <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>{labelUnidad(m.unidad)} (mín. {m.minimo ?? 0})</span>
                  </div>
                  <div className="flex gap-1.5 mt-2 flex-wrap">
                    <Btn onClick={() => setAjuste(m)}>± Stock</Btn>
                    <Btn onClick={() => setHistorial({ titulo: m.nombre, campo: 'material_id', id: m.id })}>Historial</Btn>
                    <Btn onClick={() => abrirQrMaterial(m)}>QR</Btn>
                    <Btn onClick={() => setEditMat(m)}>Editar</Btn>
                    <Btn danger onClick={async () => { if (confirm('¿Eliminar material?')) { await borrarFoto(m.foto_url); await borrarMaterial(m.id); cargar() } }}>Eliminar</Btn>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        eqFiltrados.length === 0 ? <EstadoVacio titulo="Sin equipos" texto={equipos.length ? 'Prueba con otra búsqueda.' : 'Crea el primero.'} /> : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {eqFiltrados.map((e) => {
              const est = ESTADOS_EQUIPO[e.estado || '']
              const ot = otEq[e.id]
              return (
                <div key={e.id} className="card p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold" style={{ color: 'var(--text)' }}>{e.codigo}</span>
                    {est && <span className="text-xs font-semibold rounded-full px-2.5 py-1" style={{ background: `color-mix(in srgb, ${est.color} 14%, transparent)`, color: est.color }}>{est.label}</span>}
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{labelTipoEquipo(e.tipo)}{e.marca ? ` · ${e.marca}` : ''}{e.modelo ? ` ${e.modelo}` : ''}{e.ubicacion ? ` · ${e.ubicacion}` : ''} · {e.cantidad_disponible} ud.</div>
                  {e.estado === 'en_cliente' && ot && (ot.codigo || ot.cliente) && (
                    <div className="text-xs mt-1 rounded-lg px-2 py-1 inline-block" style={{ background: 'color-mix(in srgb, var(--brand-1) 10%, transparent)', color: 'var(--brand-1)' }}>
                      En OT {ot.codigo || ''}{ot.cliente ? ` · ${ot.cliente}` : ''}
                    </div>
                  )}
                  <div className="flex gap-1.5 mt-2.5 flex-wrap items-center">
                    <select value={e.estado || ''} onChange={async (ev) => { await cambiarEstadoEquipo(e.id, ev.target.value); cargar() }} className="text-xs rounded-lg px-2 py-1.5" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}>
                      {Object.entries(ESTADOS_EQUIPO).map(([v, o]) => <option key={v} value={v}>{o.label}</option>)}
                    </select>
                    <Btn onClick={() => setHistorial({ titulo: e.codigo, campo: 'equipo_id', id: e.id })}>Historial</Btn>
                    <Btn onClick={() => abrirQrEquipo(e)}>QR</Btn>
                    <Btn onClick={() => setEditEq(e)}>Editar</Btn>
                    <Btn danger onClick={async () => { if (confirm('¿Eliminar equipo?')) { await borrarEquipo(e.id); cargar() } }}>Eliminar</Btn>
                  </div>
                </div>
              )
            })}
          </div>
        )
      )}

      {editMat && <MaterialForm material={editMat === 'nuevo' ? null : editMat} existentes={materiales} onCerrar={() => setEditMat(null)} onGuardado={() => { setEditMat(null); cargar() }} />}
      {editEq && <EquipoForm equipo={editEq === 'nuevo' ? null : editEq} existentes={equipos} onCerrar={() => setEditEq(null)} onGuardado={() => { setEditEq(null); cargar() }} />}
      {ajuste && <AjusteStock material={ajuste} onCerrar={() => setAjuste(null)} onHecho={() => { setAjuste(null); cargar() }} />}
      {qr && <QrModal {...qr} onCerrar={() => setQr(null)} />}
      {historial && <HistorialModal h={historial} onCerrar={() => setHistorial(null)} />}
    </div>
  )
}

function abrirVentanaImpresion(cuerpo: string) {
  const win = window.open('', '_blank')
  if (!win) { alert('El navegador bloqueó la ventana. Permite las ventanas emergentes para imprimir.'); return }
  win.document.write(`<html><head><title>Imprimir · Los Teros</title>
    <style>body{font-family:Segoe UI,Arial,sans-serif;padding:24px;color:#0f172a}
    .grid{display:flex;flex-wrap:wrap;gap:16px}
    .item{width:150px;text-align:center;border:1px solid #e5e9f0;border-radius:10px;padding:10px}
    .item img{width:130px;height:130px}.item h3{font-size:12px;margin:6px 0 2px}.item p{font-size:10px;color:#64748b;margin:0}
    h1{color:#0ea5e9}h2{font-size:15px;margin:18px 0 10px}
    button{padding:10px 18px;font-size:14px;cursor:pointer;background:#0ea5e9;color:#fff;border:none;border-radius:8px;margin-bottom:16px}
    @media print{button{display:none}}</style></head><body>${cuerpo}</body></html>`)
  win.document.close()
}

function Btn({ children, onClick, danger }: { children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} className="text-xs font-semibold rounded-lg px-2.5 py-1.5" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: danger ? 'var(--red)' : 'var(--text)' }}>{children}</button>
  )
}
function Sheet({ titulo, children, onCerrar }: { titulo: string; children: React.ReactNode; onCerrar: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center md:p-4" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={onCerrar}>
      <div className="w-full md:max-w-md rounded-t-2xl md:rounded-2xl p-5" style={{ background: 'var(--bg-card)', maxHeight: '92vh', overflowY: 'auto', boxShadow: shadowLg }} onClick={(e) => e.stopPropagation()}>
        <h3 className="font-semibold mb-4" style={{ color: 'var(--text)' }}>{titulo}</h3>
        {children}
      </div>
    </div>
  )
}
function Acciones({ onCerrar, onGuardar, guardando }: { onCerrar: () => void; onGuardar: () => void; guardando?: boolean }) {
  return (
    <div className="flex gap-3 justify-end mt-5">
      <button onClick={onCerrar} className="rounded-xl px-4 py-2 font-semibold" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}>Cancelar</button>
      <button onClick={onGuardar} disabled={guardando} className="marca-gradiente rounded-xl px-4 py-2 font-semibold text-white" style={{ opacity: guardando ? 0.7 : 1 }}>{guardando ? 'Guardando…' : 'Guardar'}</button>
    </div>
  )
}
const Lbl = ({ children }: { children: React.ReactNode }) => <span className="text-xs font-medium" style={{ color: 'var(--text-subtle)' }}>{children}</span>

function MaterialForm({ material, existentes, onCerrar, onGuardado }: { material: Material | null; existentes: Material[]; onCerrar: () => void; onGuardado: () => void }) {
  const [d, setD] = useState({
    nombre: material?.nombre ?? '', referencia: material?.referencia ?? '', categoria: material?.categoria ?? 'limpieza',
    unidad: material?.unidad ?? 'unidad', stock: String(material?.stock ?? 0), minimo: String(material?.minimo ?? 5),
    ubicacion: material?.ubicacion ?? '', notas: material?.notas ?? '', foto_url: material?.foto_url ?? '',
  })
  const [guardando, setGuardando] = useState(false)
  const [subiendo, setSubiendo] = useState(false)
  const [err, setErr] = useState('')
  const set = (k: string, v: any) => setD((p) => ({ ...p, [k]: v }))

  async function onFoto(file: File) {
    setSubiendo(true)
    try { const blob = await comprimirImagen(file); const url = await subirFotoMaterial(blob); set('foto_url', url) }
    catch { /* noop */ } finally { setSubiendo(false) }
  }
  async function guardar() {
    if (!d.nombre.trim()) { setErr('El nombre es obligatorio.'); return }
    const ref = d.referencia.trim().toLowerCase()
    if (ref && existentes.some((m) => (m.referencia || '').trim().toLowerCase() === ref && m.id !== material?.id)) {
      setErr('Ya existe un material con esa referencia.'); return
    }
    setGuardando(true)
    try {
      // Si se cambió/quitó la foto, borra la anterior del Storage.
      if (material?.foto_url && material.foto_url !== d.foto_url) await borrarFoto(material.foto_url)
      await guardarMaterial(material?.id ?? null, {
        nombre: d.nombre, referencia: d.referencia || null, categoria: d.categoria, unidad: d.unidad,
        stock: parseFloat(d.stock) || 0, minimo: parseFloat(d.minimo) || 0, ubicacion: d.ubicacion || null,
        notas: d.notas || null, foto_url: d.foto_url || null,
      })
      onGuardado()
    } catch { setGuardando(false) }
  }

  return (
    <Sheet titulo={material ? 'Editar material' : 'Nuevo material'} onCerrar={onCerrar}>
      {err && <div className="text-sm mb-3 rounded-lg px-3 py-2" style={{ background: 'color-mix(in srgb, var(--red) 10%, transparent)', color: 'var(--red)' }}>{err}</div>}
      <div className="grid grid-cols-2 gap-3">
        <label className="col-span-2"><Lbl>Nombre</Lbl><input value={d.nombre} onChange={(e) => set('nombre', e.target.value)} style={inp} /></label>
        <label><Lbl>Referencia</Lbl><input value={d.referencia} onChange={(e) => set('referencia', e.target.value)} style={inp} /></label>
        <label><Lbl>Categoría</Lbl><select value={d.categoria} onChange={(e) => set('categoria', e.target.value)} style={inp}>{CATEGORIAS_MATERIAL.map((c) => <option key={c.valor} value={c.valor}>{c.label}</option>)}</select></label>
        <label><Lbl>Unidad</Lbl><select value={d.unidad} onChange={(e) => set('unidad', e.target.value)} style={inp}>{UNIDADES.map((u) => <option key={u.valor} value={u.valor}>{u.label}</option>)}</select></label>
        <label><Lbl>Ubicación</Lbl><input value={d.ubicacion} onChange={(e) => set('ubicacion', e.target.value)} style={inp} /></label>
        <label><Lbl>Stock</Lbl><input type="number" step="any" value={d.stock} onChange={(e) => set('stock', e.target.value)} style={inp} /></label>
        <label><Lbl>Mínimo</Lbl><input type="number" step="any" value={d.minimo} onChange={(e) => set('minimo', e.target.value)} style={inp} /></label>
        <label className="col-span-2"><Lbl>Notas</Lbl><input value={d.notas} onChange={(e) => set('notas', e.target.value)} style={inp} /></label>
        <div className="col-span-2">
          <Lbl>Foto</Lbl>
          <div className="flex items-center gap-3 mt-1">
            {d.foto_url
              /* eslint-disable-next-line @next/next/no-img-element */
              ? <img src={d.foto_url} alt="foto" style={{ width: 56, height: 56, borderRadius: 10, objectFit: 'cover' }} />
              : <div className="grid place-items-center text-xs" style={{ width: 56, height: 56, borderRadius: 10, background: 'var(--bg-subtle)', color: 'var(--text-subtle)' }}>—</div>}
            <label className="text-sm rounded-lg px-3 py-2 cursor-pointer" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}>
              {subiendo ? 'Subiendo…' : 'Subir'}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFoto(f) }} />
            </label>
            {d.foto_url && <button onClick={() => set('foto_url', '')} className="text-sm" style={{ color: 'var(--red)' }}>Quitar</button>}
          </div>
        </div>
      </div>
      <Acciones onCerrar={onCerrar} onGuardar={guardar} guardando={guardando} />
    </Sheet>
  )
}

function EquipoForm({ equipo, existentes, onCerrar, onGuardado }: { equipo: Equipo | null; existentes: Equipo[]; onCerrar: () => void; onGuardado: () => void }) {
  const [d, setD] = useState({
    codigo: equipo?.codigo ?? '', tipo: equipo?.tipo ?? 'turbina', marca: equipo?.marca ?? '', modelo: equipo?.modelo ?? '',
    estado: equipo?.estado ?? 'disponible', cantidad_disponible: String(equipo?.cantidad_disponible ?? 1),
    ubicacion: equipo?.ubicacion ?? '', notas: equipo?.notas ?? '',
  })
  const [guardando, setGuardando] = useState(false)
  const [err, setErr] = useState('')
  const set = (k: string, v: any) => setD((p) => ({ ...p, [k]: v }))
  async function guardar() {
    if (!d.codigo.trim()) { setErr('El código es obligatorio.'); return }
    const cod = d.codigo.trim().toLowerCase()
    if (existentes.some((e) => e.codigo.trim().toLowerCase() === cod && e.id !== equipo?.id)) { setErr('Ya existe un equipo con ese código.'); return }
    setGuardando(true)
    try {
      await guardarEquipo(equipo?.id ?? null, {
        codigo: d.codigo, tipo: d.tipo, marca: d.marca || null, modelo: d.modelo || null, estado: d.estado,
        cantidad_disponible: parseInt(d.cantidad_disponible, 10) || 0, ubicacion: d.ubicacion || null, notas: d.notas || null,
      })
      onGuardado()
    } catch { setGuardando(false) }
  }
  return (
    <Sheet titulo={equipo ? 'Editar equipo' : 'Nuevo equipo'} onCerrar={onCerrar}>
      {err && <div className="text-sm mb-3 rounded-lg px-3 py-2" style={{ background: 'color-mix(in srgb, var(--red) 10%, transparent)', color: 'var(--red)' }}>{err}</div>}
      <div className="grid grid-cols-2 gap-3">
        <label><Lbl>Código</Lbl><input value={d.codigo} onChange={(e) => set('codigo', e.target.value)} style={inp} /></label>
        <label><Lbl>Tipo</Lbl><select value={d.tipo} onChange={(e) => set('tipo', e.target.value)} style={inp}>{TIPOS_EQUIPO.map((t) => <option key={t.valor} value={t.valor}>{t.label}</option>)}</select></label>
        <label><Lbl>Marca</Lbl><input value={d.marca} onChange={(e) => set('marca', e.target.value)} style={inp} /></label>
        <label><Lbl>Modelo</Lbl><input value={d.modelo} onChange={(e) => set('modelo', e.target.value)} style={inp} /></label>
        <label><Lbl>Estado</Lbl><select value={d.estado} onChange={(e) => set('estado', e.target.value)} style={inp}>{Object.entries(ESTADOS_EQUIPO).map(([v, o]) => <option key={v} value={v}>{o.label}</option>)}</select></label>
        <label><Lbl>Cantidad</Lbl><input type="number" value={d.cantidad_disponible} onChange={(e) => set('cantidad_disponible', e.target.value)} style={inp} /></label>
        <label className="col-span-2"><Lbl>Ubicación</Lbl><input value={d.ubicacion} onChange={(e) => set('ubicacion', e.target.value)} style={inp} /></label>
        <label className="col-span-2"><Lbl>Notas</Lbl><input value={d.notas} onChange={(e) => set('notas', e.target.value)} style={inp} /></label>
      </div>
      <Acciones onCerrar={onCerrar} onGuardar={guardar} guardando={guardando} />
    </Sheet>
  )
}

function AjusteStock({ material, onCerrar, onHecho }: { material: Material; onCerrar: () => void; onHecho: () => void }) {
  const [modo, setModo] = useState<'delta' | 'fijar'>('delta')
  const [valor, setValor] = useState('0')
  const [nota, setNota] = useState('')
  const [guardando, setGuardando] = useState(false)
  const actual = material.stock ?? 0
  const v = parseFloat(valor) || 0
  const nuevo = modo === 'delta' ? Math.max(0, actual + v) : Math.max(0, v)

  async function aplicar() {
    if (modo === 'delta' && v === 0) return
    setGuardando(true)
    try {
      await fijarStock(material.id, nuevo)
      const delta = nuevo - actual
      await crearMovimiento({
        tipo: modo === 'fijar' ? 'ajuste' : (delta > 0 ? 'entrada' : 'ajuste'),
        material_id: material.id, cantidad: Math.abs(delta),
        observaciones: nota || (modo === 'fijar' ? `Recuento: fijado a ${nuevo}` : delta > 0 ? 'Entrada de stock' : 'Ajuste de stock'),
        fecha: new Date().toISOString(),
      })
      onHecho()
    } catch { setGuardando(false) }
  }
  return (
    <Sheet titulo={`Ajustar stock · ${material.nombre}`} onCerrar={onCerrar}>
      <div className="text-sm mb-3" style={{ color: 'var(--text-muted)' }}>Stock actual: <b style={{ color: 'var(--text)' }}>{actual} {labelUnidad(material.unidad)}</b></div>
      <div className="inline-flex rounded-xl p-1 mb-3" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)' }}>
        {([['delta', 'Sumar / restar'], ['fijar', 'Fijar a (recuento)']] as const).map(([m, l]) => (
          <button key={m} onClick={() => { setModo(m); setValor('0') }} className="px-3 py-1.5 rounded-lg text-sm font-semibold" style={{ background: modo === m ? 'var(--bg-card)' : 'transparent', color: modo === m ? 'var(--brand-1)' : 'var(--text-muted)' }}>{l}</button>
        ))}
      </div>
      {modo === 'delta' ? (
        <div className="flex items-center gap-2 mb-3">
          <button onClick={() => setValor(String(v - 1))} className="grid place-items-center rounded-lg" style={{ width: 40, height: 40, background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 20 }}>−</button>
          <input type="number" step="any" value={valor} onChange={(e) => setValor(e.target.value)} style={{ ...inp, textAlign: 'center', marginTop: 0 }} />
          <button onClick={() => setValor(String(v + 1))} className="grid place-items-center rounded-lg" style={{ width: 40, height: 40, background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 20 }}>+</button>
        </div>
      ) : (
        <label className="block mb-3"><Lbl>Stock contado</Lbl><input type="number" step="any" value={valor} onChange={(e) => setValor(e.target.value)} style={inp} /></label>
      )}
      <div className="text-sm mb-3" style={{ color: 'var(--text-muted)' }}>Nuevo stock: <b style={{ color: 'var(--brand-1)' }}>{nuevo} {labelUnidad(material.unidad)}</b></div>
      <label><Lbl>Nota (opcional)</Lbl><input value={nota} onChange={(e) => setNota(e.target.value)} style={inp} /></label>
      <Acciones onCerrar={onCerrar} onGuardar={aplicar} guardando={guardando} />
    </Sheet>
  )
}

function QrModal({ titulo, sub, url, onCerrar }: { titulo: string; sub: string; url: string; onCerrar: () => void }) {
  function imprimir() {
    abrirVentanaImpresion(`<button onclick="window.print()">Imprimir</button><div class="grid"><div class="item"><img src="${url}" style="width:200px;height:200px"><h3>${titulo}</h3><p>${sub}</p></div></div>`)
  }
  return (
    <Sheet titulo="Código QR" onCerrar={onCerrar}>
      <div className="flex flex-col items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="QR" style={{ width: 240, height: 240 }} />
        <div className="font-semibold text-center" style={{ color: 'var(--text)' }}>{titulo}</div>
        <div className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>{sub}</div>
        <div className="flex gap-2 mt-2">
          <a href={url} download={`qr-${titulo}.png`} className="rounded-xl px-4 py-2 font-semibold text-sm" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}>Descargar</a>
          <button onClick={imprimir} className="rounded-xl px-4 py-2 font-semibold text-sm marca-gradiente text-white">Imprimir</button>
        </div>
      </div>
    </Sheet>
  )
}

function HistorialModal({ h, onCerrar }: { h: NonNullable<Historial>; onCerrar: () => void }) {
  const [movs, setMovs] = useState<MovimientoConRefs[] | null>(null)
  useEffect(() => { listarMovimientosItem(h.campo, h.id).then(setMovs) }, [h])
  return (
    <Sheet titulo={`Historial · ${h.titulo}`} onCerrar={onCerrar}>
      {movs === null ? <div className="skeleton" style={{ height: 80 }} /> : movs.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-subtle)' }}>Sin movimientos registrados.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {movs.map((m) => {
            const t = TIPOS_MOVIMIENTO[m.tipo] || { label: m.tipo, color: 'var(--text-muted)', icono: '📋' }
            return (
              <div key={m.id} className="flex items-center gap-3 rounded-xl px-3 py-2" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                <span className="text-xl">{t.icono}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium" style={{ color: t.color }}>{t.label}{m.cantidad != null ? ` · ${m.cantidad}` : ''}</div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {fechaCorta(m.fecha)}{m.ordenes?.codigo ? ` · OT ${m.ordenes.codigo}` : ''}{m.perfiles?.nombre ? ` · ${m.perfiles.nombre}` : ''}
                  </div>
                  {m.observaciones && <div className="text-xs" style={{ color: 'var(--text-subtle)' }}>{m.observaciones}</div>}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Sheet>
  )
}
