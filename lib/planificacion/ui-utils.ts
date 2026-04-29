export type UiPeriodoRuta = 'dia' | 'semana' | 'mes'

export type AnyRecord = Record<string, any>
export type ClientResolver = (ot: AnyRecord) => AnyRecord | null
export type TechnicianNameResolver = (id: string) => string

type RutaTecnicoResultado = {
  tecnico: AnyRecord
  ruta: AnyRecord[]
  horasTotales: number
  cabeEnJornada: boolean
  horaFinal: number
  horaFinalTrabajo: number
  zonaFinal: string
  trasladoTotalMin: number
  esperaTotalMin: number
  trabajoTotalMin: number
  extraMin: number
  utilizacionPct: number
  ahorroTrasladoMin: number
  zonasVisitadas: string[]
  advertencias: string[]
}

export const PLANIFICACION_ZONAS: Record<string, { nombre: string; orden: number; tiempo_desde_elche: number }> = {
  alicante: { nombre: 'Alicante', orden: 2, tiempo_desde_elche: 30 },
  elche: { nombre: 'Elche', orden: 1, tiempo_desde_elche: 0 },
  'santa pola': { nombre: 'Santa Pola', orden: 2, tiempo_desde_elche: 20 },
  murcia: { nombre: 'Murcia', orden: 4, tiempo_desde_elche: 60 },
  denia: { nombre: 'Denia', orden: 3, tiempo_desde_elche: 90 },
  torrevieja: { nombre: 'Torrevieja', orden: 3, tiempo_desde_elche: 40 },
  guardamar: { nombre: 'Guardamar', orden: 2, tiempo_desde_elche: 25 },
  benidorm: { nombre: 'Benidorm', orden: 3, tiempo_desde_elche: 70 },
  crevillente: { nombre: 'Crevillente', orden: 1, tiempo_desde_elche: 10 },
  orihuela: { nombre: 'Orihuela', orden: 3, tiempo_desde_elche: 45 },
}

