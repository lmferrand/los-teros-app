'use client'

import { useTheme } from '@/lib/useTheme'
import Image from 'next/image'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

function diasRestantes(fecha: string | null | undefined) {
  if (!fecha) return null
  const limite = new Date(`${fecha}T12:00:00`)
  if (Number.isNaN(limite.getTime())) return null
  return Math.floor((limite.getTime() - Date.now()) / 86400000)
}

const UMBRAL_DIAS_RECORDATORIO = 365
const DASHBOARD_CACHE_KEY = 'dashboard_cache_v1'

function normalizarTextoPlano(valor: string) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function esVisitaTecnica(valor: string) {
  const norm = normalizarTextoPlano(valor)
  if (!norm) return false
  if (norm.includes('visita tecnica')) return true
  const compacto = norm.replace(/\s+/g, '')
  if (compacto.includes('visitatecnica')) return true
  return /\bvisita(s)?\b.*\btecnic[ao]s?\b|\btecnic[ao]s?\b.*\bvisita(s)?\b/.test(norm)
}

function esVisitaTecnicaOt(ot: any) {
  const tipo = String(ot?.tipo || '')
  const descripcion = String(ot?.descripcion || '')
  const observaciones = String(ot?.observaciones || '')
  return esVisitaTecnica(`${tipo} ${descripcion} ${observaciones}`)
}

function clienteOt(ot: any) {
  if (Array.isArray(ot?.clientes)) return ot.clientes[0] || null
  return ot?.clientes || null
}

function nombreClienteOt(ot: any) {
  const c = clienteOt(ot)
  return String(c?.nombre_comercial || c?.nombre || '').trim() || 'Sin cliente'
}

function poblacionClienteOt(ot: any) {
  const c = clienteOt(ot)
  return String(c?.poblacion || '').trim() || 'Sin localidad'
}

function etiquetaTareaOt(ot: any) {
  const tipo = String(ot?.tipo || '').trim()
  return tipo ? `${tipo.charAt(0).toUpperCase()}${tipo.slice(1)}` : 'Sin tipo'
}

