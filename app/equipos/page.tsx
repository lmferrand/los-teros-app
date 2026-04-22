'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function Equipos() {
  const [equipos, setEquipos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [editando, setEditando] = useState<any>(null)
  const router = useRouter()

  const [codigo, setCodigo] = useState('')
  const [tipo, setTipo] = useState('turbina')
  const [marca, setMarca] = useState('')
  const [modelo, setModelo] = useState('')
  const [estado, setEstado] = useState('disponible')
  const [ubicacion, setUbicacion] = useState('')
  const [notas, setNotas] = useState('')

  useEffect(() => {
    verificarSesion()
    cargarEquipos()
  }, [])

  async function verificarSesion() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) router.push('/login')
  }

  async function cargarEquipos() {
    const { data } = await supabase
      .from('equipos')
      .select('*')
      .order('codigo')
    if (data) setEquipos(data)
    setLoading(false)
  }

  function abrirForm(eq?: any) {
    if (eq) {
      setEditando(eq)
      setCodigo(eq.codigo || '')
      setTipo(eq.tipo || 'turbina')
      setMarca(eq.marca || '')
      setModelo(eq.modelo || '')
      setEstado(eq.estado || 'disponible')
      setUbicacion(eq.ubicacion || '')
      setNotas(eq.notas || '')
    } else {
      setEditando(null)
      setCodigo(''); setTipo('turbina'); setMarca('')
      setModelo(''); setEstado('disponible')
      setUbicacion(''); setNotas('')
    }
    setMostrarForm(true)
  }

  async function guardarEquipo(e: React.FormEvent) {
    e.preventDefault()
    const datos = { codigo, tipo, marca, modelo, estado, ubicacion, notas }
    if (editando) {
      await supabase.from('equipos').update(datos).eq('id', editando.id)
    } else {
      await supabase.from('equipos').insert(datos)
    }
    setMostrarForm(false)
    setEditando(null)
    cargarEquipos()
  }

  async function cambiarEstado(id: string, nuevoEstado: string) {
    await supabase.from('equipos').update({ estado: nuevoEstado }).eq('id', id)
    cargarEquipos()
  }

  async function eliminarEquipo(id: string) {
    if (!confirm('Eliminar este equipo?')) return
    await supabase.from('equipos').delete().eq('id', id)
    cargarEquipos()
  }

  const ESTADOS: any = {
    disponible: { clase: 'bg-green-900 text-green-300', label: 'Disponible' },
    en_cliente: { clase: 'bg-yellow-900 text-yellow-300', label: 'En cliente' },
    pendiente_limpieza: { clase: 'bg-purple-900 text-purple-300', label: 'Pend. limpieza' },
    pendiente_revision: { clase: 'bg-blue-900 text-blue-300', label: 'Pend. revision' },
    averiado: { clase: 'bg-red-900 text-red-300', label: 'Averiado' },
  }

  const enCliente = equipos.filter(e => e.estado === 'en_cliente')
  const pendientes = equipos.filter(e => e.estado === 'pendiente_limpieza' || e.estado === 'pendiente_revision')
  const disponibles = equipos.filter(e => e.estado === 'disponible')

  return (
    <div className="min-h-screen bg-gray-950">
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <a href="/dashboard" className="text-gray-400 hover:text-white text-sm">Dashboard</a>
          <h1 className="text-xl font-bold text-white">Equipos de sustitucion</h1>
        </div>
        <button
          onClick={() => abrirForm()}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm"
        >
          + Nuevo equipo
        </button>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-green-900 border border-green-700 rounded-xl p-4 text-center">
            <p className="text-green-300 text-2xl font-bold">{disponibles.length}</p>
            <p className="text-green-400 text-sm">Disponibles</p>
          </div>
          <div className="bg-yellow-900 border border-yellow-700 rounded-xl p-4 text-center">
            <p className="text-yellow-300 text-2xl font-bold">{enCliente.length}</p>
            <p className="text-yellow-400 text-sm">En cliente</p>
          </div>
          <div className="bg-purple-900 border border-purple-700 rounded-xl p-4 text-center">
            <p className="text-purple-300 text-2xl font-bold">{pendientes.length}</p>
            <p className="text-purple-400 text-sm">Pendientes</p>
          </div>
        </div>

        {enCliente.length > 0 && (
          <div className="bg-yellow-900 border border-yellow-700 rounded-xl p-4 mb-6">
            <p className="text-yellow-300 font-medium text-sm mb-2">Equipos actualmente en cliente</p>
            <div className="flex flex-wrap gap-2">
              {enCliente.map(e => (
                <span key={e.id} className="bg-yellow-800 text-yellow-200 text-xs px-2 py-1 rounded">
                  {e.codigo} — {e.tipo} {e.marca}
                </span>
              ))}
            </div>
          </div>
        )}

        {mostrarForm && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
            <h2 className="text-white font-semibold mb-4">
              {editando ? 'Editar equipo' : 'Nuevo equipo'}
            </h2>
            <form onSubmit={guardarEquipo} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-gray-400 text-xs uppercase mb-1 block">Codigo</label>
                <input
                  value={codigo}
                  onChange={e => setCodigo(e.target.value)}
                  required
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                  placeholder="TRB-001"
                />
              </div>
              <div>
                <label className="text-gray-400 text-xs uppercase mb-1 block">Tipo</label>
                <select
                  value={tipo}
                  onChange={e => setTipo(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                >
                  <option value="turbina">Turbina</option>
                  <option value="motor">Motor</option>
                  <option value="caja_extraccion">Caja extraccion</option>
                  <option value="otro">Otro</option>
                </select>
              </div>
              <div>
                <label className="text-gray-400 text-xs uppercase mb-1 block">Marca</label>
                <input
                  value={marca}
                  onChange={e => setMarca(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                  placeholder="Soler&Palau"
                />
              </div>
              <div>
                <label className="text-gray-400 text-xs uppercase mb-1 block">Modelo</label>
                <input
                  value={modelo}
                  onChange={e => setModelo(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                  placeholder="CVST-25/13"
                />
              </div>
              <div>
                <label className="text-gray-400 text-xs uppercase mb-1 block">Estado</label>
                <select
                  value={estado}
                  onChange={e => setEstado(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                >
                  <option value="disponible">Disponible</option>
                  <option value="en_cliente">En cliente</option>
                  <option value="pendiente_limpieza">Pendiente limpieza</option>
                  <option value="pendiente_revision">Pendiente revision</option>
                  <option value="averiado">Averiado</option>
                </select>
              </div>
              <div>
                <label className="text-gray-400 text-xs uppercase mb-1 block">Ubicacion</label>
                <input
                  value={ubicacion}
                  onChange={e => setUbicacion(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                  placeholder="Nave principal, zona A"
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-gray-400 text-xs uppercase mb-1 block">Notas tecnicas</label>
                <textarea
                  value={notas}
                  onChange={e => setNotas(e.target.value)}
                  rows={2}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                  placeholder="Caracteristicas, observaciones..."
                />
              </div>
              <div className="md:col-span-2 flex gap-3">
                <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm">
                  {editando ? 'Actualizar' : 'Guardar'}
                </button>
                <button type="button" onClick={() => setMostrarForm(false)} className="bg-gray-800 text-gray-400 px-4 py-2 rounded-lg text-sm">
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        )}

        {loading ? (
          <p className="text-gray-400">Cargando...</p>
        ) : equipos.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <p className="text-4xl mb-3">⚙️</p>
            <p>No hay equipos registrados. Añade el primero.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {equipos.map(e => (
              <div key={e.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-blue-400 font-mono text-sm">{e.codigo}</p>
                    <p className="text-white font-semibold mt-1">
                      {e.tipo.charAt(0).toUpperCase() + e.tipo.slice(1).replace('_', ' ')}
                    </p>
                    <p className="text-gray-400 text-sm">{e.marca} {e.modelo}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${ESTADOS[e.estado]?.clase || 'bg-gray-800 text-gray-400'}`}>
                    {ESTADOS[e.estado]?.label || e.estado}
                  </span>
                </div>
                {e.ubicacion && (
                  <p className="text-gray-500 text-xs mb-3">📍 {e.ubicacion}</p>
                )}
                {e.notas && (
                  <p className="text-gray-500 text-xs mb-3">{e.notas}</p>
                )}
                <div className="border-t border-gray-800 pt-3 flex flex-wrap gap-2">
                  {e.estado === 'pendiente_limpieza' || e.estado === 'pendiente_revision' ? (
                    <button
                      onClick={() => cambiarEstado(e.id, 'disponible')}
                      className="bg-green-900 hover:bg-green-800 text-green-300 px-3 py-1 rounded text-xs"
                    >
                      Marcar disponible
                    </button>
                  ) : null}
                  {e.estado === 'disponible' && (
                    <button
                      onClick={() => cambiarEstado(e.id, 'en_cliente')}
                      className="bg-yellow-900 hover:bg-yellow-800 text-yellow-300 px-3 py-1 rounded text-xs"
                    >
                      Enviar a cliente
                    </button>
                  )}
                  {e.estado === 'en_cliente' && (
                    <button
                      onClick={() => cambiarEstado(e.id, 'pendiente_limpieza')}
                      className="bg-purple-900 hover:bg-purple-800 text-purple-300 px-3 py-1 rounded text-xs"
                    >
                      Devolver
                    </button>
                  )}
                  <button
                    onClick={() => abrirForm(e)}
                    className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1 rounded text-xs"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => eliminarEquipo(e.id)}
                    className="bg-gray-800 hover:bg-gray-700 text-red-400 px-3 py-1 rounded text-xs"
                  >
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