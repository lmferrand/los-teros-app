'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function Clientes() {
  const [clientes, setClientes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [nombre, setNombre] = useState('')
  const [direccion, setDireccion] = useState('')
  const [telefono, setTelefono] = useState('')
  const [email, setEmail] = useState('')
  const [notas, setNotas] = useState('')
  const router = useRouter()

  useEffect(() => {
    verificarSesion()
    cargarClientes()
  }, [])

  async function verificarSesion() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) router.push('/login')
  }

  async function cargarClientes() {
    const { data } = await supabase
      .from('clientes')
      .select('*')
      .order('created_at', { ascending: false })
    if (data) setClientes(data)
    setLoading(false)
  }

  async function guardarCliente(e: React.FormEvent) {
    e.preventDefault()
    const { error } = await supabase.from('clientes').insert({
      nombre, direccion, telefono, email, notas
    })
    if (!error) {
      setNombre('')
      setDireccion('')
      setTelefono('')
      setEmail('')
      setNotas('')
      setMostrarForm(false)
      cargarClientes()
    }
  }

  async function eliminarCliente(id: string) {
    if (!confirm('Eliminar este cliente?')) return
    await supabase.from('clientes').delete().eq('id', id)
    cargarClientes()
  }

  function abrirMaps(dir: string) {
    const url = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(dir)
    window.open(url, '_blank')
  }

  return (
    <div className="min-h-screen bg-gray-950">
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <a href="/dashboard" className="text-gray-400 hover:text-white text-sm">Dashboard</a>
          <h1 className="text-xl font-bold text-white">Clientes</h1>
        </div>
        <button
          onClick={() => setMostrarForm(!mostrarForm)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm"
        >
          + Nuevo cliente
        </button>
      </div>

      <div className="p-6">
        {mostrarForm && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
            <h2 className="text-white font-semibold mb-4">Nuevo cliente</h2>
            <form onSubmit={guardarCliente} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-gray-400 text-xs uppercase mb-1 block">Nombre</label>
                <input
                  value={nombre}
                  onChange={e => setNombre(e.target.value)}
                  required
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                  placeholder="Restaurante La Brasa"
                />
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
              <div className="md:col-span-2">
                <label className="text-gray-400 text-xs uppercase mb-1 block">Direccion</label>
                <input
                  value={direccion}
                  onChange={e => setDireccion(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                  placeholder="Calle, numero, ciudad..."
                />
              </div>
              <div>
                <label className="text-gray-400 text-xs uppercase mb-1 block">Email</label>
                <input
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  type="email"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                />
              </div>
              <div>
                <label className="text-gray-400 text-xs uppercase mb-1 block">Notas</label>
                <input
                  value={notas}
                  onChange={e => setNotas(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                  placeholder="Instrucciones de acceso..."
                />
              </div>
              <div className="md:col-span-2 flex gap-3">
                <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm">
                  Guardar
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
        ) : clientes.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <p className="text-4xl mb-3">🏢</p>
            <p>No hay clientes. Añade el primero.</p>
          </div>
        ) : (
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left px-4 py-3 text-gray-400 text-xs uppercase">Nombre</th>
                  <th className="text-left px-4 py-3 text-gray-400 text-xs uppercase">Telefono</th>
                  <th className="text-left px-4 py-3 text-gray-400 text-xs uppercase">Direccion</th>
                  <th className="text-left px-4 py-3 text-gray-400 text-xs uppercase">Ruta</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {clientes.map(c => (
                  <tr key={c.id} className="border-b border-gray-800 hover:bg-gray-800">
                    <td className="px-4 py-3 text-white font-medium">{c.nombre}</td>
                    <td className="px-4 py-3 text-gray-400">{c.telefono || '—'}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{c.direccion || '—'}</td>
                    <td className="px-4 py-3">
                      {c.direccion && (
                        <button
                          onClick={() => abrirMaps(c.direccion)}
                          className="text-blue-400 hover:text-blue-300 text-xs"
                        >
                          Maps
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => eliminarCliente(c.id)}
                        className="text-red-400 hover:text-red-300 text-xs"
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}