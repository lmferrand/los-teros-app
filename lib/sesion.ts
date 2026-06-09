'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
import { supabase } from './supabase'

export interface Perfil {
  id: string
  nombre: string | null
  rol: string | null
  permisos_modulos?: Record<string, boolean> | null
}

interface EstadoSesion {
  user: User | null
  perfil: Perfil | null
  cargando: boolean
}

// Auth por página (sin middleware). Úsalo al inicio de cada página privada:
//   const { user, perfil, cargando } = useSesion()
// Si no hay sesión, redirige a /login.
export function useSesion(): EstadoSesion {
  const router = useRouter()
  const [estado, setEstado] = useState<EstadoSesion>({
    user: null,
    perfil: null,
    cargando: true,
  })

  useEffect(() => {
    let activo = true

    async function cargar() {
      const { data } = await supabase.auth.getUser()
      const user = data.user
      if (!activo) return

      if (!user) {
        router.replace('/login')
        setEstado({ user: null, perfil: null, cargando: false })
        return
      }

      let perfil: Perfil | null = null
      const { data: filaPerfil } = await (supabase.from('perfiles') as any)
        .select('id, nombre, rol, permisos_modulos')
        .eq('id', user.id)
        .maybeSingle()
      if (filaPerfil) perfil = filaPerfil as Perfil

      if (!activo) return
      setEstado({ user, perfil, cargando: false })
    }

    cargar()
    return () => {
      activo = false
    }
  }, [router])

  return estado
}

export async function cerrarSesion() {
  await supabase.auth.signOut()
}
