import type { Venta, Gasto, EstadoVenta } from './tipos'
import { calcularVenta, type CalculoVenta } from './calculos'
import { claveMes } from './dominio'

export interface VentaCalc {
  v: Venta
  calc: CalculoVenta
}

// Une ventas con sus gastos y precalcula.
export function combinar(ventas: Venta[], gastos: Gasto[]): VentaCalc[] {
  const m = new Map<string, Gasto[]>()
  for (const g of gastos) {
    const arr = m.get(g.venta_id) || []
    arr.push(g)
    m.set(g.venta_id, arr)
  }
  return ventas.map((v) => ({ v, calc: calcularVenta(v, m.get(v.id) || []) }))
}

// ---------------- Predicados de alerta ----------------

const ESTADOS_EJECUTADO: EstadoVenta[] = ['trabajo_terminado', 'pendiente_cierre', 'listo_facturar', 'facturado', 'cerrado']

export function esMargenBajo({ calc }: VentaCalc): boolean {
  const p = calc.margenRealPct ?? calc.margenEstPct
  return p != null && p < 30
}
export function esSobrecoste({ calc }: VentaCalc): boolean {
  return calc.sobrecoste
}
export function esCobradoNoProgramado({ v }: VentaCalc): boolean {
  const cobrado = (v.importe_cobrado || 0) > 0
  const sinProgramar = !v.fecha_prevista_ejecucion && !v.fecha_inicio_real
  const noEjecutado = !ESTADOS_EJECUTADO.includes(v.estado) && v.estado !== 'programado' && v.estado !== 'en_ejecucion'
  return cobrado && sinProgramar && noEjecutado
}
export function esTerminadoNoFacturado({ v, calc }: VentaCalc): boolean {
  return ESTADOS_EJECUTADO.includes(v.estado) && v.estado !== 'facturado' && v.estado !== 'cerrado' && !calc.facturada
}
export function esTurbinaSinDevolver({ v }: VentaCalc): boolean {
  return !!v.requiere_turbina && !!v.turbina_instalada && !v.turbina_devuelta
}
export function esBloqueado({ v }: VentaCalc): boolean {
  return v.estado === 'pendiente_cierre'
}
// Queda dinero por cobrar y ya pasó el plazo de cobro.
export function esCobroVencido({ v, calc }: VentaCalc): boolean {
  if (calc.pendienteCobro <= 0 || !v.fecha_limite_cobro) return false
  return v.fecha_limite_cobro.slice(0, 10) < new Date().toISOString().slice(0, 10)
}
export function esPendienteEjecutar({ v }: VentaCalc): boolean {
  const pendientes: EstadoVenta[] = ['presupuesto_aceptado', 'cobrado_parcial', 'cobrado_total', 'pendiente_programar', 'programado']
  return pendientes.includes(v.estado)
}
export function esListoFacturar({ v }: VentaCalc): boolean {
  return v.estado === 'listo_facturar'
}

// ---------------- Resumen mensual ----------------

export interface ResumenMes {
  clave: string
  ventasAceptadas: number       // base sin IVA aceptadas en el mes
  ventasAceptadasCount: number
  cobros: number                // cobrado cuya fecha_cobro cae en el mes
  facturacionEmitida: number    // total con IVA facturado en el mes (fecha_real_facturacion)
  facturacionPrevista: number   // total con IVA con prevista_facturacion en el mes
  ventasFuturaFacturacion: number // base de ventas aceptadas este mes que se facturan en meses posteriores
  gastosReales: number          // gastos reales (sin IVA) con fecha en el mes
  margenEstimado: number        // suma margen estimado de ventas aceptadas en el mes
  margenReal: number            // suma margen real de ventas aceptadas en el mes
}

export function resumenMensual(datos: VentaCalc[], gastos: Gasto[], clave: string): ResumenMes {
  let ventasAceptadas = 0, ventasAceptadasCount = 0, cobros = 0
  let facturacionEmitida = 0, facturacionPrevista = 0, ventasFuturaFacturacion = 0
  let margenEstimado = 0, margenReal = 0, gastosReales = 0

  for (const { v, calc } of datos) {
    if (claveMes(v.fecha_aceptacion) === clave) {
      ventasAceptadas += calc.baseImponible
      ventasAceptadasCount++
      margenEstimado += calc.margenEstSinIva
      margenReal += calc.margenRealSinIva
      const cm = claveMes(v.fecha_prevista_facturacion) || claveMes(v.fecha_real_facturacion)
      if (cm && cm > clave) ventasFuturaFacturacion += calc.baseImponible
    }
    if (claveMes(v.fecha_cobro) === clave) cobros += v.importe_cobrado || 0
    if (claveMes(v.fecha_real_facturacion) === clave) facturacionEmitida += calc.totalConIva
    if (claveMes(v.fecha_prevista_facturacion) === clave && !calc.facturada) facturacionPrevista += calc.totalConIva
  }

  for (const g of gastos) {
    if (claveMes(g.fecha) === clave) gastosReales += g.real_sin_iva || 0
  }

  return {
    clave, ventasAceptadas, ventasAceptadasCount, cobros,
    facturacionEmitida, facturacionPrevista, ventasFuturaFacturacion,
    gastosReales, margenEstimado, margenReal,
  }
}

export function mesActualClave(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
