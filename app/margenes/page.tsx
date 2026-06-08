'use client'

import { EstadoVacio } from '@/app/components/ui'

export default function MargenesPage() {
  return (
    <div>
      <h1 className="titulo-hero mb-4" style={{ color: 'var(--text)' }}>Márgenes</h1>
      <EstadoVacio titulo="Próximamente (Fase 4)" texto="Análisis de márgenes por presupuesto, cliente y tipo de trabajo, con semáforo." />
    </div>
  )
}
