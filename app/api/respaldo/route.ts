import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ROLES_PERMITIDOS = new Set(['gerente', 'oficina', 'supervisor'])

const TABLAS_RESPALDO = [
  'clientes',
  'perfiles',
  'materiales',
  'equipos',
  'ordenes',
  'movimientos',
  'fotos_ordenes',
  'incidencias_ordenes',
  'albaranes',
  'presupuestos',
  'servicios_clientes',
  'vehiculos_flota',
  'vehiculos_documentos',
]

type ProveedorNube = 'dropbox' | 'google_drive'

type PayloadRespaldo = {
  meta: {
    app: string
    version: string
    generado_en: string
    generado_por: string
    timezone: string
  }
  totales: Record<string, number>
  tablas: Record<string, any[]>
  storage: {
    buckets: any[]
    objetos: any[]
  }
  advertencias: string[]
}

function nowTag() {
  const d = new Date()
  const yyyy = d.getUTCFullYear()
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  const hh = String(d.getUTCHours()).padStart(2, '0')
  const mi = String(d.getUTCMinutes()).padStart(2, '0')
  const ss = String(d.getUTCSeconds()).padStart(2, '0')
  return `${yyyy}${mm}${dd}-${hh}${mi}${ss}Z`
}

function limpiarNombreArchivo(nombre: string) {
  return String(nombre || '').replace(/[^\w.-]/g, '-')
}

function getBearer(req: NextRequest) {
  const raw = req.headers.get('authorization') || ''
  if (!raw.toLowerCase().startsWith('bearer ')) return null
  const token = raw.slice(7).trim()
  return token || null
}

function getConfigBasica() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY
  return { url, anon, service }
}

async function validarPermisos(req: NextRequest) {
  const token = getBearer(req)
  if (!token) return { ok: false as const, status: 401, error: 'Falta token de autenticacion.' }

  const { url, anon } = getConfigBasica()
  if (!url || !anon) return { ok: false as const, status: 500, error: 'Falta configuracion de Supabase.' }

  const supabaseUsuario = createClient(url, anon, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  })

  const { data: userData, error: userError } = await supabaseUsuario.auth.getUser()
  if (userError || !userData?.user) {
    return { ok: false as const, status: 401, error: 'Sesion no valida. Inicia sesion de nuevo.' }
  }

  const { data: perfil, error: perfilError } = await supabaseUsuario
    .from('perfiles')
    .select('id, nombre, rol')
    .eq('id', userData.user.id)
    .single()

  if (perfilError || !perfil) {
    return { ok: false as const, status: 403, error: 'No se pudo validar el perfil del usuario.' }
  }

  if (!ROLES_PERMITIDOS.has(String(perfil.rol || ''))) {
    return { ok: false as const, status: 403, error: 'No tienes permisos para generar respaldos globales.' }
  }

  return { ok: true as const, user: userData.user, perfil }
}

function getSupabaseAdmin() {
  const { url, service } = getConfigBasica()
  if (!url || !service) return null
  return createClient(url, service, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

async function getIntegracionUsuario(
  admin: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  proveedor: ProveedorNube
) {
  if (!admin) throw new Error('No hay cliente administrador disponible.')

  const { data, error } = await admin
    .from('integraciones_nube')
    .select('id, user_id, proveedor, access_token, refresh_token, expires_at, account_email, account_name')
    .eq('user_id', userId)
    .eq('proveedor', proveedor)
    .maybeSingle()

  if (error) {
    throw new Error(
      `No se pudo leer integraciones_nube. Ejecuta la migracion SQL 20260427_integraciones_nube_oauth.sql. Detalle: ${error.message}`
    )
  }

  return data || null
}

function tokenCaducado(expiresAt: string | null | undefined) {
  if (!expiresAt) return false
  const ts = new Date(expiresAt).getTime()
  if (Number.isNaN(ts)) return false
  return ts <= Date.now() + 60 * 1000
}

async function refreshGoogleDriveToken(refreshToken: string) {
  const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error('Faltan GOOGLE_DRIVE_CLIENT_ID y GOOGLE_DRIVE_CLIENT_SECRET para refrescar token.')
  }

  const body = new URLSearchParams()
  body.set('client_id', clientId)
  body.set('client_secret', clientSecret)
  body.set('refresh_token', refreshToken)
  body.set('grant_type', 'refresh_token')

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data?.access_token) {
    throw new Error(data?.error_description || data?.error || `Google token refresh fallo (${res.status}).`)
  }

  const expiresIn = Number(data?.expires_in || 3600)
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()
  return {
    accessToken: String(data.access_token),
    expiresAt,
  }
}

