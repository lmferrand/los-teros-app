import type {
  ClienteSource,
  DeterministicPlanningResult,
  MissingDataItem,
  NormalizedOrder,
  NormalizedWorker,
  PlanningRange,
  PlanningScope,
  PlanningWarning,
  RecommendedChange,
  SuggestedRoute,
  SuggestedStop,
  WorkOrderSource,
  WorkerSource,
} from '@/lib/planificacion/types'

const DEFAULT_DAY_START_MIN = 6 * 60
const DEFAULT_DAY_END_MIN = 15 * 60
const DEFAULT_CAPACITY_MIN = DEFAULT_DAY_END_MIN - DEFAULT_DAY_START_MIN

type DayRouteBucket = {
  worker: NormalizedWorker
  date: string
  fixed: NormalizedOrder[]
  flexible: NormalizedOrder[]
  route: SuggestedStop[]
  serviceMin: number
  travelMin: number
  totalMin: number
  freeMin: number
  overloadMin: number
  reasoning: string
}

type OptimizeParams = {
  scope: PlanningScope
  baseDateIso: string
  orders: WorkOrderSource[]
  workers: WorkerSource[]
}

function toIsoDate(d: Date) {
  return d.toISOString().slice(0, 10)
}

function parseIsoDate(value: string | null | undefined) {
  const raw = String(value || '').trim()
  if (!raw) return null
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return null
  return date
}

function minutesToHHMM(min: number) {
  const m = Math.max(0, Math.round(min))
  const hh = String(Math.floor(m / 60)).padStart(2, '0')
  const mm = String(m % 60).padStart(2, '0')
  return `${hh}:${mm}`
}

function hhmmToMinutes(value: string | null | undefined, fallback: number) {
  const text = String(value || '').trim()
  const match = text.match(/^([01]?\d|2[0-3]):([0-5]\d)$/)
  if (!match) return fallback
  return Number(match[1]) * 60 + Number(match[2])
}

function normalizeText(value: unknown) {
  return String(value || '').trim()
}

function normalizeLocality(text: string) {
  return normalizeText(text).toUpperCase()
}

function normalizePriority(value: unknown) {
  const v = String(value || '').trim().toLowerCase()
  if (v === '3' || v === 'alta' || v === 'urgente') return '3'
  if (v === '1' || v === 'baja') return '1'
  return '2'
}

function priorityWeight(value: string) {
  if (value === '3') return 100
  if (value === '1') return 30
  return 60
}

function rangeForScope(scope: PlanningScope, baseDateIso: string): PlanningRange {
  const base = parseIsoDate(`${baseDateIso}T12:00:00`) || new Date()
  const from = new Date(base)
  const to = new Date(base)

  if (scope === 'day') {
    return { from: toIsoDate(from), to: toIsoDate(from) }
  }

  if (scope === 'week') {
    const dayIdx = base.getDay() === 0 ? 6 : base.getDay() - 1
    from.setDate(base.getDate() - dayIdx)
    to.setTime(from.getTime())
    to.setDate(from.getDate() + 6)
    return { from: toIsoDate(from), to: toIsoDate(to) }
  }

  from.setDate(1)
  to.setMonth(from.getMonth() + 1, 0)
  return { from: toIsoDate(from), to: toIsoDate(to) }
}

