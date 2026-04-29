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

export async function POST(req: NextRequest) {
  try {
    const token = getBearer(req)
    if (!token) return NextResponse.json({ error: 'Falta token de sesión.' }, { status: 401 })

    const cfg = getSupabasePublic()
    if (!cfg) return NextResponse.json({ error: 'Falta configuración de Supabase.' }, { status: 500 })

    const userClient = createClient(cfg.url, cfg.anon, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    })

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser()
    if (userError || !user?.id) {
      return NextResponse.json({ error: 'Sesión no válida.' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const provider = String(body?.provider || '').toLowerCase()
    if (!['dropbox', 'google_drive'].includes(provider)) {
      return NextResponse.json({ error: 'Proveedor inválido.' }, { status: 400 })
    }

    const { error } = await userClient
      .from('integraciones_nube')
      .delete()
      .eq('user_id', user.id)
      .eq('proveedor', provider)

    if (error) {
      return NextResponse.json(
        {
          error: `No se pudo desconectar: ${error.message}`,
          hint: 'Si falta la tabla, ejecuta la migración SQL 20260427_integraciones_nube_oauth.sql',
        },
        { status: 400 }
      )
    }

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    return NextResponse.json(
      { error: `No se pudo desconectar la cuenta: ${String(error?.message || 'Error desconocido')}` },
      { status: 500 }
    )
  }
}
