import type { Venta, Gasto } from './tipos'

const num = (n: number | null | undefined) => (typeof n === 'number' && isFinite(n) ? n : 0)

// Cálculos económicos de una venta a partir de sus campos y sus gastos.
// Regla del prompt: los MÁRGENES se calculan SIN IVA (el IVA no es beneficio).
export interface CalculoVenta {
  baseImponible: number       // total sin IVA
  ivaPorcentaje: number
  ivaImporte: number
  totalConIva: number

  gastosEstSinIva: number
  gastosRealSinIva: number
  gastosEstConIva: number
  gastosRealConIva: number

  margenEstSinIva: number     // base - gastos estimados (sin IVA)
  margenRealSinIva: number    // base - gastos reales (sin IVA)
  margenEstPct: number | null
  margenRealPct: number | null

  importeCobrado: number
  pendienteCobro: number      // total con IVA - cobrado
  facturada: boolean
  pendienteFacturar: number   // total con IVA si aún no facturada

  desviacionGastos: number    // gastos reales - estimados (sin IVA)
  desviacionHoras: number     // horas reales - previstas
  sobrecoste: boolean         // gastos reales > estimados
}

export function calcularVenta(venta: Venta, gastos: Gasto[]): CalculoVenta {
  const base = num(venta.base_imponible)
  const ivaPorcentaje = venta.iva_porcentaje == null ? 21 : num(venta.iva_porcentaje)
  // IVA: usa el almacenado si existe; si no, lo deriva de la base.
  const ivaImporte = venta.iva_importe != null ? num(venta.iva_importe) : (base * ivaPorcentaje) / 100
  const totalConIva = venta.total_con_iva != null ? num(venta.total_con_iva) : base + ivaImporte

  const gastosEstSinIva = gastos.reduce((a, g) => a + num(g.estimado_sin_iva), 0)
  const gastosRealSinIva = gastos.reduce((a, g) => a + num(g.real_sin_iva), 0)
  const gastosEstConIva = gastos.reduce((a, g) => a + num(g.estimado_con_iva), 0)
  const gastosRealConIva = gastos.reduce((a, g) => a + num(g.real_con_iva), 0)

  const margenEstSinIva = base - gastosEstSinIva
  const margenRealSinIva = base - gastosRealSinIva
  const margenEstPct = base > 0 ? (margenEstSinIva / base) * 100 : null
  const margenRealPct = base > 0 ? (margenRealSinIva / base) * 100 : null

  const importeCobrado = num(venta.importe_cobrado)
  const pendienteCobro = Math.max(totalConIva - importeCobrado, 0)

  const facturada = !!venta.fecha_real_facturacion || !!venta.numero_factura || venta.estado === 'facturado' || venta.estado === 'cerrado'
  const pendienteFacturar = facturada ? 0 : totalConIva

  const desviacionGastos = gastosRealSinIva - gastosEstSinIva
  const desviacionHoras = num(venta.horas_reales) - num(venta.horas_previstas)
  const sobrecoste = gastosRealSinIva > gastosEstSinIva && gastosRealSinIva > 0

  return {
    baseImponible: base,
    ivaPorcentaje,
    ivaImporte,
    totalConIva,
    gastosEstSinIva,
    gastosRealSinIva,
    gastosEstConIva,
    gastosRealConIva,
    margenEstSinIva,
    margenRealSinIva,
    margenEstPct,
    margenRealPct,
    importeCobrado,
    pendienteCobro,
    facturada,
    pendienteFacturar,
    desviacionGastos,
    desviacionHoras,
    sobrecoste,
  }
}

// Deriva los importes de IVA de una venta para el formulario (cálculo en vivo).
export function derivarIva(base: number, ivaPorcentaje: number) {
  const iva = (num(base) * num(ivaPorcentaje)) / 100
  return { ivaImporte: iva, totalConIva: num(base) + iva }
}

// A partir del total con IVA y el %, deriva base e IVA.
export function desdeTotal(totalConIva: number, ivaPorcentaje: number) {
  const base = num(totalConIva) / (1 + num(ivaPorcentaje) / 100)
  return { base, ivaImporte: num(totalConIva) - base }
}
