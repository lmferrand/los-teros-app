import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { email, nombre, rol } = await req.json()

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      redirectTo: 'https://los-teros-app.vercel.app/dashboard',
      data: { nombre, rol }
    })

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    if (data.user) {
      await supabaseAdmin.from('perfiles').upsert({
        id: data.user.id,
        nombre: nombre || email.split('@')[0],
        rol: rol || 'tecnico',
      })
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}