'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabase'
import { s } from '@/lib/styles'
import AppHeader from '@/app/components/AppHeader'

type RankingItem = {
  id: string
  nombre: string
  telefono: string | null
  cif: string | null
  email: string | null
  ultimaFecha: Date
  diasSinServicio: number
  ultimoOrigen: 'ot' | 'factura'
}

type ResultadoImport = {
  importados: number
  duplicados: number
  sinCliente: number
  errores: number
  hoja: string
  totalFilas: number
  advertencias: string[]
  detalleSinCliente: string[]
  error?: string
}

type ServicioParseado = {
  clienteNombre: string
  cif: string
  fechaServicio: string
  numeroFactura: string
  descripcion: string
  importe: number
  fila: number
}

type ColumnasDetectadas = {
  cliente: string
  cif: string
  fecha: string
  numero_factura: string
  descripcion: string
  importe: string
}

const ALIASES_COLUMNAS = {
  cliente: ['cliente', 'nombre', 'razonsocial', 'empresa', 'contacto'],
  cif: ['cif', 'nif', 'dni', 'vat', 'idfiscal'],
  fecha: ['fecha', 'fechafactura', 'fechaemision'],
  numero_factura: ['factura', 'numerofactura', 'documento', 'numero', 'serie'],
  descripcion: ['concepto', 'descripcion', 'detalle', 'servicio'],
  importe: ['importe', 'total', 'baseimponible', 'subtotal'],
} as const

function normalizarTexto(valor: string) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim()
}

function normalizarCif(valor: string) {
  return String(valor || '')
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/-/g, '')
    .trim()
}

function normalizarNombreClave(valor: string) {
  return normalizarTexto(valor)
}

function esTablaServiciosNoDisponible(error: any) {
  const txt = String(error?.message || '').toLowerCase()
  return txt.includes('servicios_clientes') && (txt.includes('does not exist') || txt.includes('relation'))
}