export function calcularRangoMapa(periodo: UiPeriodoRuta, fechaBaseIso: string) {
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
      etiqueta: inicio.toLocaleDateString('es-ES', {
        weekday: 'long',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }),
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

export function normalizarDirecciones(lista: string[]) {
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

export function crearMapaEmbedUrl(direcciones: string[]) {
  if (direcciones.length === 0) return null
  const paradas = direcciones
    .map((d) => String(d || '').trim())
    .filter(Boolean)
    .slice(0, 23)
  if (paradas.length === 1) return `https://maps.google.com/maps?q=${encodeURIComponent(paradas[0])}&output=embed`
  const daddr = encodeURIComponent(paradas.join(' to '))
  return `https://maps.google.com/maps?saddr=${encodeURIComponent('Calle Leonardo Da Vinci 12, Elche')}&daddr=${daddr}&dirflg=d&output=embed`
}

export function crearRutaGoogleMapsUrl(direcciones: string[]) {
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

function fechaOtKey(ot: AnyRecord) {
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

export function detectarZona(direccion: string): string {
  if (!direccion) return 'elche'
  const dir = direccion.toLowerCase()
  for (const zona of Object.keys(PLANIFICACION_ZONAS)) {
    if (dir.includes(zona)) return zona
  }
  return 'elche'
}

export function calcularTiempoEntreZonas(zona1: string, zona2: string): number {
  const t1 = PLANIFICACION_ZONAS[zona1]?.tiempo_desde_elche || 30
  const t2 = PLANIFICACION_ZONAS[zona2]?.tiempo_desde_elche || 30
  return Math.abs(t1 - t2) + 15
}

export function formatHora(minutos: number): string {
  const h = Math.floor(minutos / 60)
  const m = minutos % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function letraParada(idx: number) {
  const abecedario = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  if (idx < abecedario.length) return abecedario[idx]
  const prefijo = abecedario[Math.floor(idx / abecedario.length) - 1] || 'Z'
  return `${prefijo}${abecedario[idx % abecedario.length]}`
}

export function prioridadPeso(prioridad: string) {
  const p = String(prioridad || '').trim().toLowerCase()
  if (p === '3' || p === 'alta' || p === 'urgente') return 24
  if (p === '1' || p === 'baja') return 6
  return 12
}

export function obtenerTecnicosOt(ot: AnyRecord) {
  if (Array.isArray(ot.tecnicos_ids) && ot.tecnicos_ids.length > 0) return ot.tecnicos_ids
  if (ot.tecnico_id) return [ot.tecnico_id]
  return []
}

export function duracionOtMin(ot: AnyRecord) {
  return Math.max(15, Number(ot.duracion_horas || 2) * 60)
}

export function horaOtMin(ot: AnyRecord) {
  if (!ot?.fecha_programada) return null
  const fechaOt = new Date(ot.fecha_programada)
  if (Number.isNaN(fechaOt.getTime())) return null
  return fechaOt.getHours() * 60 + fechaOt.getMinutes()
}

function ordenarOtsParaMapa(ots: AnyRecord[], resolveClient: ClientResolver) {
  const conHora = ots
    .filter((o) => o.hora_fija && o.fecha_programada)
    .sort((a, b) => new Date(a.fecha_programada).getTime() - new Date(b.fecha_programada).getTime())
  const flexibles = ots
    .filter((o) => !o.hora_fija)
    .sort((a, b) => prioridadPeso(b.prioridad || '2') - prioridadPeso(a.prioridad || '2'))

  const paradas: AnyRecord[] = []
  let zonaActual = 'elche'
  let horaCursor = 6 * 60

  function elegirFlexible(hastaMin: number | null) {
    let bestIdx = -1
    let bestScore = Number.POSITIVE_INFINITY
    for (let i = 0; i < flexibles.length; i++) {
      const ot = flexibles[i]
      const cli = resolveClient(ot)
      const zona = detectarZona(cli?.direccion || '')
      const traslado = calcularTiempoEntreZonas(zonaActual, zona)
      const inicio = horaCursor + traslado
      const fin = inicio + duracionOtMin(ot)
      if (hastaMin !== null && fin > hastaMin) continue
      const score = traslado * 1.6 + (PLANIFICACION_ZONAS[zona]?.orden || 2) * 2 - prioridadPeso(ot.prioridad || '2')
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
      const cli = resolveClient(ot)
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
    const cli = resolveClient(fija)
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

function dividirParadasEnRutas(paradas: AnyRecord[], maxMin = 9 * 60) {
  if (!paradas.length) return []
  const rutas: AnyRecord[][] = []
  let actual: AnyRecord[] = []
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

export function construirRutasMapaExtendido(
  ordenesBase: AnyRecord[],
  resolveClient: ClientResolver,
  resolveTechnicianName: TechnicianNameResolver
) {
  if (!ordenesBase.length) return []
  const ordenadas = [...ordenesBase].sort(
    (a, b) => new Date(a.fecha_programada || 0).getTime() - new Date(b.fecha_programada || 0).getTime()
  )
  const rutas: AnyRecord[] = []
  const capacidadRutaMin = 9 * 60

  const paradasGeneral = ordenarOtsParaMapa(ordenadas, resolveClient)
  rutas.push({
    id: 'general',
    nombre: 'Ruta general empresa',
    ordenes: ordenadas,
    paradas: paradasGeneral,
    direcciones: normalizarDirecciones(paradasGeneral.map((p: AnyRecord) => p.direccion).filter(Boolean)),
  })

  const porDia = new Map<string, AnyRecord[]>()
  for (const ot of ordenadas) {
    const key = fechaOtKey(ot)
    if (!porDia.has(key)) porDia.set(key, [])
    porDia.get(key)!.push(ot)
  }

  for (const [diaKey, otsDia] of Array.from(porDia.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
    const labelDia = etiquetaDiaRuta(diaKey)

    const paradasDia = ordenarOtsParaMapa(otsDia, resolveClient)
    const bloquesDia = dividirParadasEnRutas(paradasDia, capacidadRutaMin)
    bloquesDia.forEach((bloque, idx) => {
      rutas.push({
        id: `dia-${diaKey}-global-${idx + 1}`,
        nombre: `${labelDia} - Ruta global ${idx + 1}`,
        ordenes: bloque.map((p: AnyRecord) => p.ot),
        paradas: bloque,
        direcciones: bloque.map((p: AnyRecord) => String(p.direccion || '').trim()).filter(Boolean),
      })
    })

    const porTecnico = new Map<string, AnyRecord[]>()
    const sinAsignar: AnyRecord[] = []
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
      const n1 = resolveTechnicianName(a[0])
      const n2 = resolveTechnicianName(b[0])
      return n1.localeCompare(n2, 'es')
    })) {
      const nombreTec = resolveTechnicianName(tecnicoId) || 'Tecnico'
      const paradasTecnico = ordenarOtsParaMapa(otsTec, resolveClient)
      const bloquesTecnico = dividirParadasEnRutas(paradasTecnico, capacidadRutaMin)
      bloquesTecnico.forEach((bloque, idx) => {
        rutas.push({
          id: `dia-${diaKey}-tec-${tecnicoId}-${idx + 1}`,
          nombre: `${labelDia} - ${nombreTec} - Ruta ${idx + 1}`,
          ordenes: bloque.map((p: AnyRecord) => p.ot),
          paradas: bloque,
          direcciones: bloque.map((p: AnyRecord) => String(p.direccion || '').trim()).filter(Boolean),
        })
      })
    }

    if (sinAsignar.length > 0) {
      const paradasSinAsignar = ordenarOtsParaMapa(sinAsignar, resolveClient)
      const bloquesSinAsignar = dividirParadasEnRutas(paradasSinAsignar, capacidadRutaMin)
      bloquesSinAsignar.forEach((bloque, idx) => {
        rutas.push({
          id: `dia-${diaKey}-sin-${idx + 1}`,
          nombre: `${labelDia} - Ruta ${idx + 1} (sin asignar)`,
          ordenes: bloque.map((p: AnyRecord) => p.ot),
          paradas: bloque,
          direcciones: bloque.map((p: AnyRecord) => String(p.direccion || '').trim()).filter(Boolean),
        })
      })
    }
  }

  return rutas
}

function calcularTrasladoBase(otsTecnico: AnyRecord[], resolveClient: ClientResolver) {
  if (otsTecnico.length <= 1) return 0
  let zonaActual = 'elche'
  let traslado = 0
  const ordenBase = [...otsTecnico].sort((a, b) => {
    const fa = new Date(a.fecha_programada || 0).getTime()
    const fb = new Date(b.fecha_programada || 0).getTime()
    return fa - fb
  })
  for (const ot of ordenBase) {
    const clienteOt = resolveClient(ot)
    const zonaOt = detectarZona(clienteOt?.direccion || '')
    traslado += calcularTiempoEntreZonas(zonaActual, zonaOt)
    zonaActual = zonaOt
  }
  traslado += calcularTiempoEntreZonas(zonaActual, 'elche')
  return traslado
}

function optimizarRutaTecnico(otsDelDia: AnyRecord[], tecnicoId: string, resolveClient: ClientResolver) {
  const INICIO = 6 * 60
  const FIN = 15 * 60
  const otsTecnico = otsDelDia.filter((o) => obtenerTecnicosOt(o).includes(tecnicoId))
  const otsConHora = otsTecnico
    .filter((o) => o.hora_fija && o.fecha_programada)
    .sort((a, b) => new Date(a.fecha_programada).getTime() - new Date(b.fecha_programada).getTime())

  const pendientesFlexibles = otsTecnico
    .filter((o) => !o.hora_fija)
    .sort((a, b) => prioridadPeso(b.prioridad || '2') - prioridadPeso(a.prioridad || '2'))

  const ruta: AnyRecord[] = []
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
      const clienteOt = resolveClient(ot)
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
      const clienteOt = resolveClient(ot)
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

    const clienteOt = resolveClient(otFija)
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
  const trasladoBase = calcularTrasladoBase(otsTecnico, resolveClient)
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
    zonasVisitadas: Array.from(new Set(ruta.map((r: AnyRecord) => r.zona).filter(Boolean))),
    advertencias,
  }
}

function sugerirAsignaciones(
  otsSinAsignar: AnyRecord[],
  resultadosBase: RutaTecnicoResultado[],
  resolveClient: ClientResolver
) {
  if (!otsSinAsignar.length || !resultadosBase.length) return []

  const estadoTecnicos = resultadosBase.map((res) => ({
    tecnicoId: res.tecnico.id,
    tecnicoNombre: res.tecnico.nombre,
    horaActual: res.horaFinalTrabajo || 6 * 60,
    zonaActual: res.zonaFinal || 'elche',
    extraActual: res.extraMin || 0,
  }))

  const sugerencias: AnyRecord[] = []

  const pendientes = [...otsSinAsignar].sort((a, b) => {
    const p = prioridadPeso(b.prioridad || '2') - prioridadPeso(a.prioridad || '2')
    if (p !== 0) return p
    return duracionOtMin(b) - duracionOtMin(a)
  })

  for (const ot of pendientes) {
    const clienteOt = resolveClient(ot)
    const zonaOt = detectarZona(clienteOt?.direccion || '')
    const duracion = duracionOtMin(ot)

    let mejor: AnyRecord | null = null
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

export function fechaKeyLocal(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function obtenerRangoOptimizacion(periodo: UiPeriodoRuta, fechaBaseIso: string) {
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

function resumenDiaOptimizacion(
  fechaIso: string,
  otsDia: AnyRecord[],
  tecnicos: AnyRecord[],
  resolveClient: ClientResolver
) {
  if (!otsDia.length) return null
  const tecnicosDelDia = tecnicos.filter((t) => otsDia.some((o) => obtenerTecnicosOt(o).includes(t.id)))
  const resultados: RutaTecnicoResultado[] = tecnicosDelDia.map((t) => ({
    tecnico: t,
    ...optimizarRutaTecnico(otsDia, t.id, resolveClient),
  }))
  const otsSinAsignar = otsDia.filter((o) => (!o.tecnicos_ids || o.tecnicos_ids.length === 0) && !o.tecnico_id)
  const sugerencias = sugerirAsignaciones(otsSinAsignar, resultados, resolveClient)
  const totalTraslado = resultados.reduce((acc, r) => acc + Number(r.trasladoTotalMin || 0), 0)
  const totalAhorro = resultados.reduce((acc, r) => acc + Number(r.ahorroTrasladoMin || 0), 0)
  const totalExtra = resultados.reduce((acc, r) => acc + Number(r.extraMin || 0), 0)
  const zonas = resultados.flatMap((r) => r.zonasVisitadas || [])
  const contador = new Map<string, number>()
  for (const z of zonas) contador.set(z, (contador.get(z) || 0) + 1)
  const zonasDominantes = Array.from(contador.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([zona]) => PLANIFICACION_ZONAS[zona]?.nombre || zona)

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

function construirEstadoTecnicosPeriodo(resumenDias: AnyRecord[]) {
  const estado = new Map<string, AnyRecord>()
  for (const dia of resumenDias) {
    for (const res of dia.resultados || []) {
      const key = `${dia.fecha}__${res.tecnico.id}`
      estado.set(key, {
        tecnicoId: res.tecnico.id,
        tecnicoNombre: res.tecnico.nombre,
        cargaMin: Number(res.trabajoTotalMin || 0) + Number(res.trasladoTotalMin || 0),
        horaFinalTrabajo: Number(res.horaFinalTrabajo || 6 * 60),
        zonas: (res.zonasVisitadas || []).length > 0 ? res.zonasVisitadas : ['elche'],
        fijas: (res.ruta || []).filter((p: AnyRecord) => p.horaFija).length,
      })
    }
  }
  return estado
}

function generarOpcionesFlexiblesPeriodo(
  otsPeriodo: AnyRecord[],
  resumenDias: AnyRecord[],
  diasPeriodo: string[],
  tecnicos: AnyRecord[],
  resolveClient: ClientResolver
) {
  const estadoTecnicos = construirEstadoTecnicosPeriodo(resumenDias)
  const flexibles = otsPeriodo
    .filter((o) => !o.hora_fija && obtenerTecnicosOt(o).length > 0)
    .sort((a, b) => prioridadPeso(b.prioridad || '2') - prioridadPeso(a.prioridad || '2'))

  const opciones: AnyRecord[] = []

  for (const ot of flexibles) {
    const techIds = obtenerTecnicosOt(ot)
    if (!techIds.length) continue
    const clienteOt = resolveClient(ot)
    const zonaOt = detectarZona(clienteOt?.direccion || '')
    const fechaOriginal = ot.fecha_programada ? fechaKeyLocal(new Date(ot.fecha_programada)) : diasPeriodo[0]
    const duracion = duracionOtMin(ot)
    const candidatas: AnyRecord[] = []

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
        const extraMin = Math.max(0, cargaProyectada - 9 * 60)
        const movePenalty = dia === fechaOriginal ? 0 : 8
        const fixedPenalty = st.fijas > 0 ? 6 : 0
        const score = trasladoEstimado * 1.25 + extraMin * 2.3 + movePenalty + fixedPenalty + st.cargaMin * 0.08

        const inicioEstimado = Math.max(
          6 * 60,
          Math.min(14 * 60, Math.round((Math.max(st.horaFinalTrabajo, 6 * 60) + trasladoEstimado) / 30) * 30)
        )
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

export function calcularResultadoOptimizador(params: {
  periodoRuta: UiPeriodoRuta
  fechaRuta: string
  ordenes: AnyRecord[]
  tecnicos: AnyRecord[]
  resolveClient: ClientResolver
}) {
  const { periodoRuta, fechaRuta, ordenes, tecnicos, resolveClient } = params
  const rango = obtenerRangoOptimizacion(periodoRuta, fechaRuta)
  const otsPeriodo = ordenes.filter((o) => {
    if (!o.fecha_programada) return false
    const f = new Date(o.fecha_programada)
    if (Number.isNaN(f.getTime())) return false
    return (o.estado === 'pendiente' || o.estado === 'en_curso') && f >= rango.inicio && f <= rango.fin
  })

  if (otsPeriodo.length === 0) {
    return { vacio: true, periodo: periodoRuta, etiquetaPeriodo: rango.etiqueta }
  }

  if (periodoRuta === 'dia') {
    const resumenDia = resumenDiaOptimizacion(fechaRuta, otsPeriodo, tecnicos, resolveClient)
    if (!resumenDia) {
      return { vacio: true, periodo: 'dia' as const, etiquetaPeriodo: rango.etiqueta }
    }
    return {
      periodo: 'dia' as const,
      etiquetaPeriodo: rango.etiqueta,
      ...resumenDia,
    }
  }

  const resumenDias = rango.dias
    .map((dia) => {
      const otsDia = otsPeriodo.filter((o) => {
        if (!o.fecha_programada) return false
        return fechaKeyLocal(new Date(o.fecha_programada)) === dia
      })
      return resumenDiaOptimizacion(dia, otsDia, tecnicos, resolveClient)
    })
    .filter(Boolean) as AnyRecord[]

  if (resumenDias.length === 0) {
    return { vacio: true, periodo: periodoRuta, etiquetaPeriodo: rango.etiqueta }
  }

  const totalOTs = resumenDias.reduce((acc: number, d: AnyRecord) => acc + Number(d.totalOTs || 0), 0)
  const totalTraslado = resumenDias.reduce((acc: number, d: AnyRecord) => acc + Number(d.totalTraslado || 0), 0)
  const totalAhorro = resumenDias.reduce((acc: number, d: AnyRecord) => acc + Number(d.totalAhorro || 0), 0)
  const totalExtra = resumenDias.reduce((acc: number, d: AnyRecord) => acc + Number(d.totalExtra || 0), 0)
  const opcionesFlexibles = generarOpcionesFlexiblesPeriodo(otsPeriodo, resumenDias, rango.dias, tecnicos, resolveClient)

  return {
    periodo: periodoRuta,
    etiquetaPeriodo: rango.etiqueta,
    resumenDias,
    opcionesFlexibles,
    totalOTs,
    totalTraslado,
    totalAhorro,
    totalExtra,
  }
}

export function obtenerOpcionesNegociables(parada: AnyRecord) {
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
