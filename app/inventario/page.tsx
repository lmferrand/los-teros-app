'use client'

import { useEffect, useMemo, useState } from 'react'
import QRCode from 'qrcode'
import {
  listarMateriales, guardarMaterial, borrarMaterial, fijarStock,
  listarEquipos, guardarEquipo, borrarEquipo, cambiarEstadoEquipo,
  crearMovimiento, subirFotoMaterial,
} from '@/lib/db/inventario'
import {
  CATEGORIAS_MATERIAL, UNIDADES, TIPOS_EQUIPO, ESTADOS_EQUIPO,
  labelCategoria, labelUnidad, labelTipoEquipo, stockBajo,
  payloadQrMaterial, payloadQrEquipo,
  type Material, type Equipo,
} from '@/lib/inventario'
import { comprimirImagen } from '@/lib/imagen'
import { EstadoVacio, SkeletonLista } from '@/app/components/ui'

const inp: React.CSSProperties = { background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 10, padding: '9px 11px', fontSize: '0.9rem', width: '100%', marginTop: 3 }
const shadowLg = 'var(--shadow-lg)'

export default function InventarioPage() {
  const [vista, setVista] = useState<'materiales' | 'equipos'>('materiales')
  const [materiales, setMateriales] = useState<Material[]>([])
  const [equipos, setEquipos] = useState<Equipo[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [editMat, setEditMat] = useState<Material | 'nuevo' | null>(null)
  const [editEq, setEditEq] = useState<Equipo | 'nuevo' | null>(null)
  const [ajuste, setAjuste] = useState<Material | null>(null)
  const [qr, setQr] = useState<{ titulo: string; sub: string; url: string } | null>(null)

  async function cargar() {
    try {
      const [m, e] = await Promise.all([listarMateriales(), listarEquipos()])
      setMateriales(m); setEquipos(e)
    } catch (err: any) { setError(err.message || 'Error al cargar') }
    finally { setCargando(false) }
  }
  useEffect(() => { cargar() }, [])

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
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`<html><head><title>QR Inventario · Los Teros</title>
      <style>body{font-family:Segoe UI,Arial,sans-serif;padding:24px;color:#0f172a}
      .grid{display:flex;flex-wrap:wrap;gap:16px}
      .item{width:150px;text-align:center;border:1px solid #e5e9f0;border-radius:10px;padding:10px}
      .item img{width:130px;height:130px}.item h3{font-size:12px;margin:6px 0 2px}.item p{font-size:10px;color:#64748b;margin:0}
      h1{color:#0ea5e9}h2{font-size:15px;margin:18px 0 10px}
      @media print{button{display:none}}</style></head><body>
      <h1>Los Teros · QR de inventario</h1>
      <button onclick="window.print()" style="padding:10px 18px;font-size:14px;cursor:pointer;background:#0ea5e9;color:#fff;border:none;border-radius:8px;margin-bottom:16px">Imprimir</button>
      <h2>Materiales (${mats.length})</h2><div class="grid">
      ${mats.map(({ m, url }) => `<div class="item"><img src="${url}"><h3>${m.nombre}</h3><p>Ref: ${m.referencia || '-'}</p></div>`).join('')}
      </div><h2>Equipos (${eqs.length})</h2><div class="grid">
      ${eqs.map(({ e, url }) => `<div class="item"><img src="${url}"><h3>${e.codigo}</h3><p>${labelTipoEquipo(e.tipo)}</p></div>`).join('')}
      </div></body></html>`)
    win.document.close()
  }

  return (
    <div>
      <header className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <h1 className="titulo-hero" style={{ color: 'var(--text)' }}>Inventario</h1>
        <div className="flex gap-2">
          <button onClick={imprimirTodos} className="rounded-xl px-3 py-2.5 text-sm font-semibold" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text)' }}>
            Imprimir QR
          </button>
          <button onClick={() => (vista === 'materiales' ? setEditMat('nuevo') : setEditEq('nuevo'))} className="marca-gradiente inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-white font-semibold" style={{ boxShadow: 'var(--shadow-sm)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
            {vista === 'materiales' ? 'Nuevo material' : 'Nuevo equipo'}
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="inline-flex rounded-xl p-1 mb-4" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)' }}>
        {(['materiales', 'equipos'] as const).map((v) => (
          <button key={v} onClick={() => setVista(v)} className="px-4 py-1.5 rounded-lg text-sm font-semibold capitalize transition-colors"
            style={{ background: vista === v ? 'var(--bg-card)' : 'transparent', color: vista === v ? 'var(--brand-1)' : 'var(--text-muted)', boxShadow: vista === v ? 'var(--shadow-sm)' : 'none' }}>
            {v} {v === 'materiales' ? `(${materiales.length})` : `(${equipos.length})`}
          </button>
        ))}
      </div>

      {error && <div className="card p-4 mb-4 text-sm" style={{ color: 'var(--red)' }}>{error}</div>}

      {cargando ? <SkeletonLista /> : vista === 'materiales' ? (
        materiales.length === 0 ? <EstadoVacio titulo="Sin materiales" texto="Crea el primero con “Nuevo material”." /> : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {materiales.map((m) => (
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
                    {stockBajo(m) && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'color-mix(in srgb, var(--red) 14%, transparent)', color: 'var(--red)' }}>STOCK BAJO</span>}
                  </div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {labelCategoria(m.categoria)}{m.referencia ? ` · ${m.referencia}` : ''}{m.ubicacion ? ` · ${m.ubicacion}` : ''}
                  </div>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="font-bold" style={{ color: stockBajo(m) ? 'var(--red)' : 'var(--text)' }}>{m.stock ?? 0}</span>
                    <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>{labelUnidad(m.unidad)} (mín. {m.minimo ?? 0})</span>
                  </div>
                  <div className="flex gap-1.5 mt-2 flex-wrap">
                    <Btn onClick={() => setAjuste(m)}>± Stock</Btn>
                    <Btn onClick={() => abrirQrMaterial(m)}>QR</Btn>
                    <Btn onClick={() => setEditMat(m)}>Editar</Btn>
                    <Btn danger onClick={async () => { if (confirm('¿Eliminar material?')) { await borrarMaterial(m.id); cargar() } }}>Eliminar</Btn>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        equipos.length === 0 ? <EstadoVacio titulo="Sin equipos" texto="Crea el primero con “Nuevo equipo”." /> : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {equipos.map((e) => {
              const est = ESTADOS_EQUIPO[e.estado || '']
              return (
                <div key={e.id} className="card p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold" style={{ color: 'var(--text)' }}>{e.codigo}</span>
                    {est && <span className="text-xs font-semibold rounded-full px-2.5 py-1" style={{ background: `color-mix(in srgb, ${est.color} 14%, transparent)`, color: est.color }}>{est.label}</span>}
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {labelTipoEquipo(e.tipo)}{e.marca ? ` · ${e.marca}` : ''}{e.modelo ? ` ${e.modelo}` : ''}{e.ubicacion ? ` · ${e.ubicacion}` : ''} · {e.cantidad_disponible} ud.
                  </div>
                  <div className="flex gap-1.5 mt-2.5 flex-wrap items-center">
                    <select value={e.estado || ''} onChange={async (ev) => { await cambiarEstadoEquipo(e.id, ev.target.value); cargar() }} className="text-xs rounded-lg px-2 py-1.5" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}>
                      {Object.entries(ESTADOS_EQUIPO).map(([v, o]) => <option key={v} value={v}>{o.label}</option>)}
                    </select>
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

      {editMat && <MaterialForm material={editMat === 'nuevo' ? null : editMat} onCerrar={() => setEditMat(null)} onGuardado={() => { setEditMat(null); cargar() }} />}
      {editEq && <EquipoForm equipo={editEq === 'nuevo' ? null : editEq} onCerrar={() => setEditEq(null)} onGuardado={() => { setEditEq(null); cargar() }} />}
      {ajuste && <AjusteStock material={ajuste} onCerrar={() => setAjuste(null)} onHecho={() => { setAjuste(null); cargar() }} />}
      {qr && <QrModal {...qr} onCerrar={() => setQr(null)} />}
    </div>
  )
}

function Btn({ children, onClick, danger }: { children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} className="text-xs font-semibold rounded-lg px-2.5 py-1.5" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: danger ? 'var(--red)' : 'var(--text)' }}>
      {children}
    </button>
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
function Lbl({ children }: { children: React.ReactNode }) {
  return <span className="text-xs font-medium" style={{ color: 'var(--text-subtle)' }}>{children}</span>
}

function MaterialForm({ material, onCerrar, onGuardado }: { material: Material | null; onCerrar: () => void; onGuardado: () => void }) {
  const [d, setD] = useState({
    nombre: material?.nombre ?? '', referencia: material?.referencia ?? '', categoria: material?.categoria ?? 'limpieza',
    unidad: material?.unidad ?? 'unidad', stock: String(material?.stock ?? 0), minimo: String(material?.minimo ?? 5),
    ubicacion: material?.ubicacion ?? '', notas: material?.notas ?? '', foto_url: material?.foto_url ?? '',
  })
  const [guardando, setGuardando] = useState(false)
  const [subiendo, setSubiendo] = useState(false)
  const set = (k: string, v: any) => setD((p) => ({ ...p, [k]: v }))

  async function onFoto(file: File) {
    setSubiendo(true)
    try { const blob = await comprimirImagen(file); const url = await subirFotoMaterial(blob); set('foto_url', url) }
    catch { /* noop */ } finally { setSubiendo(false) }
  }
  async function guardar() {
    if (!d.nombre.trim()) return
    setGuardando(true)
    try {
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
              {subiendo ? 'Subiendo…' : 'Subir foto'}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFoto(f) }} />
            </label>
          </div>
        </div>
      </div>
      <Acciones onCerrar={onCerrar} onGuardar={guardar} guardando={guardando} />
    </Sheet>
  )
}

function EquipoForm({ equipo, onCerrar, onGuardado }: { equipo: Equipo | null; onCerrar: () => void; onGuardado: () => void }) {
  const [d, setD] = useState({
    codigo: equipo?.codigo ?? '', tipo: equipo?.tipo ?? 'turbina', marca: equipo?.marca ?? '', modelo: equipo?.modelo ?? '',
    estado: equipo?.estado ?? 'disponible', cantidad_disponible: String(equipo?.cantidad_disponible ?? 1),
    ubicacion: equipo?.ubicacion ?? '', notas: equipo?.notas ?? '',
  })
  const [guardando, setGuardando] = useState(false)
  const set = (k: string, v: any) => setD((p) => ({ ...p, [k]: v }))
  async function guardar() {
    if (!d.codigo.trim()) return
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
  const [delta, setDelta] = useState('0')
  const [nota, setNota] = useState('')
  const [guardando, setGuardando] = useState(false)
  const actual = material.stock ?? 0
  const cambio = parseFloat(delta) || 0
  const nuevo = Math.max(0, actual + cambio)

  async function aplicar() {
    if (cambio === 0) return
    setGuardando(true)
    try {
      await fijarStock(material.id, nuevo)
      await crearMovimiento({
        tipo: cambio > 0 ? 'entrada' : 'ajuste',
        material_id: material.id,
        cantidad: Math.abs(cambio),
        observaciones: nota || (cambio > 0 ? 'Entrada de stock' : 'Ajuste de stock'),
        fecha: new Date().toISOString(),
      })
      onHecho()
    } catch { setGuardando(false) }
  }
  return (
    <Sheet titulo={`Ajustar stock · ${material.nombre}`} onCerrar={onCerrar}>
      <div className="text-sm mb-3" style={{ color: 'var(--text-muted)' }}>Stock actual: <b style={{ color: 'var(--text)' }}>{actual} {labelUnidad(material.unidad)}</b></div>
      <div className="flex items-center gap-2 mb-3">
        <button onClick={() => setDelta(String(cambio - 1))} className="grid place-items-center rounded-lg" style={{ width: 40, height: 40, background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 20 }}>−</button>
        <input type="number" step="any" value={delta} onChange={(e) => setDelta(e.target.value)} style={{ ...inp, textAlign: 'center', marginTop: 0 }} />
        <button onClick={() => setDelta(String(cambio + 1))} className="grid place-items-center rounded-lg" style={{ width: 40, height: 40, background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 20 }}>+</button>
      </div>
      <div className="text-sm mb-3" style={{ color: 'var(--text-muted)' }}>Nuevo stock: <b style={{ color: 'var(--brand-1)' }}>{nuevo} {labelUnidad(material.unidad)}</b></div>
      <label><Lbl>Nota (opcional)</Lbl><input value={nota} onChange={(e) => setNota(e.target.value)} style={inp} /></label>
      <Acciones onCerrar={onCerrar} onGuardar={aplicar} guardando={guardando} />
    </Sheet>
  )
}

function QrModal({ titulo, sub, url, onCerrar }: { titulo: string; sub: string; url: string; onCerrar: () => void }) {
  return (
    <Sheet titulo="Código QR" onCerrar={onCerrar}>
      <div className="flex flex-col items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="QR" style={{ width: 240, height: 240 }} />
        <div className="font-semibold text-center" style={{ color: 'var(--text)' }}>{titulo}</div>
        <div className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>{sub}</div>
        <div className="flex gap-2 mt-2">
          <a href={url} download={`qr-${titulo}.png`} className="rounded-xl px-4 py-2 font-semibold text-sm" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}>Descargar</a>
        </div>
      </div>
    </Sheet>
  )
}
