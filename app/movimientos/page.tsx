'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  listarMovimientos, crearMovimiento, fijarStock, cambiarEstadoEquipo,
  listarMateriales, listarEquipos, listarOrdenes, listarTrabajadores,
  type MovimientoConRefs,
} from '@/lib/db/inventario'
import { TIPOS_MOVIMIENTO, labelUnidad, type Material, type Equipo } from '@/lib/inventario'
import { fechaCorta } from '@/lib/dominio'
import { exportarExcel } from '@/lib/export'
import { EstadoVacio, SkeletonLista } from '@/app/components/ui'

const inp: React.CSSProperties = { background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 10, padding: '9px 11px', fontSize: '0.9rem', width: '100%', marginTop: 3 }

export default function MovimientosPage() {
  const [movs, setMovs] = useState<MovimientoConRefs[]>([])
  const [materiales, setMateriales] = useState<Material[]>([])
  const [equipos, setEquipos] = useState<Equipo[]>([])
  const [ordenes, setOrdenes] = useState<{ id: string; codigo: string | null }[]>([])
  const [trabajadores, setTrabajadores] = useState<{ id: string; nombre: string | null }[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [fTipo, setFTipo] = useState('')
  const [fTrab, setFTrab] = useState('')
  const [fItem, setFItem] = useState('')
  const [fDesde, setFDesde] = useState('')
  const [fHasta, setFHasta] = useState('')
  const [registrar, setRegistrar] = useState(false)

  async function cargar() {
    try {
      const [m, mat, eq, ord, tr] = await Promise.all([
        listarMovimientos(), listarMateriales(), listarEquipos(), listarOrdenes(), listarTrabajadores(),
      ])
      setMovs(m); setMateriales(mat); setEquipos(eq); setOrdenes(ord); setTrabajadores(tr)
    } catch (err: any) { setError(err.message || 'Error') }
    finally { setCargando(false) }
  }
  useEffect(() => { cargar() }, [])

  const lista = useMemo(() => movs.filter((m) => {
    if (fTipo && m.tipo !== fTipo) return false
    if (fTrab && m.tecnico_id !== fTrab) return false
    if (fItem) {
      const [k, id] = fItem.split(':')
      if (k === 'mat' && m.material_id !== id) return false
      if (k === 'eq' && m.equipo_id !== id) return false
    }
    if (m.fecha) {
      const f = m.fecha.slice(0, 10)
      if (fDesde && f < fDesde) return false
      if (fHasta && f > fHasta) return false
    }
    return true
  }), [movs, fTipo, fTrab, fItem, fDesde, fHasta])

  function exportar() {
    exportarExcel('movimientos.xlsx', [{
      nombre: 'Movimientos',
      filas: lista.map((m) => ({
        Fecha: m.fecha ? m.fecha.slice(0, 10) : '',
        Tipo: TIPOS_MOVIMIENTO[m.tipo]?.label || m.tipo,
        Objeto: m.materiales?.nombre || (m.equipos ? `Equipo ${m.equipos.codigo}` : ''),
        Cantidad: m.cantidad ?? '',
        OT: m.ordenes?.codigo || '',
        Trabajador: m.perfiles?.nombre || '',
        Observaciones: m.observaciones || '',
      })),
    }])
  }

  return (
    <div>
      <header className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <h1 className="titulo-hero" style={{ color: 'var(--text)' }}>Movimientos</h1>
        <div className="flex gap-2">
          <button onClick={exportar} className="rounded-xl px-3 py-2.5 text-sm font-semibold" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text)' }}>Excel</button>
          <button onClick={() => setRegistrar(true)} className="marca-gradiente inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-white font-semibold" style={{ boxShadow: 'var(--shadow-sm)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
            Registrar
          </button>
        </div>
      </header>

      <div className="card p-3 mb-4 flex flex-wrap gap-2 items-center">
        <select value={fTipo} onChange={(e) => setFTipo(e.target.value)} className="rounded-lg px-2.5 py-2 text-sm" style={{ background: 'var(--bg)', border: `1px solid ${fTipo ? 'var(--brand-1)' : 'var(--border)'}`, color: 'var(--text)' }}>
          <option value="">Todos los tipos</option>
          {Object.entries(TIPOS_MOVIMIENTO).map(([v, o]) => <option key={v} value={v}>{o.label}</option>)}
        </select>
        <select value={fTrab} onChange={(e) => setFTrab(e.target.value)} className="rounded-lg px-2.5 py-2 text-sm" style={{ background: 'var(--bg)', border: `1px solid ${fTrab ? 'var(--brand-1)' : 'var(--border)'}`, color: 'var(--text)' }}>
          <option value="">Todos los trabajadores</option>
          {trabajadores.map((t) => <option key={t.id} value={t.id}>{t.nombre || t.id.slice(0, 8)}</option>)}
        </select>
        <select value={fItem} onChange={(e) => setFItem(e.target.value)} className="rounded-lg px-2.5 py-2 text-sm" style={{ background: 'var(--bg)', border: `1px solid ${fItem ? 'var(--brand-1)' : 'var(--border)'}`, color: 'var(--text)' }}>
          <option value="">Todos los ítems</option>
          <optgroup label="Materiales">{materiales.map((m) => <option key={m.id} value={`mat:${m.id}`}>{m.nombre}</option>)}</optgroup>
          <optgroup label="Equipos">{equipos.map((eq) => <option key={eq.id} value={`eq:${eq.id}`}>{eq.codigo}</option>)}</optgroup>
        </select>
        <input type="date" value={fDesde} onChange={(e) => setFDesde(e.target.value)} title="Desde" className="rounded-lg px-2 py-2 text-sm" style={{ background: 'var(--bg)', border: `1px solid ${fDesde ? 'var(--brand-1)' : 'var(--border)'}`, color: 'var(--text)' }} />
        <input type="date" value={fHasta} onChange={(e) => setFHasta(e.target.value)} title="Hasta" className="rounded-lg px-2 py-2 text-sm" style={{ background: 'var(--bg)', border: `1px solid ${fHasta ? 'var(--brand-1)' : 'var(--border)'}`, color: 'var(--text)' }} />
        {(fTipo || fTrab || fItem || fDesde || fHasta) && <button onClick={() => { setFTipo(''); setFTrab(''); setFItem(''); setFDesde(''); setFHasta('') }} className="text-sm px-2 py-2" style={{ color: 'var(--text-subtle)' }}>Limpiar</button>}
      </div>

      {error && <div className="card p-4 mb-4 text-sm" style={{ color: 'var(--red)' }}>{error}</div>}

      {cargando ? <SkeletonLista /> : lista.length === 0 ? (
        <EstadoVacio titulo="Sin movimientos" texto="Registra entradas, consumos, salidas o ajustes." />
      ) : (
        <div className="flex flex-col gap-2">
          {lista.map((m) => {
            const t = TIPOS_MOVIMIENTO[m.tipo] || { label: m.tipo, color: 'var(--text-muted)', icono: '📋' }
            const objeto = m.materiales?.nombre || (m.equipos ? `Equipo ${m.equipos.codigo}` : '—')
            return (
              <div key={m.id} className="card p-3 flex items-center gap-3">
                <span className="text-2xl shrink-0">{t.icono}</span>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold truncate" style={{ color: 'var(--text)' }}>{objeto}</div>
                  <div className="text-xs flex items-center gap-2 flex-wrap" style={{ color: 'var(--text-muted)' }}>
                    <span style={{ color: t.color, fontWeight: 600 }}>{t.label}</span>
                    {m.cantidad != null && <span>· {m.cantidad} {labelUnidad(m.materiales?.unidad)}</span>}
                    {m.ordenes?.codigo && <span>· OT {m.ordenes.codigo}</span>}
                    {m.perfiles?.nombre && <span>· {m.perfiles.nombre}</span>}
                    <span>· {fechaCorta(m.fecha)}</span>
                  </div>
                  {m.observaciones && <div className="text-xs mt-0.5" style={{ color: 'var(--text-subtle)' }}>{m.observaciones}</div>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {registrar && (
        <RegistrarMov
          materiales={materiales} equipos={equipos} ordenes={ordenes} trabajadores={trabajadores}
          onCerrar={() => setRegistrar(false)} onHecho={() => { setRegistrar(false); cargar() }}
        />
      )}
    </div>
  )
}

function RegistrarMov({ materiales, equipos, ordenes, trabajadores, onCerrar, onHecho }: {
  materiales: Material[]; equipos: Equipo[]; ordenes: { id: string; codigo: string | null }[]; trabajadores: { id: string; nombre: string | null }[]
  onCerrar: () => void; onHecho: () => void
}) {
  const [modo, setModo] = useState<'material' | 'equipo'>('material')
  const [materialId, setMaterialId] = useState('')
  const [equipoId, setEquipoId] = useState('')
  const [tipo, setTipo] = useState<'entrada' | 'consumo'>('entrada')
  const [cantidad, setCantidad] = useState('1')
  const [ordenId, setOrdenId] = useState('')
  const [tecnicoId, setTecnicoId] = useState('')
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10))
  const [obs, setObs] = useState('')
  const [guardando, setGuardando] = useState(false)

  async function guardar() {
    const cant = parseFloat(cantidad) || 0
    if (modo === 'material' && !materialId) return
    if (modo === 'equipo' && !equipoId) return
    setGuardando(true)
    try {
      const tipoMov = modo === 'equipo' ? 'salida' : tipo
      await crearMovimiento({
        tipo: tipoMov,
        material_id: modo === 'material' ? materialId : null,
        equipo_id: modo === 'equipo' ? equipoId : null,
        orden_id: ordenId || null,
        tecnico_id: tecnicoId || null,
        cantidad: cant,
        observaciones: obs || null,
        fecha: new Date(fecha).toISOString(),
      })
      if (modo === 'material') {
        const mat = materiales.find((x) => x.id === materialId)
        const actual = mat?.stock ?? 0
        const nuevo = Math.max(0, tipo === 'entrada' ? actual + cant : actual - cant)
        await fijarStock(materialId, nuevo)
      } else {
        await cambiarEstadoEquipo(equipoId, 'en_cliente')
      }
      onHecho()
    } catch { setGuardando(false) }
  }

  const Lbl = ({ children }: { children: React.ReactNode }) => <span className="text-xs font-medium" style={{ color: 'var(--text-subtle)' }}>{children}</span>

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center md:p-4" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={onCerrar}>
      <div className="w-full md:max-w-md rounded-t-2xl md:rounded-2xl p-5" style={{ background: 'var(--bg-card)', maxHeight: '92vh', overflowY: 'auto', boxShadow: 'var(--shadow-lg)' }} onClick={(e) => e.stopPropagation()}>
        <h3 className="font-semibold mb-4" style={{ color: 'var(--text)' }}>Registrar movimiento</h3>

        <div className="inline-flex rounded-xl p-1 mb-3" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)' }}>
          {(['material', 'equipo'] as const).map((mo) => (
            <button key={mo} onClick={() => setModo(mo)} className="px-3 py-1.5 rounded-lg text-sm font-semibold capitalize" style={{ background: modo === mo ? 'var(--bg-card)' : 'transparent', color: modo === mo ? 'var(--brand-1)' : 'var(--text-muted)' }}>{mo}</button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          {modo === 'material' ? (
            <>
              <label className="col-span-2"><Lbl>Material</Lbl>
                <select value={materialId} onChange={(e) => setMaterialId(e.target.value)} style={inp}>
                  <option value="">Selecciona…</option>
                  {materiales.map((m) => <option key={m.id} value={m.id}>{m.nombre} ({m.stock ?? 0} {labelUnidad(m.unidad)})</option>)}
                </select>
              </label>
              <label><Lbl>Tipo</Lbl>
                <select value={tipo} onChange={(e) => setTipo(e.target.value as any)} style={inp}>
                  <option value="entrada">Entrada (+)</option>
                  <option value="consumo">Consumo (−)</option>
                </select>
              </label>
            </>
          ) : (
            <label className="col-span-2"><Lbl>Equipo (salida)</Lbl>
              <select value={equipoId} onChange={(e) => setEquipoId(e.target.value)} style={inp}>
                <option value="">Selecciona…</option>
                {equipos.map((eq) => <option key={eq.id} value={eq.id}>{eq.codigo}</option>)}
              </select>
            </label>
          )}
          <label><Lbl>Cantidad</Lbl><input type="number" step="any" value={cantidad} onChange={(e) => setCantidad(e.target.value)} style={inp} /></label>
          <label><Lbl>OT (orden)</Lbl>
            <select value={ordenId} onChange={(e) => setOrdenId(e.target.value)} style={inp}>
              <option value="">Sin OT</option>
              {ordenes.map((o) => <option key={o.id} value={o.id}>{o.codigo || o.id.slice(0, 8)}</option>)}
            </select>
          </label>
          <label><Lbl>Trabajador</Lbl>
            <select value={tecnicoId} onChange={(e) => setTecnicoId(e.target.value)} style={inp}>
              <option value="">Sin asignar</option>
              {trabajadores.map((t) => <option key={t.id} value={t.id}>{t.nombre || t.id.slice(0, 8)}</option>)}
            </select>
          </label>
          <label><Lbl>Fecha</Lbl><input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} style={inp} /></label>
          <label className="col-span-2"><Lbl>Observaciones</Lbl><input value={obs} onChange={(e) => setObs(e.target.value)} style={inp} /></label>
        </div>

        <div className="flex gap-3 justify-end mt-5">
          <button onClick={onCerrar} className="rounded-xl px-4 py-2 font-semibold" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}>Cancelar</button>
          <button onClick={guardar} disabled={guardando} className="marca-gradiente rounded-xl px-4 py-2 font-semibold text-white" style={{ opacity: guardando ? 0.7 : 1 }}>{guardando ? 'Guardando…' : 'Registrar'}</button>
        </div>
      </div>
    </div>
  )
}