function fechaHoraOt(ot: any) {
  if (!ot?.fecha_programada) return 'Sin fecha programada'
  const d = new Date(ot.fecha_programada)
  if (Number.isNaN(d.getTime())) return 'Sin fecha programada'
  return d.toLocaleString('es-ES', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

async function traerTodoPaginado<T>(fetchPage: (from: number, to: number) => any, pageSize = 1000) {
  const out: T[] = []
  for (let from = 0; ; from += pageSize) {
    const to = from + pageSize - 1
    const res = await fetchPage(from, to)
    const data = (res?.data || null) as T[] | null
    const error = res?.error || null
    if (error) throw error
    const bloque = data || []
    out.push(...bloque)
    if (bloque.length < pageSize) break
  }
  return out
}

type PrlRecordatorio = {
  titulo: string
  foco: string
  frase: string
}

type ReconocimientoSemana = {
  id: string
  insignia: string
  titulo: string
  detalle: string
}

function fechaOtTrabajo(ot: any) {
  const base = ot?.fecha_cierre || ot?.fecha_programada || ot?.created_at
  if (!base) return null
  const d = new Date(base)
  return Number.isNaN(d.getTime()) ? null : d
}

function inicioSemana(fecha: Date) {
  const d = new Date(fecha)
  const dia = d.getDay()
  const ajuste = dia === 0 ? -6 : 1 - dia
  d.setDate(d.getDate() + ajuste)
  d.setHours(0, 0, 0, 0)
  return d
}

function finSemana(fecha: Date) {
  const inicio = inicioSemana(fecha)
  const fin = new Date(inicio)
  fin.setDate(fin.getDate() + 7)
  return fin
}

function crearRecordatorioPrl(ordenes: any[]): PrlRecordatorio {
  const hoy = new Date()
  const hoyKey = hoy.toISOString().slice(0, 10)

  const activasHoy = ordenes.filter((ot) => {
    if (ot.estado !== 'pendiente' && ot.estado !== 'en_curso' && ot.estado !== 'completada') return false
    const f = fechaOtTrabajo(ot)
    if (!f) return false
    return f.toISOString().slice(0, 10) === hoyKey
  })

  const base = activasHoy.length > 0
    ? activasHoy
    : ordenes.filter((ot) => ot.estado === 'pendiente' || ot.estado === 'en_curso')

  const conteoTipo = new Map<string, number>()
  for (const ot of base) {
    const tipo = String(ot?.tipo || 'general').toLowerCase()
    conteoTipo.set(tipo, (conteoTipo.get(tipo) || 0) + 1)
  }

  const tipoPrincipal = Array.from(conteoTipo.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || 'general'
  const seed = Number(hoyKey.replaceAll('-', ''))

  const catalogo: Record<string, { foco: string; frases: string[] }> = {
    limpieza: {
      foco: 'EPI y químicos',
      frases: [
        'Antes de iniciar, revisa guantes, gafas y mascarilla. Un EPI bien puesto evita incidentes.',
        'No mezcles productos sin validar ficha técnica. La prevención empieza en la preparación.',
        'Ventila la zona y señaliza suelo húmedo para evitar resbalones durante la limpieza.',
      ],
    },
    mantenimiento: {
      foco: 'Bloqueo y revisión',
      frases: [
        'Verifica desconexión y bloqueo antes de manipular equipos. Cero energía, cero riesgos.',
        'Haz pausa de 30 segundos antes de intervenir: herramienta correcta y zona despejada.',
        'Comunica cualquier anomalía antes de cerrar el servicio para evitar retrabajos inseguros.',
      ],
    },
    instalacion: {
      foco: 'Montaje seguro',
      frases: [
        'Ordena cableado y herramientas para reducir tropiezos. Espacio limpio, trabajo seguro.',
        'Comprueba puntos de anclaje y estabilidad antes de instalar componentes en altura.',
        'Coordina tareas en pareja en operaciones de carga para proteger espalda y articulaciones.',
      ],
    },
    sustitucion: {
      foco: 'Retirada y reposición',
      frases: [
        'En sustituciones, identifica bien entrada y salida para evitar errores de conexión.',
        'Usa postura neutra al levantar cargas y pide apoyo cuando el peso lo requiera.',
        'Tras sustituir, deja la zona segura y señalizada antes de pasar al siguiente punto.',
      ],
    },
    general: {
      foco: 'Prevención diaria',
      frases: [
        'Dos minutos de chequeo al empezar reducen la mayoría de incidentes del día.',
        'Si una tarea parece insegura, para y replanifica: seguridad primero, siempre.',
        'Trabajo bien hecho es trabajo seguro: orden, comunicación y foco en cada paso.',
      ],
    },
  }

  const bloque = catalogo[tipoPrincipal] || catalogo.general
  const frase = bloque.frases[seed % bloque.frases.length]
  return {
    titulo: 'Recordatorio diario PRL',
    foco: bloque.foco,
    frase,
  }
}

function crearReconocimientosSemana(
  ordenes: any[],
  perfiles: Array<{ id: string; nombre: string | null }>,
  contactosOficinaSemana: number
): ReconocimientoSemana[] {
  const now = new Date()
  const ini = inicioSemana(now)
  const fin = finSemana(now)
  const hoyKey = now.toISOString().slice(0, 10)
  const nombrePorId = new Map(perfiles.map((p) => [String(p.id), String(p.nombre || 'Técnico')]))

  const completadasSemana = ordenes.filter((ot) => {
    if (ot?.estado !== 'completada') return false
    const f = fechaOtTrabajo(ot)
    if (!f) return false
    return f >= ini && f < fin
  })

  const completadasHoy = completadasSemana.filter((ot) => {
    const f = fechaOtTrabajo(ot)
    return f && f.toISOString().slice(0, 10) === hoyKey
  })

  const porTecnicoSemana = new Map<string, number>()
  const porTecnicoHoy = new Map<string, number>()
  const porPareja = new Map<string, number>()

  for (const ot of completadasSemana) {
    const ids = Array.isArray(ot?.tecnicos_ids) && ot.tecnicos_ids.length > 0
      ? ot.tecnicos_ids.map((x: any) => String(x))
      : ot?.tecnico_id
        ? [String(ot.tecnico_id)]
        : []

    for (const id of ids) {
      porTecnicoSemana.set(id, (porTecnicoSemana.get(id) || 0) + 1)
    }

    if (ids.length >= 2) {
      const pareja = [...ids].sort().slice(0, 2).join('|')
      porPareja.set(pareja, (porPareja.get(pareja) || 0) + 1)
    }

    const f = fechaOtTrabajo(ot)
    if (!f || f.toISOString().slice(0, 10) !== hoyKey) continue
    for (const id of ids) {
      porTecnicoHoy.set(id, (porTecnicoHoy.get(id) || 0) + 1)
    }
  }

  const reconocimientos: ReconocimientoSemana[] = []

  const topHoy = Array.from(porTecnicoHoy.entries()).sort((a, b) => b[1] - a[1])[0]
  if (topHoy) {
    const nombre = nombrePorId.get(topHoy[0]) || 'Técnico'
    reconocimientos.push({
      id: 'hoy-top',
      insignia: '\u{1F3C5}',
      titulo: 'Rendimiento del día',
      detalle: `Hoy ${nombre} ha completado ${topHoy[1]} trabajo(s) con éxito.`,
    })
  }

  const topSemana = Array.from(porTecnicoSemana.entries()).sort((a, b) => b[1] - a[1])[0]
  if (topSemana) {
    const nombre = nombrePorId.get(topSemana[0]) || 'Técnico'
    reconocimientos.push({
      id: 'semana-top',
      insignia: '\u{1F947}',
      titulo: 'Líder semanal',
      detalle: `${nombre} lidera la semana con ${topSemana[1]} OT completadas.`,
    })
  }

  const topPareja = Array.from(porPareja.entries()).sort((a, b) => b[1] - a[1])[0]
  if (topPareja) {
    const [idA, idB] = topPareja[0].split('|')
    const nomA = nombrePorId.get(idA) || 'Técnico A'
    const nomB = nombrePorId.get(idB) || 'Técnico B'
    reconocimientos.push({
      id: 'equipo-top',
      insignia: '\u{1F91D}',
      titulo: 'Trabajo en equipo',
      detalle: `${nomA} y ${nomB} han resuelto ${topPareja[1]} intervención(es) en conjunto.`,
    })
  }

  if (completadasHoy.length > 0) {
    reconocimientos.push({
      id: 'objetivo-dia',
      insignia: '\u{1F3AF}',
      titulo: 'Objetivo diario',
      detalle: `Hoy se completaron ${completadasHoy.length} OT y se avanzaron objetivos clave de la empresa.`,
    })
  }

  if (contactosOficinaSemana >= 10) {
    reconocimientos.push({
      id: 'oficina-contactos',
      insignia: '\u{1F4DE}',
      titulo: 'Oficina en acción',
      detalle: `Esta semana oficina ha contactado con ${contactosOficinaSemana} cliente(s). Excelente empuje comercial.`,
    })
  } else if (contactosOficinaSemana > 0) {
    reconocimientos.push({
      id: 'oficina-contactos-avance',
      insignia: '\u{1F4DE}',
      titulo: 'Seguimiento comercial',
      detalle: `Esta semana oficina ha contactado con ${contactosOficinaSemana} cliente(s). Buen ritmo de seguimiento.`,
    })
  }

  if (reconocimientos.length === 0) {
    reconocimientos.push({
      id: 'inicio-semana',
      insignia: '\u{1F31F}',
      titulo: 'Semana en marcha',
      detalle: 'Cada trabajo seguro y bien cerrado suma. Esta semana vais a por un gran resultado.',
    })
  }

  return reconocimientos.slice(0, 4)
}

export default function Dashboard() {
  const IMAGEN_RECORDATORIO_NUEVA = '/operario_recordatorios_jornada.webp'
  const IMAGEN_RECORDATORIO_FALLBACK = '/operario_teros_web_optimizado.png'
  const [user, setUser] = useState<any>(null)
  const [perfil, setPerfil] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    otActivas: 0, otMes: 0, stockBajo: 0,
    equiposCampo: 0, clientesTeros: 0, clientesOlipro: 0, otPendientes: 0,
    vehiculosTotal: 0, vehiculosAldia: 0, vehiculosPorVencer: 0, vehiculosVencidos: 0,
    otSintecnico: 0, otSinFecha: 0, otSinVehiculo: 0,
    clientesSinServicio: 0, maxDiasSinServicio: 0,
  })
  const [misordenes, setMisordenes] = useState<any[]>([])
  const [alertas, setAlertas] = useState<{ tipo: string; texto: string }[]>([])
  const [recordatorioPrl, setRecordatorioPrl] = useState<PrlRecordatorio>({
    titulo: 'Recordatorio diario PRL',
    foco: 'Prevención diaria',
    frase: 'Trabajo seguro, equipo seguro. Revisad EPI y entorno antes de empezar.',
  })
  const [imagenRecordatorioSrc, setImagenRecordatorioSrc] = useState(IMAGEN_RECORDATORIO_NUEVA)
  const [reconocimientosSemana, setReconocimientosSemana] = useState<ReconocimientoSemana[]>([])
  const ultimaCargaRef = useRef(0)
  const cargandoRef = useRef(false)
  const router = useRouter()
  const { tema, toggleTema } = useTheme()

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const raw = localStorage.getItem(DASHBOARD_CACHE_KEY)
      if (!raw) return
      const cache = JSON.parse(raw)
      const ts = Number(cache?.ts || 0)
      if (!ts || Date.now() - ts > 12 * 60 * 60 * 1000) return
      if (cache?.stats) setStats(cache.stats)
      if (Array.isArray(cache?.misordenes)) setMisordenes(cache.misordenes)
      if (Array.isArray(cache?.alertas)) setAlertas(cache.alertas)
      if (cache?.recordatorioPrl) setRecordatorioPrl(cache.recordatorioPrl)
      if (Array.isArray(cache?.reconocimientosSemana)) setReconocimientosSemana(cache.reconocimientosSemana)
      setLoading(false)
    } catch {
      // Cache inválida: ignorar.
    }
  }, [])

  const cargarDatos = useCallback(async (opts?: { force?: boolean }) => {
    const now = Date.now()
    const force = Boolean(opts?.force)
    if (!force && now - ultimaCargaRef.current < 25_000) return
    if (cargandoRef.current) return
    cargandoRef.current = true
    try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }
    setUser(session.user)

    let { data: perfilData } = await supabase.from('perfiles').select('*').eq('id', session.user.id).single()
    if (!perfilData) {
      const { data: nuevoPerfil } = await supabase.from('perfiles').insert({
        id: session.user.id,
        nombre: session.user.email?.split('@')[0] || 'Usuario',
        rol: 'tecnico',
      }).select().single()
      perfilData = nuevoPerfil
    }
    setPerfil(perfilData)
    const rolPerfil = String(perfilData?.rol || '').toLowerCase()
    const esTecnicoPerfil = rolPerfil === 'tecnico' || rolPerfil === 'almacen'

    const hoy = new Date()
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
    const finMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 1)
    const inicioSemanaActual = inicioSemana(hoy)
    const finSemanaActual = finSemana(hoy)

    const filtroAsignado = `tecnico_id.eq.${session.user.id},tecnicos_ids.cs.{"${session.user.id}"}`

    const qPendientes = supabase
      .from('ordenes')
      .select('id, codigo, tipo, cliente_id, tecnico_id, tecnicos_ids, fecha_programada, created_at, estado, prioridad, descripcion, observaciones, vehiculo_id, clientes(id, nombre, nombre_comercial, poblacion)')
      .in('estado', ['pendiente', 'en_curso'])
      .order('fecha_programada', { ascending: true, nullsFirst: false })

    const qCompletadasSemana = supabase
      .from('ordenes')
      .select('id, cliente_id, tipo, descripcion, observaciones, tecnico_id, tecnicos_ids, fecha_cierre, fecha_programada, created_at, estado')
      .eq('estado', 'completada')
      .gte('fecha_cierre', inicioSemanaActual.toISOString())
      .lt('fecha_cierre', finSemanaActual.toISOString())

    const qOtMesCount = supabase
      .from('ordenes')
      .select('id', { count: 'exact', head: true })
      .eq('estado', 'completada')
      .gte('fecha_cierre', inicioMes.toISOString())
      .lt('fecha_cierre', finMes.toISOString())

    const qOtPendientesCount = supabase
      .from('ordenes')
      .select('id', { count: 'exact', head: true })
      .eq('estado', 'pendiente')

    const qContactosOficinaSemana = (supabase.from('clientes') as any)
      .select('id', { count: 'exact', head: true })
      .eq('seguimiento_llamada_ok', true)
      .gte('seguimiento_llamada_at', inicioSemanaActual.toISOString())
      .lt('seguimiento_llamada_at', finSemanaActual.toISOString())

    if (esTecnicoPerfil) {
      qPendientes.or(filtroAsignado)
      qCompletadasSemana.or(filtroAsignado)
      qOtMesCount.or(filtroAsignado)
      qOtPendientesCount.or(filtroAsignado)
    }

    const [materiales, equipos, vehiculosFlota, perfilesEquipo, ordenesPendientesRes, ordenesCompletadasSemanaRes, otMesCountRes, otPendientesCountRes, contactosOficinaSemanaRes] = await Promise.all([
      supabase.from('materiales').select('id, nombre, stock, minimo, unidad'),
      supabase.from('equipos').select('id, codigo, estado, fecha_salida'),
      supabase.from('vehiculos_flota').select('id, matricula, proxima_itv, vencimiento_itc, vencimiento_seguro, vencimiento_impuesto, activo').eq('activo', true),
      supabase.from('perfiles').select('id, nombre'),
      qPendientes,
      qCompletadasSemana,
      qOtMesCount,
      qOtPendientesCount,
      qContactosOficinaSemana,
    ])
    const ordenesPendientes = ordenesPendientesRes.data || []
    const ordenesCompletadasSemana = ordenesCompletadasSemanaRes.data || []
    const ordenesContexto = [...ordenesPendientes, ...ordenesCompletadasSemana]
    const contactosOficinaSemana = Number(contactosOficinaSemanaRes?.count || 0)

    const { count: countTeros } = await (supabase.from('clientes') as any).select('*', { count: 'exact', head: true }).eq('empresa', 'teros')
    const { count: countOlipro } = await (supabase.from('clientes') as any).select('*', { count: 'exact', head: true }).eq('empresa', 'olipro')

    const todosMateriales = materiales.data || []
    const todosEquipos = equipos.data || []
    const todosvehiculos = vehiculosFlota.data || []
    const otActivasDashboard = ordenesPendientes
    const otMesDashboardCount = Number(otMesCountRes.count || 0)
    const stockBajo = todosMateriales.filter(m => (m.stock || 0) < (m.minimo || 0))
    const equiposCampo = todosEquipos.filter(e => e.estado === 'en_cliente')
    const otSintecnico = esTecnicoPerfil ? 0 : ordenesPendientes.filter(
      (o) =>
        (!Array.isArray(o.tecnicos_ids) || o.tecnicos_ids.length === 0) &&
        !o.tecnico_id
    ).length
    const otSinFecha = esTecnicoPerfil ? 0 : ordenesPendientes.filter((o) => !o.fecha_programada).length
    const otSinVehiculo = esTecnicoPerfil ? 0 : ordenesPendientes.filter((o) => !o.vehiculo_id).length

    let vehiculosAldia = 0
    let vehiculosPorVencer = 0
    let vehiculosVencidos = 0
    for (const v of todosvehiculos) {
      const revisiones = [
        { campo: 'ITV', fecha: v.proxima_itv },
        { campo: 'ITC', fecha: v.vencimiento_itc },
        { campo: 'Seguro', fecha: v.vencimiento_seguro },
        { campo: 'Impuesto', fecha: v.vencimiento_impuesto },
      ]
      const diasValidos = revisiones
        .map((r) => ({ ...r, dias: diasRestantes(r.fecha) }))
        .filter((r) => r.dias !== null) as Array<{ campo: string; fecha: string; dias: number }>
      if (diasValidos.length === 0) {
        continue
      }
      const peor = diasValidos.reduce((acc, item) => (item.dias < acc.dias ? item : acc), diasValidos[0])
      if (peor.dias < 0) vehiculosVencidos += 1
      else if (peor.dias <= 60) vehiculosPorVencer += 1
      else vehiculosAldia += 1
    }
    const misMisordenes = [...otActivasDashboard]
      .sort((a, b) => {
        const tsA = a?.fecha_programada ? new Date(a.fecha_programada).getTime() : Number.POSITIVE_INFINITY
        const tsB = b?.fecha_programada ? new Date(b.fecha_programada).getTime() : Number.POSITIVE_INFINITY
        if (tsA !== tsB) return tsA - tsB
        const creA = a?.created_at ? new Date(a.created_at).getTime() : Number.POSITIVE_INFINITY
        const creB = b?.created_at ? new Date(b.created_at).getTime() : Number.POSITIVE_INFINITY
        return creA - creB
      })
      .slice(0, 8)

    setStats((prev) => ({
      otActivas: otActivasDashboard.length, otMes: otMesDashboardCount,
      stockBajo: stockBajo.length, equiposCampo: equiposCampo.length,
      clientesTeros: countTeros || 0,
      clientesOlipro: countOlipro || 0,
      otPendientes: Number(otPendientesCountRes.count || 0),
      vehiculosTotal: todosvehiculos.length,
      vehiculosAldia,
      vehiculosPorVencer,
      vehiculosVencidos,
      otSintecnico,
      otSinFecha,
      otSinVehiculo,
      clientesSinServicio: prev.clientesSinServicio,
      maxDiasSinServicio: prev.maxDiasSinServicio,
    }))
    setMisordenes(misMisordenes)
    setRecordatorioPrl(crearRecordatorioPrl(ordenesContexto))
    setReconocimientosSemana(
      crearReconocimientosSemana(ordenesContexto, perfilesEquipo.data || [], contactosOficinaSemana)
    )

    const nuevasAlertas: { tipo: string; texto: string }[] = []
    stockBajo.forEach(m => nuevasAlertas.push({ tipo: 'warning', texto: `Stock bajo: ${m.nombre} (${m.stock || 0} ${m.unidad || ''})` }))
    equiposCampo.forEach(e => {
      if (e.fecha_salida) {
        const dias = Math.floor((Date.now() - new Date(e.fecha_salida).getTime()) / 86400000)
        if (dias > 14) nuevasAlertas.push({ tipo: 'danger', texto: `${e.codigo} lleva ${dias} días en cliente` })
      }
    })
    setAlertas(nuevasAlertas)
    setLoading(false)

    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(
          DASHBOARD_CACHE_KEY,
          JSON.stringify({
            ts: Date.now(),
            stats: {
              otActivas: otActivasDashboard.length,
              otMes: otMesDashboardCount,
              stockBajo: stockBajo.length,
              equiposCampo: equiposCampo.length,
              clientesTeros: countTeros || 0,
              clientesOlipro: countOlipro || 0,
              otPendientes: Number(otPendientesCountRes.count || 0),
              vehiculosTotal: todosvehiculos.length,
              vehiculosAldia,
              vehiculosPorVencer,
              vehiculosVencidos,
              otSintecnico,
              otSinFecha,
              otSinVehiculo,
              clientesSinServicio: 0,
              maxDiasSinServicio: 0,
            },
            misordenes: misMisordenes,
            alertas: nuevasAlertas,
            recordatorioPrl: crearRecordatorioPrl(ordenesContexto),
            reconocimientosSemana: crearReconocimientosSemana(
              ordenesContexto,
              perfilesEquipo.data || [],
              contactosOficinaSemana
            ),
          })
        )
      } catch {
        // Sin persistencia disponible.
      }
    }

    // Segunda fase (no bloqueante): historial global de servicios para recordatorios.
    void (async () => {
      const [serviciosData, ordenesCompletadasHistorial] = await Promise.all([
        traerTodoPaginado<any>((from, to) =>
          supabase
            .from('servicios_clientes')
            .select('cliente_id, fecha_servicio, descripcion')
            .not('cliente_id', 'is', null)
            .range(from, to)
        ).catch(() => []),
        traerTodoPaginado<any>((from, to) =>
          supabase
            .from('ordenes')
            .select('cliente_id, tipo, descripcion, observaciones, fecha_cierre, fecha_programada, created_at')
            .eq('estado', 'completada')
            .not('cliente_id', 'is', null)
            .range(from, to)
        ).catch(() => []),
      ])

      const actividadPorCliente = new Map<string, Date>()
      for (const ot of ordenesCompletadasHistorial || []) {
        if (!ot?.cliente_id) continue
        if (esVisitaTecnicaOt(ot)) continue
        const fechaRef = ot.fecha_cierre || ot.fecha_programada || ot.created_at
        if (!fechaRef) continue
        const fecha = new Date(fechaRef)
        if (Number.isNaN(fecha.getTime())) continue
        const previa = actividadPorCliente.get(ot.cliente_id)
        if (!previa || fecha.getTime() > previa.getTime()) {
          actividadPorCliente.set(ot.cliente_id, fecha)
        }
      }
      for (const srv of serviciosData || []) {
        if (!srv?.cliente_id || !srv?.fecha_servicio) continue
        if (esVisitaTecnica(String(srv?.descripcion || ''))) continue
        const fecha = new Date(`${srv.fecha_servicio}T12:00:00`)
        if (Number.isNaN(fecha.getTime())) continue
        const previa = actividadPorCliente.get(srv.cliente_id)
        if (!previa || fecha.getTime() > previa.getTime()) {
          actividadPorCliente.set(srv.cliente_id, fecha)
        }
      }

      let maxDiasSinServicio = 0
      let clientesMasDeUnAnoSinServicio = 0
      for (const fecha of actividadPorCliente.values()) {
        const dias = Math.floor((Date.now() - fecha.getTime()) / 86400000)
        if (dias > maxDiasSinServicio) maxDiasSinServicio = dias
        if (dias > UMBRAL_DIAS_RECORDATORIO) clientesMasDeUnAnoSinServicio += 1
      }

      setStats((prev) => ({
        ...prev,
        clientesSinServicio: clientesMasDeUnAnoSinServicio,
        maxDiasSinServicio,
      }))
      if (typeof window !== 'undefined') {
        try {
          const raw = localStorage.getItem(DASHBOARD_CACHE_KEY)
          const cache = raw ? JSON.parse(raw) : {}
          localStorage.setItem(
            DASHBOARD_CACHE_KEY,
            JSON.stringify({
              ...cache,
              ts: Date.now(),
              stats: {
                ...(cache?.stats || {}),
                clientesSinServicio: clientesMasDeUnAnoSinServicio,
                maxDiasSinServicio,
              },
            })
          )
        } catch {
          // Sin persistencia disponible.
        }
      }
    })()
    } finally {
      ultimaCargaRef.current = Date.now()
      cargandoRef.current = false
    }
  }, [router])

  useEffect(() => { void cargarDatos({ force: true }) }, [cargarDatos])
  useEffect(() => {
    if (typeof window === 'undefined') return
    const rutas = [
      '/ordenes',
      '/planificacion',
      '/inventario',
      '/clientes',
      '/movimientos',
      '/flota',
      '/sin-servicio',
      '/trabajadores',
    ]
    const prefetchRutas = () => {
      for (const ruta of rutas) {
        router.prefetch(ruta)
      }
    }

    const timeout = globalThis.setTimeout(prefetchRutas, 1200)
    return () => globalThis.clearTimeout(timeout)
  }, [router])
  useEffect(() => {
    if (typeof window === 'undefined') return

    let timeoutMedianoche: number | null = null
    let intervaloRefresco: number | null = null

    const programarSiguienteRefrescodiario = () => {
      const ahora = new Date()
      const siguienteMedianoche = new Date(ahora)
      // 00:00:05 para evitar borde exacto de cambio de día.
      siguienteMedianoche.setHours(24, 0, 5, 0)
      const ms = Math.max(1000, siguienteMedianoche.getTime() - ahora.getTime())

      timeoutMedianoche = window.setTimeout(() => {
        void cargarDatos({ force: true })
        programarSiguienteRefrescodiario()
      }, ms)
    }

    const refrescarSiVisible = () => {
      if (document.visibilityState === 'visible') {
        void cargarDatos()
      }
    }

    // Garantiza cambio diario automático.
    programarSiguienteRefrescodiario()
    // Mantiene el dashboard al día con cambios de OT en jornada.
    intervaloRefresco = window.setInterval(refrescarSiVisible, 15 * 60 * 1000)
    document.addEventListener('visibilitychange', refrescarSiVisible)

    return () => {
      if (timeoutMedianoche !== null) window.clearTimeout(timeoutMedianoche)
      if (intervaloRefresco !== null) window.clearInterval(intervaloRefresco)
      document.removeEventListener('visibilitychange', refrescarSiVisible)
    }
  }, [cargarDatos])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const ROLES: any = {
    gerente: 'Gerente', oficina: 'Oficina', tecnico: 'Técnico',
    almacen: 'Almacén', supervisor: 'Supervisor',
  }

  const esTecnico = perfil?.rol === 'tecnico' || perfil?.rol === 'almacen'

  const MODULOS: Array<{ href: string; icono?: string; iconoImg?: string; titulo: string; desc: string; siempre?: boolean; soloAdmin?: boolean }> = [
    { href: '/ordenes', icono: '\u{1F4CB}', titulo: 'Órdenes', desc: 'Crear y gestionar', siempre: true },
    { href: '/planificacion', icono: '\u{1F4C6}', titulo: 'Planificación', desc: 'Calendario y rutas', siempre: true },
    { href: '/inventario', icono: '\u{1F4E6}', titulo: 'Inventario y equipos', desc: 'Materiales y equipos', siempre: true },
    { href: '/flota', icono: '\u{1F69A}', titulo: 'Flota de vehículos', desc: 'ITV, seguros y documentos', siempre: true },
    { href: '/albaranes', icono: '\u{1F9FE}', titulo: 'Albaranes', desc: 'Con fotos y firma', siempre: true },
    { href: '/asistente', iconoImg: '/assistant-ia-teros-clean.png', titulo: 'Asistente IA', desc: 'Pregunta a la IA', siempre: true },
    { href: '/movimientos', icono: '\u{1F4CA}', titulo: 'Movimientos', desc: 'Historial consumos', siempre: true },
    { href: '/sin-servicio', icono: '\u{23F1}', titulo: 'Recordatorio de servicio', desc: 'Clientes a recontactar', siempre: true },
    { href: '/clientes', icono: '\u{1F3E2}', titulo: 'Clientes', desc: 'Fichas y contacto', soloAdmin: true },
    { href: '/trabajadores', icono: '\u{1F477}', titulo: 'Trabajadores', desc: 'Gestión personal', soloAdmin: true },
  ]

  const bgCard = tema === 'dark' ? '#0d1117' : '#ffffff'
  const bgMain = tema === 'dark' ? '#080b14' : '#f8fafc'
  const border = tema === 'dark' ? '#1e2d3d' : '#e2e8f0'
  const textColor = tema === 'dark' ? 'white' : '#0f172a'
  const textMuted = tema === 'dark' ? '#475569' : '#64748b'
  const hoverTeros = tema === 'dark' ? '#22d3ee' : '#0891b2'
  const sombraHover = tema === 'dark'
    ? '0 10px 24px rgba(34,211,238,0.24), 0 0 0 1px rgba(34,211,238,0.20)'
    : '0 10px 20px rgba(8,145,178,0.18), 0 0 0 1px rgba(8,145,178,0.14)'

  function activarHoverCard(el: HTMLElement) {
    el.style.borderColor = hoverTeros
    el.style.boxShadow = sombraHover
    el.style.transform = 'translateY(-2px)'
  }

  function desactivarHoverCard(el: HTMLElement) {
    el.style.borderColor = el.dataset.baseBorder || border
    el.style.boxShadow = 'none'
    el.style.transform = 'translateY(0)'
  }

  type EstadoSemaforo = 'ok' | 'warning' | 'critical'
  type ResumenCard = {
    label: string
    valor: number
    sub: string
    href: string
    estado: EstadoSemaforo
    mostrarInsignia?: boolean
  }

  function estilosSemaforo(estado: EstadoSemaforo) {
    if (estado === 'critical') {
      return {
        color: '#ef4444',
        borderColor: tema === 'dark' ? 'rgba(239,68,68,0.55)' : 'rgba(239,68,68,0.45)',
        badgeBg: tema === 'dark' ? 'rgba(239,68,68,0.14)' : 'rgba(239,68,68,0.09)',
      }
    }
    if (estado === 'warning') {
      return {
        color: '#f59e0b',
        borderColor: tema === 'dark' ? 'rgba(245,158,11,0.55)' : 'rgba(245,158,11,0.45)',
        badgeBg: tema === 'dark' ? 'rgba(245,158,11,0.15)' : 'rgba(245,158,11,0.10)',
      }
    }
    return {
      color: '#06b6d4',
      borderColor: tema === 'dark' ? 'rgba(6,182,212,0.45)' : 'rgba(6,182,212,0.32)',
      badgeBg: tema === 'dark' ? 'rgba(6,182,212,0.12)' : 'rgba(6,182,212,0.08)',
    }
  }

  function insigniaEstado(estado: EstadoSemaforo) {
    if (estado === 'critical') {
      return {
        icono: '\u{1F6A8}',
        texto: 'REVISAR',
        color: '#ef4444',
        fondo: tema === 'dark' ? 'rgba(239,68,68,0.14)' : 'rgba(239,68,68,0.1)',
        borde: tema === 'dark' ? 'rgba(239,68,68,0.35)' : 'rgba(239,68,68,0.25)',
      }
    }
    if (estado === 'warning') {
      return {
        icono: '\u{26A0}',
        texto: 'BIEN',
        color: '#f59e0b',
        fondo: tema === 'dark' ? 'rgba(245,158,11,0.14)' : 'rgba(245,158,11,0.1)',
        borde: tema === 'dark' ? 'rgba(245,158,11,0.35)' : 'rgba(245,158,11,0.25)',
      }
    }
    return {
      icono: '\u{1F3C5}',
      texto: 'BRAVO',
      color: '#06b6d4',
      fondo: tema === 'dark' ? 'rgba(6,182,212,0.14)' : 'rgba(6,182,212,0.1)',
      borde: tema === 'dark' ? 'rgba(6,182,212,0.32)' : 'rgba(6,182,212,0.25)',
    }
  }

  function logoInsigniaEstado(estado: EstadoSemaforo) {
    // Mantiene compatibilidad con la insignia semaforo existente.
    const legacy = insigniaEstado(estado)
    void legacy

    if (estado === 'critical') {
      return {
        src: '/badge-alerta.png',
        alt: 'Revisar',
        glow: 'rgba(239,68,68,0.42)',
      }
    }
    if (estado === 'warning') {
      return {
        src: '/badge-bien.png',
        alt: 'Bien',
        glow: 'rgba(245,158,11,0.40)',
      }
    }
    return {
      src: '/badge-bravo.png',
      alt: 'Bravo',
      glow: 'rgba(6,182,212,0.40)',
    }
  }

  const totalClientes = (stats.clientesTeros || 0) + (stats.clientesOlipro || 0)
  const estadoStock: EstadoSemaforo = stats.stockBajo >= 10 ? 'critical' : stats.stockBajo > 0 ? 'warning' : 'ok'
  const estadoFlota: EstadoSemaforo = stats.vehiculosVencidos > 0 ? 'critical' : stats.vehiculosPorVencer > 0 ? 'warning' : 'ok'
  const estadoRecordatorio: EstadoSemaforo =
    stats.clientesSinServicio >= 20 ? 'critical'
      : stats.clientesSinServicio >= 10 ? 'warning'
        : 'ok'

  const resumenCardsBase: ResumenCard[] = [
    { label: 'OT Activas', valor: stats.otActivas, sub: `${stats.otPendientes} pendientes`, href: '/ordenes', estado: 'ok' },
    { label: 'Completadas mes', valor: stats.otMes, sub: 'este mes', href: '/ordenes?estado=completada', estado: 'ok' },
    { label: 'Clientes', valor: totalClientes, sub: `Teros ${stats.clientesTeros} - Olipro ${stats.clientesOlipro}`, href: '/clientes', estado: 'ok' },
    { label: 'Stock bajo', valor: stats.stockBajo, sub: 'materiales críticos', href: '/inventario?tab=materiales', estado: estadoStock, mostrarInsignia: true },
    { label: 'Equipos en campo', valor: stats.equiposCampo, sub: 'en cliente', href: '/inventario?tab=equipos', estado: stats.equiposCampo > 0 ? 'warning' : 'ok' },
    {
      label: 'Flota al día',
      valor: stats.vehiculosAldia,
      sub: `${stats.vehiculosTotal} total - ${stats.vehiculosPorVencer} por vencer - ${stats.vehiculosVencidos} vencidos`,
      href: '/flota',
      estado: estadoFlota,
      mostrarInsignia: true,
    },
    {
      label: 'Recordatorio servicio',
      valor: stats.clientesSinServicio,
      sub: `>1 año sin servicio - máx. ${stats.maxDiasSinServicio} días`,
      href: '/sin-servicio',
      estado: estadoRecordatorio,
      mostrarInsignia: true,
    },
  ]
  const resumenCards = (esTecnico
    ? resumenCardsBase.filter((card) => card.label !== 'Clientes')
    : resumenCardsBase
  ).map((card) => {
    if (!esTecnico) return card
    if (card.label === 'OT Activas') return { ...card, href: '/ordenes?mias=1' }
    if (card.label === 'Completadas mes') return { ...card, href: '/ordenes?mias=1&estado=completada' }
    return card
  })

  const reconocimientosCarruselBase = reconocimientosSemana.length > 0
    ? reconocimientosSemana
    : [{
      id: 'inicio-semana-fallback',
      insignia: '\u{1F31F}',
      titulo: 'Semana en marcha',
      detalle: 'Cada trabajo seguro y bien cerrado suma. Esta semana vais a por un gran resultado.',
    }]
  const reconocimientosCarrusel = [...reconocimientosCarruselBase, ...reconocimientosCarruselBase]

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: bgMain }}>
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
        <p className="text-sm" style={{ color: textMuted }}>Cargando...</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen" style={{ background: bgMain }}>
      <div className="px-6 py-4 flex items-center justify-between flex-wrap gap-3" style={{ background: bgCard, borderBottom: `1px solid ${border}` }}>
        <div className="flex items-center gap-3">
          <div className="logo-tero-wrap">
            <Image
              src="/logo.png"
              alt="Los Teros S.L"
              width={96}
              height={96}
              className="logo-tero-spin w-24 h-24 object-contain"
              style={{
                mixBlendMode: tema === 'dark' ? 'screen' : 'normal',
                filter: tema === 'dark'
                  ? 'drop-shadow(0 8px 18px rgba(6,182,212,0.28))'
                  : 'drop-shadow(0 6px 12px rgba(15,23,42,0.18))',
              }}
            />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight" style={{ color: textColor }}>
              Los Teros S.L
              <span className="align-super text-[0.52em] ml-0.5">®</span>
            </h1>
            <p className="text-xs" style={{ color: '#06b6d4' }}>Gestión operativa</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-sm font-medium" style={{ color: textColor }}>{perfil?.nombre || user?.email}</p>
            <p className="text-xs" style={{ color: '#8b5cf6' }}>{ROLES[perfil?.rol] || perfil?.rol}</p>
          </div>
          <button onClick={toggleTema} className="text-sm px-3 py-1.5 rounded-lg transition-all"
            style={{ background: bgMain, color: textMuted, border: `1px solid ${border}` }}>
            {tema === 'dark' ? '\u{2600}\u{FE0F}' : '\u{1F319}'}
          </button>
          <button onClick={handleLogout} className="text-sm px-3 py-1.5 rounded-lg transition-colors"
            style={{ background: bgMain, color: textMuted, border: `1px solid ${border}` }}>
            Salir
          </button>
        </div>
      </div>

      <div className="p-6 max-w-6xl mx-auto">
        <div className="mb-4">
          <h2 className="font-semibold text-xl mb-1" style={{ color: textColor }}>
            Hola, {perfil?.nombre?.split(' ')[0] || 'bienvenido'} {'\u{1F44B}'}
          </h2>
          <p className="text-sm" style={{ color: textMuted }}>
            {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 mb-6">
          <div className="rounded-xl overflow-visible relative" style={{ background: 'rgba(6,182,212,0.10)', border: '1px solid rgba(6,182,212,0.25)' }}>
            <div className="absolute left-1 md:left-2 bottom-0 w-[118px] md:w-[170px] h-[118px] md:h-[156px] overflow-hidden pointer-events-none">
              <Image
                src={imagenRecordatorioSrc}
                alt="Recordatorio para tu jornada"
                fill
                sizes="(min-width: 768px) 170px, 118px"
                className="object-cover object-top"
                priority
                onError={() => {
                  if (imagenRecordatorioSrc !== IMAGEN_RECORDATORIO_FALLBACK) {
                    setImagenRecordatorioSrc(IMAGEN_RECORDATORIO_FALLBACK)
                  }
                }}
              />
            </div>
            <div className="pl-[120px] md:pl-[176px] pr-3 py-2.5 min-h-[94px] md:min-h-[108px] flex items-center">
              <div className="min-w-0">
                <div
                  className="mb-2 rounded-lg px-2 py-1.5 overflow-hidden"
                  style={{
                    background: tema === 'dark' ? 'rgba(6,182,212,0.17)' : 'rgba(6,182,212,0.12)',
                    border: '1px solid rgba(6,182,212,0.36)',
                    boxShadow: tema === 'dark'
                      ? 'inset 0 0 0 1px rgba(103,232,249,0.10), 0 8px 18px rgba(6,182,212,0.15)'
                      : 'inset 0 0 0 1px rgba(103,232,249,0.08), 0 8px 16px rgba(6,182,212,0.12)',
                  }}
                >
                  <div className="teros-recon-marquee" aria-live="polite">
                    {reconocimientosCarrusel.map((r, idx) => (
                      <div
                        key={`${r.id}-${idx}`}
                        className="teros-recon-item text-xs md:text-sm"
                        style={{
                          color: textColor,
                          background: tema === 'dark' ? 'rgba(8,47,73,0.24)' : 'rgba(255,255,255,0.52)',
                          border: '1px solid rgba(6,182,212,0.25)',
                        }}
                      >
                        <span className="mr-1" style={{ color: '#67e8f9' }}>{r.insignia}</span>
                        <span className="font-semibold" style={{ color: '#22d3ee' }}>{r.titulo}:</span>{' '}
                        <span>{r.detalle}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <p className="text-sm font-semibold mb-1.5" style={{ color: textColor }}>Foco de hoy: {recordatorioPrl.foco}</p>
                <p className="text-xs md:text-sm leading-relaxed" style={{ color: textMuted }}>{recordatorioPrl.frase}</p>
              </div>
            </div>
          </div>
        </div>

        {(esTecnico || misordenes.length > 0) && (
          <div className="rounded-xl p-5 mb-6" style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.3)' }}>
            <h3 className="font-semibold mb-3 text-sm" style={{ color: '#a78bfa' }}>
              {esTecnico ? 'MIS ÓRDENES ASIGNADAS' : 'MIS ÓRDENES PENDIENTES'}
            </h3>
            {misordenes.length === 0 ? (
              <p className="text-sm" style={{ color: textMuted }}>No tienes órdenes asignadas ahora mismo.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {misordenes.map(o => (
                  <Link
                    key={o.id}
                    href={esTecnico ? `/ordenes?mias=1&open=${o.id}` : `/ordenes?open=${o.id}`}
                    className="block rounded-lg px-4 py-3 transition-all"
                    data-base-border="rgba(167,139,250,0.16)"
                    style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(167,139,250,0.16)' }}
                    onMouseEnter={e => activarHoverCard(e.currentTarget)}
                    onMouseLeave={e => desactivarHoverCard(e.currentTarget)}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: textColor }}>
                        {nombreClienteOt(o)}
                      </p>
                      <p className="text-xs mt-0.5 truncate" style={{ color: textMuted }}>
                        {etiquetaTareaOt(o)}: {o.descripcion?.substring(0, 72) || 'Sin descripción'}
                      </p>
                      <p className="text-xs mt-0.5 truncate" style={{ color: textMuted }}>
                        {poblacionClienteOt(o)}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
            {esTecnico && (
              <Link href="/ordenes?mias=1" className="block mt-3 text-xs hover:opacity-80 transition-opacity" style={{ color: '#06b6d4' }}>
                Ver todas mis órdenes →
              </Link>
            )}
          </div>
        )}

        {alertas.length > 0 && (
          <div className="mb-6 flex flex-col gap-2">
            {alertas.map((a, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm" style={{
                background: a.tipo === 'danger' ? 'rgba(239,68,68,0.1)' : 'rgba(234,179,8,0.1)',
                border: `1px solid ${a.tipo === 'danger' ? 'rgba(239,68,68,0.3)' : 'rgba(234,179,8,0.3)'}`,
                color: a.tipo === 'danger' ? '#f87171' : '#fbbf24'
              }}>
                <span>{a.tipo === 'danger' ? '\u{1F6A8}' : '\u{26A0}\u{FE0F}'}</span>
                <span>{a.texto}</span>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
          {resumenCards.map((s, i) => {
            const semaforo = estilosSemaforo(s.estado)
            const insigniaLogo = logoInsigniaEstado(s.estado)
            return (
            <Link
              key={i}
              href={s.href}
              className="rounded-xl p-4 block transition-all relative overflow-visible"
              data-base-border={semaforo.borderColor}
              style={{ background: semaforo.badgeBg, border: `1px solid ${semaforo.borderColor}` }}
              onMouseEnter={e => activarHoverCard(e.currentTarget)}
              onMouseLeave={e => desactivarHoverCard(e.currentTarget)}
            >
              <p className="text-xs uppercase tracking-wider mb-2" style={{ color: textMuted }}>{s.label}</p>
              {s.mostrarInsignia && (
                <div
                  className="pointer-events-none absolute -top-3 -right-3 z-10"
                  style={{
                    animation: `insigniaFloat 3.4s ease-in-out ${i * 0.08}s infinite`,
                    filter: `drop-shadow(0 7px 16px rgba(0,0,0,0.32)) drop-shadow(0 0 14px ${insigniaLogo.glow})`,
                  }}
                  aria-hidden
                >
                  <div className="relative w-[56px] h-[56px]">
                    <Image
                      src={insigniaLogo.src}
                      alt={insigniaLogo.alt}
                      fill
                      sizes="56px"
                      className="object-contain"
                    />
                  </div>
                </div>
              )}
              <p className="text-3xl font-bold" style={{ color: semaforo.color }}>{s.valor}</p>
              <p className="text-xs mt-1" style={{ color: textMuted }}>{s.sub}</p>
            </Link>
          )})}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {MODULOS.filter(m => m.siempre || (!esTecnico && m.soloAdmin)).map(m => {
            const hrefModulo = esTecnico && m.href === '/ordenes' ? '/ordenes?mias=1' : m.href
            return (
            <Link key={m.href} href={hrefModulo} className="rounded-xl p-5 block transition-all"
              style={{ background: bgCard, border: `1px solid ${border}` }}
              onMouseEnter={e => activarHoverCard(e.currentTarget)}
              onMouseLeave={e => desactivarHoverCard(e.currentTarget)}>
              {m.iconoImg ? (
                <Image src={m.iconoImg} alt={m.titulo} width={40} height={40} className="w-10 h-10 mb-3 object-contain" />
              ) : (
                <div className="text-2xl mb-3">{m.icono}</div>
              )}
              <h2 className="font-semibold text-sm" style={{ color: textColor }}>{m.titulo}</h2>
              <p className="text-xs mt-1" style={{ color: textMuted }}>{m.desc}</p>
            </Link>
          )})}
        </div>
        <style jsx global>{`
          @keyframes insigniaFloat {
            0% { transform: translateY(0px) rotate(-2deg) scale(1); }
            50% { transform: translateY(-4px) rotate(2deg) scale(1.01); }
            100% { transform: translateY(0px) rotate(-2deg) scale(1); }
          }
          @keyframes terosReconLoop {
            0% { transform: translateX(0); }
            100% { transform: translateX(-50%); }
          }
          @keyframes insigniaSparkle {
            0% {
              opacity: 0;
              transform: translate(-130%, 130%) rotate(-28deg);
            }
            12% { opacity: 0.9; }
            22% {
              opacity: 1;
              transform: translate(120%, -120%) rotate(-28deg);
            }
            32% { opacity: 0; }
            100% { opacity: 0; transform: translate(120%, -120%) rotate(-28deg); }
          }
          @keyframes logoTerosSpin3d {
            0%,
            95% { transform: rotateX(14deg) rotateY(0deg); }
            96.1% { transform: rotateX(15.2deg) rotateY(42deg); }
            97.1% { transform: rotateX(16deg) rotateY(175deg); }
            98.1% { transform: rotateX(15.4deg) rotateY(308deg); }
            99% { transform: rotateX(14.8deg) rotateY(348deg); }
            100% { transform: rotateX(14deg) rotateY(360deg); }
          }
          .logo-tero-wrap {
            perspective: 1000px;
            transform-style: preserve-3d;
          }
          .logo-tero-spin {
            transform-style: preserve-3d;
            backface-visibility: visible;
            animation: logoTerosSpin3d 60s linear infinite;
            will-change: transform;
          }
          @media (prefers-reduced-motion: reduce) {
            .logo-tero-spin {
              animation: none;
              transform: rotateX(10deg);
            }
          }
          .sparkle {
            position: absolute;
            left: -52%;
            top: -40%;
            width: 48%;
            height: 170%;
            background: linear-gradient(
              120deg,
              rgba(255,255,255,0) 0%,
              rgba(255,255,255,0.15) 34%,
              rgba(255,255,255,0.95) 50%,
              rgba(255,255,255,0.18) 66%,
              rgba(255,255,255,0) 100%
            );
            filter: blur(0.35px);
            animation: insigniaSparkle 3.2s ease-in-out infinite;
          }
          .teros-recon-marquee {
            display: inline-flex;
            gap: 0.6rem;
            width: max-content;
            white-space: nowrap;
            animation: terosReconLoop 28s linear infinite;
            will-change: transform;
          }
          .teros-recon-item {
            flex: 0 0 auto;
            display: inline-flex;
            align-items: center;
            border-radius: 9999px;
            padding: 0.3rem 0.72rem;
          }
        `}</style>
      </div>
    </div>
  )
}


