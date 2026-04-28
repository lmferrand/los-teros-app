import type {
  DeterministicPlanningResult,
  FinalPlanningSuggestion,
  PlanningScope,
  PlanningWarning,
  RecommendedChange,
  SuggestedRoute,
} from '@/lib/planificacion/types'

type AiRawResponse = {
  summary?: unknown
  planningScope?: unknown
  suggestedRoutes?: unknown
  recommendedChanges?: unknown
  warnings?: unknown
  missingData?: unknown
}

type BuildAiParams = {
  scope: PlanningScope
  baseDateIso: string
  deterministic: DeterministicPlanningResult
}

function tryParseJson(text: string) {
  const direct = text.trim()
  if (!direct) return null

  try {
    return JSON.parse(direct)
  } catch {
    // ignore
  }

  const fence = direct.match(/```json\s*([\s\S]*?)```/i) || direct.match(/```\s*([\s\S]*?)```/i)
  if (fence?.[1]) {
    try {
      return JSON.parse(fence[1].trim())
    } catch {
      // ignore
    }
  }

  const first = direct.indexOf('{')
  const last = direct.lastIndexOf('}')
  if (first >= 0 && last > first) {
    try {
      return JSON.parse(direct.slice(first, last + 1))
    } catch {
      // ignore
    }
  }

  return null
}

function stringOrNull(value: unknown) {
  const text = String(value ?? '').trim()
  return text || null
}

function sanitizeWarnings(rawWarnings: unknown, fallback: PlanningWarning[]) {
  if (!Array.isArray(rawWarnings)) return fallback
  const out: PlanningWarning[] = []
  for (const item of rawWarnings) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const levelRaw = String(row.level || '').toLowerCase()
    const level = levelRaw === 'critical' || levelRaw === 'warning' ? levelRaw : 'info'
    const message = stringOrNull(row.message)
    if (!message) continue
    const related = Array.isArray(row.relatedOrderIds)
      ? row.relatedOrderIds.map((v) => String(v)).filter(Boolean)
      : []
    out.push({ level, message, relatedOrderIds: related })
  }
  return out.length ? out : fallback
}

function mergeAiReasonsIntoRoutes(
  deterministicRoutes: SuggestedRoute[],
  aiRoutesRaw: unknown,
  validWorkerIds: Set<string>,
  validOrderIds: Set<string>
) {
  if (!Array.isArray(aiRoutesRaw)) return deterministicRoutes

  const reasoningByKey = new Map<string, string>()
  const reasonByStop = new Map<string, string>()

  for (const route of aiRoutesRaw) {
    if (!route || typeof route !== 'object') continue
    const row = route as Record<string, unknown>
    const workerId = String(row.workerId || '').trim()
    const date = String(row.date || '').trim()
    const routeReasoning = stringOrNull(row.routeReasoning)
    if (workerId && date && validWorkerIds.has(workerId) && routeReasoning) {
      reasoningByKey.set(`${workerId}__${date}`, routeReasoning)
    }
    const stops = Array.isArray(row.route) ? row.route : []
    for (const stop of stops) {
      if (!stop || typeof stop !== 'object') continue
      const stopRow = stop as Record<string, unknown>
      const orderId = String(stopRow.orderId || '').trim()
      const reason = stringOrNull(stopRow.reason)
      if (orderId && reason && validOrderIds.has(orderId)) {
        reasonByStop.set(orderId, reason)
      }
    }
  }

  return deterministicRoutes.map((route) => {
    const key = `${route.workerId}__${route.date}`
    const routeReasoning = reasoningByKey.get(key) || route.routeReasoning
    const stops = route.route.map((stop) => ({
      ...stop,
      reason: reasonByStop.get(stop.orderId) || stop.reason,
    }))
    return { ...route, routeReasoning, route: stops }
  })
}

function mergeAiReasonsIntoChanges(
  deterministicChanges: RecommendedChange[],
  aiChangesRaw: unknown,
  validOrderIds: Set<string>
) {
  if (!Array.isArray(aiChangesRaw)) return deterministicChanges
  const aiByKey = new Map<string, string>()
  for (const item of aiChangesRaw) {
    if (!item || typeof item !== 'object') continue
    const row = item as Record<string, unknown>
    const orderId = String(row.orderId || '').trim()
    const type = String(row.type || '').trim().toLowerCase()
    const reason = stringOrNull(row.reason)
    if (!orderId || !reason || !validOrderIds.has(orderId)) continue
    if (!['assign', 'reorder', 'reschedule', 'warning'].includes(type)) continue
    aiByKey.set(`${type}__${orderId}`, reason)
  }
  return deterministicChanges.map((change) => ({
    ...change,
    reason: aiByKey.get(`${change.type}__${change.orderId}`) || change.reason,
  }))
}

