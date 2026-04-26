'use client'

import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function AuthConfirm() {
  const router = useRouter()

  useEffect(() => {
    supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        if (event === 'SIGNED_IN') {
          router.push('/auth/set-password')
        } else {
          router.push('/dashboard')
        }
      }
    })
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#080b14' }}>
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-4"
          style={{ borderColor: '#7c3aed', borderTopColor: 'transparent' }}></div>
        <p className="text-sm" style={{ color: '#475569' }}>Verificando acceso...</p>
      </div>
    </div>
  )
}