async function refreshDropboxToken(refreshToken: string) {
  const clientId = process.env.DROPBOX_CLIENT_ID
  const clientSecret = process.env.DROPBOX_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error('Faltan DROPBOX_CLIENT_ID y DROPBOX_CLIENT_SECRET para refrescar token.')
  }

  const body = new URLSearchParams()
  body.set('grant_type', 'refresh_token')
  body.set('refresh_token', refreshToken)
  body.set('client_id', clientId)
  body.set('client_secret', clientSecret)

  const res = await fetch('https://api.dropboxapi.com/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data?.access_token) {
    throw new Error(data?.error_description || data?.error || `Dropbox token refresh fallo (${res.status}).`)
  }

  const expiresIn = Number(data?.expires_in || 14400)
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()
  return {
    accessToken: String(data.access_token),
    expiresAt,
  }
}

async function resolverTokenProveedor(
  admin: ReturnType<typeof getSupabaseAdmin>,
  userId: string,
  proveedor: ProveedorNube
) {
  if (!admin) throw new Error('No hay cliente administrador disponible.')
  const integracion = await getIntegracionUsuario(admin, userId, proveedor)

  if (!integracion) {
    if (proveedor === 'dropbox' && process.env.BACKUP_DROPBOX_ACCESS_TOKEN) {
      return {
        token: process.env.BACKUP_DROPBOX_ACCESS_TOKEN,
        origen: 'env_global',
      }
    }
    if (proveedor === 'google_drive' && process.env.BACKUP_GOOGLE_DRIVE_ACCESS_TOKEN) {
      return {
        token: process.env.BACKUP_GOOGLE_DRIVE_ACCESS_TOKEN,
        origen: 'env_global',
      }
    }

    throw new Error(
      proveedor === 'dropbox'
        ? 'No tienes Dropbox conectado. Conectalo en el modulo Respaldo.'
        : 'No tienes Google Drive conectado. Conectalo en el modulo Respaldo.'
    )
  }

  if (!tokenCaducado(integracion.expires_at)) {
    return {
      token: String(integracion.access_token),
      origen: 'usuario',
      cuenta: integracion.account_email || integracion.account_name || null,
    }
  }

  if (!integracion.refresh_token) {
    throw new Error(
      proveedor === 'dropbox'
        ? 'El token de Dropbox caduco y no hay refresh token. Reconecta tu cuenta.'
        : 'El token de Google Drive caduco y no hay refresh token. Reconecta tu cuenta.'
    )
  }

  const refreshed =
    proveedor === 'dropbox'
      ? await refreshDropboxToken(String(integracion.refresh_token))
      : await refreshGoogleDriveToken(String(integracion.refresh_token))

  await admin
    .from('integraciones_nube')
    .update({
      access_token: refreshed.accessToken,
      expires_at: refreshed.expiresAt,
    })
    .eq('id', integracion.id)

  return {
    token: refreshed.accessToken,
    origen: 'usuario_refresh',
    cuenta: integracion.account_email || integracion.account_name || null,
  }
}

async function generarPayloadRespaldo(admin: ReturnType<typeof getSupabaseAdmin>, userId: string): Promise<PayloadRespaldo> {
  if (!admin) throw new Error('No hay cliente administrador disponible.')

  const tablas: Record<string, any[]> = {}
  const totales: Record<string, number> = {}
  const advertencias: string[] = []

  for (const tabla of TABLAS_RESPALDO) {
    const { data, error } = await admin.from(tabla).select('*')
    if (error) {
      tablas[tabla] = []
      totales[tabla] = 0
      advertencias.push(`Tabla ${tabla}: ${error.message}`)
      continue
    }
    const filas = data || []
    tablas[tabla] = filas
    totales[tabla] = filas.length
  }

  let buckets: any[] = []
  let objetos: any[] = []

  const { data: bucketsData, error: bucketsError } = await admin
    .schema('storage')
    .from('buckets')
    .select('id, name, public, file_size_limit, allowed_mime_types, created_at, updated_at')
    .order('name', { ascending: true })

  if (bucketsError) {
    advertencias.push(`Buckets storage: ${bucketsError.message}`)
  } else {
    buckets = bucketsData || []
  }

  const { data: objetosData, error: objetosError } = await admin
    .schema('storage')
    .from('objects')
    .select('id, bucket_id, name, metadata, created_at, updated_at, last_accessed_at')
    .order('created_at', { ascending: false })
    .limit(20000)

  if (objetosError) {
    advertencias.push(`Objetos storage: ${objetosError.message}`)
  } else {
    objetos = objetosData || []
  }

  return {
    meta: {
      app: 'los-teros-app',
      version: 'backup-v1',
      generado_en: new Date().toISOString(),
      generado_por: userId,
      timezone: 'UTC',
    },
    totales,
    tablas,
    storage: { buckets, objetos },
    advertencias,
  }
}

async function subirADropbox(contenido: string, fileName: string, token: string) {
  const basePath = (process.env.BACKUP_DROPBOX_PATH_PREFIX || '/los-teros-backups').replace(/\/+$/, '')
  const path = `${basePath}/${limpiarNombreArchivo(fileName)}`

  const res = await fetch('https://content.dropboxapi.com/2/files/upload', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/octet-stream',
      'Dropbox-API-Arg': JSON.stringify({
        path,
        mode: 'add',
        autorename: true,
        mute: true,
      }),
    },
    body: contenido,
  })

  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    return {
      ok: false,
      destino: 'dropbox',
      error: body?.error_summary || `Dropbox respondio ${res.status}.`,
    }
  }

  return {
    ok: true,
    destino: 'dropbox',
    path,
    id: body?.id || null,
    name: body?.name || fileName,
  }
}