function parseFechaDesdeCelda(valor: any): string | null {
  if (valor === null || valor === undefined || valor === '') return null

  if (typeof valor === 'number') {
    const parse = XLSX.SSF.parse_date_code(valor)
    if (!parse) return null
    const yyyy = String(parse.y).padStart(4, '0')
    const mm = String(parse.m).padStart(2, '0')
    const dd = String(parse.d).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
  }

  const txt = String(valor).trim()
  if (!txt) return null

  const iso = txt.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`

  const es = txt.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (es) {
    const dd = String(es[1]).padStart(2, '0')
    const mm = String(es[2]).padStart(2, '0')
    const yyyy = es[3].length === 2 ? `20${es[3]}` : es[3]
    return `${yyyy}-${mm}-${dd}`
  }

  const fecha = new Date(txt)
  if (!Number.isNaN(fecha.getTime())) return fecha.toISOString().slice(0, 10)
  return null
}

function parseImporte(valor: any): number {
  if (typeof valor === 'number' && Number.isFinite(valor)) return Number(valor)
  const txt = String(valor || '')
    .replace(/\./g, '')
    .replace(',', '.')
    .replace(/[^\d.-]/g, '')
    .trim()
  const n = Number(txt)
  return Number.isFinite(n) ? n : 0
}

function extraerJsonDeRespuesta(texto: string) {
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

function indicePorAlias(cabecerasNorm: string[], aliases: readonly string[]) {
  for (const alias of aliases) {
    const aliasNorm = normalizarTexto(alias)
    const exact = cabecerasNorm.findIndex((h) => h === aliasNorm)
    if (exact >= 0) return exact
  }

  for (let i = 0; i < cabecerasNorm.length; i++) {
    const h = cabecerasNorm[i]
    for (const alias of aliases) {
      const aliasNorm = normalizarTexto(alias)
      if (h.includes(aliasNorm) || aliasNorm.includes(h)) return i
    }
  }
  return -1
}

function detectarCabecera(filas: any[][]) {
  let mejorFila = -1
  let mejorPuntos = -1

  const limite = Math.min(25, filas.length)
  for (let i = 0; i < limite; i++) {
    const row = (filas[i] || []).map((c) => normalizarTexto(String(c || '')))
    if (row.filter(Boolean).length < 2) continue

    let puntos = 0
    if (indicePorAlias(row, ALIASES_COLUMNAS.cliente) >= 0) puntos += 4
    if (indicePorAlias(row, ALIASES_COLUMNAS.fecha) >= 0) puntos += 3
    if (indicePorAlias(row, ALIASES_COLUMNAS.importe) >= 0) puntos += 2
    if (indicePorAlias(row, ALIASES_COLUMNAS.numero_factura) >= 0) puntos += 1
    if (row.length >= 4) puntos += 1

    if (puntos > mejorPuntos) {
      mejorPuntos = puntos
      mejorFila = i
    }
  }

  if (mejorFila < 0) return null
  return mejorFila
}

function resolverIndiceColumna(headersOriginal: string[], headersNorm: string[], propuesta: string, aliases: readonly string[]) {
  const pNorm = normalizarTexto(propuesta)
  if (pNorm) {
    const exact = headersNorm.findIndex((h) => h === pNorm)
    if (exact >= 0) return exact
    const similar = headersNorm.findIndex((h) => h.includes(pNorm) || pNorm.includes(h))
    if (similar >= 0) return similar
  }
  return indicePorAlias(headersNorm, aliases)
}

async function detectarColumnasConIA(headersOriginal: string[], muestra: any[][]): Promise<ColumnasDetectadas | null> {
  const prompt = `
Devuelve JSON estricto sin explicaciones:
{
  "columnas": {
    "cliente": "",
    "cif": "",
    "fecha": "",
    "numero_factura": "",
    "descripcion": "",
    "importe": ""
  }
}

Cabeceras: ${JSON.stringify(headersOriginal)}
Muestra filas: ${JSON.stringify(muestra)}

Reglas:
- Usa exactamente el nombre de cabecera cuando exista.
- Si no existe una columna, deja el valor en "".
- "cliente" y "fecha" son prioritarias.
`

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mensaje: prompt }),
    })
    const data = await res.json()
    const json = extraerJsonDeRespuesta(data?.respuesta || '')
    const columnas = json?.columnas
    if (!columnas || typeof columnas !== 'object') return null
    return {
      cliente: String(columnas.cliente || ''),
      cif: String(columnas.cif || ''),
      fecha: String(columnas.fecha || ''),
      numero_factura: String(columnas.numero_factura || ''),
      descripcion: String(columnas.descripcion || ''),
      importe: String(columnas.importe || ''),
    }
  } catch {
    return null
  }
}

function claveServicio(clienteId: string, fecha: string, numero: string, importe: number, descripcion: string) {
  const imp = Number((importe || 0).toFixed(2))
  return [
    clienteId,
    fecha,
    normalizarTexto(numero || ''),
    imp,
    normalizarTexto(descripcion || '').slice(0, 80),
  ].join('|')
}

export default function SinServicioPage() {
  const [loading, setLoading] = useState(true)
  const [accesoDenegado, setAccesoDenegado] = useState(false)
  const [tablaServiciosDisponible, setTablaServiciosDisponible] = useState(true)
  const [clientesInactivos, setClientesInactivos] = useState<RankingItem[]>([])
  const [totalConHistorial, setTotalConHistorial] = useState(0)
  const [importando, setImportando] = useState(false)
  const [borrandoImportados, setBorrandoImportados] = useState(false)
  const [resultadoImport, setResultadoImport] = useState<ResultadoImport | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  useEffect(() => {
    cargarDatos()
    // Carga inicial unica.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function cargarDatos() {
    setLoading(true)
    setResultadoImport(null)

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      router.push('/login')
      return
    }

    const { data: perfil } = await supabase
      .from('perfiles')
      .select('rol')
      .eq('id', session.user.id)
      .single()

    const puedeVer = perfil?.rol === 'gerente' || perfil?.rol === 'oficina' || perfil?.rol === 'supervisor'
    if (!puedeVer) {
      setAccesoDenegado(true)
      setLoading(false)
      return
    }

    const [ordenesRes, clientesRes, serviciosRes] = await Promise.all([
      supabase
        .from('ordenes')
        .select('cliente_id, estado, fecha_cierre, fecha_programada, created_at')
        .eq('estado', 'completada')
        .not('cliente_id', 'is', null),
      supabase
        .from('clientes')
        .select('id, nombre, telefono, cif, email')
        .order('nombre'),
      supabase
        .from('servicios_clientes')
        .select('cliente_id, fecha_servicio')
        .not('cliente_id', 'is', null),
    ])

    const ordenes = ordenesRes.data || []
    const clientes = clientesRes.data || []
    const servicios = serviciosRes.data || []

    if (serviciosRes.error && esTablaServiciosNoDisponible(serviciosRes.error)) {
      setTablaServiciosDisponible(false)
    } else {
      setTablaServiciosDisponible(true)
    }

    const ultimaActividadPorCliente = new Map<string, { fecha: Date; origen: 'ot' | 'factura' }>()
    for (const ot of ordenes) {
      if (!ot?.cliente_id) continue
      const fechaRef = ot.fecha_cierre || ot.fecha_programada || ot.created_at
      if (!fechaRef) continue
      const fecha = new Date(fechaRef)
      if (Number.isNaN(fecha.getTime())) continue
      const previa = ultimaActividadPorCliente.get(ot.cliente_id)
      if (!previa || fecha.getTime() > previa.fecha.getTime()) {
        ultimaActividadPorCliente.set(ot.cliente_id, { fecha, origen: 'ot' })
      }
    }

    for (const srv of servicios) {
      if (!srv?.cliente_id || !srv?.fecha_servicio) continue
      const fecha = new Date(`${srv.fecha_servicio}T12:00:00`)
      if (Number.isNaN(fecha.getTime())) continue
      const previa = ultimaActividadPorCliente.get(srv.cliente_id)
      if (!previa || fecha.getTime() > previa.fecha.getTime()) {
        ultimaActividadPorCliente.set(srv.cliente_id, { fecha, origen: 'factura' })
      }
    }

    const clientesPorId = new Map(clientes.map((c: any) => [c.id, c]))
    const ranking = Array.from(ultimaActividadPorCliente.entries())
      .map(([clienteId, ultima]) => {
        const cli = clientesPorId.get(clienteId)
        if (!cli) return null
        const diasSinServicio = Math.floor((Date.now() - ultima.fecha.getTime()) / 86400000)
        return {
          ...cli,
          ultimaFecha: ultima.fecha,
          diasSinServicio,
          ultimoOrigen: ultima.origen,
        } as RankingItem
      })
      .filter(Boolean) as RankingItem[]

    ranking.sort((a, b) => b.diasSinServicio - a.diasSinServicio)
    setTotalConHistorial(ranking.length)
    setClientesInactivos(ranking.slice(0, 10))
    setLoading(false)
  }

  async function importarFacturas(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImportando(true)
    setResultadoImport(null)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }

      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array' })

      if (!workbook.SheetNames.length) {
        setResultadoImport({
          importados: 0, duplicados: 0, sinCliente: 0, errores: 0, hoja: '-', totalFilas: 0, advertencias: [], detalleSinCliente: [],
          error: 'El archivo no contiene hojas.'
        })
        return
      }

      let hojaSeleccionada = workbook.SheetNames[0]
      let filasHoja = XLSX.utils.sheet_to_json<any[]>(workbook.Sheets[hojaSeleccionada], { header: 1, defval: '' })
      for (const nombreHoja of workbook.SheetNames) {
        const rows = XLSX.utils.sheet_to_json<any[]>(workbook.Sheets[nombreHoja], { header: 1, defval: '' })
        if (rows.length > filasHoja.length) {
          hojaSeleccionada = nombreHoja
          filasHoja = rows
        }
      }

      const cabeceraIdx = detectarCabecera(filasHoja)
      if (cabeceraIdx === null) {
        setResultadoImport({
          importados: 0, duplicados: 0, sinCliente: 0, errores: 0, hoja: hojaSeleccionada, totalFilas: 0, advertencias: [], detalleSinCliente: [],
          error: 'No pude detectar la fila de cabeceras.'
        })
        return
      }

      const headersOriginal = (filasHoja[cabeceraIdx] || []).map((v: any) => String(v || '').trim())
      const headersNorm = headersOriginal.map((h) => normalizarTexto(h))
      const dataRows = filasHoja.slice(cabeceraIdx + 1)
      const muestra = dataRows.slice(0, 25).map((r) => (r || []).map((c: any) => String(c || '').trim()))
      const advertencias: string[] = []

      const mapIa = await detectarColumnasConIA(headersOriginal, muestra)
      if (mapIa) advertencias.push('Mapeo de columnas asistido por IA.')
      else advertencias.push('IA no disponible, se aplico deteccion automatica de columnas.')

      const idxCliente = resolverIndiceColumna(headersOriginal, headersNorm, mapIa?.cliente || '', ALIASES_COLUMNAS.cliente)
      const idxCif = resolverIndiceColumna(headersOriginal, headersNorm, mapIa?.cif || '', ALIASES_COLUMNAS.cif)
      const idxFecha = resolverIndiceColumna(headersOriginal, headersNorm, mapIa?.fecha || '', ALIASES_COLUMNAS.fecha)
      const idxNumero = resolverIndiceColumna(headersOriginal, headersNorm, mapIa?.numero_factura || '', ALIASES_COLUMNAS.numero_factura)
      const idxDescripcion = resolverIndiceColumna(headersOriginal, headersNorm, mapIa?.descripcion || '', ALIASES_COLUMNAS.descripcion)
      const idxImporte = resolverIndiceColumna(headersOriginal, headersNorm, mapIa?.importe || '', ALIASES_COLUMNAS.importe)

      if (idxCliente < 0 || idxFecha < 0) {
        setResultadoImport({
          importados: 0, duplicados: 0, sinCliente: 0, errores: 0, hoja: hojaSeleccionada, totalFilas: dataRows.length, advertencias, detalleSinCliente: [],
          error: 'Faltan columnas clave. Necesito al menos cliente y fecha de factura.'
        })
        return
      }

      const servicios: ServicioParseado[] = []
      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i] || []
        const clienteNombre = String(row[idxCliente] || '').trim()
        const cif = normalizarCif(String(row[idxCif] || ''))
        const fechaServicio = parseFechaDesdeCelda(row[idxFecha]) || ''
        const numeroFactura = idxNumero >= 0 ? String(row[idxNumero] || '').trim() : ''
        const descripcion = idxDescripcion >= 0 ? String(row[idxDescripcion] || '').trim() : 'Servicio importado desde factura'
        const importe = idxImporte >= 0 ? parseImporte(row[idxImporte]) : 0

        const filaVacia = !clienteNombre && !cif && !numeroFactura && !descripcion
        if (filaVacia) continue
        if (!clienteNombre || !fechaServicio) continue

        servicios.push({
          clienteNombre,
          cif,
          fechaServicio,
          numeroFactura,
          descripcion,
          importe,
          fila: cabeceraIdx + 2 + i,
        })
      }

      if (servicios.length === 0) {
        setResultadoImport({
          importados: 0, duplicados: 0, sinCliente: 0, errores: 0, hoja: hojaSeleccionada, totalFilas: dataRows.length, advertencias, detalleSinCliente: [],
          error: 'No hay filas validas para importar.'
        })
        return
      }

      const { data: clientesDb } = await supabase
        .from('clientes')
        .select('id, nombre, cif')

      const clientesLista = clientesDb || []
      const mapCif = new Map<string, any>()
      const mapNombre = new Map<string, any>()
      for (const c of clientesLista) {
        const cifN = normalizarCif(String(c.cif || ''))
        const nomN = normalizarNombreClave(String(c.nombre || ''))
        if (cifN && !mapCif.has(cifN)) mapCif.set(cifN, c)
        if (nomN && !mapNombre.has(nomN)) mapNombre.set(nomN, c)
      }

      const sinClienteDetalle: string[] = []
      const matched: any[] = []
      for (const sFila of servicios) {
        let cli = null
        if (sFila.cif) cli = mapCif.get(sFila.cif) || null
        if (!cli) cli = mapNombre.get(normalizarNombreClave(sFila.clienteNombre)) || null

        if (!cli) {
          if (sinClienteDetalle.length < 10) {
            sinClienteDetalle.push(`Fila ${sFila.fila}: ${sFila.clienteNombre}${sFila.cif ? ` (${sFila.cif})` : ''}`)
          }
          continue
        }

        matched.push({
          cliente_id: cli.id,
          fecha_servicio: sFila.fechaServicio,
          origen: 'factura_importada',
          numero_documento: sFila.numeroFactura || null,
          descripcion: sFila.descripcion || null,
          importe: sFila.importe || 0,
          metadata: {
            archivo: file.name,
            fila_origen: sFila.fila,
            cliente_texto: sFila.clienteNombre,
            cif_texto: sFila.cif || null,
          },
          created_by: session.user.id,
        })
      }

      if (matched.length === 0) {
        setResultadoImport({
          importados: 0,
          duplicados: 0,
          sinCliente: servicios.length,
          errores: 0,
          hoja: hojaSeleccionada,
          totalFilas: dataRows.length,
          advertencias,
          detalleSinCliente: sinClienteDetalle,
          error: 'No se pudo vincular ninguna fila con clientes existentes.',
        })
        return
      }

      const clienteIds = Array.from(new Set(matched.map((m) => m.cliente_id)))
      const { data: existentes, error: errExistentes } = await supabase
        .from('servicios_clientes')
        .select('cliente_id, fecha_servicio, numero_documento, importe, descripcion')
        .in('cliente_id', clienteIds)

      if (errExistentes && esTablaServiciosNoDisponible(errExistentes)) {
        setTablaServiciosDisponible(false)
        setResultadoImport({
          importados: 0,
          duplicados: 0,
          sinCliente: servicios.length - matched.length,
          errores: 0,
          hoja: hojaSeleccionada,
          totalFilas: dataRows.length,
          advertencias,
          detalleSinCliente: sinClienteDetalle,
          error: 'Falta la tabla servicios_clientes. Ejecuta la migracion SQL para habilitar el historial importado.',
        })
        return
      }
      if (errExistentes) throw errExistentes

      const clavesExistentes = new Set<string>()
      for (const ex of existentes || []) {
        clavesExistentes.add(
          claveServicio(
            ex.cliente_id,
            ex.fecha_servicio,
            ex.numero_documento || '',
            Number(ex.importe || 0),
            ex.descripcion || ''
          )
        )
      }

      const clavesArchivo = new Set<string>()
      const paraInsertar: any[] = []
      let duplicados = 0
      for (const m of matched) {
        const key = claveServicio(m.cliente_id, m.fecha_servicio, m.numero_documento || '', Number(m.importe || 0), m.descripcion || '')
        if (clavesExistentes.has(key) || clavesArchivo.has(key)) {
          duplicados++
          continue
        }
        clavesArchivo.add(key)
        paraInsertar.push(m)
      }

      let importados = 0
      let errores = 0
      const lote = 200
      for (let i = 0; i < paraInsertar.length; i += lote) {
        const bloque = paraInsertar.slice(i, i + lote)
        const { error } = await supabase.from('servicios_clientes').insert(bloque)
        if (error) {
          if (esTablaServiciosNoDisponible(error)) {
            setTablaServiciosDisponible(false)
            throw new Error('Falta la tabla servicios_clientes. Ejecuta la migracion SQL.')
          }
          errores += bloque.length
        } else {
          importados += bloque.length
        }
      }

      setResultadoImport({
        importados,
        duplicados,
        sinCliente: servicios.length - matched.length,
        errores,
        hoja: hojaSeleccionada,
        totalFilas: dataRows.length,
        advertencias,
        detalleSinCliente: sinClienteDetalle,
      })

      await cargarDatos()
    } catch (error: any) {
      setResultadoImport({
        importados: 0,
        duplicados: 0,
        sinCliente: 0,
        errores: 0,
        hoja: '-',
        totalFilas: 0,
        advertencias: [],
        detalleSinCliente: [],
        error: String(error?.message || 'Error al importar facturas.'),
      })
    } finally {
      setImportando(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function borrarImportadosFacturas() {
    if (!tablaServiciosDisponible) {
      alert('La tabla servicios_clientes no esta disponible.')
      return
    }
    if (!confirm('¿Borrar todos los servicios importados por factura?\nEsta accion no se puede deshacer.')) {
      return
    }

    setBorrandoImportados(true)
    try {
      const { error } = await supabase
        .from('servicios_clientes')
        .delete()
        .eq('origen', 'factura_importada')

      if (error) {
        if (esTablaServiciosNoDisponible(error)) {
          setTablaServiciosDisponible(false)
          throw new Error('Falta la tabla servicios_clientes.')
        }
        throw error
      }

      setResultadoImport({
        importados: 0,
        duplicados: 0,
        sinCliente: 0,
        errores: 0,
        hoja: '-',
        totalFilas: 0,
        advertencias: ['Servicios importados eliminados correctamente.'],
        detalleSinCliente: [],
      })
      await cargarDatos()
    } catch (error: any) {
      alert(`No se pudo borrar lo importado: ${String(error?.message || 'Error desconocido')}`)
    } finally {
      setBorrandoImportados(false)
    }
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <AppHeader
        title="Clientes sin servicio"
        rightSlot={(
          <div className="flex items-center gap-2 flex-wrap">
            <label className="text-sm px-4 py-2 rounded-xl cursor-pointer" style={s.btnSecondary}>
              {importando ? 'Importando facturas...' : 'Importar facturas Excel'}
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={importarFacturas}
                disabled={importando || !tablaServiciosDisponible}
              />
            </label>
            <button
              onClick={borrarImportadosFacturas}
              disabled={borrandoImportados || importando || !tablaServiciosDisponible}
              className="text-sm px-4 py-2 rounded-xl disabled:opacity-50"
              style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}
            >
              {borrandoImportados ? 'Borrando importados...' : 'Borrar importados'}
            </button>
            <button
              onClick={cargarDatos}
              className="text-sm px-4 py-2 rounded-xl"
              style={s.btnSecondary}
            >
              Actualizar
            </button>
          </div>
        )}
      />

      <div className="p-6 max-w-5xl mx-auto">
        {!tablaServiciosDisponible && (
          <div className="rounded-2xl p-4 mb-4" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
            <p className="text-sm font-semibold" style={{ color: '#f87171' }}>
              Falta la tabla de historial de servicios importados.
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              Ejecuta la migracion SQL de `servicios_clientes` para habilitar la importacion de facturas.
            </p>
          </div>
        )}

        {resultadoImport && (
          <div className="rounded-2xl p-4 mb-4" style={resultadoImport.error
            ? { background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }
            : { background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)' }}>
            {resultadoImport.error ? (
              <p className="text-sm" style={{ color: '#f87171' }}>{resultadoImport.error}</p>
            ) : (
              <>
                <p className="text-sm font-semibold" style={{ color: '#34d399' }}>Importacion completada</p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  Hoja: {resultadoImport.hoja} - Filas revisadas: {resultadoImport.totalFilas}
                </p>
                <p className="text-xs mt-1" style={{ color: '#34d399' }}>Servicios registrados: {resultadoImport.importados}</p>
                <p className="text-xs" style={{ color: '#fbbf24' }}>Duplicados omitidos: {resultadoImport.duplicados}</p>
                <p className="text-xs" style={{ color: '#fbbf24' }}>Sin cliente reconocido: {resultadoImport.sinCliente}</p>
                {resultadoImport.errores > 0 && (
                  <p className="text-xs" style={{ color: '#f87171' }}>Errores de insercion: {resultadoImport.errores}</p>
                )}
                {resultadoImport.advertencias.map((av, i) => (
                  <p key={`adv-${i}`} className="text-xs mt-1" style={{ color: '#06b6d4' }}>{av}</p>
                ))}
                {resultadoImport.detalleSinCliente.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs font-semibold" style={{ color: '#fbbf24' }}>Ejemplos sin cliente:</p>
                    {resultadoImport.detalleSinCliente.map((item, i) => (
                      <p key={`sc-${i}`} className="text-xs" style={{ color: 'var(--text-muted)' }}>{item}</p>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#7c3aed', borderTopColor: 'transparent' }}></div>
          </div>
        ) : accesoDenegado ? (
          <div className="rounded-2xl p-5" style={s.cardStyle}>
            <p className="font-semibold mb-1" style={{ color: 'var(--text)' }}>Sin permiso</p>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Solo gerencia, oficina o supervisor puede ver este listado.
            </p>
          </div>
        ) : clientesInactivos.length === 0 ? (
          <div className="rounded-2xl p-5" style={s.cardStyle}>
            <p className="font-semibold mb-1" style={{ color: 'var(--text)' }}>No hay datos</p>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              No hay clientes con historial de servicios completados.
            </p>
          </div>
        ) : (
          <>
            <div className="rounded-2xl p-4 mb-4" style={s.cardStyle}>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Top 10 clientes que llevan mas tiempo sin servicio. Incluye OTs completadas y servicios importados por facturas.
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-subtle)' }}>
                Clientes con historial: {totalConHistorial}
              </p>
            </div>

            <div className="flex flex-col gap-2">
              {clientesInactivos.map((c, idx) => (
                <div
                  key={c.id}
                  className="rounded-xl px-4 py-3 flex items-center justify-between gap-3 flex-wrap"
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
                >
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                      #{idx + 1} {c.nombre}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {c.diasSinServicio} dias sin servicio - ultima actividad: {c.ultimaFecha.toLocaleDateString('es-ES')}
                    </p>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-subtle)' }}>
                      Origen ultimo servicio: {c.ultimoOrigen === 'factura' ? 'Factura importada' : 'OT completada'} - CIF: {c.cif || '-'}{c.email ? ` - ${c.email}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {c.telefono && (
                      <a
                        href={`tel:${c.telefono}`}
                        className="text-xs px-2 py-1 rounded-lg"
                        style={{ background: 'rgba(52,211,153,0.12)', color: '#34d399', border: '1px solid rgba(52,211,153,0.3)' }}
                      >
                        Llamar
                      </a>
                    )}
                    <Link
                      href={`/clientes/${c.id}`}
                      className="text-xs px-2 py-1 rounded-lg"
                      style={{ background: 'rgba(6,182,212,0.12)', color: '#06b6d4', border: '1px solid rgba(6,182,212,0.3)' }}
                    >
                      Abrir cliente
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
