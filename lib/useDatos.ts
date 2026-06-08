'use client'

import { useEffect, useState } from 'react'
import { listarVentas } from './db/ventas'
import { listarTodosGastos } from './db/gastos'
import type { Gasto } from './tipos'
import { combinar, type VentaCalc } from './agregados'

interface Estado {
  datos: VentaCalc[]
  gastos: Gasto[]
  cargando: boolean
  error: string
}

// Carga ventas + gastos y los combina (con cálculos). Para las vistas de dirección.
export function useDatosFinancieros(): Estado {
  const [estado, setEstado] = useState<Estado>({ datos: [], gastos: [], cargando: true, error: '' })

  useEffect(() => {
    let activo = true
    Promise.all([listarVentas(), listarTodosGastos()])
      .then(([ventas, gastos]) => {
        if (!activo) return
        setEstado({ datos: combinar(ventas, gastos), gastos, cargando: false, error: '' })
      })
      .catch((e) => activo && setEstado({ datos: [], gastos: [], cargando: false, error: e.message || 'Error' }))
    return () => { activo = false }
  }, [])

  return estado
}
