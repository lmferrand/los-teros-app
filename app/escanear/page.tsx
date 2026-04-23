'use client'

import { Suspense } from 'react'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'

function EscanearContenido() {
  const [escaneando, setEscaneando] = useState(false)
  const [item, setItem] = useState<any>(null)
  const [orden, setOrden] = useState<any>(null)
  const [cantidad, setCantidad] = useState('1')
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const [userId, setUserId] = useState('')
  const [perfil, setPerfil] = useState<any>(null)
  const scannerRef = useRef<any>(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const ordenId = searchParams.get('orden')

  useEffect(() => {
    verificarSesion()
    if (ordenId) cargarOrden(ordenId)
    return () => { detenerScanner() }
  }, [])

  async function verificarSesion() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }
    setUserId(session.user.id)
    const { data } = await supabase.from('perfiles').select('*').eq('id', session.user.id).single()
    setPerfil(data)
  }

  async function cargarOrden(id: string) {
    const { data } = await supabase.from('ordenes').select('*, clientes(nombre)').eq('id', id).single()
    if (data) setOrden(data)
  }

  async function iniciarScanner() {
    setEscaneando(true)
    setItem(null)
    setMensaje('')
    try {
      const { Html5Qrcode } = await import('html5-qrcode')
      const scanner = new Html5Qrcode('qr-reader')
      scannerRef.current = scanner
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        async (texto: string) => {
          await scanner.stop()
          scannerRef.current = null
          setEscaneando(false)
          await procesarQR(texto)
        },
        () => {}
      )
    } catch {
      setEscaneando(false)
      setMensaje('No se pudo acceder a la camara. Permite el acceso en tu navegador.')
    }
  }

  async function detenerScanner() {
    if (scannerRef.current) {
      try { await scannerRef.current.stop() } catch {}
      scannerRef.current = null
    }
    setEscaneando(false)
  }

  async function procesarQR(texto: string) {
    try {
      const datos = JSON.parse(texto)
      if (datos.tipo === 'material') {
        const { data } = await supabase.from('materiales').select('*').eq('id', datos.id).single()
        if (data) setItem({ ...data, _tipo: 'material' })
        else setMensaje('Material no encontrado.')
      } else if (datos.tipo === 'equipo') {
        const { data } = await supabase.from('equipos').select('*').eq('id', datos.id).single()
        if (data) setItem({ ...data, _tipo: 'equipo' })
        else setMensaje('Equipo no encontrado.')
      } else {
        setMensaje('QR no reconocido. Escanea un QR generado por Los Teros.')
      }
    } catch {
      setMensaje('QR no valido.')
    }
  }

  async function registrarSalida() {
    if (!item) return
    setGuardando(true)
    const cant = parseFloat(cantidad) || 1
    if (item._tipo === 'material') {
      if ((item.stock || 0) < cant) {
        setMensaje(`Stock insuficiente. Solo hay ${item.stock} ${item.unidad || 'unidades'}.`)
        setGuardando(false); return
      }
      await supabase.from('materiales').update({ stock: (item.stock || 0) - cant }).eq('id', item.id)
      await supabase.from('movimientos').insert({
        tipo: 'consumo', material_id: item.id, orden_id: ordenId || null, tecnico_id: userId,
        cantidad: cant, observaciones: ordenId ? `Consumo via QR desde OT ${orden?.codigo || ''}` : 'Consumo via QR',
        fecha: new Date().toISOString(),
      })
      setMensaje(`OK — ${cant} ${item.unidad || 'uds'} de "${item.nombre}" registradas. Stock: ${(item.stock || 0) - cant}`)
    } else if (item._tipo === 'equipo') {
      await supabase.from('equipos').update({ estado: 'en_cliente', fecha_salida: new Date().toISOString() }).eq('id', item.id)
      await supabase.from('movimientos').insert({
        tipo: 'salida', equipo_id: item.id, orden_id: ordenId || null, tecnico_id: userId,
        cantidad: 1, estado_equipo: 'en_cliente',
        observaciones: ordenId ? `Salida via QR desde OT ${orden?.codigo || ''}` : 'Salida via QR',
        fecha: new Date().toISOString(),
      })
      setMensaje(`OK — ${item.codigo} registrado como salida al cliente.`)
    }
    setGuardando(false); setItem(null); setCantidad('1')
  }

  return (
    <div className="min-h-screen" style={{ background: '#080b14' }}>
      <div className="px-6 py-4 flex items-center gap-4" style={{ background: '#0d1117', borderBottom: '1px solid #1e2d3d' }}>
        {ordenId ? (
          <button onClick={() => router.back()} className="text-sm transition-colors" style={{ color: '#475569' }}
            onMouseEnter={e => e.currentTarget.style.color = '#06b6d4'}
            onMouseLeave={e => e.currentTarget.style.color = '#475569'}>Volver a OT</button>
        ) : (
          <a href="/dashboard" className="text-sm transition-colors" style={{ color: '#475569' }}
            onMouseEnter={e => e.currentTarget.style.color = '#06b6d4'}
            onMouseLeave={e => e.currentTarget.style.color = '#475569'}>Dashboard</a>
        )}
        <h1 className="text-white font-bold text-lg">Escanear QR</h1>
        {perfil && <span className="text-sm ml-auto" style={{ color: '#475569' }}>{perfil.nombre}</span>}
      </div>

      <div className="p-6 max-w-lg mx-auto">
        {orden && (
          <div className="rounded-2xl p-4 mb-6" style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)' }}>
            <p className="font-mono text-sm mb-1" style={{ color: '#06b6d4' }}>{orden.codigo}</p>
            <p className="text-white font-semibold">{orden.clientes?.nombre || '—'}</p>
            <p className="text-xs mt-1" style={{ color: '#a78bfa' }}>Materiales vinculados automaticamente a esta OT</p>
          </div>
        )}

        {!escaneando && !item && (
          <div className="text-center">
            <div className="rounded-2xl p-8 mb-6" style={{ background: '#0d1117', border: '1px solid #1e2d3d' }}>
              <p className="text-6xl mb-4">📱</p>
              <p className="text-white font-semibold mb-2">Escanear codigo QR</p>
              <p className="text-sm mb-6" style={{ color: '#475569' }}>Apunta la camara al codigo QR del material o equipo</p>
              <button onClick={iniciarScanner}
                className="w-full py-3 rounded-xl text-white text-sm font-medium"
                style={{ background: 'linear-gradient(135deg, #7c3aed, #06b6d4)' }}>
                Abrir camara
              </button>
            </div>
            {mensaje && (
              <div className="rounded-2xl p-4 text-sm" style={mensaje.startsWith('OK')
                ? { background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', color: '#34d399' }
                : { background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
                <p className="mb-3">{mensaje}</p>
                <div className="flex gap-2 justify-center flex-wrap">
                  <button onClick={() => { setMensaje(''); iniciarScanner() }}
                    className="text-xs px-4 py-2 rounded-xl text-white"
                    style={{ background: 'rgba(124,58,237,0.2)', border: '1px solid rgba(124,58,237,0.3)' }}>
                    Escanear otro
                  </button>
                  {ordenId && (
                    <button onClick={() => router.back()}
                      className="text-xs px-4 py-2 rounded-xl text-white"
                      style={{ background: 'linear-gradient(135deg, #7c3aed, #06b6d4)' }}>
                      Volver a OT
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {escaneando && (
          <div>
            <p className="text-sm text-center mb-3" style={{ color: '#475569' }}>Apunta la camara al codigo QR</p>
            <div id="qr-reader" className="rounded-2xl overflow-hidden mb-4"></div>
            <button onClick={detenerScanner} className="w-full py-3 rounded-xl text-sm"
              style={{ background: '#0d1117', color: '#64748b', border: '1px solid #1e2d3d' }}>
              Cancelar
            </button>
          </div>
        )}

        {item && (
          <div className="rounded-2xl p-6" style={{ background: '#0d1117', border: '1px solid #1e2d3d' }}>
            <div className="flex items-center gap-4 mb-5">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.3), rgba(6,182,212,0.3))', border: '1px solid rgba(124,58,237,0.3)' }}>
                {item._tipo === 'material' ? '📦' : '⚙️'}
              </div>
              <div>
                <p className="text-white font-bold text-lg">{item.nombre || item.codigo}</p>
                {item._tipo === 'material' && (
                  <p className="text-sm" style={{ color: '#64748b' }}>
                    Stock: <span className="font-bold" style={{ color: (item.stock || 0) <= (item.minimo || 0) ? '#f87171' : '#34d399' }}>
                      {item.stock || 0} {item.unidad || ''}
                    </span>
                  </p>
                )}
                {item._tipo === 'equipo' && (
                  <p className="text-sm capitalize" style={{ color: '#64748b' }}>{item.tipo} — {item.estado}</p>
                )}
              </div>
            </div>

            {item._tipo === 'material' && (
              <div className="mb-5">
                <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: '#475569' }}>Cantidad a retirar</label>
                <div className="flex items-center gap-3">
                  <button onClick={() => setCantidad(prev => String(Math.max(0.5, parseFloat(prev) - 0.5)))}
                    className="w-12 h-12 rounded-xl text-xl font-bold transition-colors"
                    style={{ background: '#080b14', color: '#64748b', border: '1px solid #1e2d3d' }}>-</button>
                  <input type="number" value={cantidad} onChange={e => setCantidad(e.target.value)}
                    min="0.5" step="0.5" max={item.stock || 0}
                    className="flex-1 rounded-xl px-3 py-3 text-white text-2xl text-center font-bold outline-none"
                    style={{ background: '#080b14', border: '1px solid #1e2d3d' }} />
                  <button onClick={() => setCantidad(prev => String(Math.min(item.stock || 0, parseFloat(prev) + 0.5)))}
                    className="w-12 h-12 rounded-xl text-xl font-bold transition-colors"
                    style={{ background: '#080b14', color: '#64748b', border: '1px solid #1e2d3d' }}>+</button>
                </div>
                <p className="text-xs mt-2 text-center" style={{ color: '#475569' }}>
                  {item.unidad || 'unidades'} — Maximo: {item.stock || 0}
                </p>
              </div>
            )}

            {item._tipo === 'equipo' && item.estado !== 'disponible' && (
              <div className="rounded-xl p-3 mb-4" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                <p className="text-sm" style={{ color: '#f87171' }}>Este equipo no esta disponible. Estado: {item.estado.replace('_', ' ')}</p>
              </div>
            )}

            {item._tipo === 'equipo' && item.estado === 'disponible' && (
              <div className="rounded-xl p-3 mb-4" style={{ background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.2)' }}>
                <p className="text-sm" style={{ color: '#fbbf24' }}>Se registrara la salida de <strong>{item.codigo}</strong> al cliente.</p>
              </div>
            )}

            {mensaje && (
              <div className="rounded-xl p-3 mb-4" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                <p className="text-sm" style={{ color: '#f87171' }}>{mensaje}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={registrarSalida}
                disabled={guardando || (item._tipo === 'equipo' && item.estado !== 'disponible')}
                className="flex-1 py-3 rounded-xl text-white text-sm font-medium disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #7c3aed, #06b6d4)' }}>
                {guardando ? 'Registrando...' : item._tipo === 'material' ? 'Confirmar salida' : 'Registrar equipo'}
              </button>
              <button onClick={() => { setItem(null); setMensaje(''); setCantidad('1') }}
                className="py-3 px-4 rounded-xl text-sm"
                style={{ background: '#080b14', color: '#64748b', border: '1px solid #1e2d3d' }}>
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function Escanear() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#080b14' }}>
        <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#7c3aed', borderTopColor: 'transparent' }}></div>
      </div>
    }>
      <EscanearContenido />
    </Suspense>
  )
}