'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { s } from '@/lib/styles'
import Image from 'next/image'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [animacionLista, setAnimacionLista] = useState(false)
  const router = useRouter()

  useEffect(() => {
    setTimeout(() => setAnimacionLista(true), 100)
  }, [])

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
        @keyframes volarDesdeIzquierda {
          0% {
            transform: translateX(-300px) translateY(60px) rotate(-20deg) scale(0.3);
            opacity: 0;
            filter: blur(8px);
          }
          40% {
            opacity: 1;
            filter: blur(0px);
          }
          70% {
            transform: translateX(20px) translateY(-10px) rotate(5deg) scale(1.1);
          }
          85% {
            transform: translateX(-8px) translateY(4px) rotate(-2deg) scale(0.97);
          }
          100% {
            transform: translateX(0) translateY(0) rotate(0deg) scale(1);
            opacity: 1;
          }
        }

        @keyframes escudoAparece {
          0% {
            transform: scale(0.5) translateY(40px);
            opacity: 0;
            filter: blur(20px);
          }
          60% {
            transform: scale(1.05) translateY(-5px);
            opacity: 1;
            filter: blur(0px);
          }
          100% {
            transform: scale(1) translateY(0);
            opacity: 1;
          }
        }

        @keyframes brilloEscudo {
          0% { box-shadow: 0 0 0px rgba(6,182,212,0); }
          50% { box-shadow: 0 0 60px rgba(6,182,212,0.6), 0 0 120px rgba(124,58,237,0.3); }
          100% { box-shadow: 0 0 30px rgba(6,182,212,0.2), 0 0 60px rgba(124,58,237,0.1); }
        }

        @keyframes textoAparece {
          0% {
            opacity: 0;
            letter-spacing: 0.5em;
            transform: translateY(10px);
          }
          100% {
            opacity: 1;
            letter-spacing: 0.15em;
            transform: translateY(0);
          }
        }

        @keyframes subtextoAparece {
          0% { opacity: 0; transform: translateY(5px); }
          100% { opacity: 1; transform: translateY(0); }
        }

        @keyframes formAparece {
          0% { opacity: 0; transform: translateY(20px); }
          100% { opacity: 1; transform: translateY(0); }
        }

        @keyframes lineaGradiente {
          0% { width: 0%; opacity: 0; }
          100% { width: 60%; opacity: 1; }
        }

        .logo-animado {
          animation: volarDesdeIzquierda 1.2s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
          opacity: 0;
        }

        .escudo-contenedor {
          animation: escudoAparece 0.8s ease-out forwards, brilloEscudo 1.5s ease-in-out 0.8s forwards;
          opacity: 0;
        }

        .texto-principal {
          animation: textoAparece 0.8s ease-out 1.4s forwards;
          opacity: 0;
        }

        .texto-secundario {
          animation: subtextoAparece 0.6s ease-out 1.8s forwards;
          opacity: 0;
        }

        .linea-decorativa {
          animation: lineaGradiente 0.8s ease-out 1.6s forwards;
          opacity: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, #06b6d4, #7c3aed, transparent);
          margin: 0 auto;
        }

        .form-animado {
          animation: formAparece 0.8s ease-out 2s forwards;
          opacity: 0;
        }
      `}</style>

      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="flex justify-center mb-6">
            <div className="escudo-contenedor relative" style={{ borderRadius: '50%' }}>
              <div className="logo-animado" style={{ animationDelay: '0.2s' }}>
                <Image
                  src="/logo.png"
                  alt="Los Teros"
                  width={140}
                  height={140}
                  className="object-contain"
                  priority
                />
              </div>
            </div>
          </div>

          <h1 className="texto-principal text-3xl font-black tracking-widest uppercase mb-2"
            style={{ color: '#ffffff', letterSpacing: '0.15em' }}>
            LOS TEROS
          </h1>

          <div className="linea-decorativa mb-3"></div>

          <p className="texto-secundario text-sm font-medium tracking-widest uppercase"
            style={{ color: '#06b6d4', letterSpacing: '0.25em' }}>
            Gestion Operativa
          </p>
        </div>

        <div className="form-animado rounded-2xl p-8"
          style={{ background: 'rgba(13,17,23,0.9)', border: '1px solid #1e2d3d', backdropFilter: 'blur(10px)' }}>
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: '#475569' }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all"
                style={{ background: '#080b14', border: '1px solid #1e2d3d', color: 'white' }}
                onFocus={e => {
                  e.target.style.borderColor = '#7c3aed'
                  e.target.style.boxShadow = '0 0 0 3px rgba(124,58,237,0.1)'
                }}
                onBlur={e => {
                  e.target.style.borderColor = '#1e2d3d'
                  e.target.style.boxShadow = 'none'
                }}
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
                className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all"
                style={{ background: '#080b14', border: '1px solid #1e2d3d', color: 'white' }}
                onFocus={e => {
                  e.target.style.borderColor = '#7c3aed'
                  e.target.style.boxShadow = '0 0 0 3px rgba(124,58,237,0.1)'
                }}
                onBlur={e => {
                  e.target.style.borderColor = '#1e2d3d'
                  e.target.style.boxShadow = 'none'
                }}
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
              className="w-full py-3 rounded-xl font-semibold text-sm transition-all disabled:opacity-50 relative overflow-hidden"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #06b6d4)', color: 'white' }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  Entrando...
                </span>
              ) : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}