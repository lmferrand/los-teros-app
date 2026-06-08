'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { obtenerVenta } from '@/lib/db/ventas'
import type { Venta } from '@/lib/tipos'
import FormularioPresupuesto from '../../FormularioPresupuesto'
import { SkeletonLista } from '@/app/components/ui'

export default function EditarPresupuestoPage() {
  const params = useParams<{ id: string }>()
  const id = params.id
  const [venta, setVenta] = useState<Venta | null>(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let activo = true
    obtenerVenta(id).then((v) => { if (activo) { setVenta(v); setCargando(false) } })
    return () => { activo = false }
  }, [id])

  if (cargando) return <SkeletonLista filas={3} />
  if (!venta) return <div className="card p-6 text-sm" style={{ color: 'var(--text-muted)' }}>No se encontró el presupuesto.</div>
  return <FormularioPresupuesto venta={venta} />
}
