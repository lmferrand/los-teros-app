import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import type { RecommendedChange } from '@/lib/planificacion/types'

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

function parseBody(input: unknown) {
  const row = (input || {}) as Record<string, unknown>
  return {
    suggestionId: String(row.suggestionId || '').trim(),
    action: String(row.action || 'apply').trim().toLowerCase(),
    applyAll: Boolean(row.applyAll),
    changeIndexes: Array.isArray(row.changeIndexes)
      ? row.changeIndexes.map((n) => Number(n)).filter((n) => Number.isInteger(n) && n >= 0)
      : [],
  }
}

function asRecord(value: unknown) {
  if (!value || typeof value !== 'object') return {}
  return value as Record<string, unknown>
}

function buildScheduledAt(date: string | null, time: string | null, fallbackIso: string | null) {
  if (date && time) return `${date}T${time}:00`
  if (date && !time) {
    if (fallbackIso) {
      const d = new Date(fallbackIso)
      if (!Number.isNaN(d.getTime())) {
        const hh = String(d.getHours()).padStart(2, '0')
        const mm = String(d.getMinutes()).padStart(2, '0')
        return `${date}T${hh}:${mm}:00`
      }
    }
    return `${date}T08:00:00`
  }
  return fallbackIso
}

function normalizeChanges(source: unknown) {
  if (!Array.isArray(source)) return []
  const out: RecommendedChange[] = []
  for (const item of source) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const type = String(row.type || '').toLowerCase()
    const orderId = String(row.orderId || '').trim()
    const reason = String(row.reason || '').trim()
    if (!orderId || !reason) continue
    if (!['assign', 'reorder', 'reschedule', 'warning'].includes(type)) continue
    out.push({
      type: type as RecommendedChange['type'],
      orderId,
      from: asRecord(row.from),
      to: asRecord(row.to),
      reason,
    })
  }
  return out
}

export async function POST(req: NextRequest) {
  try {
    const token = getBearer(req)
    if (!token) return NextResponse.json({ error: 'Falta token.' }, { status: 401 })

    const cfg = getConfig()
    if (!cfg.url || !cfg.anon) {
      return NextResponse.json({ error: 'Falta configuracion de Supabase.' }, { status: 500 })
    }

    const supabaseUser = createClient(cfg.url, cfg.anon, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    })

    const { data: authData, error: authError } = await supabaseUser.auth.getUser()
    if (authError || !authData?.user) return NextResponse.json({ error: 'Sesion invalida.' }, { status: 401 })

    const { data: perfil, error: perfilError } = await supabaseUser
      .from('perfiles')
      .select('id, rol')
      .eq('id', authData.user.id)
      .single()
    if (perfilError || !perfil || !ROLES_PERMITIDOS.has(String(perfil.rol || '').toLowerCase())) {
      return NextResponse.json({ error: 'No tienes permisos para aplicar sugerencias.' }, { status: 403 })
    }

    const body = parseBody(await req.json().catch(() => ({})))
    if (!body.suggestionId) {
      return NextResponse.json({ error: 'Falta suggestionId.' }, { status: 400 })
    }

    const { data: suggestionRow, error: suggestionError } = await (supabaseUser.from('planificacion_sugerencias') as any)
      .select('id, created_by, status, final_payload')
      .eq('id', body.suggestionId)
      .maybeSingle()

    if (suggestionError || !suggestionRow) {
      return NextResponse.json({ error: 'Sugerencia no encontrada.' }, { status: 404 })
    }

    if (body.action === 'reject') {
      const { error: rejectError } = await (supabaseUser.from('planificacion_sugerencias') as any)
        .update({
          status: 'rejected',
          rejected_at: new Date().toISOString(),
        })
        .eq('id', body.suggestionId)
      if (rejectError) {
        return NextResponse.json({ error: rejectError.message }, { status: 500 })
      }
      return NextResponse.json({ ok: true, status: 'rejected' })
    }

    const payload = asRecord(suggestionRow.final_payload)
    const allChanges = normalizeChanges(payload.recommendedChanges)
    const applicable = allChanges
      .map((c, idx) => ({ idx, c }))
      .filter(({ c }) => c.type !== 'warning')

    const selected = body.applyAll || body.changeIndexes.length === 0
      ? applicable
      : applicable.filter(({ idx }) => body.changeIndexes.includes(idx))

    if (selected.length === 0) {
      return NextResponse.json({ ok: true, status: suggestionRow.status, applied: 0, skipped: applicable.length })
    }

    const orderIds = Array.from(new Set(selected.map((x) => x.c.orderId)))
    const { data: currentOrders, error: ordersError } = await supabaseUser
      .from('ordenes')
      .select('id, fecha_programada, tecnicos_ids, tecnico_id')
      .in('id', orderIds)

    if (ordersError) {
      return NextResponse.json({ error: `No se pudieron cargar las OT: ${ordersError.message}` }, { status: 500 })
    }

    const orderById = new Map<string, Record<string, unknown>>(
      (currentOrders || []).map((o) => [String(o.id), o as unknown as Record<string, unknown>])
    )

    const applied: Array<Record<string, unknown>> = []
    const failed: Array<Record<string, unknown>> = []

    for (const { idx, c } of selected) {
      const current = orderById.get(c.orderId)
      if (!current) {
        failed.push({ index: idx, orderId: c.orderId, reason: 'OT inexistente o sin acceso.' })
        continue
      }

      const to = asRecord(c.to)
      const updates: Record<string, unknown> = {}

      const workerId = String(to.workerId || '').trim()
      if (workerId) {
        updates.tecnico_id = workerId
        updates.tecnicos_ids = [workerId]
      }

      const date = String(to.date || '').trim() || null
      const time = String(to.time || '').trim() || null
      if ((c.type === 'reschedule' || c.type === 'reorder') && date) {
        const fallbackIso = String(current.fecha_programada || '') || null
        const scheduled = buildScheduledAt(date, time, fallbackIso)
        if (scheduled) updates.fecha_programada = scheduled
      }

      if (Object.keys(updates).length === 0) {
        failed.push({ index: idx, orderId: c.orderId, reason: 'Cambio sin datos aplicables.' })
        continue
      }

      const { error: updateError } = await supabaseUser
        .from('ordenes')
        .update(updates)
        .eq('id', c.orderId)

      if (updateError) {
        failed.push({ index: idx, orderId: c.orderId, reason: updateError.message })
      } else {
        applied.push({ index: idx, orderId: c.orderId, type: c.type, updates })
      }
    }

    const status = failed.length === 0 ? 'applied' : 'applied_partial'
    await (supabaseUser.from('planificacion_sugerencias') as any)
      .update({
        status,
        applied_at: new Date().toISOString(),
        applied_changes: applied,
      })
      .eq('id', body.suggestionId)

    return NextResponse.json({
      ok: true,
      status,
      applied: applied.length,
      failed: failed.length,
      details: { applied, failed },
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error interno'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