function listDates(range: PlanningRange) {
  const dates: string[] = []
  const from = parseIsoDate(`${range.from}T12:00:00`)
  const to = parseIsoDate(`${range.to}T12:00:00`)
  if (!from || !to) return dates
  const cursor = new Date(from)
  while (cursor.getTime() <= to.getTime()) {
    dates.push(toIsoDate(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }
  return dates
}

function safeCoordinates(value: unknown) {
  if (!value || typeof value !== 'object') return null
  const obj = value as Record<string, unknown>
  const lat =
    Number(obj.latitud ?? obj.lat ?? obj.latitude ?? obj.coord_lat ?? obj.x ?? Number.NaN)
  const lng =
    Number(obj.longitud ?? obj.lng ?? obj.longitude ?? obj.coord_lng ?? obj.y ?? Number.NaN)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null
  return { lat, lng }
}

function getOrderCoordinates(order: WorkOrderSource, client: ClienteSource | null) {
  return (
    safeCoordinates(order) ||
    safeCoordinates(client) ||
    safeCoordinates(order?.metadata) ||
    safeCoordinates((client as Record<string, unknown> | null)?.metadata)
  )
}

function toRad(deg: number) {
  return (deg * Math.PI) / 180
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
  return R * c
}

function estimateTravelMinutes(
  from: { locality: string; coordinates: { lat: number; lng: number } | null },
  to: { locality: string; coordinates: { lat: number; lng: number } | null }
) {
  if (from.coordinates && to.coordinates) {
    const km = haversineKm(from.coordinates, to.coordinates)
    const min = Math.max(6, Math.round((km / 42) * 60))
    return { minutes: min, model: 'coordinates' as const }
  }
  if (from.locality && to.locality && from.locality === to.locality) {
    return { minutes: 10, model: 'locality' as const }
  }
  return { minutes: 30, model: 'locality' as const }
}

function inferLocality(address: string, locality: string) {
  const direct = normalizeLocality(locality)
  if (direct) return direct
  const fromAddress = normalizeLocality(address.split(',').pop() || '')
  return fromAddress || 'SIN_LOCALIDAD'
}

function normalizeOrder(order: WorkOrderSource, client: ClienteSource | null): NormalizedOrder {
  const scheduled = parseIsoDate(order.fecha_programada)
  const preferredDate = scheduled ? toIsoDate(scheduled) : null
  const preferredTime = scheduled ? minutesToHHMM(scheduled.getHours() * 60 + scheduled.getMinutes()) : null
  const clientName =
    normalizeText(client?.nombre_comercial) ||
    normalizeText(client?.nombre) ||
    normalizeText(order?.clientes?.nombre_comercial) ||
    normalizeText(order?.clientes?.nombre) ||
    'Sin cliente'
  const address = normalizeText(client?.direccion || order?.clientes?.direccion || '')
  const locality = inferLocality(address, normalizeText(client?.poblacion || order?.clientes?.poblacion || ''))
  const postalCode = normalizeText(
    (client as Record<string, unknown> | null)?.codigo_postal ||
      (order?.clientes as Record<string, unknown> | null)?.codigo_postal ||
      ''
  )

  const techIds = Array.isArray(order.tecnicos_ids)
    ? order.tecnicos_ids.filter(Boolean)
    : order.tecnico_id
      ? [order.tecnico_id]
      : []

  return {
    id: order.id,
    code: normalizeText(order.codigo) || `OT-${order.id.slice(0, 8)}`,
    clientId: order.cliente_id || null,
    clientName,
    address,
    locality,
    postalCode,
    coordinates: getOrderCoordinates(order, client),
    serviceType: normalizeText(order.tipo) || 'otro',
    durationMinutes: Math.max(30, Math.round(Number(order.duracion_horas || 2) * 60)),
    priority: normalizePriority(order.prioridad),
    status: normalizeText(order.estado) || 'pendiente',
    preferredDate,
    preferredTime,
    hasFixedTime: Boolean(order.hora_fija && scheduled),
    scheduledAt: scheduled,
    assignedWorkerIds: techIds,
    notes: normalizeText(order.observaciones || ''),
    restricciones: normalizeText((order as Record<string, unknown>).restricciones || ''),
    materiales: normalizeText(order.materiales_previstos || ''),
  }
}

function normalizeWorker(worker: WorkerSource): NormalizedWorker {
  const start = hhmmToMinutes(
    normalizeText(worker.disponibilidad_inicio || (worker as Record<string, unknown>).jornada_inicio),
    DEFAULT_DAY_START_MIN
  )
  const end = hhmmToMinutes(
    normalizeText(worker.disponibilidad_fin || (worker as Record<string, unknown>).jornada_fin),
    DEFAULT_DAY_END_MIN
  )
  const dayStartMin = Math.min(start, end - 30)
  const dayEndMin = Math.max(end, dayStartMin + 60)
  const configuredCap = Number(worker.capacidad_diaria_min || (worker as Record<string, unknown>).capacidad_diaria || Number.NaN)
  const capacityMin = Number.isFinite(configuredCap) && configuredCap > 0
    ? Math.round(configuredCap)
    : dayEndMin - dayStartMin || DEFAULT_CAPACITY_MIN
  const skillsRaw = (worker.especialidades || (worker as Record<string, unknown>).skills || []) as unknown
  const skills = Array.isArray(skillsRaw)
    ? skillsRaw.map((v) => normalizeText(v).toLowerCase()).filter(Boolean)
    : []
  return {
    id: worker.id,
    name: normalizeText(worker.nombre) || `Tecnico ${worker.id.slice(0, 4)}`,
    active: worker.activo !== false,
    dayStartMin,
    dayEndMin,
    capacityMin: Math.max(120, capacityMin),
    zone: normalizeLocality(normalizeText(worker.zona_habitual || (worker as Record<string, unknown>).zona || '')),
    skills,
    startPoint: normalizeText(worker.punto_inicio || (worker as Record<string, unknown>).base || 'Elche'),
    endPoint: normalizeText(worker.punto_fin || (worker as Record<string, unknown>).regreso || 'Elche'),
    vehicleId: (worker.vehiculo_id as string | null) || null,
  }
}

function dayKeyOf(order: NormalizedOrder) {
  if (!order.scheduledAt) return null
  return toIsoDate(order.scheduledAt)
}

function canWorkerPerform(worker: NormalizedWorker, order: NormalizedOrder) {
  if (!worker.skills.length) return true
  const service = order.serviceType.toLowerCase()
  return worker.skills.some((s) => service.includes(s) || s.includes(service))
}

function extractCurrentLoad(workers: NormalizedWorker[], orders: NormalizedOrder[]) {
  const load = workers.map((worker) => {
    const mine = orders.filter((o) => o.assignedWorkerIds.includes(worker.id))
    const minutes = mine.reduce((acc, o) => acc + o.durationMinutes, 0)
    return {
      workerId: worker.id,
      workerName: worker.name,
      estimatedMinutes: minutes,
      orderCount: mine.length,
    }
  })
  return load.sort((a, b) => b.estimatedMinutes - a.estimatedMinutes)
}

function getOrCreateBucket(map: Map<string, DayRouteBucket>, worker: NormalizedWorker, date: string) {
  const key = `${worker.id}__${date}`
  const existing = map.get(key)
  if (existing) return existing
  const bucket: DayRouteBucket = {
    worker,
    date,
    fixed: [],
    flexible: [],
    route: [],
    serviceMin: 0,
    travelMin: 0,
    totalMin: 0,
    freeMin: worker.capacityMin,
    overloadMin: 0,
    reasoning: '',
  }
  map.set(key, bucket)
  return bucket
}

function getCurrentRouteLastLocality(bucket: DayRouteBucket) {
  const last = bucket.route[bucket.route.length - 1]
  if (!last) return normalizeLocality(bucket.worker.startPoint)
  return normalizeLocality(last.locality)
}

function routeProjectedMinutes(bucket: DayRouteBucket, order: NormalizedOrder) {
  const fromLoc = getCurrentRouteLastLocality(bucket)
  const travel = estimateTravelMinutes(
    { locality: fromLoc, coordinates: null },
    { locality: order.locality, coordinates: order.coordinates }
  ).minutes
  return bucket.serviceMin + bucket.travelMin + order.durationMinutes + travel
}

function scoreCandidate(
  bucket: DayRouteBucket,
  order: NormalizedOrder,
  candidateDate: string,
  preferredDate: string | null
) {
  const projected = routeProjectedMinutes(bucket, order)
  const overload = Math.max(0, projected - bucket.worker.capacityMin)
  const sameLocalityCount = bucket.flexible.filter((o) => o.locality === order.locality).length
  const localityBonus = sameLocalityCount > 0 ? -14 - sameLocalityCount * 5 : 0
  const dayPenalty = preferredDate && preferredDate !== candidateDate ? 14 : 0
  const overloadPenalty = overload * 1.1
  const loadPenalty = (bucket.serviceMin / Math.max(1, bucket.worker.capacityMin)) * 15
  const zonePenalty = bucket.worker.zone && bucket.worker.zone !== order.locality ? 8 : 0
  const priorityTerm = -priorityWeight(order.priority) * 0.08
  return overloadPenalty + loadPenalty + dayPenalty + zonePenalty + localityBonus + priorityTerm
}

function sortByPriorityAndDue(orders: NormalizedOrder[]) {
  return [...orders].sort((a, b) => {
    const p = priorityWeight(b.priority) - priorityWeight(a.priority)
    if (p !== 0) return p
    const da = a.scheduledAt?.getTime() || Number.POSITIVE_INFINITY
    const db = b.scheduledAt?.getTime() || Number.POSITIVE_INFINITY
    return da - db
  })
}

function placeFlexibleInGap(
  pending: NormalizedOrder[],
  cursorMin: number,
  limitMin: number,
  from: { locality: string; coordinates: { lat: number; lng: number } | null }
) {
  if (pending.length === 0) return null
  let bestIdx = -1
  let bestScore = Number.POSITIVE_INFINITY
  let bestTravel = 0
  for (let i = 0; i < pending.length; i++) {
    const candidate = pending[i]
    const travel = estimateTravelMinutes(from, { locality: candidate.locality, coordinates: candidate.coordinates }).minutes
    const start = cursorMin + travel
    const end = start + candidate.durationMinutes
    if (end > limitMin) continue
    const score = travel * 1.3 - priorityWeight(candidate.priority) * 0.1
    if (score < bestScore) {
      bestScore = score
      bestIdx = i
      bestTravel = travel
    }
  }
  if (bestIdx < 0) return null
  const [picked] = pending.splice(bestIdx, 1)
  return { picked, travel: bestTravel }
}

function buildRouteForBucket(bucket: DayRouteBucket): DayRouteBucket {
  const fixed = [...bucket.fixed].sort((a, b) => {
    const ma = a.preferredTime ? hhmmToMinutes(a.preferredTime, DEFAULT_DAY_START_MIN) : DEFAULT_DAY_START_MIN
    const mb = b.preferredTime ? hhmmToMinutes(b.preferredTime, DEFAULT_DAY_START_MIN) : DEFAULT_DAY_START_MIN
    return ma - mb
  })
  const pending = sortByPriorityAndDue(bucket.flexible)
  const out: SuggestedStop[] = []

  let cursor = bucket.worker.dayStartMin
  let currentLocality = normalizeLocality(bucket.worker.startPoint)
  let currentCoordinates: { lat: number; lng: number } | null = null
  let serviceMin = 0
  let travelMin = 0

  const pushStop = (order: NormalizedOrder, travel: number, startMin: number, fixedTime: boolean) => {
    const start = Math.max(startMin, bucket.worker.dayStartMin)
    const stop: SuggestedStop = {
      orderId: order.id,
      orderCode: order.code,
      clientName: order.clientName,
      location: `${order.address}${order.address && order.locality ? ', ' : ''}${order.locality}`.trim() || order.locality,
      locality: order.locality,
      suggestedStartTime: minutesToHHMM(start),
      estimatedDurationMinutes: order.durationMinutes,
      estimatedTravelFromPrevMinutes: travel,
      fixedTime,
      reason: fixedTime
        ? 'Franja fija respetada.'
        : `Agrupada por cercania en ${order.locality}.`,
    }
    out.push(stop)
    cursor = start + order.durationMinutes
    serviceMin += order.durationMinutes
    travelMin += travel
    currentLocality = order.locality
    currentCoordinates = order.coordinates
  }

  for (const fixedOrder of fixed) {
    const fixedStart = fixedOrder.preferredTime
      ? hhmmToMinutes(fixedOrder.preferredTime, bucket.worker.dayStartMin)
      : cursor

    while (pending.length > 0) {
      const beforeFixed = placeFlexibleInGap(
        pending,
        cursor,
        fixedStart,
        { locality: currentLocality, coordinates: currentCoordinates }
      )
      if (!beforeFixed) break
      const start = cursor + beforeFixed.travel
      pushStop(beforeFixed.picked, beforeFixed.travel, start, false)
    }

    const travel = estimateTravelMinutes(
      { locality: currentLocality, coordinates: currentCoordinates },
      { locality: fixedOrder.locality, coordinates: fixedOrder.coordinates }
    ).minutes
    const arrival = cursor + travel
    const start = Math.max(arrival, fixedStart)
    pushStop(fixedOrder, travel, start, true)
  }

  while (pending.length > 0) {
    const next = placeFlexibleInGap(
      pending,
      cursor,
      Number.POSITIVE_INFINITY,
      { locality: currentLocality, coordinates: currentCoordinates }
    )
    if (!next) break
    pushStop(next.picked, next.travel, cursor + next.travel, false)
  }

  const totalMin = serviceMin + travelMin
  const overloadMin = Math.max(0, totalMin - bucket.worker.capacityMin)
  const freeMin = Math.max(0, bucket.worker.capacityMin - totalMin)

  const reasonParts: string[] = []
  const fixedCount = out.filter((s) => s.fixedTime).length
  if (fixedCount > 0) reasonParts.push(`Se respetan ${fixedCount} servicios con hora fija.`)
  const groupedLocalities = Array.from(new Set(out.map((s) => s.locality).filter(Boolean)))
  if (groupedLocalities.length > 0) reasonParts.push(`Ruta agrupada por ${groupedLocalities.join(', ')}.`)
  if (overloadMin > 0) reasonParts.push(`Carga por encima de la capacidad en ${overloadMin} min.`)
  if (reasonParts.length === 0) reasonParts.push('Ruta ordenada por cercania y prioridad.')

  return {
    ...bucket,
    route: out,
    serviceMin,
    travelMin,
    totalMin,
    freeMin,
    overloadMin,
    reasoning: reasonParts.join(' '),
  }
}

function buildWarnings(routes: DayRouteBucket[]): PlanningWarning[] {
  const warnings: PlanningWarning[] = []
  for (const r of routes) {
    if (r.overloadMin > 0) {
      warnings.push({
        level: 'critical',
        message: `${r.worker.name} (${r.date}) supera su capacidad diaria en ${r.overloadMin} min.`,
        relatedOrderIds: r.route.map((s) => s.orderId),
      })
    } else if (r.freeMin >= 90 && r.route.length > 0) {
      warnings.push({
        level: 'info',
        message: `${r.worker.name} (${r.date}) tiene hueco de ${r.freeMin} min para otra OT cercana.`,
        relatedOrderIds: r.route.map((s) => s.orderId).slice(0, 3),
      })
    }
  }
  return warnings
}

function buildMissingData(orders: NormalizedOrder[], workers: NormalizedWorker[]): MissingDataItem[] {
  const missing: MissingDataItem[] = []
  for (const o of orders) {
    if (!o.address && !o.locality) {
      missing.push({
        entityType: 'workOrder',
        entityId: o.id,
        field: 'direccion/poblacion',
        impact: 'No se puede estimar cercania geografica con precision.',
      })
    }
    if (!o.coordinates) {
      missing.push({
        entityType: 'workOrder',
        entityId: o.id,
        field: 'coordenadas',
        impact: 'Los tiempos de desplazamiento son aproximados por localidad.',
      })
    }
    if (o.durationMinutes <= 30) {
      missing.push({
        entityType: 'workOrder',
        entityId: o.id,
        field: 'duracion_horas',
        impact: 'La duracion minima por defecto puede no reflejar el tiempo real del servicio.',
      })
    }
  }

  for (const w of workers) {
    if (!w.zone) {
      missing.push({
        entityType: 'worker',
        entityId: w.id,
        field: 'zona_habitual',
        impact: 'No se puede priorizar asignacion por zona habitual.',
      })
    }
  }
  return missing
}

function pickDatesForOrder(
  order: NormalizedOrder,
  scope: PlanningScope,
  range: PlanningRange,
  rangeDates: string[]
) {
  const preferred = dayKeyOf(order)
  if (scope === 'day') return [range.from]
  if (order.hasFixedTime && preferred && preferred >= range.from && preferred <= range.to) return [preferred]
  if (preferred && preferred >= range.from && preferred <= range.to) {
    const others = rangeDates.filter((d) => d !== preferred)
    return [preferred, ...others]
  }
  return rangeDates
}

function indexChanges(changes: RecommendedChange[]) {
  const map = new Map<string, RecommendedChange>()
  for (const c of changes) {
    map.set(`${c.type}__${c.orderId}`, c)
  }
  return map
}

export function optimizePlanningDeterministic(params: OptimizeParams): DeterministicPlanningResult {
  const range = rangeForScope(params.scope, params.baseDateIso)
  const rangeDates = listDates(range)

  const rawWorkers = params.workers.filter((w) => w.id)
  const workers = rawWorkers
    .map(normalizeWorker)
    .filter((w) => w.active && (w.id.length > 0))

  const clientById = new Map<string, ClienteSource>()
  for (const order of params.orders) {
    const client = order.clientes || null
    if (client?.id) clientById.set(client.id, client)
  }

  const normalizedOrders = params.orders
    .filter((o) => o.id)
    .map((o) => normalizeOrder(o, (o.cliente_id && clientById.get(o.cliente_id)) || o.clientes || null))
    .filter((o) => ['pendiente', 'en_curso', 'programada', 'planificada', ''].includes(o.status))

  const ordersInRange = normalizedOrders.filter((o) => {
    if (!o.scheduledAt) return true
    const day = toIsoDate(o.scheduledAt)
    return day >= range.from && day <= range.to
  })

  const currentLoadByWorker = extractCurrentLoad(workers, ordersInRange)

  const buckets = new Map<string, DayRouteBucket>()
  for (const date of rangeDates) {
    for (const worker of workers) {
      getOrCreateBucket(buckets, worker, date)
    }
  }

  const fixedOrders = ordersInRange.filter((o) => o.hasFixedTime && o.scheduledAt)
  const flexOrders = ordersInRange.filter((o) => !o.hasFixedTime)

  for (const order of fixedOrders) {
    const day = dayKeyOf(order)
    if (!day) continue
    if (day < range.from || day > range.to) continue
    const preferredWorkers = order.assignedWorkerIds.filter((id) => workers.some((w) => w.id === id))
    const worker =
      workers.find((w) => preferredWorkers.includes(w.id)) ||
      workers.find((w) => canWorkerPerform(w, order)) ||
      workers[0]
    if (!worker) continue
    getOrCreateBucket(buckets, worker, day).fixed.push(order)
  }

  const sortedFlex = sortByPriorityAndDue(flexOrders)
  for (const order of sortedFlex) {
    const candidateDates = pickDatesForOrder(order, params.scope, range, rangeDates)
    const candidateWorkers = workers.filter((w) => {
      if (!canWorkerPerform(w, order)) return false
      if (!order.assignedWorkerIds.length) return true
      return order.assignedWorkerIds.includes(w.id)
    })
    const workersPool = candidateWorkers.length > 0 ? candidateWorkers : workers
    if (!workersPool.length || !candidateDates.length) continue

    let best: { bucket: DayRouteBucket; score: number } | null = null
    for (const date of candidateDates) {
      for (const worker of workersPool) {
        const bucket = getOrCreateBucket(buckets, worker, date)
        const score = scoreCandidate(bucket, order, date, order.preferredDate)
        if (!best || score < best.score) {
          best = { bucket, score }
        }
      }
    }
    if (!best) continue
    best.bucket.flexible.push(order)
  }

  const builtRoutes = Array.from(buckets.values())
    .map((bucket) => buildRouteForBucket(bucket))
    .filter((bucket) => bucket.route.length > 0)
    .sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date)
      return a.worker.name.localeCompare(b.worker.name, 'es')
    })

  const suggestedRoutes: SuggestedRoute[] = builtRoutes.map((r) => ({
    workerId: r.worker.id,
    workerName: r.worker.name,
    date: r.date,
    route: r.route,
    estimatedServiceMinutes: r.serviceMin,
    estimatedTravelMinutes: r.travelMin,
    estimatedTotalMinutes: r.totalMin,
    freeMinutes: r.freeMin,
    overloadMinutes: r.overloadMin,
    routeReasoning: r.reasoning,
  }))

  const suggestedByOrder = new Map<string, { workerId: string; date: string; time: string }>()
  for (const route of suggestedRoutes) {
    for (const stop of route.route) {
      suggestedByOrder.set(stop.orderId, {
        workerId: route.workerId,
        date: route.date,
        time: stop.suggestedStartTime,
      })
    }
  }

  const changes: RecommendedChange[] = []
  for (const order of ordersInRange) {
    const suggested = suggestedByOrder.get(order.id)
    if (!suggested) continue
    const currentDate = order.scheduledAt ? toIsoDate(order.scheduledAt) : null
    const currentTime = order.scheduledAt
      ? minutesToHHMM(order.scheduledAt.getHours() * 60 + order.scheduledAt.getMinutes())
      : null
    const currentWorker = order.assignedWorkerIds[0] || null

    if (!currentWorker || currentWorker !== suggested.workerId) {
      changes.push({
        type: 'assign',
        orderId: order.id,
        from: { workerId: currentWorker },
        to: { workerId: suggested.workerId },
        reason: !currentWorker
          ? 'OT sin trabajador asignado. Se asigna para equilibrar carga y cercania.'
          : 'Cambio de trabajador para reducir desplazamientos y balancear jornada.',
      })
    }

    if (currentDate !== suggested.date) {
      changes.push({
        type: 'reschedule',
        orderId: order.id,
        from: { date: currentDate, time: currentTime },
        to: { date: suggested.date, time: suggested.time },
        reason: 'Reprogramada para agrupar por zona y reducir desplazamientos innecesarios.',
      })
    } else if (!order.hasFixedTime && currentTime !== suggested.time) {
      changes.push({
        type: 'reorder',
        orderId: order.id,
        from: { date: currentDate, time: currentTime },
        to: { date: suggested.date, time: suggested.time },
        reason: 'Ajuste de orden de visita para mejorar continuidad de ruta.',
      })
    }
  }

  const changesMap = indexChanges(changes)
  const dedupChanges = Array.from(changesMap.values())

  const warnings = buildWarnings(builtRoutes)
  const missingData = buildMissingData(ordersInRange, workers)
  const suggestedLoadByWorker = workers
    .map((worker) => {
      const mine = suggestedRoutes.filter((r) => r.workerId === worker.id)
      const estimatedMinutes = mine.reduce((acc, r) => acc + r.estimatedTotalMinutes, 0)
      const orderCount = mine.reduce((acc, r) => acc + r.route.length, 0)
      return { workerId: worker.id, workerName: worker.name, estimatedMinutes, orderCount }
    })
    .sort((a, b) => b.estimatedMinutes - a.estimatedMinutes)

  const hasCoordinates = ordersInRange.some((o) => o.coordinates)
  const summary =
    `Se analizaron ${ordersInRange.length} OT planificables para ${workers.length} trabajadores. ` +
    `${dedupChanges.length} cambios sugeridos, ${warnings.length} alertas y ${missingData.length} datos mejorables.`

  return {
    summary,
    planningScope: params.scope,
    range,
    suggestedRoutes,
    recommendedChanges: dedupChanges,
    warnings,
    missingData,
    currentLoadByWorker,
    suggestedLoadByWorker,
    meta: {
      ordersConsidered: ordersInRange.length,
      workersConsidered: workers.length,
      approximateTravelModel: hasCoordinates ? 'coordinates' : 'locality',
    },
  }
}
