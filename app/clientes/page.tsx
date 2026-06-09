'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { listarClientes, guardarCliente } from '@/lib/db/clientes'
import { EMPRESAS, labelEmpresa, normalizar, textoBusqueda, type Cliente } from '@/lib/clientes'
import { EstadoVacio, SkeletonLista } from '@/app/components/ui'

const POR_PAGINA = 50
const inp: React.CSSProperties = { background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 10, padding: '9px 11px', fontSize: '0.9rem', width: '100%', marginTop: 3 }

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [q, setQ] = useState('')
  const [empresa, setEmpresa] = useState('todos')
  const [pagina, setPagina] = useState(0)
  const [nuevo, setNuevo] = useState(false)

  async function cargar() {
    try { setClientes(await listarClientes()) }
    catch (e: any) { setError(e.message || 'Error') }
    finally { setCargando(false) }
  }
  useEffect(() => { cargar() }, [])

  const filtrados = useMemo(() => {
    const tokens = normalizar(q).split(/\s+/).filter(Boolean)
    return clientes.filter((c) => {
      if (empresa !== 'todos' && (c.empresa || '') !== empresa) return false
      if (tokens.length) {
        const blob = textoBusqueda(c)
        if (!tokens.every((t) => blob.includes(t))) return false
      }
      return true
    })
  }, [clientes, q, empresa])

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA))
  const paginaSegura = Math.min(pagina, totalPaginas - 1)
  const visibles = filtrados.slice(paginaSegura * POR_PAGINA, (paginaSegura + 1) * POR_PAGINA)

  // Resetear página al cambiar filtros.
  useEffect(() => { setPagina(0) }, [q, empresa])

  return (
    <div>
      <header className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div>
          <h1 className="titulo-hero" style={{ color: 'var(--text)' }}>Clientes</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>{cargando ? 'Cargando…' : `${filtrados.length} de ${clientes.length}`}</p>
        </div>
        <button onClick={() => setNuevo(true)} className="marca-gradiente inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-white font-semibold" style={{ boxShadow: 'var(--shadow-sm)' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          Nuevo cliente
        </button>
      </header>

      <div className="flex flex-wrap gap-2 items-center mb-4">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre, CIF, población, teléfono…" className="flex-1 min-w-[200px] rounded-lg px-3 py-2 text-sm" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text)' }} />
        <select value={empresa} onChange={(e) => setEmpresa(e.target.value)} className="rounded-lg px-2.5 py-2 text-sm" style={{ background: 'var(--bg-card)', border: `1px solid ${empresa !== 'todos' ? 'var(--brand-1)' : 'var(--border)'}`, color: 'var(--text)' }}>
          {EMPRESAS.map((e) => <option key={e.valor} value={e.valor}>{e.label}</option>)}
        </select>
      </div>

      {error && <div className="card p-4 mb-4 text-sm" style={{ color: 'var(--red)' }}>{error}</div>}

      {cargando ? <SkeletonLista /> : visibles.length === 0 ? (
        <EstadoVacio titulo="Sin clientes" texto={clientes.length ? 'Prueba con otra búsqueda.' : 'Crea el primero.'} />
      ) : (
        <>
          <div className="flex flex-col gap-2">
            {visibles.map((c, i) => (
              <Link key={c.id} href={`/clientes/${c.id}`} className="card card-hover p-3.5 flex items-center gap-3">
                <span className="shrink-0 text-sm font-semibold tabular-nums text-right" style={{ width: 48, color: 'var(--text-subtle)' }}>
                  {paginaSegura * POR_PAGINA + i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold truncate" style={{ color: 'var(--text)' }}>{c.nombre}</span>
                    {c.empresa && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'var(--bg-subtle)', color: 'var(--text-muted)' }}>{labelEmpresa(c.empresa)}</span>}
                  </div>
                  <div className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                    {[c.cif, c.poblacion, c.telefono || c.movil].filter(Boolean).join(' · ') || c.nombre_fiscal || '—'}
                  </div>
                </div>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-subtle)" strokeWidth="2" strokeLinecap="round" className="shrink-0"><path d="m9 18 6-6-6-6" /></svg>
              </Link>
            ))}
          </div>

          {totalPaginas > 1 && (
            <div className="flex items-center justify-center gap-3 mt-5">
              <button disabled={paginaSegura === 0} onClick={() => setPagina((p) => Math.max(0, p - 1))} className="rounded-lg px-3 py-2 text-sm font-semibold" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: paginaSegura === 0 ? 'var(--text-subtle)' : 'var(--text)', opacity: paginaSegura === 0 ? 0.5 : 1 }}>Anterior</button>
              <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Página {paginaSegura + 1} de {totalPaginas}</span>
              <button disabled={paginaSegura >= totalPaginas - 1} onClick={() => setPagina((p) => Math.min(totalPaginas - 1, p + 1))} className="rounded-lg px-3 py-2 text-sm font-semibold" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: paginaSegura >= totalPaginas - 1 ? 'var(--text-subtle)' : 'var(--text)', opacity: paginaSegura >= totalPaginas - 1 ? 0.5 : 1 }}>Siguiente</button>
            </div>
          )}
        </>
      )}

      {nuevo && <ClienteForm onCerrar={() => setNuevo(false)} onGuardado={() => { setNuevo(false); cargar() }} />}
    </div>
  )
}

