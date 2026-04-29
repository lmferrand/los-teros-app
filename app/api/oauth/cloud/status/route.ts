import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

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

function isConnected(expiresAt: string | null | undefined) {
  if (!expiresAt) return true
  const ts = new Date(expiresAt).getTime()
  if (Number.isNaN(ts)) return true
  return ts > Date.now() + 60 * 1000
}

export async function GET(req: NextRequest) {
  try {
    const token = getBearer(req)
    if (!token) return NextResponse.json({ error: 'Falta token de sesión.' }, { status: 401 })

    const cfg = getSupabasePublic()
    if (!cfg) return NextResponse.json({ error: 'Falta configuración de Supabase.' }, { status: 500 })

    const userClient = createClient(cfg.url, cfg.anon, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    })

    const { data: userData, error: userError } = await userClient.auth.getUser()
    if (userError || !userData?.user?.id) {
      return NextResponse.json({ error: 'Sesión no válida.' }, { status: 401 })
    }

    const { data, error } = await userClient
      .from('integraciones_nube')
      .select('proveedor, account_email, account_name, expires_at, updated_at')
      .eq('user_id', userData.user.id)

    if (error) {
      return NextResponse.json(
        {
          error: `No se pudo leer integraciones_nube: ${error.message}`,
          hint: 'Ejecuta la migración SQL 20260427_integraciones_nube_oauth.sql',
        },
        { status: 400 }
      )
    }

    const rows = data || []
    const dropbox = rows.find((r: any) => r.proveedor === 'dropbox') || null
    const drive = rows.find((r: any) => r.proveedor === 'google_drive') || null

    return NextResponse.json({
      ok: true,
      conexiones: {
        dropbox: {
          connected: !!dropbox && isConnected(dropbox.expires_at),
          account_email: dropbox?.account_email || null,
          account_name: dropbox?.account_name || null,
          expires_at: dropbox?.expires_at || null,
          updated_at: dropbox?.updated_at || null,
        },
        google_drive: {
          connected: !!drive && isConnected(drive.expires_at),
          account_email: drive?.account_email || null,
          account_name: drive?.account_name || null,
          expires_at: drive?.expires_at || null,
          updated_at: drive?.updated_at || null,
        },
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: `No se pudo consultar estado OAuth: ${String(error?.message || 'Error desconocido')}` },
      { status: 500 }
    )
  }
}
