'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import QRCode from 'qrcode'

export default function Equipos() {
  const [equipos, setEquipos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [editando, setEditando] = useState<any>(null)
  const router = useRouter()

  const [codigo, setCodigo] = useState('')
  const [tipo, setTipo] = useState('turbina')
  const [marca, setMarca] = useState('')
  const [modelo, setModelo] = useState('')
  const [estado, setEstado] = useState('disponible')
  const [ubicacion, setUbicacion] = useState('')
  const [notas, setNotas] = useState('')

  useEffect(() => {
    verificarSesion()
    cargarEquipos()
  }, [])

  async function verificarSesion() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) router.push('/login')
  }

  async function cargarEquipos() {
    const { data } = await supabase.from('equipos').select('*').order('codigo')
    if (data) setEquipos(data)
    setLoading(false)
  }

  function abrirForm(eq?: any) {
    if (eq) {
      setEditando(eq); setCodigo(eq.codigo || ''); setTipo(eq.tipo || 'turbina')
      setMarca(eq.marca || ''); setModelo(eq.modelo || ''); setEstado(eq.estado || 'disponible')
      setUbicacion(eq.ubicacion || ''); setNotas(eq.notas || '')
    } else {
      setEditando(null); setCodigo(''); setTipo('turbina'); setMarca('')
      setModelo(''); setEstado('disponible'); setUbicacion(''); setNotas('')
    }
    setMostrarForm(true)
  }

  async function guardarEquipo(e: React.FormEvent) {
    e.preventDefault()
    const datos = { codigo, tipo, marca, modelo, estado, ubicacion, notas }
    if (editando) {
      await supabase.from('equipos').update(datos).eq('id', editando.id)
    } else {
      await supabase.from('equipos').insert(datos)
    }
    setMostrarForm(false); setEditando(null); cargarEquipos()
  }

  async function cambiarEstado(id: string, nuevoEstado: string) {
    await supabase.from('equipos').update({ estado: nuevoEstado }).eq('id', id)
    cargarEquipos()
  }

  async function eliminarEquipo(id: string) {
    if (!confirm('Eliminar este equipo?')) return
    await supabase.from('equipos').delete().eq('id', id)
    cargarEquipos()
  }

  async function generarQREquipo(eq: any) {
    const datos = JSON.stringify({ tipo: 'equipo', id: eq.id, codigo: eq.codigo })
    const url = await QRCode.toDataURL(datos, { width: 300, margin: 2 })
    const win = window.open('', '_blank')
    if (win) {
      win.document.write(`<html><head><title>QR - ${eq.codigo}</title>
      <style>body{font-family:sans-serif;text-align:center;padding:30px;background:#fff}
      .etiqueta{border:2px solid #000;padding:20px;display:inline-block;border-radius:8px}
      h2{margin:10px 0 5px;font-size:18px;font-family:monospace;color:#7c3aed}
      p{margin:4px 0;font-size:13px;color:#444}
      @media print{button{display:none}}</style></head>
      <body><div class="etiqueta"><img src="${url}" style="width:200px;height:200px">
      <h2>${eq.codigo}</h2><p>${eq.tipo} ${eq.marca || ''} ${eq.modelo || ''}</p>
      <p>Ubicacion: ${eq.ubicacion || '—'}</p>
      <p style="font-size:10px;color:#999">Los Teros — Escanea para registrar movimiento</p></div>
      <br><button onclick="window.print()" style="padding:12px 24px;font-size:16px;cursor:pointer;background:#7c3aed;color:#fff;border:none;border-radius:8px;margin-top:10px">Imprimir</button>
      </body></html>`)
      win.document.close()
    }
  }

  async function generarQRTodos() {
    for (const eq of equipos) {
      const datos = JSON.stringify({ tipo: 'equipo', id: eq.id, codigo: eq.codigo })
      const url = await QRCode.toDataURL(datos, { width: 200, margin: 1 })
      eq._qrUrl = url
    }
    const win = window.open('', '_blank')
    if (win) {
      win.document.write(`<html><head><title>QR Todos los equipos</title>
      <style>body{font-family:sans-serif;padding:20px;background:#fff}
      h1{font-size:20px;margin-bottom:20px}.grid{display:flex;flex-wrap:wrap;gap:15px}
      .etiqueta{border:2px solid #000;padding:12px;border-radius:6px;text-align:center;width:180px}
      h3{margin:6px 0 3px;font-size:13px;font-family:monospace;color:#7c3aed}
      p{margin:2px 0;font-size:10px;color:#555}
      @media print{button{display:none}}</style></head>
      <body><h1>Los Teros — QR todos los equipos</h1>
      <button onclick="window.print()" style="padding:10px 20px;font-size:14px;cursor:pointer;background:#7c3aed;color:#fff;border:none;border-radius:6px;margin-bottom:20px">Imprimir todos</button>
      <div class="grid">${equipos.map(eq => `<div class="etiqueta">
        <img src="${eq._qrUrl}" style="width:140px;height:140px">
        <h3>${eq.codigo}</h3><p>${eq.tipo} ${eq.marca || ''}</p><p>${eq.modelo || ''}</p>
      </div>`).join('')}</div></body></html>`)
      win.document.close()
    }
  }

  const ESTADOS: any = {
    disponible: { bg: 'rgba(16,185,129,0.15)', color: '#34d399', label: 'Disponible' },
    en_cliente: { bg: 'rgba(234,179,8,0.15)', color: '#fbbf24', label: 'En cliente' },
    pendiente_limpieza: { bg: 'rgba(124,58,237,0.15)', color: '#a78bfa', label: 'Pend. limpieza' },
    pendiente_revision: { bg: 'rgba(6,182,212,0.15)', color: '#22d3ee', label: 'Pend. revision' },
    averiado: { bg: 'rgba(239,68,68,0.15)', color: '#f87171', label: 'Averiado' },
  }

  const enCliente = equipos.filter(e => e.estado === 'en_cliente')
  const pendientes = equipos.filter(e => e.estado === 'pendiente_limpieza' || e.estado === 'pendiente_revision')
  const disponibles = equipos.filter(e => e.estado === 'disponible')
  const inputStyle = { background: '#080b14', border: '1px solid #1e2d3d', color: 'white' }
  const cardStyle = { background: '#0d1117', border: '1px solid #1e2d3d' }

  return (
    <div className="min-h-screen" style={{ background: '#080b14' }}>
      <div className="px-6 py-4 flex items-center justify-between flex-wrap gap-3" style={cardStyle}>
        <div className="flex items-center gap-4">
          <a href="/dashboard" className="text-sm transition-colors" style={{ color: '#475569' }}
            onMouseEnter={e => e.currentTarget.style.color = '#06b6d4'}
            onMouseLeave={e => e.currentTarget.style.color = '#475569'}>Dashboard</a>
          <h1 className="text-white font-bold text-lg">Equipos de sustitucion</h1>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={generarQRTodos} className="text-sm px-4 py-2 rounded-xl font-medium"
            style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399', border: '1px solid rgba(16,185,129,0.3)' }}>
            QR todos
          </button>
          <button onClick={() => abrirForm()} className="text-white text-sm px-4 py-2 rounded-xl font-medium"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #06b6d4)' }}>
            + Nuevo equipo
          </button>
        </div>
      </div>

      <div className="p-6 max-w-6xl mx-auto">
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Disponibles', valor: disponibles.length, color: '#34d399', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.2)' },
            { label: 'En cliente', valor: enCliente.length, color: '#fbbf24', bg: 'rgba(234,179,8,0.08)', border: 'rgba(234,179,8,0.2)' },
            { label: 'Pendientes', valor: pendientes.length, color: '#a78bfa', bg: 'rgba(124,58,237,0.08)', border: 'rgba(124,58,237,0.2)' },
          ].map((s, i) => (
            <div key={i} className="rounded-2xl p-4 text-center" style={{ background: s.bg, border: `1px solid ${s.border}` }}>
              <p className="text-3xl font-bold" style={{ color: s.color }}>{s.valor}</p>
              <p className="text-sm mt-1" style={{ color: s.color }}>{s.label}</p>
            </div>
          ))}
        </div>

        {enCliente.length > 0 && (
          <div className="rounded-2xl p-4 mb-6" style={{ background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.2)' }}>
            <p className="font-medium text-sm mb-2" style={{ color: '#fbbf24' }}>Equipos en cliente ahora mismo</p>
            <div className="flex flex-wrap gap-2">
              {enCliente.map(e => (
                <span key={e.id} className="text-xs px-2 py-1 rounded-lg" style={{ background: 'rgba(234,179,8,0.15)', color: '#fbbf24' }}>
                  {e.codigo} — {e.tipo} {e.marca}
                </span>
              ))}
            </div>
          </div>
        )}

        {mostrarForm && (
          <div className="rounded-2xl p-6 mb-6" style={cardStyle}>
            <h2 className="text-white font-semibold mb-5">{editando ? 'Editar equipo' : 'Nuevo equipo'}</h2>
            <form onSubmit={guardarEquipo} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { label: 'Codigo', el: <input value={codigo} onChange={e => setCodigo(e.target.value)} required className="w-full rounded-xl px-3 py-2 text-white text-sm outline-none" style={inputStyle} placeholder="TRB-001" /> },
                { label: 'Tipo', el: <select value={tipo} onChange={e => setTipo(e.target.value)} className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={inputStyle}>
                  <option value="turbina">Turbina</option><option value="motor">Motor</option>
                  <option value="caja_extraccion">Caja extraccion</option><option value="otro">Otro</option>
                </select> },
                { label: 'Marca', el: <input value={marca} onChange={e => setMarca(e.target.value)} className="w-full rounded-xl px-3 py-2 text-white text-sm outline-none" style={inputStyle} placeholder="Soler&Palau" /> },
                { label: 'Modelo', el: <input value={modelo} onChange={e => setModelo(e.target.value)} className="w-full rounded-xl px-3 py-2 text-white text-sm outline-none" style={inputStyle} placeholder="CVST-25/13" /> },
                { label: 'Estado', el: <select value={estado} onChange={e => setEstado(e.target.value)} className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={inputStyle}>
                  <option value="disponible">Disponible</option><option value="en_cliente">En cliente</option>
                  <option value="pendiente_limpieza">Pendiente limpieza</option>
                  <option value="pendiente_revision">Pendiente revision</option><option value="averiado">Averiado</option>
                </select> },
                { label: 'Ubicacion', el: <input value={ubicacion} onChange={e => setUbicacion(e.target.value)} className="w-full rounded-xl px-3 py-2 text-white text-sm outline-none" style={inputStyle} placeholder="Nave principal, zona A" /> },
              ].map((f, i) => (
                <div key={i}>
                  <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: '#475569' }}>{f.label}</label>
                  {f.el}
                </div>
              ))}
              <div className="md:col-span-2">
                <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: '#475569' }}>Notas tecnicas</label>
                <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={2}
                  className="w-full rounded-xl px-3 py-2 text-white text-sm outline-none resize-none" style={inputStyle} />
              </div>
              <div className="md:col-span-2 flex gap-3">
                <button type="submit" className="text-white px-5 py-2 rounded-xl text-sm font-medium"
                  style={{ background: 'linear-gradient(135deg, #7c3aed, #06b6d4)' }}>
                  {editando ? 'Actualizar' : 'Guardar'}
                </button>
                <button type="button" onClick={() => setMostrarForm(false)} className="text-sm px-5 py-2 rounded-xl"
                  style={{ background: '#080b14', color: '#64748b', border: '1px solid #1e2d3d' }}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#7c3aed', borderTopColor: 'transparent' }}></div>
          </div>
        ) : equipos.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-5xl mb-4">⚙️</p>
            <p style={{ color: '#475569' }}>No hay equipos registrados.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {equipos.map(e => (
              <div key={e.id} className="rounded-2xl p-5 transition-all" style={cardStyle}
                onMouseEnter={el => el.currentTarget.style.borderColor = '#7c3aed'}
                onMouseLeave={el => el.currentTarget.style.borderColor = '#1e2d3d'}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-mono text-sm font-bold" style={{ color: '#06b6d4' }}>{e.codigo}</p>
                    <p className="text-white font-semibold mt-1 capitalize">{e.tipo.replace('_', ' ')}</p>
                    <p className="text-sm" style={{ color: '#64748b' }}>{e.marca} {e.modelo}</p>
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full" style={{ background: ESTADOS[e.estado]?.bg, color: ESTADOS[e.estado]?.color }}>
                    {ESTADOS[e.estado]?.label || e.estado}
                  </span>
                </div>
                {e.ubicacion && <p className="text-xs mb-3" style={{ color: '#475569' }}>📍 {e.ubicacion}</p>}
                {e.notas && <p className="text-xs mb-3" style={{ color: '#475569' }}>{e.notas}</p>}
                <div className="flex flex-wrap gap-2 pt-3" style={{ borderTop: '1px solid #1e2d3d' }}>
                  {(e.estado === 'pendiente_limpieza' || e.estado === 'pendiente_revision') && (
                    <button onClick={() => cambiarEstado(e.id, 'disponible')} className="text-xs px-3 py-1 rounded-lg"
                      style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399', border: '1px solid rgba(16,185,129,0.3)' }}>
                      Disponible
                    </button>
                  )}
                  {e.estado === 'disponible' && (
                    <button onClick={() => cambiarEstado(e.id, 'en_cliente')} className="text-xs px-3 py-1 rounded-lg"
                      style={{ background: 'rgba(234,179,8,0.15)', color: '#fbbf24', border: '1px solid rgba(234,179,8,0.3)' }}>
                      Enviar cliente
                    </button>
                  )}
                  {e.estado === 'en_cliente' && (
                    <button onClick={() => cambiarEstado(e.id, 'pendiente_limpieza')} className="text-xs px-3 py-1 rounded-lg"
                      style={{ background: 'rgba(124,58,237,0.15)', color: '#a78bfa', border: '1px solid rgba(124,58,237,0.3)' }}>
                      Devolver
                    </button>
                  )}
                  <button onClick={() => generarQREquipo(e)} className="text-xs px-3 py-1 rounded-lg"
                    style={{ background: 'rgba(16,185,129,0.1)', color: '#34d399', border: '1px solid rgba(16,185,129,0.2)' }}>
                    QR
                  </button>
                  <button onClick={() => abrirForm(e)} className="text-xs px-3 py-1 rounded-lg"
                    style={{ background: 'rgba(124,58,237,0.1)', color: '#a78bfa', border: '1px solid rgba(124,58,237,0.2)' }}>
                    Editar
                  </button>
                  <button onClick={() => eliminarEquipo(e.id)} className="text-xs px-3 py-1 rounded-lg"
                    style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}