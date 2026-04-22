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

  useEffect(() => {
    verificarSesion()
    cargarContexto()
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensajes])

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
      setMensajes(prev => [...prev, {
        rol: 'asistente',
        texto: data.respuesta || 'No pude procesar tu pregunta.'
      }])
    } catch {
      setMensajes(prev => [...prev, {
        rol: 'asistente',
        texto: 'Error de conexion. Intentalo de nuevo.'
      }])
    }

    setCargando(false)
  }

  const PREGUNTAS = [
    'Cuantas ordenes tenemos activas?',
    'Que materiales estan por debajo del minimo?',
    'Que equipos estan en cliente ahora mismo?',
    'Dame un resumen del estado de la empresa',
    'Que trabajos tenemos pendientes esta semana?',
  ]

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <a href="/dashboard" className="text-gray-400 hover:text-white text-sm">Dashboard</a>
          <h1 className="text-xl font-bold text-white">Asistente IA</h1>
          <span className="text-xs bg-green-900 text-green-300 px-2 py-0.5 rounded-full">powered by Groq</span>
        </div>
        {perfil && <span className="text-gray-400 text-sm">{perfil.nombre}</span>}
      </div>

      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4 max-w-3xl mx-auto w-full">
        <div className="flex flex-wrap gap-2 mb-2">
          {PREGUNTAS.map((p, i) => (
            <button key={i} onClick={() => setInput(p)} className="bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs px-3 py-1.5 rounded-full transition-colors">
              {p}
            </button>
          ))}
        </div>

        {mensajes.map((m, i) => (
          <div key={i} className={`flex ${m.rol === 'usuario' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-2xl px-4 py-3 rounded-xl text-sm leading-relaxed ${m.rol === 'usuario' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-gray-800 text-gray-100 rounded-bl-none'}`}>
              {m.rol === 'asistente' && (
                <p className="text-green-400 text-xs font-semibold mb-1">Asistente Los Teros</p>
              )}
              <p style={{ whiteSpace: 'pre-wrap' }}>{m.texto}</p>
            </div>
          </div>
        ))}

        {cargando && (
          <div className="flex justify-start">
            <div className="bg-gray-800 px-4 py-3 rounded-xl rounded-bl-none">
              <div className="flex gap-1 items-center">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 bg-green-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-green-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <div className="bg-gray-900 border-t border-gray-800 p-4">
        <form onSubmit={enviarMensaje} className="flex gap-3 max-w-3xl mx-auto">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Pregunta sobre ordenes, inventario, clientes..."
            className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-green-500"
            disabled={cargando}
          />
          <button
            type="submit"
            disabled={cargando || !input.trim()}
            className="bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white px-6 py-3 rounded-xl text-sm font-medium transition-colors"
          >
            Enviar
          </button>
        </form>
      </div>
    </div>
  )
}