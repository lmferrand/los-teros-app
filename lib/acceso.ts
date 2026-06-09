// Control de acceso por módulos.
// Cada trabajador puede tener `permisos_modulos` (objeto { modulo: true }).
// - gerente/oficina: acceso total siempre (administradores).
// - resto: si tienen permisos definidos, solo acceden a esos módulos;
//   si no tienen ninguno definido, acceso total por defecto (no bloquear).

export interface PerfilAcceso {
  rol?: string | null
  permisos_modulos?: Record<string, boolean> | null
}

export const MODULOS: { modulo: string; label: string; seccion: 'Financiero' | 'Operaciones' }[] = [
  { modulo: 'dashboard', label: 'Dashboard', seccion: 'Financiero' },
  { modulo: 'presupuestos', label: 'Presupuestos', seccion: 'Financiero' },
  { modulo: 'facturacion', label: 'Facturación', seccion: 'Financiero' },
  { modulo: 'margenes', label: 'Márgenes', seccion: 'Financiero' },
  { modulo: 'alertas', label: 'Alertas', seccion: 'Financiero' },
  { modulo: 'documentos', label: 'Documentos IA', seccion: 'Financiero' },
  { modulo: 'planificacion', label: 'Planificación', seccion: 'Operaciones' },
  { modulo: 'clientes', label: 'Clientes', seccion: 'Operaciones' },
  { modulo: 'sin-servicio', label: 'Recordatorios', seccion: 'Operaciones' },
  { modulo: 'ordenes', label: 'Órdenes', seccion: 'Operaciones' },
  { modulo: 'inventario', label: 'Inventario', seccion: 'Operaciones' },
  { modulo: 'movimientos', label: 'Movimientos', seccion: 'Operaciones' },
  { modulo: 'escanear', label: 'Escanear', seccion: 'Operaciones' },
  { modulo: 'albaranes', label: 'Albaranes', seccion: 'Operaciones' },
  { modulo: 'trabajadores', label: 'Trabajadores', seccion: 'Operaciones' },
]

export const ROLES_ADMIN = ['gerente', 'oficina']

export function esAdmin(rol: string | null | undefined): boolean {
  return ROLES_ADMIN.includes(rol || '')
}

export function tieneAcceso(perfil: PerfilAcceso | null | undefined, modulo: string): boolean {
  if (modulo === 'inicio') return true
  if (esAdmin(perfil?.rol)) return true
  const p = perfil?.permisos_modulos
  if (p && typeof p === 'object' && Object.keys(p).length > 0) return p[modulo] === true
  return true // sin permisos definidos → acceso total por defecto
}

// ¿Tiene permisos personalizados definidos?
export function tienePermisosPersonalizados(perfil: PerfilAcceso | null | undefined): boolean {
  const p = perfil?.permisos_modulos
  return !!p && typeof p === 'object' && Object.keys(p).length > 0
}
