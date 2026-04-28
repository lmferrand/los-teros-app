export type PlanningScope = 'day' | 'week' | 'month'

export type PlanningStatus = 'generated' | 'applied' | 'applied_partial' | 'rejected'

export type PlanningChangeType = 'assign' | 'reorder' | 'reschedule' | 'warning'

export type WarningLevel = 'info' | 'warning' | 'critical'

export interface WorkOrderSource {
  id: string
  codigo?: string | null
  tipo?: string | null
  cliente_id?: string | null
  tecnico_id?: string | null
  tecnicos_ids?: string[] | null
  fecha_programada?: string | null
  estado?: string | null
  prioridad?: string | null
  descripcion?: string | null
  observaciones?: string | null
  duracion_horas?: number | null
  hora_fija?: boolean | null
  clientes?: ClienteSource | null
  [key: string]: unknown
}

export interface ClienteSource {
  id: string
  nombre?: string | null
  nombre_comercial?: string | null
  nombre_fiscal?: string | null
  cif?: string | null
  direccion?: string | null
  poblacion?: string | null
  codigo_postal?: string | null
  latitud?: number | null
  longitud?: number | null
  lat?: number | null
  lng?: number | null
  [key: string]: unknown
}

export interface WorkerSource {
  id: string
  nombre?: string | null
  rol?: string | null
  activo?: boolean | null
  telefono?: string | null
  disponibilidad_inicio?: string | null
  disponibilidad_fin?: string | null
  capacidad_diaria_min?: number | null
  zona_habitual?: string | null
  especialidades?: string[] | null
  punto_inicio?: string | null
  punto_fin?: string | null
  vehiculo_id?: string | null
  [key: string]: unknown
}

export interface PlanningRange {
  from: string
  to: string
}

export interface NormalizedOrder {
  id: string
  code: string
  clientId: string | null
  clientName: string
  address: string
  locality: string
  postalCode: string
  coordinates: { lat: number; lng: number } | null
  serviceType: string
  durationMinutes: number
  priority: string
  status: string
  preferredDate: string | null
  preferredTime: string | null
  hasFixedTime: boolean
  scheduledAt: Date | null
  assignedWorkerIds: string[]
  notes: string
  restricciones: string
  materiales: string
}

export interface NormalizedWorker {
  id: string
  name: string
  active: boolean
  dayStartMin: number
  dayEndMin: number
  capacityMin: number
  zone: string
  skills: string[]
  startPoint: string
  endPoint: string
  vehicleId: string | null
}

export interface SuggestedStop {
  orderId: string
  orderCode: string
  clientName: string
  location: string
  locality: string
  suggestedStartTime: string
  estimatedDurationMinutes: number
  estimatedTravelFromPrevMinutes: number
  fixedTime: boolean
  reason: string
}

export interface SuggestedRoute {
  workerId: string
  workerName: string
  date: string
  route: SuggestedStop[]
  estimatedServiceMinutes: number
  estimatedTravelMinutes: number
  estimatedTotalMinutes: number
  freeMinutes: number
  overloadMinutes: number
  routeReasoning: string
}

export interface RecommendedChange {
  type: PlanningChangeType
  orderId: string
  from: Record<string, unknown> | null
  to: Record<string, unknown> | null
  reason: string
}

export interface PlanningWarning {
  level: WarningLevel
  message: string
  relatedOrderIds: string[]
}

export interface MissingDataItem {
  entityType: 'workOrder' | 'worker'
  entityId: string
  field: string
  impact: string
}

export interface DeterministicPlanningResult {
  summary: string
  planningScope: PlanningScope
  range: PlanningRange
  suggestedRoutes: SuggestedRoute[]
  recommendedChanges: RecommendedChange[]
  warnings: PlanningWarning[]
  missingData: MissingDataItem[]
  currentLoadByWorker: Array<{
    workerId: string
    workerName: string
    estimatedMinutes: number
    orderCount: number
  }>
  suggestedLoadByWorker: Array<{
    workerId: string
    workerName: string
    estimatedMinutes: number
    orderCount: number
  }>
  meta: {
    ordersConsidered: number
    workersConsidered: number
    approximateTravelModel: 'coordinates' | 'locality'
  }
}

export interface FinalPlanningSuggestion {
  summary: string
  planningScope: PlanningScope
  suggestedRoutes: SuggestedRoute[]
  recommendedChanges: RecommendedChange[]
  warnings: PlanningWarning[]
  missingData: MissingDataItem[]
  aiSummary: string | null
}

