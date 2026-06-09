'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { obtenerMaterial, obtenerEquipo, fijarStock, crearMovimiento, cambiarEstadoEquipo } from '@/lib/db/inventario'
import { labelUnidad, labelTipoEquipo, ESTADOS_EQUIPO, type Material, type Equipo } from '@/lib/inventario'

type Resultado =
  | { tipo: 'material'; material: Material }
  | { tipo: 'equipo'; equipo: Equipo }
  | null

export default function EscanearPage() {
  const [estado, setEstado] = useState<'idle' | 'escaneando' | 'resultado'>('idle')
  const [resultado, setResultado] = useState<Resultado>(null)
  const [error, setError] = useState('')
  const scannerRef = useRef<any>(null)

  async function pararScanner() {
    const sc = scannerRef.current
    if (sc) {
      try { await sc.stop() } catch { /* noop */ }
      try { await sc.clear() } catch { /* noop */ }
      scannerRef.current = null
    }
  }

  async function iniciar() {
    setError('')
    setResultado(null)
    setEstado('escaneando')
    try {
      const { Html5Qrcode } = await import('html5-qrcode')
      // Espera a que el div exista en el DOM.
      await new Promise((r) => setTimeout(r, 50))
      const scanner = new Html5Qrcode('qr-reader')
      scannerRef.current = scanner
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        async (texto: string) => {
          await pararScanner()
          await procesar(texto)
        },
        () => { /* ignora frames sin QR */ }
      )
    } catch (e: any) {
      setError('No se pudo abrir la cámara. Revisa los permisos.')
      setEstado('idle')
    }
  }

  async function procesar(texto: string) {
    try {
      const datos = JSON.parse(texto)
      if (datos.tipo === 'material' && datos.id) {
        const material = await obtenerMaterial(datos.id)
        if (material) { setResultado({ tipo: 'material', material }); setEstado('resultado'); return }
      }
      if (datos.tipo === 'equipo' && datos.id) {
        const equipo = await obtenerEquipo(datos.id)
        if (equipo) { setResultado({ tipo: 'equipo', equipo }); setEstado('resultado'); return }
      }
      setError('QR no reconocido o el ítem ya no existe.')
      setEstado('idle')
    } catch {
      setError('Este QR no es del inventario.')
      setEstado('idle')
    }
  }

  useEffect(() => () => { pararScanner() }, [])

  return (
    <div>
      <header className="mb-4">
        <h1 className="titulo-hero" style={{ color: 'var(--text)' }}>Escanear QR</h1>
        <p className="mt-1" style={{ color: 'var(--text-muted)' }}>Localiza un material o equipo con su código QR.</p>
      </header>

      {error && <div className="card p-4 mb-4 text-sm" style={{ color: 'var(--red)' }}>{error}</div>}

      {estado === 'idle' && (
        <button onClick={iniciar} className="card w-full p-10 flex flex-col items-center gap-3" style={{ border: '2px dashed var(--border-strong)' }}>
          <div className="grid place-items-center rounded-2xl marca-gradiente" style={{ width: 56, height: 56 }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 12h10" />
            </svg>
          </div>
          <div className="font-semibold" style={{ color: 'var(--text)' }}>Abrir cámara</div>
          <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Apunta al QR del material o equipo</div>
        </button>
      )}

      {estado === 'escaneando' && (
        <div className="card p-4 flex flex-col items-center gap-3">
          <div id="qr-reader" style={{ width: '100%', maxWidth: 360 }} />
          <button onClick={async () => { await pararScanner(); setEstado('idle') }} className="rounded-xl px-4 py-2 font-semibold text-sm" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}>Cancelar</button>
        </div>
      )}

      {estado === 'resultado' && resultado && (
        <FichaResultado resultado={resultado} onOtro={iniciar} onActualizado={(r) => setResultado(r)} />
      )}
    </div>
  )
}

function FichaResultado({ resultado, onOtro, onActualizado }: { resultado: NonNullable<Resultado>; onOtro: () => void; onActualizado: (r: Resultado) => void }) {
  const [trabajando, setTrabajando] = useState(false)

  async function ajustar(m: Material, delta: number) {
    setTrabajando(true)
    const nuevo = Math.max(0, (m.stock ?? 0) + delta)
    await fijarStock(m.id, nuevo)
    await crearMovimiento({ tipo: delta > 0 ? 'entrada' : 'consumo', material_id: m.id, cantidad: Math.abs(delta), observaciones: 'Desde escáner', fecha: new Date().toISOString() })
    onActualizado({ tipo: 'material', material: { ...m, stock: nuevo } })
    setTrabajando(false)
  }
  async function cambiarEstado(e: Equipo, estado: string) {
    setTrabajando(true)
    await cambiarEstadoEquipo(e.id, estado)
    onActualizado({ tipo: 'equipo', equipo: { ...e, estado } })
    setTrabajando(false)
  }

  return (
    <div className="card p-5 animar-entrada">
      {resultado.tipo === 'material' ? (
        <>
          <div className="text-xs font-semibold mb-1" style={{ color: 'var(--brand-1)' }}>MATERIAL</div>
          <h2 className="text-xl font-bold" style={{ color: 'var(--text)' }}>{resultado.material.nombre}</h2>
          <div className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {resultado.material.referencia ? `Ref: ${resultado.material.referencia} · ` : ''}{resultado.material.ubicacion || 'Sin ubicación'}
          </div>
          <div className="flex items-center gap-3 mt-4">
            <button disabled={trabajando} onClick={() => ajustar(resultado.material, -1)} className="grid place-items-center rounded-xl" style={{ width: 46, height: 46, background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 22 }}>−</button>
            <div className="text-center">
              <div className="text-2xl font-bold" style={{ color: 'var(--text)' }}>{resultado.material.stock ?? 0}</div>
              <div className="text-xs" style={{ color: 'var(--text-subtle)' }}>{labelUnidad(resultado.material.unidad)}</div>
            </div>
            <button disabled={trabajando} onClick={() => ajustar(resultado.material, 1)} className="grid place-items-center rounded-xl" style={{ width: 46, height: 46, background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 22 }}>+</button>
          </div>
        </>
      ) : (
        <>
          <div className="text-xs font-semibold mb-1" style={{ color: 'var(--teal)' }}>EQUIPO</div>
          <h2 className="text-xl font-bold" style={{ color: 'var(--text)' }}>{resultado.equipo.codigo}</h2>
          <div className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {labelTipoEquipo(resultado.equipo.tipo)}{resultado.equipo.marca ? ` · ${resultado.equipo.marca}` : ''}{resultado.equipo.modelo ? ` ${resultado.equipo.modelo}` : ''}
          </div>
          <div className="mt-4">
            <span className="text-xs font-medium" style={{ color: 'var(--text-subtle)' }}>Estado</span>
            <select value={resultado.equipo.estado || ''} disabled={trabajando} onChange={(e) => cambiarEstado(resultado.equipo, e.target.value)} className="block mt-1 rounded-lg px-3 py-2 text-sm" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}>
              {Object.entries(ESTADOS_EQUIPO).map(([v, o]) => <option key={v} value={v}>{o.label}</option>)}
            </select>
          </div>
        </>
      )}

      <div className="flex gap-3 mt-5">
        <button onClick={onOtro} className="marca-gradiente rounded-xl px-4 py-2.5 font-semibold text-white text-sm">Escanear otro</button>
        <Link href="/inventario" className="rounded-xl px-4 py-2.5 font-semibold text-sm" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }}>Ir a inventario</Link>
      </div>
    </div>
  )
}
