'use client'

import { useEffect, useState } from 'react'
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
  ultimoOrigen: 'ot' | 'historial'
  ultimoServicioDescripcion: string | null
  ultimoServicioDocumento: string | null
  ultimoServicioImporte: number | null
  seguimientoLlamadaOk: boolean
  seguimientoLlamadaAt: string | null
}

type ServicioParseado = {
  clienteNombre: string
  cif: string
  fechaServicio: string
  numeroDocumento: string
  descripcion: string
  importe: number
  fila: number
}

type ResultadoImport = {
  archivo: string
  totalFilas: number
  importados: number
  duplicados: number
  sinCliente: number
  errores: number
  advertencias: string[]
  detalleSinCliente: string[]
  error?: string
}

type ImportPreview = {
  archivo: string
  hoja: string
  totalFilas: number
  filasVinculadas: number
  filasPendientesInsercion: number
  duplicadosDetectados: number
  filasSinCliente: number
  advertencias: string[]
  detalleSinCliente: string[]
  filasParaInsertar: any[]
}

const UMBRAL_DIAS_RECORDATORIO = 365

function esTablaServiciosNoDisponible(error: any) {
  const txt = String(error?.message || '').toLowerCase()
  return txt.includes('servicios_clientes') && (txt.includes('does not exist') || txt.includes('relation'))
}

function fechaSegura(valor: string | null | undefined) {
  if (!valor) return null
  const fecha = new Date(valor)
  if (Number.isNaN(fecha.getTime())) return null
  return fecha
}

function textoServicioOt(ot: any) {
  const tipo = String(ot?.tipo || '').trim()
  const desc = String(ot?.descripcion || '').trim()
  const obs = String(ot?.observaciones || '').trim()
  if (desc) return desc
  if (obs) return obs
  if (tipo) return `Servicio ${tipo}`
  return 'Servicio OT completada'
}

function documentoServicioOt(ot: any) {
  const codigo = String(ot?.codigo || '').trim()
  if (codigo) return `OT ${codigo}`
  const id = String(ot?.id || '').trim()
  if (id) return `OT ${id.slice(0, 8)}`
  return 'OT'
}

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

function normalizarTextoPlano(valor: string) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function esVisitaTecnica(valor: string) {
  const norm = normalizarTextoPlano(valor)
  if (!norm) return false
  if (norm.includes('visita tecnica')) return true
  const compacto = norm.replace(/\s+/g, '')
  if (compacto.includes('visitatecnica')) return true
  return /\bvisita(s)?\b.*\btecnic[ao]s?\b|\btecnic[ao]s?\b.*\bvisita(s)?\b/.test(norm)
}

function esVisitaTecnicaOt(ot: any) {
  const tipo = String(ot?.tipo || '')
  const descripcion = String(ot?.descripcion || '')
  const observaciones = String(ot?.observaciones || '')
  return esVisitaTecnica(`${tipo} ${descripcion} ${observaciones}`)
}

function variantesNombreCliente(valor: string) {
  const raw = String(valor || '').trim()
  if (!raw) return []
  const set = new Set<string>()
  const add = (v: string) => {
    const n = normalizarTexto(v)
    if (n) set.add(n)
  }

  add(raw)
  add(raw.replace(/\([^)]*\)/g, ' '))
  const parens = raw.match(/\(([^)]+)\)/g) || []
  for (const p of parens) add(p.replace(/[()]/g, ' '))
  return Array.from(set)
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

const ALIASES_COLUMNAS = {
  cliente: ['cliente', 'nombre', 'razonsocial', 'empresa', 'contacto'],
  cif: ['cif', 'nif', 'dni', 'vat', 'idfiscal'],
  fecha: ['fecha', 'fechafactura', 'fechaemision'],
  numero_documento: ['factura', 'numerofactura', 'documento', 'numero', 'serie'],
  descripcion: ['concepto', 'descripcion', 'detalle', 'servicio'],
  importe: ['importe', 'total', 'baseimponible', 'subtotal'],
} as const

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
    if (indicePorAlias(row, ALIASES_COLUMNAS.numero_documento) >= 0) puntos += 1
    if (puntos > mejorPuntos) {
      mejorPuntos = puntos
      mejorFila = i
    }
  }
  if (mejorFila < 0) return null
  return mejorFila
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

