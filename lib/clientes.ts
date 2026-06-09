// Dominio de Clientes. La tabla `clientes` ya existe en Supabase (5714+ filas).
// Nota: la columna `empresa` ('teros'/'olipro') no está en los tipos generados
// pero sí en la BD; se lee con select('*') y se filtra en cliente.

export interface Cliente {
  id: string
  nombre: string
  nombre_comercial: string | null
  nombre_fiscal: string | null
  cif: string | null
  direccion: string | null
  poblacion: string | null
  telefono: string | null
  movil: string | null
  email: string | null
  notas: string | null
  empresa?: string | null
}

export interface ServicioCliente {
  id: string
  cliente_id: string
  fecha_servicio: string
  origen: string
  numero_documento: string | null
  descripcion: string | null
  importe: number | null
}

export const EMPRESAS = [
  { valor: 'todos', label: 'Todas' },
  { valor: 'teros', label: 'Teros' },
  { valor: 'olipro', label: 'Olipro' },
]

export function labelEmpresa(v: string | null | undefined): string {
  if (v === 'teros') return 'Teros'
  if (v === 'olipro') return 'Olipro'
  return ''
}

// Normaliza texto para búsqueda (minúsculas, sin acentos).
export function normalizar(t: string | null | undefined): string {
  return (t || '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
}

// Texto buscable de un cliente.
export function textoBusqueda(c: Cliente): string {
  return [c.nombre, c.nombre_comercial, c.nombre_fiscal, c.cif, c.poblacion, c.telefono, c.movil, c.email]
    .map(normalizar)
    .filter(Boolean)
    .join(' ')
}
