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
        else setMensaje('Material no encontrado en el sistema.')
      } else if (datos.tipo === 'equipo') {
        const { data } = await supabase.from('equipos').select('*').eq('id', datos.id).single()
        if (data) setItem({ ...data, _tipo: 'equipo' })
        else setMensaje('Equipo no encontrado en el sistema.')
      } else {
        setMensaje('QR no reconocido. Escanea un QR generado por Los Teros.')
      }
    } catch {
      setMensaje('QR no valido. Escanea un QR generado por Los Teros.')
    }
  }

  async function registrarSalida() {
    if (!item) return
    setGuardando(true)
    const cant = parseFloat(cantidad) || 1

    if (item._tipo === 'material') {
      if ((item.stock || 0) < cant) {
        setMensaje(`Stock insuficiente. Solo hay ${item.stock} ${item.unidad || 'unidades'}.`)
        setGuardando(false)
        return
      }
      await supabase.from('materiales').update({
        stock: (item.stock || 0) - cant
      }).eq('id', item.id)
      await supabase.from('movimientos').insert({
        tipo: 'consumo',
        material_id: item.id,
        orden_id: ordenId || null,
        tecnico_id: userId,
        cantidad: cant,
        observaciones: ordenId ? `Consumo via QR desde OT ${orden?.codigo || ''}` : 'Consumo via escaneo QR',
        fecha: new Date().toISOString(),
      })
      setMensaje(`OK — ${cant} ${item.unidad || 'uds'} de "${item.nombre}" registradas. Stock restante: ${(item.stock || 0) - cant} ${item.unidad || ''}`)
    } else if (item._tipo === 'equipo') {
      await supabase.from('equipos').update({
        estado: 'en_cliente',
        fecha_salida: new Date().toISOString()
      }).eq('id', item.id)
      await supabase.from('movimientos').insert({
        tipo: 'salida',
        equipo_id: item.id,
        orden_id: ordenId || null,
        tecnico_id: userId,
        cantidad: 1,
        estado_equipo: 'en_cliente',
        observaciones: ordenId ? `Salida via QR desde OT ${orden?.codigo || ''}` : 'Salida via escaneo QR',
        fecha: new Date().toISOString(),
      })
      setMensaje(`OK — ${item.codigo} registrado como salida al cliente.`)
    }

    setGuardando(false)
    setItem(null)
    setCantidad('1')
  }

  return (
    <div className="min-h-screen bg-gray-950">
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center gap-4">
        {ordenId ? (
          <button onClick={() => router.back()} className="text-gray-400 hover:text-white text-sm">Volver a OT</button>
        ) : (
          <a href="/dashboard" className="text-gray-400 hover:text-white text-sm">Dashboard</a>
        )}
        <h1 className="text-xl font-bold text-white">Escanear QR</h1>
        {perfil && <span className="text-gray-400 text-sm ml-auto">{perfil.nombre}</span>}
      </div>

      <div className="p-6 max-w-lg mx-auto">
        {orden && (
          <div className="bg-blue-950 border border-blue-800 rounded-xl p-4 mb-6">
            <p className="text-blue-400 text-xs font-mono mb-1">{orden.codigo}</p>
            <p className="text-white font-semibold">{orden.clientes?.nombre || '—'}</p>
            <p className="text-blue-300 text-xs mt-1">Los materiales se vincularan automaticamente a esta OT</p>
          </div>
        )}

        {!escaneando && !item && (
          <div className="text-center">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 mb-6">
              <p className="text-6xl mb-4">📱</p>
              <p className="text-white font-semibold mb-2">Escanear codigo QR</p>
              <p className="text-gray-400 text-sm mb-6">Apunta la camara al codigo QR del material o equipo</p>
              <button onClick={iniciarScanner} className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl text-sm font-medium w-full">
                Abrir camara
              </button>
            </div>
            {mensaje && (
              <div className={`rounded-xl p-4 text-sm ${mensaje.startsWith('OK') ? 'bg-green-950 border border-green-800 text-green-300' : 'bg-red-950 border border-red-800 text-red-300'}`}>
                <p className="mb-3">{mensaje}</p>
                <div className="flex gap-2 justify-center flex-wrap">
                  <button onClick={() => { setMensaje(''); iniciarScanner() }} className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-xs">
                    Escanear otro
                  </button>
                  {ordenId && (
                    <button onClick={() => router.back()} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-xs">
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
            <p className="text-gray-400 text-sm text-center mb-3">Apunta la camara al codigo QR</p>
            <div id="qr-reader" className="rounded-xl overflow-hidden mb-4"></div>
            <button onClick={detenerScanner} className="w-full bg-gray-800 hover:bg-gray-700 text-gray-300 px-4 py-3 rounded-xl text-sm">
              Cancelar
            </button>
          </div>
        )}

        {item && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-14 h-14 bg-blue-900 border border-blue-700 rounded-xl flex items-center justify-center text-3xl flex-shrink-0">
                {item._tipo === 'material' ? '📦' : '⚙️'}
              </div>
              <div>
                <p className="text-white font-bold text-lg">{item.nombre || item.codigo}</p>
                {item._tipo === 'material' && (
                  <p className="text-gray-400 text-sm">Stock: <span className={`font-bold ${(item.stock || 0) <= (item.minimo || 0) ? 'text-red-400' : 'text-green-400'}`}>{item.stock || 0} {item.unidad || ''}</span></p>
                )}
                {item._tipo === 'equipo' && (
                  <p className="text-gray-400 text-sm">{item.tipo} — <span className="text-white">{item.estado}</span></p>
                )}
              </div>
            </div>

            {item._tipo === 'material' && (
              <div className="mb-5">
                <label className="text-gray-400 text-xs uppercase mb-2 block">Cantidad a retirar</label>
                <div className="flex items-center gap-3">
                  <button onClick={() => setCantidad(prev => String(Math.max(0.5, parseFloat(prev) - 0.5)))} className="w-12 h-12 bg-gray-800 hover:bg-gray-700 text-white rounded-xl text-xl font-bold">-</button>
                  <input type="number" value={cantidad} onChange={e => setCantidad(e.target.value)} min="0.5" step="0.5" max={item.stock || 0} className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-3 text-white text-2xl text-center font-bold" />
                  <button onClick={() => setCantidad(prev => String(Math.min(item.stock || 0, parseFloat(prev) + 0.5)))} className="w-12 h-12 bg-gray-800 hover:bg-gray-700 text-white rounded-xl text-xl font-bold">+</button>
                </div>
                <p className="text-gray-500 text-xs mt-2 text-center">{item.unidad || 'unidades'} — Maximo: {item.stock || 0}</p>
              </div>
            )}

            {item._tipo === 'equipo' && item.estado !== 'disponible' && (
              <div className="bg-red-950 border border-red-800 rounded-lg p-3 mb-4">
                <p className="text-red-300 text-sm">Este equipo no esta disponible. Estado: {item.estado.replace('_', ' ')}</p>
              </div>
            )}

            {item._tipo === 'equipo' && item.estado === 'disponible' && (
              <div className="bg-yellow-950 border border-yellow-800 rounded-lg p-3 mb-4">
                <p className="text-yellow-300 text-sm">Se registrara la salida de <strong>{item.codigo}</strong> al cliente.</p>
              </div>
            )}

            {mensaje && (
              <div className="bg-red-950 border border-red-800 rounded-lg p-3 mb-4">
                <p className="text-red-300 text-sm">{mensaje}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={registrarSalida} disabled={guardando || (item._tipo === 'equipo' && item.estado !== 'disponible')} className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-3 rounded-xl text-sm font-medium">
                {guardando ? 'Registrando...' : item._tipo === 'material' ? 'Confirmar salida' : 'Registrar equipo'}
              </button>
              <button onClick={() => { setItem(null); setMensaje(''); setCantidad('1') }} className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-4 py-3 rounded-xl text-sm">
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
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-white">Cargando...</p>
      </div>
    }>
      <EscanearContenido />
    </Suspense>
  )
}