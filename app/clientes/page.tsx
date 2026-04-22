'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import * as XLSX from 'xlsx'

export default function Clientes() {
  const [clientes, setClientes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [importando, setImportando] = useState(false)
  const [resultadoImport, setResultadoImport] = useState<any>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const [nombre, setNombre] = useState('')
  const [direccion, setDireccion] = useState('')
  const [telefono, setTelefono] = useState('')
  const [email, setEmail] = useState('')
  const [notas, setNotas] = useState('')

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
      .order('nombre')
    if (data) setClientes(data)
    setLoading(false)
  }

  function abrirFormNuevo() {
    setEditandoId(null)
    setNombre(''); setDireccion(''); setTelefono(''); setEmail(''); setNotas('')
    setMostrarForm(true)
  }

  function abrirFormEditar(c: any) {
    setEditandoId(c.id)
    setNombre(c.nombre || '')
    setDireccion(c.direccion || '')
    setTelefono(c.telefono || '')
    setEmail(c.email || '')
    setNotas(c.notas || '')
    setMostrarForm(true)
  }

  async function guardarCliente(e: React.FormEvent) {
    e.preventDefault()
    const datos = { nombre, direccion, telefono, email, notas }
    if (editandoId) {
      await supabase.from('clientes').update(datos).eq('id', editandoId)
    } else {
      await supabase.from('clientes').insert(datos)
    }
    setMostrarForm(false)
    setEditandoId(null)
    cargarClientes()
  }

  async function eliminarCliente(id: string) {
    if (!confirm('Eliminar este cliente?')) return
    await supabase.from('clientes').delete().eq('id', id)
    cargarClientes()
  }

  function abrirMaps(dir: string) {
    window.open('https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(dir), '_blank')
  }

  async function importarExcel(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImportando(true)
    setResultadoImport(null)

    try {
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array' })
      const hoja = workbook.Sheets[workbook.SheetNames[0]]
      const datos = XLSX.utils.sheet_to_json(hoja, { defval: '' }) as any[]

      let importados = 0
      let errores = 0
      const erroresDetalle: string[] = []

      for (const fila of datos) {
        const nombreCliente = fila['nombre'] || fila['Nombre'] || fila['NOMBRE'] || fila['razon_social'] || fila['Razon Social'] || ''
        if (!nombreCliente) { errores++; erroresDetalle.push(`Fila sin nombre`); continue }

        const cliente = {
          nombre: String(nombreCliente).trim(),
          direccion: String(fila['direccion'] || fila['Direccion'] || fila['DIRECCION'] || fila['direccion_fiscal'] || '').trim(),
          telefono: String(fila['telefono'] || fila['Telefono'] || fila['TELEFONO'] || fila['tel'] || '').trim(),
          email: String(fila['email'] || fila['Email'] || fila['EMAIL'] || fila['correo'] || '').trim(),
          notas: String(fila['notas'] || fila['Notas'] || fila['observaciones'] || '').trim(),
        }

        const { error } = await supabase.from('clientes').insert(cliente)
        if (error) { errores++; erroresDetalle.push(`Error en ${nombreCliente}: ${error.message}`) }
        else importados++
      }

      setResultadoImport({ importados, errores, erroresDetalle, total: datos.length })
      cargarClientes()
    } catch (err) {
      setResultadoImport({ error: 'Error al leer el archivo Excel. Comprueba el formato.' })
    }

    setImportando(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  function exportarExcel() {
    const datos = clientes.map(c => ({
      nombre: c.nombre,
      direccion: c.direccion || '',
      telefono: c.telefono || '',
      email: c.email || '',
      notas: c.notas || '',
    }))
    const ws = XLSX.utils.json_to_sheet(datos)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Clientes')
    XLSX.writeFile(wb, `clientes_los_teros_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  const q = ''

  return (
    <div className="min-h-screen bg-gray-950">
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <a href="/dashboard" className="text-gray-400 hover:text-white text-sm">Dashboard</a>
          <h1 className="text-xl font-bold text-white">Clientes</h1>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={exportarExcel}
            className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-4 py-2 rounded-lg text-sm"
          >
            Exportar Excel
          </button>
          <label className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-4 py-2 rounded-lg text-sm cursor-pointer">
            {importando ? 'Importando...' : 'Importar Excel'}
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={importarExcel} disabled={importando} />
          </label>
          <button onClick={abrirFormNuevo} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm">
            + Nuevo cliente
          </button>
        </div>
      </div>

      <div className="p-6">
        {resultadoImport && (
          <div className={`rounded-xl p-4 mb-6 border ${resultadoImport.error ? 'bg-red-950 border-red-800' : 'bg-gray-900 border-gray-700'}`}>
            {resultadoImport.error ? (
              <p className="text-red-300 text-sm">{resultadoImport.error}</p>
            ) : (
              <div>
                <p className="text-white font-semibold mb-2">Importacion completada</p>
                <p className="text-green-400 text-sm">{resultadoImport.importados} clientes importados correctamente</p>
                {resultadoImport.errores > 0 && (
                  <p className="text-red-400 text-sm">{resultadoImport.errores} filas con error</p>
                )}
                {resultadoImport.erroresDetalle?.slice(0, 3).map((e: string, i: number) => (
                  <p key={i} className="text-gray-400 text-xs mt-1">{e}</p>
                ))}
                <button onClick={() => setResultadoImport(null)} className="text-gray-400 text-xs mt-2 hover:text-white">Cerrar</button>
              </div>
            )}
          </div>
        )}

        <div className="bg-blue-950 border border-blue-800 rounded-xl p-4 mb-6">
          <p className="text-blue-300 font-medium text-sm mb-2">Formato del Excel para importar</p>
          <p className="text-blue-200 text-xs mb-1">El archivo debe tener estas columnas en la primera fila:</p>
          <div className="flex flex-wrap gap-2 mt-2">
            {['nombre', 'direccion', 'telefono', 'email', 'notas'].map(col => (
              <span key={col} className="bg-blue-900 text-blue-200 text-xs px-2 py-1 rounded font-mono">{col}</span>
            ))}
          </div>
          <p className="text-blue-400 text-xs mt-2">Solo el campo nombre es obligatorio. El resto son opcionales.</p>
        </div>

        {mostrarForm && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
            <h2 className="text-white font-semibold mb-4">{editandoId ? 'Editar cliente' : 'Nuevo cliente'}</h2>
            <form onSubmit={guardarCliente} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="text-gray-400 text-xs uppercase mb-1 block">Nombre</label>
                <input value={nombre} onChange={e => setNombre(e.target.value)} required className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm" placeholder="Restaurante La Brasa" />
              </div>
              <div className="md:col-span-2">
                <label className="text-gray-400 text-xs uppercase mb-1 block">Direccion</label>
                <input value={direccion} onChange={e => setDireccion(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm" placeholder="Calle, numero, ciudad..." />
              </div>
              <div>
                <label className="text-gray-400 text-xs uppercase mb-1 block">Telefono</label>
                <input value={telefono} onChange={e => setTelefono(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm" />
              </div>
              <div>
                <label className="text-gray-400 text-xs uppercase mb-1 block">Email</label>
                <input value={email} onChange={e => setEmail(e.target.value)} type="email" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm" />
              </div>
              <div className="md:col-span-2">
                <label className="text-gray-400 text-xs uppercase mb-1 block">Notas</label>
                <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={2} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm" placeholder="Instrucciones de acceso, persona de contacto..." />
              </div>
              <div className="md:col-span-2 flex gap-3">
                <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm">
                  {editandoId ? 'Guardar cambios' : 'Guardar cliente'}
                </button>
                <button type="button" onClick={() => { setMostrarForm(false); setEditandoId(null) }} className="bg-gray-800 text-gray-400 px-4 py-2 rounded-lg text-sm">
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
            <p>No hay clientes. Añade el primero o importa un Excel.</p>
          </div>
        ) : (
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-800">
              <p className="text-gray-400 text-sm">{clientes.length} clientes registrados</p>
            </div>
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
                    <td className="px-4 py-3 text-gray-400 text-xs max-w-xs truncate">{c.direccion || '—'}</td>
                    <td className="px-4 py-3">
                      {c.direccion && (
                        <button onClick={() => abrirMaps(c.direccion)} className="text-blue-400 hover:text-blue-300 text-xs">
                          Maps
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => abrirFormEditar(c)} className="text-blue-400 hover:text-blue-300 text-xs">Editar</button>
                        <button onClick={() => eliminarCliente(c.id)} className="text-red-400 hover:text-red-300 text-xs">Eliminar</button>
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