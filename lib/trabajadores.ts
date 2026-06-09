// Dominio de Trabajadores (tabla perfiles + usuarios de Auth).

export interface Trabajador {
  id: string
  nombre: string
  rol: string
  telefono: string | null
  activo: boolean | null
  permisos_modulos?: Record<string, boolean> | null
}

export const ROLES: { valor: string; label: string; color: string }[] = [
  { valor: 'gerente', label: 'Gerente', color: 'var(--violet)' },
  { valor: 'oficina', label: 'Oficina', color: 'var(--brand-1)' },
  { valor: 'supervisor', label: 'Supervisor', color: 'var(--teal)' },
  { valor: 'tecnico', label: 'Técnico', color: 'var(--amber)' },
  { valor: 'almacen', label: 'Almacén', color: 'var(--green)' },
]

export function labelRol(v: string | null | undefined): string {
  return ROLES.find((r) => r.valor === v)?.label || (v || '—')
}
export function colorRol(v: string | null | undefined): string {
  return ROLES.find((r) => r.valor === v)?.color || 'var(--text-muted)'
}

// Genera una contraseña temporal legible.
export function generarPassword(): string {
  const may = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const min = 'abcdefghijkmnpqrstuvwxyz'
  const num = '23456789'
  const pick = (s: string, n: number) => Array.from({ length: n }, () => s[Math.floor(Math.random() * s.length)]).join('')
  return `${pick(may, 1)}${pick(min, 5)}${pick(num, 3)}`
}
