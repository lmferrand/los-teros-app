// Dominio del módulo de Inventario (materiales, equipos, movimientos).
// Reutiliza las tablas existentes en Supabase.

export interface Material {
  id: string
  nombre: string
  referencia: string | null
  categoria: string | null
  unidad: string | null
  stock: number | null
  minimo: number | null
  ubicacion: string | null
  foto_url: string | null
  notas: string | null
}

export interface Equipo {
  id: string
  codigo: string
  tipo: string
  marca: string | null
  modelo: string | null
  estado: string | null
  cantidad_disponible: number
  ubicacion: string | null
  notas: string | null
}

export type TipoMovimiento = 'entrada' | 'consumo' | 'salida' | 'ajuste'

export interface Movimiento {
  id: string
  tipo: string
  material_id: string | null
  equipo_id: string | null
  orden_id: string | null
  tecnico_id: string | null
  cantidad: number | null
  estado_equipo: string | null
  observaciones: string | null
  fecha: string | null
}

// ----------------- Catálogos -----------------

export const CATEGORIAS_MATERIAL = [
  { valor: 'limpieza', label: 'Limpieza' },
  { valor: 'filtros', label: 'Filtros' },
  { valor: 'repuestos', label: 'Repuestos' },
  { valor: 'instalacion', label: 'Instalación' },
  { valor: 'otro', label: 'Otro' },
]

export const UNIDADES = [
  { valor: 'unidad', label: 'Unidad' },
  { valor: 'litro', label: 'Litro' },
  { valor: 'kg', label: 'Kg' },
  { valor: 'metro', label: 'Metro' },
  { valor: 'rollo', label: 'Rollo' },
  { valor: 'caja', label: 'Caja' },
]

export const TIPOS_EQUIPO = [
  { valor: 'turbina', label: 'Turbina' },
  { valor: 'motor', label: 'Motor' },
  { valor: 'caja_extraccion', label: 'Caja extracción' },
  { valor: 'caja', label: 'Caja' },
  { valor: 'otro', label: 'Otro' },
]

export const ESTADOS_EQUIPO: Record<string, { label: string; color: string }> = {
  disponible: { label: 'Disponible', color: 'var(--green)' },
  en_cliente: { label: 'En cliente', color: 'var(--brand-1)' },
  averiado: { label: 'Averiado', color: 'var(--red)' },
  pendiente_limpieza: { label: 'Pendiente limpieza', color: 'var(--amber)' },
  pendiente_revision: { label: 'Pendiente revisión', color: 'var(--violet)' },
}

export const TIPOS_MOVIMIENTO: Record<string, { label: string; color: string; icono: string }> = {
  entrada: { label: 'Entrada stock', color: 'var(--teal)', icono: '📥' },
  consumo: { label: 'Consumo material', color: 'var(--amber)', icono: '📦' },
  salida: { label: 'Salida equipo', color: 'var(--brand-1)', icono: '⚙️' },
  ajuste: { label: 'Ajuste stock', color: 'var(--violet)', icono: '✏️' },
}

export function labelCategoria(v: string | null | undefined): string {
  return CATEGORIAS_MATERIAL.find((c) => c.valor === v)?.label || (v || '—')
}
export function labelUnidad(v: string | null | undefined): string {
  return UNIDADES.find((u) => u.valor === v)?.label || (v || '')
}
export function labelTipoEquipo(v: string | null | undefined): string {
  return TIPOS_EQUIPO.find((t) => t.valor === v)?.label || (v || '—')
}

// Material bajo de stock (stock <= mínimo, con mínimo definido > 0).
export function stockBajo(m: Pick<Material, 'stock' | 'minimo'>): boolean {
  if (m.minimo == null || m.minimo <= 0) return false
  return (m.stock ?? 0) <= m.minimo
}

// ----------------- QR (mismo formato que la app antigua) -----------------

export function payloadQrMaterial(m: Material): string {
  return JSON.stringify({
    tipo: 'material',
    id: m.id,
    nombre: m.nombre,
    referencia: m.referencia || null,
    unidad: m.unidad || null,
  })
}

export function payloadQrEquipo(e: Equipo): string {
  return JSON.stringify({
    tipo: 'equipo',
    id: e.id,
    codigo: e.codigo,
    tipo_equipo: e.tipo || null,
  })
}
