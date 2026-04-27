import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import {
  ProveedorCloud,
  getPublicSiteUrl,
  normalizarRutaNext,
  signOAuthState,
} from '@/lib/cloud-oauth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function getBearer(req: NextRequest) {
  const raw = req.headers.get('authorization') || ''
  if (!raw.toLowerCase().startsWith('bearer ')) return null
  return raw.slice(7).trim() || null
}

function getSupabasePublic() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) return null
  return { url, anon }
}

async function validarUsuario(req: NextRequest) {
  const token = getBearer(req)
  if (!token) throw new Error('Falta token de sesion.')

  const cfg = getSupabasePublic()
  if (!cfg) throw new Error('Falta configuracion de Supabase.')

  const userClient = createClient(cfg.url, cfg.anon, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  })

  const { data, error } = await userClient.auth.getUser()
  if (error || !data?.user?.id) throw new Error('Sesion no valida.')
  return data.user
}

function buildGoogleAuthUrl(req: NextRequest, userId: string, nextPath: string, autoUpload: boolean) {
  const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID
  if (!clientId) throw new Error('Falta GOOGLE_DRIVE_CLIENT_ID.')

  const base = getPublicSiteUrl(req)
  const redirectUri = `${base}/api/oauth/cloud/callback`
  const state = signOAuthState({
    uid: userId,
    provider: 'google_drive',
    next: nextPath,
    autoUpload,
    iat: Date.now(),
    exp: Date.now() + 1000 * 60 * 10,
  })

  const params = new URLSearchParams()
  params.set('client_id', clientId)
  params.set('redirect_uri', redirectUri)
  params.set('response_type', 'code')
  params.set('scope', 'openid email profile https://www.googleapis.com/auth/drive.file')
  params.set('access_type', 'offline')
  params.set('prompt', 'consent')
  params.set('state', state)

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
}

function buildDropboxAuthUrl(req: NextRequest, userId: string, nextPath: string, autoUpload: boolean) {
  const clientId = process.env.DROPBOX_CLIENT_ID
  if (!clientId) throw new Error('Falta DROPBOX_CLIENT_ID.')

  const base = getPublicSiteUrl(req)
  const redirectUri = `${base}/api/oauth/cloud/callback`
  const state = signOAuthState({
    uid: userId,
    provider: 'dropbox',
    next: nextPath,
    autoUpload,
    iat: Date.now(),
    exp: Date.now() + 1000 * 60 * 10,
  })

  const params = new URLSearchParams()
  params.set('client_id', clientId)
  params.set('redirect_uri', redirectUri)
  params.set('response_type', 'code')
  params.set('token_access_type', 'offline')
  params.set('scope', 'files.content.write files.content.read account_info.read')
  params.set('state', state)

  return `https://www.dropbox.com/oauth2/authorize?${params.toString()}`
}

export async function POST(req: NextRequest) {
  try {
    const user = await validarUsuario(req)
    const body = await req.json().catch(() => ({}))
    const provider = String(body?.provider || '').toLowerCase() as ProveedorCloud
    const nextPath = normalizarRutaNext(body?.next)
    const autoUpload = Boolean(body?.auto_upload || body?.autoUpload)

    if (provider !== 'dropbox' && provider !== 'google_drive') {
      return NextResponse.json({ error: 'Proveedor invalido. Usa dropbox o google_drive.' }, { status: 400 })
    }

    const url =
      provider === 'dropbox'
        ? buildDropboxAuthUrl(req, user.id, nextPath, autoUpload)
        : buildGoogleAuthUrl(req, user.id, nextPath, autoUpload)

    return NextResponse.json({ ok: true, url })
  } catch (error: any) {
    return NextResponse.json(
      { error: `No se pudo iniciar conexion OAuth: ${String(error?.message || 'Error desconocido')}` },
      { status: 500 }
    )
  }
}

