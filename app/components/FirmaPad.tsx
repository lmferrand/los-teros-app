'use client'

import { useEffect, useRef, useState } from 'react'

// Lienzo de firma (ratón/táctil). Llama onGuardar(blob PNG) al confirmar.
export default function FirmaPad({ titulo, onGuardar, onCerrar }: { titulo: string; onGuardar: (blob: Blob) => void; onCerrar: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const dibujando = useRef(false)
  const [vacio, setVacio] = useState(true)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.scale(dpr, dpr)
      ctx.lineWidth = 2.2
      ctx.lineCap = 'round'
      ctx.strokeStyle = '#0f172a'
    }
  }, [])

  function pos(e: React.PointerEvent) {
    const r = canvasRef.current!.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }
  function start(e: React.PointerEvent) {
    dibujando.current = true
    const ctx = canvasRef.current!.getContext('2d')!
    const { x, y } = pos(e)
    ctx.beginPath(); ctx.moveTo(x, y)
    setVacio(false)
  }
  function move(e: React.PointerEvent) {
    if (!dibujando.current) return
    const ctx = canvasRef.current!.getContext('2d')!
    const { x, y } = pos(e)
    ctx.lineTo(x, y); ctx.stroke()
  }
  function end() { dibujando.current = false }

  function borrar() {
    const canvas = canvasRef.current!
    canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height)
    setVacio(true)
  }
  function guardar() {
    if (vacio) return
    setGuardando(true)
    canvasRef.current!.toBlob((blob) => {
      if (blob) onGuardar(blob)
      else setGuardando(false)
    }, 'image/png')
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center md:p-4" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={onCerrar}>
      <div className="w-full md:max-w-md rounded-t-2xl md:rounded-2xl p-5" style={{ background: 'var(--bg-card)', boxShadow: 'var(--shadow-lg)' }} onClick={(e) => e.stopPropagation()}>
        <h3 className="font-semibold mb-3" style={{ color: 'var(--text)' }}>{titulo}</h3>
        <canvas
          ref={canvasRef}
          onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerLeave={end}
          className="w-full rounded-xl touch-none"
          style={{ height: 200, background: '#ffffff', border: '1px solid var(--border)', cursor: 'crosshair' }}
        />
        <div className="flex gap-3 justify-between mt-4">
          <button onClick={borrar} className="rounded-xl px-4 py-2 font-semibold text-sm" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}>Borrar</button>
          <div className="flex gap-2">
            <button onClick={onCerrar} className="rounded-xl px-4 py-2 font-semibold text-sm" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}>Cancelar</button>
            <button onClick={guardar} disabled={vacio || guardando} className="marca-gradiente rounded-xl px-4 py-2 font-semibold text-sm text-white" style={{ opacity: (vacio || guardando) ? 0.5 : 1 }}>{guardando ? 'Guardando…' : 'Guardar firma'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
