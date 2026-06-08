// Control de acceso. v1 simple: todos los usuarios internos (no técnicos)
// tienen acceso total. La estructura queda preparada para roles futuros.

export type Rol = 'direccion' | 'administracion' | 'interno' | 'tecnico'

export const ROLES_INTERNOS: Rol[] = ['direccion', 'administracion', 'interno']

export function esInterno(rol: string | null | undefined): boolean {
  // Cualquiera que no sea técnico se considera interno (acceso total en v1).
  return !!rol && rol !== 'tecnico'
}

// Módulos de la app (para preparar permisos por rol más adelante).
export type Modulo =
  | 'dashboard'
  | 'presupuestos'
  | 'facturacion'
  | 'margenes'
  | 'alertas'
  | 'documentos'

export function tieneAcceso(rol: string | null | undefined, _modulo: Modulo): boolean {
  // v1: acceso total para internos. Aquí se añadirá la matriz por rol/módulo.
  return esInterno(rol)
}
