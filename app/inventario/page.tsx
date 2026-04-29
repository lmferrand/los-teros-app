'use client'

import { s } from '@/lib/styles'
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import QRCode from 'qrcode'
import AppHeader from '@/app/components/AppHeader'

type VistaInventario = 'materiales' | 'equipos'

export default function Inventario() {
  const [materiales, setMateriales] = useState<any[]>([])
  const [equipos, setEquipos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [vista, setVista] = useState<VistaInventario>('materiales')
  const [mostrarFormMaterial, setMostrarFormMaterial] = useState(false)
  const [mostrarFormEquipo, setMostrarFormEquipo] = useState(false)
  const [editandoMaterial, setEditandoMaterial] = useState<any>(null)
  const [editandoEquipo, setEditandoEquipo] = useState<any>(null)
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

  const [codigoEq, setCodigoEq] = useState('')
  const [tipoEq, setTipoEq] = useState('turbina')
  const [marcaEq, setMarcaEq] = useState('')
  const [modeloEq, setModeloEq] = useState('')
  const [estadoEq, setEstadoEq] = useState('disponible')
  const [ubicacionEq, setUbicacionEq] = useState('')
  const [notasEq, setNotasEq] = useState('')

  const verificarSesion = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session) router.push('/login')
  }, [router])

  const cargarTodo = useCallback(async () => {
    const [mats, eqs] = await Promise.all([
      supabase.from('materiales').select('*').order('nombre'),
      supabase.from('equipos').select('*').order('codigo'),
    ])
    if (mats.data) setMateriales(mats.data)
    if (eqs.data) setEquipos(eqs.data)
    setLoading(false)
  }, [])

  useEffect(() => {
    void verificarSesion()
    void cargarTodo()
  }, [verificarSesion, cargarTodo])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const tab = String(params.get('tab') || '').toLowerCase()
    if (tab === 'equipos') setVista('equipos')
  }, [])

  function cambiarVista(nuevaVista: VistaInventario) {
    setVista(nuevaVista)
    const query = nuevaVista === 'equipos' ? '?tab=equipos' : ''
    router.replace(`/inventario${query}`)
  }

  async function subirFotoMaterial(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setSubiendo(true)
    const nombreArchivo = `materiales/${Date.now()}-${file.name}`
    const { data, error } = await supabase.storage.from('fotos-materiales').upload(nombreArchivo, file)
    if (!error && data) {
      const { data: urlData } = supabase.storage.from('fotos-materiales').getPublicUrl(nombreArchivo)
      setFotoUrl(urlData.publicUrl)
    }
    setSubiendo(false)
  }

  function abrirFormMaterial(mat?: any) {
    if (mat) {
      setEditandoMaterial(mat)
      setNombre(mat.nombre || '')
      setReferencia(mat.referencia || '')
      setCategoria(mat.categoria || 'limpieza')
      setUnidad(mat.unidad || 'unidad')
      setStock(String(mat.stock || 0))
      setMinimo(String(mat.minimo || 5))
      setUbicacion(mat.ubicacion || '')
      setNotas(mat.notas || '')
      setFotoUrl(mat.foto_url || '')
    } else {
      setEditandoMaterial(null)
      setNombre('')
      setReferencia('')
      setCategoria('limpieza')
      setUnidad('unidad')
      setStock('0')
      setMinimo('5')
      setUbicacion('')
      setNotas('')
      setFotoUrl('')
    }
    setMostrarFormMaterial(true)
  }

  async function guardarMaterial(e: React.FormEvent) {
    e.preventDefault()
    const datos = {
      nombre,
      referencia,
      categoria,
      unidad,
      stock: parseFloat(stock) || 0,
      minimo: parseFloat(minimo) || 0,
      ubicacion,
      notas,
      foto_url: fotoUrl || null,
    }
    if (editandoMaterial) {
      await supabase.from('materiales').update(datos).eq('id', editandoMaterial.id)
    } else {
      await supabase.from('materiales').insert(datos)
    }
    setMostrarFormMaterial(false)
    setEditandoMaterial(null)
    cargarTodo()
  }

  async function ajustarStock(id: string, cantidad: number) {
    const mat = materiales.find((m) => m.id === id)
    if (!mat) return
    const nuevoStock = Math.max(0, (mat.stock || 0) + cantidad)
    await supabase.from('materiales').update({ stock: nuevoStock }).eq('id', id)
    cargarTodo()
  }

  async function eliminarMaterial(id: string) {
    if (!confirm('Eliminar este material?')) return
    await supabase.from('materiales').delete().eq('id', id)
    cargarTodo()
  }

  async function generarQRMaterial(mat: any) {
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
      <h2>${mat.nombre}</h2><p>Ref: ${mat.referencia || '-'}</p>
      <p>Ubicacion: ${mat.ubicacion || '-'}</p><p>Stock: ${mat.stock || 0} ${mat.unidad || ''}</p>
      <p style="font-size:10px;color:#999">Los Teros - Escanea para registrar salida</p></div>
      <br><button onclick="window.print()" style="padding:12px 24px;font-size:16px;cursor:pointer;background:#7c3aed;color:#fff;border:none;border-radius:8px;margin-top:10px">Imprimir</button>
      </body></html>`)
      win.document.close()
    }
  }

  function abrirFormEquipo(eq?: any) {
    if (eq) {
      setEditandoEquipo(eq)
      setCodigoEq(eq.codigo || '')
      setTipoEq(eq.tipo || 'turbina')
      setMarcaEq(eq.marca || '')
      setModeloEq(eq.modelo || '')
      setEstadoEq(eq.estado || 'disponible')
      setUbicacionEq(eq.ubicacion || '')
      setNotasEq(eq.notas || '')
    } else {
      setEditandoEquipo(null)
      setCodigoEq('')
      setTipoEq('turbina')
      setMarcaEq('')
      setModeloEq('')
      setEstadoEq('disponible')
      setUbicacionEq('')
      setNotasEq('')
    }
    setMostrarFormEquipo(true)
  }

  async function guardarEquipo(e: React.FormEvent) {
    e.preventDefault()
    const datos = {
      codigo: codigoEq,
      tipo: tipoEq,
      marca: marcaEq,
      modelo: modeloEq,
      estado: estadoEq,
      ubicacion: ubicacionEq,
      notas: notasEq,
    }
    if (editandoEquipo) {
      await supabase.from('equipos').update(datos).eq('id', editandoEquipo.id)
    } else {
      await supabase.from('equipos').insert(datos)
    }
    setMostrarFormEquipo(false)
    setEditandoEquipo(null)
    cargarTodo()
  }

  async function cambiarEstadoEquipo(id: string, nuevoEstado: string) {
    await supabase.from('equipos').update({ estado: nuevoEstado }).eq('id', id)
    cargarTodo()
  }

  async function eliminarEquipo(id: string) {
    if (!confirm('Eliminar este equipo?')) return
    await supabase.from('equipos').delete().eq('id', id)
    cargarTodo()
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
      <p>Ubicacion: ${eq.ubicacion || '-'}</p>
      <p style="font-size:10px;color:#999">Los Teros - Escanea para registrar movimiento</p></div>
      <br><button onclick="window.print()" style="padding:12px 24px;font-size:16px;cursor:pointer;background:#7c3aed;color:#fff;border:none;border-radius:8px;margin-top:10px">Imprimir</button>
      </body></html>`)
      win.document.close()
    }
  }

  async function generarQRTodosEquipos() {
    const equiposConQr = await Promise.all(
      equipos.map(async (eq) => {
        const datos = JSON.stringify({ tipo: 'equipo', id: eq.id, codigo: eq.codigo })
        const qrUrl = await QRCode.toDataURL(datos, { width: 200, margin: 1 })
        return { ...eq, qrUrl }
      })
    )
    const win = window.open('', '_blank')
    if (win) {
      win.document.write(`<html><head><title>QR Todos los equipos</title>
      <style>body{font-family:sans-serif;padding:20px;background:#fff}
      h1{font-size:20px;margin-bottom:20px}.grid{display:flex;flex-wrap:wrap;gap:15px}
      .etiqueta{border:2px solid #000;padding:12px;border-radius:6px;text-align:center;width:180px}
      h3{margin:6px 0 3px;font-size:13px;font-family:monospace;color:#7c3aed}
      p{margin:2px 0;font-size:10px;color:#555}
      @media print{button{display:none}}</style></head>
      <body><h1>Los Teros - QR todos los equipos</h1>
      <button onclick="window.print()" style="padding:10px 20px;font-size:14px;cursor:pointer;background:#7c3aed;color:#fff;border:none;border-radius:6px;margin-bottom:20px">Imprimir todos</button>
      <div class="grid">${equiposConQr.map(eq => `<div class="etiqueta">
        <img src="${eq.qrUrl}" style="width:140px;height:140px">
        <h3>${eq.codigo}</h3><p>${eq.tipo} ${eq.marca || ''}</p><p>${eq.modelo || ''}</p>
      </div>`).join('')}</div></body></html>`)
      win.document.close()
    }
  }

  const stockBajo = materiales.filter((m) => (m.stock || 0) < (m.minimo || 0))

  const ESTADOS_EQUIPO: any = {
    disponible: { color: '#34d399', bg: 'rgba(16,185,129,0.15)', label: 'Disponible' },
    en_cliente: { color: '#fbbf24', bg: 'rgba(234,179,8,0.15)', label: 'En cliente' },
    pendiente_limpieza: { color: '#a78bfa', bg: 'rgba(124,58,237,0.15)', label: 'Pend. limpieza' },
    pendiente_revision: { color: '#22d3ee', bg: 'rgba(6,182,212,0.15)', label: 'Pend. revision' },
    averiado: { color: '#f87171', bg: 'rgba(239,68,68,0.15)', label: 'Averiado' },
  }

  const enCliente = equipos.filter((e) => e.estado === 'en_cliente')
  const pendientes = equipos.filter((e) => e.estado === 'pendiente_limpieza' || e.estado === 'pendiente_revision')
  const disponibles = equipos.filter((e) => e.estado === 'disponible')

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <AppHeader
        title="Inventario y equipos"
        rightSlot={(
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => router.push('/escanear')}
              className="text-sm px-4 py-2 rounded-xl font-medium"
              style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399', border: '1px solid rgba(16,185,129,0.3)' }}
            >
              Escanear QR
            </button>
            {vista === 'materiales' ? (
              <button onClick={() => abrirFormMaterial()} className="text-sm px-4 py-2 rounded-xl font-medium" style={s.btnPrimary}>
                + Nuevo material
              </button>
            ) : (
              <>
                <button onClick={generarQRTodosEquipos} className="text-sm px-4 py-2 rounded-xl font-medium" style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399', border: '1px solid rgba(16,185,129,0.3)' }}>
                  QR todos
                </button>
                <button onClick={() => abrirFormEquipo()} className="text-sm px-4 py-2 rounded-xl font-medium" style={s.btnPrimary}>
                  + Nuevo equipo
                </button>
              </>
            )}
          </div>
        )}
      />

      <div className="p-6 max-w-6xl mx-auto">
        <div className="mb-5 inline-flex rounded-xl p-1" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <button
            onClick={() => cambiarVista('materiales')}
            className="px-4 py-2 rounded-lg text-sm"
            style={vista === 'materiales' ? s.btnPrimary : s.btnSecondary}
          >
            Inventario
          </button>
          <button
            onClick={() => cambiarVista('equipos')}
            className="px-4 py-2 rounded-lg text-sm"
            style={vista === 'equipos' ? s.btnPrimary : s.btnSecondary}
          >
            Equipos
          </button>
        </div>

        {vista === 'materiales' && stockBajo.length > 0 && (
          <div className="rounded-2xl p-4 mb-6" style={{ background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.25)' }}>
            <p className="font-medium text-sm mb-2" style={{ color: '#fbbf24' }}>Alerta stock bajo - {stockBajo.length} materiales</p>
            <div className="flex flex-wrap gap-2">
              {stockBajo.map((m) => (
                <span key={m.id} className="text-xs px-2 py-1 rounded-lg" style={{ background: 'rgba(234,179,8,0.15)', color: '#fbbf24' }}>
                  {m.nombre}: {m.stock} {m.unidad} (min: {m.minimo})
                </span>
              ))}
            </div>
          </div>
        )}

        {vista === 'equipos' && (
          <div className="grid grid-cols-3 gap-4 mb-6">
            {[
              { label: 'Disponibles', valor: disponibles.length, color: '#34d399', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.2)' },
              { label: 'En cliente', valor: enCliente.length, color: '#fbbf24', bg: 'rgba(234,179,8,0.08)', border: 'rgba(234,179,8,0.2)' },
              { label: 'Pendientes', valor: pendientes.length, color: '#a78bfa', bg: 'rgba(124,58,237,0.08)', border: 'rgba(124,58,237,0.2)' },
            ].map((statsEq, i) => (
              <div key={i} className="rounded-2xl p-4 text-center" style={{ background: statsEq.bg, border: `1px solid ${statsEq.border}` }}>
                <p className="text-3xl font-bold" style={{ color: statsEq.color }}>{statsEq.valor}</p>
                <p className="text-sm mt-1" style={{ color: statsEq.color }}>{statsEq.label}</p>
              </div>
            ))}
          </div>
        )}

        {vista === 'equipos' && enCliente.length > 0 && (
          <div className="rounded-2xl p-4 mb-6" style={{ background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.2)' }}>
            <p className="font-medium text-sm mb-2" style={{ color: '#fbbf24' }}>Equipos en cliente ahora mismo</p>
            <div className="flex flex-wrap gap-2">
              {enCliente.map((e) => (
                <span key={e.id} className="text-xs px-2 py-1 rounded-lg" style={{ background: 'rgba(234,179,8,0.15)', color: '#fbbf24' }}>
                  {e.codigo} - {e.tipo} {e.marca}
                </span>
              ))}
            </div>
          </div>
        )}

        {vista === 'materiales' && mostrarFormMaterial && (
          <div className="rounded-2xl p-6 mb-6" style={s.cardStyle}>
            <h2 className="font-semibold mb-5" style={{ color: 'var(--text)' }}>{editandoMaterial ? 'Editar material' : 'Nuevo material'}</h2>
            <form onSubmit={guardarMaterial} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { label: 'Nombre', el: <input value={nombre} onChange={(e) => setNombre(e.target.value)} required className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={s.inputStyle} placeholder="Desengrasante industrial" /> },
                { label: 'Referencia', el: <input value={referencia} onChange={(e) => setReferencia(e.target.value)} className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={s.inputStyle} placeholder="REF-001" /> },
                {
                  label: 'Categoria', el: (
                    <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={s.inputStyle}>
                      <option value="limpieza">Limpieza</option><option value="filtros">Filtros</option>
                      <option value="repuestos">Repuestos</option><option value="instalacion">Instalacion</option><option value="otro">Otro</option>
                    </select>
                  ),
                },
                {
                  label: 'Unidad', el: (
                    <select value={unidad} onChange={(e) => setUnidad(e.target.value)} className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={s.inputStyle}>
                      <option value="unidad">Unidad</option><option value="litro">Litro</option>
                      <option value="kg">Kg</option><option value="metro">Metro</option><option value="caja">Caja</option><option value="rollo">Rollo</option>
                    </select>
                  ),
                },
                { label: 'Stock actual', el: <input type="number" value={stock} onChange={(e) => setStock(e.target.value)} className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={s.inputStyle} /> },
                { label: 'Stock minimo', el: <input type="number" value={minimo} onChange={(e) => setMinimo(e.target.value)} className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={s.inputStyle} /> },
                { label: 'Ubicacion', el: <input value={ubicacion} onChange={(e) => setUbicacion(e.target.value)} className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={s.inputStyle} placeholder="Estanteria A, balda 3" /> },
                { label: 'Notas', el: <input value={notas} onChange={(e) => setNotas(e.target.value)} className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={s.inputStyle} placeholder="Proveedor, especificaciones..." /> },
              ].map((f, i) => (
                <div key={i}>
                  <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-muted)' }}>{f.label}</label>
                  {f.el}
                </div>
              ))}

              <div className="md:col-span-2">
                <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-muted)' }}>Foto del material</label>
                <input type="file" accept="image/*" onChange={subirFotoMaterial} className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={s.inputStyle} />
                {subiendo && <p className="text-xs mt-1" style={{ color: '#06b6d4' }}>Subiendo foto...</p>}
                {fotoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={fotoUrl}
                    alt="foto"
                    className="mt-2 h-20 w-20 object-cover rounded-xl"
                    style={{ border: '1px solid var(--border)', background: 'var(--bg-card)' }}
                  />
                )}
              </div>

              <div className="md:col-span-2 flex gap-3">
                <button type="submit" className="text-white px-5 py-2 rounded-xl text-sm font-medium" style={s.btnPrimary}>
                  {editandoMaterial ? 'Actualizar' : 'Guardar'}
                </button>
                <button type="button" onClick={() => setMostrarFormMaterial(false)} className="text-sm px-5 py-2 rounded-xl" style={s.btnSecondary}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        )}

        {vista === 'equipos' && mostrarFormEquipo && (
          <div className="rounded-2xl p-6 mb-6" style={s.cardStyle}>
            <h2 className="font-semibold mb-5" style={{ color: 'var(--text)' }}>{editandoEquipo ? 'Editar equipo' : 'Nuevo equipo'}</h2>
            <form onSubmit={guardarEquipo} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { label: 'Codigo', el: <input value={codigoEq} onChange={(e) => setCodigoEq(e.target.value)} required className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={s.inputStyle} placeholder="TRB-001" /> },
                {
                  label: 'Tipo', el: (
                    <select value={tipoEq} onChange={(e) => setTipoEq(e.target.value)} className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={s.inputStyle}>
                      <option value="turbina">Turbina</option><option value="motor">Motor</option>
                      <option value="caja_extraccion">Caja extraccion</option><option value="otro">Otro</option>
                    </select>
                  ),
                },
                { label: 'Marca', el: <input value={marcaEq} onChange={(e) => setMarcaEq(e.target.value)} className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={s.inputStyle} placeholder="Soler&Palau" /> },
                { label: 'Modelo', el: <input value={modeloEq} onChange={(e) => setModeloEq(e.target.value)} className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={s.inputStyle} placeholder="CVST-25/13" /> },
                {
                  label: 'Estado', el: (
                    <select value={estadoEq} onChange={(e) => setEstadoEq(e.target.value)} className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={s.inputStyle}>
                      <option value="disponible">Disponible</option><option value="en_cliente">En cliente</option>
                      <option value="pendiente_limpieza">Pendiente limpieza</option>
                      <option value="pendiente_revision">Pendiente revision</option><option value="averiado">Averiado</option>
                    </select>
                  ),
                },
                { label: 'Ubicacion', el: <input value={ubicacionEq} onChange={(e) => setUbicacionEq(e.target.value)} className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={s.inputStyle} placeholder="Nave principal, zona A" /> },
              ].map((f, i) => (
                <div key={i}>
                  <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-muted)' }}>{f.label}</label>
                  {f.el}
                </div>
              ))}
              <div className="md:col-span-2">
                <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-muted)' }}>Notas tecnicas</label>
                <textarea value={notasEq} onChange={(e) => setNotasEq(e.target.value)} rows={2} className="w-full rounded-xl px-3 py-2 text-sm outline-none resize-none" style={s.inputStyle} />
              </div>
              <div className="md:col-span-2 flex gap-3">
                <button type="submit" className="px-5 py-2 rounded-xl text-sm font-medium" style={s.btnPrimary}>
                  {editandoEquipo ? 'Actualizar' : 'Guardar'}
                </button>
                <button type="button" onClick={() => setMostrarFormEquipo(false)} className="text-sm px-5 py-2 rounded-xl" style={s.btnSecondary}>
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
        ) : vista === 'materiales' && materiales.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-5xl mb-4">📦</p>
            <p style={{ color: 'var(--text-muted)' }}>No hay materiales. Anade el primero.</p>
          </div>
        ) : vista === 'equipos' && equipos.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-5xl mb-4">⚙️</p>
            <p style={{ color: 'var(--text-muted)' }}>No hay equipos registrados.</p>
          </div>
        ) : vista === 'materiales' ? (
          <div className="rounded-2xl overflow-hidden" style={s.cardStyle}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Foto', 'Material', 'Categoria', 'Stock', 'Minimo', 'Ubicacion', ''].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {materiales.map((m) => (
                    <tr
                      key={m.id}
                      style={{ borderBottom: '1px solid var(--border)' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(124,58,237,0.05)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td className="px-4 py-3">
                        {m.foto_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={m.foto_url}
                            alt={m.nombre}
                            className="w-10 h-10 object-cover rounded-xl"
                            style={{ border: '1px solid var(--border)', background: 'var(--bg-card)' }}
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                            📦
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium" style={{ color: 'var(--text)' }}>{m.nombre}</p>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{m.referencia}</p>
                      </td>
                      <td className="px-4 py-3 text-sm capitalize" style={{ color: 'var(--text-muted)' }}>{m.categoria}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button onClick={() => ajustarStock(m.id, -1)} className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold transition-colors" style={{ background: 'var(--bg)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                            -
                          </button>
                          <span className="font-mono font-bold text-sm" style={{ color: (m.stock || 0) < (m.minimo || 0) ? '#f87171' : '#34d399' }}>
                            {m.stock || 0} {m.unidad}
                          </span>
                          <button onClick={() => ajustarStock(m.id, 1)} className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold transition-colors" style={{ background: 'var(--bg)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                            +
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>{m.minimo || 0} {m.unidad}</td>
                      <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>{m.ubicacion || '-'}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => generarQRMaterial(m)} className="text-xs px-2 py-1 rounded-lg transition-colors" style={{ color: '#34d399', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}>QR</button>
                          <button onClick={() => abrirFormMaterial(m)} className="text-xs px-2 py-1 rounded-lg transition-colors" style={{ color: '#a78bfa', background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.2)' }}>Editar</button>
                          <button onClick={() => eliminarMaterial(m.id)} className="text-xs px-2 py-1 rounded-lg transition-colors" style={{ color: '#f87171', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>Eliminar</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {equipos.map((e) => (
              <div key={e.id} className="rounded-2xl p-5 transition-all" style={s.cardStyle} onMouseEnter={(el) => (el.currentTarget.style.borderColor = '#7c3aed')} onMouseLeave={(el) => (el.currentTarget.style.borderColor = 'var(--border)')}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-mono text-sm font-bold" style={{ color: '#06b6d4' }}>{e.codigo}</p>
                    <p className="font-semibold mt-1 capitalize" style={{ color: 'var(--text)' }}>{e.tipo.replace('_', ' ')}</p>
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{e.marca} {e.modelo}</p>
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full" style={{ background: ESTADOS_EQUIPO[e.estado]?.bg, color: ESTADOS_EQUIPO[e.estado]?.color }}>
                    {ESTADOS_EQUIPO[e.estado]?.label || e.estado}
                  </span>
                </div>
                {e.ubicacion && <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>📍 {e.ubicacion}</p>}
                {e.notas && <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>{e.notas}</p>}
                <div className="flex flex-wrap gap-2 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
                  {(e.estado === 'pendiente_limpieza' || e.estado === 'pendiente_revision') && (
                    <button onClick={() => cambiarEstadoEquipo(e.id, 'disponible')} className="text-xs px-3 py-1 rounded-lg" style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399', border: '1px solid rgba(16,185,129,0.3)' }}>
                      Disponible
                    </button>
                  )}
                  {e.estado === 'disponible' && (
                    <button onClick={() => cambiarEstadoEquipo(e.id, 'en_cliente')} className="text-xs px-3 py-1 rounded-lg" style={{ background: 'rgba(234,179,8,0.15)', color: '#fbbf24', border: '1px solid rgba(234,179,8,0.3)' }}>
                      Enviar cliente
                    </button>
                  )}
                  {e.estado === 'en_cliente' && (
                    <button onClick={() => cambiarEstadoEquipo(e.id, 'pendiente_limpieza')} className="text-xs px-3 py-1 rounded-lg" style={{ background: 'rgba(124,58,237,0.15)', color: '#a78bfa', border: '1px solid rgba(124,58,237,0.3)' }}>
                      Devolver
                    </button>
                  )}
                  <button onClick={() => generarQREquipo(e)} className="text-xs px-3 py-1 rounded-lg" style={{ background: 'rgba(16,185,129,0.1)', color: '#34d399', border: '1px solid rgba(16,185,129,0.2)' }}>
                    QR
                  </button>
                  <button onClick={() => abrirFormEquipo(e)} className="text-xs px-3 py-1 rounded-lg" style={{ background: 'rgba(124,58,237,0.1)', color: '#a78bfa', border: '1px solid rgba(124,58,237,0.2)' }}>
                    Editar
                  </button>
                  <button onClick={() => eliminarEquipo(e.id)} className="text-xs px-3 py-1 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
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
