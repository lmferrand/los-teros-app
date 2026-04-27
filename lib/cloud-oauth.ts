import crypto from 'crypto'
import { NextRequest } from 'next/server'

export type ProveedorCloud = 'dropbox' | 'google_drive'

type OAuthStatePayload = {
  uid: string
  provider: ProveedorCloud
  next: string
  autoUpload: boolean
  iat: number
  exp: number
}

function base64urlEncode(input: string | Buffer) {
  return Buffer.from(input).toString('base64url')
}

function base64urlDecodeToString(input: string) {
  return Buffer.from(input, 'base64url').toString('utf-8')
}

export function getCloudOauthSecret() {
  return (
    process.env.CLOUD_OAUTH_STATE_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    'cloud-oauth-dev-secret'
  )
}

function hmac(data: string, secret: string) {
  return crypto.createHmac('sha256', secret).update(data).digest('base64url')
}

export function signOAuthState(payload: OAuthStatePayload) {
  const rawPayload = base64urlEncode(JSON.stringify(payload))
  const sig = hmac(rawPayload, getCloudOauthSecret())
  return `${rawPayload}.${sig}`
}

export function verifyOAuthState(stateToken: string): OAuthStatePayload | null {
  const [rawPayload, sig] = String(stateToken || '').split('.')
  if (!rawPayload || !sig) return null

  const expected = hmac(rawPayload, getCloudOauthSecret())
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return null
  if (!crypto.timingSafeEqual(a, b)) return null

  try {
    const payload = JSON.parse(base64urlDecodeToString(rawPayload)) as OAuthStatePayload
    if (!payload?.uid || !payload?.provider) return null
    if (Date.now() > Number(payload.exp || 0)) return null
    if (!['dropbox', 'google_drive'].includes(payload.provider)) return null
    return payload
  } catch {
    return null
  }
}

export function getPublicSiteUrl(req: NextRequest) {
  const origin = req.nextUrl.origin
  const host = (req.nextUrl.hostname || '').toLowerCase()
  const esLocal =
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '::1'

  if (esLocal) return origin

  const envSite = process.env.NEXT_PUBLIC_SITE_URL
  if (envSite) return envSite.replace(/\/+$/, '')

  const xfProto = req.headers.get('x-forwarded-proto')
  const xfHost = req.headers.get('x-forwarded-host')
  if (xfProto && xfHost) return `${xfProto}://${xfHost}`
  return origin
}

export function normalizarRutaNext(input: string | null | undefined) {
  const raw = String(input || '/respaldo').trim()
  if (!raw.startsWith('/')) return '/respaldo'
  if (raw.startsWith('//')) return '/respaldo'
  return raw
}
