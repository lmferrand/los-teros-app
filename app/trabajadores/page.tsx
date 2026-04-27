'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { s } from '@/lib/styles'
import AppHeader from '@/app/components/AppHeader'

export default function Trabajadores() {
  const [trabajadores, setTrabajadores] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [accesoDenegado, setAccesoDenegado] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [mensajeExito, setMensajeExito] = useState('')
  const router = useRouter()

  const [nombre, setNombre] = useState('')
  const [rol, setRol] = useState('tecnico')
  const [telefono, setTelefono] = useState('')
  const [email, setEmail] = useState('')

  const cargarTrabajadores = useCallback(async () => {
    const { data, error } = await supabase
      .from('perfiles')
      .select('id, nombre, rol, telefono, activo')
      .order('nombre')
    if (error) {
      alert('No se pudo cargar la lista de trabajadores: ' + error.message)
      setLoading(false)
      return
    }
    if (data) setTrabajadores(data)
    setLoading(false)
  }, [])

  const verificarSesion = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }
    const { data } = await supabase
      .from('perfiles')
      .select('rol')
      .eq('id', session.user.id)
      .single()
    if (data?.rol !== 'gerente' && data?.rol !== 'oficina' && data?.rol !== 'supervisor') {
      setAccesoDenegado(true); setLoading(false); return
    }
    void cargarTrabajadores()
  }, [router, cargarTrabajadores])

  useEffect(() => { void verificarSesion() }, [verificarSesion])

  function abrirFormNuevo() {
    setEditandoId(null); setNombre(''); setRol('tecnico')
    setTelefono(''); setEmail(''); setMensajeExito(''); setMostrarForm(true)
  }

  function abrirFormEditar(t: any) {
    setEditandoId(t.id); setNombre(t.nombre || ''); setRol(t.rol || 'tecnico')
    setTelefono(t.telefono || ''); setEmail(''); setMensajeExito(''); setMostrarForm(true)
  }

  async function guardarTrabajador(e: React.FormEvent) {
    e.preventDefault()
    if (editandoId) {
      const { error } = await supabase.from('perfiles').update({ nombre, rol, telefono }).eq('id', editandoId)
      if (error) {
        alert('No se pudo guardar este trabajador: ' + error.message)
        return
      }
      setMostrarForm(false); setEditandoId(null); cargarTrabajadores(); return
    }
    setEnviando(true)
    const res = await fetch('/api/invitar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, nombre, rol }),
    })
    const data = await res.json()
    if (data.error) {
      alert('Error: ' + data.error)
      setEnviando(false)
      return
    }
    setMensajeExito(`Invitacion enviada a ${email}. El trabajador recibira un email para crear su contrasena y acceder a la app.`)
    setEnviando(false); setNombre(''); setEmail(''); setTelefono(''); setRol('tecnico')
    cargarTrabajadores()
  }

  async function cambiarRol(id: string, nuevoRol: string) {
    const { error } = await supabase.from('perfiles').update({ rol: nuevoRol }).eq('id', id)
    if (error) {
      alert('No se pudo cambiar el rol: ' + error.message)
      return
    }
    cargarTrabajadores()
  }

  async function eliminarTrabajador(id: string, nombre: string) {
    if (!confirm(`Eliminar a ${nombre}?`)) return
    const { error } = await supabase.from('perfiles').delete().eq('id', id)
    if (error) {
      alert('No se pudo eliminar el trabajador: ' + error.message)
      return
    }
    cargarTrabajadores()
  }

  const ROLES: any = {
    gerente: { label: 'Gerente', color: '#a78bfa', bg: 'rgba(124,58,237,0.15)' },
    oficina: { label: 'Oficina', color: '#06b6d4', bg: 'rgba(6,182,212,0.15)' },
    tecnico: { label: 'Tecnico', color: '#34d399', bg: 'rgba(16,185,129,0.15)' },
    almacen: { label: 'Almacen', color: '#fbbf24', bg: 'rgba(234,179,8,0.15)' },
    supervisor: { label: 'Supervisor', color: '#fb923c', bg: 'rgba(249,115,22,0.15)' },
  }

  const INICIALES = (nombre: string) =>
    nombre?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || '?'

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
      <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#7c3aed', borderTopColor: 'transparent' }}></div>
    </div>
  )

  if (accesoDenegado) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
      <div className="text-center">
        <p className="text-5xl mb-4">🔒</p>
        <p className="font-semibold mb-2" style={{ color: 'var(--text)' }}>Acceso restringido</p>
        <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>Solo gerentes y oficina pueden ver este modulo.</p>
        <Link href="/dashboard" className="text-sm px-6 py-2 rounded-xl font-medium" style={s.btnPrimary}>
          Volver al inicio
        </Link>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <AppHeader
        title="Trabajadores"
        rightSlot={
          <button onClick={abrirFormNuevo} className="text-sm px-4 py-2 rounded-xl font-medium" style={s.btnPrimary}>
            + Nuevo trabajador
          </button>
        }
      />

      <div className="p-6 max-w-5xl mx-auto">
        {mostrarForm && (
          <div className="rounded-2xl p-6 mb-6" style={s.cardStyle}>
            <h2 className="font-semibold mb-5" style={{ color: 'var(--text)' }}>
              {editandoId ? 'Editar trabajador' : 'Invitar nuevo trabajador'}
            </h2>
            {mensajeExito ? (
              <div className="rounded-2xl p-4" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
                <p className="text-sm" style={{ color: '#34d399' }}>{mensajeExito}</p>
                <button onClick={() => { setMostrarForm(false); setMensajeExito('') }}
                  className="mt-3 text-sm px-4 py-2 rounded-xl"
                  style={{ background: 'rgba(16,185,129,0.2)', color: '#34d399' }}>
                  Cerrar
                </button>
              </div>
            ) : (
              <form onSubmit={guardarTrabajador} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-muted)' }}>Nombre completo</label>
                  <input value={nombre} onChange={e => setNombre(e.target.value)} required
                    className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={s.inputStyle}
                    placeholder="Jose Antonio Garcia" />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-muted)' }}>Rol</label>
                  <select value={rol} onChange={e => setRol(e.target.value)} className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={s.inputStyle}>
                    <option value="gerente">Gerente</option>
                    <option value="oficina">Oficina</option>
                    <option value="supervisor">Supervisor</option>
                    <option value="tecnico">Tecnico</option>
                    <option value="almacen">Almacen</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-muted)' }}>Telefono</label>
                  <input value={telefono} onChange={e => setTelefono(e.target.value)}
                    className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={s.inputStyle}
                    placeholder="600 000 000" />
                </div>
                {!editandoId && (
                  <div>
                    <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-muted)' }}>Email</label>
                    <input value={email} onChange={e => setEmail(e.target.value)} type="email" required
                      className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={s.inputStyle}
                      placeholder="trabajador@email.com" />
                  </div>
                )}
                {!editandoId && (
                  <div className="md:col-span-2 rounded-2xl p-3" style={{ background: 'rgba(6,182,212,0.05)', border: '1px solid rgba(6,182,212,0.15)' }}>
                    <p className="text-xs font-semibold mb-1" style={{ color: '#06b6d4' }}>Como funciona</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>El trabajador recibira un email para crear su contrasena. A partir de ahi podra entrar siempre con email y contrasena.</p>
                  </div>
                )}
                <div className="md:col-span-2 flex gap-3">
                  <button type="submit" disabled={enviando} className="px-5 py-2 rounded-xl text-sm font-medium disabled:opacity-50" style={s.btnPrimary}>
                    {enviando ? 'Enviando...' : editandoId ? 'Guardar cambios' : 'Enviar invitacion'}
                  </button>
                  <button type="button" onClick={() => { setMostrarForm(false); setEditandoId(null) }}
                    className="text-sm px-5 py-2 rounded-xl" style={s.btnSecondary}>
                    Cancelar
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {trabajadores.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-5xl mb-4">👷</p>
            <p style={{ color: 'var(--text-muted)' }}>No hay trabajadores registrados.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {trabajadores.map(t => (
              <div key={t.id} className="rounded-2xl p-5 transition-all" style={s.cardStyle}
                onMouseEnter={e => e.currentTarget.style.borderColor = '#7c3aed'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-bold font-mono flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.3), rgba(6,182,212,0.3))', color: '#a78bfa', border: '1px solid rgba(124,58,237,0.3)' }}>
                    {INICIALES(t.nombre)}
                  </div>
                  <div>
                    <p className="font-semibold" style={{ color: 'var(--text)' }}>{t.nombre}</p>
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: ROLES[t.rol]?.bg, color: ROLES[t.rol]?.color }}>
                      {ROLES[t.rol]?.label || t.rol}
                    </span>
                  </div>
                </div>
                {t.telefono && (
                  <a href={`tel:${t.telefono}`} className="text-sm mb-4 block" style={{ color: '#34d399' }}>
                    📞 {t.telefono}
                  </a>
                )}
                <div className="pt-3" style={{ borderTop: '1px solid var(--border)' }}>
                  <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-muted)' }}>Rol</label>
                  <select value={t.rol} onChange={e => cambiarRol(t.id, e.target.value)}
                    className="w-full rounded-xl px-3 py-1.5 text-sm outline-none mb-3" style={s.inputStyle}>
                    <option value="gerente">Gerente</option>
                    <option value="oficina">Oficina</option>
                    <option value="supervisor">Supervisor</option>
                    <option value="tecnico">Tecnico</option>
                    <option value="almacen">Almacen</option>
                  </select>
                  <button onClick={() => abrirFormEditar(t)} className="w-full text-sm py-1.5 rounded-xl mb-2"
                    style={{ background: 'rgba(124,58,237,0.1)', color: '#a78bfa', border: '1px solid rgba(124,58,237,0.2)' }}>
                    Editar datos
                  </button>
                  <button onClick={() => eliminarTrabajador(t.id, t.nombre)} className="w-full text-sm py-1.5 rounded-xl"
                    style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
