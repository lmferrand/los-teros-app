'use client'

import { EstadoVacio } from '@/app/components/ui'

export default function DocumentosPage() {
  return (
    <div>
      <h1 className="titulo-hero mb-4" style={{ color: 'var(--text)' }}>Documentos IA</h1>
      <EstadoVacio titulo="Próximamente (Fase 5)" texto="Sube un PDF o imagen; la IA extraerá los datos del presupuesto para revisarlos y crearlo." />
    </div>
  )
}
