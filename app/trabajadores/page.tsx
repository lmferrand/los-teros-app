'use client'

import { useEffect, useState } from 'react'
import { useSesion } from '@/lib/sesion'
import { listarPerfiles, actualizarPerfil, crearTrabajador, eliminarTrabajador, listarEmails, restablecerPassword } from '@/lib/db/trabajadores'
import { ROLES, labelRol, colorRol, generarPassword, type Trabajador } from '@/lib/trabajadores'
import { EstadoVacio, SkeletonLista } from '@/app/components/ui'

const inp: React.CSSProperties = { background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 10, padding: '9px 11px', fontSize: '0.9rem', width: '100%', marginTop: 3 }
const PUEDE_GESTIONAR = ['gerente', 'oficina', 'supervisor']

export default function TrabajadoresPage() {
  const { perfil } = useSesion()
  const [trabajadores, setTrabajadores] = useState<Trabajador[]>([])
  const [emails, setEmails] = useState<Record<string, string | undefined>>({})
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [nuevo, setNuevo] = useState(false)
  const [editar, setEditar] = useState<Trabajador | null>(null)
  const [reset, setReset] = useState<Trabajador | null>(null)

  async function cargar() {
    try {
      const [ps, em] = await Promise.all([listarPerfiles(), listarEmails()])
      setTrabajadores(ps); setEmails(em)
    }
    catch (e: any) { setError(e.message || 'Error') }
    finally { setCargando(false) }
  }
  useEffect(() => { cargar() }, [])

  const gestor = !perfil || PUEDE_GESTIONAR.includes(perfil.rol || '')

  async function cambiarRol(id: string, rol: string) {
    await actualizarPerfil(id, { rol })
    cargar()
  }
  async function eliminar(t: Trabajador) {
    if (!confirm(`¿Eliminar a ${t.nombre}? Se borra su acceso a la app.`)) return
    try { await eliminarTrabajador(t.id); cargar() }
    catch (e: any) { alert(e.message) }
  }

  return (
    <div>
      <header className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div>
          <h1 className="titulo-hero" style={{ color: 'var(--text)' }}>Trabajadores</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>{cargando ? 'Cargando…' : `${trabajadores.length} usuarios`}</p>
        </div>
        {gestor && (
          <button onClick={() => setNuevo(true)} className="marca-gradiente inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-white font-semibold" style={{ boxShadow: 'var(--shadow-sm)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
            Nuevo trabajador
          </button>
        )}
      </header>

      {error && <div className="card p-4 mb-4 text-sm" style={{ color: 'var(--red)' }}>{error}</div>}

      {cargando ? <SkeletonLista /> : trabajadores.length === 0 ? (
        <EstadoVacio titulo="Sin trabajadores" texto="Crea el primero." />
      ) : (
        <div className="flex flex-col gap-2">
          {trabajadores.map((t) => (
            <div key={t.id} className="card p-3.5 flex items-center gap-3">
              <div className="grid place-items-center rounded-full shrink-0 font-semibold text-white" style={{ width: 40, height: 40, background: colorRol(t.rol) }}>
                {(t.nombre || '?').split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold truncate" style={{ color: 'var(--text)' }}>{t.nombre}</div>
                <div className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                  {emails[t.id] || 'sin email'}{t.telefono ? ` · ${t.telefono}` : ''}{t.activo === false ? ' · inactivo' : ''}
                </div>
              </div>
              {gestor ? (
                <select value={t.rol || ''} onChange={(e) => cambiarRol(t.id, e.target.value)} className="text-xs rounded-lg px-2 py-1.5" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}>
                  {ROLES.map((r) => <option key={r.valor} value={r.valor}>{r.label}</option>)}
                </select>
              ) : (
                <span className="text-xs font-semibold rounded-full px-2.5 py-1" style={{ background: `color-mix(in srgb, ${colorRol(t.rol)} 14%, transparent)`, color: colorRol(t.rol) }}>{labelRol(t.rol)}</span>
              )}
              {gestor && (
                <div className="flex gap-1.5">
                  <button onClick={() => setReset(t)} className="text-xs font-semibold rounded-lg px-2.5 py-1.5" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--brand-1)' }} title="Restablecer contraseña">🔑</button>
                  <button onClick={() => setEditar(t)} className="text-xs font-semibold rounded-lg px-2.5 py-1.5" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}>Editar</button>
                  <button onClick={() => eliminar(t)} className="text-xs font-semibold rounded-lg px-2.5 py-1.5" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--red)' }}>×</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {nuevo && <NuevoForm onCerrar={() => setNuevo(false)} onCreado={() => { setNuevo(false); cargar() }} />}
      {editar && <EditarForm trabajador={editar} onCerrar={() => setEditar(null)} onGuardado={() => { setEditar(null); cargar() }} />}
      {reset && <ResetForm trabajador={reset} email={emails[reset.id]} onCerrar={() => setReset(null)} />}
    </div>
  )
}

function ResetForm({ trabajador, email, onCerrar }: { trabajador: Trabajador; email?: string; onCerrar: () => void }) {
  const [password, setPassword] = useState(generarPassword())
  const [guardando, setGuardando] = useState(false)
  const [hecho, setHecho] = useState(false)
  const [err, setErr] = useState('')
  async function aplicar() {
    setGuardando(true); setErr('')
    try { await restablecerPassword(trabajador.id, password); setHecho(true) }
    catch (e: any) { setErr(e.message); setGuardando(false) }
  }
  return (
    <Modal titulo={`Contraseña · ${trabajador.nombre}`} onCerrar={onCerrar}>
      {err && <div className="text-sm mb-3 rounded-lg px-3 py-2" style={{ background: 'color-mix(in srgb, var(--red) 10%, transparent)', color: 'var(--red)' }}>{err}</div>}
      <div className="rounded-xl p-3 mb-3" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
        <div className="text-sm" style={{ color: 'var(--text)' }}><b>Usuario:</b> {email || '—'}</div>
      </div>
      <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>La contraseña actual no se puede ver (está cifrada). Aquí puedes ponerle una nueva y compartirla.</p>
      {hecho ? (
        <div className="rounded-xl p-3 mb-4" style={{ background: 'color-mix(in srgb, var(--green) 8%, var(--bg))', border: '1px solid var(--green)' }}>
          <div className="text-sm font-semibold mb-1" style={{ color: 'var(--green)' }}>Contraseña actualizada ✓</div>
          <div className="text-sm" style={{ color: 'var(--text)' }}><b>Usuario:</b> {email || '—'}</div>
          <div className="text-sm" style={{ color: 'var(--text)' }}><b>Nueva contraseña:</b> <span style={{ fontFamily: 'monospace' }}>{password}</span></div>
          <BotonCopiar texto={`Usuario: ${email || ''}\nContraseña: ${password}`} />
        </div>
      ) : (
        <div className="flex gap-2 mb-2">
          <input value={password} onChange={(e) => setPassword(e.target.value)} style={{ ...inp, fontFamily: 'monospace', marginTop: 0 }} />
          <button type="button" onClick={() => setPassword(generarPassword())} className="rounded-lg px-3 text-sm font-semibold whitespace-nowrap" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--brand-1)' }}>Generar</button>
        </div>
      )}
      <div className="flex gap-3 justify-end mt-4">
        <button onClick={onCerrar} className="rounded-xl px-4 py-2 font-semibold" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}>{hecho ? 'Cerrar' : 'Cancelar'}</button>
        {!hecho && <button onClick={aplicar} disabled={guardando} className="marca-gradiente rounded-xl px-4 py-2 font-semibold text-white" style={{ opacity: guardando ? 0.7 : 1 }}>{guardando ? 'Aplicando…' : 'Restablecer'}</button>}
      </div>
    </Modal>
  )
}

const L = ({ children }: { children: React.ReactNode }) => <span className="text-xs font-medium" style={{ color: 'var(--text-subtle)' }}>{children}</span>

function BotonCopiar({ texto }: { texto: string }) {
  const [copiado, setCopiado] = useState(false)
  async function copiar() {
    try { await navigator.clipboard.writeText(texto); setCopiado(true); setTimeout(() => setCopiado(false), 1800) } catch { /* noop */ }
  }
  return (
    <button onClick={copiar} className="text-xs font-semibold rounded-lg px-3 py-1.5 mt-2" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: copiado ? 'var(--green)' : 'var(--brand-1)' }}>
      {copiado ? 'Copiado ✓' : 'Copiar credenciales'}
    </button>
  )
}
function Modal({ titulo, children, onCerrar }: { titulo: string; children: React.ReactNode; onCerrar: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center md:p-4" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={onCerrar}>
      <div className="w-full md:max-w-md rounded-t-2xl md:rounded-2xl p-5" style={{ background: 'var(--bg-card)', maxHeight: '92vh', overflowY: 'auto', boxShadow: 'var(--shadow-lg)' }} onClick={(e) => e.stopPropagation()}>
        <h3 className="font-semibold mb-4" style={{ color: 'var(--text)' }}>{titulo}</h3>
        {children}
      </div>
    </div>
  )
}

function NuevoForm({ onCerrar, onCreado }: { onCerrar: () => void; onCreado: () => void }) {
  const [d, setD] = useState({ nombre: '', email: '', telefono: '', rol: 'tecnico', password: generarPassword() })
  const [guardando, setGuardando] = useState(false)
  const [err, setErr] = useState('')
  const [hecho, setHecho] = useState<{ email: string; password: string } | null>(null)
  const set = (k: string, v: any) => setD((p) => ({ ...p, [k]: v }))

  async function crear() {
    if (!d.nombre.trim() || !d.email.trim() || !d.password) { setErr('Nombre, email y contraseña son obligatorios.'); return }
    setGuardando(true); setErr('')
    try {
      await crearTrabajador({ email: d.email.trim(), password: d.password, nombre: d.nombre, rol: d.rol, telefono: d.telefono })
      setHecho({ email: d.email.trim(), password: d.password })
    } catch (e: any) { setErr(e.message); setGuardando(false) }
  }

  if (hecho) {
    return (
      <Modal titulo="Trabajador creado ✓" onCerrar={onCreado}>
        <p className="text-sm mb-3" style={{ color: 'var(--text-muted)' }}>Comparte estas credenciales con el trabajador (puede cambiar la contraseña luego):</p>
        <div className="rounded-xl p-3 mb-4" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
          <div className="text-sm" style={{ color: 'var(--text)' }}><b>Email:</b> {hecho.email}</div>
          <div className="text-sm mt-1" style={{ color: 'var(--text)' }}><b>Contraseña:</b> <span style={{ fontFamily: 'monospace' }}>{hecho.password}</span></div>
          <BotonCopiar texto={`Usuario: ${hecho.email}\nContraseña: ${hecho.password}`} />
        </div>
        <div className="flex justify-end">
          <button onClick={onCreado} className="marca-gradiente rounded-xl px-4 py-2 font-semibold text-white">Hecho</button>
        </div>
      </Modal>
    )
  }

  return (
    <Modal titulo="Nuevo trabajador" onCerrar={onCerrar}>
      {err && <div className="text-sm mb-3 rounded-lg px-3 py-2" style={{ background: 'color-mix(in srgb, var(--red) 10%, transparent)', color: 'var(--red)' }}>{err}</div>}
      <div className="grid grid-cols-2 gap-3">
        <label className="col-span-2"><L>Nombre</L><input value={d.nombre} onChange={(e) => set('nombre', e.target.value)} style={inp} /></label>
        <label className="col-span-2"><L>Email</L><input type="email" value={d.email} onChange={(e) => set('email', e.target.value)} style={inp} /></label>
        <label><L>Rol</L><select value={d.rol} onChange={(e) => set('rol', e.target.value)} style={inp}>{ROLES.map((r) => <option key={r.valor} value={r.valor}>{r.label}</option>)}</select></label>
        <label><L>Teléfono</L><input value={d.telefono} onChange={(e) => set('telefono', e.target.value)} style={inp} /></label>
        <div className="col-span-2">
          <L>Contraseña</L>
          <div className="flex gap-2">
            <input value={d.password} onChange={(e) => set('password', e.target.value)} style={{ ...inp, fontFamily: 'monospace' }} />
            <button type="button" onClick={() => set('password', generarPassword())} className="rounded-lg px-3 mt-[3px] text-sm font-semibold whitespace-nowrap" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--brand-1)' }}>Generar</button>
          </div>
        </div>
      </div>
      <div className="flex gap-3 justify-end mt-5">
        <button onClick={onCerrar} className="rounded-xl px-4 py-2 font-semibold" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}>Cancelar</button>
        <button onClick={crear} disabled={guardando} className="marca-gradiente rounded-xl px-4 py-2 font-semibold text-white" style={{ opacity: guardando ? 0.7 : 1 }}>{guardando ? 'Creando…' : 'Crear'}</button>
      </div>
    </Modal>
  )
}

