'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { s } from '@/lib/styles'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)

  // Si ya hay sesión, ir directo al dashboard.
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) router.replace('/dashboard')
    })
  }, [router])

  async function entrar(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setCargando(true)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setCargando(false)
    if (error) {
      setError('Email o contraseña incorrectos.')
      return
    }
    router.replace('/dashboard')
  }

  return (
    <div className="min-h-screen grid place-items-center px-4" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-sm animar-entrada">
        {/* Marca */}
        <div className="text-center mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Los Teros" className="mx-auto mb-2" style={{ width: 140, height: 'auto' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Gestión de empresa
          </p>
        </div>

        {/* Tarjeta de acceso */}
        <form onSubmit={entrar} className="card p-6 flex flex-col gap-4">
          <div>
            <label className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Email</label>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ ...s.inputStyle, marginTop: 6 }}
              placeholder="tu@correo.com"
            />
          </div>
          <div>
            <label className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Contraseña</label>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ ...s.inputStyle, marginTop: 6 }}
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="text-sm rounded-xl px-3 py-2" style={{ background: 'color-mix(in srgb, var(--red) 12%, transparent)', color: 'var(--red)' }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={cargando}
            style={{ ...s.btnPrimary, opacity: cargando ? 0.7 : 1, width: '100%', padding: '12px' }}
          >
            {cargando ? 'Entrando…' : 'Entrar'}
          </button>
        </form>

        <p className="text-center text-xs mt-6" style={{ color: 'var(--text-subtle)' }}>
          Acceso interno — Extracciones Teros
        </p>
      </div>
    </div>
  )
}
