'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

export default function SetPassword() {
  const [password, setPassword] = useState('')
  const [confirmar, setConfirmar] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sesionLista, setSesionLista] = useState(false)
  const router = useRouter()

  useEffect(() => {
    supabase.auth.onAuthStateChange((event, session) => {
      if (session) setSesionLista(true)
    })
  }, [])

  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirmar) {
      setError('Las contraseñas no coinciden')
      return
    }
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres')
      return
    }
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setError('Error: ' + error.message)
      setLoading(false)
    } else {
      router.push('/dashboard')
    }
  }

  if (!sesionLista) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#080b14' }}>
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-4"
          style={{ borderColor: '#7c3aed', borderTopColor: 'transparent' }}></div>
        <p className="text-sm" style={{ color: '#475569' }}>Verificando acceso...</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#080b14' }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-5">
            <Image src="/logo.png" alt="Los Teros" width={80} height={80} className="object-contain" />
          </div>
          <h1 className="text-2xl font-bold mb-1" style={{ color: 'white' }}>Crear contraseña</h1>
          <p className="text-sm" style={{ color: '#475569' }}>Elige una contraseña para acceder a la app</p>
        </div>

        <div className="rounded-2xl p-8" style={{ background: '#0d1117', border: '1px solid #1e2d3d' }}>
          <form onSubmit={handleSetPassword} className="space-y-5">
            <div>
              <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: '#475569' }}>
                Nueva contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full rounded-xl px-4 py-3 text-sm outline-none"
                style={{ background: '#080b14', border: '1px solid #1e2d3d', color: 'white' }}
                onFocus={e => { e.target.style.borderColor = '#7c3aed'; e.target.style.boxShadow = '0 0 0 3px rgba(124,58,237,0.1)' }}
                onBlur={e => { e.target.style.borderColor = '#1e2d3d'; e.target.style.boxShadow = 'none' }}
                placeholder="Minimo 6 caracteres"
                required
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: '#475569' }}>
                Confirmar contraseña
              </label>
              <input
                type="password"
                value={confirmar}
                onChange={e => setConfirmar(e.target.value)}
                className="w-full rounded-xl px-4 py-3 text-sm outline-none"
                style={{ background: '#080b14', border: '1px solid #1e2d3d', color: 'white' }}
                onFocus={e => { e.target.style.borderColor = '#7c3aed'; e.target.style.boxShadow = '0 0 0 3px rgba(124,58,237,0.1)' }}
                onBlur={e => { e.target.style.borderColor = '#1e2d3d'; e.target.style.boxShadow = 'none' }}
                placeholder="Repite la contraseña"
                required
              />
            </div>
            {error && (
              <div className="rounded-xl px-4 py-3 text-sm"
                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}>
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #06b6d4)', color: 'white' }}>
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  Guardando...
                </>
              ) : 'Crear contraseña y entrar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}