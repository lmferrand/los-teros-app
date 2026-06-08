'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      router.replace(data.user ? '/dashboard' : '/login')
    })
  }, [router])

  return (
    <div className="min-h-screen grid place-items-center">
      <div
        className="rounded-full animate-spin"
        style={{ width: 36, height: 36, border: '3px solid var(--border)', borderTopColor: 'var(--brand-1)' }}
      />
    </div>
  )
}
