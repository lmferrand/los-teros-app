'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function Inventario() {
  const [materiales, setMateriales] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [editando, setEditando] = useState<any>(null)
  const router = useRouter()

  const [nombre, setNombre] = useState('')
  const [referencia, setReferencia] = useState('')
  const [categoria, setCategoria] = useState('limpieza')
  const [unidad, setUnidad] = useState('unidad')
  const [stock, setStock] = useState('0')
  const [minimo, setMinimo] = useState('5')
  const [ubicacion, setUbicacion] = useState('')
  const [notas, setNotas] = useState('')
  const [fotoUrl, setFotoUrl] = useState('')
  const [subiendo, setSubiendo] = useState(false)

  useEffect(() => {
    verificarSesion()
    cargarMateriales()
  }, [])

  async function verificarSesion() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) router.push('/login')
  }

  async function cargarMateriales() {
    const { data } = await supabase
      .from('materiales')
      .select('*')
      .order('nombre')
    if (data) setMateriales(data)
    setLoading(false)
  }

  async function subirFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setSubiendo(true)
    const nombre_archivo = `materiales/${Date.now()}-${file.name}`
    const { data, error } = await supabase.storage
      .from('fotos-materiales')
      .upload(nombre_archivo, file)
    if (!error && data) {
      const { data: urlData } = supabase.storage
        .from('fotos-materiales')
        .getPublicUrl(nombre_archivo)
      setFotoUrl(urlData.publicUrl)
    }
    setSubiendo(false)
  }

  function abrirForm(mat?: any) {
    if (mat) {
      setEditando(mat)
      setNombre(mat.nombre || '')
      setReferencia(mat.referencia || '')
      setCategoria(mat.categoria || 'limpieza')
      setUnidad(mat.unidad || 'unidad')
      setStock(String(mat.stock || 0))
      setMinimo(String(mat.minimo || 5))
      setUbicacion(mat.ubicacion || '')
      setNotas(mat.notas || '')
      setFotoUrl(mat.foto_url || '')
    } else {
      setEditando(null)
      setNombre(''); setReferencia(''); setCategoria('limpieza')
      setUnidad('unidad'); setStock('0'); setMinimo('5')
      setUbicacion(''); setNotas(''); setFotoUrl('')
    }
    setMostrarForm(true)
  }

  async function guardarMaterial(e: React.FormEvent) {
    e.preventDefault()
    const datos = {
      nombre, referencia, categoria, unidad,
      stock: parseFloat(stock) || 0,
      minimo: parseFloat(minimo) || 0,
      ubicacion, notas,
      foto_url: fotoUrl || null,
    }
    if (editando) {
      await supabase.from('materiales').update(datos).eq('id', editando.id)
    } else {
      await supabase.from('materiales').insert(datos)
    }
    setMostrarForm(false)
    setEditando(null)
    cargarMateriales()
  }

  async function ajustarStock(id: string, cantidad: number) {
    const mat = materiales.find(m => m.id === id)
    if (!mat) return
    const nuevoStock = Math.max(0, (mat.stock || 0) + cantidad)
    await supabase.from('materiales').update({ stock: nuevoStock }).eq('id', id)
    cargarMateriales()
  }

  async function eliminarMaterial(id: string) {
    if (!confirm('Eliminar este material?')) return
    await supabase.from('materiales').delete().eq('id', id)
    cargarMateriales()
  }

  const stockBajo = materiales.filter(m => (m.stock || 0) < (m.minimo || 0))

  return (
    <div className="min-h-screen bg-gray-950">
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <a href="/dashboard" className="text-gray-400 hover:text-white text-sm">Dashboard</a>
          <h1 className="text-xl font-bold text-white">Inventario</h1>
        </div>
        <button
          onClick={() => abrirForm()}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm"
        >
          + Nuevo material
        </button>
      </div>

      <div className="p-6">
        {stockBajo.length > 0 && (
          <div className="bg-yellow-900 border border-yellow-700 rounded-xl p-4 mb-6">
            <p className="text-yellow-300 font-medium text-sm mb-2">
              Alerta de stock bajo ({stockBajo.length} materiales)
            </p>
            <div className="flex flex-wrap gap-2">
              {stockBajo.map(m => (
                <span key={m.id} className="bg-yellow-800 text-yellow-200 text-xs px-2 py-1 rounded">
                  {m.nombre}: {m.stock} {m.unidad} (min: {m.minimo})
                </span>
              ))}
            </div>
          </div>
        )}

        {mostrarForm && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
            <h2 className="text-white font-semibold mb-4">
              {editando ? 'Editar material' : 'Nuevo material'}
            </h2>
            <form onSubmit={guardarMaterial} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-gray-400 text-xs uppercase mb-1 block">Nombre</label>
                <input
                  value={nombre}
                  onChange={e => setNombre(e.target.value)}
                  required
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                  placeholder="Desengrasante industrial"
                />
              </div>
              <div>
                <label className="text-gray-400 text-xs uppercase mb-1 block">Referencia</label>
                <input
                  value={referencia}
                  onChange={e => setReferencia(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                  placeholder="REF-001"
                />
              </div>
              <div>
                <label className="text-gray-400 text-xs uppercase mb-1 block">Categoria</label>
                <select
                  value={categoria}
                  onChange={e => setCategoria(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                >
                  <option value="limpieza">Limpieza</option>
                  <option value="filtros">Filtros</option>
                  <option value="repuestos">Repuestos</option>
                  <option value="instalacion">Instalacion</option>
                  <option value="otro">Otro</option>
                </select>
              </div>
              <div>
                <label className="text-gray-400 text-xs uppercase mb-1 block">Unidad</label>
                <select
                  value={unidad}
                  onChange={e => setUnidad(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                >
                  <option value="unidad">Unidad</option>
                  <option value="litro">Litro</option>
                  <option value="kg">Kg</option>
                  <option value="metro">Metro</option>
                  <option value="caja">Caja</option>
                  <option value="rollo">Rollo</option>
                </select>
              </div>
              <div>
                <label className="text-gray-400 text-xs uppercase mb-1 block">Stock actual</label>
                <input
                  type="number"
                  value={stock}
                  onChange={e => setStock(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                />
              </div>
              <div>
                <label className="text-gray-400 text-xs uppercase mb-1 block">Stock minimo alerta</label>
                <input
                  type="number"
                  value={minimo}
                  onChange={e => setMinimo(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                />
              </div>
              <div>
                <label className="text-gray-400 text-xs uppercase mb-1 block">Ubicacion almacen</label>
                <input
                  value={ubicacion}
                  onChange={e => setUbicacion(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                  placeholder="Estanteria A, balda 3"
                />
              </div>
              <div>
                <label className="text-gray-400 text-xs uppercase mb-1 block">Notas</label>
                <input
                  value={notas}
                  onChange={e => setNotas(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                  placeholder="Proveedor, especificaciones..."
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-gray-400 text-xs uppercase mb-1 block">Foto del material</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={subirFoto}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                />
                {subiendo && <p className="text-blue-400 text-xs mt-1">Subiendo foto...</p>}
                {fotoUrl && (
                  <img src={fotoUrl} alt="foto" className="mt-2 h-20 w-20 object-cover rounded-lg border border-gray-700" />
                )}
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
        ) : materiales.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <p className="text-4xl mb-3">📦</p>
            <p>No hay materiales. Añade el primero.</p>
          </div>
        ) : (
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left px-4 py-3 text-gray-400 text-xs uppercase">Foto</th>
                  <th className="text-left px-4 py-3 text-gray-400 text-xs uppercase">Material</th>
                  <th className="text-left px-4 py-3 text-gray-400 text-xs uppercase">Categoria</th>
                  <th className="text-left px-4 py-3 text-gray-400 text-xs uppercase">Stock</th>
                  <th className="text-left px-4 py-3 text-gray-400 text-xs uppercase">Minimo</th>
                  <th className="text-left px-4 py-3 text-gray-400 text-xs uppercase">Ubicacion</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {materiales.map(m => (
                  <tr key={m.id} className="border-b border-gray-800 hover:bg-gray-800">
                    <td className="px-4 py-3">
                      {m.foto_url ? (
                        <img src={m.foto_url} alt={m.nombre} className="w-10 h-10 object-cover rounded-lg border border-gray-700" />
                      ) : (
                        <div className="w-10 h-10 bg-gray-800 rounded-lg border border-gray-700 flex items-center justify-center text-gray-600 text-xs">
                          📦
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-white font-medium">{m.nombre}</p>
                      <p className="text-gray-500 text-xs">{m.referencia}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-400">{m.categoria}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => ajustarStock(m.id, -1)}
                          className="w-6 h-6 bg-gray-800 hover:bg-gray-700 text-white rounded text-xs"
                        >
                          -
                        </button>
                        <span className={`font-mono font-bold ${(m.stock || 0) < (m.minimo || 0) ? 'text-red-400' : 'text-white'}`}>
                          {m.stock || 0} {m.unidad}
                        </span>
                        <button
                          onClick={() => ajustarStock(m.id, 1)}
                          className="w-6 h-6 bg-gray-800 hover:bg-gray-700 text-white rounded text-xs"
                        >
                          +
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{m.minimo || 0} {m.unidad}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{m.ubicacion || '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => abrirForm(m)} className="text-blue-400 hover:text-blue-300 text-xs">
                          Editar
                        </button>
                        <button onClick={() => eliminarMaterial(m.id)} className="text-red-400 hover:text-red-300 text-xs">
                          Eliminar
                        </button>
                      </div>
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