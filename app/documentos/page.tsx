'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { extractorActivo, type CampoExtraido, type Confianza } from '@/lib/ia/extractor'
import { crearVenta } from '@/lib/db/ventas'
import { derivarIva } from '@/lib/calculos'
import { TIPOS_TRABAJO } from '@/lib/dominio'
import type { VentaInput } from '@/lib/tipos'

type Fase = 'subir' | 'analizando' | 'revision'

const COLOR_CONF: Record<Confianza, string> = {
  alta: 'var(--green)',
  media: 'var(--amber)',
  baja: 'var(--red)',
}
const LABEL_CONF: Record<Confianza, string> = { alta: 'Alta', media: 'Media', baja: 'Baja' }

export default function DocumentosPage() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [fase, setFase] = useState<Fase>('subir')
  const [campos, setCampos] = useState<CampoExtraido[]>([])
  const [resumen, setResumen] = useState('')
  const [nombreArchivo, setNombreArchivo] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  async function analizar(file: File) {
    setError('')
    setNombreArchivo(file.name)
    setFase('analizando')
    try {
      const ex = await extractorActivo.extraer(file)
      setCampos(ex.campos)
      setResumen(ex.resumen || '')
      setFase('revision')
    } catch {
      setError('No se pudo analizar el documento.')
      setFase('subir')
    }
  }

  function editar(clave: string, valor: string) {
    setCampos((prev) => prev.map((c) => (c.clave === clave ? { ...c, valor, confianza: 'alta' } : c)))
  }
  function descartarCampo(clave: string) {
    setCampos((prev) => prev.filter((c) => c.clave !== clave))
  }

  async function crear() {
    setGuardando(true)
    setError('')
    try {
      const payload: VentaInput = { estado: 'presupuesto_aceptado' }
      let base = 0, ivaPct = 21
      const infos: string[] = []
      for (const c of campos) {
        if (c.tipo === 'info' || !c.mapeaAVenta) {
          if (c.valor) infos.push(`${c.label}: ${c.valor}`)
          continue
        }
        if (c.clave === 'base_imponible') { base = Number(c.valor) || 0; continue }
        if (c.clave === 'iva_porcentaje') { ivaPct = Number(c.valor) || 21; continue }
        ;(payload as any)[c.clave] = c.valor || null
      }
      const { ivaImporte, totalConIva } = derivarIva(base, ivaPct)
      payload.base_imponible = base
      payload.iva_porcentaje = ivaPct
      payload.iva_importe = ivaImporte
      payload.total_con_iva = totalConIva
      if (infos.length) payload.observaciones = infos.join('\n')
      const { data } = await supabase.auth.getUser()
      payload.creado_por = data.user?.id ?? null

      const venta = await crearVenta(payload)
      router.push(`/presupuestos/${venta.id}`)
    } catch (e: any) {
      setError(e.message || 'Error al crear el presupuesto')
      setGuardando(false)
    }
  }

  return (
    <div>
      <header className="mb-5">
        <h1 className="titulo-hero" style={{ color: 'var(--text)' }}>Documentos IA</h1>
        <p className="mt-1" style={{ color: 'var(--text-muted)' }}>
          Sube un presupuesto, condiciones o justificante; la IA extrae los datos para revisarlos.
        </p>
      </header>

      {error && <div className="card p-3 mb-4 text-sm" style={{ color: 'var(--red)' }}>{error}</div>}

      {fase === 'subir' && (
        <button
          onClick={() => inputRef.current?.click()}
          className="card w-full p-10 flex flex-col items-center gap-3 border-dashed"
          style={{ borderWidth: 2, borderColor: 'var(--border-strong)' }}
        >
          <div className="grid place-items-center rounded-2xl marca-gradiente" style={{ width: 56, height: 56 }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 16V4m0 0 4 4m-4-4L8 8M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
            </svg>
          </div>
          <div className="font-semibold" style={{ color: 'var(--text)' }}>Sube un documento</div>
          <div className="text-sm" style={{ color: 'var(--text-muted)' }}>PDF o imagen del presupuesto aceptado</div>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,image/*"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) analizar(f) }}
          />
        </button>
      )}

      {fase === 'analizando' && (
        <div className="card p-10 flex flex-col items-center gap-4">
          <div className="rounded-full animate-spin" style={{ width: 40, height: 40, border: '3px solid var(--border)', borderTopColor: 'var(--brand-1)' }} />
          <div className="font-semibold" style={{ color: 'var(--text)' }}>Analizando documento…</div>
          <div className="text-sm" style={{ color: 'var(--text-subtle)' }}>{nombreArchivo}</div>
        </div>
      )}

      {fase === 'revision' && (
        <div className="flex flex-col gap-4">
          <div className="card p-4 text-sm flex items-start gap-3" style={{ background: 'color-mix(in srgb, var(--brand-1) 6%, var(--bg-card))' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--brand-1)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4m0-4h.01" /></svg>
            <span style={{ color: 'var(--text-muted)' }}>{resumen}</span>
          </div>

          <div className="card p-5">
            <h2 className="font-semibold mb-4" style={{ color: 'var(--text)' }}>Revisar datos extraídos</h2>
            <div className="flex flex-col gap-3">
              {campos.map((c) => (
                <div key={c.clave} className="flex flex-col gap-1 rounded-xl p-3" style={{ background: c.confianza === 'baja' ? 'color-mix(in srgb, var(--red) 7%, var(--bg))' : 'var(--bg)', border: `1px solid ${c.confianza === 'baja' ? 'var(--red)' : 'var(--border)'}` }}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium" style={{ color: 'var(--text-subtle)' }}>{c.label}</span>
                    <span className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold" style={{ color: COLOR_CONF[c.confianza] }}>
                        <span className="inline-block rounded-full" style={{ width: 6, height: 6, background: COLOR_CONF[c.confianza] }} />
                        {LABEL_CONF[c.confianza]}
                      </span>
                      <button onClick={() => descartarCampo(c.clave)} title="Descartar" className="text-[11px]" style={{ color: 'var(--text-subtle)' }}>✕</button>
                    </span>
                  </div>
                  {c.tipo === 'tipo_trabajo' ? (
                    <select value={c.valor} onChange={(e) => editar(c.clave, e.target.value)} style={inpEstilo}>
                      {TIPOS_TRABAJO.map((t) => <option key={t.valor} value={t.valor}>{t.label}</option>)}
                    </select>
                  ) : (
                    <input
                      type={c.tipo === 'fecha' ? 'date' : c.tipo === 'numero' ? 'number' : 'text'}
                      value={c.valor}
                      onChange={(e) => editar(c.clave, e.target.value)}
                      style={inpEstilo}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3 justify-end">
            <button onClick={() => { setFase('subir'); setCampos([]) }} className="rounded-xl px-4 py-2.5 font-semibold" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text)' }}>
              Descartar
            </button>
            <button onClick={crear} disabled={guardando} className="marca-gradiente rounded-xl px-5 py-2.5 font-semibold text-white" style={{ opacity: guardando ? 0.7 : 1 }}>
              {guardando ? 'Creando…' : 'Crear presupuesto'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const inpEstilo: React.CSSProperties = {
  background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text)',
  borderRadius: 10, padding: '8px 10px', fontSize: '0.9rem', width: '100%',
}
