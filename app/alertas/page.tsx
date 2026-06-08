'use client'

import { EstadoVacio } from '@/app/components/ui'

export default function AlertasPage() {
  return (
    <div>
      <h1 className="titulo-hero mb-4" style={{ color: 'var(--text)' }}>Alertas</h1>
      <EstadoVacio titulo="Próximamente (Fase 4)" texto="Avisos: margen bajo, sobrecoste, cobrado sin programar, terminado sin facturar, turbina sin devolver." />
    </div>
  )
}