function construirMultipartGoogleDrive(metadata: any, contenido: string, boundary: string) {
  const inicio =
    `--${boundary}\r\n` +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n'
  const fin = `\r\n--${boundary}--`
  return `${inicio}${contenido}${fin}`
}

async function subirAGoogleDrive(contenido: string, fileName: string, token: string) {

  const folderId = process.env.BACKUP_GOOGLE_DRIVE_FOLDER_ID
  const metadata: any = {
    name: limpiarNombreArchivo(fileName),
    mimeType: 'application/json',
  }
  if (folderId) metadata.parents = [folderId]

  const boundary = `backup-${Date.now()}-${Math.random().toString(36).slice(2)}`
  const body = construirMultipartGoogleDrive(metadata, contenido, boundary)

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,webContentLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  )

  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    return {
      ok: false,
      destino: 'google_drive',
      error: json?.error?.message || `Google Drive respondio ${res.status}.`,
    }
  }

  return {
    ok: true,
    destino: 'google_drive',
    id: json?.id || null,
    name: json?.name || fileName,
    webViewLink: json?.webViewLink || null,
    webContentLink: json?.webContentLink || null,
  }
}

function resumenPayload(payload: PayloadRespaldo) {
  const totalTablas = Object.keys(payload.tablas).length
  const totalFilas = Object.values(payload.totales).reduce((acc, n) => acc + Number(n || 0), 0)
  return {
    totalTablas,
    totalFilas,
    totalBuckets: payload.storage.buckets.length,
    totalObjetosStorage: payload.storage.objetos.length,
    advertencias: payload.advertencias,
  }
}

export async function GET(req: NextRequest) {
  try {
    const auth = await validarPermisos(req)
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const admin = getSupabaseAdmin()
    if (!admin) {
      return NextResponse.json(
        { error: 'Falta SUPABASE_SERVICE_ROLE_KEY para exportar la base completa.' },
        { status: 500 }
      )
    }

    const payload = await generarPayloadRespaldo(admin, auth.user.id)
    const json = JSON.stringify(payload, null, 2)
    const fileName = `los-teros-backup-${nowTag()}.json`

    return new NextResponse(json, {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Cache-Control': 'no-store, max-age=0',
        'x-respaldo-resumen': JSON.stringify(resumenPayload(payload)),
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: `No se pudo generar el respaldo: ${String(error?.message || 'Error desconocido')}` },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await validarPermisos(req)
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const admin = getSupabaseAdmin()
    if (!admin) {
      return NextResponse.json(
        { error: 'Falta SUPABASE_SERVICE_ROLE_KEY para exportar la base completa.' },
        { status: 500 }
      )
    }

    const body = await req.json().catch(() => ({}))
    const destino = String(body?.destino || '').toLowerCase()
    const destinosValidos = new Set(['dropbox', 'google_drive', 'drive', 'all'])
    if (!destinosValidos.has(destino)) {
      return NextResponse.json(
        { error: 'Destino invalido. Usa: dropbox, google_drive o all.' },
        { status: 400 }
      )
    }

    const payload = await generarPayloadRespaldo(admin, auth.user.id)
    const fileName = `los-teros-backup-${nowTag()}.json`
    const contenido = JSON.stringify(payload, null, 2)
    const bytes = new TextEncoder().encode(contenido).length

    const resultados: any[] = []
    if (destino === 'dropbox' || destino === 'all') {
      try {
        const cred = await resolverTokenProveedor(admin, auth.user.id, 'dropbox')
        const sub = await subirADropbox(contenido, fileName, cred.token)
        resultados.push({ ...sub, origen_token: cred.origen, cuenta: cred.cuenta || null })
      } catch (error: any) {
        resultados.push({
          ok: false,
          destino: 'dropbox',
          error: String(error?.message || 'No se pudo resolver token de Dropbox.'),
        })
      }
    }
    if (destino === 'google_drive' || destino === 'drive' || destino === 'all') {
      try {
        const cred = await resolverTokenProveedor(admin, auth.user.id, 'google_drive')
        const sub = await subirAGoogleDrive(contenido, fileName, cred.token)
        resultados.push({ ...sub, origen_token: cred.origen, cuenta: cred.cuenta || null })
      } catch (error: any) {
        resultados.push({
          ok: false,
          destino: 'google_drive',
          error: String(error?.message || 'No se pudo resolver token de Google Drive.'),
        })
      }
    }

    return NextResponse.json({
      ok: resultados.some((r) => r?.ok),
      fileName,
      bytes,
      resumen: resumenPayload(payload),
      resultados,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: `No se pudo subir el respaldo: ${String(error?.message || 'Error desconocido')}` },
      { status: 500 }
    )
  }
}
