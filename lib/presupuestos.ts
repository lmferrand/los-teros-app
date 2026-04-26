export const ESTADOS_PRESUPUESTO = [
  'enviado',
  'esperando_respuesta',
  'aceptado',
  'cancelado',
  'expirado',
] as const

export type EstadoPresupuesto = (typeof ESTADOS_PRESUPUESTO)[number]

const ESTADOS_FINALES = new Set<EstadoPresupuesto>(['aceptado', 'cancelado', 'expirado'])

export function normalizarEstadoPresupuesto(estado: string | null | undefined): EstadoPresupuesto {
  const valor = String(estado || '').toLowerCase().trim()
  if (valor === 'pendiente') return 'esperando_respuesta'
  if (valor === 'rechazado') return 'cancelado'
  if ((ESTADOS_PRESUPUESTO as readonly string[]).includes(valor)) return valor as EstadoPresupuesto
  return 'enviado'
}

export function calcularFechaExpiracion(fechaEnvio: string | null | undefined): Date | null {
  if (!fechaEnvio) return null
  const fechaBase = new Date(`${fechaEnvio}T00:00:00`)
  if (Number.isNaN(fechaBase.getTime())) return null
  const fechaExpiracion = new Date(fechaBase)
  fechaExpiracion.setMonth(fechaExpiracion.getMonth() + 6)
  return fechaExpiracion
}

export function calcularEstadoPresupuesto(
  estado: string | null | undefined,
  fechaEnvio: string | null | undefined,
  referencia = new Date(),
): EstadoPresupuesto {
  const estadoNormalizado = normalizarEstadoPresupuesto(estado)
  if (ESTADOS_FINALES.has(estadoNormalizado)) return estadoNormalizado
  const fechaExpiracion = calcularFechaExpiracion(fechaEnvio)
  if (fechaExpiracion && referencia >= fechaExpiracion) return 'expirado'
  return estadoNormalizado
}
