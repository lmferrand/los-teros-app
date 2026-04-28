'use client'

import { useTheme } from '@/lib/useTheme'
import Image from 'next/image'
import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

function diasRestantes(fecha: string | null | undefined) {
  if (!fecha) return null
  const limite = new Date(`${fecha}T12:00:00`)
  if (Number.isNaN(limite.getTime())) return null
  return Math.floor((limite.getTime() - Date.now()) / 86400000)
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
      foco: 'EPI y quimicos',
      frases: [
        'Antes de iniciar, revisa guantes, gafas y mascarilla. Un EPI bien puesto evita incidentes.',
        'No mezcles productos sin validar ficha tecnica. La prevencion empieza en la preparacion.',
        'Ventila la zona y senaliza suelo humedo para evitar resbalones durante la limpieza.',
      ],
    },
    mantenimiento: {
      foco: 'Bloqueo y revision',
      frases: [
        'Verifica desconexion y bloqueo antes de manipular equipos. Cero energia, cero riesgos.',
        'Haz pausa de 30 segundos antes de intervenir: herramienta correcta y zona despejada.',
        'Comunica cualquier anomalia antes de cerrar el servicio para evitar re-trabajos inseguros.',
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
      foco: 'Retirada y reposicion',
      frases: [
        'En sustituciones, identifica bien entrada y salida para evitar errores de conexion.',
        'Usa postura neutra al levantar cargas y pide apoyo cuando el peso lo requiera.',
        'Tras sustituir, deja la zona segura y señalizada antes de pasar al siguiente punto.',
      ],
    },
    general: {
      foco: 'Prevencion diaria',
      frases: [
        'Dos minutos de chequeo al empezar reducen la mayoria de incidentes del dia.',
        'Si una tarea parece insegura, para y replanifica: seguridad primero, siempre.',
        'Trabajo bien hecho es trabajo seguro: orden, comunicacion y foco en cada paso.',
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

function crearReconocimientosSemana(ordenes: any[], perfiles: Array<{ id: string; nombre: string | null }>): ReconocimientoSemana[] {
  const now = new Date()
  const ini = inicioSemana(now)
  const fin = finSemana(now)
  const hoyKey = now.toISOString().slice(0, 10)
  const nombrePorId = new Map(perfiles.map((p) => [String(p.id), String(p.nombre || 'Tecnico')]))

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
    const nombre = nombrePorId.get(topHoy[0]) || 'Tecnico'
    reconocimientos.push({
      id: 'hoy-top',
      insignia: '🏅',
      titulo: 'Rendimiento del dia',
      detalle: `Hoy ${nombre} ha completado ${topHoy[1]} trabajo(s) con exito.`,
    })
  }

  const topSemana = Array.from(porTecnicoSemana.entries()).sort((a, b) => b[1] - a[1])[0]
  if (topSemana) {
    const nombre = nombrePorId.get(topSemana[0]) || 'Tecnico'
    reconocimientos.push({
      id: 'semana-top',
      insignia: '🥇',
      titulo: 'Lider semanal',
      detalle: `${nombre} lidera la semana con ${topSemana[1]} OT completadas.`,
    })
  }

  const topPareja = Array.from(porPareja.entries()).sort((a, b) => b[1] - a[1])[0]
  if (topPareja) {
    const [idA, idB] = topPareja[0].split('|')
    const nomA = nombrePorId.get(idA) || 'Tecnico A'
    const nomB = nombrePorId.get(idB) || 'Tecnico B'
    reconocimientos.push({
      id: 'equipo-top',
      insignia: '🤝',
      titulo: 'Trabajo en equipo',
      detalle: `${nomA} y ${nomB} han resuelto ${topPareja[1]} intervencion(es) en conjunto.`,
    })
  }

  if (completadasHoy.length > 0) {
    reconocimientos.push({
      id: 'objetivo-dia',
      insignia: '🎯',
      titulo: 'Objetivo diario',
      detalle: `Hoy se completaron ${completadasHoy.length} OT y se avanzaron objetivos clave de la empresa.`,
    })
  }

  if (reconocimientos.length === 0) {
    reconocimientos.push({
      id: 'inicio-semana',
      insignia: '🌟',
      titulo: 'Semana en marcha',
      detalle: 'Cada trabajo seguro y bien cerrado suma. Esta semana vais a por un gran resultado.',
    })
  }

  return reconocimientos.slice(0, 4)
}

export default function Dashboard() {
  const [user, setUser] = useState<any>(null)
  const [perfil, setPerfil] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    otActivas: 0, otMes: 0, stockBajo: 0,
    equiposCampo: 0, clientesTeros: 0, clientesOlipro: 0, otPendientes: 0,
    vehiculosTotal: 0, vehiculosAlDia: 0, vehiculosPorVencer: 0, vehiculosVencidos: 0,
    otSinTecnico: 0, otSinFecha: 0, otSinVehiculo: 0,
    clientesSinServicio: 0, maxDiasSinServicio: 0,
  })
  const [misOrdenes, setMisOrdenes] = useState<any[]>([])
  const [alertas, setAlertas] = useState<{ tipo: string; texto: string }[]>([])
  const [recordatorioPrl, setRecordatorioPrl] = useState<PrlRecordatorio>({
    titulo: 'Recordatorio diario PRL',
    foco: 'Prevencion diaria',
    frase: 'Trabajo seguro, equipo seguro. Revisad EPI y entorno antes de empezar.',
  })
  const [reconocimientosSemana, setReconocimientosSemana] = useState<ReconocimientoSemana[]>([])
  const router = useRouter()
  const { tema, toggleTema } = useTheme()

  const cargarDatos = useCallback(async () => {
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

    const [materiales, equipos, vehiculosFlota, perfilesEquipo] = await Promise.all([
      supabase.from('materiales').select('*'),
      supabase.from('equipos').select('*'),
      supabase.from('vehiculos_flota').select('id, matricula, proxima_itv, vencimiento_itc, vencimiento_seguro, vencimiento_impuesto, activo').eq('activo', true),
      supabase.from('perfiles').select('id, nombre'),
    ])

    const [todasOrdenes, serviciosData, clientesIdsData] = await Promise.all([
      traerTodoPaginado<any>((from, to) =>
        supabase.from('ordenes').select('*').range(from, to)
      ),
      traerTodoPaginado<any>((from, to) =>
        supabase.from('servicios_clientes').select('cliente_id, fecha_servicio').not('cliente_id', 'is', null).range(from, to)
      ).catch(() => []),
      traerTodoPaginado<any>((from, to) =>
        supabase.from('clientes').select('id').range(from, to)
      ),
    ])

    const { count: countTeros } = await (supabase.from('clientes') as any).select('*', { count: 'exact', head: true }).eq('empresa', 'teros')
    const { count: countOlipro } = await (supabase.from('clientes') as any).select('*', { count: 'exact', head: true }).eq('empresa', 'olipro')

    const hoy = new Date()
    const mes = hoy.getMonth()
    const anio = hoy.getFullYear()
    const todosMateriales = materiales.data || []
    const todosEquipos = equipos.data || []
    const todosVehiculos = vehiculosFlota.data || []
    const otActivas = todasOrdenes.filter(o => o.estado === 'pendiente' || o.estado === 'en_curso')
    const otMes = todasOrdenes.filter(o => {
      if (!o.created_at || o.estado !== 'completada') return false
      const d = new Date(o.created_at)
      return d.getMonth() === mes && d.getFullYear() === anio
    })
    const stockBajo = todosMateriales.filter(m => (m.stock || 0) < (m.minimo || 0))
    const equiposCampo = todosEquipos.filter(e => e.estado === 'en_cliente')
    const otPendientesAsignacion = todasOrdenes.filter(
      (o) => o.estado === 'pendiente' || o.estado === 'en_curso'
    )
    const otSinTecnico = otPendientesAsignacion.filter(
      (o) =>
        (!Array.isArray(o.tecnicos_ids) || o.tecnicos_ids.length === 0) &&
        !o.tecnico_id
    ).length
    const otSinFecha = otPendientesAsignacion.filter((o) => !o.fecha_programada).length
    const otSinVehiculo = otPendientesAsignacion.filter((o) => !o.vehiculo_id).length

    const actividadPorCliente = new Map<string, Date>()
    for (const ot of todasOrdenes) {
      if (!ot?.cliente_id || ot?.estado !== 'completada') continue
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
      const fecha = new Date(`${srv.fecha_servicio}T12:00:00`)
      if (Number.isNaN(fecha.getTime())) continue
      const previa = actividadPorCliente.get(srv.cliente_id)
      if (!previa || fecha.getTime() > previa.getTime()) {
        actividadPorCliente.set(srv.cliente_id, fecha)
      }
    }
    const idsClientesValidos = new Set((clientesIdsData || []).map((c: any) => String(c.id)))
    const actividadValida = new Map<string, Date>()
    for (const [clienteId, fecha] of actividadPorCliente.entries()) {
      if (!idsClientesValidos.has(String(clienteId))) continue
      actividadValida.set(clienteId, fecha)
    }

    let maxDiasSinServicio = 0
    for (const fecha of actividadValida.values()) {
      const dias = Math.floor((Date.now() - fecha.getTime()) / 86400000)
      if (dias > maxDiasSinServicio) maxDiasSinServicio = dias
    }

    let vehiculosAlDia = 0
    let vehiculosPorVencer = 0
    let vehiculosVencidos = 0
    for (const v of todosVehiculos) {
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
      else vehiculosAlDia += 1
    }
    const misMisOrdenes = todasOrdenes.filter(o =>
      (o.tecnicos_ids?.includes(session.user.id) || o.tecnico_id === session.user.id) &&
      (o.estado === 'pendiente' || o.estado === 'en_curso')
    ).slice(0, 5)

    setStats({
      otActivas: otActivas.length, otMes: otMes.length,
      stockBajo: stockBajo.length, equiposCampo: equiposCampo.length,
      clientesTeros: countTeros || 0,
      clientesOlipro: countOlipro || 0,
      otPendientes: todasOrdenes.filter(o => o.estado === 'pendiente').length,
      vehiculosTotal: todosVehiculos.length,
      vehiculosAlDia,
      vehiculosPorVencer,
      vehiculosVencidos,
      otSinTecnico,
      otSinFecha,
      otSinVehiculo,
      clientesSinServicio: Math.min(30, actividadValida.size || 0),
      maxDiasSinServicio,
    })
    setMisOrdenes(misMisOrdenes)
    setRecordatorioPrl(crearRecordatorioPrl(todasOrdenes))
    setReconocimientosSemana(crearReconocimientosSemana(todasOrdenes, perfilesEquipo.data || []))

    const nuevasAlertas: { tipo: string; texto: string }[] = []
    stockBajo.forEach(m => nuevasAlertas.push({ tipo: 'warning', texto: `Stock bajo: ${m.nombre} (${m.stock || 0} ${m.unidad || ''})` }))
    equiposCampo.forEach(e => {
      if (e.fecha_salida) {
        const dias = Math.floor((Date.now() - new Date(e.fecha_salida).getTime()) / 86400000)
        if (dias > 14) nuevasAlertas.push({ tipo: 'danger', texto: `${e.codigo} lleva ${dias} dias en cliente` })
      }
    })
    setAlertas(nuevasAlertas)
    setLoading(false)
  }, [router])

  useEffect(() => { void cargarDatos() }, [cargarDatos])
  useEffect(() => {
    if (typeof window === 'undefined') return

    let timeoutMedianoche: ReturnType<typeof setTimeout> | null = null
    let intervaloRefresco: ReturnType<typeof setInterval> | null = null

    const programarSiguienteRefrescoDiario = () => {
      const ahora = new Date()
      const siguienteMedianoche = new Date(ahora)
      // 00:00:05 para evitar borde exacto de cambio de dia.
      siguienteMedianoche.setHours(24, 0, 5, 0)
      const ms = Math.max(1000, siguienteMedianoche.getTime() - ahora.getTime())

      timeoutMedianoche = setTimeout(() => {
        void cargarDatos()
        programarSiguienteRefrescoDiario()
      }, ms)
    }

    const refrescarSiVisible = () => {
      if (document.visibilityState === 'visible') {
        void cargarDatos()
      }
    }

    // Garantiza cambio diario automatico.
    programarSiguienteRefrescoDiario()
    // Mantiene el dashboard al dia con cambios de OT en jornada.
    intervaloRefresco = setInterval(refrescarSiVisible, 15 * 60 * 1000)
    document.addEventListener('visibilitychange', refrescarSiVisible)

    return () => {
      if (timeoutMedianoche) window.clearTimeout(timeoutMedianoche)
      if (intervaloRefresco) window.clearInterval(intervaloRefresco)
      document.removeEventListener('visibilitychange', refrescarSiVisible)
    }
  }, [cargarDatos])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const ROLES: any = {
    gerente: 'Gerente', oficina: 'Oficina', tecnico: 'Tecnico',
    almacen: 'Almacen', supervisor: 'Supervisor',
  }

  const esTecnico = perfil?.rol === 'tecnico' || perfil?.rol === 'almacen'

  const MODULOS: Array<{ href: string; icono?: string; iconoImg?: string; titulo: string; desc: string; siempre?: boolean; soloAdmin?: boolean }> = [
    { href: '/ordenes', icono: '📋', titulo: 'Ordenes', desc: 'Crear y gestionar', siempre: true },
    { href: '/planificacion', icono: '📅', titulo: 'Planificacion', desc: 'Calendario y rutas', siempre: true },
    { href: '/inventario', icono: '📦', titulo: 'Inventario', desc: 'Stock y materiales', siempre: true },
    { href: '/equipos', icono: '⚙️', titulo: 'Equipos', desc: 'Turbinas y motores', siempre: true },
    { href: '/flota', icono: '🚚', titulo: 'Flota de vehiculos', desc: 'ITV, seguros y documentos', siempre: true },
    { href: '/albaranes', icono: '🧾', titulo: 'Albaranes', desc: 'Con fotos y firma', siempre: true },
    { href: '/asistente', iconoImg: '/assistant-ia-teros-clean.png', titulo: 'Asistente IA', desc: 'Pregunta a la IA', siempre: true },
    { href: '/movimientos', icono: '📊', titulo: 'Movimientos', desc: 'Historial consumos', siempre: true },
    { href: '/sin-servicio', icono: '⏱', titulo: 'Recordatorio de servicio', desc: 'Clientes a recontactar', siempre: true },
    { href: '/clientes', icono: '🏢', titulo: 'Clientes', desc: 'Fichas y contacto', soloAdmin: true },
    { href: '/trabajadores', icono: '👷', titulo: 'Trabajadores', desc: 'Gestion personal', soloAdmin: true },
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
        icono: '🚨',
        texto: 'Revisar',
        color: '#ef4444',
        fondo: tema === 'dark' ? 'rgba(239,68,68,0.14)' : 'rgba(239,68,68,0.1)',
        borde: tema === 'dark' ? 'rgba(239,68,68,0.35)' : 'rgba(239,68,68,0.25)',
      }
    }
    if (estado === 'warning') {
      return {
        icono: '⚠',
        texto: 'Bien',
        color: '#f59e0b',
        fondo: tema === 'dark' ? 'rgba(245,158,11,0.14)' : 'rgba(245,158,11,0.1)',
        borde: tema === 'dark' ? 'rgba(245,158,11,0.35)' : 'rgba(245,158,11,0.25)',
      }
    }
    return {
      icono: '🏅',
      texto: '¡Bravo!',
      color: '#06b6d4',
      fondo: tema === 'dark' ? 'rgba(6,182,212,0.14)' : 'rgba(6,182,212,0.1)',
      borde: tema === 'dark' ? 'rgba(6,182,212,0.32)' : 'rgba(6,182,212,0.25)',
    }
  }

  const totalClientes = (stats.clientesTeros || 0) + (stats.clientesOlipro || 0)
  const estadoStock: EstadoSemaforo = stats.stockBajo >= 10 ? 'critical' : stats.stockBajo > 0 ? 'warning' : 'ok'
  const estadoFlota: EstadoSemaforo = stats.vehiculosVencidos > 0 ? 'critical' : stats.vehiculosPorVencer > 0 ? 'warning' : 'ok'
  const estadoRecordatorio: EstadoSemaforo =
    stats.clientesSinServicio >= 20 ? 'critical'
      : stats.clientesSinServicio >= 10 ? 'warning'
        : 'ok'

  const resumenCards: ResumenCard[] = [
    { label: 'OT Activas', valor: stats.otActivas, sub: `${stats.otPendientes} pendientes`, href: '/ordenes', estado: 'ok' },
    { label: 'Completadas mes', valor: stats.otMes, sub: 'este mes', href: '/ordenes?estado=completada', estado: 'ok' },
    { label: 'Clientes', valor: totalClientes, sub: `Teros ${stats.clientesTeros} - Olipro ${stats.clientesOlipro}`, href: '/clientes', estado: 'ok' },
    { label: 'Stock bajo', valor: stats.stockBajo, sub: 'materiales criticos', href: '/inventario', estado: estadoStock, mostrarInsignia: true },
    { label: 'Equipos en campo', valor: stats.equiposCampo, sub: 'en cliente', href: '/equipos', estado: stats.equiposCampo > 0 ? 'warning' : 'ok' },
    {
      label: 'Flota al dia',
      valor: stats.vehiculosAlDia,
      sub: `${stats.vehiculosTotal} total - ${stats.vehiculosPorVencer} por vencer - ${stats.vehiculosVencidos} vencidos`,
      href: '/flota',
      estado: estadoFlota,
      mostrarInsignia: true,
    },
    {
      label: 'Recordatorio servicio',
      valor: stats.clientesSinServicio,
      sub: `max ${stats.maxDiasSinServicio} dias - ver ranking`,
      href: '/sin-servicio',
      estado: estadoRecordatorio,
      mostrarInsignia: true,
    },
  ]

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
          <Image src="/logo.png" alt="Los Teros S.L" width={96} height={96} className="w-24 h-24 object-contain" style={{ mixBlendMode: tema === 'dark' ? 'screen' : 'normal' }} />
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
            {tema === 'dark' ? '☀️' : '🌙'}
          </button>
          <button onClick={handleLogout} className="text-sm px-3 py-1.5 rounded-lg transition-colors"
            style={{ background: bgMain, color: textMuted, border: `1px solid ${border}` }}>
            Salir
          </button>
        </div>
      </div>

      <div className="p-6 max-w-6xl mx-auto">
        <div className="mb-8">
          <h2 className="font-semibold text-xl mb-1" style={{ color: textColor }}>
            Hola, {perfil?.nombre?.split(' ')[0] || 'bienvenido'} 👋
          </h2>
          <p className="text-sm" style={{ color: textMuted }}>
            {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          <div className="rounded-xl p-4" style={{ background: 'rgba(6,182,212,0.10)', border: '1px solid rgba(6,182,212,0.25)' }}>
            <div className="flex items-center justify-between gap-2 mb-2">
              <p className="text-xs uppercase tracking-wider" style={{ color: '#06b6d4' }}>{recordatorioPrl.titulo}</p>
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ color: '#06b6d4', background: 'rgba(6,182,212,0.14)', border: '1px solid rgba(6,182,212,0.28)' }}>
                PRL
              </span>
            </div>
            <p className="text-sm font-semibold mb-2" style={{ color: textColor }}>Foco de hoy: {recordatorioPrl.foco}</p>
            <p className="text-sm leading-relaxed" style={{ color: textMuted }}>{recordatorioPrl.frase}</p>
          </div>

          <div className="rounded-xl p-4" style={{ background: 'rgba(124,58,237,0.10)', border: '1px solid rgba(124,58,237,0.28)' }}>
            <div className="flex items-center justify-between gap-2 mb-2">
              <p className="text-xs uppercase tracking-wider" style={{ color: '#a78bfa' }}>Reconocimientos de la semana</p>
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ color: '#a78bfa', background: 'rgba(124,58,237,0.18)', border: '1px solid rgba(124,58,237,0.28)' }}>
                Equipo
              </span>
            </div>
            <div className="flex flex-col gap-2">
              {reconocimientosSemana.map((r) => (
                <div key={r.id} className="rounded-lg px-3 py-2" style={{ background: 'rgba(124,58,237,0.10)', border: '1px solid rgba(124,58,237,0.22)' }}>
                  <p className="text-xs font-semibold mb-1" style={{ color: '#c4b5fd' }}>{r.insignia} {r.titulo}</p>
                  <p className="text-sm leading-relaxed" style={{ color: textColor }}>{r.detalle}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {misOrdenes.length > 0 && (
          <div className="rounded-xl p-5 mb-6" style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.3)' }}>
            <h3 className="font-semibold mb-3 text-sm" style={{ color: '#a78bfa' }}>Mis ordenes pendientes</h3>
            <div className="flex flex-col gap-2">
              {misOrdenes.map(o => (
                <div key={o.id} className="flex items-center justify-between rounded-lg px-4 py-3" style={{ background: 'rgba(124,58,237,0.1)' }}>
                  <div>
                    <span className="font-mono text-xs mr-2" style={{ color: '#06b6d4' }}>{o.codigo}</span>
                    <span className="text-sm" style={{ color: textColor }}>{o.descripcion?.substring(0, 50) || '—'}</span>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{
                    background: o.estado === 'en_curso' ? 'rgba(234,179,8,0.2)' : 'rgba(124,58,237,0.2)',
                    color: o.estado === 'en_curso' ? '#fbbf24' : '#a78bfa'
                  }}>
                    {o.estado.replace('_', ' ')}
                  </span>
                </div>
              ))}
            </div>
            <Link href="/planificacion" className="block mt-3 text-xs hover:opacity-80 transition-opacity" style={{ color: '#06b6d4' }}>
              Ver todas mis ordenes →
            </Link>
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
                <span>{a.tipo === 'danger' ? '🚨' : '⚠️'}</span>
                <span>{a.texto}</span>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
          {resumenCards.map((s, i) => {
            const semaforo = estilosSemaforo(s.estado)
            const insignia = insigniaEstado(s.estado)
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
                    filter: 'drop-shadow(0 7px 16px rgba(0,0,0,0.32))',
                  }}
                  aria-hidden
                >
                  <div
                    className="relative w-[54px] h-[54px] rounded-full flex flex-col items-center justify-center overflow-hidden"
                    style={{
                      background: `radial-gradient(circle at 28% 24%, rgba(255,255,255,0.78) 0%, rgba(255,255,255,0.22) 24%, ${insignia.fondo} 56%, rgba(0,0,0,0.10) 100%)`,
                      border: `1px solid ${insignia.borde}`,
                      boxShadow: `inset 0 1px 0 rgba(255,255,255,0.48), inset 0 -7px 12px rgba(0,0,0,0.16), 0 0 0 1px ${insignia.borde}, 0 8px 18px rgba(0,0,0,0.24)`,
                    }}
                  >
                    <span
                      className="absolute left-[11px] top-[10px] w-[10px] h-[6px] rounded-full"
                      style={{ background: 'rgba(255,255,255,0.55)', filter: 'blur(0.2px)' }}
                    />
                    {s.estado === 'ok' && (
                      <span className="absolute inset-0 pointer-events-none">
                        <span className="sparkle" />
                      </span>
                    )}
                    <span className="text-sm leading-none mb-0.5">{insignia.icono}</span>
                    <span className="text-[8px] font-bold leading-none tracking-wide" style={{ color: insignia.color }}>{insignia.texto}</span>
                  </div>
                </div>
              )}
              <p className="text-3xl font-bold" style={{ color: semaforo.color }}>{s.valor}</p>
              <p className="text-xs mt-1" style={{ color: textMuted }}>{s.sub}</p>
            </Link>
          )})}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {MODULOS.filter(m => m.siempre || (!esTecnico && m.soloAdmin)).map(m => (
            <Link key={m.href} href={m.href} className="rounded-xl p-5 block transition-all"
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
          ))}
        </div>
        <style jsx global>{`
          @keyframes insigniaFloat {
            0% { transform: translateY(0px) rotate(-2deg) scale(1); }
            50% { transform: translateY(-4px) rotate(2deg) scale(1.01); }
            100% { transform: translateY(0px) rotate(-2deg) scale(1); }
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
        `}</style>
      </div>
    </div>
  )
}
