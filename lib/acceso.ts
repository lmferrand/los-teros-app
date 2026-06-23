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

// Roles que NUNCA ven información confidencial (precios, finanzas, documentos).
export const ROLES_RESTRINGIDOS = ['tecnico']

// Módulos confidenciales (con precios/finanzas/documentos/usuarios).
export const MODULOS_CONFIDENCIALES = ['dashboard', 'presupuestos', 'facturacion', 'margenes', 'alertas', 'documentos', 'trabajadores']

// Acceso por defecto de un técnico (solo lo necesario para su trabajo).
export const MODULOS_TECNICO_DEFAULT = ['ordenes', 'planificacion', 'inventario', 'escanear', 'albaranes']

export function esAdmin(rol: string | null | undefined): boolean {
  return ROLES_ADMIN.includes(rol || '')
}

export function esRestringido(rol: string | null | undefined): boolean {
  return ROLES_RESTRINGIDOS.includes(rol || '')
}

// ¿Puede ver importes/finanzas (precios de presupuestos, márgenes…)?
export function puedeVerFinanzas(perfil: PerfilAcceso | null | undefined): boolean {
  return !esRestringido(perfil?.rol)
}

export function tieneAcceso(perfil: PerfilAcceso | null | undefined, modulo: string): boolean {
  if (modulo === 'inicio') return true
  if (esAdmin(perfil?.rol)) return true
  const p = perfil?.permisos_modulos
  const tienePermisos = !!p && typeof p === 'object' && Object.keys(p).length > 0

  if (esRestringido(perfil?.rol)) {
    // Confidencial: bloqueo duro, ni con permisos.
    if (MODULOS_CONFIDENCIALES.includes(modulo)) return false
    // Permisos personalizados si los hay; si no, el mínimo del técnico.
    if (tienePermisos) return p![modulo] === true
    return MODULOS_TECNICO_DEFAULT.includes(modulo)
  }

  if (tienePermisos) return p![modulo] === true
  return true // resto de roles sin permisos definidos → acceso total por defecto
}

// ¿Tiene permisos personalizados definidos?
export function tienePermisosPersonalizados(perfil: PerfilAcceso | null | undefined): boolean {
  const p = perfil?.permisos_modulos
  return !!p && typeof p === 'object' && Object.keys(p).length > 0
}
