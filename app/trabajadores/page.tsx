'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

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

  useEffect(() => {
    verificarSesion()
  }, [])

  async function verificarSesion() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }
    const { data } = await supabase.from('perfiles').select('*').eq('id', session.user.id).single()
    if (data?.rol !== 'gerente' && data?.rol !== 'oficina' && data?.rol !== 'supervisor') {
      setAccesoDenegado(true)
      setLoading(false)
      return
    }
    cargarTrabajadores()
  }

  async function cargarTrabajadores() {
    const { data } = await supabase
      .from('perfiles')
      .select('*')
      .order('nombre')
    if (data) setTrabajadores(data)
    setLoading(false)
  }

  function abrirFormNuevo() {
    setEditandoId(null)
    setNombre('')
    setRol('tecnico')
    setTelefono('')
    setEmail('')
    setMensajeExito('')
    setMostrarForm(true)
  }

  function abrirFormEditar(t: any) {
    setEditandoId(t.id)
    setNombre(t.nombre || '')
    setRol(t.rol || 'tecnico')
    setTelefono(t.telefono || '')
    setEmail('')
    setMensajeExito('')
    setMostrarForm(true)
  }

  async function guardarTrabajador(e: React.FormEvent) {
    e.preventDefault()

    if (editandoId) {
      await supabase.from('perfiles').update({ nombre, rol, telefono }).eq('id', editandoId)
      setMostrarForm(false)
      setEditandoId(null)
      cargarTrabajadores()
      return
    }

    setEnviando(true)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: 'https://los-teros-app.vercel.app',
      }
    })

    if (error) {
      alert('Error al enviar invitacion: ' + error.message)
      setEnviando(false)
      return
    }

    const { data: userData } = await supabase.auth.admin?.listUsers?.() || { data: null }

    await supabase.from('perfiles').upsert({
      nombre,
      rol,
      telefono,
    }, { onConflict: 'id', ignoreDuplicates: false })

    setMensajeExito(`Invitacion enviada a ${email}. El trabajador recibira un email para acceder a la app.`)
    setEnviando(false)
    setNombre('')
    setEmail('')
    setTelefono('')
    setRol('tecnico')
  }

  async function cambiarRol(id: string, nuevoRol: string) {
    await supabase.from('perfiles').update({ rol: nuevoRol }).eq('id', id)
    cargarTrabajadores()
  }

  const ROLES: any = {
    gerente: { label: 'Gerente', clase: 'bg-purple-900 text-purple-300' },
    oficina: { label: 'Oficina', clase: 'bg-blue-900 text-blue-300' },
    tecnico: { label: 'Tecnico', clase: 'bg-green-900 text-green-300' },
    almacen: { label: 'Almacen', clase: 'bg-yellow-900 text-yellow-300' },
    supervisor: { label: 'Supervisor', clase: 'bg-orange-900 text-orange-300' },
  }

  const INICIALES = (nombre: string) => {
    return nombre?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || '?'
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <p className="text-white">Cargando...</p>
    </div>
  )

  if (accesoDenegado) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-center">
        <p className="text-4xl mb-4">🔒</p>
        <p className="text-white font-semibold mb-2">Acceso restringido</p>
        <p className="text-gray-400 text-sm mb-6">Solo gerentes y oficina pueden ver este modulo.</p>
        <a href="/dashboard" className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg text-sm">
          Volver al dashboard
        </a>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-950">
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <a href="/dashboard" className="text-gray-400 hover:text-white text-sm">Dashboard</a>
          <h1 className="text-xl font-bold text-white">Trabajadores</h1>
        </div>
        <button onClick={abrirFormNuevo} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm">
          + Nuevo trabajador
        </button>
      </div>

      <div className="p-6">
        {mostrarForm && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
            <h2 className="text-white font-semibold mb-4">
              {editandoId ? 'Editar trabajador' : 'Invitar nuevo trabajador'}
            </h2>

            {mensajeExito ? (
              <div className="bg-green-950 border border-green-800 rounded-xl p-4">
                <p className="text-green-300 text-sm">{mensajeExito}</p>
                <button
                  onClick={() => { setMostrarForm(false); setMensajeExito('') }}
                  className="mt-3 bg-green-800 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm"
                >
                  Cerrar
                </button>
              </div>
            ) : (
              <form onSubmit={guardarTrabajador} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-gray-400 text-xs uppercase mb-1 block">Nombre completo</label>
                  <input
                    value={nombre}
                    onChange={e => setNombre(e.target.value)}
                    required
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                    placeholder="Jose Antonio Garcia"
                  />
                </div>
                <div>
                  <label className="text-gray-400 text-xs uppercase mb-1 block">Rol</label>
                  <select
                    value={rol}
                    onChange={e => setRol(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                  >
                    <option value="gerente">Gerente</option>
                    <option value="oficina">Oficina</option>
                    <option value="supervisor">Supervisor</option>
                    <option value="tecnico">Tecnico</option>
                    <option value="almacen">Almacen</option>
                  </select>
                </div>
                <div>
                  <label className="text-gray-400 text-xs uppercase mb-1 block">Telefono</label>
                  <input
                    value={telefono}
                    onChange={e => setTelefono(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                    placeholder="600 000 000"
                  />
                </div>
                {!editandoId && (
                  <div>
                    <label className="text-gray-400 text-xs uppercase mb-1 block">Email</label>
                    <input
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      type="email"
                      required
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                      placeholder="trabajador@email.com"
                    />
                  </div>
                )}
                {!editandoId && (
                  <div className="md:col-span-2">
                    <div className="bg-blue-950 border border-blue-800 rounded-lg p-3">
                      <p className="text-blue-300 text-xs font-semibold mb-1">Como funciona</p>
                      <p className="text-blue-200 text-xs">El trabajador recibira un email con un enlace para acceder a la app. Solo necesita hacer clic en el enlace y ya podra entrar sin necesidad de contraseña.</p>
                    </div>
                  </div>
                )}
                <div className="md:col-span-2 flex gap-3">
                  <button
                    type="submit"
                    disabled={enviando}
                    className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm"
                  >
                    {enviando ? 'Enviando invitacion...' : editandoId ? 'Guardar cambios' : 'Enviar invitacion'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setMostrarForm(false); setEditandoId(null) }}
                    className="bg-gray-800 text-gray-400 px-4 py-2 rounded-lg text-sm"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {trabajadores.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <p className="text-4xl mb-3">👷</p>
            <p>No hay trabajadores registrados.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {trabajadores.map(t => (
              <div key={t.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-full bg-blue-900 border border-blue-700 flex items-center justify-center text-blue-300 font-bold text-lg font-mono flex-shrink-0">
                    {INICIALES(t.nombre)}
                  </div>
                  <div>
                    <p className="text-white font-semibold">{t.nombre}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${ROLES[t.rol]?.clase || 'bg-gray-800 text-gray-400'}`}>
                      {ROLES[t.rol]?.label || t.rol}
                    </span>
                  </div>
                </div>
                {t.telefono && (
                  <a href={`tel:${t.telefono}`} className="text-green-400 hover:text-green-300 text-sm mb-3 block">
                    📞 {t.telefono}
                  </a>
                )}
                <div className="border-t border-gray-800 pt-3">
                  <p className="text-gray-500 text-xs mb-2">Cambiar rol</p>
                  <select
                    value={t.rol}
                    onChange={e => cambiarRol(t.id, e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-white text-xs mb-3"
                  >
                    <option value="gerente">Gerente</option>
                    <option value="oficina">Oficina</option>
                    <option value="supervisor">Supervisor</option>
                    <option value="tecnico">Tecnico</option>
                    <option value="almacen">Almacen</option>
                  </select>
                  <button
                    onClick={() => abrirFormEditar(t)}
                    className="w-full bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-lg text-xs"
                  >
                    Editar datos
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