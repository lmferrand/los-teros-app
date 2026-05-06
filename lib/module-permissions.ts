export const APP_MODULES = [
  { key: 'dashboard', label: 'Dashboard', href: '/dashboard' },
  { key: 'ordenes', label: 'Órdenes', href: '/ordenes' },
  { key: 'planificacion', label: 'Planificación', href: '/planificacion' },
  { key: 'inventario', label: 'Inventario y equipos', href: '/inventario' },
  { key: 'flota', label: 'Flota de vehículos', href: '/flota' },
  { key: 'albaranes', label: 'Albaranes', href: '/albaranes' },
  { key: 'movimientos', label: 'Movimientos', href: '/movimientos' },
  { key: 'recordatorio_servicio', label: 'Recordatorio de servicio', href: '/sin-servicio' },
  { key: 'asistente', label: 'Asistente IA', href: '/asistente' },
  { key: 'clientes', label: 'Clientes', href: '/clientes' },
  { key: 'trabajadores', label: 'Trabajadores', href: '/trabajadores' },
  { key: 'respaldo', label: 'Respaldo', href: '/respaldo' },
  { key: 'presupuestos', label: 'Presupuestos', href: '/presupuestos' },
] as const

export type AppModuleKey = (typeof APP_MODULES)[number]['key']
export type ModulePermissions = Record<AppModuleKey, boolean>

const MODULE_KEYS = APP_MODULES.map((m) => m.key)

function normalizeRole(rol: string | null | undefined) {
  return String(rol || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}

function basePermissions(value: boolean): ModulePermissions {
  const out = {} as ModulePermissions
  for (const key of MODULE_KEYS) out[key] = value
  return out
}

function defaultsForRole(rol: string | null | undefined): ModulePermissions {
  const role = normalizeRole(rol)

  if (role === 'gerente' || role === 'oficina') {
    return basePermissions(true)
  }

  if (role === 'supervisor') {
    return {
      ...basePermissions(true),
      clientes: false,
    }
  }

  if (role === 'tecnico' || role === 'almacen') {
    return {
      ...basePermissions(false),
      dashboard: true,
      ordenes: true,
      planificacion: true,
      inventario: true,
      flota: true,
      albaranes: true,
      movimientos: true,
      asistente: true,
    }
  }

  return {
    ...basePermissions(false),
    dashboard: true,
  }
}

export function parseModulePermissionOverrides(
  raw: unknown
): Partial<Record<AppModuleKey, boolean>> {
  const out: Partial<Record<AppModuleKey, boolean>> = {}

  if (Array.isArray(raw)) {
    for (const k of raw) {
      const key = String(k || '') as AppModuleKey
      if (MODULE_KEYS.includes(key)) out[key] = true
    }
    return out
  }

  if (!raw || typeof raw !== 'object') return out

  const obj = raw as Record<string, unknown>
  for (const key of MODULE_KEYS) {
    const val = obj[key]
    if (typeof val === 'boolean') out[key] = val
  }
  return out
}

export function resolveModulePermissions(
  rol: string | null | undefined,
  rawOverrides: unknown
): ModulePermissions {
  const role = normalizeRole(rol)
  const base = defaultsForRole(role)
  if (role === 'gerente' || role === 'oficina') {
    return base
  }
  const overrides = parseModulePermissionOverrides(rawOverrides)
  for (const key of MODULE_KEYS) {
    if (typeof overrides[key] === 'boolean') base[key] = Boolean(overrides[key])
  }
  return base
}

export function hasModuleAccess(
  perfil: { rol?: string | null; permisos_modulos?: unknown } | null | undefined,
  moduleKey: AppModuleKey
) {
  return resolveModulePermissions(perfil?.rol, perfil?.permisos_modulos)[moduleKey]
}

export function moduleForPath(pathname: string): AppModuleKey | null {
  const path = String(pathname || '').toLowerCase()
  if (!path || path === '/' || path === '/login' || path.startsWith('/auth/')) return null

  if (path.startsWith('/dashboard')) return 'dashboard'
  if (path.startsWith('/ordenes')) return 'ordenes'
  if (path.startsWith('/planificacion')) return 'planificacion'
  if (path.startsWith('/inventario') || path.startsWith('/equipos') || path.startsWith('/escanear')) return 'inventario'
  if (path.startsWith('/flota')) return 'flota'
  if (path.startsWith('/albaranes')) return 'albaranes'
  if (path.startsWith('/movimientos')) return 'movimientos'
  if (path.startsWith('/sin-servicio')) return 'recordatorio_servicio'
  if (path.startsWith('/asistente')) return 'asistente'
  if (path.startsWith('/clientes')) return 'clientes'
  if (path.startsWith('/trabajadores')) return 'trabajadores'
  if (path.startsWith('/respaldo')) return 'respaldo'
  if (path.startsWith('/presupuestos')) return 'presupuestos'

  return null
}

export function firstAllowedModuleHref(
  rol: string | null | undefined,
  rawOverrides: unknown,
  options?: { excludeDashboard?: boolean }
) {
  const permissions = resolveModulePermissions(rol, rawOverrides)
  for (const mod of APP_MODULES) {
    if (options?.excludeDashboard && mod.key === 'dashboard') continue
    if (permissions[mod.key]) return mod.href
  }
  return '/dashboard'
}
