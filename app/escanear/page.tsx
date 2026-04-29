'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import { s } from '@/lib/styles'
import { registrarConsumoMaterialOt, registrarSalidaEquipoOt } from '@/lib/ordenes-integridad'
import AppHeader from '@/app/components/AppHeader'

function EscanearContenido() {
  const [escaneando, setEscaneando] = useState(false)
  const [item, setItem] = useState<any>(null)
  const [orden, setOrden] = useState<any>(null)
  const [ordenesDisponibles, setOrdenesDisponibles] = useState<any[]>([])
  const [ordenManualId, setOrdenManualId] = useState('')
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
    return () => {
      detenerScanner()
    }
    // Se ejecuta una vez al montar la pantalla.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function verificarSesion() {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session) {
      router.push('/login')
      return
    }
    setUserId(session.user.id)
    const { data } = await supabase.from('perfiles').select('*').eq('id', session.user.id).single()
    setPerfil(data)
    if (!ordenId) {
      await cargarOrdenesDisponibles(session.user.id, data?.rol || '')
    }
  }

  async function cargarOrden(id: string) {
    const { data } = await supabase
      .from('ordenes')
      .select('*, clientes(nombre)')
      .eq('id', id)
      .single()
    if (data) setOrden(data)
  }

  async function cargarOrdenesDisponibles(usuarioId: string, rol: string) {
    const { data } = await supabase
      .from('ordenes')
      .select('id, codigo, estado, fecha_programada, tecnico_id, tecnicos_ids, clientes(nombre)')
      .in('estado', ['pendiente', 'en_curso'])
      .order('fecha_programada', { ascending: true, nullsFirst: false })
      .limit(200)

    if (!data) {
      setOrdenesDisponibles([])
      return
    }

    if (rol === 'gerente' || rol === 'oficina' || rol === 'supervisor') {
      setOrdenesDisponibles(data)
      if (!ordenManualId && data.length > 0) setOrdenManualId(data[0].id)
      return
    }

    const filtradas = data.filter((o: any) => o.tecnico_id === usuarioId || o.tecnicos_ids?.includes(usuarioId))
    setOrdenesDisponibles(filtradas)
    if (!ordenManualId && filtradas.length > 0) setOrdenManualId(filtradas[0].id)
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
      try {
        await scannerRef.current.stop()
      } catch {}
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
        return
      }

      if (datos.tipo === 'equipo') {
        const { data } = await supabase.from('equipos').select('*').eq('id', datos.id).single()
        if (data) setItem({ ...data, _tipo: 'equipo' })
        else setMensaje('Equipo no encontrado.')
        return
      }

      setMensaje('QR no reconocido. Escanea un QR generado por Los Teros.')
    } catch {
      setMensaje('QR no valido.')
    }
  }

  function getMensajeErrorRegistro(error: unknown) {
    if (error && typeof error === 'object' && 'message' in error) {
      const msg = String((error as { message?: string }).message || '').trim()
      if (msg) return msg
    }
    return 'No se pudo registrar el movimiento.'
  }

  function getOrdenReferenciaId() {
    return ordenId || ordenManualId || null
  }

  function getCodigoOrdenReferencia() {
    if (orden?.codigo) return orden.codigo
    if (!ordenManualId) return ''
    return ordenesDisponibles.find((o) => o.id === ordenManualId)?.codigo || ''
  }

  function getEtiquetaOrden(codigo: string, id: string | null) {
    if (codigo) return codigo
    if (!id) return ''
    return id.slice(0, 8)
  }

  async function forzarVinculoMovimientoOt(movimientoId: string | null, ordenVinculadaId: string | null) {
    if (!movimientoId || !ordenVinculadaId) return

    const { data: mov } = await supabase
      .from('movimientos')
      .select('id, observaciones')
      .eq('id', movimientoId)
      .single()

    const observacionesActuales = String(mov?.observaciones || '').trim()
    const marcadorOt = `[id:${ordenVinculadaId}]`
    const observaciones = observacionesActuales.includes(marcadorOt)
      ? observacionesActuales
      : `${observacionesActuales}${observacionesActuales ? ' ' : ''}${marcadorOt}`

    await supabase
      .from('movimientos')
      .update({ orden_id: ordenVinculadaId, observaciones })
      .eq('id', movimientoId)
  }

  async function registrarSalida() {
    if (!item || !userId) return

    setGuardando(true)
    const cant = parseFloat(cantidad) || 1
    const ordenReferenciaId = getOrdenReferenciaId()
    const codigoOrden = getCodigoOrdenReferencia()

    if (!ordenReferenciaId && !ordenId && ordenesDisponibles.length > 0) {
      setMensaje('Selecciona una OT antes de registrar el movimiento.')
      setGuardando(false)
      return
    }

    if (cant <= 0) {
      setMensaje('La cantidad debe ser mayor que 0.')
      setGuardando(false)
      return
    }

    try {
      if (item._tipo === 'material') {
        if ((item.stock || 0) < cant) {
          setMensaje(`Stock insuficiente. Solo hay ${item.stock} ${item.unidad || 'unidades'}.`)
          setGuardando(false)
          return
        }

        const observacion = ordenReferenciaId
          ? `Consumo via QR desde OT ${codigoOrden} [id:${ordenReferenciaId}]`
          : 'Consumo via QR sin OT'

        const { stockActual, movimientoId } = await registrarConsumoMaterialOt({
          materialId: item.id,
          cantidad: cant,
          tecnicoId: userId,
          ordenId: ordenReferenciaId,
          observaciones: observacion,
        })

        await forzarVinculoMovimientoOt(movimientoId, ordenReferenciaId)

        if (ordenReferenciaId) {
          sessionStorage.setItem(
            'ot_actualizada',
            JSON.stringify({ ordenId: ordenReferenciaId, ts: Date.now() })
          )
        }

        const etiquetaOt = getEtiquetaOrden(codigoOrden, ordenReferenciaId)
        setMensaje(
          `OK - ${cant} ${item.unidad || 'uds'} de "${item.nombre}" registradas. Stock: ${stockActual}${
            ordenReferenciaId ? ` (OT ${etiquetaOt})` : ' (sin OT)'
          }`
        )
      } else if (item._tipo === 'equipo') {
        const observacion = ordenReferenciaId
          ? `Salida via QR desde OT ${codigoOrden} [id:${ordenReferenciaId}]`
          : 'Salida via QR sin OT'

        const { movimientoId } = await registrarSalidaEquipoOt({
          equipoId: item.id,
          tecnicoId: userId,
          ordenId: ordenReferenciaId,
          observaciones: observacion,
        })

        await forzarVinculoMovimientoOt(movimientoId, ordenReferenciaId)

        if (ordenReferenciaId) {
          sessionStorage.setItem(
            'ot_actualizada',
            JSON.stringify({ ordenId: ordenReferenciaId, ts: Date.now() })
          )
        }

        const etiquetaOt = getEtiquetaOrden(codigoOrden, ordenReferenciaId)
        setMensaje(
          `OK - ${item.codigo} registrado como equipo adquirido${
            ordenReferenciaId ? ` (OT ${etiquetaOt})` : ' (sin OT)'
          }.`
        )
      }

      setItem(null)
      setCantidad('1')
    } catch (error) {
      setMensaje(getMensajeErrorRegistro(error))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <AppHeader
        title="Escanear QR"
        leftSlot={ordenId ? (
          <button
            onClick={() => router.back()}
            className="text-sm transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#06b6d4')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
          >
            Volver a OT
          </button>
        ) : null}
        rightSlot={perfil ? <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{perfil.nombre}</span> : null}
      />

      <div className="p-6 max-w-lg mx-auto">
        {orden && (
          <div
            className="rounded-2xl p-4 mb-6"
            style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)' }}
          >
            <p className="font-mono text-sm mb-1" style={{ color: '#06b6d4' }}>
              {orden.codigo}
            </p>
            <p className="font-semibold" style={{ color: 'var(--text)' }}>
              {orden.clientes?.nombre || '-'}
            </p>
            <p className="text-xs mt-1" style={{ color: '#a78bfa' }}>
              El movimiento se vinculara automaticamente a esta OT.
            </p>
          </div>
        )}
        {!ordenId && (
          <div
            className="rounded-2xl p-4 mb-6"
            style={{ background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.2)' }}
          >
            <p className="font-medium text-sm mb-2" style={{ color: '#06b6d4' }}>
              Vincular movimiento a OT (recomendado)
            </p>
            <select
              value={ordenManualId}
              onChange={(e) => setOrdenManualId(e.target.value)}
              className="w-full rounded-xl px-3 py-2 text-sm outline-none"
              style={s.inputStyle}
            >
              {ordenesDisponibles.length === 0 && <option value="">No hay OTs activas para vincular</option>}
              {ordenesDisponibles.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.codigo} - {o.clientes?.nombre || '-'}
                </option>
              ))}
            </select>
            <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
              {ordenesDisponibles.length > 0
                ? 'Este movimiento se guardara dentro de la OT seleccionada.'
                : 'Sin OTs activas, el movimiento se registrara sin OT.'}
            </p>
          </div>
        )}

        {!escaneando && !item && (
          <div className="text-center">
            <div className="rounded-2xl p-8 mb-6" style={s.cardStyle}>
              <p className="text-6xl mb-4">QR</p>
              <p className="font-semibold mb-2" style={{ color: 'var(--text)' }}>
                Escanear codigo QR
              </p>
              <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
                Apunta la camara al codigo QR del material o equipo
              </p>
              <button onClick={iniciarScanner} className="w-full py-3 rounded-xl text-sm font-medium" style={s.btnPrimary}>
                Abrir camara
              </button>
            </div>
            {mensaje && (
              <div
                className="rounded-2xl p-4 text-sm"
                style={
                  mensaje.startsWith('OK')
                    ? { background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', color: '#34d399' }
                    : { background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }
                }
              >
                <p className="mb-3">{mensaje}</p>
                <div className="flex gap-2 justify-center flex-wrap">
                  <button
                    onClick={() => {
                      setMensaje('')
                      iniciarScanner()
                    }}
                    className="text-xs px-4 py-2 rounded-xl"
                    style={{ background: 'rgba(124,58,237,0.2)', border: '1px solid rgba(124,58,237,0.3)', color: '#a78bfa' }}
                  >
                    Escanear otro
                  </button>
                  {ordenId && (
                    <button onClick={() => router.back()} className="text-xs px-4 py-2 rounded-xl" style={s.btnPrimary}>
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
            <p className="text-sm text-center mb-3" style={{ color: 'var(--text-muted)' }}>
              Apunta la camara al codigo QR
            </p>
            <div id="qr-reader" className="rounded-2xl overflow-hidden mb-4"></div>
            <button onClick={detenerScanner} className="w-full py-3 rounded-xl text-sm" style={s.btnSecondary}>
              Cancelar
            </button>
          </div>
        )}

        {item && (
          <div className="rounded-2xl p-6" style={s.cardStyle}>
            <div className="flex items-center gap-4 mb-5">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.3), rgba(6,182,212,0.3))', border: '1px solid rgba(124,58,237,0.3)' }}
              >
                {item._tipo === 'material' ? 'M' : 'E'}
              </div>
              <div>
                <p className="font-bold text-lg" style={{ color: 'var(--text)' }}>
                  {item.nombre || item.codigo}
                </p>
                {item._tipo === 'material' && (
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    Stock:{' '}
                    <span className="font-bold" style={{ color: (item.stock || 0) <= (item.minimo || 0) ? '#f87171' : '#34d399' }}>
                      {item.stock || 0} {item.unidad || ''}
                    </span>
                  </p>
                )}
                {item._tipo === 'equipo' && (
                  <p className="text-sm capitalize" style={{ color: 'var(--text-muted)' }}>
                    {item.tipo} - {item.estado}
                  </p>
                )}
              </div>
            </div>

            {item._tipo === 'material' && (
              <div className="mb-5">
                <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-muted)' }}>
                  Cantidad a retirar
                </label>
                <div className="flex items-center gap-3">
                  <button onClick={() => setCantidad((prev) => String(Math.max(0.5, parseFloat(prev || '1') - 0.5)))} className="w-12 h-12 rounded-xl text-xl font-bold" style={s.btnSecondary}>
                    -
                  </button>
                  <input
                    type="number"
                    value={cantidad}
                    onChange={(e) => setCantidad(e.target.value)}
                    min="0.5"
                    step="0.5"
                    max={item.stock || 0}
                    className="flex-1 rounded-xl px-3 py-3 text-2xl text-center font-bold outline-none"
                    style={s.inputStyle}
                  />
                  <button onClick={() => setCantidad((prev) => String(Math.min(item.stock || 0, parseFloat(prev || '1') + 0.5)))} className="w-12 h-12 rounded-xl text-xl font-bold" style={s.btnSecondary}>
                    +
                  </button>
                </div>
                <p className="text-xs mt-2 text-center" style={{ color: 'var(--text-muted)' }}>
                  {item.unidad || 'unidades'} - Maximo: {item.stock || 0}
                </p>
              </div>
            )}

            {item._tipo === 'equipo' && item.estado !== 'disponible' && (
              <div className="rounded-xl p-3 mb-4" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                <p className="text-sm" style={{ color: '#f87171' }}>
                  Este equipo no esta disponible. Estado: {String(item.estado || '').replace('_', ' ')}
                </p>
              </div>
            )}

            {item._tipo === 'equipo' && item.estado === 'disponible' && (
              <div className="rounded-xl p-3 mb-4" style={{ background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.2)' }}>
                <p className="text-sm" style={{ color: '#fbbf24' }}>
                  Se registrara <strong>{item.codigo}</strong> como equipo adquirido en esta OT.
                </p>
              </div>
            )}

            {mensaje && (
              <div className="rounded-xl p-3 mb-4" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                <p className="text-sm" style={{ color: '#f87171' }}>
                  {mensaje}
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={registrarSalida}
                disabled={guardando || (item._tipo === 'equipo' && item.estado !== 'disponible')}
                className="flex-1 py-3 rounded-xl text-sm font-medium disabled:opacity-50"
                style={s.btnPrimary}
              >
                {guardando ? 'Registrando...' : item._tipo === 'material' ? 'Confirmar salida' : 'Registrar equipo adquirido'}
              </button>
              <button
                onClick={() => {
                  setItem(null)
                  setMensaje('')
                  setCantidad('1')
                }}
                className="py-3 px-4 rounded-xl text-sm"
                style={s.btnSecondary}
              >
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
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
          <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#7c3aed', borderTopColor: 'transparent' }}></div>
        </div>
      }
    >
      <EscanearContenido />
    </Suspense>
  )
}