function buildPrompt({ scope, baseDateIso, deterministic }: BuildAiParams) {
  const compactContext = {
    scope,
    baseDate: baseDateIso,
    range: deterministic.range,
    totals: {
      orders: deterministic.meta.ordersConsidered,
      workers: deterministic.meta.workersConsidered,
      routes: deterministic.suggestedRoutes.length,
      changes: deterministic.recommendedChanges.length,
      warnings: deterministic.warnings.length,
      missingData: deterministic.missingData.length,
      travelModel: deterministic.meta.approximateTravelModel,
    },
    suggestedRoutes: deterministic.suggestedRoutes.map((r) => ({
      workerId: r.workerId,
      workerName: r.workerName,
      date: r.date,
      estimatedServiceMinutes: r.estimatedServiceMinutes,
      estimatedTravelMinutes: r.estimatedTravelMinutes,
      estimatedTotalMinutes: r.estimatedTotalMinutes,
      freeMinutes: r.freeMinutes,
      overloadMinutes: r.overloadMinutes,
      route: r.route.map((s) => ({
        orderId: s.orderId,
        orderCode: s.orderCode,
        clientName: s.clientName,
        locality: s.locality,
        suggestedStartTime: s.suggestedStartTime,
        estimatedDurationMinutes: s.estimatedDurationMinutes,
        fixedTime: s.fixedTime,
      })),
    })),
    recommendedChanges: deterministic.recommendedChanges,
    warnings: deterministic.warnings,
    missingData: deterministic.missingData,
  }

  const system =
    'Eres un asistente experto en planificacion operativa, rutas tecnicas y organizacion de equipos. ' +
    'Recibiras datos estructurados y debes responder SOLO JSON valido. ' +
    'No inventes ordenes, trabajadores, ubicaciones, duraciones ni restricciones.'

  const user =
    'Tarea: mejorar la explicacion de la planificacion sugerida sin inventar datos.\n' +
    'Reglas:\n' +
    '- No crear IDs inexistentes.\n' +
    '- Si faltan coordenadas o duraciones, adviertelo.\n' +
    '- Usa los mismos orderId/workerId existentes.\n' +
    '- Devuelve JSON con este formato:\n' +
    '{\n' +
    '  "summary": "...",\n' +
    '  "planningScope": "day|week|month",\n' +
    '  "suggestedRoutes": [\n' +
    '    {\n' +
    '      "workerId": "...",\n' +
    '      "date": "YYYY-MM-DD",\n' +
    '      "routeReasoning": "...",\n' +
    '      "route": [\n' +
    '        { "orderId": "...", "reason": "..." }\n' +
    '      ]\n' +
    '    }\n' +
    '  ],\n' +
    '  "recommendedChanges": [\n' +
    '    { "type": "assign|reorder|reschedule|warning", "orderId": "...", "reason": "..." }\n' +
    '  ],\n' +
    '  "warnings": [\n' +
    '    { "level": "info|warning|critical", "message": "...", "relatedOrderIds": ["..."] }\n' +
    '  ]\n' +
    '}\n' +
    `Datos:\n${JSON.stringify(compactContext)}`

  return { system, user }
}

async function callGroq(system: string, user: string) {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    return { ok: false as const, error: 'GROQ_API_KEY no configurada.' }
  }

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      temperature: 0.1,
      max_tokens: 1600,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    return {
      ok: false as const,
      error: String((data as { error?: { message?: string } }).error?.message || `Groq error ${response.status}`),
    }
  }
  const content = String((data as { choices?: Array<{ message?: { content?: string } }> }).choices?.[0]?.message?.content || '')
  return { ok: true as const, content }
}

export async function enrichPlanningWithAi(params: BuildAiParams): Promise<{
  finalSuggestion: FinalPlanningSuggestion
  aiPayload: Record<string, unknown> | null
  aiError: string | null
}> {
  const deterministic = params.deterministic

  const fallback: FinalPlanningSuggestion = {
    summary: deterministic.summary,
    planningScope: deterministic.planningScope,
    suggestedRoutes: deterministic.suggestedRoutes,
    recommendedChanges: deterministic.recommendedChanges,
    warnings: deterministic.warnings,
    missingData: deterministic.missingData,
    aiSummary: null,
  }

  const prompt = buildPrompt(params)
  const aiRes = await callGroq(prompt.system, prompt.user)
  if (!aiRes.ok) {
    return { finalSuggestion: fallback, aiPayload: null, aiError: aiRes.error }
  }

  const parsed = tryParseJson(aiRes.content) as AiRawResponse | null
  if (!parsed || typeof parsed !== 'object') {
    return {
      finalSuggestion: fallback,
      aiPayload: { rawContent: aiRes.content },
      aiError: 'La respuesta de IA no vino en JSON valido.',
    }
  }

  const validWorkerIds = new Set(deterministic.suggestedRoutes.map((r) => r.workerId))
  const validOrderIds = new Set(
    deterministic.suggestedRoutes.flatMap((r) => r.route.map((s) => s.orderId))
  )

  const summary = stringOrNull(parsed.summary) || deterministic.summary
  const scopeRaw = String(parsed.planningScope || '').toLowerCase()
  const planningScope: PlanningScope =
    scopeRaw === 'week' || scopeRaw === 'month' || scopeRaw === 'day'
      ? scopeRaw
      : deterministic.planningScope

  const suggestedRoutes = mergeAiReasonsIntoRoutes(
    deterministic.suggestedRoutes,
    parsed.suggestedRoutes,
    validWorkerIds,
    validOrderIds
  )
  const recommendedChanges = mergeAiReasonsIntoChanges(
    deterministic.recommendedChanges,
    parsed.recommendedChanges,
    validOrderIds
  )
  const warnings = sanitizeWarnings(parsed.warnings, deterministic.warnings)

  const finalSuggestion: FinalPlanningSuggestion = {
    summary,
    planningScope,
    suggestedRoutes,
    recommendedChanges,
    warnings,
    missingData: deterministic.missingData,
    aiSummary: stringOrNull(parsed.summary),
  }

  return {
    finalSuggestion,
    aiPayload: parsed as Record<string, unknown>,
    aiError: null,
  }
}