function EditarForm({ trabajador, onCerrar, onGuardado }: { trabajador: Trabajador; onCerrar: () => void; onGuardado: () => void }) {
  const [d, setD] = useState({ nombre: trabajador.nombre, rol: trabajador.rol, telefono: trabajador.telefono ?? '' })
  const [guardando, setGuardando] = useState(false)
  const set = (k: string, v: any) => setD((p) => ({ ...p, [k]: v }))
  async function guardar() {
    setGuardando(true)
    try { await actualizarPerfil(trabajador.id, { nombre: d.nombre, rol: d.rol, telefono: d.telefono || null }); onGuardado() }
    catch { setGuardando(false) }
  }
  return (
    <Modal titulo="Editar trabajador" onCerrar={onCerrar}>
      <div className="grid grid-cols-2 gap-3">
        <label className="col-span-2"><L>Nombre</L><input value={d.nombre} onChange={(e) => set('nombre', e.target.value)} style={inp} /></label>
        <label><L>Rol</L><select value={d.rol} onChange={(e) => set('rol', e.target.value)} style={inp}>{ROLES.map((r) => <option key={r.valor} value={r.valor}>{r.label}</option>)}</select></label>
        <label><L>Teléfono</L><input value={d.telefono} onChange={(e) => set('telefono', e.target.value)} style={inp} /></label>
      </div>
      <div className="flex gap-3 justify-end mt-5">
        <button onClick={onCerrar} className="rounded-xl px-4 py-2 font-semibold" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}>Cancelar</button>
        <button onClick={guardar} disabled={guardando} className="marca-gradiente rounded-xl px-4 py-2 font-semibold text-white" style={{ opacity: guardando ? 0.7 : 1 }}>{guardando ? 'Guardando…' : 'Guardar'}</button>
      </div>
    </Modal>
  )
}
