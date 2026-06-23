// Modelo de datos del control financiero.

export type EstadoVenta =
  | 'presupuesto_aceptado'
  | 'cobrado_parcial'
  | 'cobrado_total'
  | 'pendiente_programar'
  | 'programado'
  | 'en_ejecucion'
  | 'trabajo_terminado'
  | 'pendiente_cierre'
  | 'listo_facturar'
  | 'facturado'
  | 'cerrado'

export type TipoTrabajo =
  | 'limpieza'
  | 'instalacion'
  | 'reparacion'
  | 'sustitucion_turbina'
  | 'otro'

export type CategoriaGasto =
  | 'mano_obra'
  | 'material'
  | 'turbina'
  | 'desplazamiento'
  | 'dietas'
  | 'subcontrata'
  | 'software'
  | 'compra_puntual'
  | 'otro'

export interface Venta {
  id: string
  numero: string | null
  // Cliente (denormalizado en la venta; cliente_id opcional para enlazar)
  cliente: string | null
  cliente_id: string | null
  empresa_local: string | null
  contacto: string | null
  telefono: string | null
  email: string | null
  direccion: string | null

  tipo_trabajo: TipoTrabajo | null
  responsable: string | null
  estado: EstadoVenta
  observaciones: string | null

  // Económico
  base_imponible: number | null
  iva_porcentaje: number | null
  iva_importe: number | null
  total_con_iva: number | null
  importe_cobrado: number | null
  fecha_cobro: string | null
  fecha_limite_cobro: string | null
  forma_cobro: string | null
  ref_bancaria: string | null

  // Fechas
  fecha_aceptacion: string | null
  fecha_prevista_ejecucion: string | null
  fecha_inicio_real: string | null
  fecha_fin_real: string | null
  fecha_prevista_facturacion: string | null
  fecha_real_facturacion: string | null
  numero_factura: string | null

  // Operativo (informativo)
  tecnicos: string | null
  horas_previstas: number | null
  horas_reales: number | null
  dias_previstos: number | null
  dias_reales: number | null
  requiere_turbina: boolean | null
  turbina_instalada: boolean | null
  turbina_devuelta: boolean | null

  creado_por: string | null
  created_at: string
  updated_at: string | null
}

export interface Gasto {
  id: string
  venta_id: string
  fecha: string | null
  categoria: CategoriaGasto | null
  descripcion: string | null
  proveedor: string | null
  estimado_sin_iva: number | null
  estimado_con_iva: number | null
  iva_porcentaje: number | null
  real_sin_iva: number | null
  real_con_iva: number | null
  pagado: boolean | null
  observaciones: string | null
  created_at: string
}

// Para crear/editar (sin campos autogenerados).
export type VentaInput = Partial<Omit<Venta, 'id' | 'created_at' | 'updated_at'>>
export type GastoInput = Partial<Omit<Gasto, 'id' | 'created_at'>>
