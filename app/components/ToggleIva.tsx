'use client'

import { useVistaIva } from '@/lib/iva-vista'

// Conmutador global "con IVA / sin IVA" para los importes mostrados.
export default function ToggleIva({ compacto = false }: { compacto?: boolean }) {
  const { conIva, toggle } = useVistaIva()
  return (
    <button
      onClick={toggle}
      title="Cambiar vista de importes"
      className="inline-flex items-center rounded-full p-0.5 text-xs font-semibold select-none"
      style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)' }}
    >
      <span
        className="px-2.5 py-1 rounded-full transition-colors"
        style={{
          background: !conIva ? 'var(--bg-card)' : 'transparent',
          color: !conIva ? 'var(--brand-1)' : 'var(--text-subtle)',
          boxShadow: !conIva ? 'var(--shadow-sm)' : 'none',
        }}
      >
        Sin IVA
      </span>
      <span
        className="px-2.5 py-1 rounded-full transition-colors"
        style={{
          background: conIva ? 'var(--bg-card)' : 'transparent',
          color: conIva ? 'var(--brand-1)' : 'var(--text-subtle)',
          boxShadow: conIva ? 'var(--shadow-sm)' : 'none',
        }}
      >
        {compacto ? 'IVA' : 'Con IVA'}
      </span>
    </button>
  )
}
