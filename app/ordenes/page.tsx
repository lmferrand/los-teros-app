'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { s } from '@/lib/styles'
import { estandarizarNombreComercial, estandarizarNombreFiscal, limpiarTextoCliente } from '@/lib/clientes-normalizacion'

function normalizarGradoIntervencion(valor: string | null | undefined) {
  const v = String(valor || '').trim().toLowerCase()
  if (v === '1' || v === '2' || v === '3') return v
  if (v === 'baja') return '1'
  if (v === 'alta' || v === 'urgente') return '3'
  return '2'
}

function textoGradoIntervencion(valor: string | null | undefined) {
  const g = normalizarGradoIntervencion(valor)
  if (g === '1') return 'Basico (1)'
  if (g === '3') return 'Excelente (3)'
  return 'Medio (2)'
}

function nombreComercialCliente(c: any) {
  return String(c?.nombre_comercial || c?.nombre || '').trim()
}

function nombreFiscalCliente(c: any) {
  return String(c?.nombre_fiscal || '').trim()
}

function normalizarEmpresaCliente(valor: unknown) {
  const v = String(valor || '').trim().toLowerCase()
  if (v === 'olipro') return 'olipro'
  return 'teros'
}

export default function Ordenes() {
  const [ordenes, setOrdenes] = useState<any[]>([])
  const [vehiculos, setVehiculos] = useState<any[]>([])
  const [tecnicos, setTecnicos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [filtroEstado, setFiltroEstado] = useState('')
  const [ordenDetalle, setOrdenDetalle] = useState<any>(null)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [subiendo, setSubiendo] = useState(false)
  const [mostrarModalEliminar, setMostrarModalEliminar] = useState(false)
  const [ordenAEliminar, setOrdenAEliminar] = useState<any>(null)
  const [busquedaCliente, setBusquedaCliente] = useState('')
  const [resultadosCliente, setResultadosCliente] = useState<any[]>([])
  const [buscandoCliente, setBuscandoCliente] = useState(false)
  const [nombreClienteSeleccionado, setNombreClienteSeleccionado] = useState('')
  const [empresaOt, setEmpresaOt] = useState<'teros' | 'olipro'>('teros')
  const router = useRouter()

  const [tipo, setTipo] = useState('limpieza')
  const [clienteId, setClienteId] = useState('')
  const [tecnicosSeleccionados, setTecnicosSeleccionados] = useState<string[]>([])
  const [vehiculoId, setVehiculoId] = useState('')
  const [tecnicoVehiculoId, setTecnicoVehiculoId] = useState('')
  const [fecha, setFecha] = useState('')
  const [prioridad, setPrioridad] = useState('2')
  const [estado, setEstado] = useState('pendiente')
  const [descripcion, setDescripcion] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [duracionHoras, setDuracionHoras] = useState('2')
  const [horaFija, setHoraFija] = useState(false)
  const [mostrarEditarClienteOt, setMostrarEditarClienteOt] = useState(false)
  const [guardandoClienteOt, setGuardandoClienteOt] = useState(false)
  const [clienteOtForm, setClienteOtForm] = useState<any>({
    nombre: '',
    nombre_fiscal: '',
    cif: '',
    direccion: '',
    poblacion: '',
    telefono: '',
    movil: '',
    email: '',
    notas: '',
    empresa: 'teros',
  })

  useEffect(() => {
    verificarSesion()
    cargarDatos()
  }, [])

  async function verificarSesion() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) router.push('/login')
  }

  async function cargarDatos() {
    const [ords, tecs, vehs] = await Promise.all([
      supabase.from('ordenes').select('*, clientes(*)').order('created_at', { ascending: false }),
      supabase.from('perfiles').select('*').order('nombre'),
      supabase.from('vehiculos_flota').select('id, matricula, alias, marca, modelo, activo').eq('activo', true).order('matricula'),
    ])
    if (ords.data) setOrdenes(ords.data)
    if (tecs.data) setTecnicos(tecs.data)
    if (vehs.data) setVehiculos(vehs.data)
    setLoading(false)
  }

  async function buscarClientes(texto: string) {
    setBusquedaCliente(texto)
    setNombreClienteSeleccionado('')
    setClienteId('')
    if (texto.length < 2) { setResultadosCliente([]); return }
    setBuscandoCliente(true)
    const empresaFiltro = empresaOt
    const termino = texto.trim()
    let data: any[] | null = null
    const intentoAvanzado = await (supabase.from('clientes') as any)
      .select('id, nombre, nombre_comercial, nombre_fiscal, cif, poblacion, empresa, tipo_cliente')
      .or(`nombre.ilike.%${termino}%,nombre_comercial.ilike.%${termino}%,nombre_fiscal.ilike.%${termino}%,cif.ilike.%${termino}%`)
      .limit(40)
    if (!intentoAvanzado.error) data = intentoAvanzado.data || []
    if (!data) {
      const fallback = await (supabase.from('clientes') as any)
        .select('id, nombre, nombre_comercial, nombre_fiscal, cif, poblacion, empresa, tipo_cliente')
        .ilike('nombre', `%${termino}%`)
        .limit(40)
      data = fallback.data || []
    }
    setResultadosCliente((data || []).filter((c: any) => normalizarEmpresaCliente(c?.tipo_cliente || c?.empresa) === empresaFiltro))
    setBuscandoCliente(false)
  }

  useEffect(() => {
    if (!tecnicoVehiculoId) return
    if (tecnicosSeleccionados.includes(tecnicoVehiculoId)) return
    setTecnicoVehiculoId('')
  }, [tecnicoVehiculoId, tecnicosSeleccionados])

  async function cargarFotosOrden(ordenId: string) {
    const { data } = await supabase.from('fotos_ordenes').select('*').eq('orden_id', ordenId).order('created_at')
    return data || []
  }

  async function eliminarFoto(foto: any) {
    if (!confirm('Eliminar esta foto?')) return
    await supabase.from('fotos_ordenes').delete().eq('id', foto.id)
    if (foto.tipo === 'albaran') {
      const { data: albs } = await supabase.from('albaranes').select('id, fotos_urls').eq('orden_id', ordenDetalle.id)
      if (albs && albs.length > 0) {
        for (const alb of albs) {
          const nuevasFotos = (alb.fotos_urls || []).filter((u: string) => u !== foto.url)
          if (nuevasFotos.length === 0) {
            await supabase.from('albaranes').delete().eq('id', alb.id)
          } else {
            await supabase.from('albaranes').update({ fotos_urls: nuevasFotos }).eq('id', alb.id)
          }
        }
      }
    }
    const fotos = await cargarFotosOrden(ordenDetalle.id)
    setOrdenDetalle((prev: any) => ({ ...prev, fotos }))
  }

  async function abrirDetalle(o: any) {
    const fotos = await cargarFotosOrden(o.id)
    setOrdenDetalle({ ...o, fotos })
  }

  function abrirFormNuevo() {
    setEditandoId(null)
    setTipo('limpieza'); setClienteId(''); setTecnicosSeleccionados([])
    setVehiculoId(''); setTecnicoVehiculoId('')
    setFecha(''); setPrioridad('2'); setEstado('pendiente')
    setDescripcion(''); setObservaciones(''); setDuracionHoras('2'); setHoraFija(false)
    setEmpresaOt('teros')
    setBusquedaCliente(''); setResultadosCliente([]); setNombreClienteSeleccionado('')
    setMostrarForm(true)
  }

  function abrirFormEditar(o: any) {
    setEditandoId(o.id)
    const empresaCliente = normalizarEmpresaCliente(o?.clientes?.tipo_cliente || o?.clientes?.empresa)
    setTipo(o.tipo || 'limpieza'); setClienteId(o.cliente_id || '')
    setTecnicosSeleccionados(o.tecnicos_ids || [])
    setVehiculoId(o.vehiculo_id || '')
    setTecnicoVehiculoId(o.tecnico_vehiculo_id || '')
    setFecha(o.fecha_programada ? new Date(o.fecha_programada).toISOString().slice(0, 16) : '')
    setPrioridad(normalizarGradoIntervencion(o.prioridad)); setEstado(o.estado || 'pendiente')
    setDescripcion(o.descripcion || ''); setObservaciones(o.observaciones || '')
    setDuracionHoras(String(o.duracion_horas || 2)); setHoraFija(o.hora_fija || false)
    setEmpresaOt(empresaCliente)
    setNombreClienteSeleccionado(nombreComercialCliente(o.clientes) || o.clientes?.nombre || '')
    setBusquedaCliente(nombreComercialCliente(o.clientes) || o.clientes?.nombre || '')
    setResultadosCliente([])
    setMostrarForm(true); setOrdenDetalle(null)
  }

  async function subirFoto(e: React.ChangeEvent<HTMLInputElement>, tipoFoto: string) {
    const file = e.target.files?.[0]
    if (!file || !ordenDetalle) return
    setSubiendo(true)
    try {
      let comprimida: Blob = file
      try { comprimida = await comprimirImagen(file) } catch { }
      const nombreArchivo = `orden_${ordenDetalle.id}/${tipoFoto}/${Date.now()}.jpg`
      const { data, error } = await supabase.storage.from('fotos-ordenes').upload(nombreArchivo, comprimida, { contentType: 'image/jpeg' })
      if (error) { alert('Error al subir: ' + error.message); setSubiendo(false); return }
      if (data) {
        const { data: urlData } = supabase.storage.from('fotos-ordenes').getPublicUrl(nombreArchivo)
        const { data: { session } } = await supabase.auth.getSession()
        const { error: insertError } = await supabase.from('fotos_ordenes').insert({
          orden_id: ordenDetalle.id, tipo: tipoFoto, url: urlData.publicUrl, subida_por: session?.user?.id
        })
        if (insertError) { alert('Error al registrar foto: ' + insertError.message); setSubiendo(false); return }
        const fotos = await cargarFotosOrden(ordenDetalle.id)
        setOrdenDetalle((prev: any) => ({ ...prev, fotos }))
        if (tipoFoto === 'albaran') {
          const { count } = await supabase.from('albaranes').select('*', { count: 'exact', head: true })
          const num = String((count || 0) + 1).padStart(4, '0')
          const { error: albError } = await supabase.from('albaranes').insert({
            numero: `ALB-${new Date().getFullYear()}-${num}`,
            cliente_id: ordenDetalle.cliente_id || null,
            orden_id: ordenDetalle.id,
            descripcion: ordenDetalle.descripcion || '',
            estado: 'pendiente',
            fecha: new Date().toISOString().slice(0, 10),
            fotos_urls: [urlData.publicUrl],
            observaciones: `Creado automaticamente desde OT ${ordenDetalle.codigo}`,
          })
          if (!albError) alert('Albaran creado automaticamente en Albaranes.')
          else alert('Error al crear albaran: ' + albError.message)
        }
      }
    } catch { alert('Error inesperado al subir la foto.') }
    setSubiendo(false)
  }

  async function comprimirImagen(file: File, maxWidth = 1200, calidad = 0.75): Promise<Blob> {
    return new Promise((resolve) => {
      const img = new Image()
      const url = URL.createObjectURL(file)
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let width = img.width; let height = img.height
        if (width > maxWidth) { height = Math.round((height * maxWidth) / width); width = maxWidth }
        canvas.width = width; canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx?.drawImage(img, 0, 0, width, height)
        canvas.toBlob((blob) => resolve(blob || file), 'image/jpeg', calidad)
        URL.revokeObjectURL(url)
      }
      img.src = url
    })
  }

  function toggleTecnico(id: string) {
    setTecnicosSeleccionados(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id])
  }

  async function generarCodigo(tipo: string) {
    const prefijos: any = { limpieza: 'LIM', sustitucion: 'SUS', mantenimiento: 'MAN', instalacion: 'INS', revision: 'REV', otro: 'OTR' }
    const { count } = await supabase.from('ordenes').select('*', { count: 'exact', head: true }).eq('tipo', tipo)
    const num = String((count || 0) + 1).padStart(4, '0')
    return `${prefijos[tipo] || 'OTR'}-${new Date().getFullYear()}-${num}`
  }

  async function guardarOrden(e: React.FormEvent) {
    e.preventDefault()
    if (!clienteId) { alert('Selecciona un cliente'); return }
    const datos = {
      tipo, cliente_id: clienteId, tecnico_id: tecnicosSeleccionados[0] || null,
      tecnicos_ids: tecnicosSeleccionados,
      vehiculo_id: vehiculoId || null,
      tecnico_vehiculo_id: tecnicoVehiculoId || null,
      fecha_programada: fecha,
      prioridad: normalizarGradoIntervencion(prioridad),
      estado,
      descripcion, observaciones, duracion_horas: parseFloat(duracionHoras) || 2, hora_fija: horaFija,
    }
    if (editandoId) {
      await supabase.from('ordenes').update(datos).eq('id', editandoId)
    } else {
      const nuevoCodigo = await generarCodigo(tipo)
      await supabase.from('ordenes').insert({ ...datos, codigo: nuevoCodigo })
    }
    setMostrarForm(false); setEditandoId(null)
    setDescripcion(''); setObservaciones(''); setClienteId(''); setTecnicosSeleccionados([])
    setVehiculoId(''); setTecnicoVehiculoId('')
    setBusquedaCliente(''); setNombreClienteSeleccionado(''); setResultadosCliente([])
    cargarDatos()
  }

  async function cambiarEstado(id: string, nuevoEstado: string) {
    if (nuevoEstado === 'completada' && ordenDetalle) {
      const fotos = ordenDetalle.fotos || []
      const fotosProceso = fotos.filter((f: any) => f.tipo === 'proceso')
      const fotosCierre = fotos.filter((f: any) => f.tipo === 'cierre')
      if (fotosProceso.length === 0) {
        alert('Debes subir al menos una foto del proceso antes de completar la orden.')
        return
      }
      if (fotosCierre.length === 0) {
        alert('Debes subir al menos una foto de cierre antes de completar la orden.')
        return
      }
    }
    await supabase.from('ordenes').update({ estado: nuevoEstado }).eq('id', id)
    cargarDatos()
    if (ordenDetalle?.id === id) setOrdenDetalle((prev: any) => ({ ...prev, estado: nuevoEstado }))
  }

  function pedirEliminarOrden(o: any) {
    setOrdenAEliminar(o)
    setMostrarModalEliminar(true)
  }

  async function confirmarEliminarOrden() {
    if (!ordenAEliminar) return
    const id = ordenAEliminar.id
    const { data: movimientos } = await supabase
      .from('movimientos').select('*, materiales(stock)').eq('orden_id', id).eq('tipo', 'consumo')
    if (movimientos && movimientos.length > 0) {
      for (const mov of movimientos) {
        if (mov.material_id && mov.cantidad) {
          const stockActual = mov.materiales?.stock || 0
          await supabase.from('materiales').update({ stock: stockActual + mov.cantidad }).eq('id', mov.material_id)
        }
      }
    }
    const { data: fotos } = await supabase.from('fotos_ordenes').select('*').eq('orden_id', id)
    if (fotos && fotos.length > 0) {
      for (const foto of fotos) {
        const path = foto.url.split('/fotos-ordenes/')[1]
        if (path) await supabase.storage.from('fotos-ordenes').remove([decodeURIComponent(path)])
      }
      await supabase.from('fotos_ordenes').delete().eq('orden_id', id)
    }
    await supabase.from('albaranes').delete().eq('orden_id', id)
    await supabase.from('ordenes').delete().eq('id', id)
    setMostrarModalEliminar(false)
    setOrdenAEliminar(null)
    setOrdenDetalle(null)
    cargarDatos()
  }

  function getNombresTecnicos(ids: string[]) {
    if (!ids || ids.length === 0) return 'Sin asignar'
    return ids.map(id => tecnicos.find(t => t.id === id)?.nombre || '').filter(Boolean).join(', ')
  }

  function getNombreVehiculo(id?: string | null) {
    if (!id) return 'Sin vehiculo'
    const v = vehiculos.find((it: any) => it.id === id)
    if (!v) return 'Sin vehiculo'
    const etiqueta = [v.marca, v.modelo].filter(Boolean).join(' ').trim()
    return `${v.matricula}${etiqueta ? ` - ${etiqueta}` : ''}`
  }

  function getNombreTecnico(id?: string | null) {
    if (!id) return 'Sin asignar'
    return tecnicos.find((t: any) => t.id === id)?.nombre || 'Sin asignar'
  }

  function getTextoClienteSecundario(c: any) {
    const fiscal = nombreFiscalCliente(c)
    const cif = String(c?.cif || '').trim()
    const poblacion = String(c?.poblacion || '').trim()
    return [fiscal || '', cif || '', poblacion || ''].filter(Boolean).join(' | ')
  }

  function normalizarClientePayload(input: any) {
    const nombreComercial = estandarizarNombreComercial(input?.nombre || '')
    const nombreFiscal = estandarizarNombreFiscal(input?.nombre_fiscal || nombreComercial)
    return {
      nombre: nombreComercial,
      nombre_fiscal: nombreFiscal,
      cif: limpiarTextoCliente(input?.cif || '').toUpperCase(),
      direccion: limpiarTextoCliente(input?.direccion || ''),
      poblacion: limpiarTextoCliente(input?.poblacion || '').toUpperCase(),
      telefono: limpiarTextoCliente(input?.telefono || ''),
      movil: limpiarTextoCliente(input?.movil || ''),
      email: String(input?.email || '').trim().toLowerCase(),
      notas: String(input?.notas || '').trim(),
      empresa: String(input?.empresa || 'teros').toLowerCase() === 'olipro' ? 'olipro' : 'teros',
    }
  }

  async function abrirEditarClienteDesdeOt() {
    if (!clienteId) {
      alert('Selecciona un cliente primero.')
      return
    }
    const { data, error } = await (supabase.from('clientes') as any)
      .select('*')
      .eq('id', clienteId)
      .single()
    if (error || !data) {
      alert('No se pudo cargar el cliente para editar.')
      return
    }
    setClienteOtForm({
      nombre: data.nombre || '',
      nombre_fiscal: data.nombre_fiscal || '',
      cif: data.cif || '',
      direccion: data.direccion || '',
      poblacion: data.poblacion || '',
      telefono: data.telefono || '',
      movil: data.movil || '',
      email: data.email || '',
      notas: data.notas || '',
      empresa: data.empresa || empresaOt || 'teros',
    })
    setMostrarEditarClienteOt(true)
  }

  async function guardarClienteDesdeOt(e: React.FormEvent) {
    e.preventDefault()
    if (!clienteId) return
    const payload = normalizarClientePayload(clienteOtForm)
    if (!payload.nombre) {
      alert('El nombre comercial no puede estar vacio.')
      return
    }
    setGuardandoClienteOt(true)
    const { error } = await (supabase.from('clientes') as any).update(payload).eq('id', clienteId)
    setGuardandoClienteOt(false)
    if (error) {
      alert('No se pudo guardar el cliente: ' + error.message)
      return
    }
    setMostrarEditarClienteOt(false)
    setNombreClienteSeleccionado(payload.nombre)
    setBusquedaCliente(payload.nombre)
    await cargarDatos()
  }

  const TIPOS_FOTO = [
    { key: 'proceso', label: 'Fotos del proceso' },
    { key: 'equipo_salida', label: 'Equipo al salir' },
    { key: 'equipo_retorno', label: 'Equipo al retornar' },
    { key: 'cierre', label: 'Fotos de cierre' },
    { key: 'albaran', label: 'Albaran' },
  ]

  const ESTADO_COLORS: any = {
    pendiente: { bg: 'rgba(124,58,237,0.2)', color: '#a78bfa' },
    en_curso: { bg: 'rgba(234,179,8,0.2)', color: '#fbbf24' },
    completada: { bg: 'rgba(16,185,129,0.2)', color: '#34d399' },
    cancelada: { bg: 'rgba(71,85,105,0.2)', color: '#64748b' },
  }

  const PRIORIDAD_COLORS: any = {
    '1': '#64748b',
    '2': '#06b6d4',
    '3': '#34d399',
    baja: '#64748b',
    normal: '#06b6d4',
    alta: '#34d399',
    urgente: '#34d399',
  }

  const ordenesFiltradas = filtroEstado ? ordenes.filter(o => o.estado === filtroEstado) : ordenes

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>

      {mostrarModalEliminar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.85)' }}>
          <div className="w-full max-w-sm rounded-2xl p-6" style={s.cardStyle}>
            <p className="text-xl mb-2">🗑️</p>
            <p className="font-semibold mb-1" style={{ color: 'var(--text)' }}>Eliminar orden {ordenAEliminar?.codigo}</p>
            <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
              Se eliminaran todas las fotos y albaranes. El stock de materiales se restaurara. Esta accion no se puede deshacer.
            </p>
            <div className="flex gap-3">
              <button onClick={confirmarEliminarOrden}
                className="flex-1 py-3 rounded-xl text-sm font-semibold"
                style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>
                Eliminar
              </button>
              <button onClick={() => { setMostrarModalEliminar(false); setOrdenAEliminar(null) }}
                className="flex-1 py-3 rounded-xl text-sm font-semibold" style={s.btnSecondary}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {mostrarEditarClienteOt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.85)' }}>
          <div className="w-full max-w-2xl rounded-2xl p-6" style={s.cardStyle}>
            <h3 className="font-semibold mb-4" style={{ color: 'var(--text)' }}>Editar cliente desde OT</h3>
            <form onSubmit={guardarClienteDesdeOt} className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="md:col-span-2">
                <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>Nombre Comercial</label>
                <input value={clienteOtForm.nombre} onChange={(e) => setClienteOtForm((p: any) => ({ ...p, nombre: e.target.value }))} className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={s.inputStyle} required />
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>Nombre Fiscal</label>
                <input value={clienteOtForm.nombre_fiscal} onChange={(e) => setClienteOtForm((p: any) => ({ ...p, nombre_fiscal: e.target.value }))} className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={s.inputStyle} />
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>CIF</label>
                <input value={clienteOtForm.cif} onChange={(e) => setClienteOtForm((p: any) => ({ ...p, cif: e.target.value }))} className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={s.inputStyle} />
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>Direccion</label>
                <input value={clienteOtForm.direccion} onChange={(e) => setClienteOtForm((p: any) => ({ ...p, direccion: e.target.value }))} className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={s.inputStyle} />
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>Poblacion</label>
                <input value={clienteOtForm.poblacion} onChange={(e) => setClienteOtForm((p: any) => ({ ...p, poblacion: e.target.value }))} className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={s.inputStyle} />
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>Telefono</label>
                <input value={clienteOtForm.telefono} onChange={(e) => setClienteOtForm((p: any) => ({ ...p, telefono: e.target.value }))} className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={s.inputStyle} />
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>Movil</label>
                <input value={clienteOtForm.movil} onChange={(e) => setClienteOtForm((p: any) => ({ ...p, movil: e.target.value }))} className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={s.inputStyle} />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>Email</label>
                <input value={clienteOtForm.email} onChange={(e) => setClienteOtForm((p: any) => ({ ...p, email: e.target.value }))} className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={s.inputStyle} />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs uppercase tracking-wider mb-1 block" style={{ color: 'var(--text-muted)' }}>Notas</label>
                <textarea value={clienteOtForm.notas} onChange={(e) => setClienteOtForm((p: any) => ({ ...p, notas: e.target.value }))} rows={3} className="w-full rounded-xl px-3 py-2 text-sm outline-none resize-none" style={s.inputStyle} />
              </div>
              <div className="md:col-span-2 flex gap-2">
                <button type="submit" disabled={guardandoClienteOt} className="text-sm px-4 py-2 rounded-xl font-medium disabled:opacity-50" style={s.btnPrimary}>
                  {guardandoClienteOt ? 'Guardando...' : 'Guardar cliente'}
                </button>
                <button type="button" onClick={() => setMostrarEditarClienteOt(false)} className="text-sm px-4 py-2 rounded-xl" style={s.btnSecondary}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="px-6 py-4 flex items-center justify-between flex-wrap gap-3" style={s.headerStyle}>
        <div className="flex items-center gap-4">
          <a href="/dashboard" className="text-sm transition-colors" style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => e.currentTarget.style.color = '#06b6d4'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
            Dashboard
          </a>
          <h1 className="font-bold text-lg" style={{ color: 'var(--text)' }}>Ordenes de trabajo</h1>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}
            className="text-sm rounded-xl px-3 py-2 outline-none" style={s.inputStyle}>
            <option value="">Todos los estados</option>
            <option value="pendiente">Pendiente</option>
            <option value="en_curso">En curso</option>
            <option value="completada">Completada</option>
            <option value="cancelada">Cancelada</option>
          </select>
          <button onClick={abrirFormNuevo} className="text-sm px-4 py-2 rounded-xl font-medium" style={s.btnPrimary}>
            + Nueva OT
          </button>
        </div>
      </div>

      <div className="p-6 max-w-5xl mx-auto">
        {mostrarForm && (
          <div className="rounded-2xl p-6 mb-6" style={s.cardStyle}>
            <h2 className="font-semibold mb-5" style={{ color: 'var(--text)' }}>{editandoId ? 'Editar orden' : 'Nueva orden de trabajo'}</h2>
            <form onSubmit={guardarOrden} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-muted)' }}>Tipo</label>
                <select value={tipo} onChange={e => setTipo(e.target.value)} className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={s.inputStyle}>
                  <option value="limpieza">Limpieza</option>
                  <option value="sustitucion">Sustitucion</option>
                  <option value="mantenimiento">Mantenimiento</option>
                  <option value="instalacion">Instalacion</option>
                  <option value="revision">Revision</option>
                  <option value="otro">Otro</option>
                </select>
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-muted)' }}>Empresa cliente</label>
                <select
                  value={empresaOt}
                  onChange={e => {
                    setEmpresaOt((e.target.value || 'teros') as 'teros' | 'olipro')
                    setClienteId('')
                    setBusquedaCliente('')
                    setNombreClienteSeleccionado('')
                    setResultadosCliente([])
                  }}
                  className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                  style={s.inputStyle}
                >
                  <option value="teros">Clientes Teros</option>
                  <option value="olipro">Clientes Olipro</option>
                </select>
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-muted)' }}>Cliente</label>
                <div className="relative">
                  <input
                    value={nombreClienteSeleccionado || busquedaCliente}
                    onChange={e => buscarClientes(e.target.value)}
                    placeholder="Escribe para buscar cliente..."
                    className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                    style={s.inputStyle}
                    autoComplete="off"
                  />
                  {buscandoCliente && (
                    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Buscando...</p>
                  )}
                  {resultadosCliente.length > 0 && !nombreClienteSeleccionado && (
                    <div className="absolute z-20 w-full mt-1 rounded-xl overflow-hidden shadow-xl max-h-52 overflow-y-auto"
                      style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                      {resultadosCliente.map(c => (
                        <button key={c.id} type="button"
                          onClick={() => {
                            const nombreMostrar = nombreComercialCliente(c) || c.nombre || ''
                            setClienteId(c.id)
                            setNombreClienteSeleccionado(nombreMostrar)
                            setBusquedaCliente(nombreMostrar)
                            setResultadosCliente([])
                          }}
                          className="w-full text-left px-4 py-2.5 text-sm"
                          style={{ color: 'var(--text)', borderBottom: '1px solid var(--border)' }}
                          onMouseEnter={e => e.currentTarget.style.background = 'rgba(124,58,237,0.1)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                          <div className="flex items-center justify-between gap-2">
                            <span>{nombreComercialCliente(c) || c.nombre}</span>
                            <span
                              className="text-xs"
                              style={{
                                color: normalizarEmpresaCliente(c.tipo_cliente || c.empresa) === 'teros'
                                  ? '#06b6d4'
                                  : '#a78bfa',
                              }}
                            >
                              {normalizarEmpresaCliente(c.tipo_cliente || c.empresa) === 'teros' ? 'Teros' : 'Olipro'}
                            </span>
                          </div>
                          <p className="text-xs mt-0.5" style={{ color: 'var(--text-subtle)' }}>
                            {getTextoClienteSecundario(c) || 'Sin datos fiscales'}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                  {busquedaCliente.length >= 2 && !buscandoCliente && resultadosCliente.length === 0 && !nombreClienteSeleccionado && (
                    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Sin resultados</p>
                  )}
                </div>
                {clienteId && (
                  <button
                    type="button"
                    onClick={abrirEditarClienteDesdeOt}
                    className="text-xs px-3 py-1.5 rounded-lg mt-2"
                    style={{ background: 'rgba(124,58,237,0.1)', color: '#a78bfa', border: '1px solid rgba(124,58,237,0.2)' }}
                  >
                    Editar datos del cliente
                  </button>
                )}
              </div>
              <div className="md:col-span-2">
                <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-muted)' }}>Trabajadores</label>
                <div className="flex flex-wrap gap-2">
                  {tecnicos.map(t => (
                    <button key={t.id} type="button" onClick={() => toggleTecnico(t.id)}
                      className="px-3 py-1.5 rounded-xl text-sm transition-all"
                      style={tecnicosSeleccionados.includes(t.id) ? s.btnPrimary : s.btnSecondary}>
                      {t.nombre}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-muted)' }}>Fecha programada</label>
                <input type="datetime-local" step={1800} value={fecha} onChange={e => setFecha(e.target.value)} required className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={s.inputStyle} />
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-muted)' }}>Grado de intervencion</label>
                <select value={prioridad} onChange={e => setPrioridad(e.target.value)} className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={s.inputStyle}>
                  <option value="1">1 - Basico</option>
                  <option value="2">2 - Medio</option>
                  <option value="3">3 - Excelente</option>
                </select>
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-muted)' }}>Vehiculo asignado</label>
                <select value={vehiculoId} onChange={e => setVehiculoId(e.target.value)} className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={s.inputStyle}>
                  <option value="">Sin vehiculo</option>
                  {vehiculos.map((v: any) => (
                    <option key={v.id} value={v.id}>
                      {getNombreVehiculo(v.id)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-muted)' }}>Conductor del vehiculo</label>
                <select value={tecnicoVehiculoId} onChange={e => setTecnicoVehiculoId(e.target.value)} className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={s.inputStyle}>
                  <option value="">Sin asignar</option>
                  {(tecnicosSeleccionados.length > 0 ? tecnicos.filter((t: any) => tecnicosSeleccionados.includes(t.id)) : tecnicos).map((t: any) => (
                    <option key={t.id} value={t.id}>
                      {t.nombre}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-muted)' }}>Estado</label>
                <select value={estado} onChange={e => setEstado(e.target.value)} className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={s.inputStyle}>
                  <option value="pendiente">Pendiente</option>
                  <option value="en_curso">En curso</option>
                  <option value="completada">Completada</option>
                  <option value="cancelada">Cancelada</option>
                </select>
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-muted)' }}>Duracion estimada</label>
                <select value={duracionHoras} onChange={e => setDuracionHoras(e.target.value)} className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={s.inputStyle}>
                  <option value="0.5">30 min</option>
                  <option value="1">1 hora</option>
                  <option value="1.5">1.5 horas</option>
                  <option value="2">2 horas</option>
                  <option value="2.5">2.5 horas</option>
                  <option value="3">3 horas</option>
                  <option value="4">4 horas</option>
                  <option value="5">5 horas</option>
                  <option value="6">6 horas</option>
                  <option value="8">Jornada completa</option>
                </select>
              </div>
              <div className="flex items-center gap-3 rounded-xl px-3 py-2 mt-auto" style={s.inputStyle}>
                <input type="checkbox" id="hora-fija" checked={horaFija} onChange={e => setHoraFija(e.target.checked)} className="w-4 h-4" style={{ accentColor: '#7c3aed' }} />
                <label htmlFor="hora-fija" className="text-sm cursor-pointer" style={{ color: 'var(--text-muted)' }}>Hora fija con cliente</label>
              </div>
              <div className="md:col-span-2">
                <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-muted)' }}>Descripcion</label>
                <textarea value={descripcion} onChange={e => setDescripcion(e.target.value)} required rows={3}
                  className="w-full rounded-xl px-3 py-2 text-sm outline-none resize-none"
                  style={s.inputStyle} placeholder="Describe los trabajos a realizar..." />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-muted)' }}>Observaciones</label>
                <textarea value={observaciones} onChange={e => setObservaciones(e.target.value)} rows={2}
                  className="w-full rounded-xl px-3 py-2 text-sm outline-none resize-none"
                  style={s.inputStyle} placeholder="Instrucciones especiales..." />
              </div>
              <div className="md:col-span-2 flex gap-3">
                <button type="submit" className="px-5 py-2 rounded-xl text-sm font-medium" style={s.btnPrimary}>
                  {editandoId ? 'Guardar cambios' : 'Crear OT'}
                </button>
                <button type="button" onClick={() => { setMostrarForm(false); setEditandoId(null) }}
                  className="text-sm px-5 py-2 rounded-xl" style={s.btnSecondary}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        )}

        {ordenDetalle && (
          <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center" style={{ background: 'rgba(0,0,0,0.8)' }}>
            <div className="w-full md:max-w-2xl rounded-t-2xl md:rounded-2xl overflow-y-auto" style={{ ...s.cardStyle, maxHeight: '92vh' }}>
              <div className="sticky top-0 px-6 py-4 flex items-center justify-between rounded-t-2xl" style={s.headerStyle}>
                <div>
                  <h2 className="font-bold text-lg" style={{ color: 'var(--text)' }}>{nombreComercialCliente(ordenDetalle.clientes) || ordenDetalle.clientes?.nombre || '—'}</h2>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Trabajador asignado: {getNombresTecnicos(ordenDetalle.tecnicos_ids || [])}</p>
                  <p className="font-mono text-xs mt-1" style={{ color: '#06b6d4' }}>OT {ordenDetalle.codigo} - {ordenDetalle.tipo}</p>
                  {getTextoClienteSecundario(ordenDetalle.clientes) && (
                    <p className="text-xs mt-1" style={{ color: 'var(--text-subtle)' }}>{getTextoClienteSecundario(ordenDetalle.clientes)}</p>
                  )}
                </div>
                <button onClick={() => setOrdenDetalle(null)} className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}>X</button>
              </div>
              <div className="p-6 pb-16">
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {[
                    { label: 'Estado', val: <span className="text-xs px-2 py-1 rounded-full" style={{ background: ESTADO_COLORS[ordenDetalle.estado]?.bg, color: ESTADO_COLORS[ordenDetalle.estado]?.color }}>{ordenDetalle.estado.replace('_', ' ')}</span> },
                    { label: 'Grado', val: <span className="text-sm font-medium" style={{ color: PRIORIDAD_COLORS[normalizarGradoIntervencion(ordenDetalle.prioridad)] }}>{textoGradoIntervencion(ordenDetalle.prioridad)}</span> },
                    { label: 'Tipo', val: <span className="text-sm capitalize" style={{ color: 'var(--text)' }}>{ordenDetalle.tipo}</span> },
                    { label: 'Fecha', val: <span className="text-sm" style={{ color: 'var(--text)' }}>{ordenDetalle.fecha_programada ? new Date(ordenDetalle.fecha_programada).toLocaleDateString('es-ES') : '—'}</span> },
                    { label: 'Duracion', val: <span className="text-sm" style={{ color: 'var(--text)' }}>{ordenDetalle.duracion_horas || 2}h</span> },
                    { label: 'Hora fija', val: <span className="text-sm font-medium" style={{ color: ordenDetalle.hora_fija ? '#f59e0b' : 'var(--text-muted)' }}>{ordenDetalle.hora_fija ? 'Si' : 'No'}</span> },
                    { label: 'Vehiculo', val: <span className="text-sm" style={{ color: 'var(--text)' }}>{getNombreVehiculo(ordenDetalle.vehiculo_id)}</span> },
                    { label: 'Conductor', val: <span className="text-sm" style={{ color: 'var(--text)' }}>{getNombreTecnico(ordenDetalle.tecnico_vehiculo_id)}</span> },
                  ].map((item, i) => (
                    <div key={i} className="rounded-xl p-3" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                      <p className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>{item.label}</p>
                      {item.val}
                    </div>
                  ))}
                </div>

                <div className="rounded-xl p-3 mb-4" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                  <p className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Trabajadores</p>
                  <p className="text-sm" style={{ color: 'var(--text)' }}>{getNombresTecnicos(ordenDetalle.tecnicos_ids || [])}</p>
                </div>
                <div className="rounded-xl p-3 mb-4" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                  <p className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Vehiculo y conductor</p>
                  <p className="text-sm" style={{ color: 'var(--text)' }}>{getNombreVehiculo(ordenDetalle.vehiculo_id)}</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-subtle)' }}>{getNombreTecnico(ordenDetalle.tecnico_vehiculo_id)}</p>
                </div>

                {ordenDetalle.descripcion && (
                  <div className="rounded-xl p-3 mb-4" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                    <p className="text-xs uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Trabajos a realizar</p>
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--text)' }}>{ordenDetalle.descripcion}</p>
                  </div>
                )}

                {ordenDetalle.observaciones && (
                  <div className="rounded-xl p-3 mb-4" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                    <p className="text-xs uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Observaciones</p>
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--text)' }}>{ordenDetalle.observaciones}</p>
                  </div>
                )}

                <div className="rounded-2xl p-4 mb-4" style={{ background: 'rgba(6,182,212,0.05)', border: '1px solid rgba(6,182,212,0.2)' }}>
                  <p className="font-medium text-sm mb-1" style={{ color: '#06b6d4' }}>Escanear material o equipo</p>
                  <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>Escanea el QR para registrar salida vinculada a esta OT.</p>
                  <button onClick={() => router.push(`/escanear?orden=${ordenDetalle.id}`)}
                    className="w-full py-2.5 rounded-xl text-sm font-medium"
                    style={{ background: 'linear-gradient(135deg, #059669, #06b6d4)', color: 'white' }}>
                    Abrir escaner QR
                  </button>
                </div>

                <div className="mb-4">
                  <h3 className="font-semibold mb-3" style={{ color: 'var(--text)' }}>Fotos</h3>
                  {subiendo && <p className="text-sm mb-3" style={{ color: '#06b6d4' }}>Subiendo foto...</p>}
                  {TIPOS_FOTO.map(tf => {
                    const fotosDelTipo = (ordenDetalle.fotos || []).filter((f: any) => f.tipo === tf.key)
                    return (
                      <div key={tf.key} className="mb-4">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{tf.label}</p>
                          <label className="text-xs px-3 py-1 rounded-lg cursor-pointer" style={{ background: 'var(--bg)', color: '#06b6d4', border: '1px solid var(--border)' }}>
                            + Foto
                            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => subirFoto(e, tf.key)} />
                          </label>
                        </div>
                        {fotosDelTipo.length > 0 ? (
                          <div className="grid grid-cols-3 gap-2">
                            {fotosDelTipo.map((f: any) => (
                              <div key={f.id} className="relative">
                                <a href={f.url} target="_blank" rel="noreferrer">
                                  <img src={f.url} alt="foto" className="w-full h-24 object-cover rounded-xl" style={{ border: '1px solid var(--border)' }} />
                                </a>
                                <button onClick={() => eliminarFoto(f)}
                                  className="absolute top-1 right-1 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                                  style={{ background: 'rgba(239,68,68,0.9)', color: 'white' }}>
                                  X
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>Sin fotos</p>
                        )}
                      </div>
                    )
                  })}
                </div>

                <div className="flex gap-3 flex-wrap pt-4" style={{ borderTop: '1px solid var(--border)' }}>
                  {ordenDetalle.estado === 'pendiente' && (
                    <button onClick={() => cambiarEstado(ordenDetalle.id, 'en_curso')}
                      className="text-sm px-4 py-2 rounded-xl font-medium"
                      style={{ background: 'rgba(234,179,8,0.15)', color: '#fbbf24', border: '1px solid rgba(234,179,8,0.3)' }}>
                      Iniciar trabajo
                    </button>
                  )}
                  {ordenDetalle.estado === 'en_curso' && (
                    <button onClick={() => cambiarEstado(ordenDetalle.id, 'completada')}
                      className="text-sm px-4 py-2 rounded-xl font-medium"
                      style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399', border: '1px solid rgba(16,185,129,0.3)' }}>
                      Completar
                    </button>
                  )}
                  {ordenDetalle.estado !== 'pendiente' && (
                    <button onClick={() => cambiarEstado(ordenDetalle.id, 'pendiente')}
                      className="text-sm px-4 py-2 rounded-xl font-medium"
                      style={{ background: 'rgba(6,182,212,0.12)', color: '#06b6d4', border: '1px solid rgba(6,182,212,0.3)' }}>
                      Volver a pendiente
                    </button>
                  )}
                  <button onClick={() => abrirFormEditar(ordenDetalle)}
                    className="text-sm px-4 py-2 rounded-xl"
                    style={{ background: 'rgba(124,58,237,0.15)', color: '#a78bfa', border: '1px solid rgba(124,58,237,0.3)' }}>
                    Editar OT
                  </button>
                  <button onClick={() => { setOrdenDetalle(null); setTimeout(() => pedirEliminarOrden(ordenAEliminar || ordenDetalle), 100) }}
                    className="text-sm px-4 py-2 rounded-xl"
                    style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
                    Eliminar
                  </button>
                  <button onClick={() => setOrdenDetalle(null)}
                    className="text-sm px-4 py-2 rounded-xl ml-auto" style={s.btnSecondary}>
                    Cerrar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#7c3aed', borderTopColor: 'transparent' }}></div>
          </div>
        ) : ordenesFiltradas.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-5xl mb-4">📋</p>
            <p style={{ color: 'var(--text-muted)' }}>No hay ordenes. Crea la primera.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {ordenesFiltradas.map(o => (
              <div key={o.id} onClick={() => abrirDetalle(o)}
                className="rounded-2xl p-5 cursor-pointer transition-all" style={s.cardStyle}
                onMouseEnter={e => e.currentTarget.style.borderColor = '#7c3aed'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
	                <div className="flex items-start justify-between flex-wrap gap-3">
	                  <div className="min-w-0">
	                    <p className="font-semibold" style={{ color: 'var(--text)' }}>
	                      {nombreComercialCliente(o.clientes) || o.clientes?.nombre || '-'}
	                    </p>
	                    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
	                      Trabajador asignado: {getNombresTecnicos(o.tecnicos_ids || [])}
	                    </p>
	                    <p className="font-mono text-xs mt-1" style={{ color: '#06b6d4' }}>
	                      OT {o.codigo} - {o.tipo}
	                    </p>
	                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: ESTADO_COLORS[o.estado]?.bg, color: ESTADO_COLORS[o.estado]?.color }}>
                        {o.estado.replace('_', ' ')}
                      </span>
                      <span className="text-xs font-medium" style={{ color: PRIORIDAD_COLORS[normalizarGradoIntervencion(o.prioridad)] }}>{textoGradoIntervencion(o.prioridad)}</span>
                      {o.hora_fija && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>Hora fija</span>}
                    </div>
                    {getTextoClienteSecundario(o.clientes) && (
                      <p className="text-xs mt-1" style={{ color: 'var(--text-subtle)' }}>{getTextoClienteSecundario(o.clientes)}</p>
                    )}
                    <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{(o.descripcion || '').substring(0, 100)}{(o.descripcion || '').length > 100 ? '...' : ''}</p>
                    <div className="flex gap-4 mt-2 text-xs flex-wrap" style={{ color: 'var(--text-subtle)' }}>
                      <span>Vehiculo: {getNombreVehiculo(o.vehiculo_id)}</span>
                      <span>Duracion: {o.duracion_horas || 2}h</span>
                      <span>Fecha: {o.fecha_programada ? new Date(o.fecha_programada).toLocaleDateString('es-ES') : '-'}</span>
                    </div>
                  </div>
                  <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>Ver detalle {'>'}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
