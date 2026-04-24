'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { s } from '@/lib/styles'

export default function Planificacion() {
  const [ordenes, setOrdenes] = useState<any[]>([])
  const [clientes, setClientes] = useState<any[]>([])
  const [tecnicos, setTecnicos] = useState<any[]>([])
  const [presupuestos, setPresupuestos] = useState<any[]>([])
  const [userId, setUserId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [mesActual, setMesActual] = useState(new Date())
  const [ordenSeleccionada, setOrdenSeleccionada] = useState<any>(null)
  const [vistaActiva, setVistaActiva] = useState<'calendario' | 'mis_ordenes' | 'presupuestos' | 'rutas'>('calendario')
  const [mostrarFormPres, setMostrarFormPres] = useState(false)
  const [editandoPres, setEditandoPres] = useState<any>(null)
  const [fechaRuta, setFechaRuta] = useState(new Date().toISOString().slice(0, 10))
  const [resultadoRuta, setResultadoRuta] = useState<any>(null)
  const [calculando, setCalculando] = useState(false)
  const [escaneando, setEscaneando] = useState(false)
  const [datosEscaneados, setDatosEscaneados] = useState<any>(null)
  const router = useRouter()

  const [presClienteId, setPresClienteId] = useState('')
  const [presTitulo, setPresTitulo] = useState('')
  const [presImporte, setPresImporte] = useState('0')
  const [presEstado, setPresEstado] = useState('enviado')
  const [presFecha, setPresFecha] = useState('')
  const [presObs, setPresObs] = useState('')

  useEffect(() => { cargarDatos() }, [])

  async function cargarDatos() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }
    setUserId(session.user.id)
    const [ords, clis, tecs, pres] = await Promise.all([
      supabase.from('ordenes').select('*').neq('estado', 'cancelada'),
      supabase.from('clientes').select('*'),
      supabase.from('perfiles').select('*'),
      supabase.from('presupuestos').select('*, clientes(nombre)').order('created_at', { ascending: false }),
    ])
    if (ords.data) setOrdenes(ords.data)
    if (clis.data) setClientes(clis.data)
    if (tecs.data) setTecnicos(tecs.data)
    if (pres.data) setPresupuestos(pres.data)
    setLoading(false)
  }

  function getNombreCliente(id: string) {
    return clientes.find(c => c.id === id)?.nombre || '—'
  }

  function getNombresTecnicos(ids: string[]) {
    if (!ids || ids.length === 0) return 'Sin asignar'
    return ids.map(id => tecnicos.find(t => t.id === id)?.nombre || '').filter(Boolean).join(', ')
  }

  function mesAnterior() {
    const d = new Date(mesActual); d.setMonth(d.getMonth() - 1); setMesActual(d)
  }

  function mesSiguiente() {
    const d = new Date(mesActual); d.setMonth(d.getMonth() + 1); setMesActual(d)
  }

  function getDiasMes() {
    const anio = mesActual.getFullYear()
    const mes = mesActual.getMonth()
    const primerDia = new Date(anio, mes, 1)
    const ultimoDia = new Date(anio, mes + 1, 0)
    const dias: (Date | null)[] = []
    let diaSemana = primerDia.getDay()
    diaSemana = diaSemana === 0 ? 6 : diaSemana - 1
    for (let i = 0; i < diaSemana; i++) dias.push(null)
    for (let d = 1; d <= ultimoDia.getDate(); d++) dias.push(new Date(anio, mes, d))
    return dias
  }

  function getOrdenesDelDia(dia: Date) {
    return ordenes.filter(o => {
      if (!o.fecha_programada) return false
      const f = new Date(o.fecha_programada)
      return f.getDate() === dia.getDate() && f.getMonth() === dia.getMonth() && f.getFullYear() === dia.getFullYear()
    })
  }

  const ZONAS: any = {
    'alicante': { nombre: 'Alicante', orden: 2, tiempo_desde_elche: 30 },
    'elche': { nombre: 'Elche', orden: 1, tiempo_desde_elche: 0 },
    'santa pola': { nombre: 'Santa Pola', orden: 2, tiempo_desde_elche: 20 },
    'murcia': { nombre: 'Murcia', orden: 4, tiempo_desde_elche: 60 },
    'denia': { nombre: 'Denia', orden: 3, tiempo_desde_elche: 90 },
    'torrevieja': { nombre: 'Torrevieja', orden: 3, tiempo_desde_elche: 40 },
    'guardamar': { nombre: 'Guardamar', orden: 2, tiempo_desde_elche: 25 },
    'benidorm': { nombre: 'Benidorm', orden: 3, tiempo_desde_elche: 70 },
    'crevillente': { nombre: 'Crevillente', orden: 1, tiempo_desde_elche: 10 },
    'orihuela': { nombre: 'Orihuela', orden: 3, tiempo_desde_elche: 45 },
  }

  function detectarZona(direccion: string): string {
    if (!direccion) return 'elche'
    const dir = direccion.toLowerCase()
    for (const zona of Object.keys(ZONAS)) { if (dir.includes(zona)) return zona }
    return 'elche'
  }

  function calcularTiempoEntreZonas(zona1: string, zona2: string): number {
    const t1 = ZONAS[zona1]?.tiempo_desde_elche || 30
    const t2 = ZONAS[zona2]?.tiempo_desde_elche || 30
    return Math.abs(t1 - t2) + 15
  }

  function formatHora(minutos: number): string {
    const h = Math.floor(minutos / 60)
    const m = minutos % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  }

  function optimizarRutaTecnico(otsDelDia: any[], tecnicoId: string) {
    const INICIO = 8 * 60; const FIN = 16 * 60
    const otsTecnico = otsDelDia.filter(o => o.tecnicos_ids?.includes(tecnicoId) || o.tecnico_id === tecnicoId)
    const otsConHora = otsTecnico.filter(o => o.hora_fija && o.fecha_programada).sort((a, b) => new Date(a.fecha_programada).getTime() - new Date(b.fecha_programada).getTime())
    const otsSinHora = otsTecnico.filter(o => !o.hora_fija).sort((a, b) => {
      const zA = detectarZona(clientes.find((c: any) => c.id === a.cliente_id)?.direccion || '')
      const zB = detectarZona(clientes.find((c: any) => c.id === b.cliente_id)?.direccion || '')
      return (ZONAS[zA]?.orden || 99) - (ZONAS[zB]?.orden || 99)
    })
    const ruta: any[] = []
    let horaActual = INICIO; let zonaActual = 'elche'
    for (const ot of otsConHora) {
      const horaOT = new Date(ot.fecha_programada)
      const minutos = horaOT.getHours() * 60 + horaOT.getMinutes()
      const zona = detectarZona(clientes.find((c: any) => c.id === ot.cliente_id)?.direccion || '')
      const duracion = (ot.duracion_horas || 2) * 60
      ruta.push({ ot, horaInicio: minutos, horaFin: minutos + duracion, zona, horaFija: true, traslado: 0, fueraDeJornada: minutos + duracion > FIN, cliente: clientes.find((c: any) => c.id === ot.cliente_id) })
      horaActual = minutos + duracion; zonaActual = zona
    }
    for (const ot of otsSinHora) {
      const zona = detectarZona(clientes.find((c: any) => c.id === ot.cliente_id)?.direccion || '')
      const tiempoTraslado = calcularTiempoEntreZonas(zonaActual, zona)
      const duracion = (ot.duracion_horas || 2) * 60
      const horaInicio = horaActual + tiempoTraslado
      const horaFin = horaInicio + duracion
      ruta.push({ ot, horaInicio, horaFin, zona, horaFija: false, traslado: tiempoTraslado, fueraDeJornada: horaFin > FIN, cliente: clientes.find((c: any) => c.id === ot.cliente_id) })
      horaActual = horaFin; zonaActual = zona
    }
    return { ruta, horasTotales: otsTecnico.reduce((acc, o) => acc + (o.duracion_horas || 2), 0), cabeEnJornada: horaActual <= FIN, horaFinal: horaActual }
  }

  function calcularRutas() {
    setCalculando(true)
    const otsDelDia = ordenes.filter(o => {
      if (!o.fecha_programada) return false
      const f = new Date(o.fecha_programada)
      return f.toISOString().slice(0, 10) === fechaRuta && (o.estado === 'pendiente' || o.estado === 'en_curso')
    })
    if (otsDelDia.length === 0) { setResultadoRuta({ vacio: true }); setCalculando(false); return }
    const tecnicosDelDia = tecnicos.filter(t => otsDelDia.some(o => o.tecnicos_ids?.includes(t.id) || o.tecnico_id === t.id))
    const resultados = tecnicosDelDia.map(t => ({ tecnico: t, ...optimizarRutaTecnico(otsDelDia, t.id) }))
    const otsSinAsignar = otsDelDia.filter(o => (!o.tecnicos_ids || o.tecnicos_ids.length === 0) && !o.tecnico_id)
    setResultadoRuta({ resultados, otsSinAsignar, fecha: fechaRuta, totalOTs: otsDelDia.length })
    setCalculando(false)
  }

  function convertirFecha(fecha: string): string {
    try {
      const partes = fecha.split('/')
      if (partes.length === 3) return `${partes[2]}-${partes[1].padStart(2, '0')}-${partes[0].padStart(2, '0')}`
      return new Date().toISOString().slice(0, 10)
    } catch { return new Date().toISOString().slice(0, 10) }
  }

  async function escanearPresupuesto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setEscaneando(true); setDatosEscaneados(null)
    try {
      const reader = new FileReader()
      reader.onload = async (ev) => {
        const base64 = ev.target?.result as string
        const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imagen: base64 }) })
        const data = await res.json()
        try {
          const json = JSON.parse(data.respuesta.replace(/```json|```/g, '').trim())
          setDatosEscaneados(json)
          setPresTitulo(json.descripcion || '')
          setPresImporte(String(json.importe || 0))
          setPresFecha(json.fecha ? convertirFecha(json.fecha) : new Date().toISOString().slice(0, 10))
          setPresObs(`Presupuesto ${json.numero || ''} escaneado automaticamente`)
          const clienteEncontrado = clientes.find(c => c.nombre.toLowerCase().includes((json.cliente || '').toLowerCase()) || (json.cliente || '').toLowerCase().includes(c.nombre.toLowerCase()))
          if (clienteEncontrado) setPresClienteId(clienteEncontrado.id)
          setMostrarFormPres(true)
        } catch { alert('No se pudieron extraer los datos. Intentalo de nuevo.') }
        setEscaneando(false)
      }
      reader.readAsDataURL(file)
    } catch { setEscaneando(false); alert('Error al procesar la imagen.') }
  }

  const misOrdenes = ordenes.filter(o => o.tecnicos_ids?.includes(userId) || o.tecnico_id === userId).sort((a, b) => new Date(a.fecha_programada).getTime() - new Date(b.fecha_programada).getTime())
  const misOrdenesPendientes = misOrdenes.filter(o => o.estado === 'pendiente' || o.estado === 'en_curso')
  const misOrdenesCompletadas = misOrdenes.filter(o => o.estado === 'completada')

  const COLORES_OT: any = {
    limpieza: { bg: 'rgba(6,182,212,0.2)', color: '#06b6d4' },
    sustitucion: { bg: 'rgba(234,179,8,0.2)', color: '#fbbf24' },
    mantenimiento: { bg: 'rgba(16,185,129,0.2)', color: '#34d399' },
    instalacion: { bg: 'rgba(124,58,237,0.2)', color: '#a78bfa' },
    revision: { bg: 'rgba(249,115,22,0.2)', color: '#fb923c' },
    otro: { bg: 'rgba(71,85,105,0.2)', color: '#64748b' },
  }

  const ESTADOS_OT: any = {
    pendiente: { bg: 'rgba(124,58,237,0.15)', color: '#a78bfa' },
    en_curso: { bg: 'rgba(234,179,8,0.15)', color: '#fbbf24' },
    completada: { bg: 'rgba(16,185,129,0.15)', color: '#34d399' },
    cancelada: { bg: 'rgba(71,85,105,0.15)', color: '#64748b' },
  }

  const ESTADOS_PRES: any = {
    enviado: { color: '#06b6d4', bg: 'rgba(6,182,212,0.15)', border: 'rgba(6,182,212,0.3)', label: 'Enviado' },
    pendiente: { color: '#fbbf24', bg: 'rgba(234,179,8,0.15)', border: 'rgba(234,179,8,0.3)', label: 'Pendiente' },
    aceptado: { color: '#34d399', bg: 'rgba(16,185,129,0.15)', border: 'rgba(16,185,129,0.3)', label: 'Aceptado' },
    rechazado: { color: '#f87171', bg: 'rgba(239,68,68,0.15)', border: 'rgba(239,68,68,0.3)', label: 'Rechazado' },
    expirado: { color: '#64748b', bg: 'rgba(71,85,105,0.15)', border: 'rgba(71,85,105,0.3)', label: 'Expirado' },
  }

  const hoy = new Date()
  const tituloMes = mesActual.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }).toUpperCase()
  const dias = getDiasMes()

  const otsSemana = ordenes.filter(o => {
    if (!o.fecha_programada) return false
    const f = new Date(o.fecha_programada)
    const lunes = new Date(hoy)
    lunes.setDate(hoy.getDate() - (hoy.getDay() === 0 ? 6 : hoy.getDay() - 1))
    lunes.setHours(0, 0, 0, 0)
    const domingo = new Date(lunes)
    domingo.setDate(lunes.getDate() + 6)
    domingo.setHours(23, 59, 59)
    return f >= lunes && f <= domingo
  }).sort((a, b) => new Date(a.fecha_programada).getTime() - new Date(b.fecha_programada).getTime())

  const presEnviados = presupuestos.filter(p => p.estado === 'enviado').length
  const presAceptados = presupuestos.filter(p => p.estado === 'aceptado').length
  const presPendientes = presupuestos.filter(p => p.estado === 'pendiente').length

  async function generarNumeroPres() {
    const { count } = await supabase.from('presupuestos').select('*', { count: 'exact', head: true })
    const num = String((count || 0) + 1).padStart(4, '0')
    return `PRES-${new Date().getFullYear()}-${num}`
  }

  function abrirFormPres(p?: any) {
    if (p) {
      setEditandoPres(p); setPresClienteId(p.cliente_id || ''); setPresTitulo(p.titulo || '')
      setPresImporte(String(p.importe || 0)); setPresEstado(p.estado || 'enviado')
      setPresFecha(p.fecha_envio || new Date().toISOString().slice(0, 10)); setPresObs(p.observaciones || '')
    } else {
      setEditandoPres(null); setPresClienteId(''); setPresTitulo('')
      setPresImporte('0'); setPresEstado('enviado')
      setPresFecha(new Date().toISOString().slice(0, 10)); setPresObs('')
    }
    setMostrarFormPres(true)
  }

  async function guardarPresupuesto(e: React.FormEvent) {
    e.preventDefault()
    const datos = { cliente_id: presClienteId || null, titulo: presTitulo, importe: parseFloat(presImporte) || 0, estado: presEstado, fecha_envio: presFecha, observaciones: presObs }
    if (editandoPres) {
      const { error } = await supabase.from('presupuestos').update(datos).eq('id', editandoPres.id)
      if (error) { alert('Error: ' + error.message); return }
    } else {
      const numero = await generarNumeroPres()
      const { error } = await supabase.from('presupuestos').insert({ ...datos, numero })
      if (error) { alert('Error: ' + error.message); return }
    }
    setMostrarFormPres(false); setEditandoPres(null); setDatosEscaneados(null); cargarDatos()
  }

  async function cambiarEstadoPres(id: string, nuevoEstado: string) {
    await supabase.from('presupuestos').update({ estado: nuevoEstado }).eq('id', id)
    if (nuevoEstado === 'aceptado') {
      const pres = presupuestos.find(p => p.id === id)
      if (pres) {
        const { error } = await supabase.from('ordenes').insert({
          codigo: `OT-${pres.numero || id.slice(0, 6).toUpperCase()}`,
          tipo: 'otro', cliente_id: pres.cliente_id || null, estado: 'pendiente', prioridad: 'normal',
          descripcion: pres.titulo || 'Trabajo pendiente de agendar',
          observaciones: `Creado desde presupuesto ${pres.numero || ''} aceptado. Importe: ${(pres.importe || 0).toFixed(2)} EUR`,
          duracion_horas: 2, hora_fija: false, tecnicos_ids: [],
        })
        if (!error) alert('Presupuesto aceptado. Se ha creado una OT en borrador en el calendario.')
      }
    }
    cargarDatos()
  }

  async function eliminarPres(id: string) {
    if (!confirm('Eliminar este presupuesto?')) return
    await supabase.from('presupuestos').delete().eq('id', id)
    cargarDatos()
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
      <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#7c3aed', borderTopColor: 'transparent' }}></div>
    </div>
  )

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <div className="px-6 py-4 flex items-center justify-between flex-wrap gap-3" style={s.headerStyle}>
        <div className="flex items-center gap-4">
          <a href="/dashboard" className="text-sm transition-colors" style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => e.currentTarget.style.color = '#06b6d4'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>Dashboard</a>
          <h1 className="font-bold text-lg" style={{ color: 'var(--text)' }}>Planificacion</h1>
        </div>
        {vistaActiva === 'calendario' && (
          <div className="flex items-center gap-3">
            <button onClick={mesAnterior} className="text-sm px-3 py-2 rounded-xl" style={s.btnSecondary}>Anterior</button>
            <span className="font-mono font-bold text-sm min-w-40 text-center" style={{ color: 'var(--text)' }}>{tituloMes}</span>
            <button onClick={mesSiguiente} className="text-sm px-3 py-2 rounded-xl" style={s.btnSecondary}>Siguiente</button>
          </div>
        )}
        {vistaActiva === 'presupuestos' && (
          <button onClick={() => abrirFormPres()} className="text-sm px-4 py-2 rounded-xl font-medium" style={s.btnPrimary}>
            + Nuevo presupuesto
          </button>
        )}
      </div>

      <div className="p-6 max-w-6xl mx-auto">
        <div className="flex gap-2 mb-6 flex-wrap">
          {[
            { key: 'calendario', label: 'Calendario' },
            { key: 'mis_ordenes', label: 'Mis ordenes', badge: misOrdenesPendientes.length },
            { key: 'presupuestos', label: 'Presupuestos', badge: presEnviados },
            { key: 'rutas', label: 'Optimizar rutas' },
          ].map(tab => (
            <button key={tab.key} onClick={() => setVistaActiva(tab.key as any)}
              className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
              style={vistaActiva === tab.key ? s.btnPrimary : s.btnSecondary}>
              {tab.label}
              {tab.badge && tab.badge > 0 ? (
                <span className="ml-1 text-xs px-1.5 py-0.5 rounded-full" style={{ background: '#7c3aed', color: 'white' }}>{tab.badge}</span>
              ) : null}
            </button>
          ))}
        </div>

        {ordenSeleccionada && (
          <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center" style={{ background: 'rgba(0,0,0,0.85)' }}>
            <div className="w-full md:max-w-lg rounded-t-2xl md:rounded-2xl overflow-y-auto" style={{ ...s.cardStyle, maxHeight: '92vh' }}>
              <div className="sticky top-0 px-6 py-4 flex items-start justify-between rounded-t-2xl" style={s.headerStyle}>
                <div>
                  <span className="font-mono text-sm" style={{ color: '#06b6d4' }}>{ordenSeleccionada.codigo}</span>
                  <h2 className="font-bold text-lg mt-1" style={{ color: 'var(--text)' }}>{getNombreCliente(ordenSeleccionada.cliente_id)}</h2>
                </div>
                <button onClick={() => setOrdenSeleccionada(null)} className="w-8 h-8 rounded-lg flex items-center justify-center mt-1"
                  style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}>X</button>
              </div>
              <div className="p-6 pb-16">
                {[
                  { label: 'Tipo', val: <span className="text-white capitalize">{ordenSeleccionada.tipo}</span> },
                  { label: 'Estado', val: <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: ESTADOS_OT[ordenSeleccionada.estado]?.bg, color: ESTADOS_OT[ordenSeleccionada.estado]?.color }}>{ordenSeleccionada.estado.replace('_', ' ')}</span> },
                  { label: 'Duracion', val: <span style={{ color: 'var(--text)' }}>{ordenSeleccionada.duracion_horas || 2}h</span> },
                  { label: 'Fecha', val: <span className="text-xs" style={{ color: 'var(--text)' }}>{new Date(ordenSeleccionada.fecha_programada).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span> },
                  { label: 'Trabajadores', val: <span className="text-xs" style={{ color: 'var(--text)' }}>{getNombresTecnicos(ordenSeleccionada.tecnicos_ids || [])}</span> },
                ].map((item, i) => (
                  <div key={i} className="flex justify-between items-center py-2" style={{ borderBottom: '1px solid var(--border)' }}>
                    <span style={{ color: 'var(--text-muted)' }} className="text-sm">{item.label}</span>
                    {item.val}
                  </div>
                ))}
                {ordenSeleccionada.descripcion && (
                  <div className="mt-4">
                    <p className="text-xs uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Trabajos</p>
                    <p className="text-sm rounded-xl p-3 leading-relaxed" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}>{ordenSeleccionada.descripcion}</p>
                  </div>
                )}
                <div className="flex gap-3 mt-5">
                  <button onClick={() => { router.push('/ordenes'); setOrdenSeleccionada(null) }}
                    className="text-sm px-4 py-2 rounded-xl font-medium" style={s.btnPrimary}>Ver en OT</button>
                  <button onClick={() => setOrdenSeleccionada(null)}
                    className="text-sm px-4 py-2 rounded-xl" style={s.btnSecondary}>Cerrar</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {vistaActiva === 'calendario' && (
          <>
            <div className="rounded-2xl overflow-hidden mb-6" style={s.cardStyle}>
              <div className="grid grid-cols-7" style={{ borderBottom: '1px solid var(--border)' }}>
                {['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'].map(d => (
                  <div key={d} className="text-center py-2 text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-subtle)' }}>{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {dias.map((dia, i) => {
                  if (!dia) return <div key={i} className="min-h-24" style={{ borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)', background: 'var(--bg)', opacity: 0.3 }} />
                  const esHoy = dia.getDate() === hoy.getDate() && dia.getMonth() === hoy.getMonth() && dia.getFullYear() === hoy.getFullYear()
                  const otsDelDia = getOrdenesDelDia(dia)
                  return (
                    <div key={i} className="min-h-24 p-1.5" style={{ borderBottom: '1px solid var(--border)', borderRight: '1px solid var(--border)', background: esHoy ? 'rgba(124,58,237,0.08)' : 'transparent' }}>
                      <p className="text-xs font-bold mb-1" style={{ color: esHoy ? '#a78bfa' : 'var(--text-subtle)' }}>{dia.getDate()}</p>
                      {otsDelDia.map(o => (
                        <button key={o.id} onClick={() => setOrdenSeleccionada(o)}
                          className="w-full text-left text-xs px-1.5 py-1 rounded-lg mb-1 truncate"
                          style={{ background: COLORES_OT[o.tipo]?.bg, color: COLORES_OT[o.tipo]?.color }}>
                          {o.codigo}
                        </button>
                      ))}
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="rounded-2xl p-5" style={s.cardStyle}>
              <h2 className="font-semibold mb-4" style={{ color: 'var(--text)' }}>OT de esta semana</h2>
              {otsSemana.length === 0 ? (
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Sin trabajos programados esta semana</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {otsSemana.map(o => (
                    <div key={o.id} onClick={() => setOrdenSeleccionada(o)}
                      className="flex items-start justify-between p-4 rounded-xl cursor-pointer transition-all"
                      style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = '#7c3aed'}
                      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
                      <div>
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-mono text-xs" style={{ color: '#06b6d4' }}>{o.codigo}</span>
                          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: COLORES_OT[o.tipo]?.bg, color: COLORES_OT[o.tipo]?.color }}>{o.tipo}</span>
                          {(o.tecnicos_ids?.includes(userId) || o.tecnico_id === userId) && (
                            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(124,58,237,0.2)', color: '#a78bfa' }}>Mi OT</span>
                          )}
                        </div>
                        <p className="font-medium text-sm" style={{ color: 'var(--text)' }}>{getNombreCliente(o.cliente_id)}</p>
                        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{(o.descripcion || '').substring(0, 80)}</p>
                      </div>
                      <div className="text-right ml-4">
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{new Date(o.fecha_programada).toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: '2-digit' })}</p>
                        <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>{new Date(o.fecha_programada).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {vistaActiva === 'mis_ordenes' && (
          <div>
            <div className="mb-6">
              <h2 className="font-semibold mb-1" style={{ color: 'var(--text)' }}>Mis ordenes pendientes y en curso</h2>
              <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>Solo las ordenes asignadas a ti</p>
              {misOrdenesPendientes.length === 0 ? (
                <div className="text-center py-12 rounded-2xl" style={s.cardStyle}>
                  <p className="text-3xl mb-2">✅</p>
                  <p style={{ color: 'var(--text-muted)' }}>No tienes ordenes pendientes</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {misOrdenesPendientes.map(o => (
                    <div key={o.id} onClick={() => setOrdenSeleccionada(o)}
                      className="rounded-2xl p-5 cursor-pointer transition-all" style={s.cardStyle}
                      onMouseEnter={e => e.currentTarget.style.borderColor = '#7c3aed'}
                      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
                      <div className="flex items-start justify-between flex-wrap gap-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="font-mono text-sm" style={{ color: '#06b6d4' }}>{o.codigo}</span>
                            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: ESTADOS_OT[o.estado]?.bg, color: ESTADOS_OT[o.estado]?.color }}>{o.estado.replace('_', ' ')}</span>
                            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: COLORES_OT[o.tipo]?.bg, color: COLORES_OT[o.tipo]?.color }}>{o.tipo}</span>
                          </div>
                          <p className="font-semibold" style={{ color: 'var(--text)' }}>{getNombreCliente(o.cliente_id)}</p>
                          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{(o.descripcion || '').substring(0, 120)}</p>
                          {o.observaciones && <p className="text-xs mt-1" style={{ color: '#fbbf24' }}>Nota: {o.observaciones}</p>}
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{o.fecha_programada ? new Date(o.fecha_programada).toLocaleDateString('es-ES', { weekday: 'long', day: '2-digit', month: '2-digit' }) : '—'}</p>
                          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{o.fecha_programada ? new Date(o.fecha_programada).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : ''}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {misOrdenesCompletadas.length > 0 && (
              <div>
                <h2 className="font-semibold mb-4" style={{ color: 'var(--text)' }}>Mis ordenes completadas</h2>
                <div className="flex flex-col gap-2">
                  {misOrdenesCompletadas.map(o => (
                    <div key={o.id} onClick={() => setOrdenSeleccionada(o)}
                      className="rounded-xl p-4 cursor-pointer transition-all opacity-60" style={s.cardStyle}
                      onMouseEnter={e => e.currentTarget.style.borderColor = '#475569'}
                      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-mono text-xs mr-2" style={{ color: '#06b6d4' }}>{o.codigo}</span>
                          <span className="text-sm" style={{ color: 'var(--text)' }}>{getNombreCliente(o.cliente_id)}</span>
                        </div>
                        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399' }}>Completada</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {vistaActiva === 'presupuestos' && (
          <div>
            <div className="grid grid-cols-3 gap-4 mb-6">
              {[
                { label: 'Enviados', valor: presEnviados, color: '#06b6d4', bg: 'rgba(6,182,212,0.08)', border: 'rgba(6,182,212,0.2)' },
                { label: 'Pendientes', valor: presPendientes, color: '#fbbf24', bg: 'rgba(234,179,8,0.08)', border: 'rgba(234,179,8,0.2)' },
                { label: 'Aceptados', valor: presAceptados, color: '#34d399', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.2)' },
              ].map((s2, i) => (
                <div key={i} className="rounded-2xl p-4 text-center" style={{ background: s2.bg, border: `1px solid ${s2.border}` }}>
                  <p className="text-3xl font-bold" style={{ color: s2.color }}>{s2.valor}</p>
                  <p className="text-sm mt-1" style={{ color: s2.color }}>{s2.label}</p>
                </div>
              ))}
            </div>

            <div className="rounded-2xl p-5 mb-6" style={s.cardStyle}>
              <p className="font-semibold mb-1" style={{ color: 'var(--text)' }}>Escanear o subir presupuesto</p>
              <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>Fotografía o sube el presupuesto de Holded y los datos se rellenaran automaticamente.</p>
              <label className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl text-sm font-medium cursor-pointer"
                style={escaneando ? { ...s.btnSecondary, opacity: 0.6 } : s.btnPrimary}>
                {escaneando ? 'Procesando imagen...' : '📷 Fotografiar o subir presupuesto'}
                <input type="file" accept="image/*,application/pdf" className="hidden" onChange={escanearPresupuesto} disabled={escaneando} />
              </label>
              {datosEscaneados && (
                <div className="mt-3 rounded-xl p-3" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
                  <p className="text-xs font-semibold mb-1" style={{ color: '#34d399' }}>Datos extraidos correctamente</p>
                  <p className="text-xs" style={{ color: '#34d399' }}>Cliente: {datosEscaneados.cliente}</p>
                  <p className="text-xs" style={{ color: '#34d399' }}>Importe: {datosEscaneados.importe} EUR</p>
                  <p className="text-xs" style={{ color: '#34d399' }}>Numero: {datosEscaneados.numero}</p>
                </div>
              )}
            </div>

            {mostrarFormPres && (
              <div className="rounded-2xl p-6 mb-6" style={s.cardStyle}>
                <h2 className="font-semibold mb-5" style={{ color: 'var(--text)' }}>{editandoPres ? 'Editar presupuesto' : 'Nuevo presupuesto'}</h2>
                <form onSubmit={guardarPresupuesto} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-muted)' }}>Cliente</label>
                    <select value={presClienteId} onChange={e => setPresClienteId(e.target.value)} className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={s.inputStyle}>
                      <option value="">Sin cliente</option>
                      {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-muted)' }}>Descripcion</label>
                    <input value={presTitulo} onChange={e => setPresTitulo(e.target.value)} required className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={s.inputStyle} placeholder="Limpieza campanas..." />
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-muted)' }}>Importe (EUR)</label>
                    <input type="number" value={presImporte} onChange={e => setPresImporte(e.target.value)} className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={s.inputStyle} min="0" step="0.01" />
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-muted)' }}>Fecha envio</label>
                    <input type="date" value={presFecha} onChange={e => setPresFecha(e.target.value)} className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={s.inputStyle} />
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-muted)' }}>Estado</label>
                    <select value={presEstado} onChange={e => setPresEstado(e.target.value)} className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={s.inputStyle}>
                      <option value="enviado">Enviado</option>
                      <option value="pendiente">Pendiente respuesta</option>
                      <option value="aceptado">Aceptado</option>
                      <option value="rechazado">Rechazado</option>
                      <option value="expirado">Expirado</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-muted)' }}>Observaciones</label>
                    <input value={presObs} onChange={e => setPresObs(e.target.value)} className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={s.inputStyle} placeholder="Notas..." />
                  </div>
                  <div className="md:col-span-2 flex gap-3">
                    <button type="submit" className="px-5 py-2 rounded-xl text-sm font-medium" style={s.btnPrimary}>
                      {editandoPres ? 'Guardar cambios' : 'Crear presupuesto'}
                    </button>
                    <button type="button" onClick={() => { setMostrarFormPres(false); setEditandoPres(null) }}
                      className="text-sm px-5 py-2 rounded-xl" style={s.btnSecondary}>
                      Cancelar
                    </button>
                  </div>
                </form>
              </div>
            )}

            {presupuestos.length === 0 ? (
              <div className="text-center py-16 rounded-2xl" style={s.cardStyle}>
                <p className="text-3xl mb-2">📄</p>
                <p style={{ color: 'var(--text-muted)' }}>No hay presupuestos. Crea el primero o escanea uno.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {presupuestos.map(p => (
                  <div key={p.id} className="rounded-2xl p-5 transition-all" style={s.cardStyle}
                    onMouseEnter={e => e.currentTarget.style.borderColor = '#7c3aed'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
                    <div className="flex items-start justify-between flex-wrap gap-3 mb-3">
                      <div>
                        <div className="flex items-center gap-3 mb-1 flex-wrap">
                          <span className="font-mono text-sm" style={{ color: '#06b6d4' }}>{p.numero}</span>
                          <span className="text-xs px-2 py-1 rounded-full" style={{ background: ESTADOS_PRES[p.estado]?.bg, color: ESTADOS_PRES[p.estado]?.color, border: `1px solid ${ESTADOS_PRES[p.estado]?.border}` }}>
                            {ESTADOS_PRES[p.estado]?.label}
                          </span>
                        </div>
                        <p className="font-semibold" style={{ color: 'var(--text)' }}>{p.titulo}</p>
                        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{p.clientes?.nombre || '—'}</p>
                        {(() => {
                          const cli = clientes.find(c => c.id === p.cliente_id)
                          return cli ? (
                            <div className="flex gap-4 mt-2 flex-wrap">
                              {cli.telefono && <a href={`tel:${cli.telefono}`} className="text-xs font-medium" style={{ color: '#34d399' }}>📞 {cli.telefono}</a>}
                              {cli.email && <a href={`mailto:${cli.email}`} className="text-xs" style={{ color: '#06b6d4' }}>✉️ {cli.email}</a>}
                            </div>
                          ) : null
                        })()}
                        {p.observaciones && <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{p.observaciones}</p>}
                      </div>
                      <div className="text-right">
                        <p className="font-bold font-mono text-lg" style={{ color: 'var(--text)' }}>{(p.importe || 0).toFixed(2)} EUR</p>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{p.fecha_envio ? new Date(p.fecha_envio).toLocaleDateString('es-ES') : '—'}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 items-center pt-3" style={{ borderTop: '1px solid var(--border)' }}>
                      <p className="text-xs mr-1" style={{ color: 'var(--text-subtle)' }}>Estado:</p>
                      {Object.entries(ESTADOS_PRES).map(([key, val]: any) => (
                        <button key={key} onClick={() => cambiarEstadoPres(p.id, key)}
                          className="text-xs px-3 py-1 rounded-full transition-all"
                          style={{ background: val.bg, color: val.color, border: `1px solid ${val.border}`, opacity: p.estado === key ? 1 : 0.4 }}>
                          {val.label}
                        </button>
                      ))}
                      <button onClick={() => abrirFormPres(p)} className="ml-auto text-xs px-3 py-1 rounded-lg"
                        style={{ background: 'rgba(124,58,237,0.1)', color: '#a78bfa', border: '1px solid rgba(124,58,237,0.2)' }}>Editar</button>
                      <button onClick={() => eliminarPres(p.id)} className="text-xs px-3 py-1 rounded-lg"
                        style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>Eliminar</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {vistaActiva === 'rutas' && (
          <div>
            <div className="rounded-2xl p-5 mb-6" style={s.cardStyle}>
              <h2 className="font-semibold mb-2" style={{ color: 'var(--text)' }}>Optimizador de rutas</h2>
              <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>Selecciona un dia y el sistema calculara la ruta optima partiendo desde Elche.</p>
              <div className="flex gap-3 items-end flex-wrap">
                <div>
                  <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-muted)' }}>Dia a planificar</label>
                  <input type="date" value={fechaRuta} onChange={e => setFechaRuta(e.target.value)}
                    className="rounded-xl px-3 py-2 text-sm outline-none" style={s.inputStyle} />
                </div>
                <button onClick={calcularRutas} disabled={calculando}
                  className="px-6 py-2 rounded-xl text-sm font-medium disabled:opacity-50" style={s.btnPrimary}>
                  {calculando ? 'Calculando...' : 'Calcular ruta optima'}
                </button>
              </div>
            </div>

            {resultadoRuta?.vacio && (
              <div className="text-center py-12 rounded-2xl" style={s.cardStyle}>
                <p className="text-3xl mb-2">📅</p>
                <p style={{ color: 'var(--text-muted)' }}>No hay ordenes pendientes para ese dia.</p>
              </div>
            )}

            {resultadoRuta?.resultados && (
              <div className="flex flex-col gap-6">
                <div className="rounded-2xl p-4" style={s.cardStyle}>
                  <p className="font-semibold" style={{ color: 'var(--text)' }}>{new Date(resultadoRuta.fecha + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</p>
                  <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{resultadoRuta.totalOTs} ordenes — {resultadoRuta.resultados.length} trabajadores</p>
                </div>

                {resultadoRuta.resultados.map((res: any) => (
                  <div key={res.tecnico.id} className="rounded-2xl overflow-hidden" style={s.cardStyle}>
                    <div className="px-5 py-3 flex items-center justify-between flex-wrap gap-2" style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                      <div>
                        <p className="font-semibold" style={{ color: 'var(--text)' }}>{res.tecnico.nombre}</p>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Salida 08:00 desde Elche — {res.ruta.length} paradas — {res.horasTotales}h</p>
                      </div>
                      <span className="text-xs px-3 py-1 rounded-full font-medium"
                        style={res.cabeEnJornada
                          ? { background: 'rgba(16,185,129,0.15)', color: '#34d399', border: '1px solid rgba(16,185,129,0.3)' }
                          : { background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>
                        {res.cabeEnJornada ? 'Cabe en jornada 8-16h' : 'Excede jornada'}
                      </span>
                    </div>
                    <div className="p-5">
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0"
                            style={{ background: 'rgba(71,85,105,0.3)', color: 'var(--text-muted)' }}>S</div>
                          <div className="flex-1 rounded-xl px-3 py-2 flex items-center justify-between"
                            style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                            <div>
                              <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>Salida nave Elche</p>
                              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>C/ Leonardo Da Vinci 12</p>
                            </div>
                            <p className="font-mono text-sm font-bold" style={{ color: '#34d399' }}>08:00</p>
                          </div>
                        </div>

                        {res.ruta.map((parada: any, idx: number) => (
                          <div key={parada.ot.id}>
                            {parada.traslado > 0 && (
                              <div className="flex items-center gap-3 my-1 pl-4">
                                <div className="w-0.5 h-5 ml-3.5" style={{ background: 'var(--border)' }}></div>
                                <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>Traslado ~{parada.traslado} min{ZONAS[parada.zona] ? ` — ${ZONAS[parada.zona].nombre}` : ''}</p>
                              </div>
                            )}
                            <div className="flex items-start gap-3">
                              <div className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0 mt-1"
                                style={parada.fueraDeJornada
                                  ? { background: 'rgba(239,68,68,0.2)', color: '#f87171' }
                                  : parada.horaFija
                                  ? { background: 'rgba(234,179,8,0.2)', color: '#fbbf24' }
                                  : { background: 'rgba(124,58,237,0.2)', color: '#a78bfa' }}>
                                {idx + 1}
                              </div>
                              <div className="flex-1 rounded-xl px-3 py-3"
                                style={parada.horaFija
                                  ? { background: 'rgba(234,179,8,0.05)', border: '1px solid rgba(234,179,8,0.2)' }
                                  : parada.fueraDeJornada
                                  ? { background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)' }
                                  : { background: 'var(--bg)', border: '1px solid var(--border)' }}>
                                <div className="flex items-start justify-between flex-wrap gap-2">
                                  <div>
                                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                                      <span className="font-mono text-xs" style={{ color: '#06b6d4' }}>{parada.ot.codigo}</span>
                                      {parada.horaFija && <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(234,179,8,0.2)', color: '#fbbf24' }}>Hora fija</span>}
                                      {parada.fueraDeJornada && <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(239,68,68,0.2)', color: '#f87171' }}>Fuera de jornada</span>}
                                    </div>
                                    <p className="font-medium text-sm" style={{ color: 'var(--text)' }}>{parada.cliente?.nombre || '—'}</p>
                                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{parada.cliente?.direccion || '—'}</p>
                                    <p className="text-xs mt-1 capitalize" style={{ color: 'var(--text-subtle)' }}>{parada.ot.tipo} — {parada.ot.duracion_horas || 2}h</p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-sm font-mono font-bold" style={{ color: 'var(--text)' }}>{formatHora(parada.horaInicio)}</p>
                                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>hasta {formatHora(parada.horaFin)}</p>
                                    {parada.cliente?.direccion && (
                                      <a href={`https://www.google.com/maps/dir/Calle+Leonardo+Da+Vinci+12+Elche/${encodeURIComponent(parada.cliente.direccion)}`}
                                        target="_blank" rel="noreferrer" className="text-xs block mt-1" style={{ color: '#06b6d4' }}>
                                        Abrir Maps
                                      </a>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}

                        <div className="flex items-center gap-3 mt-2">
                          <div className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0"
                            style={{ background: 'rgba(71,85,105,0.3)', color: 'var(--text-muted)' }}>F</div>
                          <div className="flex-1 rounded-xl px-3 py-2 flex items-center justify-between"
                            style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                            <p className="text-sm" style={{ color: 'var(--text)' }}>Regreso nave Elche</p>
                            <p className="font-mono text-sm font-bold" style={{ color: res.cabeEnJornada ? '#34d399' : '#f87171' }}>
                              {formatHora(res.horaFinal)} aprox.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {resultadoRuta.otsSinAsignar?.length > 0 && (
                  <div className="rounded-2xl p-5" style={{ background: 'rgba(234,179,8,0.05)', border: '1px solid rgba(234,179,8,0.2)' }}>
                    <p className="font-semibold mb-3" style={{ color: '#fbbf24' }}>Ordenes sin trabajador ({resultadoRuta.otsSinAsignar.length})</p>
                    <div className="flex flex-col gap-2">
                      {resultadoRuta.otsSinAsignar.map((o: any) => (
                        <div key={o.id} className="rounded-lg px-3 py-2 flex items-center justify-between"
                          style={{ background: 'rgba(234,179,8,0.08)' }}>
                          <div>
                            <span className="font-mono text-xs mr-2" style={{ color: '#fbbf24' }}>{o.codigo}</span>
                            <span className="text-sm" style={{ color: 'var(--text)' }}>{clientes.find((c: any) => c.id === o.cliente_id)?.nombre || '—'}</span>
                          </div>
                          <span className="text-xs" style={{ color: '#fbbf24' }}>{o.duracion_horas || 2}h</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}