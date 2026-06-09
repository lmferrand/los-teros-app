// Dominio de Albaranes. Reutiliza la tabla `albaranes` existente.

export interface Albaran {
  id: string
  numero: string | null
  cliente_id: string | null
  orden_id: string | null
  descripcion: string | null
  estado: string | null
  fecha: string | null
  fotos_urls: string[] | null
  observaciones: string | null
  firmado: boolean | null
  razon_social: string | null
  cif: string | null
  domicilio: string | null
  localidad: string | null
  provincia: string | null
  telefono: string | null
  email: string | null
  responsable: string | null
  instalacion: string | null
  firma_empleado_url: string | null
  firma_cliente_url: string | null
  firmado_empleado_at: string | null
  firmado_cliente_at: string | null
}

export const ESTADOS_ALBARAN: Record<string, { label: string; color: string }> = {
  pendiente: { label: 'Pendiente', color: 'var(--amber)' },
  entregado: { label: 'Entregado', color: 'var(--brand-1)' },
  firmado: { label: 'Firmado', color: 'var(--teal)' },
  facturado: { label: 'Facturado', color: 'var(--green)' },
  cancelado: { label: 'Cancelado', color: 'var(--text-subtle)' },
}
export const ESTADOS_ALBARAN_LISTA = ['pendiente', 'entregado', 'firmado', 'facturado', 'cancelado']
