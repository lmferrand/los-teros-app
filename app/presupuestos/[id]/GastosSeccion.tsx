'use client'

import { useEffect, useState } from 'react'
import type { Gasto, GastoInput } from '@/lib/tipos'
import { listarGastos, crearGasto, actualizarGasto, borrarGasto } from '@/lib/db/gastos'
import { CATEGORIAS_GASTO, labelCategoria, eur, fechaCorta } from '@/lib/dominio'

export default function GastosSeccion({ ventaId, onCambio }: { ventaId: string; onCambio?: (g: Gasto[]) => void }) {
  const [gastos, setGastos] = useState<Gasto[]>([])
  const [cargando, setCargando] = useState(true)
  const [editando, setEditando] = useState<Gasto | 'nuevo' | null>(null)

  function refrescar() {
    listarGastos(ventaId).then((g) => {
      setGastos(g)
      setCargando(false)
      onCambio?.(g)
    })
  }
  useEffect(() => { refrescar() /* eslint-disable-next-line */ }, [ventaId])

  async function eliminar(id: string) {
    if (!confirm('¿Eliminar este gasto?')) return
    await borrarGasto(id)
    refrescar()
  }

  const totalEst = gastos.reduce((a, g) => a + (g.estimado_sin_iva || 0), 0)
  const totalReal = gastos.reduce((a, g) => a + (g.real_sin_iva || 0), 0)

  return (
    <section className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold" style={{ color: 'var(--text)' }}>Gastos asociados</h2>
        <button
          onClick={() => setEditando('nuevo')}
          className="text-sm font-semibold inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5"
          style={{ background: 'var(--bg-subtle)', color: 'var(--brand-1)' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          Añadir gasto
        </button>
      </div>

      {cargando ? (
        <div className="skeleton" style={{ height: 60 }} />
      ) : gastos.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-subtle)' }}>Sin gastos registrados.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {gastos.map((g) => (
            <div key={g.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>
                  {g.descripcion || labelCategoria(g.categoria)}
                </div>
                <div className="text-xs flex items-center gap-2 flex-wrap" style={{ color: 'var(--text-muted)' }}>
                  <span>{labelCategoria(g.categoria)}</span>
                  {g.proveedor && <><span>·</span><span>{g.proveedor}</span></>}
                  <span>·</span><span>{fechaCorta(g.fecha)}</span>
                  {g.pagado ? <span style={{ color: 'var(--green)' }}>· Pagado</span> : <span style={{ color: 'var(--amber)' }}>· Pendiente</span>}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{eur(g.real_sin_iva ?? g.estimado_sin_iva)}</div>
                <div className="text-[11px]" style={{ color: 'var(--text-subtle)' }}>
                  {g.real_sin_iva != null ? 'real' : 'estimado'} · sin IVA
                </div>
              </div>
              <button onClick={() => setEditando(g)} className="p-1.5 rounded-lg" style={{ color: 'var(--text-subtle)' }} title="Editar">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
              </button>
              <button onClick={() => eliminar(g.id)} className="p-1.5 rounded-lg" style={{ color: 'var(--red)' }} title="Eliminar">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4h8v2m-9 0v14a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V6" /></svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {gastos.length > 0 && (
        <div className="flex justify-end gap-6 mt-4 text-sm">
          <span style={{ color: 'var(--text-muted)' }}>Total estimado: <b style={{ color: 'var(--text)' }}>{eur(totalEst)}</b></span>
          <span style={{ color: 'var(--text-muted)' }}>Total real: <b style={{ color: totalReal > totalEst ? 'var(--red)' : 'var(--text)' }}>{eur(totalReal)}</b></span>
        </div>
      )}

      {editando && (
        <GastoForm
          ventaId={ventaId}
          gasto={editando === 'nuevo' ? null : editando}
          onCerrar={() => setEditando(null)}
          onGuardado={() => { setEditando(null); refrescar() }}
        />
      )}
    </section>
  )
}

function GastoForm({ ventaId, gasto, onCerrar, onGuardado }: {
  ventaId: string
  gasto: Gasto | null
  onCerrar: () => void
  onGuardado: () => void
}) {
  const [d, setD] = useState({
    fecha: gasto?.fecha ?? '',
    categoria: gasto?.categoria ?? 'material',
    descripcion: gasto?.descripcion ?? '',
    proveedor: gasto?.proveedor ?? '',
    estimado_sin_iva: gasto?.estimado_sin_iva ?? '',
    iva_porcentaje: gasto?.iva_porcentaje ?? 21,
    real_sin_iva: gasto?.real_sin_iva ?? '',
    pagado: gasto?.pagado ?? false,
    observaciones: gasto?.observaciones ?? '',
  })
  const [guardando, setGuardando] = useState(false)
  const set = (k: string, v: any) => setD((p) => ({ ...p, [k]: v }))

  async function guardar() {
    setGuardando(true)
    const iva = Number(d.iva_porcentaje) || 0
    const est = d.estimado_sin_iva === '' ? null : Number(d.estimado_sin_iva)
    const real = d.real_sin_iva === '' ? null : Number(d.real_sin_iva)
    const payload: GastoInput = {
      venta_id: ventaId,
      fecha: d.fecha || null,
      categoria: d.categoria as any,
      descripcion: d.descripcion || null,
      proveedor: d.proveedor || null,
      estimado_sin_iva: est,
      estimado_con_iva: est == null ? null : +(est * (1 + iva / 100)).toFixed(2),
      iva_porcentaje: iva,
      real_sin_iva: real,
      real_con_iva: real == null ? null : +(real * (1 + iva / 100)).toFixed(2),
      pagado: d.pagado,
      observaciones: d.observaciones || null,
    }
    try {
      if (gasto) await actualizarGasto(gasto.id, payload)
      else await crearGasto(payload)
      onGuardado()
    } catch {
      setGuardando(false)
    }
  }

  const inp: React.CSSProperties = { background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 10, padding: '8px 10px', fontSize: '0.9rem', width: '100%', marginTop: 3 }

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={onCerrar}>
      <div
        className="w-full md:max-w-md rounded-t-2xl md:rounded-2xl p-5"
        style={{ background: 'var(--bg-card)', maxHeight: '92vh', overflowY: 'auto', boxShadow: 'var(--shadow-lg)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-semibold mb-4" style={{ color: 'var(--text)' }}>{gasto ? 'Editar gasto' : 'Nuevo gasto'}</h3>
        <div className="grid grid-cols-2 gap-3">
          <label className="col-span-2 text-xs" style={{ color: 'var(--text-subtle)' }}>Categoría
            <select value={d.categoria} onChange={(e) => set('categoria', e.target.value)} style={inp}>
              {CATEGORIAS_GASTO.map((c) => <option key={c.valor} value={c.valor}>{c.label}</option>)}
            </select>
          </label>
          <label className="col-span-2 text-xs" style={{ color: 'var(--text-subtle)' }}>Descripción
            <input value={d.descripcion} onChange={(e) => set('descripcion', e.target.value)} style={inp} />
          </label>
          <label className="text-xs" style={{ color: 'var(--text-subtle)' }}>Proveedor
            <input value={d.proveedor} onChange={(e) => set('proveedor', e.target.value)} style={inp} />
          </label>
          <label className="text-xs" style={{ color: 'var(--text-subtle)' }}>Fecha
            <input type="date" value={d.fecha} onChange={(e) => set('fecha', e.target.value)} style={inp} />
          </label>
          <label className="text-xs" style={{ color: 'var(--text-subtle)' }}>Estimado (sin IVA)
            <input type="number" step="any" value={d.estimado_sin_iva} onChange={(e) => set('estimado_sin_iva', e.target.value)} style={inp} />
          </label>
          <label className="text-xs" style={{ color: 'var(--text-subtle)' }}>Real (sin IVA)
            <input type="number" step="any" value={d.real_sin_iva} onChange={(e) => set('real_sin_iva', e.target.value)} style={inp} />
          </label>
          <label className="text-xs" style={{ color: 'var(--text-subtle)' }}>% IVA
            <input type="number" step="any" value={d.iva_porcentaje} onChange={(e) => set('iva_porcentaje', e.target.value)} style={inp} />
          </label>
          <label className="flex items-center gap-2 text-sm mt-5" style={{ color: 'var(--text)' }}>
            <input type="checkbox" checked={d.pagado} onChange={(e) => set('pagado', e.target.checked)} style={{ width: 16, height: 16, accentColor: 'var(--brand-1)' }} />
            Pagado
          </label>
        </div>
        <div className="flex gap-3 justify-end mt-5">
          <button onClick={onCerrar} className="rounded-xl px-4 py-2 font-semibold" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}>Cancelar</button>
          <button onClick={guardar} disabled={guardando} className="marca-gradiente rounded-xl px-4 py-2 font-semibold text-white" style={{ opacity: guardando ? 0.7 : 1 }}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}
