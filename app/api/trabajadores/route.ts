import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

// Crear trabajador con contraseña.
export async function POST(req: Request) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY no configurada' }, { status: 501 })
  }
  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 }) }
  const { email, password, nombre, rol, telefono } = body || {}
  if (!email || !password || !nombre) return NextResponse.json({ error: 'Faltan email, contraseña o nombre' }, { status: 400 })

  const sb = admin()
  // Crear usuario ya confirmado (puede entrar al instante).
  const { data, error } = await sb.auth.admin.createUser({
    email: String(email).trim(),
    password: String(password),
    email_confirm: true,
    user_metadata: { nombre, rol: rol || 'tecnico' },
  })
  if (error || !data.user) {
    return NextResponse.json({ error: error?.message || 'No se pudo crear el usuario' }, { status: 400 })
  }
  // Crear/actualizar su perfil.
  const { error: errPerfil } = await (sb as any).from('perfiles').upsert({
    id: data.user.id,
    nombre: nombre || String(email).split('@')[0],
    rol: rol || 'tecnico',
    telefono: telefono || null,
    activo: true,
  })
  if (errPerfil) return NextResponse.json({ error: 'Usuario creado pero falló el perfil: ' + errPerfil.message }, { status: 500 })

  return NextResponse.json({ ok: true, id: data.user.id })
}

// Eliminar trabajador (perfil + usuario de Auth).
export async function DELETE(req: Request) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY no configurada' }, { status: 501 })
  }
  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 }) }
  const id = body?.id
  if (!id) return NextResponse.json({ error: 'Falta id' }, { status: 400 })

  const sb = admin()
  // Desligar de órdenes para no romper referencias.
  await (sb as any).from('ordenes').update({ tecnico_id: null }).eq('tecnico_id', id)
  await (sb as any).from('perfiles').delete().eq('id', id)
  const { error } = await sb.auth.admin.deleteUser(id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ ok: true })
}
