'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('Email o contrasena incorrectos')
      setLoading(false)
    } else {
      router.push('/dashboard')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#080b14' }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-5">
            <div className="relative">
              <div className="absolute inset-0 rounded-2xl blur-xl opacity-30" style={{ background: 'radial-gradient(circle, #7c3aed, #06b6d4)' }}></div>
              <Image
                src="/logo.png"
                alt="Los Teros"
                width={100}
                height={100}
                className="relative rounded-2xl"
                style={{ mixBlendMode: 'screen' }}
              />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">LOS TEROS</h1>
          <p className="text-sm" style={{ color: '#06b6d4' }}>Gestion Operativa</p>
        </div>

        <div className="rounded-2xl p-8" style={{ background: '#0d1117', border: '1px solid #1e2d3d' }}>
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: '#475569' }}>Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full rounded-xl px-4 py-3 text-white text-sm outline-none transition-all"
                style={{ background: '#080b14', border: '1px solid #1e2d3d' }}
                onFocus={e => e.target.style.borderColor = '#7c3aed'}
                onBlur={e => e.target.style.borderColor = '#1e2d3d'}
                placeholder="tu@email.com"
                required
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: '#475569' }}>Contrasena</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full rounded-xl px-4 py-3 text-white text-sm outline-none transition-all"
                style={{ background: '#080b14', border: '1px solid #1e2d3d' }}
                onFocus={e => e.target.style.borderColor = '#7c3aed'}
                onBlur={e => e.target.style.borderColor = '#1e2d3d'}
                placeholder="••••••••"
                required
              />
            </div>
            {error && (
              <div className="rounded-xl px-4 py-3 text-sm" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}>
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl text-white font-semibold text-sm transition-all disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #06b6d4)' }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}