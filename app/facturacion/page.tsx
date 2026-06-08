'use client'

import { EstadoVacio } from '@/app/components/ui'

export default function FacturacionPage() {
  return (
    <div>
      <h1 className="titulo-hero mb-4" style={{ color: 'var(--text)' }}>Facturación prevista</h1>
      <EstadoVacio titulo="Próximamente (Fase 4)" texto="Vista de facturación prevista por mes: venta vs cobro vs ejecución vs facturación." />
    </div>
  )
}
