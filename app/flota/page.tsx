'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import AppHeader from '@/app/components/AppHeader'
import { s } from '@/lib/styles'
import { compressImageForUpload } from '@/lib/image-compression'

const ROLES_EDICION = ['gerente', 'oficina', 'supervisor']

function extraerJson(texto: string) {
  const limpio = String(texto || '').replace(/```json|```/gi, '').trim()
  const ini = limpio.indexOf('{')
  const fin = limpio.lastIndexOf('}')
  if (ini < 0 || fin < 0 || fin <= ini) return null
  try {
    return JSON.parse(limpio.slice(ini, fin + 1))
  } catch {
    return null
  }
}

function normalizarFecha(valor: any): string | null {
  const txt = String(valor || '').trim()
  if (!txt) return null

  const iso = txt.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`

  const es = txt.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (es) {
    const dd = String(es[1]).padStart(2, '0')
    const mm = String(es[2]).padStart(2, '0')
    const yyyy = es[3].length === 2 ? `20${es[3]}` : es[3]
    return `${yyyy}-${mm}-${dd}`
  }

  const d = new Date(txt)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 10)
}

function diasRestantes(fecha: string | null | undefined) {
  if (!fecha) return null
  const limite = new Date(`${fecha}T12:00:00`)
  if (Number.isNaN(limite.getTime())) return null
  return Math.floor((limite.getTime() - Date.now()) / 86400000)
}

function estiloVencimiento(dias: number | null) {
  if (dias === null) return { color: 'var(--text-muted)', bg: 'rgba(100,116,139,0.12)', border: 'rgba(100,116,139,0.25)' }
  if (dias < 0) return { color: '#f87171', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.3)' }
  if (dias <= 30) return { color: '#fbbf24', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)' }
  return { color: '#34d399', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.3)' }
}

function textoDias(dias: number | null) {
  if (dias === null) return 'Sin fecha'
  if (dias < 0) return `Caducado hace ${Math.abs(dias)} días`
  if (dias === 0) return 'Caduca hoy'
  return `${dias} días restantes`
}

function kmRestantesRevision(vehiculo: any) {
  const actual = Number(vehiculo?.km_actual ?? Number.NaN)
  const proxima = Number(vehiculo?.proxima_revision_km ?? Number.NaN)
  if (!Number.isFinite(actual) || !Number.isFinite(proxima) || proxima <= 0) return null
  return Math.round(proxima - actual)
}

function estiloRevisionKm(restanteKm: number | null) {
  if (restanteKm === null) return { color: 'var(--text-muted)', bg: 'rgba(100,116,139,0.12)', border: 'rgba(100,116,139,0.25)' }
  if (restanteKm < 0) return { color: '#f87171', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.3)' }
  if (restanteKm <= 1000) return { color: '#fbbf24', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)' }
  return { color: '#34d399', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.3)' }
}

function textoRevisionKm(restanteKm: number | null) {
  if (restanteKm === null) return 'Sin objetivo KM'
  if (restanteKm < 0) return `Vencida por ${Math.abs(restanteKm).toLocaleString('es-ES')} km`
  if (restanteKm === 0) return 'Toca revisión ahora'
  return `Faltan ${restanteKm.toLocaleString('es-ES')} km`
}

function aTsFecha(valor: string | null | undefined) {
  if (!valor) return 0
  const d = new Date(`${valor}T12:00:00`)
  if (Number.isNaN(d.getTime())) return 0
  return d.getTime()
}

function anioVigenciaDocumento(doc: any) {
  const candidato = doc?.fecha_caducidad || doc?.fecha_emision || doc?.created_at || null
  if (!candidato) return new Date().getFullYear()

  if (String(candidato).includes('T')) {
    const d = new Date(String(candidato))
    if (!Number.isNaN(d.getTime())) return d.getFullYear()
  }

  const y = Number(String(candidato).slice(0, 4))
  if (Number.isFinite(y) && y >= 2000 && y <= 2100) return y
  return new Date().getFullYear()
}

function extraerPathStorageVehiculo(url: string) {
  const marcador = '/storage/v1/object/public/vehiculos-documentos/'
  const idx = url.indexOf(marcador)
  if (idx < 0) return null
  const encoded = url.slice(idx + marcador.length)
  if (!encoded) return null
  return decodeURIComponent(encoded)
}

function normalizarTipoDocumento(raw: string) {
  const v = String(raw || '').toLowerCase().trim()
  if (!v) return 'otro'
  if (v.includes('seguro') || v.includes('poliza')) return 'seguro'
  if (v.includes('itv')) return 'itv'
  if (v.includes('itc')) return 'itc'
  if (v.includes('impuesto')) return 'impuesto'
  if (v.includes('permiso')) return 'permiso_circulacion'
  if (v.includes('ficha')) return 'ficha_tecnica'
  return 'otro'
}

export default function FlotaPage() {
  const [loading, setLoading] = useState(true)
  const [vehiculos, setVehiculos] = useState<any[]>([])
  const [vehiculoDetalle, setVehiculoDetalle] = useState<any>(null)
  const [documentos, setDocumentos] = useState<any[]>([])
  const [perfil, setPerfil] = useState<any>(null)
  const [userId, setUserId] = useState('')
  const [mostrarForm, setMostrarForm] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [guardandoVehiculo, setGuardandoVehiculo] = useState(false)
  const [subiendoDoc, setSubiendoDoc] = useState(false)
  const [analizandoDocId, setAnalizandoDocId] = useState<string | null>(null)

  const [matricula, setMatricula] = useState('')
  const [alias, setAlias] = useState('')
  const [marca, setMarca] = useState('')
  const [modelo, setModelo] = useState('')
  const [tipo, setTipo] = useState('furgon')
  const [combustible, setCombustible] = useState('diesel')
  const [anio, setAnio] = useState('')
  const [kmActual, setKmActual] = useState('0')
  const [ultimaRevisionFecha, setUltimaRevisionFecha] = useState('')
  const [kmUltimaRevision, setKmUltimaRevision] = useState('')
  const [proximaRevisionKm, setProximaRevisionKm] = useState('')
  const [proximaItv, setProximaItv] = useState('')
  const [vencimientoItc, setVencimientoItc] = useState('')
  const [vencimientoSeguro, setVencimientoSeguro] = useState('')
  const [vencimientoImpuesto, setVencimientoImpuesto] = useState('')
  const [companiaSeguro, setCompaniaSeguro] = useState('')
  const [numeroPoliza, setNumeroPoliza] = useState('')
  const [notas, setNotas] = useState('')

  const [tipoDoc, setTipoDoc] = useState('otro')
  const [fechaEmisionDoc, setFechaEmisionDoc] = useState('')
  const [fechaCaducidadDoc, setFechaCaducidadDoc] = useState('')
  const [proveedorDoc, setProveedorDoc] = useState('')
  const [numeroDoc, setNumeroDoc] = useState('')
  const [autoAnalizar, setAutoAnalizar] = useState(true)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const puedeEditar = ROLES_EDICION.includes(String(perfil?.rol || ''))

  const resetForm = useCallback(() => {
    setMatricula('')
    setAlias('')
    setMarca('')
    setModelo('')
    setTipo('furgon')
    setCombustible('diesel')
    setAnio('')
    setKmActual('0')
    setUltimaRevisionFecha('')
    setKmUltimaRevision('')
    setProximaRevisionKm('')
    setProximaItv('')
    setVencimientoItc('')
    setVencimientoSeguro('')
    setVencimientoImpuesto('')
    setCompaniaSeguro('')
    setNumeroPoliza('')
    setNotas('')
  }, [])

  const cargarVehiculos = useCallback(async (vehiculoSeleccionadoId?: string | null) => {
    const { data } = await supabase
      .from('vehiculos_flota')
      .select('*')
      .eq('activo', true)
      .order('matricula')

    const lista = data || []
    setVehiculos(lista)

    if (vehiculoSeleccionadoId) {
      const actualizado = lista.find((v: any) => v.id === vehiculoSeleccionadoId) || null
      setVehiculoDetalle(actualizado)
    }
  }, [])

  const cargarDocumentosVehiculo = useCallback(async (vehiculoId: string) => {
    const { data } = await supabase
      .from('vehiculos_documentos')
      .select('*')
      .eq('vehiculo_id', vehiculoId)
      .order('created_at', { ascending: false })
    setDocumentos(data || [])
  }, [])

  const cargarInicial = useCallback(async () => {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }
      setUserId(session.user.id)

      const { data: perfilData } = await supabase
        .from('perfiles')
        .select('id, nombre, rol')
        .eq('id', session.user.id)
        .single()
      setPerfil(perfilData || null)

      await cargarVehiculos()
    } finally {
      setLoading(false)
    }
  }, [router, cargarVehiculos])

  useEffect(() => {
    void cargarInicial()
  }, [cargarInicial])

  const alertasVencimientos = useMemo(() => {
    const items: { vehiculo: any; campo: string; fecha: string; dias: number }[] = []
    for (const v of vehiculos) {
      const lista = [
        { campo: 'ITV', fecha: v.proxima_itv },
        { campo: 'ITC', fecha: v.vencimiento_itc },
        { campo: 'Seguro', fecha: v.vencimiento_seguro },
        { campo: 'Impuesto', fecha: v.vencimiento_impuesto },
      ]
      for (const item of lista) {
        const dias = diasRestantes(item.fecha)
        if (dias === null) continue
        if (dias <= 45) items.push({ vehiculo: v, campo: item.campo, fecha: item.fecha, dias })
      }
    }
    return items.sort((a, b) => a.dias - b.dias).slice(0, 12)
  }, [vehiculos])

  const alertasRevisionKm = useMemo(() => {
    const items: { vehiculo: any; restanteKm: number; proximaKm: number; actualKm: number }[] = []
    for (const v of vehiculos) {
      const restante = kmRestantesRevision(v)
      const proximaKm = Number(v?.proxima_revision_km ?? Number.NaN)
      const actualKm = Number(v?.km_actual ?? Number.NaN)
      if (restante === null || !Number.isFinite(proximaKm) || !Number.isFinite(actualKm)) continue
      if (restante <= 1000) items.push({ vehiculo: v, restanteKm: restante, proximaKm, actualKm })
    }
    return items.sort((a, b) => a.restanteKm - b.restanteKm).slice(0, 12)
  }, [vehiculos])

  const resumenDocumentos = useMemo(() => {
    let vencidos = 0
    let porVencer = 0
    let enVigor = 0
    let sinFecha = 0
    let proximoDias: number | null = null

    for (const doc of documentos) {
      const dias = diasRestantes(doc?.fecha_caducidad)
      if (dias === null) {
        sinFecha += 1
        continue
      }
      if (dias < 0) vencidos += 1
      else if (dias <= 30) porVencer += 1
      else enVigor += 1
      if (proximoDias === null || dias < proximoDias) proximoDias = dias
    }

    return {
      total: documentos.length,
      vencidos,
      porVencer,
      enVigor,
      sinFecha,
      proximoDias,
    }
  }, [documentos])

  const documentosPorAnio = useMemo(() => {
    const mapa = new Map<number, any[]>()
    for (const doc of documentos) {
      const anio = anioVigenciaDocumento(doc)
      const lista = mapa.get(anio) || []
      lista.push(doc)
      mapa.set(anio, lista)
    }

    const grupos = Array.from(mapa.entries())
      .map(([anio, docs]) => ({
        anio,
        docs: docs.sort((a: any, b: any) => {
          const tsA = Math.max(
            aTsFecha(a?.fecha_caducidad),
            aTsFecha(a?.fecha_emision),
            new Date(a?.created_at || 0).getTime() || 0
          )
          const tsB = Math.max(
            aTsFecha(b?.fecha_caducidad),
            aTsFecha(b?.fecha_emision),
            new Date(b?.created_at || 0).getTime() || 0
          )
          return tsB - tsA
        }),
      }))
      .sort((a, b) => b.anio - a.anio)

    return grupos
  }, [documentos])

  function abrirNuevoVehiculo() {
    if (!puedeEditar) {
      alert('No tienes permisos para crear vehículos.')
      return
    }
    setEditandoId(null)
    resetForm()
    setMostrarForm(true)
  }

  function abrirEditarVehiculo(v: any) {
    if (!puedeEditar) {
      alert('No tienes permisos para editar vehículos.')
      return
    }
    setEditandoId(v.id)
    setMatricula(v.matricula || '')
    setAlias(v.alias || '')
    setMarca(v.marca || '')
    setModelo(v.modelo || '')
    setTipo(v.tipo || 'furgon')
    setCombustible(v.combustible || 'diesel')
    setAnio(v.anio ? String(v.anio) : '')
    setKmActual(v.km_actual ? String(v.km_actual) : '0')
    setUltimaRevisionFecha(v.ultima_revision_fecha || '')
    setKmUltimaRevision(v.km_ultima_revision ? String(v.km_ultima_revision) : '')
    setProximaRevisionKm(v.proxima_revision_km ? String(v.proxima_revision_km) : '')
    setProximaItv(v.proxima_itv || '')
    setVencimientoItc(v.vencimiento_itc || '')
    setVencimientoSeguro(v.vencimiento_seguro || '')
    setVencimientoImpuesto(v.vencimiento_impuesto || '')
    setCompaniaSeguro(v.compania_seguro || '')
    setNumeroPoliza(v.numero_poliza || '')
    setNotas(v.notas || '')
    setMostrarForm(true)
  }

  async function guardarVehiculo(e: React.FormEvent) {
    e.preventDefault()
    if (!puedeEditar) {
      alert('No tienes permisos para guardar vehículos.')
      return
    }
    setGuardandoVehiculo(true)
    try {
      const payload: any = {
        matricula: matricula.trim().toUpperCase(),
        alias: alias.trim() || null,
        marca: marca.trim() || null,
        modelo: modelo.trim() || null,
        tipo: tipo || 'furgon',
        combustible: combustible || null,
        anio: anio ? Number(anio) : null,
        km_actual: kmActual ? Number(kmActual) : 0,
        ultima_revision_fecha: ultimaRevisionFecha || null,
        km_ultima_revision: kmUltimaRevision ? Number(kmUltimaRevision) : null,
        proxima_revision_km: proximaRevisionKm ? Number(proximaRevisionKm) : null,
        proxima_itv: proximaItv || null,
        vencimiento_itc: vencimientoItc || null,
        vencimiento_seguro: vencimientoSeguro || null,
        vencimiento_impuesto: vencimientoImpuesto || null,
        compania_seguro: companiaSeguro.trim() || null,
        numero_poliza: numeroPoliza.trim() || null,
        notas: notas.trim() || null,
      }

      if (editandoId) {
        await supabase.from('vehiculos_flota').update(payload).eq('id', editandoId)
      } else {
        const { data } = await supabase.from('vehiculos_flota').insert(payload).select('id').single()
        if (data?.id) setVehiculoDetalle({ ...payload, id: data.id })
      }

      setMostrarForm(false)
      await cargarVehiculos(editandoId || vehiculoDetalle?.id)
      if (vehiculoDetalle?.id) await cargarDocumentosVehiculo(vehiculoDetalle.id)
    } catch (error: any) {
      alert(`No se pudo guardar el vehículo: ${String(error?.message || 'Error desconocido')}`)
    } finally {
      setGuardandoVehiculo(false)
    }
  }

  async function abrirDetalleVehiculo(v: any) {
    setVehiculoDetalle(v)
    await cargarDocumentosVehiculo(v.id)
  }

  async function darDeBajaVehiculo(v: any) {
    if (!puedeEditar) {
      alert('No tienes permisos para dar de baja.')
      return
    }
    if (!confirm(`Dar de baja el vehículo ${v.matricula}?`)) return
    await supabase.from('vehiculos_flota').update({ activo: false }).eq('id', v.id)
    if (vehiculoDetalle?.id === v.id) {
      setVehiculoDetalle(null)
      setDocumentos([])
    }
    await cargarVehiculos()
  }

  async function subirDocumentoVehiculo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !vehiculoDetalle) return
    if (!puedeEditar) {
      alert('No tienes permisos para subir documentos.')
      return
    }

    setSubiendoDoc(true)
    try {
      const nombreSeguro = file.name.replace(/\s+/g, '-')
      const esImagen = String(file.type || '').startsWith('image/')
      const subidaLista = esImagen
        ? await compressImageForUpload(file, {
          maxWidth: 1800,
          maxHeight: 1800,
          targetBytes: 420 * 1024,
          outputType: 'image/webp',
        })
        : null
      const extensionDoc = subidaLista?.extension || (nombreSeguro.split('.').pop() || 'bin').toLowerCase()
      const path = `vehiculo_${vehiculoDetalle.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extensionDoc}`
      const { data: up, error: errUp } = await supabase.storage.from('vehiculos-documentos').upload(
        path,
        subidaLista?.blob || file,
        esImagen
          ? { contentType: subidaLista?.contentType || 'image/webp' }
          : undefined
      )
      if (errUp || !up) throw errUp || new Error('No se pudo subir el archivo')

      const { data: urlData } = supabase.storage.from('vehiculos-documentos').getPublicUrl(path)
      const insertPayload: any = {
        vehiculo_id: vehiculoDetalle.id,
        tipo: tipoDoc || 'otro',
        nombre_archivo: file.name,
        mime_type: file.type || null,
        url: urlData.publicUrl,
        fecha_emision: fechaEmisionDoc || null,
        fecha_caducidad: fechaCaducidadDoc || null,
        proveedor: proveedorDoc.trim() || null,
        numero_documento: numeroDoc.trim() || null,
        created_by: userId || null,
        metadata: { origen: 'flota_modulo' },
      }

      const { data: docCreado, error: errInsert } = await supabase
        .from('vehiculos_documentos')
        .insert(insertPayload)
        .select('*')
        .single()
      if (errInsert) throw errInsert

      setFechaEmisionDoc('')
      setFechaCaducidadDoc('')
      setProveedorDoc('')
      setNumeroDoc('')
      if (fileInputRef.current) fileInputRef.current.value = ''

      await cargarDocumentosVehiculo(vehiculoDetalle.id)
      if (autoAnalizar && docCreado) {
        await analizarDocumentoIA(docCreado, vehiculoDetalle.id)
      }
    } catch (error: any) {
      alert(`No se pudo subir el documento: ${String(error?.message || 'Error desconocido')}`)
    } finally {
      setSubiendoDoc(false)
    }
  }

  async function eliminarDocumento(doc: any) {
    if (!puedeEditar) {
      alert('No tienes permisos para eliminar documentos.')
      return
    }
    if (!confirm('Eliminar este documento?')) return

    const path = extraerPathStorageVehiculo(String(doc.url || ''))
    if (path) {
      await supabase.storage.from('vehiculos-documentos').remove([path])
    }
    await supabase.from('vehiculos_documentos').delete().eq('id', doc.id)
    if (vehiculoDetalle?.id) await cargarDocumentosVehiculo(vehiculoDetalle.id)
  }

  async function analizarDocumentoIA(doc: any, vehiculoId: string) {
    if (!doc?.url) return
    setAnalizandoDocId(doc.id)
    try {
      const prompt = `
Analiza este documento de vehículo y devuelve SOLO JSON válido:
{
  "matricula": "",
  "marca": "",
  "modelo": "",
  "tipo_documento": "",
  "numero_documento": "",
  "compania_seguro": "",
  "fecha_emision": "YYYY-MM-DD",
  "fecha_caducidad": "YYYY-MM-DD",
  "proxima_itv": "YYYY-MM-DD",
  "vencimiento_itc": "YYYY-MM-DD",
  "vencimiento_seguro": "YYYY-MM-DD",
  "vencimiento_impuesto": "YYYY-MM-DD",
  "ultima_revision_fecha": "YYYY-MM-DD",
  "km_ultima_revision": 0,
  "proxima_revision_km": 0,
  "km_actual": 0,
  "notas": ""
}
Si no identificas un campo dejalo vacio.
`

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imagen: doc.url, prompt }),
      })
      const data = await res.json()
      const json = extraerJson(String(data?.respuesta || ''))
      if (!json) {
        alert('La IA no pudo extraer datos de este archivo. Si es PDF, prueba con una foto del documento.')
        return
      }

      const tipoDocIA = normalizarTipoDocumento(String(json.tipo_documento || ''))
      const fechaEmisionIA = normalizarFecha(json.fecha_emision)
      const fechaCadIA = normalizarFecha(json.fecha_caducidad)
      const numeroDocIA = String(json.numero_documento || '').trim()
      const proveedorIA = String(json.compania_seguro || '').trim()

      const docUpdate: any = {
        analisis_ia: json,
      }
      if (tipoDocIA) docUpdate.tipo = tipoDocIA
      if (fechaEmisionIA) docUpdate.fecha_emision = fechaEmisionIA
      if (fechaCadIA) docUpdate.fecha_caducidad = fechaCadIA
      if (numeroDocIA) docUpdate.numero_documento = numeroDocIA
      if (proveedorIA) docUpdate.proveedor = proveedorIA

      await supabase.from('vehiculos_documentos').update(docUpdate).eq('id', doc.id)

      const vehiculoUpdate: any = {}
      const matriculaIA = String(json.matricula || '').trim().toUpperCase()
      const marcaIA = String(json.marca || '').trim()
      const modeloIA = String(json.modelo || '').trim()
      const notasIA = String(json.notas || '').trim()
      const companiaIA = String(json.compania_seguro || '').trim()
      const polizaIA = String(json.numero_documento || '').trim()
      const kmIA = Number(json.km_actual)
      const kmUltRevIA = Number(json.km_ultima_revision)
      const proximaRevKmIA = Number(json.proxima_revision_km)

      if (matriculaIA) vehiculoUpdate.matricula = matriculaIA
      if (marcaIA) vehiculoUpdate.marca = marcaIA
      if (modeloIA) vehiculoUpdate.modelo = modeloIA
      if (companiaIA) vehiculoUpdate.compania_seguro = companiaIA
      if (polizaIA && tipoDocIA === 'seguro') vehiculoUpdate.numero_poliza = polizaIA
      if (notasIA) vehiculoUpdate.notas = notasIA
      if (Number.isFinite(kmIA) && kmIA > 0) vehiculoUpdate.km_actual = kmIA
      if (Number.isFinite(kmUltRevIA) && kmUltRevIA >= 0) vehiculoUpdate.km_ultima_revision = kmUltRevIA
      if (Number.isFinite(proximaRevKmIA) && proximaRevKmIA > 0) vehiculoUpdate.proxima_revision_km = proximaRevKmIA

      const proximaItvIA = normalizarFecha(json.proxima_itv)
      const vencItcIA = normalizarFecha(json.vencimiento_itc)
      const vencSeguroIA = normalizarFecha(json.vencimiento_seguro)
      const vencImpuestoIA = normalizarFecha(json.vencimiento_impuesto)
      const ultimaRevFechaIA = normalizarFecha(json.ultima_revision_fecha)

      if (proximaItvIA) vehiculoUpdate.proxima_itv = proximaItvIA
      if (vencItcIA) vehiculoUpdate.vencimiento_itc = vencItcIA
      if (vencSeguroIA) vehiculoUpdate.vencimiento_seguro = vencSeguroIA
      if (vencImpuestoIA) vehiculoUpdate.vencimiento_impuesto = vencImpuestoIA
      if (ultimaRevFechaIA) vehiculoUpdate.ultima_revision_fecha = ultimaRevFechaIA

      if (Object.keys(vehiculoUpdate).length > 0) {
        await supabase.from('vehiculos_flota').update(vehiculoUpdate).eq('id', vehiculoId)
      }

      await cargarVehiculos(vehiculoId)
      await cargarDocumentosVehiculo(vehiculoId)
    } catch (error: any) {
      alert(`No se pudo analizar con IA: ${String(error?.message || 'Error desconocido')}`)
    } finally {
      setAnalizandoDocId(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <AppHeader
        title="Flota de Vehículos"
        rightSlot={(
          <div className="flex items-center gap-2">
            <button onClick={() => void cargarVehiculos(vehiculoDetalle?.id)} className="text-sm px-3 py-2 rounded-xl" style={s.btnSecondary}>
              Actualizar
            </button>
            {puedeEditar && (
              <button onClick={abrirNuevoVehiculo} className="text-sm px-4 py-2 rounded-xl font-medium" style={s.btnPrimary}>
                + Nuevo vehículo
              </button>
            )}
          </div>
        )}
      />

      <div className="p-6 max-w-7xl mx-auto">
        {(alertasVencimientos.length > 0 || alertasRevisionKm.length > 0) && (
          <div className="rounded-2xl p-4 mb-4" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)' }}>
            <p className="text-sm font-semibold" style={{ color: '#fbbf24' }}>Vencimientos proximos de flota</p>
            <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
              {alertasVencimientos.slice(0, 6).map((a, idx) => (
                <p key={idx} className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {a.vehiculo.matricula} - {a.campo}: {a.fecha} ({textoDias(a.dias)})
                </p>
              ))}
            </div>
            {alertasRevisionKm.length > 0 && (
              <>
                <p className="text-sm font-semibold mt-3" style={{ color: '#fbbf24' }}>Revisiones por kilometraje próximas</p>
                <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                  {alertasRevisionKm.slice(0, 6).map((a, idx) => (
                    <p key={`km-${idx}`} className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {a.vehiculo.matricula} - Objetivo {a.proximaKm.toLocaleString('es-ES')} km ({textoRevisionKm(a.restanteKm)})
                    </p>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {mostrarForm && (
          <div className="rounded-2xl p-5 mb-4" style={s.cardStyle}>
            <h2 className="font-semibold mb-4" style={{ color: 'var(--text)' }}>
              {editandoId ? 'Editar vehículo' : 'Nuevo vehículo'}
            </h2>
            <form onSubmit={guardarVehiculo} className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input value={matricula} onChange={(e) => setMatricula(e.target.value)} required placeholder="Matricula" className="rounded-xl px-3 py-2 text-sm outline-none" style={s.inputStyle} />
              <input value={alias} onChange={(e) => setAlias(e.target.value)} placeholder="Alias (opcional)" className="rounded-xl px-3 py-2 text-sm outline-none" style={s.inputStyle} />
              <input value={marca} onChange={(e) => setMarca(e.target.value)} placeholder="Marca" className="rounded-xl px-3 py-2 text-sm outline-none" style={s.inputStyle} />
              <input value={modelo} onChange={(e) => setModelo(e.target.value)} placeholder="Modelo" className="rounded-xl px-3 py-2 text-sm outline-none" style={s.inputStyle} />
              <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="rounded-xl px-3 py-2 text-sm outline-none" style={s.inputStyle}>
                <option value="furgon">Furgon</option>
                <option value="camion">Camion</option>
                <option value="turismo">Turismo</option>
                <option value="moto">Moto</option>
                <option value="otro">Otro</option>
              </select>
              <select value={combustible} onChange={(e) => setCombustible(e.target.value)} className="rounded-xl px-3 py-2 text-sm outline-none" style={s.inputStyle}>
                <option value="diesel">Diesel</option>
                <option value="gasolina">Gasolina</option>
                <option value="electrico">Electrico</option>
                <option value="hibrido">Hibrido</option>
                <option value="otro">Otro</option>
              </select>
              <input value={anio} onChange={(e) => setAnio(e.target.value)} type="number" placeholder="Anio" className="rounded-xl px-3 py-2 text-sm outline-none" style={s.inputStyle} />
              <input value={kmActual} onChange={(e) => setKmActual(e.target.value)} type="number" placeholder="KM actuales" className="rounded-xl px-3 py-2 text-sm outline-none" style={s.inputStyle} />
              <input value={kmUltimaRevision} onChange={(e) => setKmUltimaRevision(e.target.value)} type="number" placeholder="KM última revisión" className="rounded-xl px-3 py-2 text-sm outline-none" style={s.inputStyle} />
              <input value={proximaRevisionKm} onChange={(e) => setProximaRevisionKm(e.target.value)} type="number" placeholder="Próxima revisión (KM)" className="rounded-xl px-3 py-2 text-sm outline-none" style={s.inputStyle} />
              <input value={companiaSeguro} onChange={(e) => setCompaniaSeguro(e.target.value)} placeholder="Compañía seguro" className="rounded-xl px-3 py-2 text-sm outline-none" style={s.inputStyle} />
              <input value={numeroPoliza} onChange={(e) => setNumeroPoliza(e.target.value)} placeholder="Número póliza" className="rounded-xl px-3 py-2 text-sm outline-none" style={s.inputStyle} />
              <div>
                <label className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>Última revisión</label>
                <input value={ultimaRevisionFecha} onChange={(e) => setUltimaRevisionFecha(e.target.value)} type="date" className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={s.inputStyle} />
              </div>
              <div>
                <label className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>Próxima ITV</label>
                <input value={proximaItv} onChange={(e) => setProximaItv(e.target.value)} type="date" className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={s.inputStyle} />
              </div>
              <div>
                <label className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>Vencimiento ITC</label>
                <input value={vencimientoItc} onChange={(e) => setVencimientoItc(e.target.value)} type="date" className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={s.inputStyle} />
              </div>
              <div>
                <label className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>Vencimiento seguro</label>
                <input value={vencimientoSeguro} onChange={(e) => setVencimientoSeguro(e.target.value)} type="date" className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={s.inputStyle} />
              </div>
              <div>
                <label className="text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>Vencimiento impuesto</label>
                <input value={vencimientoImpuesto} onChange={(e) => setVencimientoImpuesto(e.target.value)} type="date" className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={s.inputStyle} />
              </div>
              <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} placeholder="Notas" className="md:col-span-3 rounded-xl px-3 py-2 text-sm outline-none resize-none" style={s.inputStyle} />
              <div className="md:col-span-3 flex gap-2">
                <button type="submit" disabled={guardandoVehiculo} className="px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-60" style={s.btnPrimary}>
                  {guardandoVehiculo ? 'Guardando...' : editandoId ? 'Guardar cambios' : 'Crear vehículo'}
                </button>
                <button
                  type="button"
                  onClick={() => { setMostrarForm(false); setEditandoId(null); resetForm() }}
                  className="px-4 py-2 rounded-xl text-sm"
                  style={s.btnSecondary}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-1 flex flex-col gap-3">
            {vehiculos.length === 0 ? (
              <div className="rounded-2xl p-5" style={s.cardStyle}>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No hay vehículos registrados.</p>
              </div>
            ) : (
              vehiculos.map((v: any) => {
                const diasItv = diasRestantes(v.proxima_itv)
                const diasSeguro = diasRestantes(v.vencimiento_seguro)
                const badgeItv = estiloVencimiento(diasItv)
                const badgeSeguro = estiloVencimiento(diasSeguro)
                const restanteRevisionKm = kmRestantesRevision(v)
                const badgeRevisionKm = estiloRevisionKm(restanteRevisionKm)
                const seleccionado = vehiculoDetalle?.id === v.id
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => void abrirDetalleVehiculo(v)}
                    className="rounded-2xl p-4 text-left transition-all"
                    style={{
                      background: 'var(--bg-card)',
                      border: `1px solid ${seleccionado ? '#7c3aed' : 'var(--border)'}`,
                    }}
                  >
                    <p className="font-mono text-sm font-semibold mb-1" style={{ color: '#06b6d4' }}>{v.matricula}</p>
                    <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                      {v.alias || `${v.marca || ''} ${v.modelo || ''}`.trim() || 'Vehículo'}
                    </p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <span className="text-[11px] px-2 py-1 rounded-full" style={{ background: badgeItv.bg, color: badgeItv.color, border: `1px solid ${badgeItv.border}` }}>
                        ITV: {textoDias(diasItv)}
                      </span>
                      <span className="text-[11px] px-2 py-1 rounded-full" style={{ background: badgeSeguro.bg, color: badgeSeguro.color, border: `1px solid ${badgeSeguro.border}` }}>
                        Seguro: {textoDias(diasSeguro)}
                      </span>
                      <span className="text-[11px] px-2 py-1 rounded-full" style={{ background: badgeRevisionKm.bg, color: badgeRevisionKm.color, border: `1px solid ${badgeRevisionKm.border}` }}>
                        Revisión: {textoRevisionKm(restanteRevisionKm)}
                      </span>
                    </div>
                  </button>
                )
              })
            )}
          </div>

          <div className="lg:col-span-2">
            {!vehiculoDetalle ? (
              <div className="rounded-2xl p-6" style={s.cardStyle}>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  Selecciona un vehículo para ver su ficha, vencimientos y documentos.
                </p>
              </div>
            ) : (
              <div className="rounded-2xl p-5" style={s.cardStyle}>
                <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
                  <div>
                    <p className="font-mono text-sm font-semibold" style={{ color: '#06b6d4' }}>{vehiculoDetalle.matricula}</p>
                    <h2 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>
                      {vehiculoDetalle.alias || `${vehiculoDetalle.marca || ''} ${vehiculoDetalle.modelo || ''}`.trim() || 'Vehículo'}
                    </h2>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                      KM: {Number(vehiculoDetalle.km_actual || 0).toLocaleString('es-ES')} - {vehiculoDetalle.combustible || 'N/D'}
                    </p>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                      Última revisión: {vehiculoDetalle.ultima_revision_fecha || 'N/D'}
                      {' - '}
                      KM última: {vehiculoDetalle.km_ultima_revision ? Number(vehiculoDetalle.km_ultima_revision).toLocaleString('es-ES') : 'N/D'}
                      {' - '}
                      Próxima: {vehiculoDetalle.proxima_revision_km ? Number(vehiculoDetalle.proxima_revision_km).toLocaleString('es-ES') : 'N/D'} km
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {puedeEditar && (
                      <>
                        <button onClick={() => abrirEditarVehiculo(vehiculoDetalle)} className="text-sm px-3 py-2 rounded-xl" style={s.btnSecondary}>
                          Editar
                        </button>
                        <button
                          onClick={() => void darDeBajaVehiculo(vehiculoDetalle)}
                          className="text-sm px-3 py-2 rounded-xl"
                          style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}
                        >
                          Dar de baja
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-4">
                  {[
                    { label: 'ITV', fecha: vehiculoDetalle.proxima_itv },
                    { label: 'ITC', fecha: vehiculoDetalle.vencimiento_itc },
                    { label: 'Seguro', fecha: vehiculoDetalle.vencimiento_seguro },
                    { label: 'Impuesto', fecha: vehiculoDetalle.vencimiento_impuesto },
                  ].map((item) => {
                    const dias = diasRestantes(item.fecha)
                    const st = estiloVencimiento(dias)
                    return (
                      <div key={item.label} className="rounded-xl px-3 py-2" style={{ background: st.bg, border: `1px solid ${st.border}` }}>
                        <p className="text-xs uppercase tracking-wider" style={{ color: st.color }}>{item.label}</p>
                        <p className="text-sm" style={{ color: st.color }}>{item.fecha || 'Sin fecha'} - {textoDias(dias)}</p>
                      </div>
                    )
                  })}
                  {(() => {
                    const restanteKm = kmRestantesRevision(vehiculoDetalle)
                    const st = estiloRevisionKm(restanteKm)
                    return (
                      <div className="rounded-xl px-3 py-2" style={{ background: st.bg, border: `1px solid ${st.border}` }}>
                        <p className="text-xs uppercase tracking-wider" style={{ color: st.color }}>Revisión KM</p>
                        <p className="text-sm" style={{ color: st.color }}>
                          Objetivo: {vehiculoDetalle.proxima_revision_km ? Number(vehiculoDetalle.proxima_revision_km).toLocaleString('es-ES') : 'Sin dato'} km
                        </p>
                        <p className="text-xs mt-1" style={{ color: st.color }}>
                          {textoRevisionKm(restanteKm)}
                        </p>
                        <p className="text-xs mt-1" style={{ color: st.color }}>
                          Última: {vehiculoDetalle.ultima_revision_fecha || 'N/D'} - KM {vehiculoDetalle.km_ultima_revision ? Number(vehiculoDetalle.km_ultima_revision).toLocaleString('es-ES') : 'N/D'}
                        </p>
                      </div>
                    )
                  })()}
                </div>

                <div className="rounded-xl p-3 mb-4" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                  <p className="text-xs uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Subir documento (foto o PDF)</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
                    <select value={tipoDoc} onChange={(e) => setTipoDoc(e.target.value)} className="rounded-lg px-2 py-2 text-sm outline-none" style={s.inputStyle}>
                      <option value="otro">Otro</option>
                      <option value="seguro">Seguro</option>
                      <option value="itv">ITV</option>
                      <option value="itc">ITC</option>
                      <option value="impuesto">Impuesto</option>
                      <option value="permiso_circulacion">Permiso circulación</option>
                      <option value="ficha_tecnica">Ficha técnica</option>
                    </select>
                    <input value={proveedorDoc} onChange={(e) => setProveedorDoc(e.target.value)} placeholder="Proveedor / Compañía" className="rounded-lg px-2 py-2 text-sm outline-none" style={s.inputStyle} />
                    <input value={numeroDoc} onChange={(e) => setNumeroDoc(e.target.value)} placeholder="Número documento" className="rounded-lg px-2 py-2 text-sm outline-none" style={s.inputStyle} />
                    <div className="grid grid-cols-2 gap-2">
                      <input value={fechaEmisionDoc} onChange={(e) => setFechaEmisionDoc(e.target.value)} type="date" className="rounded-lg px-2 py-2 text-sm outline-none" style={s.inputStyle} />
                      <input value={fechaCaducidadDoc} onChange={(e) => setFechaCaducidadDoc(e.target.value)} type="date" className="rounded-lg px-2 py-2 text-sm outline-none" style={s.inputStyle} />
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <label className="text-sm px-4 py-2 rounded-xl cursor-pointer" style={s.btnSecondary}>
                      {subiendoDoc ? 'Subiendo...' : 'Subir archivo'}
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*,.pdf,application/pdf"
                        className="hidden"
                        onChange={subirDocumentoVehiculo}
                        disabled={subiendoDoc || !puedeEditar}
                      />
                    </label>
                    <label className="text-sm flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
                      <input type="checkbox" checked={autoAnalizar} onChange={(e) => setAutoAnalizar(e.target.checked)} style={{ accentColor: '#7c3aed' }} />
                      IA autocompletar al subir
                    </label>
                  </div>
                </div>

                <div>
                  <p className="font-semibold text-sm mb-2" style={{ color: 'var(--text)' }}>Documentos del vehículo</p>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-3">
                    <div className="rounded-lg px-3 py-2" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                      <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Total</p>
                      <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{resumenDocumentos.total}</p>
                    </div>
                    <div className="rounded-lg px-3 py-2" style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.28)' }}>
                      <p className="text-[11px]" style={{ color: '#34d399' }}>En vigor</p>
                      <p className="text-sm font-semibold" style={{ color: '#34d399' }}>{resumenDocumentos.enVigor}</p>
                    </div>
                    <div className="rounded-lg px-3 py-2" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)' }}>
                      <p className="text-[11px]" style={{ color: '#fbbf24' }}>Vence pronto</p>
                      <p className="text-sm font-semibold" style={{ color: '#fbbf24' }}>{resumenDocumentos.porVencer}</p>
                    </div>
                    <div className="rounded-lg px-3 py-2" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
                      <p className="text-[11px]" style={{ color: '#f87171' }}>Vencidos</p>
                      <p className="text-sm font-semibold" style={{ color: '#f87171' }}>{resumenDocumentos.vencidos}</p>
                    </div>
                    <div className="rounded-lg px-3 py-2" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                      <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Proximo</p>
                      <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{textoDias(resumenDocumentos.proximoDias)}</p>
                    </div>
                  </div>

                  {documentos.length === 0 ? (
                    <div className="rounded-xl p-3" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                      <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>Sin documentos.</p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {documentosPorAnio.map((grupo) => (
                        <div key={grupo.anio} className="rounded-xl p-3" style={{ background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.2)' }}>
                          <div className="flex items-center justify-between mb-3">
                            <p className="text-sm font-semibold" style={{ color: '#a78bfa' }}>
                              Historial {grupo.anio}
                            </p>
                            <span className="text-[11px] px-2 py-1 rounded-full" style={{ background: 'rgba(124,58,237,0.16)', color: '#c4b5fd', border: '1px solid rgba(124,58,237,0.3)' }}>
                              {grupo.docs.length} docs
                            </span>
                          </div>

                          <div className="flex flex-col gap-2">
                            {grupo.docs.map((doc: any) => {
                              const diasDoc = diasRestantes(doc.fecha_caducidad)
                              const st = estiloVencimiento(diasDoc)
                              return (
                                <div key={doc.id} className="rounded-xl p-3" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                                  <div className="flex items-start justify-between gap-2 flex-wrap">
                                    <div>
                                      <a href={doc.url} target="_blank" rel="noreferrer" className="text-sm font-medium underline" style={{ color: '#06b6d4' }}>
                                        {doc.nombre_archivo}
                                      </a>
                                      <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                                        Tipo: {doc.tipo || 'otro'} {doc.numero_documento ? `- ${doc.numero_documento}` : ''} {doc.proveedor ? `- ${doc.proveedor}` : ''}
                                      </p>
                                      <div className="flex flex-wrap gap-2 mt-2">
                                        <span className="text-[11px] px-2 py-1 rounded-full" style={{ background: st.bg, color: st.color, border: `1px solid ${st.border}` }}>
                                          Caducidad: {doc.fecha_caducidad || 'N/D'} - {textoDias(diasDoc)}
                                        </span>
                                        {doc.fecha_emision && (
                                          <span className="text-[11px] px-2 py-1 rounded-full" style={{ background: 'rgba(100,116,139,0.12)', color: 'var(--text-muted)', border: '1px solid rgba(100,116,139,0.25)' }}>
                                            Emision: {doc.fecha_emision}
                                          </span>
                                        )}
                                        <span className="text-[11px] px-2 py-1 rounded-full" style={{ background: 'rgba(6,182,212,0.12)', color: '#06b6d4', border: '1px solid rgba(6,182,212,0.3)' }}>
                                          Vigencia: {anioVigenciaDocumento(doc)}
                                        </span>
                                      </div>
                                    </div>
                                    <div className="flex gap-2">
                                      <button
                                        onClick={() => void analizarDocumentoIA(doc, vehiculoDetalle.id)}
                                        disabled={analizandoDocId === doc.id}
                                        className="text-xs px-3 py-1 rounded-lg disabled:opacity-60"
                                        style={{ background: 'rgba(6,182,212,0.12)', color: '#06b6d4', border: '1px solid rgba(6,182,212,0.3)' }}
                                      >
                                        {analizandoDocId === doc.id ? 'Analizando...' : 'IA escanear'}
                                      </button>
                                      {puedeEditar && (
                                        <button
                                          onClick={() => void eliminarDocumento(doc)}
                                          className="text-xs px-3 py-1 rounded-lg"
                                          style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}
                                        >
                                          Eliminar
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
