'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { s } from '@/lib/styles'

export default function Planificacion() {
  const [ordenes, setOrdenes] = useState<any[]>([])
  const [clientes, setClientes] = useState<any[]>([])
  const [tecnicos, setTecnicos] = useState<any[]>([])
  const [presupuestos, setPresupuestos] = useState<any[]>([])
  const [userId, setUserId] = useState<string>('')
  const [miRol, setMiRol] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [mesActual, setMesActual] = useState(new Date())
  const [ordenSeleccionada, setOrdenSeleccionada] = useState<any>(null)
  const [vistaActiva, setVistaActiva] = useState<'calendario' | 'mis_ordenes' | 'presupuestos' | 'rutas'>('calendario')
  const [mostrarFormPres, setMostrarFormPres] = useState(false)
  const [editandoPres, setEditandoPres] = useState<any>(null)
  const [fechaRuta, setFechaRuta] = useState(new Date().toISOString().slice(0, 10))
  const [periodoRuta, setPeriodoRuta] = useState<'dia' | 'semana' | 'mes'>('dia')
  const [resultadoRuta, setResultadoRuta] = useState<any>(null)
  const [calculando, setCalculando] = useState(false)
  const [escaneando, setEscaneando] = useState(false)
  const [datosEscaneados, setDatosEscaneados] = useState<any>(null)
  const [mapaPeriodo, setMapaPeriodo] = useState<'dia' | 'semana' | 'mes'>('dia')
  const [fechaMapa, setFechaMapa] = useState(new Date().toISOString().slice(0, 10))
  const [rutaMapaId, setRutaMapaId] = useState('general')
  const [mensajeCompartirRuta, setMensajeCompartirRuta] = useState('')
  const [sugiriendoPlan, setSugiriendoPlan] = useState(false)
  const [aplicandoSugerencia, setAplicandoSugerencia] = useState(false)
  const [sugerenciaPlan, setSugerenciaPlan] = useState<any>(null)
  const [sugerenciaPlanId, setSugerenciaPlanId] = useState('')
  const [errorSugerenciaPlan, setErrorSugerenciaPlan] = useState('')
  const [mensajeSugerenciaPlan, setMensajeSugerenciaPlan] = useState('')
  const [cambiosSeleccionadosSugerencia, setCambiosSeleccionadosSugerencia] = useState<number[]>([])
  const router = useRouter()

  const [presClienteId, setPresClienteId] = useState('')
  const [presTitulo, setPresTitulo] = useState('')
  const [presImporte, setPresImporte] = useState('0')
  const [presEstado, setPresEstado] = useState('enviado')
  const [presFecha, setPresFecha] = useState('')
  const [presObs, setPresObs] = useState('')

  const cargarDatos = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }
    setUserId(session.user.id)

    const { data: perfilUsuario } = await supabase.from('perfiles').select('rol').eq('id', session.user.id).single()
    if (perfilUsuario) setMiRol(perfilUsuario.rol)

    const [ords, clis, tecs, pres] = await Promise.all([
      supabase.from('ordenes').select('*, clientes(id, nombre, nombre_comercial, nombre_fiscal, cif, poblacion, direccion)').neq('estado', 'cancelada'),
      supabase.from('clientes').select('*'),
      supabase.from('perfiles').select('*'),
      supabase.from('presupuestos').select('*, clientes(nombre)').order('created_at', { ascending: false }),
    ])
    if (ords.data) setOrdenes(ords.data)
    if (clis.data) setClientes(clis.data)
    if (tecs.data) setTecnicos(tecs.data)
    if (pres.data) setPresupuestos(pres.data)
    setLoading(false)
  }, [router])

  useEffect(() => { void cargarDatos() }, [cargarDatos])

  function nombreComercialCliente(c: any) {
    return String(c?.nombre_comercial || c?.nombre || '').trim()
  }

  function nombreFiscalCliente(c: any) {
    return String(c?.nombre_fiscal || '').trim()
  }

  function getClienteOt(ot: any) {
    if (!ot) return null
    if (ot.clientes) return ot.clientes
    return clientes.find((c: any) => c.id === ot.cliente_id) || null
  }

  function getNombreClienteOt(ot: any) {
    const cliente = getClienteOt(ot)
    return nombreComercialCliente(cliente) || cliente?.nombre || 'Sin cliente'
  }

  function getTextoClienteSecundarioOt(ot: any) {
    const cliente = getClienteOt(ot)
    const fiscal = nombreFiscalCliente(cliente)
    const cif = String(cliente?.cif || '').trim()
    const poblacion = String(cliente?.poblacion || '').trim()
    return [fiscal, cif, poblacion].filter(Boolean).join(' | ')
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

  function calcularRangoMapa(periodo: 'dia' | 'semana' | 'mes', fechaBaseIso: string) {
    const base = new Date(`${fechaBaseIso}T12:00:00`)
    if (Number.isNaN(base.getTime())) {
      const ahora = new Date()
      return { inicio: ahora, fin: ahora, etiqueta: ahora.toLocaleDateString('es-ES') }
    }

    const inicio = new Date(base)
    const fin = new Date(base)

    if (periodo === 'dia') {
      inicio.setHours(0, 0, 0, 0)
      fin.setHours(23, 59, 59, 999)
      return {
        inicio,
        fin,
        etiqueta: inicio.toLocaleDateString('es-ES', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }),
      }
    }

    if (periodo === 'semana') {
      const diaSemana = base.getDay() === 0 ? 6 : base.getDay() - 1
      inicio.setDate(base.getDate() - diaSemana)
      inicio.setHours(0, 0, 0, 0)
      fin.setTime(inicio.getTime())
      fin.setDate(inicio.getDate() + 6)
      fin.setHours(23, 59, 59, 999)
      return {
        inicio,
        fin,
        etiqueta: `Semana ${inicio.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })} - ${fin.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}`,
      }
    }

    inicio.setDate(1)
    inicio.setHours(0, 0, 0, 0)
    fin.setMonth(inicio.getMonth() + 1, 0)
    fin.setHours(23, 59, 59, 999)
    return {
      inicio,
      fin,
      etiqueta: inicio.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }),
    }
  }

  function normalizarDirecciones(lista: string[]) {
    const vistos = new Set<string>()
    const result: string[] = []
    for (const dir of lista) {
      const limpia = String(dir || '').trim()
      if (!limpia) continue
      const clave = limpia.toLowerCase()
      if (vistos.has(clave)) continue
      vistos.add(clave)
      result.push(limpia)
    }
    return result
  }

  function crearMapaEmbedUrl(direcciones: string[]) {
    if (direcciones.length === 0) return null
    const paradas = direcciones
      .map((d) => String(d || '').trim())
      .filter(Boolean)
      .slice(0, 23)
    if (paradas.length === 1) return `https://maps.google.com/maps?q=${encodeURIComponent(paradas[0])}&output=embed`
    const daddr = encodeURIComponent(paradas.join(' to '))
    return `https://maps.google.com/maps?saddr=${encodeURIComponent('Calle Leonardo Da Vinci 12, Elche')}&daddr=${daddr}&dirflg=d&output=embed`
  }

  function crearRutaGoogleMapsUrl(direcciones: string[]) {
    if (direcciones.length === 0) return null
    const paradas = direcciones
      .map((d) => String(d || '').trim())
      .filter(Boolean)
      .slice(0, 23)
    if (paradas.length === 1) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(paradas[0])}`
    const destino = paradas[paradas.length - 1]
    const waypoints = paradas.slice(0, -1).join('|')
    let url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent('Calle Leonardo Da Vinci 12, Elche')}&destination=${encodeURIComponent(destino)}&travelmode=driving`
    if (waypoints) url += `&waypoints=${encodeURIComponent(waypoints)}`
    return url
  }

  function fechaOtKey(ot: any) {
    if (!ot?.fecha_programada) return 'sin_fecha'
    const d = new Date(ot.fecha_programada)
    if (Number.isNaN(d.getTime())) return 'sin_fecha'
    return d.toISOString().slice(0, 10)
  }

  function etiquetaDiaRuta(key: string) {
    if (key === 'sin_fecha') return 'Sin fecha'
    const d = new Date(`${key}T12:00:00`)
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })
  }

  function ordenarOtsParaMapa(ots: any[]) {
    const conHora = ots
      .filter((o) => o.hora_fija && o.fecha_programada)
      .sort((a, b) => new Date(a.fecha_programada).getTime() - new Date(b.fecha_programada).getTime())
    const flexibles = ots
      .filter((o) => !o.hora_fija)
      .sort((a, b) => prioridadPeso(b.prioridad || '2') - prioridadPeso(a.prioridad || '2'))

    const paradas: any[] = []
    let zonaActual = 'elche'
    let horaCursor = 6 * 60

    function elegirFlexible(hastaMin: number | null) {
      let bestIdx = -1
      let bestScore = Number.POSITIVE_INFINITY
      for (let i = 0; i < flexibles.length; i++) {
        const ot = flexibles[i]
        const cli = getClienteOt(ot)
        const zona = detectarZona(cli?.direccion || '')
        const traslado = calcularTiempoEntreZonas(zonaActual, zona)
        const inicio = horaCursor + traslado
        const fin = inicio + duracionOtMin(ot)
        if (hastaMin !== null && fin > hastaMin) continue
        const score = traslado * 1.6 + (ZONAS[zona]?.orden || 2) * 2 - prioridadPeso(ot.prioridad || '2')
        if (score < bestScore) {
          bestScore = score
          bestIdx = i
        }
      }
      return bestIdx
    }

    function insertarFlexibles(hastaMin: number | null) {
      while (flexibles.length > 0) {
        const idx = elegirFlexible(hastaMin)
        if (idx < 0) break
        const [ot] = flexibles.splice(idx, 1)
        const cli = getClienteOt(ot)
        const zona = detectarZona(cli?.direccion || '')
        const traslado = calcularTiempoEntreZonas(zonaActual, zona)
        const inicio = horaCursor + traslado
        const fin = inicio + duracionOtMin(ot)
        paradas.push({
          ot,
          cliente: cli,
          zona,
          direccion: String(cli?.direccion || '').trim(),
          estInicioMin: inicio,
          estFinMin: fin,
          horaFija: false,
          trasladoDesdeAnterior: traslado,
        })
        horaCursor = fin
        zonaActual = zona
      }
    }

    for (const fija of conHora) {
      const fijaMin = horaOtMin(fija)
      insertarFlexibles(fijaMin)
      const cli = getClienteOt(fija)
      const zona = detectarZona(cli?.direccion || '')
      const traslado = calcularTiempoEntreZonas(zonaActual, zona)
      const llegada = horaCursor + traslado
      const inicio = Math.max(fijaMin || llegada, llegada)
      const fin = inicio + duracionOtMin(fija)
      paradas.push({
        ot: fija,
        cliente: cli,
        zona,
        direccion: String(cli?.direccion || '').trim(),
        estInicioMin: inicio,
        estFinMin: fin,
        horaFija: true,
        trasladoDesdeAnterior: traslado,
      })
      horaCursor = fin
      zonaActual = zona
    }

    insertarFlexibles(null)
    return paradas
  }

  function dividirParadasEnRutas(paradas: any[], maxMin = 9 * 60) {
    if (!paradas.length) return []
    const rutas: any[][] = []
    let actual: any[] = []
    let carga = 0
    for (const p of paradas) {
      const dur = Math.max(20, Number(p.estFinMin || 0) - Number(p.estInicioMin || 0))
      const traslado = Number(p.trasladoDesdeAnterior || 0)
      const consumo = dur + traslado
      if (actual.length > 0 && carga + consumo > maxMin) {
        rutas.push(actual)
        actual = []
        carga = 0
      }
      actual.push(p)
      carga += consumo
    }
    if (actual.length > 0) rutas.push(actual)
    return rutas
  }

  function construirRutasMapa(ordenesBase: any[]) {
    if (!ordenesBase.length) return []
    const ordenadas = [...ordenesBase].sort((a, b) => new Date(a.fecha_programada || 0).getTime() - new Date(b.fecha_programada || 0).getTime())
    const rutas: any[] = []

    const paradasGeneral = ordenarOtsParaMapa(ordenadas)
    rutas.push({
      id: 'general',
      nombre: 'Ruta general empresa',
      ordenes: ordenadas,
      paradas: paradasGeneral,
      direcciones: paradasGeneral.map((p: any) => String(p.direccion || '').trim()).filter(Boolean),
    })

    const porDia = new Map<string, any[]>()
    for (const ot of ordenadas) {
      const key = fechaOtKey(ot)
      if (!porDia.has(key)) porDia.set(key, [])
      porDia.get(key)!.push(ot)
    }

    for (const [diaKey, otsDia] of Array.from(porDia.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
      const labelDia = etiquetaDiaRuta(diaKey)
      const porTecnico = new Map<string, any[]>()
      const sinAsignar: any[] = []

      for (const ot of otsDia) {
        const techs = obtenerTecnicosOt(ot)
        if (!techs.length) {
          sinAsignar.push(ot)
          continue
        }
        for (const tech of techs) {
          if (!porTecnico.has(tech)) porTecnico.set(tech, [])
          porTecnico.get(tech)!.push(ot)
        }
      }

      for (const [tecnicoId, otsTec] of Array.from(porTecnico.entries()).sort((a, b) => {
        const n1 = tecnicos.find((t) => t.id === a[0])?.nombre || ''
        const n2 = tecnicos.find((t) => t.id === b[0])?.nombre || ''
        return n1.localeCompare(n2, 'es')
      })) {
        const nombreTec = tecnicos.find((t) => t.id === tecnicoId)?.nombre || 'Tecnico'
        const paradas = ordenarOtsParaMapa(otsTec)
        rutas.push({
          id: `dia-${diaKey}-tec-${tecnicoId}`,
          nombre: `${labelDia} · ${nombreTec}`,
          ordenes: otsTec,
          paradas,
          direcciones: normalizarDirecciones(paradas.map((p: any) => p.direccion).filter(Boolean)),
        })
      }

      if (sinAsignar.length > 0) {
        const paradasSinAsignar = ordenarOtsParaMapa(sinAsignar)
        const bloques = dividirParadasEnRutas(paradasSinAsignar, 9 * 60)
        bloques.forEach((bloque, idx) => {
          rutas.push({
            id: `dia-${diaKey}-sin-${idx + 1}`,
            nombre: `${labelDia} · Ruta ${idx + 1} (sin asignar)`,
            ordenes: bloque.map((p: any) => p.ot),
            paradas: bloque,
            direcciones: normalizarDirecciones(bloque.map((p: any) => p.direccion).filter(Boolean)),
          })
        })
      }
    }

    return rutas
  }

  void construirRutasMapa

  function construirRutasMapaExtendido(ordenesBase: any[]) {
    if (!ordenesBase.length) return []
    const ordenadas = [...ordenesBase].sort((a, b) => new Date(a.fecha_programada || 0).getTime() - new Date(b.fecha_programada || 0).getTime())
    const rutas: any[] = []
    const capacidadRutaMin = 9 * 60

    const paradasGeneral = ordenarOtsParaMapa(ordenadas)
    rutas.push({
      id: 'general',
      nombre: 'Ruta general empresa',
      ordenes: ordenadas,
      paradas: paradasGeneral,
      direcciones: normalizarDirecciones(paradasGeneral.map((p: any) => p.direccion).filter(Boolean)),
    })

    const porDia = new Map<string, any[]>()
    for (const ot of ordenadas) {
      const key = fechaOtKey(ot)
      if (!porDia.has(key)) porDia.set(key, [])
      porDia.get(key)!.push(ot)
    }

    for (const [diaKey, otsDia] of Array.from(porDia.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
      const labelDia = etiquetaDiaRuta(diaKey)

      const paradasDia = ordenarOtsParaMapa(otsDia)
      const bloquesDia = dividirParadasEnRutas(paradasDia, capacidadRutaMin)
      bloquesDia.forEach((bloque, idx) => {
        rutas.push({
          id: `dia-${diaKey}-global-${idx + 1}`,
          nombre: `${labelDia} - Ruta global ${idx + 1}`,
          ordenes: bloque.map((p: any) => p.ot),
          paradas: bloque,
          direcciones: bloque.map((p: any) => String(p.direccion || '').trim()).filter(Boolean),
        })
      })

      const porTecnico = new Map<string, any[]>()
      const sinAsignar: any[] = []
      for (const ot of otsDia) {
        const techs = obtenerTecnicosOt(ot)
        if (!techs.length) {
          sinAsignar.push(ot)
          continue
        }
        for (const tech of techs) {
          if (!porTecnico.has(tech)) porTecnico.set(tech, [])
          porTecnico.get(tech)!.push(ot)
        }
      }

      for (const [tecnicoId, otsTec] of Array.from(porTecnico.entries()).sort((a, b) => {
        const n1 = tecnicos.find((t) => t.id === a[0])?.nombre || ''
        const n2 = tecnicos.find((t) => t.id === b[0])?.nombre || ''
        return n1.localeCompare(n2, 'es')
      })) {
        const nombreTec = tecnicos.find((t) => t.id === tecnicoId)?.nombre || 'Tecnico'
        const paradasTecnico = ordenarOtsParaMapa(otsTec)
        const bloquesTecnico = dividirParadasEnRutas(paradasTecnico, capacidadRutaMin)
        bloquesTecnico.forEach((bloque, idx) => {
          rutas.push({
            id: `dia-${diaKey}-tec-${tecnicoId}-${idx + 1}`,
            nombre: `${labelDia} - ${nombreTec} - Ruta ${idx + 1}`,
            ordenes: bloque.map((p: any) => p.ot),
            paradas: bloque,
            direcciones: bloque.map((p: any) => String(p.direccion || '').trim()).filter(Boolean),
          })
        })
      }

      if (sinAsignar.length > 0) {
        const paradasSinAsignar = ordenarOtsParaMapa(sinAsignar)
        const bloquesSinAsignar = dividirParadasEnRutas(paradasSinAsignar, capacidadRutaMin)
        bloquesSinAsignar.forEach((bloque, idx) => {
          rutas.push({
            id: `dia-${diaKey}-sin-${idx + 1}`,
            nombre: `${labelDia} - Ruta ${idx + 1} (sin asignar)`,
            ordenes: bloque.map((p: any) => p.ot),
            paradas: bloque,
            direcciones: bloque.map((p: any) => String(p.direccion || '').trim()).filter(Boolean),
          })
        })
      }
    }

    return rutas
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

  function letraParada(idx: number) {
    const abecedario = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    if (idx < abecedario.length) return abecedario[idx]
    const prefijo = abecedario[Math.floor(idx / abecedario.length) - 1] || 'Z'
    return `${prefijo}${abecedario[idx % abecedario.length]}`
  }

  function obtenerOpcionesNegociables(parada: any) {
    if (!parada || parada.horaFija) return []
    const inicioJornada = 6 * 60
    const finJornada = 15 * 60
    const duracion = Math.max(30, Number(parada.horaFin || 0) - Number(parada.horaInicio || 0))

    const candidatos = [parada.horaInicio - 30, parada.horaInicio, parada.horaInicio + 30]
      .map((min: number) => {
        const inicio = Math.max(inicioJornada, Math.min(min, finJornada - duracion))
        return Math.round(inicio / 5) * 5
      })

    const unicos = Array.from(new Set(candidatos)).sort((a, b) => a - b).slice(0, 3)
    return unicos.map((inicio) => ({ inicio, fin: inicio + duracion }))
  }

  function prioridadPeso(prioridad: string) {
    const p = String(prioridad || '').trim().toLowerCase()
    if (p === '3' || p === 'alta' || p === 'urgente') return 24
    if (p === '1' || p === 'baja') return 6
    return 12
  }

  function obtenerTecnicosOt(ot: any) {
    if (Array.isArray(ot.tecnicos_ids) && ot.tecnicos_ids.length > 0) return ot.tecnicos_ids
    if (ot.tecnico_id) return [ot.tecnico_id]
    return []
  }

  function obtenerClienteOt(ot: any) {
    return getClienteOt(ot)
  }

  function duracionOtMin(ot: any) {
    return Math.max(15, Number(ot.duracion_horas || 2) * 60)
  }

  function horaOtMin(ot: any) {
    if (!ot?.fecha_programada) return null
    const fechaOt = new Date(ot.fecha_programada)
    if (Number.isNaN(fechaOt.getTime())) return null
    return fechaOt.getHours() * 60 + fechaOt.getMinutes()
  }

  function calcularTrasladoBase(otsTecnico: any[]) {
    if (otsTecnico.length <= 1) return 0
    let zonaActual = 'elche'
    let traslado = 0
    const ordenBase = [...otsTecnico].sort((a, b) => {
      const fa = new Date(a.fecha_programada || 0).getTime()
      const fb = new Date(b.fecha_programada || 0).getTime()
      return fa - fb
    })
    for (const ot of ordenBase) {
      const clienteOt = obtenerClienteOt(ot)
      const zonaOt = detectarZona(clienteOt?.direccion || '')
      traslado += calcularTiempoEntreZonas(zonaActual, zonaOt)
      zonaActual = zonaOt
    }
    traslado += calcularTiempoEntreZonas(zonaActual, 'elche')
    return traslado
  }

  function optimizarRutaTecnico(otsDelDia: any[], tecnicoId: string) {
    const INICIO = 6 * 60
    const FIN = 15 * 60
    const otsTecnico = otsDelDia.filter((o) => obtenerTecnicosOt(o).includes(tecnicoId))
    const otsConHora = otsTecnico
      .filter((o) => o.hora_fija && o.fecha_programada)
      .sort((a, b) => new Date(a.fecha_programada).getTime() - new Date(b.fecha_programada).getTime())

    const pendientesFlexibles = otsTecnico
      .filter((o) => !o.hora_fija)
      .sort((a, b) => prioridadPeso(b.prioridad || '2') - prioridadPeso(a.prioridad || '2'))

    const ruta: any[] = []
    const advertencias: string[] = []
    let horaActual = INICIO
    let zonaActual = 'elche'
    let totalTraslado = 0
    let totalEspera = 0
    let totalTrabajo = 0

    function elegirSiguienteOt(hastaMin: number | null) {
      let mejorIndice = -1
      let mejorPuntaje = Number.POSITIVE_INFINITY

      for (let i = 0; i < pendientesFlexibles.length; i++) {
        const ot = pendientesFlexibles[i]
        const clienteOt = obtenerClienteOt(ot)
        const zonaOt = detectarZona(clienteOt?.direccion || '')
        const traslado = calcularTiempoEntreZonas(zonaActual, zonaOt)
        const duracion = duracionOtMin(ot)
        const inicioTentativo = horaActual + traslado
        const finTentativo = inicioTentativo + duracion
        if (hastaMin !== null && finTentativo > hastaMin) continue

        const penalizaJornada = finTentativo > FIN ? (finTentativo - FIN) * 1.8 : 0
        const bonusPrioridad = prioridadPeso(ot.prioridad || '2')
        const puntaje = traslado * 1.5 + penalizaJornada - bonusPrioridad

        if (puntaje < mejorPuntaje) {
          mejorPuntaje = puntaje
          mejorIndice = i
        }
      }

      return mejorIndice
    }

    function insertarFlexibles(hastaMin: number | null) {
      while (pendientesFlexibles.length > 0) {
        const idx = elegirSiguienteOt(hastaMin)
        if (idx < 0) break

        const [ot] = pendientesFlexibles.splice(idx, 1)
        const clienteOt = obtenerClienteOt(ot)
        const zonaOt = detectarZona(clienteOt?.direccion || '')
        const traslado = calcularTiempoEntreZonas(zonaActual, zonaOt)
        const inicio = horaActual + traslado
        const duracion = duracionOtMin(ot)
        const fin = inicio + duracion

        totalTraslado += traslado
        totalTrabajo += duracion
        ruta.push({
          ot,
          horaInicio: inicio,
          horaFin: fin,
          zona: zonaOt,
          horaFija: false,
          traslado,
          fueraDeJornada: fin > FIN,
          cliente: clienteOt,
        })
        horaActual = fin
        zonaActual = zonaOt
      }
    }

    for (const otFija of otsConHora) {
      const horaFija = horaOtMin(otFija)
      if (horaFija === null) continue

      insertarFlexibles(horaFija)

      const clienteOt = obtenerClienteOt(otFija)
      const zonaOt = detectarZona(clienteOt?.direccion || '')
      const traslado = calcularTiempoEntreZonas(zonaActual, zonaOt)
      const llegada = horaActual + traslado
      const inicio = Math.max(horaFija, llegada)
      const espera = Math.max(0, horaFija - llegada)
      const duracion = duracionOtMin(otFija)
      const fin = inicio + duracion

      totalTraslado += traslado
      totalEspera += espera
      totalTrabajo += duracion

      if (llegada > horaFija) {
        advertencias.push(`Conflicto de hora fija en ${otFija.codigo}: llegada ${formatHora(llegada)}.`)
      }

      ruta.push({
        ot: otFija,
        horaInicio: inicio,
        horaFin: fin,
        zona: zonaOt,
        horaFija: true,
        traslado,
        fueraDeJornada: fin > FIN,
        cliente: clienteOt,
      })
      horaActual = fin
      zonaActual = zonaOt
    }

    insertarFlexibles(null)

    const trasladoRegreso = ruta.length > 0 ? calcularTiempoEntreZonas(zonaActual, 'elche') : 0
    totalTraslado += trasladoRegreso
    const horaFinalConRegreso = horaActual + trasladoRegreso
    const extraMin = Math.max(0, horaFinalConRegreso - FIN)
    const horasTotales = Number((totalTrabajo / 60).toFixed(1))
    const utilizacion = Math.min(100, Math.round((totalTrabajo / (FIN - INICIO)) * 100))
    const trasladoBase = calcularTrasladoBase(otsTecnico)
    const ahorroTrasladoMin = Math.max(0, trasladoBase - totalTraslado)

    return {
      ruta,
      horasTotales,
      cabeEnJornada: horaFinalConRegreso <= FIN,
      horaFinal: horaFinalConRegreso,
      horaFinalTrabajo: horaActual,
      zonaFinal: zonaActual,
      trasladoTotalMin: totalTraslado,
      esperaTotalMin: totalEspera,
      trabajoTotalMin: totalTrabajo,
      extraMin,
      utilizacionPct: utilizacion,
      ahorroTrasladoMin,
      zonasVisitadas: Array.from(new Set(ruta.map((r: any) => r.zona).filter(Boolean))),
      advertencias,
    }
  }

  function sugerirAsignaciones(otsSinAsignar: any[], resultadosBase: any[]) {
    if (!otsSinAsignar.length || !resultadosBase.length) return []

    const estadoTecnicos = resultadosBase.map((res: any) => ({
      tecnicoId: res.tecnico.id,
      tecnicoNombre: res.tecnico.nombre,
      horaActual: res.horaFinalTrabajo || (6 * 60),
      zonaActual: res.zonaFinal || 'elche',
      extraActual: res.extraMin || 0,
    }))

    const sugerencias: any[] = []

    const pendientes = [...otsSinAsignar].sort((a, b) => {
      const p = prioridadPeso(b.prioridad || '2') - prioridadPeso(a.prioridad || '2')
      if (p !== 0) return p
      return duracionOtMin(b) - duracionOtMin(a)
    })

    for (const ot of pendientes) {
      const clienteOt = obtenerClienteOt(ot)
      const zonaOt = detectarZona(clienteOt?.direccion || '')
      const duracion = duracionOtMin(ot)

      let mejor: any = null
      for (const st of estadoTecnicos) {
        const traslado = calcularTiempoEntreZonas(st.zonaActual, zonaOt)
        const inicio = st.horaActual + traslado
        const finTrabajo = inicio + duracion
        const regreso = calcularTiempoEntreZonas(zonaOt, 'elche')
        const extra = Math.max(0, finTrabajo + regreso - 15 * 60)
        const coste = traslado + extra * 2.2 + st.extraActual * 0.5
        if (!mejor || coste < mejor.coste) {
          mejor = { st, traslado, inicio, finTrabajo, extra, coste }
        }
      }

      if (!mejor) continue
      sugerencias.push({
        ot,
        tecnicoId: mejor.st.tecnicoId,
        tecnicoNombre: mejor.st.tecnicoNombre,
        horaInicio: mejor.inicio,
        horaFin: mejor.finTrabajo,
        trasladoMin: mejor.traslado,
        extraMin: mejor.extra,
      })

      mejor.st.horaActual = mejor.finTrabajo
      mejor.st.zonaActual = zonaOt
      mejor.st.extraActual = mejor.extra
    }

    return sugerencias
  }

  function fechaKeyLocal(d: Date) {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  function obtenerRangoOptimizacion(periodo: 'dia' | 'semana' | 'mes', fechaBaseIso: string) {
    const { inicio, fin, etiqueta } = calcularRangoMapa(periodo, fechaBaseIso)
    const dias: string[] = []
    const cursor = new Date(inicio)
    cursor.setHours(12, 0, 0, 0)
    while (cursor <= fin) {
      dias.push(fechaKeyLocal(cursor))
      cursor.setDate(cursor.getDate() + 1)
    }
    return { inicio, fin, etiqueta, dias }
  }

  function filtrarOtsActivasEnRango(inicio: Date, fin: Date) {
    return ordenes.filter((o) => {
      if (!o.fecha_programada) return false
      const f = new Date(o.fecha_programada)
      if (Number.isNaN(f.getTime())) return false
      return (o.estado === 'pendiente' || o.estado === 'en_curso') && f >= inicio && f <= fin
    })
  }

  function resumenDiaOptimizacion(fechaIso: string, otsDia: any[]) {
    if (!otsDia.length) return null
    const tecnicosDelDia = tecnicos.filter((t) => otsDia.some((o) => obtenerTecnicosOt(o).includes(t.id)))
    const resultados = tecnicosDelDia.map((t) => ({ tecnico: t, ...optimizarRutaTecnico(otsDia, t.id) }))
    const otsSinAsignar = otsDia.filter((o) => (!o.tecnicos_ids || o.tecnicos_ids.length === 0) && !o.tecnico_id)
    const sugerencias = sugerirAsignaciones(otsSinAsignar, resultados)
    const totalTraslado = resultados.reduce((acc: number, r: any) => acc + Number(r.trasladoTotalMin || 0), 0)
    const totalAhorro = resultados.reduce((acc: number, r: any) => acc + Number(r.ahorroTrasladoMin || 0), 0)
    const totalExtra = resultados.reduce((acc: number, r: any) => acc + Number(r.extraMin || 0), 0)
    const zonas = resultados.flatMap((r: any) => r.zonasVisitadas || [])
    const contador = new Map<string, number>()
    for (const z of zonas) contador.set(z, (contador.get(z) || 0) + 1)
    const zonasDominantes = Array.from(contador.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([zona]) => ZONAS[zona]?.nombre || zona)

    return {
      fecha: fechaIso,
      resultados,
      otsSinAsignar,
      sugerencias,
      totalOTs: otsDia.length,
      totalTraslado,
      totalAhorro,
      totalExtra,
      zonasDominantes,
    }
  }

  function construirEstadoTecnicosPeriodo(resumenDias: any[]) {
    const estado = new Map<string, any>()
    for (const dia of resumenDias) {
      for (const res of dia.resultados || []) {
        const key = `${dia.fecha}__${res.tecnico.id}`
        estado.set(key, {
          tecnicoId: res.tecnico.id,
          tecnicoNombre: res.tecnico.nombre,
          cargaMin: Number(res.trabajoTotalMin || 0) + Number(res.trasladoTotalMin || 0),
          horaFinalTrabajo: Number(res.horaFinalTrabajo || 6 * 60),
          zonas: (res.zonasVisitadas || []).length > 0 ? res.zonasVisitadas : ['elche'],
          fijas: (res.ruta || []).filter((p: any) => p.horaFija).length,
        })
      }
    }
    return estado
  }

  function generarOpcionesFlexiblesPeriodo(otsPeriodo: any[], resumenDias: any[], diasPeriodo: string[]) {
    const estadoTecnicos = construirEstadoTecnicosPeriodo(resumenDias)
    const flexibles = otsPeriodo
      .filter((o) => !o.hora_fija && obtenerTecnicosOt(o).length > 0)
      .sort((a, b) => prioridadPeso(b.prioridad || '2') - prioridadPeso(a.prioridad || '2'))

    const opciones: any[] = []

    for (const ot of flexibles) {
      const techIds = obtenerTecnicosOt(ot)
      if (!techIds.length) continue
      const clienteOt = obtenerClienteOt(ot)
      const zonaOt = detectarZona(clienteOt?.direccion || '')
      const fechaOriginal = ot.fecha_programada ? fechaKeyLocal(new Date(ot.fecha_programada)) : diasPeriodo[0]
      const duracion = duracionOtMin(ot)
      const candidatas: any[] = []

      for (const tecnicoId of techIds) {
        for (const dia of diasPeriodo) {
          const key = `${dia}__${tecnicoId}`
          const st = estadoTecnicos.get(key) || {
            tecnicoId,
            tecnicoNombre: tecnicos.find((t) => t.id === tecnicoId)?.nombre || 'Tecnico',
            cargaMin: 0,
            horaFinalTrabajo: 6 * 60,
            zonas: ['elche'],
            fijas: 0,
          }

          const zonasRef = [...(st.zonas || []), 'elche']
          const trasladoEstimado = zonasRef
            .map((z: string) => calcularTiempoEntreZonas(z, zonaOt))
            .reduce((min: number, v: number) => Math.min(min, v), Number.POSITIVE_INFINITY)

          const cargaProyectada = st.cargaMin + trasladoEstimado + duracion
          const extraMin = Math.max(0, cargaProyectada - (9 * 60))
          const movePenalty = dia === fechaOriginal ? 0 : 8
          const fixedPenalty = st.fijas > 0 ? 6 : 0
          const score = trasladoEstimado * 1.25 + extraMin * 2.3 + movePenalty + fixedPenalty + st.cargaMin * 0.08

          const inicioEstimado = Math.max(6 * 60, Math.min(14 * 60, Math.round((Math.max(st.horaFinalTrabajo, 6 * 60) + trasladoEstimado) / 30) * 30))
          const finEstimado = inicioEstimado + duracion

          candidatas.push({
            tecnicoId: st.tecnicoId,
            tecnicoNombre: st.tecnicoNombre,
            fecha: dia,
            score,
            trasladoEstimado,
            extraMin,
            inicioEstimado,
            finEstimado,
            esDiaOriginal: dia === fechaOriginal,
          })
        }
      }

      const mejores = candidatas
        .sort((a, b) => a.score - b.score)
        .filter((op, idx, arr) => idx === arr.findIndex((x) => x.fecha === op.fecha && x.tecnicoId === op.tecnicoId))
        .slice(0, 3)

      if (mejores.length === 0) continue
      opciones.push({
        ot,
        cliente: clienteOt,
        zona: zonaOt,
        fechaOriginal,
        opciones: mejores,
      })
    }

    return opciones
      .sort((a, b) => {
        const sa = Number(a.opciones?.[0]?.score || 0)
        const sb = Number(b.opciones?.[0]?.score || 0)
        return sa - sb
      })
      .slice(0, 40)
  }

  function calcularRutas() {
    setCalculando(true)
    try {
      const rango = obtenerRangoOptimizacion(periodoRuta, fechaRuta)
      const otsPeriodo = filtrarOtsActivasEnRango(rango.inicio, rango.fin)

      if (otsPeriodo.length === 0) {
        setResultadoRuta({ vacio: true, periodo: periodoRuta, etiquetaPeriodo: rango.etiqueta })
        return
      }

      if (periodoRuta === 'dia') {
        const resumenDia = resumenDiaOptimizacion(fechaRuta, otsPeriodo)
        if (!resumenDia) {
          setResultadoRuta({ vacio: true, periodo: 'dia', etiquetaPeriodo: rango.etiqueta })
          return
        }
        setResultadoRuta({
          periodo: 'dia',
          etiquetaPeriodo: rango.etiqueta,
          ...resumenDia,
        })
        return
      }

      const resumenDias = rango.dias
        .map((dia) => {
          const otsDia = otsPeriodo.filter((o) => {
            if (!o.fecha_programada) return false
            return fechaKeyLocal(new Date(o.fecha_programada)) === dia
          })
          return resumenDiaOptimizacion(dia, otsDia)
        })
        .filter(Boolean) as any[]

      if (resumenDias.length === 0) {
        setResultadoRuta({ vacio: true, periodo: periodoRuta, etiquetaPeriodo: rango.etiqueta })
        return
      }

      const totalOTs = resumenDias.reduce((acc: number, d: any) => acc + Number(d.totalOTs || 0), 0)
      const totalTraslado = resumenDias.reduce((acc: number, d: any) => acc + Number(d.totalTraslado || 0), 0)
      const totalAhorro = resumenDias.reduce((acc: number, d: any) => acc + Number(d.totalAhorro || 0), 0)
      const totalExtra = resumenDias.reduce((acc: number, d: any) => acc + Number(d.totalExtra || 0), 0)
      const opcionesFlexibles = generarOpcionesFlexiblesPeriodo(otsPeriodo, resumenDias, rango.dias)

      setResultadoRuta({
        periodo: periodoRuta,
        etiquetaPeriodo: rango.etiqueta,
        resumenDias,
        opcionesFlexibles,
        totalOTs,
        totalTraslado,
        totalAhorro,
        totalExtra,
      })
    } finally {
      setCalculando(false)
    }
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
          const objetivo = String(json.cliente || '').toLowerCase().trim()
          const clienteEncontrado = clientes.find((c: any) => {
            const comercial = nombreComercialCliente(c).toLowerCase()
            const fiscal = nombreFiscalCliente(c).toLowerCase()
            return comercial.includes(objetivo) || fiscal.includes(objetivo) || objetivo.includes(comercial)
          })
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

  const { inicio: inicioMapa, fin: finMapa, etiqueta: etiquetaMapa } = calcularRangoMapa(mapaPeriodo, fechaMapa)
  const ordenesMapa = ordenes
    .filter((o) => {
      if (!o.fecha_programada) return false
      const fecha = new Date(o.fecha_programada)
      return fecha >= inicioMapa && fecha <= finMapa
    })
    .sort((a, b) => new Date(a.fecha_programada).getTime() - new Date(b.fecha_programada).getTime())

  const rutasMapa = construirRutasMapaExtendido(ordenesMapa)
  const rutaMapaActiva = rutasMapa.find((r) => r.id === rutaMapaId) || rutasMapa[0]
  const rutaMapaEmbedUrl = rutaMapaActiva ? crearMapaEmbedUrl(rutaMapaActiva.direcciones) : null
  const rutaMapaAbrirUrl = rutaMapaActiva ? crearRutaGoogleMapsUrl(rutaMapaActiva.direcciones) : null
  const paradasMapaEmbed = rutaMapaActiva ? Math.min(rutaMapaActiva.direcciones.length, 8) : 0

  const { inicio: inicioRutaDiaria, fin: finRutaDiaria } = calcularRangoMapa('dia', fechaMapa)
  const ordenesRutaDiaria = ordenes.filter((o) => {
    if (!o.fecha_programada) return false
    const fecha = new Date(o.fecha_programada)
    return fecha >= inicioRutaDiaria && fecha <= finRutaDiaria
  })
  const rutasMapaDiaria = construirRutasMapaExtendido(ordenesRutaDiaria)
  const rutaDiariaActiva = rutasMapaDiaria.find((r) => r.id === rutaMapaId) || rutasMapaDiaria[0]
  const rutaDiariaCompartirUrl = rutaDiariaActiva ? crearRutaGoogleMapsUrl(rutaDiariaActiva.direcciones) : null

  const presEnviados = presupuestos.filter(p => p.estado === 'enviado').length
  const presAceptados = presupuestos.filter(p => p.estado === 'aceptado').length
  const presPendientes = presupuestos.filter(p => p.estado === 'pendiente').length

  const esAdminOOficina = miRol === 'gerente' || miRol === 'oficina'

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
          tipo: 'otro', cliente_id: pres.cliente_id || null, estado: 'pendiente', prioridad: '2',
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

  async function compartirRutaDiaria() {
    if (!rutaDiariaCompartirUrl) {
      setMensajeCompartirRuta('No hay direcciones en la ruta diaria para compartir.')
      return
    }

    const fechaLabel = new Date(`${fechaMapa}T12:00:00`).toLocaleDateString('es-ES', {
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
    const texto = `Ruta diaria (${fechaLabel})`

    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({
          title: 'Ruta diaria Los Teros',
          text: texto,
          url: rutaDiariaCompartirUrl,
        })
        setMensajeCompartirRuta('Ruta diaria compartida.')
        return
      }

      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(rutaDiariaCompartirUrl)
        setMensajeCompartirRuta('Enlace diario copiado al portapapeles.')
        return
      }

      setMensajeCompartirRuta(`Enlace diario: ${rutaDiariaCompartirUrl}`)
    } catch {
      setMensajeCompartirRuta(`Enlace diario: ${rutaDiariaCompartirUrl}`)
    }
  }

  function toggleCambioSeleccionadoSugerencia(index: number) {
    setCambiosSeleccionadosSugerencia((prev) =>
      prev.includes(index) ? prev.filter((n) => n !== index) : [...prev, index]
    )
  }

  async function sugerirPlanificacionOptima() {
    setSugiriendoPlan(true)
    setErrorSugerenciaPlan('')
    setMensajeSugerenciaPlan('')
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      if (!token) {
        setErrorSugerenciaPlan('Sesion no valida. Vuelve a iniciar sesion.')
        setSugiriendoPlan(false)
        return
      }

      const res = await fetch('/api/planificacion/sugerir', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          scope: periodoRuta,
          baseDate: fechaRuta,
        }),
      })

      const data = await res.json()
      if (!res.ok || data?.error) {
        setErrorSugerenciaPlan(String(data?.error || 'No se pudo generar sugerencia.'))
        setSugiriendoPlan(false)
        return
      }

      const suggestion = data?.suggestion || null
      setSugerenciaPlan({
        ...suggestion,
        deterministic: data?.deterministic || null,
        aiError: data?.aiError || null,
      })
      setSugerenciaPlanId(String(data?.suggestionId || ''))

      const cambios = Array.isArray(suggestion?.recommendedChanges) ? suggestion.recommendedChanges : []
      const indicesIniciales = cambios
        .map((c: any, idx: number) => ({ c, idx }))
        .filter((x: any) => x.c?.type !== 'warning')
        .map((x: any) => x.idx)
      setCambiosSeleccionadosSugerencia(indicesIniciales)

      setMensajeSugerenciaPlan(
        data?.aiError
          ? 'Sugerencia generada con calculo estructurado. La capa IA no respondio en formato valido.'
          : 'Sugerencia generada correctamente.'
      )
    } catch (error: any) {
      setErrorSugerenciaPlan(error?.message || 'Error inesperado al generar sugerencia.')
    }
    setSugiriendoPlan(false)
  }

  async function aplicarSugerenciaOptima(applyAll = false) {
    if (!sugerenciaPlanId) {
      setErrorSugerenciaPlan('No hay sugerencia registrada para aplicar.')
      return
    }
    setAplicandoSugerencia(true)
    setErrorSugerenciaPlan('')
    setMensajeSugerenciaPlan('')
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      if (!token) {
        setErrorSugerenciaPlan('Sesion no valida. Vuelve a iniciar sesion.')
        setAplicandoSugerencia(false)
        return
      }

      const res = await fetch('/api/planificacion/aplicar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          suggestionId: sugerenciaPlanId,
          action: 'apply',
          applyAll,
          changeIndexes: applyAll ? [] : cambiosSeleccionadosSugerencia,
        }),
      })
      const data = await res.json()
      if (!res.ok || data?.error) {
        setErrorSugerenciaPlan(String(data?.error || 'No se pudo aplicar la sugerencia.'))
        setAplicandoSugerencia(false)
        return
      }

      const failed = Number(data?.failed || 0)
      const applied = Number(data?.applied || 0)
      setMensajeSugerenciaPlan(
        failed > 0
          ? `Aplicados ${applied} cambios con ${failed} incidencias. Revisa las OT afectadas.`
          : `Aplicados ${applied} cambios de planificacion.`
      )
      await cargarDatos()
    } catch (error: any) {
      setErrorSugerenciaPlan(error?.message || 'Error inesperado al aplicar cambios.')
    }
    setAplicandoSugerencia(false)
  }

  async function rechazarSugerenciaOptima() {
    if (!sugerenciaPlanId) {
      setSugerenciaPlan(null)
      return
    }
    setAplicandoSugerencia(true)
    setErrorSugerenciaPlan('')
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      if (!token) {
        setErrorSugerenciaPlan('Sesion no valida. Vuelve a iniciar sesion.')
        setAplicandoSugerencia(false)
        return
      }

      const res = await fetch('/api/planificacion/aplicar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          suggestionId: sugerenciaPlanId,
          action: 'reject',
        }),
      })
      const data = await res.json()
      if (!res.ok || data?.error) {
        setErrorSugerenciaPlan(String(data?.error || 'No se pudo rechazar la sugerencia.'))
        setAplicandoSugerencia(false)
        return
      }

      setMensajeSugerenciaPlan('Sugerencia rechazada. Puedes recalcular una nueva.')
      setSugerenciaPlan(null)
      setCambiosSeleccionadosSugerencia([])
      setSugerenciaPlanId('')
    } catch (error: any) {
      setErrorSugerenciaPlan(error?.message || 'Error inesperado al rechazar la sugerencia.')
    }
    setAplicandoSugerencia(false)
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
      <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#7c3aed', borderTopColor: 'transparent' }}></div>
    </div>
  )

  const TABS = [
    { key: 'calendario', label: 'Calendario' },
    { key: 'mis_ordenes', label: 'Mis ordenes', badge: misOrdenesPendientes.length },
    ...(esAdminOOficina ? [{ key: 'presupuestos', label: 'Presupuestos', badge: presEnviados }] : []),
    { key: 'rutas', label: 'Optimizar rutas' },
  ]

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <div className="px-6 py-4 flex items-center justify-between flex-wrap gap-3" style={s.headerStyle}>
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="text-sm transition-colors" style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => e.currentTarget.style.color = '#06b6d4'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>Dashboard</Link>
          <h1 className="font-bold text-lg" style={{ color: 'var(--text)' }}>Planificacion</h1>
        </div>
        {vistaActiva === 'calendario' && (
          <div className="flex items-center gap-3">
            <button onClick={mesAnterior} className="text-sm px-3 py-2 rounded-xl" style={s.btnSecondary}>Anterior</button>
            <span className="font-mono font-bold text-sm min-w-40 text-center" style={{ color: 'var(--text)' }}>{tituloMes}</span>
            <button onClick={mesSiguiente} className="text-sm px-3 py-2 rounded-xl" style={s.btnSecondary}>Siguiente</button>
          </div>
        )}
        {vistaActiva === 'presupuestos' && esAdminOOficina && (
          <button onClick={() => abrirFormPres()} className="text-sm px-4 py-2 rounded-xl font-medium" style={s.btnPrimary}>
            + Nuevo presupuesto
          </button>
        )}
      </div>

      <div className="p-6 max-w-6xl mx-auto">
        <div className="flex gap-2 mb-6 flex-wrap">
          {TABS.map((tab: any) => (
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
                  <h2 className="font-bold text-lg mt-1" style={{ color: 'var(--text)' }}>{getNombreClienteOt(ordenSeleccionada)}</h2>
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
                          {getNombreClienteOt(o)}
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
                        <p className="font-medium text-sm" style={{ color: 'var(--text)' }}>{getNombreClienteOt(o)}</p>
                        {getTextoClienteSecundarioOt(o) && (
                          <p className="text-xs mt-1" style={{ color: 'var(--text-subtle)' }}>{getTextoClienteSecundarioOt(o)}</p>
                        )}
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
                          <p className="font-semibold" style={{ color: 'var(--text)' }}>{getNombreClienteOt(o)}</p>
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
                          <span className="text-sm" style={{ color: 'var(--text)' }}>{getNombreClienteOt(o)}</span>
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

        {vistaActiva === 'presupuestos' && esAdminOOficina && (
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
                        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{nombreComercialCliente(p.clientes) || p.clientes?.nombre || '—'}</p>
                        {(() => {
                          const cli = clientes.find((c: any) => c.id === p.cliente_id)
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
              <h2 className="font-semibold mb-2" style={{ color: 'var(--text)' }}>Mapa de rutas</h2>
              <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
                Visualiza las ubicaciones por dia, semana o mes, y comparte la ruta diaria por enlace de Google Maps.
              </p>

              <div className="flex gap-2 flex-wrap mb-4">
                {[
                  { key: 'dia', label: 'Diaria' },
                  { key: 'semana', label: 'Semanal' },
                  { key: 'mes', label: 'Mensual' },
                ].map((item) => (
                  <button
                    key={item.key}
                    onClick={() => setMapaPeriodo(item.key as 'dia' | 'semana' | 'mes')}
                    className="px-3 py-2 rounded-xl text-sm font-medium"
                    style={mapaPeriodo === item.key ? s.btnPrimary : s.btnSecondary}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="flex gap-3 items-end flex-wrap mb-4">
                <div>
                  <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-muted)' }}>Fecha base</label>
                  <input
                    type="date"
                    value={fechaMapa}
                    onChange={(e) => setFechaMapa(e.target.value)}
                    className="rounded-xl px-3 py-2 text-sm outline-none"
                    style={s.inputStyle}
                  />
                </div>

                <div className="min-w-64">
                  <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-muted)' }}>Ruta</label>
                  <select
                    value={rutaMapaActiva?.id || 'general'}
                    onChange={(e) => setRutaMapaId(e.target.value)}
                    className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                    style={s.inputStyle}
                  >
                    {rutasMapa.map((ruta) => (
                      <option key={ruta.id} value={ruta.id}>
                        {ruta.nombre} ({ruta.ordenes.length} OT)
                      </option>
                    ))}
                  </select>
                </div>

                {rutaMapaAbrirUrl && (
                  <a
                    href={rutaMapaAbrirUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm px-4 py-2 rounded-xl"
                    style={s.btnSecondary}
                  >
                    Abrir en Google Maps
                  </a>
                )}

                <button
                  onClick={compartirRutaDiaria}
                  disabled={!rutaDiariaCompartirUrl}
                  className="text-sm px-4 py-2 rounded-xl font-medium disabled:opacity-50"
                  style={s.btnPrimary}
                >
                  Compartir ruta diaria
                </button>
              </div>

              <p className="text-xs mb-3" style={{ color: 'var(--text-subtle)' }}>
                Periodo seleccionado: {etiquetaMapa}. Paradas visibles en mapa: {paradasMapaEmbed}.
              </p>
              {mensajeCompartirRuta && (
                <p className="text-xs mb-3" style={{ color: '#34d399' }}>
                  {mensajeCompartirRuta}
                </p>
              )}

              {rutaMapaEmbedUrl ? (
                <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                  <iframe
                    title="Mapa de rutas"
                    src={rutaMapaEmbedUrl}
                    className="w-full"
                    style={{ height: '360px', border: '0' }}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                </div>
              ) : (
                <div className="rounded-xl p-4 text-sm" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                  No hay direcciones suficientes para mostrar el mapa en este periodo.
                </div>
              )}

              {Array.isArray(rutaMapaActiva?.paradas) && rutaMapaActiva.paradas.length > 0 && (
                <div className="mt-4 rounded-xl p-4" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                  <p className="text-sm font-semibold mb-3" style={{ color: 'var(--text)' }}>
                    Itinerario operativo de la ruta
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {rutaMapaActiva.paradas.map((parada: any, idx: number) => {
                      const clienteNombre = nombreComercialCliente(parada?.cliente) || parada?.cliente?.nombre || 'Sin cliente'
                      const ot = parada?.ot
                      const codigoOt = String(ot?.codigo || '').trim()
                      const direccion = String(parada?.direccion || parada?.cliente?.direccion || '').trim()
                      const inicio = Number(parada?.estInicioMin || 0)
                      const fin = Number(parada?.estFinMin || 0)
                      return (
                        <div
                          key={`${rutaMapaActiva.id}-parada-${idx}-${ot?.id || 'x'}`}
                          className="rounded-xl px-3 py-3"
                          style={{ border: '1px solid var(--border)', background: 'var(--card)' }}
                        >
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="text-xs px-2 py-1 rounded-full" style={{ background: 'rgba(6,182,212,0.15)', color: '#06b6d4' }}>
                              {letraParada(idx)}
                            </span>
                            <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                              {formatHora(inicio)} - {formatHora(fin)}
                            </span>
                          </div>
                          <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{clienteNombre}</p>
                          {codigoOt && (
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>OT {codigoOt}</p>
                          )}
                          {direccion && (
                            <p className="text-xs mt-1" style={{ color: 'var(--text-subtle)' }}>{direccion}</p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-2xl p-5 mb-6" style={s.cardStyle}>
              <h2 className="font-semibold mb-2" style={{ color: 'var(--text)' }}>Sugerir planificacion optima</h2>
              <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
                Genera una propuesta inteligente para dia, semana o mes. No aplica cambios automaticamente: primero revisas y luego decides.
              </p>

              <div className="flex gap-3 items-end flex-wrap mb-4">
                <div>
                  <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-muted)' }}>
                    Alcance sugerencia
                  </label>
                  <select
                    value={periodoRuta}
                    onChange={(e) => setPeriodoRuta(e.target.value as 'dia' | 'semana' | 'mes')}
                    className="rounded-xl px-3 py-2 text-sm outline-none"
                    style={s.inputStyle}
                  >
                    <option value="dia">Diario</option>
                    <option value="semana">Semanal</option>
                    <option value="mes">Mensual</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-muted)' }}>
                    Fecha base
                  </label>
                  <input
                    type="date"
                    value={fechaRuta}
                    onChange={(e) => setFechaRuta(e.target.value)}
                    className="rounded-xl px-3 py-2 text-sm outline-none"
                    style={s.inputStyle}
                  />
                </div>
                <button
                  onClick={sugerirPlanificacionOptima}
                  disabled={sugiriendoPlan}
                  className="text-sm px-4 py-2 rounded-xl font-medium disabled:opacity-50"
                  style={s.btnPrimary}
                >
                  {sugiriendoPlan ? 'Generando sugerencia...' : 'Sugerir planificacion optima'}
                </button>
              </div>

              {errorSugerenciaPlan && (
                <div className="rounded-xl p-3 mb-3" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
                  <p className="text-xs" style={{ color: '#f87171' }}>{errorSugerenciaPlan}</p>
                </div>
              )}
              {mensajeSugerenciaPlan && (
                <div className="rounded-xl p-3 mb-3" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
                  <p className="text-xs" style={{ color: '#34d399' }}>{mensajeSugerenciaPlan}</p>
                </div>
              )}

              {sugerenciaPlan && (
                <div className="mt-4">
                  <div className="rounded-xl p-4 mb-4" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                    <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text)' }}>{sugerenciaPlan.summary || 'Sugerencia generada'}</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      Alcance: {String(sugerenciaPlan.planningScope || periodoRuta).toUpperCase()}.
                      Cambios recomendados: {Array.isArray(sugerenciaPlan.recommendedChanges) ? sugerenciaPlan.recommendedChanges.length : 0}.
                    </p>
                    {sugerenciaPlan.aiError && (
                      <p className="text-xs mt-2" style={{ color: '#fbbf24' }}>
                        Nota IA: {sugerenciaPlan.aiError}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div className="rounded-xl p-4" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                      <p className="text-xs uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Carga actual estimada</p>
                      <div className="space-y-2">
                        {(sugerenciaPlan?.deterministic?.currentLoadByWorker || []).slice(0, 8).map((w: any) => (
                          <div key={`curr-${w.workerId}`} className="flex items-center justify-between gap-3">
                            <p className="text-xs" style={{ color: 'var(--text)' }}>{w.workerName}</p>
                            <p className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                              {w.estimatedMinutes} min · {w.orderCount} OT
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-xl p-4" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                      <p className="text-xs uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Carga sugerida</p>
                      <div className="space-y-2">
                        {(sugerenciaPlan?.deterministic?.suggestedLoadByWorker || []).slice(0, 8).map((w: any) => (
                          <div key={`sug-${w.workerId}`} className="flex items-center justify-between gap-3">
                            <p className="text-xs" style={{ color: 'var(--text)' }}>{w.workerName}</p>
                            <p className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                              {w.estimatedMinutes} min · {w.orderCount} OT
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl p-4 mb-4" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                    <p className="text-sm font-semibold mb-3" style={{ color: 'var(--text)' }}>Rutas sugeridas por trabajador</p>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                      {(sugerenciaPlan.suggestedRoutes || []).map((ruta: any) => (
                        <div key={`${ruta.workerId}-${ruta.date}`} className="rounded-xl p-3" style={{ border: '1px solid var(--border)', background: 'var(--card)' }}>
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{ruta.workerName}</p>
                            <p className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{ruta.date}</p>
                          </div>
                          <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
                            Servicio {ruta.estimatedServiceMinutes} min · Desplazamiento {ruta.estimatedTravelMinutes} min · Total {ruta.estimatedTotalMinutes} min
                          </p>
                          <p className="text-xs mb-2" style={{ color: ruta.overloadMinutes > 0 ? '#f87171' : '#34d399' }}>
                            {ruta.overloadMinutes > 0
                              ? `Sobrecarga: ${ruta.overloadMinutes} min`
                              : `Hueco disponible: ${ruta.freeMinutes} min`}
                          </p>
                          <div className="space-y-1">
                            {(ruta.route || []).slice(0, 6).map((stop: any, idx: number) => (
                              <p key={`${stop.orderId}-${idx}`} className="text-xs" style={{ color: 'var(--text-subtle)' }}>
                                {idx + 1}. {stop.suggestedStartTime} - {stop.clientName} ({stop.locality})
                              </p>
                            ))}
                          </div>
                          <p className="text-xs mt-2" style={{ color: '#06b6d4' }}>{ruta.routeReasoning}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {(sugerenciaPlan.warnings || []).length > 0 && (
                    <div className="rounded-xl p-4 mb-4" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                      <p className="text-sm font-semibold mb-2" style={{ color: 'var(--text)' }}>Alertas detectadas</p>
                      <div className="space-y-2">
                        {sugerenciaPlan.warnings.map((warn: any, idx: number) => (
                          <div key={`warn-${idx}`} className="rounded-lg px-3 py-2"
                            style={warn.level === 'critical'
                              ? { background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.22)' }
                              : warn.level === 'warning'
                                ? { background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.2)' }
                                : { background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.2)' }}>
                            <p className="text-xs" style={{ color: 'var(--text)' }}>{warn.message}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {(sugerenciaPlan.missingData || []).length > 0 && (
                    <div className="rounded-xl p-4 mb-4" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                      <p className="text-sm font-semibold mb-2" style={{ color: 'var(--text)' }}>Datos faltantes que afectan precision</p>
                      <div className="space-y-2">
                        {sugerenciaPlan.missingData.slice(0, 10).map((item: any, idx: number) => (
                          <div key={`missing-${idx}`} className="rounded-lg px-3 py-2" style={{ background: 'rgba(71,85,105,0.08)', border: '1px solid rgba(71,85,105,0.2)' }}>
                            <p className="text-xs" style={{ color: 'var(--text)' }}>
                              {item.entityType} {item.entityId}: falta {item.field}. Impacto: {item.impact}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {(sugerenciaPlan.recommendedChanges || []).length > 0 && (
                    <div className="rounded-xl p-4 mb-4" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                      <p className="text-sm font-semibold mb-2" style={{ color: 'var(--text)' }}>Cambios recomendados (aplicacion parcial)</p>
                      <div className="space-y-2 max-h-80 overflow-auto pr-1">
                        {sugerenciaPlan.recommendedChanges.map((change: any, idx: number) => {
                          const type = String(change.type || 'warning')
                          const isWarning = type === 'warning'
                          const checked = cambiosSeleccionadosSugerencia.includes(idx)
                          return (
                            <label key={`change-${idx}`} className="flex items-start gap-3 rounded-lg px-3 py-2"
                              style={{ background: 'var(--card)', border: '1px solid var(--border)', opacity: isWarning ? 0.75 : 1 }}>
                              <input
                                type="checkbox"
                                disabled={isWarning}
                                checked={isWarning ? false : checked}
                                onChange={() => toggleCambioSeleccionadoSugerencia(idx)}
                                className="mt-1"
                              />
                              <div>
                                <p className="text-xs font-semibold uppercase" style={{ color: type === 'warning' ? '#fbbf24' : '#06b6d4' }}>
                                  {type} - OT {change.orderId}
                                </p>
                                <p className="text-xs mt-0.5" style={{ color: 'var(--text)' }}>{change.reason}</p>
                              </div>
                            </label>
                          )
                        })}
                      </div>

                      <div className="flex gap-2 flex-wrap mt-4">
                        <button
                          onClick={() => aplicarSugerenciaOptima(false)}
                          disabled={aplicandoSugerencia || cambiosSeleccionadosSugerencia.length === 0}
                          className="text-sm px-4 py-2 rounded-xl font-medium disabled:opacity-50"
                          style={s.btnPrimary}
                        >
                          {aplicandoSugerencia ? 'Aplicando...' : `Aplicar seleccionados (${cambiosSeleccionadosSugerencia.length})`}
                        </button>
                        <button
                          onClick={() => aplicarSugerenciaOptima(true)}
                          disabled={aplicandoSugerencia}
                          className="text-sm px-4 py-2 rounded-xl disabled:opacity-50"
                          style={s.btnSecondary}
                        >
                          Aplicar todos
                        </button>
                        <button
                          onClick={rechazarSugerenciaOptima}
                          disabled={aplicandoSugerencia}
                          className="text-sm px-4 py-2 rounded-xl disabled:opacity-50"
                          style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171', border: '1px solid rgba(239,68,68,0.22)' }}
                        >
                          Rechazar sugerencia
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="rounded-2xl p-5 mb-6" style={s.cardStyle}>
              <h2 className="font-semibold mb-2" style={{ color: 'var(--text)' }}>Optimizador de rutas</h2>
              <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
                Optimiza por zona, trabajador, horario fijo/flexible y carga de jornada. En modo semana/mes propone alternativas para negociar horas de OT flexibles.
              </p>
              <div className="flex gap-3 items-end flex-wrap">
                <div>
                  <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-muted)' }}>Periodo</label>
                  <select
                    value={periodoRuta}
                    onChange={(e) => setPeriodoRuta(e.target.value as 'dia' | 'semana' | 'mes')}
                    className="rounded-xl px-3 py-2 text-sm outline-none"
                    style={s.inputStyle}
                  >
                    <option value="dia">Diario</option>
                    <option value="semana">Semanal</option>
                    <option value="mes">Mensual</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-muted)' }}>
                    {periodoRuta === 'dia' ? 'Dia a planificar' : periodoRuta === 'semana' ? 'Semana base' : 'Mes base'}
                  </label>
                  <input type="date" value={fechaRuta} onChange={e => setFechaRuta(e.target.value)}
                    className="rounded-xl px-3 py-2 text-sm outline-none" style={s.inputStyle} />
                </div>
                <button onClick={calcularRutas} disabled={calculando}
                  className="px-6 py-2 rounded-xl text-sm font-medium disabled:opacity-50" style={s.btnPrimary}>
                  {calculando ? 'Calculando...' : 'Optimizar ruta'}
                </button>
              </div>
            </div>

            {resultadoRuta?.vacio && (
              <div className="text-center py-12 rounded-2xl" style={s.cardStyle}>
                <p className="text-3xl mb-2">📅</p>
                <p style={{ color: 'var(--text-muted)' }}>
                  {resultadoRuta?.periodo === 'dia'
                    ? 'No hay ordenes pendientes para ese dia.'
                    : `No hay ordenes pendientes para este periodo (${resultadoRuta?.etiquetaPeriodo || ''}).`}
                </p>
              </div>
            )}

            {resultadoRuta?.periodo === 'dia' && resultadoRuta?.resultados && (
              <div className="flex flex-col gap-6">
                <div className="rounded-2xl p-4" style={s.cardStyle}>
                  <p className="font-semibold" style={{ color: 'var(--text)' }}>{new Date(resultadoRuta.fecha + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</p>
                  <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{resultadoRuta.totalOTs} ordenes - {resultadoRuta.resultados.length} trabajadores</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                    <div className="rounded-xl px-3 py-2" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                      <p className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Traslado total</p>
                      <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{resultadoRuta.totalTraslado || 0} min</p>
                    </div>
                    <div className="rounded-xl px-3 py-2" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                      <p className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Ahorro estimado</p>
                      <p className="text-sm font-semibold" style={{ color: '#34d399' }}>{resultadoRuta.totalAhorro || 0} min</p>
                    </div>
                    <div className="rounded-xl px-3 py-2" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                      <p className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Horas extra previstas</p>
                      <p className="text-sm font-semibold" style={{ color: (resultadoRuta.totalExtra || 0) > 0 ? '#f87171' : '#34d399' }}>{resultadoRuta.totalExtra || 0} min</p>
                    </div>
                  </div>
                </div>

                {resultadoRuta.resultados.map((res: any) => (
                  <div key={res.tecnico.id} className="rounded-2xl overflow-hidden" style={s.cardStyle}>
                    <div className="px-5 py-3 flex items-center justify-between flex-wrap gap-2" style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                      <div>
                        <p className="font-semibold" style={{ color: 'var(--text)' }}>{res.tecnico.nombre}</p>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          Salida 06:00 desde Elche - {res.ruta.length} paradas - {res.horasTotales}h trabajo
                        </p>
                        <p className="text-xs mt-1" style={{ color: 'var(--text-subtle)' }}>
                          Traslado {res.trasladoTotalMin || 0} min - Esperas {res.esperaTotalMin || 0} min - Utilizacion {res.utilizacionPct || 0}%
                        </p>
                      </div>
                      <span className="text-xs px-3 py-1 rounded-full font-medium"
                        style={res.cabeEnJornada
                          ? { background: 'rgba(16,185,129,0.15)', color: '#34d399', border: '1px solid rgba(16,185,129,0.3)' }
                          : { background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>
                        {res.cabeEnJornada ? 'Cabe en jornada 6-15h' : 'Excede jornada'}
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
                            <p className="font-mono text-sm font-bold" style={{ color: '#34d399' }}>06:00</p>
                          </div>
                        </div>

                        {(res.advertencias || []).length > 0 && (
                          <div className="rounded-xl px-3 py-2" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                            {(res.advertencias || []).slice(0, 2).map((msg: string, idx: number) => (
                              <p key={`${res.tecnico.id}-warn-${idx}`} className="text-xs" style={{ color: '#f87171' }}>
                                {msg}
                              </p>
                            ))}
                          </div>
                        )}

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
                                    <p className="font-medium text-sm" style={{ color: 'var(--text)' }}>{nombreComercialCliente(parada.cliente) || parada.cliente?.nombre || '—'}</p>
                                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{parada.cliente?.direccion || '—'}</p>
                                    <p className="text-xs mt-1 capitalize" style={{ color: 'var(--text-subtle)' }}>{parada.ot.tipo} — {parada.ot.duracion_horas || 2}h</p>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-sm font-mono font-bold" style={{ color: 'var(--text)' }}>{formatHora(parada.horaInicio)}</p>
                                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>hasta {formatHora(parada.horaFin)}</p>
                                    {!parada.horaFija && (
                                      <p className="text-xs mt-1" style={{ color: '#a78bfa' }}>
                                        Opciones: {obtenerOpcionesNegociables(parada).map((op: any) => `${formatHora(op.inicio)}-${formatHora(op.fin)}`).join(' / ')}
                                      </p>
                                    )}
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
                            <span className="text-sm" style={{ color: 'var(--text)' }}>{getNombreClienteOt(o)}</span>
                          </div>
                          <span className="text-xs" style={{ color: '#fbbf24' }}>{o.duracion_horas || 2}h</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {resultadoRuta.sugerencias?.length > 0 && (
                  <div className="rounded-2xl p-5" style={{ background: 'rgba(6,182,212,0.06)', border: '1px solid rgba(6,182,212,0.25)' }}>
                    <p className="font-semibold mb-3" style={{ color: '#06b6d4' }}>Sugerencias de asignacion IA</p>
                    <div className="flex flex-col gap-2">
                      {resultadoRuta.sugerencias.map((sug: any) => (
                        <div key={`sug-${sug.ot.id}-${sug.tecnicoId}`} className="rounded-lg px-3 py-2 flex items-center justify-between gap-3 flex-wrap" style={{ background: 'rgba(6,182,212,0.08)' }}>
                          <div>
                            <p className="text-sm" style={{ color: 'var(--text)' }}>
                              {sug.ot.codigo} - {getNombreClienteOt(sug.ot)}
                            </p>
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                              Asignar a <strong>{sug.tecnicoNombre}</strong> a las {formatHora(sug.horaInicio)}
                            </p>
                          </div>
                          <p className="text-xs" style={{ color: '#06b6d4' }}>
                            traslado {sug.trasladoMin} min{(sug.extraMin || 0) > 0 ? ` - extra ${sug.extraMin} min` : ''}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {resultadoRuta?.periodo !== 'dia' && resultadoRuta?.resumenDias && (
              <div className="flex flex-col gap-6">
                <div className="rounded-2xl p-4" style={s.cardStyle}>
                  <p className="font-semibold" style={{ color: 'var(--text)' }}>
                    {resultadoRuta.etiquetaPeriodo}
                  </p>
                  <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                    {resultadoRuta.totalOTs} ordenes - {resultadoRuta.resumenDias.length} dias con actividad
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                    <div className="rounded-xl px-3 py-2" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                      <p className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Traslado total</p>
                      <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{resultadoRuta.totalTraslado || 0} min</p>
                    </div>
                    <div className="rounded-xl px-3 py-2" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                      <p className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Ahorro estimado</p>
                      <p className="text-sm font-semibold" style={{ color: '#34d399' }}>{resultadoRuta.totalAhorro || 0} min</p>
                    </div>
                    <div className="rounded-xl px-3 py-2" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                      <p className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Horas extra previstas</p>
                      <p className="text-sm font-semibold" style={{ color: (resultadoRuta.totalExtra || 0) > 0 ? '#f87171' : '#34d399' }}>{resultadoRuta.totalExtra || 0} min</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl p-5" style={s.cardStyle}>
                  <p className="font-semibold mb-3" style={{ color: 'var(--text)' }}>Resumen por dia</p>
                  <div className="flex flex-col gap-2">
                    {resultadoRuta.resumenDias.map((dia: any) => (
                      <div key={`dia-${dia.fecha}`} className="rounded-xl px-3 py-3 flex items-center justify-between gap-3 flex-wrap" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                        <div>
                          <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                            {new Date(`${dia.fecha}T12:00:00`).toLocaleDateString('es-ES', { weekday: 'long', day: '2-digit', month: '2-digit' })}
                          </p>
                          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                            {dia.totalOTs} OT - {dia.resultados.length} trabajadores - Zonas: {(dia.zonasDominantes || []).join(', ') || 'Mixto'}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs" style={{ color: '#06b6d4' }}>Traslado {dia.totalTraslado || 0} min</p>
                          <p className="text-xs" style={{ color: (dia.totalExtra || 0) > 0 ? '#f87171' : '#34d399' }}>Extra {dia.totalExtra || 0} min</p>
                          <button
                            onClick={() => {
                              setFechaRuta(dia.fecha)
                              setPeriodoRuta('dia')
                              setResultadoRuta(null)
                            }}
                            className="mt-1 text-xs px-2 py-1 rounded-lg"
                            style={{ color: '#a78bfa', background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.25)' }}
                          >
                            Ver detalle diario
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {(resultadoRuta.opcionesFlexibles || []).length > 0 && (
                  <div className="rounded-2xl p-5" style={{ background: 'rgba(6,182,212,0.06)', border: '1px solid rgba(6,182,212,0.25)' }}>
                    <p className="font-semibold mb-2" style={{ color: '#06b6d4' }}>Opciones para OT flexibles</p>
                    <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
                      Estas alternativas mantienen las OT con hora fija y te proponen huecos de mejor eficiencia por zona/carga para semana o mes.
                    </p>
                    <div className="flex flex-col gap-3">
                      {resultadoRuta.opcionesFlexibles.map((item: any) => (
                        <div key={`flex-${item.ot.id}`} className="rounded-xl px-3 py-3" style={{ background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.2)' }}>
                          <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                            {item.ot.codigo} - {nombreComercialCliente(item.cliente) || item.cliente?.nombre || '—'}
                          </p>
                          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                            Actual: {item.fechaOriginal} - Zona {ZONAS[item.zona]?.nombre || item.zona}
                          </p>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {item.opciones.map((op: any, idx: number) => (
                              <span key={`${item.ot.id}-op-${idx}`} className="text-xs px-2 py-1 rounded-lg" style={{ background: idx === 0 ? 'rgba(16,185,129,0.18)' : 'rgba(124,58,237,0.12)', color: idx === 0 ? '#34d399' : '#a78bfa', border: idx === 0 ? '1px solid rgba(16,185,129,0.35)' : '1px solid rgba(124,58,237,0.25)' }}>
                                {idx === 0 ? 'Recomendada' : `Opcion ${idx + 1}`}: {new Date(`${op.fecha}T12:00:00`).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })} - {op.tecnicoNombre} - {formatHora(op.inicioEstimado)}-{formatHora(op.finEstimado)}
                              </span>
                            ))}
                          </div>
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
