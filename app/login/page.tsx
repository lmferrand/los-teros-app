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
      <style>{`
        @keyframes renacer {
          0% {
            opacity: 0;
            transform: scale(0.6);
            filter: blur(30px) brightness(3);
          }
          30% {
            opacity: 0.8;
            filter: blur(10px) brightness(2);
          }
          60% {
            opacity: 1;
            transform: scale(1.04);
            filter: blur(2px) brightness(1.3);
          }
          80% {
            transform: scale(0.98);
            filter: blur(0px) brightness(1);
          }
          100% {
            opacity: 1;
            transform: scale(1);
            filter: blur(0px) brightness(1);
          }
        }

        @keyframes aura {
          0% {
            opacity: 0;
            transform: scale(0.5);
          }
          40% {
            opacity: 0.6;
            transform: scale(1.4);
          }
          100% {
            opacity: 0;
            transform: scale(2.2);
          }
        }

        @keyframes aura2 {
          0% {
            opacity: 0;
            transform: scale(0.5);
          }
          20% {
            opacity: 0;
          }
          50% {
            opacity: 0.4;
            transform: scale(1.6);
          }
          100% {
            opacity: 0;
            transform: scale(2.5);
          }
        }

        @keyframes textoRenacer {
          0% {
            opacity: 0;
            transform: translateY(8px);
            letter-spacing: 0.5em;
            filter: blur(8px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
            letter-spacing: 0.2em;
            filter: blur(0px);
          }
        }

        @keyframes lineaRenacer {
          0% { width: 0; opacity: 0; }
          100% { width: 50%; opacity: 1; }
        }

        @keyframes formRenacer {
          0% { opacity: 0; transform: translateY(16px); filter: blur(4px); }
          100% { opacity: 1; transform: translateY(0); filter: blur(0); }
        }

        @keyframes particula {
          0% { opacity: 0; transform: translateY(0) scale(0); }
          20% { opacity: 1; }
          100% { opacity: 0; transform: translateY(-80px) scale(1.5); }
        }

        .logo-renacer {
          animation: renacer 2s cubic-bezier(0.16, 1, 0.3, 1) 0.2s both;
        }

        .aura-1 {
          position: absolute;
          inset: -20px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(6,182,212,0.4) 0%, transparent 70%);
          animation: aura 2s ease-out 0.2s both;
          pointer-events: none;
        }

        .aura-2 {
          position: absolute;
          inset: -20px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(124,58,237,0.3) 0%, transparent 70%);
          animation: aura2 2.5s ease-out 0.4s both;
          pointer-events: none;
        }

        .texto-titulo {
          animation: textoRenacer 1s ease-out 1.6s both;
        }

        .linea-deco {
          animation: lineaRenacer 0.8s ease-out 2s both;
          height: 1px;
          background: linear-gradient(90deg, transparent, #06b6d4, #7c3aed, transparent);
          margin: 0 auto;
        }

        .texto-sub {
          animation: textoRenacer 0.8s ease-out 2.1s both;
        }

        .form-entrada {
          animation: formRenacer 0.9s ease-out 2.4s both;
        }

        .particula {
          position: absolute;
          width: 3px;
          height: 3px;
          border-radius: 50%;
          background: #06b6d4;
          pointer-events: none;
        }

        .p1 { left: 45%; top: 60%; animation: particula 1.8s ease-out 0.8s both; }
        .p2 { left: 55%; top: 65%; animation: particula 2s ease-out 1s both; background: #7c3aed; }
        .p3 { left: 40%; top: 55%; animation: particula 1.6s ease-out 1.1s both; }
        .p4 { left: 60%; top: 60%; animation: particula 2.2s ease-out 0.9s both; background: #a78bfa; }
        .p5 { left: 50%; top: 70%; animation: particula 1.9s ease-out 1.2s both; }
      `}</style>

      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="flex justify-center mb-8">
            <div className="relative" style={{ width: 160, height: 160 }}>
              <div className="aura-1"></div>
              <div className="aura-2"></div>
              <div className="particula p1"></div>
              <div className="particula p2"></div>
              <div className="particula p3"></div>
              <div className="particula p4"></div>
              <div className="particula p5"></div>
              <div className="logo-renacer w-full h-full flex items-center justify-center">
                <Image
                  src="/logo.png"
                  alt="Los Teros"
                  width={160}
                  height={160}
                  className="object-contain"
                  priority
                />
              </div>
            </div>
          </div>

          <h1 className="texto-titulo text-3xl font-black uppercase mb-3"
            style={{ color: '#ffffff', letterSpacing: '0.2em' }}>
            LOS TEROS
          </h1>

          <div className="linea-deco mb-4" style={{ width: '50%' }}></div>

          <p className="texto-sub text-xs font-semibold uppercase tracking-widest"
            style={{ color: '#06b6d4', letterSpacing: '0.3em' }}>
            Gestion Operativa
          </p>
        </div>

        <div className="form-entrada rounded-2xl p-8"
          style={{ background: 'rgba(13,17,23,0.95)', border: '1px solid #1e2d3d' }}>
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: '#475569' }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full rounded-xl px-4 py-3 text-sm outline-none"
                style={{ background: '#080b14', border: '1px solid #1e2d3d', color: 'white', transition: 'all 0.3s ease' }}
                onFocus={e => { e.target.style.borderColor = '#7c3aed'; e.target.style.boxShadow = '0 0 0 3px rgba(124,58,237,0.1)' }}
                onBlur={e => { e.target.style.borderColor = '#1e2d3d'; e.target.style.boxShadow = 'none' }}
                placeholder="tu@email.com"
                required
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: '#475569' }}>
                Contrasena
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full rounded-xl px-4 py-3 text-sm outline-none"
                style={{ background: '#080b14', border: '1px solid #1e2d3d', color: 'white', transition: 'all 0.3s ease' }}
                onFocus={e => { e.target.style.borderColor = '#7c3aed'; e.target.style.boxShadow = '0 0 0 3px rgba(124,58,237,0.1)' }}
                onBlur={e => { e.target.style.borderColor = '#1e2d3d'; e.target.style.boxShadow = 'none' }}
                placeholder="••••••••"
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
              style={{ background: 'linear-gradient(135deg, #7c3aed, #06b6d4)', color: 'white', transition: 'opacity 0.3s ease' }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  Entrando...
                </>
              ) : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