async function traerTodoPaginado<T>(fetchPage: (from: number, to: number) => any, pageSize = 1000) {
  const out: T[] = []
  for (let from = 0; ; from += pageSize) {
    const to = from + pageSize - 1
    const res = await fetchPage(from, to)
    const data = (res?.data || null) as T[] | null
    const error = res?.error || null
    if (error) throw error
    const bloque = data || []
    out.push(...bloque)
    if (bloque.length < pageSize) break
  }
  return out
}

export default function RecordatorioServicioPage() {
  const [loading, setLoading] = useState(true)
  const [accesoDenegado, setAccesoDenegado] = useState(false)
  const [tablaServiciosDisponible, setTablaServiciosDisponible] = useState(true)
  const [clientesInactivos, setClientesInactivos] = useState<RankingItem[]>([])
  const [clientesContactados, setClientesContactados] = useState<RankingItem[]>([])
  const [detallesAbiertos, setDetallesAbiertos] = useState<Record<string, boolean>>({})
  const [totalConHistorial, setTotalConHistorial] = useState(0)
  const [importando, setImportando] = useState(false)
  const [aplicandoImportacion, setAplicandoImportacion] = useState(false)
  const [resultadoImport, setResultadoImport] = useState<ResultadoImport | null>(null)
  const [previewImport, setPreviewImport] = useState<ImportPreview | null>(null)
  const router = useRouter()

  useEffect(() => {
    void cargarDatos()
    // Carga inicial unica.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function cargarDatos() {
    setLoading(true)
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
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

      const clientes = await traerTodoPaginado<any>((from, to) =>
        supabase
          .from('clientes')
          .select('*')
          .order('nombre')
          .range(from, to)
      )

      const ordenes = await traerTodoPaginado<any>((from, to) =>
        supabase
          .from('ordenes')
          .select('id, codigo, tipo, descripcion, observaciones, cliente_id, estado, fecha_cierre, fecha_programada, created_at')
          .eq('estado', 'completada')
          .not('cliente_id', 'is', null)
          .range(from, to)
      )

      let servicios: any[] = []
      let serviciosError: any = null
      try {
        servicios = await traerTodoPaginado<any>((from, to) =>
          supabase
            .from('servicios_clientes')
            .select('cliente_id, fecha_servicio, origen, numero_documento, descripcion, importe')
            .not('cliente_id', 'is', null)
            .range(from, to)
        )
      } catch (error: any) {
        serviciosError = error
      }

      if (serviciosError && esTablaServiciosNoDisponible(serviciosError)) {
        setTablaServiciosDisponible(false)
      } else {
        setTablaServiciosDisponible(true)
      }

      const ultimaActividadPorCliente = new Map<string, {
        fecha: Date
        origen: 'ot' | 'historial'
        descripcion: string | null
        documento: string | null
        importe: number | null
      }>()

      for (const ot of ordenes) {
        if (!ot?.cliente_id) continue
        if (esVisitaTecnicaOt(ot)) continue
        const fecha =
          fechaSegura(ot.fecha_cierre) ||
          fechaSegura(ot.fecha_programada) ||
          fechaSegura(ot.created_at)
        if (!fecha) continue

        const previa = ultimaActividadPorCliente.get(ot.cliente_id)
        if (!previa || fecha.getTime() > previa.fecha.getTime()) {
          ultimaActividadPorCliente.set(ot.cliente_id, {
            fecha,
            origen: 'ot',
            descripcion: textoServicioOt(ot),
            documento: documentoServicioOt(ot),
            importe: null,
          })
        }
      }

      if (!serviciosError) {
        for (const srv of servicios) {
          if (!srv?.cliente_id || !srv?.fecha_servicio) continue
          if (esVisitaTecnica(String(srv?.descripcion || ''))) continue
          const fecha = fechaSegura(`${srv.fecha_servicio}T12:00:00`)
          if (!fecha) continue
          const previa = ultimaActividadPorCliente.get(srv.cliente_id)
          if (!previa || fecha.getTime() > previa.fecha.getTime()) {
            const importeNum = Number(srv?.importe)
            ultimaActividadPorCliente.set(srv.cliente_id, {
              fecha,
              origen: 'historial',
              descripcion: String(srv?.descripcion || '').trim() || null,
              documento: String(srv?.numero_documento || '').trim() || null,
              importe: Number.isFinite(importeNum) ? importeNum : null,
            })
          }
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
            ultimoServicioDescripcion: ultima.descripcion,
            ultimoServicioDocumento: ultima.documento,
            ultimoServicioImporte: ultima.importe,
            seguimientoLlamadaOk: Boolean((cli as any).seguimiento_llamada_ok),
            seguimientoLlamadaAt: (cli as any).seguimiento_llamada_at ? String((cli as any).seguimiento_llamada_at) : null,
          } as RankingItem
        })
        .filter(Boolean) as RankingItem[]

      ranking.sort((a, b) => b.diasSinServicio - a.diasSinServicio)

      const idsResetSeguimiento: string[] = []
      const rankingNormalizado = ranking.map((c) => {
        if (!c.seguimientoLlamadaOk || !c.seguimientoLlamadaAt) return c
        const llamadaAt = new Date(c.seguimientoLlamadaAt)
        if (Number.isNaN(llamadaAt.getTime())) return c
        if (c.ultimaFecha.getTime() > llamadaAt.getTime()) {
          idsResetSeguimiento.push(c.id)
          return { ...c, seguimientoLlamadaOk: false, seguimientoLlamadaAt: null }
        }
        return c
      })

      if (idsResetSeguimiento.length > 0) {
        const chunk = 200
        for (let i = 0; i < idsResetSeguimiento.length; i += chunk) {
          const ids = idsResetSeguimiento.slice(i, i + chunk)
          await (supabase.from('clientes') as any)
            .update({
              seguimiento_llamada_ok: false,
              seguimiento_llamada_at: null,
            })
            .in('id', ids)
        }
      }

      const rankingRecordatorio = rankingNormalizado.filter((c) => c.diasSinServicio > UMBRAL_DIAS_RECORDATORIO)
      const pendientes = rankingRecordatorio.filter((c) => !c.seguimientoLlamadaOk)
      const contactados = rankingRecordatorio.filter((c) => c.seguimientoLlamadaOk)

      setTotalConHistorial(rankingRecordatorio.length)
      setClientesInactivos(pendientes.slice(0, 30))
      setClientesContactados(contactados.slice(0, 30))
    } catch (error: any) {
      console.error('Error cargando recordatorio de servicio:', error)
      alert(`No se pudo cargar el recordatorio: ${String(error?.message || 'error desconocido')}`)
      setClientesInactivos([])
      setClientesContactados([])
      setTotalConHistorial(0)
    } finally {
      setLoading(false)
    }
  }

  async function actualizarSeguimientoLlamada(clienteId: string, valor: boolean) {
    if (valor) {
      const ok = confirm('Has contactado al cliente para ofrecerle el servicio?')
      if (!ok) return
    }

    const ahoraIso = valor ? new Date().toISOString() : null
    const { error } = await (supabase.from('clientes') as any)
      .update({
        seguimiento_llamada_ok: valor,
        seguimiento_llamada_at: ahoraIso,
      })
      .eq('id', clienteId)

    if (error) {
      alert(`No se pudo guardar el seguimiento de contacto: ${error.message}`)
      return
    }

    const all = [...clientesInactivos, ...clientesContactados]
    const target = all.find((c) => c.id === clienteId)
    if (!target) return
    const actualizado = { ...target, seguimientoLlamadaOk: valor, seguimientoLlamadaAt: ahoraIso }
    const resto = all.filter((c) => c.id !== clienteId)
    const pendientes = resto.filter((c) => !c.seguimientoLlamadaOk && c.diasSinServicio > UMBRAL_DIAS_RECORDATORIO)
    const contactados = resto.filter((c) => c.seguimientoLlamadaOk && c.diasSinServicio > UMBRAL_DIAS_RECORDATORIO)
    if (actualizado.seguimientoLlamadaOk) contactados.push(actualizado)
    else if (actualizado.diasSinServicio > UMBRAL_DIAS_RECORDATORIO) pendientes.push(actualizado)
    pendientes.sort((a, b) => b.diasSinServicio - a.diasSinServicio)
    contactados.sort((a, b) => b.diasSinServicio - a.diasSinServicio)
    setClientesInactivos(pendientes.slice(0, 30))
    setClientesContactados(contactados.slice(0, 30))
  }

  function alternarDetalle(id: string) {
    setDetallesAbiertos((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  async function calcularFilasInsertables(matched: any[]) {
    const idsClientes = Array.from(new Set(matched.map((m) => String(m.cliente_id))))
    const existentes: any[] = []
    const chunkSize = 200
    for (let i = 0; i < idsClientes.length; i += chunkSize) {
      const idsChunk = idsClientes.slice(i, i + chunkSize)
      const { data, error } = await supabase
        .from('servicios_clientes')
        .select('cliente_id, fecha_servicio, numero_documento, importe, descripcion')
        .in('cliente_id', idsChunk)
      if (error) {
        if (esTablaServiciosNoDisponible(error)) {
          setTablaServiciosDisponible(false)
          throw new Error('Falta la tabla servicios_clientes. Ejecuta la migracion correspondiente.')
        }
        throw error
      }
      existentes.push(...(data || []))
    }

    const clavesExistentes = new Set<string>()
    for (const ex of existentes) {
      clavesExistentes.add(
        claveServicio(
          String(ex.cliente_id),
          String(ex.fecha_servicio),
          String(ex.numero_documento || ''),
          Number(ex.importe || 0),
          String(ex.descripcion || '')
        )
      )
    }

    const clavesArchivo = new Set<string>()
    const paraInsertar: any[] = []
    let duplicados = 0
    for (const m of matched) {
      const key = claveServicio(
        String(m.cliente_id),
        String(m.fecha_servicio),
        String(m.numero_documento || ''),
        Number(m.importe || 0),
        String(m.descripcion || '')
      )
      if (clavesExistentes.has(key) || clavesArchivo.has(key)) {
        duplicados += 1
        continue
      }
      clavesArchivo.add(key)
      paraInsertar.push(m)
    }

    return { paraInsertar, duplicados }
  }

  async function previsualizarHistoricoServicios(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImportando(true)
    setResultadoImport(null)
    setPreviewImport(null)

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }

      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array' })
      if (!workbook.SheetNames.length) {
        setResultadoImport({
          archivo: file.name,
          totalFilas: 0,
          importados: 0,
          duplicados: 0,
          sinCliente: 0,
          errores: 0,
          advertencias: [],
          detalleSinCliente: [],
          error: 'El archivo no contiene hojas.',
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
          archivo: file.name,
          totalFilas: 0,
          importados: 0,
          duplicados: 0,
          sinCliente: 0,
          errores: 0,
          advertencias: [],
          detalleSinCliente: [],
          error: 'No pude detectar la fila de cabeceras.',
        })
        return
      }

      const headersNorm = (filasHoja[cabeceraIdx] || []).map((v: any) => normalizarTexto(String(v || '')))
      const dataRows = filasHoja.slice(cabeceraIdx + 1)
      const idxCliente = indicePorAlias(headersNorm, ALIASES_COLUMNAS.cliente)
      const idxCif = indicePorAlias(headersNorm, ALIASES_COLUMNAS.cif)
      const idxFecha = indicePorAlias(headersNorm, ALIASES_COLUMNAS.fecha)
      const idxNumero = indicePorAlias(headersNorm, ALIASES_COLUMNAS.numero_documento)
      const idxDescripcion = indicePorAlias(headersNorm, ALIASES_COLUMNAS.descripcion)
      const idxImporte = indicePorAlias(headersNorm, ALIASES_COLUMNAS.importe)

      if (idxCliente < 0 || idxFecha < 0) {
        setResultadoImport({
          archivo: file.name,
          totalFilas: dataRows.length,
          importados: 0,
          duplicados: 0,
          sinCliente: 0,
          errores: 0,
          advertencias: ['Hoja detectada: ' + hojaSeleccionada],
          detalleSinCliente: [],
          error: 'Faltan columnas clave. Necesito al menos cliente y fecha.',
        })
        return
      }

      const servicios: ServicioParseado[] = []
      let visitasTecnicasOmitidas = 0
      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i] || []
        const clienteNombre = String(row[idxCliente] || '').trim()
        const cif = idxCif >= 0 ? normalizarCif(String(row[idxCif] || '')) : ''
        const fechaServicio = parseFechaDesdeCelda(row[idxFecha]) || ''
        const numeroDocumento = idxNumero >= 0 ? String(row[idxNumero] || '').trim() : ''
        const descripcion = idxDescripcion >= 0 ? String(row[idxDescripcion] || '').trim() : ''
        const importe = idxImporte >= 0 ? parseImporte(row[idxImporte]) : 0

        const filaVacia = !clienteNombre && !cif && !numeroDocumento && !descripcion
        if (filaVacia) continue
        if (!clienteNombre || !fechaServicio) continue
        if (esVisitaTecnica(descripcion)) {
          visitasTecnicasOmitidas += 1
          continue
        }

        servicios.push({
          clienteNombre,
          cif,
          fechaServicio,
          numeroDocumento,
          descripcion,
          importe,
          fila: cabeceraIdx + 2 + i,
        })
      }

      if (servicios.length === 0) {
        setResultadoImport({
          archivo: file.name,
          totalFilas: dataRows.length,
          importados: 0,
          duplicados: 0,
          sinCliente: 0,
          errores: 0,
          advertencias: [
            'Hoja procesada: ' + hojaSeleccionada,
            visitasTecnicasOmitidas > 0 ? `Visitas tecnicas omitidas: ${visitasTecnicasOmitidas}` : '',
          ].filter(Boolean),
          detalleSinCliente: [],
          error: 'No hay filas validas para importar despues del filtrado.',
        })
        return
      }

      const clientes = await traerTodoPaginado<any>((from, to) =>
        supabase
          .from('clientes')
          .select('id, nombre, nombre_fiscal, nombre_comercial, cif')
          .range(from, to)
      )

      const mapCif = new Map<string, any>()
      const mapNombre = new Map<string, any>()
      for (const c of clientes || []) {
        const cifN = normalizarCif(String(c.cif || ''))
        if (cifN && !mapCif.has(cifN)) mapCif.set(cifN, c)

        const variantes = [
          ...variantesNombreCliente(String(c.nombre || '')),
          ...variantesNombreCliente(String(c.nombre_fiscal || '')),
          ...variantesNombreCliente(String(c.nombre_comercial || '')),
        ]
        for (const v of variantes) {
          if (v && !mapNombre.has(v)) mapNombre.set(v, c)
        }
      }

      const sinClienteDetalle: string[] = []
      const matched: any[] = []
      for (const sFila of servicios) {
        let cli = null
        if (sFila.cif) cli = mapCif.get(sFila.cif) || null
        if (!cli) {
          const candidatos = variantesNombreCliente(sFila.clienteNombre)
          for (const cand of candidatos) {
            const byNom = mapNombre.get(cand)
            if (byNom) {
              cli = byNom
              break
            }
          }
        }

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
          numero_documento: sFila.numeroDocumento || null,
          descripcion: sFila.descripcion || `Servicio importado (${sFila.numeroDocumento || sFila.fechaServicio})`,
          importe: sFila.importe || 0,
          metadata: {
            archivo: file.name,
            hoja: hojaSeleccionada,
            fila_origen: sFila.fila,
            cliente_texto: sFila.clienteNombre,
            cif_texto: sFila.cif || null,
          },
          created_by: session.user.id,
        })
      }

      if (matched.length === 0) {
        setResultadoImport({
          archivo: file.name,
          totalFilas: servicios.length,
          importados: 0,
          duplicados: 0,
          sinCliente: servicios.length,
          errores: 0,
          advertencias: [
            'No hubo coincidencias con clientes existentes.',
            visitasTecnicasOmitidas > 0 ? `Visitas tecnicas omitidas: ${visitasTecnicasOmitidas}` : '',
          ].filter(Boolean),
          detalleSinCliente: sinClienteDetalle,
          error: 'No se pudo vincular ninguna fila con clientes existentes.',
        })
        return
      }

      const { paraInsertar, duplicados } = await calcularFilasInsertables(matched)
      setPreviewImport({
        archivo: file.name,
        hoja: hojaSeleccionada,
        totalFilas: servicios.length,
        filasVinculadas: matched.length,
        filasPendientesInsercion: paraInsertar.length,
        duplicadosDetectados: duplicados,
        filasSinCliente: servicios.length - matched.length,
        advertencias: [
          `Hoja procesada: ${hojaSeleccionada}`,
          visitasTecnicasOmitidas > 0 ? `Visitas tecnicas omitidas: ${visitasTecnicasOmitidas}` : '',
        ].filter(Boolean),
        detalleSinCliente: sinClienteDetalle,
        filasParaInsertar: paraInsertar,
      })
    } catch (error: any) {
      setResultadoImport({
        archivo: file.name,
        totalFilas: 0,
        importados: 0,
        duplicados: 0,
        sinCliente: 0,
        errores: 0,
        advertencias: [],
        detalleSinCliente: [],
        error: String(error?.message || 'Error desconocido durante la importacion.'),
      })
    } finally {
      setImportando(false)
      e.target.value = ''
    }
  }

  async function aplicarImportacionPreview() {
    if (!previewImport || previewImport.filasParaInsertar.length === 0) {
      setResultadoImport({
        archivo: previewImport?.archivo || '-',
        totalFilas: previewImport?.totalFilas || 0,
        importados: 0,
        duplicados: previewImport?.duplicadosDetectados || 0,
        sinCliente: previewImport?.filasSinCliente || 0,
        errores: 0,
        advertencias: ['No hay filas pendientes para importar.'],
        detalleSinCliente: previewImport?.detalleSinCliente || [],
      })
      setPreviewImport(null)
      return
    }

    setAplicandoImportacion(true)
    setResultadoImport(null)
    try {
      const { paraInsertar, duplicados } = await calcularFilasInsertables(previewImport.filasParaInsertar)
      const chunkSize = 200
      let importados = 0
      let errores = 0
      for (let i = 0; i < paraInsertar.length; i += chunkSize) {
        const bloque = paraInsertar.slice(i, i + chunkSize)
        const { error } = await supabase.from('servicios_clientes').insert(bloque)
        if (error) {
          if (esTablaServiciosNoDisponible(error)) {
            setTablaServiciosDisponible(false)
            throw new Error('Falta la tabla servicios_clientes. Ejecuta la migracion correspondiente.')
          }
          errores += bloque.length
        } else {
          importados += bloque.length
        }
      }

      setResultadoImport({
        archivo: previewImport.archivo,
        totalFilas: previewImport.totalFilas,
        importados,
        duplicados: previewImport.duplicadosDetectados + duplicados,
        sinCliente: previewImport.filasSinCliente,
        errores,
        advertencias: [
          `Hoja procesada: ${previewImport.hoja}`,
          'Importacion aplicada desde previsualizacion.',
        ],
        detalleSinCliente: previewImport.detalleSinCliente,
      })
      setPreviewImport(null)
      await cargarDatos()
    } catch (error: any) {
      setResultadoImport({
        archivo: previewImport.archivo,
        totalFilas: previewImport.totalFilas,
        importados: 0,
        duplicados: 0,
        sinCliente: previewImport.filasSinCliente,
        errores: 0,
        advertencias: [],
        detalleSinCliente: previewImport.detalleSinCliente,
        error: String(error?.message || 'No se pudo aplicar la importacion.'),
      })
    } finally {
      setAplicandoImportacion(false)
    }
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <AppHeader
        title="Recordatorio de servicio"
        rightSlot={(
          <div className="flex items-center gap-2 flex-wrap">
            <label className="text-sm px-4 py-2 rounded-xl cursor-pointer" style={s.btnSecondary}>
              {importando ? 'Preparando vista previa...' : 'Importar Excel historial'}
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(ev) => void previsualizarHistoricoServicios(ev)}
                disabled={importando || aplicandoImportacion}
              />
            </label>
            <button
              onClick={() => void cargarDatos()}
              className="text-sm px-4 py-2 rounded-xl"
              style={s.btnSecondary}
              disabled={importando || aplicandoImportacion}
            >
              Actualizar ranking
            </button>
          </div>
        )}
      />

      <div className="p-6 max-w-5xl mx-auto">
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
                  Archivo: {resultadoImport.archivo} - Filas validas: {resultadoImport.totalFilas}
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

        {previewImport && (
          <div
            className="rounded-2xl p-4 mb-4"
            style={{ background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.25)' }}
          >
            <p className="text-sm font-semibold" style={{ color: '#06b6d4' }}>
              Vista previa lista para importar
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              Archivo: {previewImport.archivo} - Hoja: {previewImport.hoja}
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              Filas validas: {previewImport.totalFilas} - Vinculadas: {previewImport.filasVinculadas}
            </p>
            <p className="text-xs mt-1" style={{ color: '#34d399' }}>
              Pendientes de insercion: {previewImport.filasPendientesInsercion}
            </p>
            <p className="text-xs" style={{ color: '#fbbf24' }}>
              Duplicados detectados: {previewImport.duplicadosDetectados} - Sin cliente: {previewImport.filasSinCliente}
            </p>
            {previewImport.advertencias.map((av, i) => (
              <p key={`preview-adv-${i}`} className="text-xs mt-1" style={{ color: '#06b6d4' }}>{av}</p>
            ))}
            {previewImport.detalleSinCliente.length > 0 && (
              <div className="mt-2">
                <p className="text-xs font-semibold" style={{ color: '#fbbf24' }}>Ejemplos sin cliente:</p>
                {previewImport.detalleSinCliente.map((item, i) => (
                  <p key={`preview-sc-${i}`} className="text-xs" style={{ color: 'var(--text-muted)' }}>{item}</p>
                ))}
              </div>
            )}

            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <button
                onClick={() => void aplicarImportacionPreview()}
                disabled={aplicandoImportacion}
                className="text-sm px-4 py-2 rounded-xl disabled:opacity-50"
                style={s.btnPrimary}
              >
                {aplicandoImportacion ? 'Aplicando importacion...' : 'Aplicar importacion'}
              </button>
              <button
                onClick={() => setPreviewImport(null)}
                disabled={aplicandoImportacion}
                className="text-sm px-4 py-2 rounded-xl disabled:opacity-50"
                style={s.btnSecondary}
              >
                Cancelar vista previa
              </button>
            </div>
          </div>
        )}

        {!tablaServiciosDisponible && (
          <div className="rounded-2xl p-4 mb-4" style={{ background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.25)' }}>
            <p className="text-sm font-semibold" style={{ color: '#06b6d4' }}>
              Historial adicional no disponible.
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              El ranking sigue funcionando con OTs completadas.
            </p>
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
        ) : clientesInactivos.length === 0 && clientesContactados.length === 0 ? (
          <div className="rounded-2xl p-5" style={s.cardStyle}>
            <p className="font-semibold mb-1" style={{ color: 'var(--text)' }}>No hay datos</p>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              No hay clientes con más de 1 año sin servicio registrado.
            </p>
          </div>
        ) : (
          <>
            <div className="rounded-2xl p-4 mb-4" style={s.cardStyle}>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Top 30 clientes pendientes (más de 1 año sin servicio).
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-subtle)' }}>
                Clientes {'>'} 1 año: {totalConHistorial} - Contactados: {clientesContactados.length}
              </p>
            </div>

            {clientesInactivos.length === 0 ? (
              <div className="rounded-xl px-4 py-3 mb-2" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  No hay clientes pendientes de contacto con más de 1 año sin servicio.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {clientesInactivos.map((c, idx) => (
                  <div
                    key={c.id}
                    className="rounded-xl px-4 py-3"
                    style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
                  >
                    <button
                      type="button"
                      onClick={() => alternarDetalle(`pend-${c.id}`)}
                      className="w-full flex items-center justify-between gap-3 text-left"
                    >
                      <div>
                        <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                          #{idx + 1} {c.nombre}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                          Ultima actividad: {c.ultimaFecha.toLocaleDateString('es-ES')}
                        </p>
                      </div>
                      <span className="text-xs px-2 py-1 rounded-lg" style={{ background: 'rgba(6,182,212,0.1)', color: '#06b6d4', border: '1px solid rgba(6,182,212,0.25)' }}>
                        {detallesAbiertos[`pend-${c.id}`] ? 'Ocultar' : 'Ver'}
                      </span>
                    </button>

                    {detallesAbiertos[`pend-${c.id}`] && (
                      <div className="mt-3 pt-3 flex items-center justify-between gap-3 flex-wrap" style={{ borderTop: '1px solid var(--border)' }}>
                        <div>
                          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            {c.diasSinServicio} días sin servicio
                          </p>
                          <p className="text-xs mt-1" style={{ color: 'var(--text-subtle)' }}>
                            Origen último servicio: {c.ultimoOrigen === 'historial' ? 'Historial servicios' : 'OT completada'} - CIF: {c.cif || '-'}{c.email ? ` - ${c.email}` : ''}
                          </p>
                          <p className="text-xs mt-1" style={{ color: '#06b6d4' }}>
                            Último servicio: {c.ultimoServicioDescripcion || 'Sin descripción'}
                            {c.ultimoServicioDocumento ? ` - ${c.ultimoServicioDocumento}` : ''}
                            {typeof c.ultimoServicioImporte === 'number' ? ` - ${c.ultimoServicioImporte.toFixed(2)} EUR` : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap justify-end">
                          <label
                            className="text-xs px-2 py-1 rounded-lg flex items-center gap-2"
                            style={{ background: 'rgba(124,58,237,0.12)', color: '#a78bfa', border: '1px solid rgba(124,58,237,0.28)' }}
                          >
                            <input
                              type="checkbox"
                              checked={Boolean(c.seguimientoLlamadaOk)}
                              onChange={(ev) => void actualizarSeguimientoLlamada(c.id, ev.target.checked)}
                              className="w-3.5 h-3.5"
                              style={{ accentColor: '#7c3aed' }}
                            />
                            Contactado
                          </label>
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
                          {c.seguimientoLlamadaAt && (
                            <span className="text-[11px]" style={{ color: 'var(--text-subtle)' }}>
                              {new Date(c.seguimientoLlamadaAt).toLocaleDateString('es-ES')}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {clientesContactados.length > 0 && (
              <>
                <div className="rounded-2xl p-4 mt-6 mb-3" style={s.cardStyle}>
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    Clientes contactados (pendientes de confirmar servicio).
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  {clientesContactados.map((c, idx) => (
                    <div
                      key={`contactado-${c.id}`}
                      className="rounded-xl px-4 py-3"
                      style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
                    >
                      <button
                        type="button"
                        onClick={() => alternarDetalle(`cont-${c.id}`)}
                        className="w-full flex items-center justify-between gap-3 text-left"
                      >
                        <div>
                          <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                            #{idx + 1} {c.nombre}
                          </p>
                          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                            Ultima actividad: {c.ultimaFecha.toLocaleDateString('es-ES')}
                          </p>
                        </div>
                        <span className="text-xs px-2 py-1 rounded-lg" style={{ background: 'rgba(6,182,212,0.1)', color: '#06b6d4', border: '1px solid rgba(6,182,212,0.25)' }}>
                          {detallesAbiertos[`cont-${c.id}`] ? 'Ocultar' : 'Ver'}
                        </span>
                      </button>

                      {detallesAbiertos[`cont-${c.id}`] && (
                        <div className="mt-3 pt-3 flex items-center justify-between gap-3 flex-wrap" style={{ borderTop: '1px solid var(--border)' }}>
                          <div>
                            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                              Contactado: {c.seguimientoLlamadaAt ? new Date(c.seguimientoLlamadaAt).toLocaleDateString('es-ES') : '-'}
                            </p>
                            <p className="text-xs mt-1" style={{ color: 'var(--text-subtle)' }}>
                              CIF: {c.cif || '-'}{c.email ? ` - ${c.email}` : ''}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap justify-end">
                            <label
                              className="text-xs px-2 py-1 rounded-lg flex items-center gap-2"
                              style={{ background: 'rgba(124,58,237,0.12)', color: '#a78bfa', border: '1px solid rgba(124,58,237,0.28)' }}
                            >
                              <input
                                type="checkbox"
                                checked={Boolean(c.seguimientoLlamadaOk)}
                                onChange={(ev) => void actualizarSeguimientoLlamada(c.id, ev.target.checked)}
                                className="w-3.5 h-3.5"
                                style={{ accentColor: '#7c3aed' }}
                              />
                              Contactado
                            </label>
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
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
