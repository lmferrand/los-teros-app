'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export type PlanificacionDataState = {
  ordenes: any[]
  clientes: any[]
  tecnicos: any[]
  presupuestos: any[]
  userId: string
  miRol: string
  loading: boolean
  esAdminOOficina: boolean
  refresh: () => Promise<void>
}

export function usePlanificacionData(): PlanificacionDataState {
  const [ordenes, setOrdenes] = useState<any[]>([])
  const [clientes, setClientes] = useState<any[]>([])
  const [tecnicos, setTecnicos] = useState<any[]>([])
  const [presupuestos, setPresupuestos] = useState<any[]>([])
  const [userId, setUserId] = useState<string>('')
  const [miRol, setMiRol] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  const refresh = useCallback(async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        router.push('/login')
        return
      }

      setUserId(session.user.id)

      const { data: perfilUsuario } = await supabase
        .from('perfiles')
        .select('rol')
        .eq('id', session.user.id)
        .single()

      if (perfilUsuario) setMiRol(perfilUsuario.rol)

      const [ords, clis, tecs, pres] = await Promise.all([
        supabase
          .from('ordenes')
          .select('*, clientes(id, nombre, nombre_comercial, nombre_fiscal, cif, poblacion, direccion)')
          .neq('estado', 'cancelada'),
        supabase.from('clientes').select('*'),
        supabase.from('perfiles').select('*'),
        supabase.from('presupuestos').select('*, clientes(nombre)').order('created_at', { ascending: false }),
      ])

      if (ords.data) setOrdenes(ords.data)
      if (clis.data) setClientes(clis.data)
      if (tecs.data) setTecnicos(tecs.data)
      if (pres.data) setPresupuestos(pres.data)
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return {
    ordenes,
    clientes,
    tecnicos,
    presupuestos,
    userId,
    miRol,
    loading,
    esAdminOOficina: miRol === 'gerente' || miRol === 'oficina',
    refresh,
  }
}
