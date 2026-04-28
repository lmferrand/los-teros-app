import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { enrichPlanningWithAi } from '@/lib/planificacion/ai'
import { optimizePlanningDeterministic } from '@/lib/planificacion/optimizer'
import type { PlanningScope } from '@/lib/planificacion/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ROLES_PERMITIDOS = new Set(['gerente', 'oficina', 'supervisor'])

function getConfig() {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    anon: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  }
}

function getBearer(req: NextRequest) {
  const auth = req.headers.get('authorization') || ''
  if (!auth.toLowerCase().startsWith('bearer ')) return null
  const token = auth.slice(7).trim()
  return token || null
}

function parseScope(value: unknown): PlanningScope {
  const v = String(value || '').toLowerCase()
  if (v === 'week' || v === 'semana') return 'week'
  if (v === 'month' || v === 'mes') return 'month'
  return 'day'
}

function parseBaseDate(value: unknown) {
  const raw = String(value || '').trim()
  if (!raw) return new Date().toISOString().slice(0, 10)
  const date = new Date(`${raw}T12:00:00`)
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 10)
  return date.toISOString().slice(0, 10)
}

export async function POST(req: NextRequest) {
  try {
    const token = getBearer(req)
    if (!token) {
      return NextResponse.json({ error: 'Falta token de autenticacion.' }, { status: 401 })
    }

    const cfg = getConfig()
    if (!cfg.url || !cfg.anon) {
      return NextResponse.json({ error: 'Falta configuracion de Supabase.' }, { status: 500 })
    }

    const supabaseUser = createClient(cfg.url, cfg.anon, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    })

    const { data: authData, error: authError } = await supabaseUser.auth.getUser()
    if (authError || !authData?.user) {
      return NextResponse.json({ error: 'Sesion invalida.' }, { status: 401 })
    }

    const { data: perfil, error: perfilError } = await supabaseUser
      .from('perfiles')
      .select('id, nombre, rol')
      .eq('id', authData.user.id)
      .single()

    if (perfilError || !perfil) {
      return NextResponse.json({ error: 'No se pudo validar perfil.' }, { status: 403 })
    }
    if (!ROLES_PERMITIDOS.has(String(perfil.rol || '').toLowerCase())) {
      return NextResponse.json({ error: 'No tienes permisos para sugerir planificacion.' }, { status: 403 })
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const scope = parseScope(body.scope)
    const baseDateIso = parseBaseDate(body.baseDate)

    const [ordersRes, workersRes] = await Promise.all([
      supabaseUser
        .from('ordenes')
        .select('id, codigo, tipo, cliente_id, tecnico_id, tecnicos_ids, fecha_programada, estado, prioridad, descripcion, observaciones, duracion_horas, hora_fija, materiales_previstos, clientes(id, nombre, nombre_comercial, nombre_fiscal, cif, direccion, poblacion, codigo_postal)')
        .in('estado', ['pendiente', 'en_curso'])
        .order('fecha_programada', { ascending: true, nullsFirst: false }),
      supabaseUser
        .from('perfiles')
        .select('id, nombre, rol, telefono, activo')
        .eq('activo', true)
        .order('nombre'),
    ])

    if (ordersRes.error) {
      return NextResponse.json({ error: `No se pudieron leer ordenes: ${ordersRes.error.message}` }, { status: 500 })
    }
    if (workersRes.error) {
      return NextResponse.json({ error: `No se pudieron leer trabajadores: ${workersRes.error.message}` }, { status: 500 })
    }

    const workers = (workersRes.data || []).filter((w) => {
      const role = String(w.rol || '').toLowerCase()
      return role === 'tecnico' || role === 'supervisor'
    })

    const normalizedOrders = (ordersRes.data || []).map((o: any) => ({
      ...o,
      clientes: Array.isArray(o?.clientes) ? (o.clientes[0] || null) : (o?.clientes || null),
    }))

    const deterministic = optimizePlanningDeterministic({
      scope,
      baseDateIso,
      orders: normalizedOrders,
      workers,
    })

    const aiResult = await enrichPlanningWithAi({
      scope,
      baseDateIso,
      deterministic,
    })

    const insertPayload = {
      scope: scope === 'day' ? 'dia' : scope === 'week' ? 'semana' : 'mes',
      fecha_base: baseDateIso,
      rango_desde: deterministic.range.from,
      rango_hasta: deterministic.range.to,
      status: 'generated',
      input_payload: { scope, baseDateIso, workerIds: workers.map((w) => w.id) },
      deterministic_payload: deterministic,
      ai_payload: aiResult.aiPayload || {},
      final_payload: aiResult.finalSuggestion,
      created_by: authData.user.id,
      ai_error: aiResult.aiError,
    }

    const { data: inserted, error: insertError } = await (supabaseUser.from('planificacion_sugerencias') as any)
      .insert(insertPayload)
      .select('id, created_at')
      .single()

    if (insertError) {
      return NextResponse.json(
        {
          error: `Se genero la sugerencia pero no se pudo registrar trazabilidad: ${insertError.message}`,
          deterministic,
          suggestion: aiResult.finalSuggestion,
          aiError: aiResult.aiError,
        },
        { status: 200 }
      )
    }

    return NextResponse.json({
      ok: true,
      suggestionId: inserted?.id || null,
      createdAt: inserted?.created_at || null,
      deterministic,
      suggestion: aiResult.finalSuggestion,
      aiError: aiResult.aiError,
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error interno'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
