'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function Asistente() {
  const [mensajes, setMensajes] = useState<any[]>([
    {
      rol: 'asistente',
      texto: 'Hola, soy el asistente de Los Teros. Puedo ayudarte con informacion sobre ordenes, inventario, clientes y planificacion. Preguntame lo que necesites.'
    }
  ])
  const [input, setInput] = useState('')
  const [cargando, setCargando] = useState(false)
  const [contexto, setContexto] = useState('')
  const [perfil, setPerfil] = useState<any>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  async function verificarSesion() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }
    const { data } = await supabase.from('perfiles').select('*').eq('id', session.user.id).single()
    setPerfil(data)
  }

  async function cargarContexto() {
    const [ordenes, materiales, equipos, clientes] = await Promise.all([
      supabase.from('ordenes').select('codigo, tipo, estado, fecha_programada, descripcion').in('estado', ['pendiente', 'en_curso']).limit(20),
      supabase.from('materiales').select('nombre, stock, minimo, unidad').limit(30),
      supabase.from('equipos').select('codigo, tipo, marca, estado').limit(30),
      supabase.from('clientes').select('nombre, direccion').limit(30),
    ])
    const stockBajo = (materiales.data || []).filter((m: any) => (m.stock || 0) < (m.minimo || 0))
    const ctx = `
ORDENES ACTIVAS (${(ordenes.data || []).length}):
${(ordenes.data || []).map((o: any) => `- ${o.codigo} | ${o.tipo} | ${o.estado} | ${o.fecha_programada ? new Date(o.fecha_programada).toLocaleDateString('es-ES') : 'sin fecha'} | ${(o.descripcion || '').substring(0, 60)}`).join('\n')}
MATERIALES CON STOCK BAJO (${stockBajo.length}):
${stockBajo.map((m: any) => `- ${m.nombre}: ${m.stock} ${m.unidad} (minimo: ${m.minimo})`).join('\n')}
EQUIPOS EN CLIENTE:
${(equipos.data || []).filter((e: any) => e.estado === 'en_cliente').map((e: any) => `- ${e.codigo} ${e.tipo} ${e.marca}`).join('\n')}
CLIENTES (${(clientes.data || []).length} registrados):
${(clientes.data || []).map((c: any) => c.nombre).join(', ')}
    `.trim()
    setContexto(ctx)
  }

  useEffect(() => {
    verificarSesion()
    cargarContexto()
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensajes])

  async function enviarMensaje(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim() || cargando) return
    const nuevoMensaje = { rol: 'usuario', texto: input }
    setMensajes(prev => [...prev, nuevoMensaje])
    setInput('')
    setCargando(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mensaje: input, contexto }),
      })
      const data = await res.json()
      setMensajes(prev => [...prev, { rol: 'asistente', texto: data.respuesta || 'No pude procesar tu pregunta.' }])
    } catch {
      setMensajes(prev => [...prev, { rol: 'asistente', texto: 'Error de conexion. Intentalo de nuevo.' }])
    }
    setCargando(false)
  }

  const PREGUNTAS = [
    'Cuantas ordenes tenemos activas?',
    'Que materiales estan por debajo del minimo?',
    'Que equipos estan en cliente?',
    'Dame un resumen del estado de la empresa',
    'Que trabajos tenemos esta semana?',
  ]

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#080b14' }}>
      <div className="px-6 py-4 flex items-center justify-between flex-wrap gap-3" style={{ background: '#0d1117', borderBottom: '1px solid #1e2d3d' }}>
        <div className="flex items-center gap-4">
          <a href="/dashboard" className="text-sm transition-colors" style={{ color: '#475569' }}
            onMouseEnter={e => e.currentTarget.style.color = '#06b6d4'}
            onMouseLeave={e => e.currentTarget.style.color = '#475569'}>Dashboard</a>
          <h1 className="text-white font-bold text-lg">Asistente IA</h1>
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399', border: '1px solid rgba(16,185,129,0.3)' }}>
            powered by Groq
          </span>
        </div>
        {perfil && <span className="text-sm" style={{ color: '#475569' }}>{perfil.nombre}</span>}
      </div>

      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4 max-w-3xl mx-auto w-full">
        <div className="flex flex-wrap gap-2 mb-2">
          {PREGUNTAS.map((p, i) => (
            <button key={i} onClick={() => setInput(p)}
              className="text-xs px-3 py-1.5 rounded-full transition-all"
              style={{ background: 'rgba(124,58,237,0.1)', color: '#a78bfa', border: '1px solid rgba(124,58,237,0.2)' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = '#7c3aed'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(124,58,237,0.2)'}>
              {p}
            </button>
          ))}
        </div>

        {mensajes.map((m, i) => (
          <div key={i} className={`flex ${m.rol === 'usuario' ? 'justify-end' : 'justify-start'}`}>
            <div className="max-w-2xl px-4 py-3 rounded-2xl text-sm leading-relaxed"
              style={m.rol === 'usuario'
                ? { background: 'linear-gradient(135deg, #7c3aed, #06b6d4)', color: 'white', borderBottomRightRadius: '4px' }
                : { background: '#0d1117', color: '#e2e8f0', border: '1px solid #1e2d3d', borderBottomLeftRadius: '4px' }}>
              {m.rol === 'asistente' && (
                <p className="text-xs font-semibold mb-1" style={{ color: '#34d399' }}>Asistente Los Teros</p>
              )}
              <p style={{ whiteSpace: 'pre-wrap' }}>{m.texto}</p>
            </div>
          </div>
        ))}

        {cargando && (
          <div className="flex justify-start">
            <div className="px-4 py-3 rounded-2xl" style={{ background: '#0d1117', border: '1px solid #1e2d3d', borderBottomLeftRadius: '4px' }}>
              <div className="flex gap-1 items-center">
                {[0, 150, 300].map(delay => (
                  <div key={delay} className="w-2 h-2 rounded-full animate-bounce"
                    style={{ background: '#34d399', animationDelay: `${delay}ms` }}></div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <div className="p-4" style={{ background: '#0d1117', borderTop: '1px solid #1e2d3d' }}>
        <form onSubmit={enviarMensaje} className="flex gap-3 max-w-3xl mx-auto">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Pregunta sobre ordenes, inventario, clientes..."
            className="flex-1 rounded-xl px-4 py-3 text-white text-sm outline-none"
            style={{ background: '#080b14', border: '1px solid #1e2d3d' }}
            onFocus={e => e.target.style.borderColor = '#7c3aed'}
            onBlur={e => e.target.style.borderColor = '#1e2d3d'}
            disabled={cargando}
          />
          <button type="submit" disabled={cargando || !input.trim()}
            className="text-white px-6 py-3 rounded-xl text-sm font-medium disabled:opacity-50 transition-all"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #06b6d4)' }}>
            Enviar
          </button>
        </form>
      </div>
    </div>
  )
}
