'use client'

import { useAyuda, AYUDA } from '@/lib/ayuda'

// Tarjeta de ayuda de la pantalla actual (se muestra solo si la ayuda está activa).
export default function AyudaContextual({ modulo }: { modulo: string }) {
  const { activa, setActiva } = useAyuda()
  if (!activa) return null
  const a = AYUDA[modulo]
  if (!a) return null
  return (
    <div className="card p-4 mb-4 animar-entrada" style={{ background: 'color-mix(in srgb, var(--brand-1) 7%, var(--bg-card))', border: '1px solid color-mix(in srgb, var(--brand-1) 30%, var(--border))' }}>
      <div className="flex items-start gap-3">
        <span className="grid place-items-center rounded-xl shrink-0" style={{ width: 36, height: 36, background: 'color-mix(in srgb, var(--brand-1) 16%, transparent)' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--brand-1)" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01" /></svg>
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-semibold" style={{ color: 'var(--text)' }}>{a.titulo} — ¿para qué sirve?</div>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>{a.que}</p>
          <ol className="mt-2 flex flex-col gap-1">
            {a.pasos.map((p, i) => (
              <li key={i} className="text-sm flex items-start gap-2" style={{ color: 'var(--text)' }}>
                <span className="grid place-items-center rounded-full shrink-0 text-[10px] font-bold mt-0.5" style={{ width: 18, height: 18, background: 'var(--brand-1)', color: 'white' }}>{i + 1}</span>
                <span style={{ color: 'var(--text-muted)' }}>{p}</span>
              </li>
            ))}
          </ol>
        </div>
        <button onClick={() => setActiva(false)} className="text-xs font-semibold shrink-0" style={{ color: 'var(--text-subtle)' }}>Ocultar</button>
      </div>
    </div>
  )
}
