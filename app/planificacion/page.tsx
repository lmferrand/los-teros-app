'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

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

  useEffect(() => {
    cargarDatos()
  }, [])

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
    const d = new Date(mesActual)
    d.setMonth(d.getMonth() - 1)
    setMesActual(d)
  }

  function mesSiguiente() {
    const d = new Date(mesActual)
    d.setMonth(d.getMonth() + 1)
    setMesActual(d)
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
      return f.getDate() === dia.getDate() &&
        f.getMonth() === dia.getMonth() &&
        f.getFullYear() === dia.getFullYear()
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
    for (const zona of Object.keys(ZONAS)) {
      if (dir.includes(zona)) return zona
    }
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
    const INICIO = 8 * 60
    const FIN = 16 * 60
    const otsTecnico = otsDelDia.filter(o =>
      o.tecnicos_ids?.includes(tecnicoId) || o.tecnico_id === tecnicoId
    )
    const otsConHora = otsTecnico
      .filter(o => o.hora_fija && o.fecha_programada)
      .sort((a, b) => new Date(a.fecha_programada).getTime() - new Date(b.fecha_programada).getTime())
    const otsSinHora = otsTecnico
      .filter(o => !o.hora_fija)
      .sort((a, b) => {
        const zonaA = detectarZona(clientes.find((c: any) => c.id === a.cliente_id)?.direccion || '')
        const zonaB = detectarZona(clientes.find((c: any) => c.id === b.cliente_id)?.direccion || '')
        return (ZONAS[zonaA]?.orden || 99) - (ZONAS[zonaB]?.orden || 99)
      })
    const ruta: any[] = []
    let horaActual = INICIO
    let zonaActual = 'elche'
    for (const ot of otsConHora) {
      const horaOT = new Date(ot.fecha_programada)
      const minutos = horaOT.getHours() * 60 + horaOT.getMinutes()
      const zona = detectarZona(clientes.find((c: any) => c.id === ot.cliente_id)?.direccion || '')
      const duracion = (ot.duracion_horas || 2) * 60
      ruta.push({
        ot, horaInicio: minutos, horaFin: minutos + duracion,
        zona, horaFija: true, traslado: 0,
        fueraDeJornada: minutos + duracion > FIN,
        cliente: clientes.find((c: any) => c.id === ot.cliente_id),
      })
      horaActual = minutos + duracion
      zonaActual = zona
    }
    for (const ot of otsSinHora) {
      const zona = detectarZona(clientes.find((c: any) => c.id === ot.cliente_id)?.direccion || '')
      const tiempoTraslado = calcularTiempoEntreZonas(zonaActual, zona)
      const duracion = (ot.duracion_horas || 2) * 60
      const horaInicio = horaActual + tiempoTraslado
      const horaFin = horaInicio + duracion
      ruta.push({
        ot, horaInicio, horaFin, zona, horaFija: false,
        traslado: tiempoTraslado, fueraDeJornada: horaFin > FIN,
        cliente: clientes.find((c: any) => c.id === ot.cliente_id),
      })
      horaActual = horaFin
      zonaActual = zona
    }
    const horasTotales = otsTecnico.reduce((acc, o) => acc + (o.duracion_horas || 2), 0)
    const cabeEnJornada = horaActual <= FIN
    return { ruta, horasTotales, cabeEnJornada, horaFinal: horaActual }
  }

  function calcularRutas() {
    setCalculando(true)
    const otsDelDia = ordenes.filter(o => {
      if (!o.fecha_programada) return false
      const f = new Date(o.fecha_programada)
      return f.toISOString().slice(0, 10) === fechaRuta &&
        (o.estado === 'pendiente' || o.estado === 'en_curso')
    })
    if (otsDelDia.length === 0) {
      setResultadoRuta({ vacio: true })
      setCalculando(false)
      return
    }
    const tecnicosDelDia = tecnicos.filter(t =>
      otsDelDia.some(o => o.tecnicos_ids?.includes(t.id) || o.tecnico_id === t.id)
    )
    const resultados = tecnicosDelDia.map(t => ({
      tecnico: t,
      ...optimizarRutaTecnico(otsDelDia, t.id)
    }))
    const otsSinAsignar = otsDelDia.filter(o =>
      (!o.tecnicos_ids || o.tecnicos_ids.length === 0) && !o.tecnico_id
    )
    setResultadoRuta({ resultados, otsSinAsignar, fecha: fechaRuta, totalOTs: otsDelDia.length })
    setCalculando(false)
  }

  function convertirFecha(fecha: string): string {
    try {
      const partes = fecha.split('/')
      if (partes.length === 3) {
        return `${partes[2]}-${partes[1].padStart(2, '0')}-${partes[0].padStart(2, '0')}`
      }
      return new Date().toISOString().slice(0, 10)
    } catch {
      return new Date().toISOString().slice(0, 10)
    }
  }

  async function escanearPresupuesto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setEscaneando(true)
    setDatosEscaneados(null)
    try {
      const reader = new FileReader()
      reader.onload = async (ev) => {
        const base64 = ev.target?.result as string
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imagen: base64 }),
        })
        const data = await res.json()
        try {
          const texto = data.respuesta
          const json = JSON.parse(texto.replace(/```json|```/g, '').trim())
          setDatosEscaneados(json)
          setPresTitulo(json.descripcion || '')
          setPresImporte(String(json.importe || 0))
          setPresFecha(json.fecha ? convertirFecha(json.fecha) : new Date().toISOString().slice(0, 10))
          setPresObs(`Presupuesto ${json.numero || ''} escaneado automaticamente`)
          const clienteEncontrado = clientes.find(c =>
            c.nombre.toLowerCase().includes((json.cliente || '').toLowerCase()) ||
            (json.cliente || '').toLowerCase().includes(c.nombre.toLowerCase())
          )
          if (clienteEncontrado) setPresClienteId(clienteEncontrado.id)
          setMostrarFormPres(true)
        } catch {
          alert('No se pudieron extraer los datos. Intentalo de nuevo con mejor iluminacion.')
        }
        setEscaneando(false)
      }
      reader.readAsDataURL(file)
    } catch {
      setEscaneando(false)
      alert('Error al procesar la imagen.')
    }
  }

  const misOrdenes = ordenes.filter(o =>
    o.tecnicos_ids?.includes(userId) || o.tecnico_id === userId
  ).sort((a, b) => new Date(a.fecha_programada).getTime() - new Date(b.fecha_programada).getTime())

  const misOrdenesPendientes = misOrdenes.filter(o => o.estado === 'pendiente' || o.estado === 'en_curso')
  const misOrdenesCompletadas = misOrdenes.filter(o => o.estado === 'completada')

  const COLORES: any = {
    limpieza: 'bg-blue-800 text-blue-200',
    sustitucion: 'bg-yellow-800 text-yellow-200',
    mantenimiento: 'bg-green-800 text-green-200',
    instalacion: 'bg-purple-800 text-purple-200',
    revision: 'bg-orange-800 text-orange-200',
    otro: 'bg-gray-800 text-gray-200',
  }

  const ESTADOS_OT: any = {
    pendiente: 'bg-blue-900 text-blue-300',
    en_curso: 'bg-yellow-900 text-yellow-300',
    completada: 'bg-green-900 text-green-300',
    cancelada: 'bg-gray-800 text-gray-400',
  }

  const ESTADOS_PRES: any = {
    enviado: { clase: 'bg-blue-900 text-blue-300 border border-blue-700', label: 'Enviado' },
    pendiente: { clase: 'bg-yellow-900 text-yellow-300 border border-yellow-700', label: 'Pendiente' },
    aceptado: { clase: 'bg-green-900 text-green-300 border border-green-700', label: 'Aceptado' },
    rechazado: { clase: 'bg-red-900 text-red-300 border border-red-700', label: 'Rechazado' },
    expirado: { clase: 'bg-gray-800 text-gray-400 border border-gray-700', label: 'Expirado' },
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
      setEditandoPres(p)
      setPresClienteId(p.cliente_id || '')
      setPresTitulo(p.titulo || '')
      setPresImporte(String(p.importe || 0))
      setPresEstado(p.estado || 'enviado')
      setPresFecha(p.fecha_envio || new Date().toISOString().slice(0, 10))
      setPresObs(p.observaciones || '')
    } else {
      setEditandoPres(null)
      setPresClienteId('')
      setPresTitulo('')
      setPresImporte('0')
      setPresEstado('enviado')
      setPresFecha(new Date().toISOString().slice(0, 10))
      setPresObs('')
    }
    setMostrarFormPres(true)
  }

  async function guardarPresupuesto(e: React.FormEvent) {
    e.preventDefault()
    const datos = {
      cliente_id: presClienteId || null,
      titulo: presTitulo,
      importe: parseFloat(presImporte) || 0,
      estado: presEstado,
      fecha_envio: presFecha,
      observaciones: presObs,
    }
    if (editandoPres) {
  const { error } = await supabase.from('presupuestos').update(datos).eq('id', editandoPres.id)
  if (error) { alert('Error al actualizar: ' + error.message); return }
} else {
  const numero = await generarNumeroPres()
  const { error } = await supabase.from('presupuestos').insert({ ...datos, numero })
  if (error) { alert('Error al guardar: ' + error.message); return }
}
setMostrarFormPres(false)
setEditandoPres(null)
setDatosEscaneados(null)
cargarDatos()
  }

  async function cambiarEstadoPres(id: string, nuevoEstado: string) {
  await supabase.from('presupuestos').update({ estado: nuevoEstado }).eq('id', id)

  if (nuevoEstado === 'aceptado') {
    const pres = presupuestos.find(p => p.id === id)
    if (pres) {
      const { data: clienteData } = await supabase
        .from('clientes')
        .select('*')
        .eq('id', pres.cliente_id)
        .single()

      const { error } = await supabase.from('ordenes').insert({
        codigo: `OT-${pres.numero || id.slice(0, 6).toUpperCase()}`,
        tipo: 'otro',
        cliente_id: pres.cliente_id || null,
        estado: 'pendiente',
        prioridad: 'normal',
        descripcion: pres.titulo || 'Trabajo pendiente de agendar',
        observaciones: `Creado automaticamente desde presupuesto ${pres.numero || ''} aceptado. Importe: ${(pres.importe || 0).toFixed(2)} EUR`,
        duracion_horas: 2,
        hora_fija: false,
        tecnicos_ids: [],
      })

      if (!error) {
        alert(`Presupuesto aceptado. Se ha creado una OT en borrador en el calendario. Asignale fecha y trabajadores desde el modulo de Ordenes.`)
      }
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
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <p className="text-white">Cargando...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-950">
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <a href="/dashboard" className="text-gray-400 hover:text-white text-sm">Dashboard</a>
          <h1 className="text-xl font-bold text-white">Planificacion</h1>
        </div>
        {vistaActiva === 'calendario' && (
          <div className="flex items-center gap-3">
            <button onClick={mesAnterior} className="bg-gray-800 hover:bg-gray-700 text-white px-3 py-2 rounded-lg text-sm">Anterior</button>
            <span className="text-white font-mono font-bold text-sm min-w-40 text-center">{tituloMes}</span>
            <button onClick={mesSiguiente} className="bg-gray-800 hover:bg-gray-700 text-white px-3 py-2 rounded-lg text-sm">Siguiente</button>
          </div>
        )}
        {vistaActiva === 'presupuestos' && (
          <button onClick={() => abrirFormPres()} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm">
            + Nuevo presupuesto
          </button>
        )}
      </div>

      <div className="p-6">
        <div className="flex gap-2 mb-6 flex-wrap">
          <button onClick={() => setVistaActiva('calendario')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${vistaActiva === 'calendario' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
            Calendario
          </button>
          <button onClick={() => setVistaActiva('mis_ordenes')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${vistaActiva === 'mis_ordenes' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
            Mis ordenes
            {misOrdenesPendientes.length > 0 && (
              <span className="ml-1 bg-blue-500 text-white text-xs px-1.5 py-0.5 rounded-full">{misOrdenesPendientes.length}</span>
            )}
          </button>
          <button onClick={() => setVistaActiva('presupuestos')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${vistaActiva === 'presupuestos' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
            Presupuestos
            {presEnviados > 0 && (
              <span className="ml-1 bg-yellow-600 text-white text-xs px-1.5 py-0.5 rounded-full">{presEnviados}</span>
            )}
          </button>
          <button onClick={() => setVistaActiva('rutas')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${vistaActiva === 'rutas' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}>
            Optimizar rutas
          </button>
        </div>

        {ordenSeleccionada && (
          <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4">
            <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-lg w-full max-h-screen overflow-y-auto">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <span className="text-blue-400 font-mono text-sm">{ordenSeleccionada.codigo}</span>
                  <h2 className="text-white font-bold text-lg mt-1">{getNombreCliente(ordenSeleccionada.cliente_id)}</h2>
                </div>
                <button onClick={() => setOrdenSeleccionada(null)} className="text-gray-400 hover:text-white text-xl">X</button>
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-gray-400">Tipo</span><span className="text-white capitalize">{ordenSeleccionada.tipo}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Estado</span><span className={`text-xs px-2 py-0.5 rounded-full ${ESTADOS_OT[ordenSeleccionada.estado]}`}>{ordenSeleccionada.estado.replace('_', ' ')}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Duracion</span><span className="text-white">{ordenSeleccionada.duracion_horas || 2}h</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Hora fija</span><span className="text-white">{ordenSeleccionada.hora_fija ? 'Si' : 'No'}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Fecha</span><span className="text-white text-xs">{new Date(ordenSeleccionada.fecha_programada).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Trabajadores</span><span className="text-white text-right text-xs">{getNombresTecnicos(ordenSeleccionada.tecnicos_ids || [])}</span></div>
                {ordenSeleccionada.descripcion && (
                  <div><p className="text-gray-400 mb-1">Trabajos</p><p className="text-white bg-gray-800 rounded-lg p-3 text-xs leading-relaxed">{ordenSeleccionada.descripcion}</p></div>
                )}
                {ordenSeleccionada.observaciones && (
                  <div><p className="text-gray-400 mb-1">Observaciones</p><p className="text-white bg-gray-800 rounded-lg p-3 text-xs leading-relaxed">{ordenSeleccionada.observaciones}</p></div>
                )}
              </div>
              <div className="mt-5 flex gap-3">
                <button onClick={() => { router.push('/ordenes'); setOrdenSeleccionada(null) }} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm">Ver en OT</button>
                <button onClick={() => setOrdenSeleccionada(null)} className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-4 py-2 rounded-lg text-sm">Cerrar</button>
              </div>
            </div>
          </div>
        )}

        {vistaActiva === 'calendario' && (
          <>
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden mb-6">
              <div className="grid grid-cols-7 border-b border-gray-800">
                {['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'].map(d => (
                  <div key={d} className="text-center py-2 text-gray-500 text-xs font-bold uppercase tracking-wider">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {dias.map((dia, i) => {
                  if (!dia) return <div key={i} className="min-h-24 border-b border-r border-gray-800 bg-gray-950 opacity-30" />
                  const esHoy = dia.getDate() === hoy.getDate() && dia.getMonth() === hoy.getMonth() && dia.getFullYear() === hoy.getFullYear()
                  const otsDelDia = getOrdenesDelDia(dia)
                  return (
                    <div key={i} className={`min-h-24 border-b border-r border-gray-800 p-1.5 ${esHoy ? 'bg-blue-950' : ''}`}>
                      <p className={`text-xs font-bold mb-1 ${esHoy ? 'text-blue-400' : 'text-gray-500'}`}>{dia.getDate()}</p>
                      {otsDelDia.map(o => (
                        <button key={o.id} onClick={() => setOrdenSeleccionada(o)} className={`w-full text-left text-xs px-1.5 py-1 rounded mb-1 truncate ${COLORES[o.tipo] || 'bg-gray-800 text-gray-200'}`}>
                          {o.codigo}
                        </button>
                      ))}
                    </div>
                  )
                })}
              </div>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <h2 className="text-white font-semibold mb-4">OT de esta semana</h2>
              {otsSemana.length === 0 ? (
                <p className="text-gray-500 text-sm">Sin trabajos programados esta semana</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {otsSemana.map(o => (
                    <div key={o.id} onClick={() => setOrdenSeleccionada(o)} className="flex items-start justify-between p-4 bg-gray-800 rounded-xl cursor-pointer hover:bg-gray-700 transition-colors">
                      <div>
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-blue-400 font-mono text-xs">{o.codigo}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${COLORES[o.tipo]}`}>{o.tipo}</span>
                          {(o.tecnicos_ids?.includes(userId) || o.tecnico_id === userId) && (
                            <span className="text-xs bg-blue-900 text-blue-300 px-2 py-0.5 rounded-full">Mi OT</span>
                          )}
                        </div>
                        <p className="text-white font-medium text-sm">{getNombreCliente(o.cliente_id)}</p>
                        <p className="text-gray-400 text-xs mt-1">{(o.descripcion || '').substring(0, 80)}{(o.descripcion || '').length > 80 ? '...' : ''}</p>
                        <p className="text-gray-500 text-xs mt-1">Trabajadores: {getNombresTecnicos(o.tecnicos_ids || [])}</p>
                      </div>
                      <div className="text-right ml-4">
                        <p className="text-gray-400 text-xs">{new Date(o.fecha_programada).toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: '2-digit' })}</p>
                        <p className="text-gray-500 text-xs">{new Date(o.fecha_programada).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</p>
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
              <h2 className="text-white font-semibold mb-1">Mis ordenes pendientes y en curso</h2>
              <p className="text-gray-500 text-sm mb-4">Solo las ordenes asignadas a ti</p>
              {misOrdenesPendientes.length === 0 ? (
                <div className="text-center py-12 text-gray-500 bg-gray-900 rounded-xl border border-gray-800">
                  <p className="text-3xl mb-2">✅</p>
                  <p>No tienes ordenes pendientes</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {misOrdenesPendientes.map(o => (
                    <div key={o.id} onClick={() => setOrdenSeleccionada(o)} className="bg-gray-900 border border-gray-800 rounded-xl p-5 cursor-pointer hover:border-blue-800 transition-colors">
                      <div className="flex items-start justify-between flex-wrap gap-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="text-blue-400 font-mono text-sm">{o.codigo}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${ESTADOS_OT[o.estado]}`}>{o.estado.replace('_', ' ')}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${COLORES[o.tipo]}`}>{o.tipo}</span>
                          </div>
                          <p className="text-white font-semibold">{getNombreCliente(o.cliente_id)}</p>
                          <p className="text-gray-400 text-sm mt-1">{(o.descripcion || '').substring(0, 120)}{(o.descripcion || '').length > 120 ? '...' : ''}</p>
                          {o.observaciones && <p className="text-yellow-400 text-xs mt-1">Nota: {o.observaciones}</p>}
                        </div>
                        <div className="text-right">
                          <p className="text-white text-sm font-medium">{o.fecha_programada ? new Date(o.fecha_programada).toLocaleDateString('es-ES', { weekday: 'long', day: '2-digit', month: '2-digit' }) : '—'}</p>
                          <p className="text-gray-400 text-xs">{o.fecha_programada ? new Date(o.fecha_programada).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : ''}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {misOrdenesCompletadas.length > 0 && (
              <div>
                <h2 className="text-white font-semibold mb-4">Mis ordenes completadas</h2>
                <div className="flex flex-col gap-2">
                  {misOrdenesCompletadas.map(o => (
                    <div key={o.id} onClick={() => setOrdenSeleccionada(o)} className="bg-gray-900 border border-gray-800 rounded-xl p-4 cursor-pointer hover:border-gray-700 transition-colors opacity-70">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-blue-400 font-mono text-xs mr-2">{o.codigo}</span>
                          <span className="text-white text-sm">{getNombreCliente(o.cliente_id)}</span>
                        </div>
                        <span className="bg-green-900 text-green-300 text-xs px-2 py-0.5 rounded-full">Completada</span>
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
              <div className="bg-blue-950 border border-blue-800 rounded-xl p-4 text-center">
                <p className="text-blue-300 text-2xl font-bold">{presEnviados}</p>
                <p className="text-blue-400 text-sm">Enviados</p>
              </div>
              <div className="bg-yellow-950 border border-yellow-800 rounded-xl p-4 text-center">
                <p className="text-yellow-300 text-2xl font-bold">{presPendientes}</p>
                <p className="text-yellow-400 text-sm">Pendientes</p>
              </div>
              <div className="bg-green-950 border border-green-800 rounded-xl p-4 text-center">
                <p className="text-green-300 text-2xl font-bold">{presAceptados}</p>
                <p className="text-green-400 text-sm">Aceptados</p>
              </div>
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6">
              <p className="text-white font-semibold mb-1">Escanear o subir presupuesto</p>
              <p className="text-gray-400 text-sm mb-4">Fotografía o sube el presupuesto de Holded y los datos se rellenaran automaticamente.</p>
              <label className={`w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl text-sm font-medium cursor-pointer transition-colors ${escaneando ? 'bg-gray-700 text-gray-400' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}>
                {escaneando ? 'Procesando imagen...' : '📷 Fotografiar o subir presupuesto'}
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={escanearPresupuesto}
                  disabled={escaneando}
                />
              </label>
              {datosEscaneados && (
                <div className="mt-3 bg-green-950 border border-green-800 rounded-lg p-3">
                  <p className="text-green-300 text-xs font-semibold mb-1">Datos extraidos correctamente</p>
                  <p className="text-green-200 text-xs">Cliente: {datosEscaneados.cliente}</p>
                  <p className="text-green-200 text-xs">Importe: {datosEscaneados.importe} EUR</p>
                  <p className="text-green-200 text-xs">Numero: {datosEscaneados.numero}</p>
                </div>
              )}
            </div>

            {mostrarFormPres && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
                <h2 className="text-white font-semibold mb-4">{editandoPres ? 'Editar presupuesto' : 'Nuevo presupuesto'}</h2>
                <form onSubmit={guardarPresupuesto} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-gray-400 text-xs uppercase mb-1 block">Cliente</label>
                    <select value={presClienteId} onChange={e => setPresClienteId(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm">
                      <option value="">Sin cliente</option>
                      {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs uppercase mb-1 block">Descripcion</label>
                    <input value={presTitulo} onChange={e => setPresTitulo(e.target.value)} required className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm" placeholder="Limpieza campanas..." />
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs uppercase mb-1 block">Importe (EUR)</label>
                    <input type="number" value={presImporte} onChange={e => setPresImporte(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm" min="0" step="0.01" />
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs uppercase mb-1 block">Fecha envio</label>
                    <input type="date" value={presFecha} onChange={e => setPresFecha(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm" />
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs uppercase mb-1 block">Estado</label>
                    <select value={presEstado} onChange={e => setPresEstado(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm">
                      <option value="enviado">Enviado</option>
                      <option value="pendiente">Pendiente respuesta</option>
                      <option value="aceptado">Aceptado</option>
                      <option value="rechazado">Rechazado</option>
                      <option value="expirado">Expirado</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs uppercase mb-1 block">Observaciones</label>
                    <input value={presObs} onChange={e => setPresObs(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm" placeholder="Notas..." />
                  </div>
                  <div className="md:col-span-2 flex gap-3">
                    <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm">
                      {editandoPres ? 'Guardar cambios' : 'Crear presupuesto'}
                    </button>
                    <button type="button" onClick={() => { setMostrarFormPres(false); setEditandoPres(null) }} className="bg-gray-800 text-gray-400 px-4 py-2 rounded-lg text-sm">
                      Cancelar
                    </button>
                  </div>
                </form>
              </div>
            )}

            {presupuestos.length === 0 ? (
              <div className="text-center py-16 text-gray-500 bg-gray-900 rounded-xl border border-gray-800">
                <p className="text-3xl mb-2">📄</p>
                <p>No hay presupuestos. Crea el primero o escanea uno.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {presupuestos.map(p => (
                  <div key={p.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                    <div className="flex items-start justify-between flex-wrap gap-3 mb-3">
                      <div>
                        <div className="flex items-center gap-3 mb-1 flex-wrap">
                          <span className="text-blue-400 font-mono text-sm">{p.numero}</span>
                          <span className={`text-xs px-2 py-1 rounded-full ${ESTADOS_PRES[p.estado]?.clase}`}>{ESTADOS_PRES[p.estado]?.label}</span>
                        </div>
                        <p className="text-white font-semibold">{p.titulo}</p>
                        <p className="text-gray-400 text-sm">{p.clientes?.nombre || '—'}</p>
                        {(() => {
                          const cli = clientes.find(c => c.id === p.cliente_id)
                          return cli ? (
                            <div className="flex gap-4 mt-2 flex-wrap">
                              {cli.telefono && (
                                <a href={`tel:${cli.telefono}`} className="flex items-center gap-1 text-green-400 hover:text-green-300 text-xs font-medium">
                                  📞 {cli.telefono}
                                </a>
                              )}
                              {cli.email && (
                                <a href={`mailto:${cli.email}`} className="flex items-center gap-1 text-blue-400 hover:text-blue-300 text-xs font-medium">
                                  ✉️ {cli.email}
                                </a>
                              )}
                            </div>
                          ) : null
                        })()}
                        {p.observaciones && <p className="text-gray-500 text-xs mt-1">{p.observaciones}</p>}
                      </div>
                      <div className="text-right">
                        <p className="text-white font-bold font-mono text-lg">{(p.importe || 0).toFixed(2)} EUR</p>
                        <p className="text-gray-500 text-xs">{p.fecha_envio ? new Date(p.fecha_envio).toLocaleDateString('es-ES') : '—'}</p>
                      </div>
                    </div>
                    <div className="border-t border-gray-800 pt-3 flex flex-wrap gap-2 items-center">
                      <p className="text-gray-500 text-xs mr-1">Estado:</p>
                      {Object.entries(ESTADOS_PRES).map(([key, val]: any) => (
                        <button key={key} onClick={() => cambiarEstadoPres(p.id, key)}
                          className={`text-xs px-3 py-1 rounded-full border transition-opacity ${val.clase} ${p.estado === key ? 'opacity-100 ring-2 ring-white ring-opacity-30' : 'opacity-40 hover:opacity-80'}`}>
                          {val.label}
                        </button>
                      ))}
                      <button onClick={() => abrirFormPres(p)} className="ml-auto bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1 rounded text-xs">Editar</button>
                      <button onClick={() => eliminarPres(p.id)} className="bg-gray-800 hover:bg-gray-700 text-red-400 px-3 py-1 rounded text-xs">Eliminar</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {vistaActiva === 'rutas' && (
          <div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6">
              <h2 className="text-white font-semibold mb-2">Optimizador de rutas</h2>
              <p className="text-gray-400 text-sm mb-4">Selecciona un dia y el sistema calculara la ruta optima para cada trabajador partiendo desde Elche.</p>
              <div className="flex gap-3 items-end flex-wrap">
                <div>
                  <label className="text-gray-400 text-xs uppercase mb-1 block">Dia a planificar</label>
                  <input type="date" value={fechaRuta} onChange={e => setFechaRuta(e.target.value)} className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm" />
                </div>
                <button onClick={calcularRutas} disabled={calculando} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-6 py-2 rounded-lg text-sm font-medium">
                  {calculando ? 'Calculando...' : 'Calcular ruta optima'}
                </button>
              </div>
            </div>

            {resultadoRuta?.vacio && (
              <div className="text-center py-12 text-gray-500 bg-gray-900 rounded-xl border border-gray-800">
                <p className="text-3xl mb-2">📅</p>
                <p>No hay ordenes pendientes para ese dia.</p>
              </div>
            )}

            {resultadoRuta?.resultados && (
              <div className="flex flex-col gap-6">
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                  <p className="text-white font-semibold">{new Date(resultadoRuta.fecha + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</p>
                  <p className="text-gray-400 text-sm mt-1">{resultadoRuta.totalOTs} ordenes — {resultadoRuta.resultados.length} trabajadores</p>
                </div>
                {resultadoRuta.resultados.map((res: any) => (
                  <div key={res.tecnico.id} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                    <div className="bg-gray-800 px-5 py-3 flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <p className="text-white font-semibold">{res.tecnico.nombre}</p>
                        <p className="text-gray-400 text-xs">Salida 08:00 desde Elche — {res.ruta.length} paradas — {res.horasTotales}h trabajo</p>
                      </div>
                      <span className={`text-xs px-3 py-1 rounded-full font-medium ${res.cabeEnJornada ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>
                        {res.cabeEnJornada ? 'Cabe en jornada 8-16h' : 'Excede jornada'}
                      </span>
                    </div>
                    <div className="p-5">
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center text-xs text-gray-300 font-bold flex-shrink-0">S</div>
                          <div className="flex-1 bg-gray-800 rounded-lg px-3 py-2 flex items-center justify-between">
                            <div>
                              <p className="text-white text-sm font-medium">Salida nave Elche</p>
                              <p className="text-gray-400 text-xs">C/ Leonardo Da Vinci 12</p>
                            </div>
                            <p className="text-green-400 font-mono text-sm font-bold">08:00</p>
                          </div>
                        </div>
                        {res.ruta.map((parada: any, idx: number) => (
                          <div key={parada.ot.id}>
                            {parada.traslado > 0 && (
                              <div className="flex items-center gap-3 my-1 pl-4">
                                <div className="w-0.5 h-5 bg-gray-700 ml-3.5"></div>
                                <p className="text-gray-500 text-xs">Traslado ~{parada.traslado} min{ZONAS[parada.zona] ? ` — ${ZONAS[parada.zona].nombre}` : ''}</p>
                              </div>
                            )}
                            <div className="flex items-start gap-3">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-1 ${parada.fueraDeJornada ? 'bg-red-900 text-red-300' : parada.horaFija ? 'bg-yellow-900 text-yellow-300' : 'bg-blue-900 text-blue-300'}`}>
                                {idx + 1}
                              </div>
                              <div className={`flex-1 rounded-lg px-3 py-3 border ${parada.horaFija ? 'bg-yellow-950 border-yellow-800' : parada.fueraDeJornada ? 'bg-red-950 border-red-800' : 'bg-gray-800 border-gray-700'}`}>
                                <div className="flex items-start justify-between flex-wrap gap-2">
                                  <div>
                                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                                      <span className="text-blue-400 font-mono text-xs">{parada.ot.codigo}</span>
                                      {parada.horaFija && <span className="text-xs bg-yellow-900 text-yellow-300 px-1.5 py-0.5 rounded">Hora fija</span>}
                                      {parada.fueraDeJornada && <span className="text-xs bg-red-900 text-red-300 px-1.5 py-0.5 rounded">Fuera de jornada</span>}
                                    </div>
                                    <p className="text-white font-medium text-sm">{parada.cliente?.nombre || '—'}</p>
                                    <p className="text-gray-400 text-xs">{parada.cliente?.direccion || '—'}</p>
                                    <p className="text-gray-500 text-xs mt-1 capitalize">{parada.ot.tipo} — {parada.ot.duracion_horas || 2}h</p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-white text-sm font-mono font-bold">{formatHora(parada.horaInicio)}</p>
                                    <p className="text-gray-400 text-xs">hasta {formatHora(parada.horaFin)}</p>
                                    {parada.cliente?.direccion && (
                                      <a href={`https://www.google.com/maps/dir/Calle+Leonardo+Da+Vinci+12+Elche/${encodeURIComponent(parada.cliente.direccion)}`} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-300 text-xs block mt-1">
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
                          <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center text-xs text-gray-300 font-bold flex-shrink-0">F</div>
                          <div className="flex-1 bg-gray-800 rounded-lg px-3 py-2 flex items-center justify-between">
                            <p className="text-white text-sm">Regreso nave Elche</p>
                            <p className={`font-mono text-sm font-bold ${res.cabeEnJornada ? 'text-green-400' : 'text-red-400'}`}>{formatHora(res.horaFinal)} aprox.</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {resultadoRuta.otsSinAsignar?.length > 0 && (
                  <div className="bg-yellow-950 border border-yellow-800 rounded-xl p-5">
                    <p className="text-yellow-300 font-semibold mb-3">Ordenes sin trabajador asignado ({resultadoRuta.otsSinAsignar.length})</p>
                    <div className="flex flex-col gap-2">
                      {resultadoRuta.otsSinAsignar.map((o: any) => (
                        <div key={o.id} className="bg-yellow-900 bg-opacity-30 rounded-lg px-3 py-2 flex items-center justify-between">
                          <div>
                            <span className="text-yellow-400 font-mono text-xs mr-2">{o.codigo}</span>
                            <span className="text-white text-sm">{clientes.find((c: any) => c.id === o.cliente_id)?.nombre || '—'}</span>
                          </div>
                          <span className="text-yellow-400 text-xs">{o.duracion_horas || 2}h</span>
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