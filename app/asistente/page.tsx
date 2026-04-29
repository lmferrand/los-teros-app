'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { s } from '@/lib/styles'
import AppHeader from '@/app/components/AppHeader'

export default function Asistente() {
  const [mensajes, setMensajes] = useState<any[]>([
    {
      rol: 'asistente',
      texto: 'Hola, soy el asistente de Los Teros. Puedo ayudarte con información sobre órdenes, inventario, clientes y planificación. Pregúntame lo que necesites.'
    }
  ])
  const [input, setInput] = useState('')
  const [cargando, setCargando] = useState(false)
  const [contexto, setContexto] = useState('')
  const [perfil, setPerfil] = useState<any>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  const verificarSesion = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }
    const { data } = await supabase
      .from('perfiles')
      .select('id, nombre, rol')
      .eq('id', session.user.id)
      .single()
    setPerfil(data)
  }, [router])

  const cargarContexto = useCallback(async () => {
    const [ordenes, materiales, equipos, clientes] = await Promise.all([
      supabase.from('ordenes').select('codigo, tipo, estado, fecha_programada, descripcion').in('estado', ['pendiente', 'en_curso']).limit(20),
      supabase.from('materiales').select('nombre, stock, minimo, unidad').limit(30),
      supabase.from('equipos').select('codigo, tipo, marca, estado').limit(30),
      supabase.from('clientes').select('nombre, direccion').limit(30),
    ])
    const stockBajo = (materiales.data || []).filter((m: any) => (m.stock || 0) < (m.minimo || 0))
    const ctx = `
ÓRDENES ACTIVAS (${(ordenes.data || []).length}):
${(ordenes.data || []).map((o: any) => `- ${o.codigo} | ${o.tipo} | ${o.estado} | ${o.fecha_programada ? new Date(o.fecha_programada).toLocaleDateString('es-ES') : 'sin fecha'} | ${(o.descripcion || '').substring(0, 60)}`).join('\n')}
MATERIALES CON STOCK BAJO (${stockBajo.length}):
${stockBajo.map((m: any) => `- ${m.nombre}: ${m.stock} ${m.unidad} (mínimo: ${m.minimo})`).join('\n')}
EQUIPOS EN CLIENTE:
${(equipos.data || []).filter((e: any) => e.estado === 'en_cliente').map((e: any) => `- ${e.codigo} ${e.tipo} ${e.marca}`).join('\n')}
CLIENTES (${(clientes.data || []).length} registrados):
${(clientes.data || []).map((c: any) => c.nombre).join(', ')}
    `.trim()
    setContexto(ctx)
  }, [])

  useEffect(() => {
    void verificarSesion()
    void cargarContexto()
  }, [verificarSesion, cargarContexto])

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
    '¿Cuántas órdenes tenemos activas?',
    '¿Qué materiales están por debajo del mínimo?',
    'Que equipos estan en cliente?',
    'Dame un resumen del estado de la empresa',
    'Que trabajos tenemos esta semana?',
  ]

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg)' }}>
      <AppHeader
        title="Asistente IA"
        leftSlot={
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399', border: '1px solid rgba(16,185,129,0.3)' }}>
            powered by Groq
          </span>
        }
        rightSlot={perfil ? <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{perfil.nombre}</span> : null}
      />

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
                : { background: 'var(--bg-card)', color: 'var(--text)', border: '1px solid var(--border)', borderBottomLeftRadius: '4px' }}>
              {m.rol === 'asistente' && (
                <p className="text-xs font-semibold mb-1" style={{ color: '#34d399' }}>Asistente Los Teros</p>
              )}
              <p style={{ whiteSpace: 'pre-wrap' }}>{m.texto}</p>
            </div>
          </div>
        ))}

        {cargando && (
          <div className="flex justify-start">
            <div className="px-4 py-3 rounded-2xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderBottomLeftRadius: '4px' }}>
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

      <div className="p-4" style={s.headerStyle}>
        <form onSubmit={enviarMensaje} className="flex gap-3 max-w-3xl mx-auto">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Pregunta sobre órdenes, inventario, clientes..."
            className="flex-1 rounded-xl px-4 py-3 text-sm outline-none"
            style={s.inputStyle}
            onFocus={e => e.target.style.borderColor = '#7c3aed'}
            onBlur={e => e.target.style.borderColor = 'var(--border)'}
            disabled={cargando}
          />
          <button type="submit" disabled={cargando || !input.trim()}
            className="px-6 py-3 rounded-xl text-sm font-medium disabled:opacity-50"
            style={s.btnPrimary}>
            Enviar
          </button>
        </form>
      </div>
    </div>
  )
}
