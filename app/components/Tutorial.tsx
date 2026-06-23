'use client'

import { useState } from 'react'
import { TUTORIAL } from '@/lib/ayuda'

export default function Tutorial({ onCerrar }: { onCerrar: () => void }) {
  const [i, setI] = useState(0)
  const paso = TUTORIAL[i]
  const ultimo = i === TUTORIAL.length - 1

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={onCerrar}>
      <div className="w-full max-w-md rounded-2xl p-6 animar-entrada" style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-lg)' }} onClick={(e) => e.stopPropagation()}>
        <div className="text-5xl mb-3 text-center">{paso.emoji}</div>
        <h3 className="text-xl font-bold text-center" style={{ color: 'var(--text)' }}>{paso.titulo}</h3>
        <p className="text-sm text-center mt-2" style={{ color: 'var(--text-muted)' }}>{paso.texto}</p>

        <div className="flex justify-center gap-1.5 my-5">
          {TUTORIAL.map((_, idx) => (
            <button key={idx} onClick={() => setI(idx)} className="rounded-full transition-all" style={{ width: idx === i ? 20 : 7, height: 7, background: idx === i ? 'var(--brand-1)' : 'var(--border-strong)' }} />
          ))}
        </div>

        <div className="flex items-center justify-between gap-3">
          <button onClick={onCerrar} className="text-sm font-semibold" style={{ color: 'var(--text-subtle)' }}>Saltar</button>
          <div className="flex gap-2">
            {i > 0 && <button onClick={() => setI(i - 1)} className="rounded-xl px-4 py-2 font-semibold text-sm" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}>Anterior</button>}
            <button onClick={() => (ultimo ? onCerrar() : setI(i + 1))} className="marca-gradiente rounded-xl px-5 py-2 font-semibold text-sm text-white">{ultimo ? '¡Listo!' : 'Siguiente'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
