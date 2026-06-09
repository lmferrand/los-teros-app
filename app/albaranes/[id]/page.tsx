'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { obtenerAlbaran, actualizarAlbaran, borrarAlbaran, subirFotoAlbaran, subirFirma, type AlbaranConRefs } from '@/lib/db/albaranes'
import { ESTADOS_ALBARAN, ESTADOS_ALBARAN_LISTA } from '@/lib/albaranes'
import { fechaCorta } from '@/lib/dominio'
import { comprimirImagen } from '@/lib/imagen'
import { generarPdfAlbaran } from '@/lib/pdf-albaran'
import { Campo, SkeletonLista } from '@/app/components/ui'
import FirmaPad from '@/app/components/FirmaPad'
import { AlbaranForm, ChipEstadoAlbaran } from '../page'

export default function FichaAlbaran() {
  const id = useParams<{ id: string }>().id
  const router = useRouter()
  const [a, setA] = useState<AlbaranConRefs | null>(null)
  const [cargando, setCargando] = useState(true)
  const [editar, setEditar] = useState(false)
  const [firmando, setFirmando] = useState<'empleado' | 'cliente' | null>(null)
  const [subiendo, setSubiendo] = useState(false)

  async function cargar() { setA(await obtenerAlbaran(id)); setCargando(false) }
  useEffect(() => { cargar() }, [id])

  async function cambiarEstado(estado: string) { await actualizarAlbaran(id, { estado }); cargar() }
  async function eliminar() {
    if (!confirm('¿Eliminar este albarán?')) return
    await borrarAlbaran(id); router.push('/albaranes')
  }
  async function añadirFoto(file: File) {
    setSubiendo(true)
    try {
      const blob = await comprimirImagen(file)
      const url = await subirFotoAlbaran(id, blob)
      await actualizarAlbaran(id, { fotos_urls: [...(a?.fotos_urls || []), url] })
      cargar()
    } finally { setSubiendo(false) }
  }
  async function quitarFoto(url: string) {
    await actualizarAlbaran(id, { fotos_urls: (a?.fotos_urls || []).filter((u) => u !== url) })
    cargar()
  }
  async function guardarFirma(rol: 'empleado' | 'cliente', blob: Blob) {
    const url = await subirFirma(id, rol, blob)
    const ahora = new Date().toISOString()
    const patch: any = rol === 'empleado'
      ? { firma_empleado_url: url, firmado_empleado_at: ahora }
      : { firma_cliente_url: url, firmado_cliente_at: ahora, firmado: true }
    if (rol === 'cliente' && (a?.estado === 'pendiente' || a?.estado === 'entregado')) patch.estado = 'firmado'
    await actualizarAlbaran(id, patch)
    setFirmando(null)
    cargar()
  }

  if (cargando) return <SkeletonLista filas={4} />
  if (!a) return <div className="card p-6 text-sm" style={{ color: 'var(--text-muted)' }}>No se encontró el albarán.</div>

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <Link href="/albaranes" className="text-sm inline-flex items-center gap-1 mb-2" style={{ color: 'var(--text-subtle)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m15 18-6-6 6-6" /></svg>
            Albaranes
          </Link>
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="titulo-hero" style={{ color: 'var(--text)' }}>{a.razon_social || a.clientes?.nombre || 'Sin cliente'}</h1>
            <ChipEstadoAlbaran estado={a.estado} />
          </div>
          <div className="text-sm mt-1 flex items-center gap-2 flex-wrap" style={{ color: 'var(--text-muted)' }}>
            <span>{a.numero}</span><span>·</span><span>{fechaCorta(a.fecha)}</span>
            {a.ordenes?.codigo && <><span>·</span><span>OT {a.ordenes.codigo}</span></>}
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => generarPdfAlbaran(a)} className="rounded-xl px-4 py-2 font-semibold text-sm marca-gradiente text-white">PDF</button>
          <button onClick={() => setEditar(true)} className="rounded-xl px-4 py-2 font-semibold text-sm" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text)' }}>Editar</button>
          <button onClick={eliminar} className="rounded-xl px-3 py-2 font-semibold text-sm" style={{ background: 'color-mix(in srgb, var(--red) 10%, transparent)', color: 'var(--red)' }}>Eliminar</button>
        </div>
      </header>

      {/* Estado */}
      <section className="card p-5">
        <h2 className="font-semibold mb-3" style={{ color: 'var(--text)' }}>Estado</h2>
        <div className="flex flex-wrap gap-2">
          {ESTADOS_ALBARAN_LISTA.map((e) => {
            const on = a.estado === e; const c = ESTADOS_ALBARAN[e].color
            return <button key={e} onClick={() => cambiarEstado(e)} className="text-sm font-semibold rounded-xl px-3 py-2" style={{ background: on ? `color-mix(in srgb, ${c} 16%, transparent)` : 'var(--bg)', color: on ? c : 'var(--text-muted)', border: `1px solid ${on ? c : 'var(--border)'}` }}>{ESTADOS_ALBARAN[e].label}</button>
          })}
        </div>
      </section>

      {/* Datos */}
      <section className="card p-5">
        <h2 className="font-semibold mb-4" style={{ color: 'var(--text)' }}>Datos</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Campo label="CIF">{a.cif}</Campo>
          <Campo label="Teléfono">{a.telefono}</Campo>
          <Campo label="Email">{a.email}</Campo>
          <Campo label="Domicilio">{a.domicilio}</Campo>
          <Campo label="Localidad">{[a.localidad, a.provincia].filter(Boolean).join(', ')}</Campo>
          <Campo label="Responsable">{a.responsable}</Campo>
          <Campo label="Instalación">{a.instalacion}</Campo>
          <Campo label="Descripción">{a.descripcion}</Campo>
          <Campo label="Observaciones">{a.observaciones}</Campo>
        </div>
      </section>

      {/* Fotos */}
      <section className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold" style={{ color: 'var(--text)' }}>Fotos</h2>
          <label className="text-xs font-semibold rounded-lg px-3 py-1.5 cursor-pointer" style={{ background: 'var(--bg-subtle)', color: 'var(--brand-1)' }}>
            {subiendo ? 'Subiendo…' : '+ Añadir'}
            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) añadirFoto(f) }} />
          </label>
        </div>
        {(a.fotos_urls || []).length === 0 ? <p className="text-sm" style={{ color: 'var(--text-subtle)' }}>Sin fotos.</p> : (
          <div className="flex flex-wrap gap-2">
            {(a.fotos_urls || []).map((url) => (
              <div key={url} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <a href={url} target="_blank" rel="noreferrer"><img src={url} alt="foto" style={{ width: 88, height: 88, objectFit: 'cover', borderRadius: 10, border: '1px solid var(--border)' }} /></a>
                <button onClick={() => quitarFoto(url)} className="absolute -top-1.5 -right-1.5 grid place-items-center rounded-full text-white" style={{ width: 20, height: 20, background: 'var(--red)', fontSize: 12 }}>×</button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Firmas */}
      <section className="card p-5">
        <h2 className="font-semibold mb-3" style={{ color: 'var(--text)' }}>Firmas</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(['empleado', 'cliente'] as const).map((rol) => {
            const url = rol === 'empleado' ? a.firma_empleado_url : a.firma_cliente_url
            const fecha = rol === 'empleado' ? a.firmado_empleado_at : a.firmado_cliente_at
            return (
              <div key={rol} className="rounded-xl p-3" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                <div className="text-sm font-semibold mb-2 capitalize" style={{ color: 'var(--text)' }}>Firma {rol}</div>
                {url ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={`firma ${rol}`} style={{ width: '100%', height: 90, objectFit: 'contain', background: '#fff', borderRadius: 8 }} />
                    <div className="text-xs mt-1" style={{ color: 'var(--text-subtle)' }}>{fechaCorta(fecha)}</div>
                  </>
                ) : <p className="text-sm mb-2" style={{ color: 'var(--text-subtle)' }}>Sin firmar.</p>}
                <button onClick={() => setFirmando(rol)} className="text-xs font-semibold rounded-lg px-3 py-1.5 mt-2" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--brand-1)' }}>{url ? 'Volver a firmar' : 'Firmar'}</button>
              </div>
            )
          })}
        </div>
      </section>

      {editar && <AlbaranForm albaran={a} onCerrar={() => setEditar(false)} onGuardado={() => { setEditar(false); cargar() }} />}
      {firmando && <FirmaPad titulo={`Firma ${firmando}`} onGuardar={(blob) => guardarFirma(firmando, blob)} onCerrar={() => setFirmando(null)} />}
    </div>
  )
}