export function ClienteForm({ cliente, onCerrar, onGuardado }: { cliente?: Cliente | null; onCerrar: () => void; onGuardado: () => void }) {
  const [d, setD] = useState({
    nombre: cliente?.nombre ?? '', nombre_fiscal: cliente?.nombre_fiscal ?? '', cif: cliente?.cif ?? '',
    direccion: cliente?.direccion ?? '', poblacion: cliente?.poblacion ?? '', telefono: cliente?.telefono ?? '',
    movil: cliente?.movil ?? '', email: cliente?.email ?? '', notas: cliente?.notas ?? '', empresa: cliente?.empresa ?? 'teros',
  })
  const [guardando, setGuardando] = useState(false)
  const [err, setErr] = useState('')
  const set = (k: string, v: any) => setD((p) => ({ ...p, [k]: v }))
  async function guardar() {
    if (!d.nombre.trim()) { setErr('El nombre es obligatorio.'); return }
    setGuardando(true)
    try {
      await guardarCliente(cliente?.id ?? null, {
        nombre: d.nombre, nombre_fiscal: d.nombre_fiscal || null, cif: d.cif || null, direccion: d.direccion || null,
        poblacion: d.poblacion || null, telefono: d.telefono || null, movil: d.movil || null, email: d.email || null,
        notas: d.notas || null, empresa: d.empresa || null,
      })
      onGuardado()
    } catch (e: any) { setErr(e.message || 'Error al guardar'); setGuardando(false) }
  }
  const L = ({ children }: { children: React.ReactNode }) => <span className="text-xs font-medium" style={{ color: 'var(--text-subtle)' }}>{children}</span>
  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center md:p-4" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={onCerrar}>
      <div className="w-full md:max-w-lg rounded-t-2xl md:rounded-2xl p-5" style={{ background: 'var(--bg-card)', maxHeight: '92vh', overflowY: 'auto', boxShadow: 'var(--shadow-lg)' }} onClick={(e) => e.stopPropagation()}>
        <h3 className="font-semibold mb-4" style={{ color: 'var(--text)' }}>{cliente ? 'Editar cliente' : 'Nuevo cliente'}</h3>
        {err && <div className="text-sm mb-3 rounded-lg px-3 py-2" style={{ background: 'color-mix(in srgb, var(--red) 10%, transparent)', color: 'var(--red)' }}>{err}</div>}
        <div className="grid grid-cols-2 gap-3">
          <label className="col-span-2"><L>Nombre comercial</L><input value={d.nombre} onChange={(e) => set('nombre', e.target.value)} style={inp} /></label>
          <label className="col-span-2"><L>Nombre fiscal</L><input value={d.nombre_fiscal} onChange={(e) => set('nombre_fiscal', e.target.value)} style={inp} /></label>
          <label><L>CIF</L><input value={d.cif} onChange={(e) => set('cif', e.target.value)} style={inp} /></label>
          <label><L>Empresa</L><select value={d.empresa} onChange={(e) => set('empresa', e.target.value)} style={inp}><option value="teros">Teros</option><option value="olipro">Olipro</option></select></label>
          <label className="col-span-2"><L>Dirección</L><input value={d.direccion} onChange={(e) => set('direccion', e.target.value)} style={inp} /></label>
          <label><L>Población</L><input value={d.poblacion} onChange={(e) => set('poblacion', e.target.value)} style={inp} /></label>
          <label><L>Teléfono</L><input value={d.telefono} onChange={(e) => set('telefono', e.target.value)} style={inp} /></label>
          <label><L>Móvil</L><input value={d.movil} onChange={(e) => set('movil', e.target.value)} style={inp} /></label>
          <label><L>Email</L><input value={d.email} onChange={(e) => set('email', e.target.value)} style={inp} /></label>
          <label className="col-span-2"><L>Notas</L><input value={d.notas} onChange={(e) => set('notas', e.target.value)} style={inp} /></label>
        </div>
        <div className="flex gap-3 justify-end mt-5">
          <button onClick={onCerrar} className="rounded-xl px-4 py-2 font-semibold" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}>Cancelar</button>
          <button onClick={guardar} disabled={guardando} className="marca-gradiente rounded-xl px-4 py-2 font-semibold text-white" style={{ opacity: guardando ? 0.7 : 1 }}>{guardando ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </div>
    </div>
  )
}
