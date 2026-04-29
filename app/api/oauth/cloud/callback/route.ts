import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import {
  getPublicSiteUrl,
  normalizarRutaNext,
  verifyOAuthState,
} from '@/lib/cloud-oauth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !service) return null
  return createClient(url, service, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

function toRedirect(req: NextRequest, path: string, params?: Record<string, string>) {
  const base = getPublicSiteUrl(req)
  const url = new URL(`${base}${normalizarRutaNext(path)}`)
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v)
    }
  }
  return NextResponse.redirect(url)
}

async function tokenGoogle(req: NextRequest, code: string) {
  const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET
  if (!clientId || !clientSecret) throw new Error('Faltan credenciales Google OAuth.')

  const redirectUri = `${getPublicSiteUrl(req)}/api/oauth/cloud/callback`
  const body = new URLSearchParams()
  body.set('client_id', clientId)
  body.set('client_secret', clientSecret)
  body.set('code', code)
  body.set('redirect_uri', redirectUri)
  body.set('grant_type', 'authorization_code')

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data?.access_token) {
    throw new Error(data?.error_description || data?.error || `Google token error (${res.status}).`)
  }
  return data
}

async function cuentaGoogle(accessToken: string) {
  const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) return { email: null, name: null, raw: data }
  return {
    email: data?.email || null,
    name: data?.name || null,
    raw: data,
  }
}

async function tokenDropbox(req: NextRequest, code: string) {
  const clientId = process.env.DROPBOX_CLIENT_ID
  const clientSecret = process.env.DROPBOX_CLIENT_SECRET
  if (!clientId || !clientSecret) throw new Error('Faltan credenciales Dropbox OAuth.')

  const redirectUri = `${getPublicSiteUrl(req)}/api/oauth/cloud/callback`
  const body = new URLSearchParams()
  body.set('code', code)
  body.set('grant_type', 'authorization_code')
  body.set('client_id', clientId)
  body.set('client_secret', clientSecret)
  body.set('redirect_uri', redirectUri)

  const res = await fetch('https://api.dropboxapi.com/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data?.access_token) {
    throw new Error(data?.error_description || data?.error || `Dropbox token error (${res.status}).`)
  }
  return data
}

async function cuentaDropbox(accessToken: string) {
  const res = await fetch('https://api.dropboxapi.com/2/users/get_current_account', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) return { email: null, name: null, raw: data }
  return {
    email: data?.email || null,
    name: data?.name?.display_name || data?.name?.given_name || null,
    raw: data,
  }
}

export async function GET(req: NextRequest) {
  const error = req.nextUrl.searchParams.get('error')
  const errorDescription = req.nextUrl.searchParams.get('error_description')
  const code = req.nextUrl.searchParams.get('code')
  const state = req.nextUrl.searchParams.get('state')

  const parsedState = verifyOAuthState(String(state || ''))
  const safeNext = normalizarRutaNext(parsedState?.next || '/respaldo')

  if (error) {
    return toRedirect(req, safeNext, {
      cloud_oauth: 'error',
      provider: parsedState?.provider || 'unknown',
      mensaje: errorDescription || error,
    })
  }

  if (!code || !parsedState) {
    return toRedirect(req, '/respaldo', {
      cloud_oauth: 'error',
      provider: 'unknown',
      mensaje: 'No se pudo validar el estado OAuth. Inténtalo de nuevo.',
    })
  }

  try {
    const admin = getSupabaseAdmin()
    if (!admin) throw new Error('Falta SUPABASE_SERVICE_ROLE_KEY.')

    let accessToken = ''
    let refreshToken: string | null = null
    let expiresAt: string | null = null
    let scope: string | null = null
    let tokenType: string | null = null
    let accountEmail: string | null = null
    let accountName: string | null = null
    let metadata: any = {}

    if (parsedState.provider === 'google_drive') {
      const tk = await tokenGoogle(req, code)
      accessToken = String(tk.access_token)
      refreshToken = tk.refresh_token ? String(tk.refresh_token) : null
      scope = tk.scope ? String(tk.scope) : null
      tokenType = tk.token_type ? String(tk.token_type) : null
      const expiresIn = Number(tk.expires_in || 3600)
      expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()
      const cuenta = await cuentaGoogle(accessToken)
      accountEmail = cuenta.email
      accountName = cuenta.name
      metadata = { profile: cuenta.raw }
    } else {
      const tk = await tokenDropbox(req, code)
      accessToken = String(tk.access_token)
      refreshToken = tk.refresh_token ? String(tk.refresh_token) : null
      scope = tk.scope ? String(tk.scope) : null
      tokenType = tk.token_type ? String(tk.token_type) : null
      const expiresIn = Number(tk.expires_in || 14400)
      expiresAt = Number.isFinite(expiresIn) ? new Date(Date.now() + expiresIn * 1000).toISOString() : null
      const cuenta = await cuentaDropbox(accessToken)
      accountEmail = cuenta.email
      accountName = cuenta.name
      metadata = { account: cuenta.raw }
    }

    const { error: upsertError } = await admin.from('integraciones_nube').upsert(
      {
        user_id: parsedState.uid,
        proveedor: parsedState.provider,
        access_token: accessToken,
        refresh_token: refreshToken,
        scope,
        token_type: tokenType,
        expires_at: expiresAt,
        account_email: accountEmail,
        account_name: accountName,
        metadata,
      },
      { onConflict: 'user_id,proveedor' }
    )
    if (upsertError) throw new Error(upsertError.message)

    return toRedirect(req, safeNext, {
      cloud_oauth: 'ok',
      provider: parsedState.provider,
      auto_upload: parsedState.autoUpload ? '1' : '0',
    })
  } catch (e: any) {
    return toRedirect(req, safeNext, {
      cloud_oauth: 'error',
      provider: parsedState.provider,
      mensaje: String(e?.message || 'Error en callback OAuth.'),
    })
  }
}
