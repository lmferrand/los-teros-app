'use client'

import { s } from '@/lib/styles'
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import QRCode from 'qrcode'
import AppHeader from '@/app/components/AppHeader'
import { compressImageForUpload } from '@/lib/image-compression'

type VistaInventario = 'materiales' | 'equipos'
type QrModalData = {
  abierto: boolean
  titulo: string
  subtitulo: string
  qrUrl: string
}
type OtEquipoData = {
  ordenId: string
  codigo: string
  cliente: string
  fecha: string
}

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
  const [cantidadDisponibleEq, setCantidadDisponibleEq] = useState('1')
  const [ubicacionEq, setUbicacionEq] = useState('')
  const [notasEq, setNotasEq] = useState('')
  const [qrModal, setQrModal] = useState<QrModalData>({
    abierto: false,
    titulo: '',
    subtitulo: '',
    qrUrl: '',
  })
  const [otPorEquipo, setOtPorEquipo] = useState<Record<string, OtEquipoData>>({})

  const cargarOtEquiposEnCliente = useCallback(async (listaEquipos: any[]) => {
    const equiposEnCliente = (listaEquipos || []).filter((e: any) => e?.estado === 'en_cliente')
    if (equiposEnCliente.length === 0) {
      setOtPorEquipo({})
      return
    }

    const idsEquipos = equiposEnCliente.map((e: any) => e.id).filter(Boolean)
    const { data } = await (supabase.from('movimientos') as any)
      .select('equipo_id, orden_id, fecha, ordenes(id, codigo, clientes(nombre, nombre_comercial))')
      .in('equipo_id', idsEquipos)
      .eq('tipo', 'salida')
      .not('orden_id', 'is', null)
      .order('fecha', { ascending: false, nullsFirst: false })

    const mapa: Record<string, OtEquipoData> = {}
    for (const mov of data || []) {
      const equipoId = String(mov?.equipo_id || '').trim()
      if (!equipoId || mapa[equipoId]) continue

      const orden = Array.isArray(mov?.ordenes) ? mov.ordenes[0] : mov?.ordenes
      const cliente = Array.isArray(orden?.clientes) ? orden.clientes[0] : orden?.clientes
      mapa[equipoId] = {
        ordenId: String(orden?.id || mov?.orden_id || ''),
        codigo: String(orden?.codigo || '').trim(),
        cliente: String(cliente?.nombre_comercial || cliente?.nombre || '').trim(),
        fecha: String(mov?.fecha || ''),
      }
    }
    setOtPorEquipo(mapa)
  }, [])

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
    const equiposData = eqs.data || []
    if (eqs.data) setEquipos(eqs.data)
    await cargarOtEquiposEnCliente(equiposData)
    setLoading(false)
  }, [cargarOtEquiposEnCliente])

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

  function extraerPathStorageMaterialUrl(url: string) {
    const marcador = '/storage/v1/object/public/fotos-materiales/'
    const idx = String(url || '').indexOf(marcador)
    if (idx < 0) return null
    const encodedPath = String(url || '').slice(idx + marcador.length)
    if (!encodedPath) return null
    return decodeURIComponent(encodedPath)
  }

  async function subirFotoMaterial(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setSubiendo(true)
    const imagenLista = await compressImageForUpload(file, {
      maxWidth: 1400,
      maxHeight: 1400,
      targetBytes: 220 * 1024,
      outputType: 'image/webp',
    })
    const nombreArchivo = `materiales/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${imagenLista.extension}`
    const { data, error } = await supabase.storage.from('fotos-materiales').upload(nombreArchivo, imagenLista.blob, {
      contentType: imagenLista.contentType,
    })
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
    const fotoAnterior = String(editandoMaterial?.foto_url || '').trim()
    const fotoNueva = String(fotoUrl || '').trim()
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
    let materialGuardado: any = null
    if (editandoMaterial) {
      const { data } = await supabase
        .from('materiales')
        .update(datos)
        .eq('id', editandoMaterial.id)
        .select('*')
        .single()
      materialGuardado = data || { ...editandoMaterial, ...datos }
    } else {
      const { data } = await supabase
        .from('materiales')
        .insert(datos)
        .select('*')
        .single()
      materialGuardado = data || null
    }
    if (editandoMaterial && fotoAnterior && fotoAnterior !== fotoNueva) {
      const pathAnterior = extraerPathStorageMaterialUrl(fotoAnterior)
      if (pathAnterior) {
        await supabase.storage.from('fotos-materiales').remove([pathAnterior])
      }
    }
    setMostrarFormMaterial(false)
    setEditandoMaterial(null)
    await cargarTodo()
    if (materialGuardado) {
      await generarQRMaterial(materialGuardado)
    }
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

  function payloadQrMaterial(mat: any) {
    return JSON.stringify({
      tipo: 'material',
      id: mat.id,
      nombre: mat.nombre,
      referencia: mat.referencia || null,
      unidad: mat.unidad || null,
    })
  }

  function payloadQrEquipo(eq: any) {
    return JSON.stringify({
      tipo: 'equipo',
      id: eq.id,
      codigo: eq.codigo,
      tipo_equipo: eq.tipo || null,
    })
  }

  async function abrirQrEnModal(titulo: string, subtitulo: string, payload: string) {
    const qrUrl = await QRCode.toDataURL(payload, { width: 360, margin: 2 })
    setQrModal({
      abierto: true,
      titulo,
      subtitulo,
      qrUrl,
    })
  }

  async function generarQRMaterial(mat: any) {
    await abrirQrEnModal(
      mat.nombre || 'Material',
      `Ref: ${mat.referencia || '-'} | Stock: ${mat.stock || 0} ${mat.unidad || ''}`,
      payloadQrMaterial(mat)
    )
  }

  function abrirFormEquipo(eq?: any) {
    if (eq) {
      setEditandoEquipo(eq)
      setCodigoEq(eq.codigo || '')
      setTipoEq(eq.tipo || 'turbina')
      setMarcaEq(eq.marca || '')
      setModeloEq(eq.modelo || '')
      setEstadoEq(eq.estado || 'disponible')
      setCantidadDisponibleEq(String(Math.max(0, Number(eq.cantidad_disponible ?? 1) || 0)))
      setUbicacionEq(eq.ubicacion || '')
      setNotasEq(eq.notas || '')
    } else {
      setEditandoEquipo(null)
      setCodigoEq('')
      setTipoEq('turbina')
      setMarcaEq('')
      setModeloEq('')
      setEstadoEq('disponible')
      setCantidadDisponibleEq('1')
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
      cantidad_disponible: Math.max(0, Number.parseInt(cantidadDisponibleEq, 10) || 0),
      ubicacion: ubicacionEq,
      notas: notasEq,
    }
    let equipoGuardado: any = null
    if (editandoEquipo) {
      const { data } = await supabase
        .from('equipos')
        .update(datos)
        .eq('id', editandoEquipo.id)
        .select('*')
        .single()
      equipoGuardado = data || { ...editandoEquipo, ...datos }
    } else {
      const { data } = await supabase
        .from('equipos')
        .insert(datos)
        .select('*')
        .single()
      equipoGuardado = data || null
    }
    setMostrarFormEquipo(false)
    setEditandoEquipo(null)
    await cargarTodo()
    if (equipoGuardado) {
      await generarQREquipo(equipoGuardado)
    }
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
    await abrirQrEnModal(
      eq.codigo || 'Equipo',
      `${eq.tipo || ''} ${eq.marca || ''} ${eq.modelo || ''}`.trim(),
      payloadQrEquipo(eq)
    )
  }

  async function generarQRTodos() {
    const [materialesConQr, equiposConQr] = await Promise.all([
      Promise.all(
        materiales.map(async (mat) => {
          const qrUrl = await QRCode.toDataURL(payloadQrMaterial(mat), { width: 180, margin: 1 })
          return { ...mat, qrUrl }
        })
      ),
      Promise.all(
        equipos.map(async (eq) => {
          const qrUrl = await QRCode.toDataURL(payloadQrEquipo(eq), { width: 180, margin: 1 })
          return { ...eq, qrUrl }
        })
      ),
    ])

    const win = window.open('', '_blank')
    if (win) {
      win.document.write(`<html><head><title>QR Inventario y equipos</title>
      <style>body{font-family:sans-serif;padding:20px;background:#fff}
      h1{font-size:20px;margin-bottom:20px}.grid{display:flex;flex-wrap:wrap;gap:15px}
      .etiqueta{border:2px solid #000;padding:12px;border-radius:6px;text-align:center;width:180px}
      h3{margin:6px 0 3px;font-size:13px;font-family:monospace;color:#7c3aed}
      p{margin:2px 0;font-size:10px;color:#555}
      @media print{button{display:none}}</style></head>
      <body>
      <h1>Los Teros - QR inventario y equipos</h1>
      <button onclick="window.print()" style="padding:10px 20px;font-size:14px;cursor:pointer;background:#7c3aed;color:#fff;border:none;border-radius:6px;margin-bottom:20px">Imprimir todos</button>
      <h2 style="font-size:16px;margin:8px 0 12px">Materiales (${materialesConQr.length})</h2>
      <div class="grid">${materialesConQr.map(mat => `<div class="etiqueta">
        <img src="${mat.qrUrl}" style="width:130px;height:130px">
        <h3>${mat.nombre}</h3><p>Ref: ${mat.referencia || '-'}</p><p>${mat.unidad || ''}</p>
      </div>`).join('')}</div>
      <h2 style="font-size:16px;margin:16px 0 12px">Equipos (${equiposConQr.length})</h2>
      <div class="grid">${equiposConQr.map(eq => `<div class="etiqueta">
        <img src="${eq.qrUrl}" style="width:140px;height:140px">
        <h3>${eq.codigo}</h3><p>${eq.tipo} ${eq.marca || ''}</p><p>${eq.modelo || ''}</p><p>Cant.: ${Math.max(0, Number(eq.cantidad_disponible ?? 1) || 0)}</p>
      </div>`).join('')}</div></body></html>`)
      win.document.close()
    }
  }

  function imprimirQrActual() {
    if (!qrModal.qrUrl) return
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`<html><head><title>QR - ${qrModal.titulo}</title>
    <style>
      body{font-family:sans-serif;text-align:center;padding:26px;background:#fff}
      .etiqueta{border:2px solid #000;padding:18px;display:inline-block;border-radius:8px}
      h2{margin:10px 0 5px;font-size:18px}
      p{margin:4px 0;font-size:13px;color:#444}
      @media print{button{display:none}}
    </style></head>
    <body>
      <div class="etiqueta">
        <img src="${qrModal.qrUrl}" style="width:210px;height:210px">
        <h2>${qrModal.titulo}</h2>
        <p>${qrModal.subtitulo}</p>
        <p style="font-size:10px;color:#999">Los Teros - Código QR</p>
      </div>
      <br>
      <button onclick="window.print()" style="padding:12px 24px;font-size:16px;cursor:pointer;background:#7c3aed;color:#fff;border:none;border-radius:8px;margin-top:12px">Imprimir</button>
    </body></html>`)
    win.document.close()
  }

  const stockBajo = materiales.filter((m) => (m.stock || 0) < (m.minimo || 0))

  const ESTADOS_EQUIPO: any = {
    disponible: { color: '#34d399', bg: 'rgba(16,185,129,0.15)', label: 'Disponible' },
    en_cliente: { color: '#fbbf24', bg: 'rgba(234,179,8,0.15)', label: 'En cliente' },
    pendiente_limpieza: { color: '#a78bfa', bg: 'rgba(124,58,237,0.15)', label: 'Pend. limpieza' },
    pendiente_revision: { color: '#22d3ee', bg: 'rgba(6,182,212,0.15)', label: 'Pend. revisión' },
    averiado: { color: '#f87171', bg: 'rgba(239,68,68,0.15)', label: 'Averiado' },
  }

  const cantidadEquipo = (eq: any) => Math.max(0, Number(eq?.cantidad_disponible ?? 1) || 0)
  const enCliente = equipos.filter((e) => e.estado === 'en_cliente')
  const pendientes = equipos.filter((e) => e.estado === 'pendiente_limpieza' || e.estado === 'pendiente_revision')
  const disponibles = equipos.filter((e) => e.estado === 'disponible')
  const totalEnCliente = enCliente.reduce((acc, eq) => acc + cantidadEquipo(eq), 0)
  const totalPendientes = pendientes.reduce((acc, eq) => acc + cantidadEquipo(eq), 0)
  const totalDisponibles = disponibles.reduce((acc, eq) => acc + cantidadEquipo(eq), 0)

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <AppHeader
        title="Inventario y equipos"
        rightSlot={(
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={generarQRTodos}
              className="text-sm px-4 py-2 rounded-xl font-medium"
              style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399', border: '1px solid rgba(16,185,129,0.3)' }}
            >
              QR todos
            </button>
            {vista === 'materiales' ? (
              <button onClick={() => abrirFormMaterial()} className="text-sm px-4 py-2 rounded-xl font-medium" style={s.btnPrimary}>
                + Nuevo material
              </button>
            ) : (
              <button onClick={() => abrirFormEquipo()} className="text-sm px-4 py-2 rounded-xl font-medium" style={s.btnPrimary}>
                + Nuevo equipo
              </button>
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
              { label: 'Disponibles', valor: totalDisponibles, color: '#34d399', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.2)' },
              { label: 'En cliente', valor: totalEnCliente, color: '#fbbf24', bg: 'rgba(234,179,8,0.08)', border: 'rgba(234,179,8,0.2)' },
              { label: 'Pendientes', valor: totalPendientes, color: '#a78bfa', bg: 'rgba(124,58,237,0.08)', border: 'rgba(124,58,237,0.2)' },
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
                      <option value="repuestos">Repuestos</option><option value="instalacion">Instalación</option><option value="otro">Otro</option>
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
                { label: 'Stock mínimo', el: <input type="number" value={minimo} onChange={(e) => setMinimo(e.target.value)} className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={s.inputStyle} /> },
                { label: 'Ubicación', el: <input value={ubicacion} onChange={(e) => setUbicacion(e.target.value)} className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={s.inputStyle} placeholder="Estantería A, balda 3" /> },
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
                  <div className="mt-2 flex items-start gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={fotoUrl}
                      alt="foto"
                      className="h-20 w-20 object-cover rounded-xl"
                      style={{ border: '1px solid var(--border)', background: 'var(--bg-card)' }}
                    />
                    <button
                      type="button"
                      onClick={() => setFotoUrl('')}
                      className="text-xs px-3 py-1.5 rounded-lg"
                      style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}
                    >
                      Quitar foto
                    </button>
                  </div>
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
                { label: 'Código', el: <input value={codigoEq} onChange={(e) => setCodigoEq(e.target.value)} required className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={s.inputStyle} placeholder="TRB-001" /> },
                {
                  label: 'Tipo', el: (
                    <select value={tipoEq} onChange={(e) => setTipoEq(e.target.value)} className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={s.inputStyle}>
                      <option value="turbina">Turbina</option><option value="motor">Motor</option>
                      <option value="caja_extraccion">Caja extracción</option><option value="otro">Otro</option>
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
                      <option value="pendiente_revision">Pendiente revisión</option><option value="averiado">Averiado</option>
                    </select>
                  ),
                },
                {
                  label: 'Cantidad disponible', el: (
                    <input
                      type="number"
                      min={0}
                      step={1}
                      value={cantidadDisponibleEq}
                      onChange={(e) => setCantidadDisponibleEq(e.target.value)}
                      className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                      style={s.inputStyle}
                    />
                  ),
                },
                { label: 'Ubicación', el: <input value={ubicacionEq} onChange={(e) => setUbicacionEq(e.target.value)} className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={s.inputStyle} placeholder="Nave principal, zona A" /> },
              ].map((f, i) => (
                <div key={i}>
                  <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-muted)' }}>{f.label}</label>
                  {f.el}
                </div>
              ))}
              <div className="md:col-span-2">
                <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-muted)' }}>Notas técnicas</label>
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
            <p style={{ color: 'var(--text-muted)' }}>No hay materiales. Añade el primero.</p>
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
                    {['Foto', 'Material', 'Categoría', 'Stock', 'Mínimo', 'Ubicación', ''].map((h) => (
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
                    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Cantidad: {cantidadEquipo(e)}</p>
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full" style={{ background: ESTADOS_EQUIPO[e.estado]?.bg, color: ESTADOS_EQUIPO[e.estado]?.color }}>
                    {ESTADOS_EQUIPO[e.estado]?.label || e.estado}
                  </span>
                </div>
                {e.ubicacion && <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>📍 {e.ubicacion}</p>}
                {e.estado === 'en_cliente' && (
                  <div className="rounded-xl p-2 mb-3" style={{ background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.25)' }}>
                    {otPorEquipo[e.id] ? (
                      <>
                        <p className="text-[11px] uppercase tracking-wider" style={{ color: '#fbbf24' }}>OT actual</p>
                        <p className="text-xs font-semibold mt-1" style={{ color: 'var(--text)' }}>
                          {otPorEquipo[e.id].codigo || otPorEquipo[e.id].ordenId}
                        </p>
                        {otPorEquipo[e.id].cliente && (
                          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                            Cliente: {otPorEquipo[e.id].cliente}
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="text-xs" style={{ color: '#fbbf24' }}>En cliente, sin OT vinculada detectada.</p>
                    )}
                  </div>
                )}
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

        {qrModal.abierto && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.72)' }}>
            <div className="w-full max-w-md rounded-2xl p-5" style={s.cardStyle}>
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <h3 className="font-semibold text-base" style={{ color: 'var(--text)' }}>{qrModal.titulo}</h3>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{qrModal.subtitulo}</p>
                </div>
                <button
                  onClick={() => setQrModal((prev) => ({ ...prev, abierto: false }))}
                  className="text-xs px-2 py-1 rounded-lg"
                  style={s.btnSecondary}
                >
                  Cerrar
                </button>
              </div>
              <div className="rounded-xl p-3 flex items-center justify-center" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrModal.qrUrl} alt="QR" className="w-72 h-72 max-w-full object-contain" />
              </div>
              <div className="flex gap-2 mt-4">
                <button
                  onClick={imprimirQrActual}
                  className="flex-1 text-sm px-4 py-2 rounded-xl font-medium"
                  style={s.btnPrimary}
                >
                  Imprimir QR
                </button>
                <button
                  onClick={() => setQrModal((prev) => ({ ...prev, abierto: false }))}
                  className="flex-1 text-sm px-4 py-2 rounded-xl"
                  style={s.btnSecondary}
                >
                  Listo
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
