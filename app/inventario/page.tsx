'use client'

import { s } from '@/lib/styles'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import QRCode from 'qrcode'

export default function Inventario() {
  const [materiales, setMateriales] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [editando, setEditando] = useState<any>(null)
  const router = useRouter()

  const [nombre, setNombre] = useState('')
  const [referencia, setReferencia] = useState('')
  const [categoria, setCategoria] = useState('limpieza')
  const [unidad, setUnidad] = useState('unidad')
  const [stock, setStock] = useState('0')
  const [minimo, setMinimo] = useState('5')
  const [ubicacion, setUbicacion] = useState('')
  const [notas, setNotas] = useState('')
  const [fotoUrl, setFotoUrl] = useState('')
  const [subiendo, setSubiendo] = useState(false)

  useEffect(() => {
    verificarSesion()
    cargarMateriales()
  }, [])

  async function verificarSesion() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) router.push('/login')
  }

  async function cargarMateriales() {
    const { data } = await supabase.from('materiales').select('*').order('nombre')
    if (data) setMateriales(data)
    setLoading(false)
  }

  async function subirFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setSubiendo(true)
    const nombre_archivo = `materiales/${Date.now()}-${file.name}`
    const { data, error } = await supabase.storage.from('fotos-materiales').upload(nombre_archivo, file)
    if (!error && data) {
      const { data: urlData } = supabase.storage.from('fotos-materiales').getPublicUrl(nombre_archivo)
      setFotoUrl(urlData.publicUrl)
    }
    setSubiendo(false)
  }

  function abrirForm(mat?: any) {
    if (mat) {
      setEditando(mat)
      setNombre(mat.nombre || ''); setReferencia(mat.referencia || '')
      setCategoria(mat.categoria || 'limpieza'); setUnidad(mat.unidad || 'unidad')
      setStock(String(mat.stock || 0)); setMinimo(String(mat.minimo || 5))
      setUbicacion(mat.ubicacion || ''); setNotas(mat.notas || ''); setFotoUrl(mat.foto_url || '')
    } else {
      setEditando(null)
      setNombre(''); setReferencia(''); setCategoria('limpieza'); setUnidad('unidad')
      setStock('0'); setMinimo('5'); setUbicacion(''); setNotas(''); setFotoUrl('')
    }
    setMostrarForm(true)
  }

  async function guardarMaterial(e: React.FormEvent) {
    e.preventDefault()
    const datos = { nombre, referencia, categoria, unidad, stock: parseFloat(stock) || 0, minimo: parseFloat(minimo) || 0, ubicacion, notas, foto_url: fotoUrl || null }
    if (editando) {
      await supabase.from('materiales').update(datos).eq('id', editando.id)
    } else {
      await supabase.from('materiales').insert(datos)
    }
    setMostrarForm(false); setEditando(null); cargarMateriales()
  }

  async function ajustarStock(id: string, cantidad: number) {
    const mat = materiales.find(m => m.id === id)
    if (!mat) return
    const nuevoStock = Math.max(0, (mat.stock || 0) + cantidad)
    await supabase.from('materiales').update({ stock: nuevoStock }).eq('id', id)
    cargarMateriales()
  }

  async function eliminarMaterial(id: string) {
    if (!confirm('Eliminar este material?')) return
    await supabase.from('materiales').delete().eq('id', id)
    cargarMateriales()
  }

  async function generarQR(mat: any) {
    const datos = JSON.stringify({ tipo: 'material', id: mat.id, nombre: mat.nombre })
    const url = await QRCode.toDataURL(datos, { width: 300, margin: 2 })
    const win = window.open('', '_blank')
    if (win) {
      win.document.write(`<html><head><title>QR - ${mat.nombre}</title>
      <style>body{font-family:sans-serif;text-align:center;padding:30px;background:#fff}
      .etiqueta{border:2px solid #000;padding:20px;display:inline-block;border-radius:8px}
      h2{margin:10px 0 5px;font-size:18px}p{margin:4px 0;font-size:13px;color:#444}
      @media print{button{display:none}}</style></head>
      <body><div class="etiqueta"><img src="${url}" style="width:200px;height:200px">
      <h2>${mat.nombre}</h2><p>Ref: ${mat.referencia || '—'}</p>
      <p>Ubicacion: ${mat.ubicacion || '—'}</p><p>Stock: ${mat.stock || 0} ${mat.unidad || ''}</p>
      <p style="font-size:10px;color:#999">Los Teros — Escanea para registrar salida</p></div>
      <br><button onclick="window.print()" style="padding:12px 24px;font-size:16px;cursor:pointer;background:#7c3aed;color:#fff;border:none;border-radius:8px;margin-top:10px">Imprimir</button>
      </body></html>`)
      win.document.close()
    }
  }

  const stockBajo = materiales.filter(m => (m.stock || 0) < (m.minimo || 0))

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <div className="px-6 py-4 flex items-center justify-between flex-wrap gap-3" style={s.cardStyle}>
        <div className="flex items-center gap-4">
          <a href="/dashboard" className="text-sm transition-colors" style={{ color: '#475569' }}
            onMouseEnter={e => e.currentTarget.style.color = '#06b6d4'}
            onMouseLeave={e => e.currentTarget.style.color = '#475569'}>Dashboard</a>
          <h1 className="text-white font-bold text-lg">Inventario</h1>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/escanear')} className="text-sm px-4 py-2 rounded-xl font-medium"
            style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399', border: '1px solid rgba(16,185,129,0.3)' }}>
            Escanear QR
          </button>
          <button onClick={() => abrirForm()} className="text-white text-sm px-4 py-2 rounded-xl font-medium"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #06b6d4)' }}>
            + Nuevo material
          </button>
        </div>
      </div>

      <div className="p-6 max-w-6xl mx-auto">
        {stockBajo.length > 0 && (
          <div className="rounded-2xl p-4 mb-6" style={{ background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.25)' }}>
            <p className="font-medium text-sm mb-2" style={{ color: '#fbbf24' }}>Alerta stock bajo — {stockBajo.length} materiales</p>
            <div className="flex flex-wrap gap-2">
              {stockBajo.map(m => (
                <span key={m.id} className="text-xs px-2 py-1 rounded-lg" style={{ background: 'rgba(234,179,8,0.15)', color: '#fbbf24' }}>
                  {m.nombre}: {m.stock} {m.unidad} (min: {m.minimo})
                </span>
              ))}
            </div>
          </div>
        )}

        {mostrarForm && (
          <div className="rounded-2xl p-6 mb-6" style={s.cardStyle}>
            <h2 className="text-white font-semibold mb-5">{editando ? 'Editar material' : 'Nuevo material'}</h2>
            <form onSubmit={guardarMaterial} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { label: 'Nombre', el: <input value={nombre} onChange={e => setNombre(e.target.value)} required className="w-full rounded-xl px-3 py-2 text-white text-sm outline-none" style={s.inputStyle} placeholder="Desengrasante industrial" /> },
                { label: 'Referencia', el: <input value={referencia} onChange={e => setReferencia(e.target.value)} className="w-full rounded-xl px-3 py-2 text-white text-sm outline-none" style={s.inputStyle} placeholder="REF-001" /> },
                { label: 'Categoria', el: <select value={categoria} onChange={e => setCategoria(e.target.value)} className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={s.inputStyle}>
                  <option value="limpieza">Limpieza</option><option value="filtros">Filtros</option>
                  <option value="repuestos">Repuestos</option><option value="instalacion">Instalacion</option><option value="otro">Otro</option>
                </select> },
                { label: 'Unidad', el: <select value={unidad} onChange={e => setUnidad(e.target.value)} className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={s.inputStyle}>
                  <option value="unidad">Unidad</option><option value="litro">Litro</option>
                  <option value="kg">Kg</option><option value="metro">Metro</option><option value="caja">Caja</option><option value="rollo">Rollo</option>
                </select> },
                { label: 'Stock actual', el: <input type="number" value={stock} onChange={e => setStock(e.target.value)} className="w-full rounded-xl px-3 py-2 text-white text-sm outline-none" style={s.inputStyle} /> },
                { label: 'Stock minimo', el: <input type="number" value={minimo} onChange={e => setMinimo(e.target.value)} className="w-full rounded-xl px-3 py-2 text-white text-sm outline-none" style={s.inputStyle} /> },
                { label: 'Ubicacion', el: <input value={ubicacion} onChange={e => setUbicacion(e.target.value)} className="w-full rounded-xl px-3 py-2 text-white text-sm outline-none" style={s.inputStyle} placeholder="Estanteria A, balda 3" /> },
                { label: 'Notas', el: <input value={notas} onChange={e => setNotas(e.target.value)} className="w-full rounded-xl px-3 py-2 text-white text-sm outline-none" style={s.inputStyle} placeholder="Proveedor, especificaciones..." /> },
              ].map((f, i) => (
                <div key={i}>
                  <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: '#475569' }}>{f.label}</label>
                  {f.el}
                </div>
              ))}
              <div className="md:col-span-2">
                <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: '#475569' }}>Foto del material</label>
                <input type="file" accept="image/*" onChange={subirFoto} className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={s.inputStyle} />
                {subiendo && <p className="text-xs mt-1" style={{ color: '#06b6d4' }}>Subiendo foto...</p>}
                {fotoUrl && <img src={fotoUrl} alt="foto" className="mt-2 h-20 w-20 object-cover rounded-xl" style={{ border: '1px solid #1e2d3d' }} />}
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
        ) : materiales.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-5xl mb-4">📦</p>
            <p style={{ color: '#475569' }}>No hay materiales. Añade el primero.</p>
          </div>
        ) : (
          <div className="rounded-2xl overflow-hidden" style={s.cardStyle}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid #1e2d3d' }}>
                  {['Foto', 'Material', 'Categoria', 'Stock', 'Minimo', 'Ubicacion', ''].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs uppercase tracking-wider" style={{ color: '#475569' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {materiales.map(m => (
                  <tr key={m.id} style={{ borderBottom: '1px solid #1e2d3d' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(124,58,237,0.05)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <td className="px-4 py-3">
                      {m.foto_url ? (
                        <img src={m.foto_url} alt={m.nombre} className="w-10 h-10 object-cover rounded-xl" style={{ border: '1px solid #1e2d3d' }} />
                      ) : (
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg" style={{ background: '#080b14', border: '1px solid #1e2d3d' }}>📦</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-white font-medium">{m.nombre}</p>
                      <p className="text-xs" style={{ color: '#475569' }}>{m.referencia}</p>
                    </td>
                    <td className="px-4 py-3 text-sm capitalize" style={{ color: '#64748b' }}>{m.categoria}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => ajustarStock(m.id, -1)} className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold transition-colors"
                          style={{ background: '#080b14', color: '#64748b', border: '1px solid #1e2d3d' }}>-</button>
                        <span className="font-mono font-bold text-sm" style={{ color: (m.stock || 0) < (m.minimo || 0) ? '#f87171' : '#34d399' }}>
                          {m.stock || 0} {m.unidad}
                        </span>
                        <button onClick={() => ajustarStock(m.id, 1)} className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold transition-colors"
                          style={{ background: '#080b14', color: '#64748b', border: '1px solid #1e2d3d' }}>+</button>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: '#64748b' }}>{m.minimo || 0} {m.unidad}</td>
                    <td className="px-4 py-3 text-xs" style={{ color: '#64748b' }}>{m.ubicacion || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => generarQR(m)} className="text-xs px-2 py-1 rounded-lg transition-colors"
                          style={{ color: '#34d399', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}>QR</button>
                        <button onClick={() => abrirForm(m)} className="text-xs px-2 py-1 rounded-lg transition-colors"
                          style={{ color: '#a78bfa', background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.2)' }}>Editar</button>
                        <button onClick={() => eliminarMaterial(m.id)} className="text-xs px-2 py-1 rounded-lg transition-colors"
                          style={{ color: '#f87171', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>Eliminar</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}