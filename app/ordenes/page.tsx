'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function Ordenes() {
  const [ordenes, setOrdenes] = useState<any[]>([])
  const [clientes, setClientes] = useState<any[]>([])
  const [tecnicos, setTecnicos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [filtroEstado, setFiltroEstado] = useState('')
  const [ordenDetalle, setOrdenDetalle] = useState<any>(null)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [subiendo, setSubiendo] = useState(false)
  const router = useRouter()

  const [tipo, setTipo] = useState('limpieza')
  const [clienteId, setClienteId] = useState('')
  const [tecnicosSeleccionados, setTecnicosSeleccionados] = useState<string[]>([])
  const [fecha, setFecha] = useState('')
  const [prioridad, setPrioridad] = useState('normal')
  const [estado, setEstado] = useState('pendiente')
  const [descripcion, setDescripcion] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [duracionHoras, setDuracionHoras] = useState('2')
  const [horaFija, setHoraFija] = useState(false)

  useEffect(() => {
    verificarSesion()
    cargarDatos()
  }, [])

  async function verificarSesion() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) router.push('/login')
  }

  async function cargarDatos() {
    const [ords, clis, tecs] = await Promise.all([
      supabase.from('ordenes').select('*, clientes(nombre)').order('created_at', { ascending: false }),
      supabase.from('clientes').select('*').order('nombre'),
      supabase.from('perfiles').select('*').order('nombre'),
    ])
    if (ords.data) setOrdenes(ords.data)
    if (clis.data) setClientes(clis.data)
    if (tecs.data) setTecnicos(tecs.data)
    setLoading(false)
  }

  async function cargarFotosOrden(ordenId: string) {
    const { data } = await supabase.from('fotos_ordenes').select('*').eq('orden_id', ordenId).order('created_at')
    return data || []
  }

  async function abrirDetalle(o: any) {
    const fotos = await cargarFotosOrden(o.id)
    setOrdenDetalle({ ...o, fotos })
  }

  function abrirFormNuevo() {
    setEditandoId(null)
    setTipo('limpieza'); setClienteId(''); setTecnicosSeleccionados([])
    setFecha(''); setPrioridad('normal'); setEstado('pendiente')
    setDescripcion(''); setObservaciones(''); setDuracionHoras('2'); setHoraFija(false)
    setMostrarForm(true)
  }

  function abrirFormEditar(o: any) {
    setEditandoId(o.id)
    setTipo(o.tipo || 'limpieza'); setClienteId(o.cliente_id || '')
    setTecnicosSeleccionados(o.tecnicos_ids || [])
    setFecha(o.fecha_programada ? new Date(o.fecha_programada).toISOString().slice(0, 16) : '')
    setPrioridad(o.prioridad || 'normal'); setEstado(o.estado || 'pendiente')
    setDescripcion(o.descripcion || ''); setObservaciones(o.observaciones || '')
    setDuracionHoras(String(o.duracion_horas || 2)); setHoraFija(o.hora_fija || false)
    setMostrarForm(true); setOrdenDetalle(null)
  }

  async function subirFoto(e: React.ChangeEvent<HTMLInputElement>, tipoFoto: string) {
    const file = e.target.files?.[0]
    if (!file || !ordenDetalle) return
    setSubiendo(true)
    try {
      const comprimida = await comprimirImagen(file)
      const nombreArchivo = `${ordenDetalle.clientes?.nombre?.replace(/[^a-zA-Z0-9]/g, '_') || ordenDetalle.id}/${new Date().toISOString().slice(0, 10)}/${tipoFoto}/${Date.now()}.jpg`
      const { data, error } = await supabase.storage.from('fotos-ordenes').upload(nombreArchivo, comprimida, { contentType: 'image/jpeg' })
      if (!error && data) {
        const { data: urlData } = supabase.storage.from('fotos-ordenes').getPublicUrl(nombreArchivo)
        const { data: { session } } = await supabase.auth.getSession()
        await supabase.from('fotos_ordenes').insert({ orden_id: ordenDetalle.id, tipo: tipoFoto, url: urlData.publicUrl, subida_por: session?.user?.id })
        const fotos = await cargarFotosOrden(ordenDetalle.id)
        setOrdenDetalle((prev: any) => ({ ...prev, fotos }))
      }
    } catch { alert('Error al subir la foto.') }
    setSubiendo(false)
  }

  async function comprimirImagen(file: File, maxWidth = 1200, calidad = 0.75): Promise<Blob> {
    return new Promise((resolve) => {
      const img = new Image()
      const url = URL.createObjectURL(file)
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let width = img.width; let height = img.height
        if (width > maxWidth) { height = Math.round((height * maxWidth) / width); width = maxWidth }
        canvas.width = width; canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx?.drawImage(img, 0, 0, width, height)
        canvas.toBlob((blob) => resolve(blob || file), 'image/jpeg', calidad)
        URL.revokeObjectURL(url)
      }
      img.src = url
    })
  }

  function toggleTecnico(id: string) {
    setTecnicosSeleccionados(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id])
  }

  async function generarCodigo(tipo: string) {
    const prefijos: any = { limpieza: 'LIM', sustitucion: 'SUS', mantenimiento: 'MAN', instalacion: 'INS', revision: 'REV', otro: 'OTR' }
    const { count } = await supabase.from('ordenes').select('*', { count: 'exact', head: true }).eq('tipo', tipo)
    const num = String((count || 0) + 1).padStart(4, '0')
    return `${prefijos[tipo] || 'OTR'}-${new Date().getFullYear()}-${num}`
  }

  async function guardarOrden(e: React.FormEvent) {
    e.preventDefault()
    const datos = {
      tipo, cliente_id: clienteId, tecnico_id: tecnicosSeleccionados[0] || null,
      tecnicos_ids: tecnicosSeleccionados, fecha_programada: fecha, prioridad, estado,
      descripcion, observaciones, duracion_horas: parseFloat(duracionHoras) || 2, hora_fija: horaFija,
    }
    if (editandoId) {
      await supabase.from('ordenes').update(datos).eq('id', editandoId)
    } else {
      const nuevoCodigo = await generarCodigo(tipo)
      await supabase.from('ordenes').insert({ ...datos, codigo: nuevoCodigo })
    }
    setMostrarForm(false); setEditandoId(null)
    setDescripcion(''); setObservaciones(''); setClienteId(''); setTecnicosSeleccionados([])
    cargarDatos()
  }

  async function cambiarEstado(id: string, nuevoEstado: string) {
    await supabase.from('ordenes').update({ estado: nuevoEstado }).eq('id', id)
    cargarDatos()
    if (ordenDetalle?.id === id) setOrdenDetalle((prev: any) => ({ ...prev, estado: nuevoEstado }))
  }

  async function eliminarOrden(id: string) {
    if (!confirm('Eliminar esta orden?')) return
    await supabase.from('ordenes').delete().eq('id', id)
    cargarDatos(); setOrdenDetalle(null)
  }

  function getNombresTecnicos(ids: string[]) {
    if (!ids || ids.length === 0) return 'Sin asignar'
    return ids.map(id => tecnicos.find(t => t.id === id)?.nombre || '').filter(Boolean).join(', ')
  }

  const TIPOS_FOTO = [
    { key: 'proceso', label: 'Fotos del proceso' },
    { key: 'equipo_salida', label: 'Equipo al salir' },
    { key: 'equipo_retorno', label: 'Equipo al retornar' },
    { key: 'cierre', label: 'Fotos de cierre' },
    { key: 'albaran', label: 'Albaran' },
  ]

  const ESTADO_COLORS: any = {
    pendiente: { bg: 'rgba(124,58,237,0.2)', color: '#a78bfa' },
    en_curso: { bg: 'rgba(234,179,8,0.2)', color: '#fbbf24' },
    completada: { bg: 'rgba(16,185,129,0.2)', color: '#34d399' },
    cancelada: { bg: 'rgba(71,85,105,0.2)', color: '#64748b' },
  }

  const PRIORIDAD_COLORS: any = {
    baja: '#64748b', normal: '#06b6d4', alta: '#f59e0b', urgente: '#ef4444'
  }

  const ordenesFiltradas = filtroEstado ? ordenes.filter(o => o.estado === filtroEstado) : ordenes

  const inputStyle = { background: '#080b14', border: '1px solid #1e2d3d', color: 'white' }
  const cardStyle = { background: '#0d1117', border: '1px solid #1e2d3d' }

  return (
    <div className="min-h-screen" style={{ background: '#080b14' }}>
      <div className="px-6 py-4 flex items-center justify-between flex-wrap gap-3" style={cardStyle}>
        <div className="flex items-center gap-4">
          <a href="/dashboard" className="text-sm transition-colors" style={{ color: '#475569' }}
            onMouseEnter={e => e.currentTarget.style.color = '#06b6d4'}
            onMouseLeave={e => e.currentTarget.style.color = '#475569'}>
            Dashboard
          </a>
          <h1 className="text-white font-bold text-lg">Ordenes de trabajo</h1>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}
            className="text-sm rounded-xl px-3 py-2 outline-none" style={inputStyle}>
            <option value="">Todos los estados</option>
            <option value="pendiente">Pendiente</option>
            <option value="en_curso">En curso</option>
            <option value="completada">Completada</option>
            <option value="cancelada">Cancelada</option>
          </select>
          <button onClick={abrirFormNuevo} className="text-white text-sm px-4 py-2 rounded-xl font-medium"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #06b6d4)' }}>
            + Nueva OT
          </button>
        </div>
      </div>

      <div className="p-6 max-w-5xl mx-auto">
        {mostrarForm && (
          <div className="rounded-2xl p-6 mb-6" style={cardStyle}>
            <h2 className="text-white font-semibold mb-5">{editandoId ? 'Editar orden' : 'Nueva orden de trabajo'}</h2>
            <form onSubmit={guardarOrden} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { label: 'Tipo', el: <select value={tipo} onChange={e => setTipo(e.target.value)} className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={inputStyle}>
                  <option value="limpieza">Limpieza</option><option value="sustitucion">Sustitucion</option>
                  <option value="mantenimiento">Mantenimiento</option><option value="instalacion">Instalacion</option>
                  <option value="revision">Revision</option><option value="otro">Otro</option>
                </select> },
                { label: 'Cliente', el: <select value={clienteId} onChange={e => setClienteId(e.target.value)} required className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={inputStyle}>
                  <option value="">Seleccionar cliente...</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select> },
              ].map((f, i) => (
                <div key={i}>
                  <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: '#475569' }}>{f.label}</label>
                  {f.el}
                </div>
              ))}
              <div className="md:col-span-2">
                <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: '#475569' }}>Trabajadores</label>
                <div className="flex flex-wrap gap-2">
                  {tecnicos.map(t => (
                    <button key={t.id} type="button" onClick={() => toggleTecnico(t.id)}
                      className="px-3 py-1.5 rounded-xl text-sm transition-all"
                      style={tecnicosSeleccionados.includes(t.id)
                        ? { background: 'linear-gradient(135deg, #7c3aed, #06b6d4)', color: 'white', border: 'none' }
                        : { background: '#080b14', color: '#64748b', border: '1px solid #1e2d3d' }}>
                      {t.nombre}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: '#475569' }}>Fecha programada</label>
                <input type="datetime-local" value={fecha} onChange={e => setFecha(e.target.value)} required className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={inputStyle} />
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: '#475569' }}>Prioridad</label>
                <select value={prioridad} onChange={e => setPrioridad(e.target.value)} className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={inputStyle}>
                  <option value="baja">Baja</option><option value="normal">Normal</option>
                  <option value="alta">Alta</option><option value="urgente">Urgente</option>
                </select>
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: '#475569' }}>Estado</label>
                <select value={estado} onChange={e => setEstado(e.target.value)} className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={inputStyle}>
                  <option value="pendiente">Pendiente</option><option value="en_curso">En curso</option>
                  <option value="completada">Completada</option><option value="cancelada">Cancelada</option>
                </select>
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: '#475569' }}>Duracion estimada</label>
                <select value={duracionHoras} onChange={e => setDuracionHoras(e.target.value)} className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={inputStyle}>
                  <option value="0.5">30 min</option><option value="1">1 hora</option>
                  <option value="1.5">1.5 horas</option><option value="2">2 horas</option>
                  <option value="2.5">2.5 horas</option><option value="3">3 horas</option>
                  <option value="4">4 horas</option><option value="5">5 horas</option>
                  <option value="6">6 horas</option><option value="8">Jornada completa</option>
                </select>
              </div>
              <div className="flex items-center gap-3 rounded-xl px-3 py-2 mt-auto" style={{ background: '#080b14', border: '1px solid #1e2d3d' }}>
                <input type="checkbox" id="hora-fija" checked={horaFija} onChange={e => setHoraFija(e.target.checked)} className="w-4 h-4" style={{ accentColor: '#7c3aed' }} />
                <label htmlFor="hora-fija" className="text-sm cursor-pointer" style={{ color: '#94a3b8' }}>Hora fija con cliente</label>
              </div>
              <div className="md:col-span-2">
                <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: '#475569' }}>Descripcion</label>
                <textarea value={descripcion} onChange={e => setDescripcion(e.target.value)} required rows={3}
                  className="w-full rounded-xl px-3 py-2 text-white text-sm outline-none resize-none"
                  style={inputStyle} placeholder="Describe los trabajos a realizar..." />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: '#475569' }}>Observaciones</label>
                <textarea value={observaciones} onChange={e => setObservaciones(e.target.value)} rows={2}
                  className="w-full rounded-xl px-3 py-2 text-white text-sm outline-none resize-none"
                  style={inputStyle} placeholder="Instrucciones especiales..." />
              </div>
              <div className="md:col-span-2 flex gap-3">
                <button type="submit" className="text-white px-5 py-2 rounded-xl text-sm font-medium"
                  style={{ background: 'linear-gradient(135deg, #7c3aed, #06b6d4)' }}>
                  {editandoId ? 'Guardar cambios' : 'Crear OT'}
                </button>
                <button type="button" onClick={() => { setMostrarForm(false); setEditandoId(null) }}
                  className="text-sm px-5 py-2 rounded-xl" style={{ background: '#080b14', color: '#64748b', border: '1px solid #1e2d3d' }}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        )}

        {ordenDetalle && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.8)' }}>
            <div className="w-full max-w-2xl max-h-screen overflow-y-auto rounded-2xl" style={cardStyle}>
              <div className="sticky top-0 px-6 py-4 flex items-center justify-between rounded-t-2xl" style={{ background: '#0d1117', borderBottom: '1px solid #1e2d3d' }}>
                <div>
                  <span className="font-mono text-sm" style={{ color: '#06b6d4' }}>{ordenDetalle.codigo}</span>
                  <h2 className="text-white font-bold text-lg">{ordenDetalle.clientes?.nombre || '—'}</h2>
                </div>
                <button onClick={() => setOrdenDetalle(null)} className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors" style={{ color: '#64748b', border: '1px solid #1e2d3d' }}>X</button>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {[
                    { label: 'Estado', val: <span className="text-xs px-2 py-1 rounded-full" style={{ background: ESTADO_COLORS[ordenDetalle.estado]?.bg, color: ESTADO_COLORS[ordenDetalle.estado]?.color }}>{ordenDetalle.estado.replace('_', ' ')}</span> },
                    { label: 'Prioridad', val: <span className="text-sm font-medium" style={{ color: PRIORIDAD_COLORS[ordenDetalle.prioridad] }}>{ordenDetalle.prioridad}</span> },
                    { label: 'Tipo', val: <span className="text-white text-sm capitalize">{ordenDetalle.tipo}</span> },
                    { label: 'Fecha', val: <span className="text-white text-sm">{ordenDetalle.fecha_programada ? new Date(ordenDetalle.fecha_programada).toLocaleDateString('es-ES') : '—'}</span> },
                    { label: 'Duracion', val: <span className="text-white text-sm">{ordenDetalle.duracion_horas || 2}h</span> },
                    { label: 'Hora fija', val: <span className="text-sm font-medium" style={{ color: ordenDetalle.hora_fija ? '#f59e0b' : '#64748b' }}>{ordenDetalle.hora_fija ? 'Si' : 'No'}</span> },
                  ].map((item, i) => (
                    <div key={i} className="rounded-xl p-3" style={{ background: '#080b14', border: '1px solid #1e2d3d' }}>
                      <p className="text-xs uppercase tracking-wider mb-1" style={{ color: '#475569' }}>{item.label}</p>
                      {item.val}
                    </div>
                  ))}
                </div>
                <div className="rounded-xl p-3 mb-4" style={{ background: '#080b14', border: '1px solid #1e2d3d' }}>
                  <p className="text-xs uppercase tracking-wider mb-1" style={{ color: '#475569' }}>Trabajadores</p>
                  <p className="text-white text-sm">{getNombresTecnicos(ordenDetalle.tecnicos_ids || [])}</p>
                </div>
                {ordenDetalle.descripcion && (
                  <div className="rounded-xl p-3 mb-4" style={{ background: '#080b14', border: '1px solid #1e2d3d' }}>
                    <p className="text-xs uppercase tracking-wider mb-2" style={{ color: '#475569' }}>Trabajos a realizar</p>
                    <p className="text-white text-sm leading-relaxed">{ordenDetalle.descripcion}</p>
                  </div>
                )}
                {ordenDetalle.observaciones && (
                  <div className="rounded-xl p-3 mb-4" style={{ background: '#080b14', border: '1px solid #1e2d3d' }}>
                    <p className="text-xs uppercase tracking-wider mb-2" style={{ color: '#475569' }}>Observaciones</p>
                    <p className="text-white text-sm leading-relaxed">{ordenDetalle.observaciones}</p>
                  </div>
                )}

                <div className="rounded-2xl p-4 mb-4" style={{ background: 'rgba(6,182,212,0.05)', border: '1px solid rgba(6,182,212,0.2)' }}>
                  <p className="font-medium text-sm mb-1" style={{ color: '#06b6d4' }}>Escanear material o equipo</p>
                  <p className="text-xs mb-3" style={{ color: '#475569' }}>Escanea el QR para registrar salida vinculada a esta OT.</p>
                  <button onClick={() => router.push(`/escanear?orden=${ordenDetalle.id}`)}
                    className="w-full py-2.5 rounded-xl text-sm font-medium text-white"
                    style={{ background: 'linear-gradient(135deg, #059669, #06b6d4)' }}>
                    Abrir escaner QR
                  </button>
                </div>

                <div className="mb-4">
                  <h3 className="text-white font-semibold mb-3">Fotos</h3>
                  {subiendo && <p className="text-sm mb-3" style={{ color: '#06b6d4' }}>Subiendo foto...</p>}
                  {TIPOS_FOTO.map(tf => {
                    const fotosDelTipo = (ordenDetalle.fotos || []).filter((f: any) => f.tipo === tf.key)
                    return (
                      <div key={tf.key} className="mb-4">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs uppercase tracking-wider" style={{ color: '#475569' }}>{tf.label}</p>
                          <label className="text-xs px-3 py-1 rounded-lg cursor-pointer transition-colors" style={{ background: '#080b14', color: '#06b6d4', border: '1px solid #1e2d3d' }}>
                            + Foto
                            <input type="file" accept="image/*" className="hidden" onChange={e => subirFoto(e, tf.key)} />
                          </label>
                        </div>
                        {fotosDelTipo.length > 0 ? (
                          <div className="grid grid-cols-3 gap-2">
                            {fotosDelTipo.map((f: any) => (
                              <a key={f.id} href={f.url} target="_blank" rel="noreferrer">
                                <img src={f.url} alt="foto" className="w-full h-24 object-cover rounded-xl" style={{ border: '1px solid #1e2d3d' }} />
                              </a>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs" style={{ color: '#334155' }}>Sin fotos</p>
                        )}
                      </div>
                    )
                  })}
                </div>

                <div className="flex gap-3 flex-wrap pt-4" style={{ borderTop: '1px solid #1e2d3d' }}>
                  {ordenDetalle.estado === 'pendiente' && (
                    <button onClick={() => cambiarEstado(ordenDetalle.id, 'en_curso')}
                      className="text-sm px-4 py-2 rounded-xl font-medium"
                      style={{ background: 'rgba(234,179,8,0.15)', color: '#fbbf24', border: '1px solid rgba(234,179,8,0.3)' }}>
                      Iniciar trabajo
                    </button>
                  )}
                  {ordenDetalle.estado === 'en_curso' && (
                    <button onClick={() => cambiarEstado(ordenDetalle.id, 'completada')}
                      className="text-sm px-4 py-2 rounded-xl font-medium"
                      style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399', border: '1px solid rgba(16,185,129,0.3)' }}>
                      Completar
                    </button>
                  )}
                  <button onClick={() => abrirFormEditar(ordenDetalle)}
                    className="text-sm px-4 py-2 rounded-xl"
                    style={{ background: 'rgba(124,58,237,0.15)', color: '#a78bfa', border: '1px solid rgba(124,58,237,0.3)' }}>
                    Editar OT
                  </button>
                  <button onClick={() => eliminarOrden(ordenDetalle.id)}
                    className="text-sm px-4 py-2 rounded-xl"
                    style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
                    Eliminar
                  </button>
                  <button onClick={() => setOrdenDetalle(null)}
                    className="text-sm px-4 py-2 rounded-xl ml-auto"
                    style={{ background: '#080b14', color: '#64748b', border: '1px solid #1e2d3d' }}>
                    Cerrar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#7c3aed', borderTopColor: 'transparent' }}></div>
          </div>
        ) : ordenesFiltradas.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-5xl mb-4">📋</p>
            <p style={{ color: '#475569' }}>No hay ordenes. Crea la primera.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {ordenesFiltradas.map(o => (
              <div key={o.id} onClick={() => abrirDetalle(o)}
                className="rounded-2xl p-5 cursor-pointer transition-all"
                style={cardStyle}
                onMouseEnter={e => e.currentTarget.style.borderColor = '#7c3aed'}
                onMouseLeave={e => e.currentTarget.style.borderColor = '#1e2d3d'}>
                <div className="flex items-start justify-between flex-wrap gap-3">
                  <div>
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <span className="font-mono text-sm" style={{ color: '#06b6d4' }}>{o.codigo}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: ESTADO_COLORS[o.estado]?.bg, color: ESTADO_COLORS[o.estado]?.color }}>
                        {o.estado.replace('_', ' ')}
                      </span>
                      <span className="text-xs font-medium" style={{ color: PRIORIDAD_COLORS[o.prioridad] }}>{o.prioridad}</span>
                      {o.hora_fija && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>Hora fija</span>}
                    </div>
                    <p className="text-white font-medium">{o.clientes?.nombre || '—'}</p>
                    <p className="text-sm mt-1" style={{ color: '#475569' }}>{(o.descripcion || '').substring(0, 100)}{(o.descripcion || '').length > 100 ? '...' : ''}</p>
                    <div className="flex gap-4 mt-2 text-xs flex-wrap" style={{ color: '#334155' }}>
                      <span>Trabajadores: {getNombresTecnicos(o.tecnicos_ids || [])}</span>
                      <span>Duracion: {o.duracion_horas || 2}h</span>
                      <span>Fecha: {o.fecha_programada ? new Date(o.fecha_programada).toLocaleDateString('es-ES') : '—'}</span>
                    </div>
                  </div>
                  <span className="text-xs" style={{ color: '#334155' }}>Ver detalle →</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}