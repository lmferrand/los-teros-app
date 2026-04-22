'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function Presupuestos() {
  const [presupuestos, setPresupuestos] = useState<any[]>([])
  const [clientes, setClientes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [detalleId, setDetalleId] = useState<any>(null)
  const router = useRouter()

  const [clienteId, setClienteId] = useState('')
  const [titulo, setTitulo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [estado, setEstado] = useState('borrador')
  const [validezDias, setValidezDias] = useState('30')
  const [observaciones, setObservaciones] = useState('')
  const [lineas, setLineas] = useState<any[]>([
    { descripcion: '', cantidad: 1, precio: 0 }
  ])

  useEffect(() => {
    verificarSesion()
    cargarDatos()
  }, [])

  async function verificarSesion() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) router.push('/login')
  }

  async function cargarDatos() {
    const [pres, clis] = await Promise.all([
      supabase.from('presupuestos').select('*, clientes(nombre)').order('created_at', { ascending: false }),
      supabase.from('clientes').select('*').order('nombre'),
    ])
    if (pres.data) setPresupuestos(pres.data)
    if (clis.data) setClientes(clis.data)
    setLoading(false)
  }

  function abrirFormNuevo() {
    setEditandoId(null)
    setClienteId('')
    setTitulo('')
    setDescripcion('')
    setEstado('borrador')
    setValidezDias('30')
    setObservaciones('')
    setLineas([{ descripcion: '', cantidad: 1, precio: 0 }])
    setMostrarForm(true)
  }

  function abrirFormEditar(p: any) {
    setEditandoId(p.id)
    setClienteId(p.cliente_id || '')
    setTitulo(p.titulo || '')
    setDescripcion(p.descripcion || '')
    setEstado(p.estado || 'borrador')
    setValidezDias(String(p.validez_dias || 30))
    setObservaciones(p.observaciones || '')
    setLineas(p.lineas || [{ descripcion: '', cantidad: 1, precio: 0 }])
    setMostrarForm(true)
    setDetalleId(null)
  }

  function añadirLinea() {
    setLineas(prev => [...prev, { descripcion: '', cantidad: 1, precio: 0 }])
  }

  function eliminarLinea(i: number) {
    setLineas(prev => prev.filter((_, idx) => idx !== i))
  }

  function actualizarLinea(i: number, campo: string, valor: any) {
    setLineas(prev => prev.map((l, idx) => idx === i ? { ...l, [campo]: valor } : l))
  }

  function calcularTotal(ls: any[]) {
    return ls.reduce((acc, l) => acc + (parseFloat(l.cantidad) || 0) * (parseFloat(l.precio) || 0), 0)
  }

  async function generarNumero() {
    const { count } = await supabase.from('presupuestos').select('*', { count: 'exact', head: true })
    const num = String((count || 0) + 1).padStart(4, '0')
    return `PRES-${new Date().getFullYear()}-${num}`
  }

  async function guardarPresupuesto(e: React.FormEvent) {
    e.preventDefault()
    const total = calcularTotal(lineas)
    const datos = {
      cliente_id: clienteId,
      titulo,
      descripcion,
      estado,
      validez_dias: parseInt(validezDias) || 30,
      observaciones,
      lineas,
      total,
    }
    if (editandoId) {
      await supabase.from('presupuestos').update(datos).eq('id', editandoId)
    } else {
      const numero = await generarNumero()
      await supabase.from('presupuestos').insert({ ...datos, numero })
    }
    setMostrarForm(false)
    setEditandoId(null)
    cargarDatos()
  }

  async function cambiarEstado(id: string, nuevoEstado: string) {
    await supabase.from('presupuestos').update({ estado: nuevoEstado }).eq('id', id)
    cargarDatos()
  }

  async function eliminarPresupuesto(id: string) {
    if (!confirm('Eliminar este presupuesto?')) return
    await supabase.from('presupuestos').delete().eq('id', id)
    cargarDatos()
    setDetalleId(null)
  }

  const ESTADOS: any = {
    borrador: { clase: 'bg-gray-800 text-gray-300', label: 'Borrador' },
    enviado: { clase: 'bg-blue-900 text-blue-300', label: 'Enviado' },
    aceptado: { clase: 'bg-green-900 text-green-300', label: 'Aceptado' },
    rechazado: { clase: 'bg-red-900 text-red-300', label: 'Rechazado' },
    expirado: { clase: 'bg-yellow-900 text-yellow-300', label: 'Expirado' },
  }

  const presDetalle = detalleId ? presupuestos.find(p => p.id === detalleId) : null

  return (
    <div className="min-h-screen bg-gray-950">
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <a href="/dashboard" className="text-gray-400 hover:text-white text-sm">Dashboard</a>
          <h1 className="text-xl font-bold text-white">Presupuestos</h1>
        </div>
        <button onClick={abrirFormNuevo} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm">
          + Nuevo presupuesto
        </button>
      </div>

      <div className="p-6">
        {mostrarForm && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
            <h2 className="text-white font-semibold mb-4">{editandoId ? 'Editar presupuesto' : 'Nuevo presupuesto'}</h2>
            <form onSubmit={guardarPresupuesto} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-gray-400 text-xs uppercase mb-1 block">Cliente</label>
                  <select value={clienteId} onChange={e => setClienteId(e.target.value)} required className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm">
                    <option value="">Seleccionar cliente...</option>
                    {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-gray-400 text-xs uppercase mb-1 block">Titulo</label>
                  <input value={titulo} onChange={e => setTitulo(e.target.value)} required className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm" placeholder="Limpieza campanas industriales..." />
                </div>
                <div>
                  <label className="text-gray-400 text-xs uppercase mb-1 block">Estado</label>
                  <select value={estado} onChange={e => setEstado(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm">
                    <option value="borrador">Borrador</option>
                    <option value="enviado">Enviado</option>
                    <option value="aceptado">Aceptado</option>
                    <option value="rechazado">Rechazado</option>
                    <option value="expirado">Expirado</option>
                  </select>
                </div>
                <div>
                  <label className="text-gray-400 text-xs uppercase mb-1 block">Validez (dias)</label>
                  <input type="number" value={validezDias} onChange={e => setValidezDias(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm" />
                </div>
                <div className="md:col-span-2">
                  <label className="text-gray-400 text-xs uppercase mb-1 block">Descripcion general</label>
                  <textarea value={descripcion} onChange={e => setDescripcion(e.target.value)} rows={2} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm" placeholder="Descripcion del servicio..." />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-gray-400 text-xs uppercase">Lineas del presupuesto</label>
                  <button type="button" onClick={añadirLinea} className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1 rounded text-xs">
                    + Añadir linea
                  </button>
                </div>
                <div className="space-y-2">
                  <div className="grid grid-cols-12 gap-2 text-xs text-gray-500 px-1">
                    <div className="col-span-6">Descripcion</div>
                    <div className="col-span-2 text-center">Cantidad</div>
                    <div className="col-span-2 text-center">Precio unit.</div>
                    <div className="col-span-1 text-center">Total</div>
                    <div className="col-span-1"></div>
                  </div>
                  {lineas.map((l, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-6">
                        <input value={l.descripcion} onChange={e => actualizarLinea(i, 'descripcion', e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-sm" placeholder="Descripcion del servicio..." />
                      </div>
                      <div className="col-span-2">
                        <input type="number" value={l.cantidad} onChange={e => actualizarLinea(i, 'cantidad', e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-sm text-center" min="0" step="0.5" />
                      </div>
                      <div className="col-span-2">
                        <input type="number" value={l.precio} onChange={e => actualizarLinea(i, 'precio', e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white text-sm text-center" min="0" step="0.01" />
                      </div>
                      <div className="col-span-1 text-center text-white text-sm font-mono">
                        {((parseFloat(l.cantidad) || 0) * (parseFloat(l.precio) || 0)).toFixed(2)}
                      </div>
                      <div className="col-span-1 text-center">
                        {lineas.length > 1 && (
                          <button type="button" onClick={() => eliminarLinea(i)} className="text-red-400 hover:text-red-300 text-xs">X</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-end mt-3 pt-3 border-t border-gray-800">
                  <div className="text-right">
                    <p className="text-gray-400 text-xs uppercase">Total presupuesto</p>
                    <p className="text-white text-2xl font-bold font-mono">{calcularTotal(lineas).toFixed(2)} EUR</p>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-gray-400 text-xs uppercase mb-1 block">Observaciones</label>
                <textarea value={observaciones} onChange={e => setObservaciones(e.target.value)} rows={2} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm" placeholder="Condiciones, notas adicionales..." />
              </div>

              <div className="flex gap-3">
                <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm">
                  {editandoId ? 'Guardar cambios' : 'Crear presupuesto'}
                </button>
                <button type="button" onClick={() => { setMostrarForm(false); setEditandoId(null) }} className="bg-gray-800 text-gray-400 px-4 py-2 rounded-lg text-sm">
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        )}

        {presDetalle && (
          <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4">
            <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-2xl max-h-screen overflow-y-auto">
              <div className="sticky top-0 bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between">
                <div>
                  <span className="text-blue-400 font-mono text-sm">{presDetalle.numero}</span>
                  <h2 className="text-white font-bold text-lg">{presDetalle.titulo}</h2>
                </div>
                <button onClick={() => setDetalleId(null)} className="text-gray-400 hover:text-white text-xl">X</button>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
                  <div className="bg-gray-800 rounded-lg p-3">
                    <p className="text-gray-400 text-xs mb-1">Cliente</p>
                    <p className="text-white">{presDetalle.clientes?.nombre || '—'}</p>
                  </div>
                  <div className="bg-gray-800 rounded-lg p-3">
                    <p className="text-gray-400 text-xs mb-1">Estado</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${ESTADOS[presDetalle.estado]?.clase}`}>{ESTADOS[presDetalle.estado]?.label}</span>
                  </div>
                  <div className="bg-gray-800 rounded-lg p-3">
                    <p className="text-gray-400 text-xs mb-1">Fecha</p>
                    <p className="text-white">{presDetalle.created_at ? new Date(presDetalle.created_at).toLocaleDateString('es-ES') : '—'}</p>
                  </div>
                  <div className="bg-gray-800 rounded-lg p-3">
                    <p className="text-gray-400 text-xs mb-1">Validez</p>
                    <p className="text-white">{presDetalle.validez_dias || 30} dias</p>
                  </div>
                </div>

                {presDetalle.descripcion && (
                  <div className="bg-gray-800 rounded-lg p-3 mb-4">
                    <p className="text-gray-400 text-xs mb-1">Descripcion</p>
                    <p className="text-white text-sm">{presDetalle.descripcion}</p>
                  </div>
                )}

                <div className="mb-4">
                  <h3 className="text-white font-semibold mb-3">Lineas</h3>
                  <div className="bg-gray-800 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-700">
                          <th className="text-left px-4 py-2 text-gray-400 text-xs">Descripcion</th>
                          <th className="text-center px-4 py-2 text-gray-400 text-xs">Cant.</th>
                          <th className="text-right px-4 py-2 text-gray-400 text-xs">Precio</th>
                          <th className="text-right px-4 py-2 text-gray-400 text-xs">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(presDetalle.lineas || []).map((l: any, i: number) => (
                          <tr key={i} className="border-b border-gray-700">
                            <td className="px-4 py-2 text-white">{l.descripcion}</td>
                            <td className="px-4 py-2 text-gray-400 text-center">{l.cantidad}</td>
                            <td className="px-4 py-2 text-gray-400 text-right font-mono">{parseFloat(l.precio).toFixed(2)}</td>
                            <td className="px-4 py-2 text-white text-right font-mono">{((parseFloat(l.cantidad) || 0) * (parseFloat(l.precio) || 0)).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-gray-600">
                          <td colSpan={3} className="px-4 py-3 text-right text-white font-semibold">TOTAL</td>
                          <td className="px-4 py-3 text-right text-white font-bold font-mono text-lg">{(presDetalle.total || 0).toFixed(2)} EUR</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                {presDetalle.observaciones && (
                  <div className="bg-gray-800 rounded-lg p-3 mb-4">
                    <p className="text-gray-400 text-xs mb-1">Observaciones</p>
                    <p className="text-white text-sm">{presDetalle.observaciones}</p>
                  </div>
                )}

                <div className="border-t border-gray-800 pt-4 flex gap-3 flex-wrap">
                  {presDetalle.estado === 'borrador' && (
                    <button onClick={() => { cambiarEstado(presDetalle.id, 'enviado'); setDetalleId(null) }} className="bg-blue-900 hover:bg-blue-800 text-blue-300 px-4 py-2 rounded-lg text-sm">
                      Marcar enviado
                    </button>
                  )}
                  {presDetalle.estado === 'enviado' && (
                    <>
                      <button onClick={() => { cambiarEstado(presDetalle.id, 'aceptado'); setDetalleId(null) }} className="bg-green-900 hover:bg-green-800 text-green-300 px-4 py-2 rounded-lg text-sm">
                        Aceptado
                      </button>
                      <button onClick={() => { cambiarEstado(presDetalle.id, 'rechazado'); setDetalleId(null) }} className="bg-red-900 hover:bg-red-800 text-red-300 px-4 py-2 rounded-lg text-sm">
                        Rechazado
                      </button>
                    </>
                  )}
                  <button onClick={() => abrirFormEditar(presDetalle)} className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-4 py-2 rounded-lg text-sm">
                    Editar
                  </button>
                  <button onClick={() => eliminarPresupuesto(presDetalle.id)} className="bg-gray-800 hover:bg-gray-700 text-red-400 px-4 py-2 rounded-lg text-sm">
                    Eliminar
                  </button>
                  <button onClick={() => setDetalleId(null)} className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-4 py-2 rounded-lg text-sm ml-auto">
                    Cerrar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <p className="text-gray-400">Cargando...</p>
        ) : presupuestos.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <p className="text-4xl mb-3">📄</p>
            <p>No hay presupuestos. Crea el primero.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {presupuestos.map(p => (
              <div key={p.id} onClick={() => setDetalleId(p.id)} className="bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-xl p-5 cursor-pointer transition-colors">
                <div className="flex items-start justify-between flex-wrap gap-3">
                  <div>
                    <div className="flex items-center gap-3 mb-1 flex-wrap">
                      <span className="text-blue-400 font-mono text-sm">{p.numero}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${ESTADOS[p.estado]?.clase}`}>{ESTADOS[p.estado]?.label}</span>
                    </div>
                    <p className="text-white font-semibold">{p.titulo}</p>
                    <p className="text-gray-400 text-sm mt-1">{p.clientes?.nombre || '—'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-white font-bold font-mono text-lg">{(p.total || 0).toFixed(2)} EUR</p>
                    <p className="text-gray-500 text-xs">{p.created_at ? new Date(p.created_at).toLocaleDateString('es-ES') : '—'}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}