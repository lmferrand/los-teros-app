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
  loadingSecundario: boolean
  esAdminOOficina: boolean
  refresh: (opts?: { silent?: boolean }) => Promise<void>
}

export function usePlanificacionData(): PlanificacionDataState {
  const [ordenes, setOrdenes] = useState<any[]>([])
  const [clientes, setClientes] = useState<any[]>([])
  const [tecnicos, setTecnicos] = useState<any[]>([])
  const [presupuestos, setPresupuestos] = useState<any[]>([])
  const [userId, setUserId] = useState<string>('')
  const [miRol, setMiRol] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [loadingSecundario, setLoadingSecundario] = useState(false)
  const router = useRouter()

  const refresh = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = Boolean(opts?.silent)
    if (!silent) setLoading(true)
    setLoadingSecundario(true)
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

      // Fase 1: datos críticos para render principal.
      const [ords, tecs] = await Promise.all([
        supabase
          .from('ordenes')
          .select('*, clientes(id, nombre, nombre_comercial, nombre_fiscal, cif, poblacion, direccion)')
          .neq('estado', 'cancelada'),
        supabase.from('perfiles').select('id, nombre, rol'),
      ])

      if (ords.data) setOrdenes(ords.data)
      if (tecs.data) setTecnicos(tecs.data)
      if (!silent) setLoading(false)

      // Fase 2: catálogos secundarios.
      const [clis, pres] = await Promise.all([
        supabase
          .from('clientes')
          .select('id, nombre, nombre_comercial, nombre_fiscal, cif, poblacion, direccion, telefono, movil, email, empresa, tipo_cliente'),
        supabase
          .from('presupuestos')
          .select('*, clientes(nombre, nombre_comercial)')
          .order('created_at', { ascending: false }),
      ])

      if (clis.data) setClientes(clis.data)
      if (pres.data) setPresupuestos(pres.data)
    } finally {
      setLoadingSecundario(false)
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
    loadingSecundario,
    esAdminOOficina: miRol === 'gerente' || miRol === 'oficina',
    refresh,
  }
}
