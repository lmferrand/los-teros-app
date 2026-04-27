'use client'

import { Fragment, useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import * as XLSX from 'xlsx'
import { s } from '@/lib/styles'
import AppHeader from '@/app/components/AppHeader'

type ClienteImportado = {
  nombre: string
  nombre_comercial: string
  nombre_fiscal: string
  poblacion: string
  tipo_cliente: TipoCliente
  cif: string
  direccion: string
  telefono: string
  movil: string
  email: string
  notas: string
}

type ResultadoImport = {
  importados?: number
  actualizados?: number
  errores?: number
  total?: number
  omitidas?: number
  omitidasDuplicadas?: number
  omitidasNoCliente?: number
  hoja?: string
  detalles?: string[]
  error?: string
}

type FrecuenciaRecurrencia = '15_dias' | 'mensual' | 'trimestral' | 'anual'
type TipoCliente = 'teros' | 'olipro'

const FRECUENCIAS_RECURRENCIA: { key: FrecuenciaRecurrencia; label: string }[] = [
  { key: '15_dias', label: 'Cada 15 dias' },
  { key: 'mensual', label: 'Mensual' },
  { key: 'trimestral', label: 'Trimestral' },
  { key: 'anual', label: 'Anual' },
]

const FRECUENCIA_LABEL: Record<FrecuenciaRecurrencia, string> = {
  '15_dias': 'Cada 15 dias',
  mensual: 'Mensual',
  trimestral: 'Trimestral',
  anual: 'Anual',
}

const TIPOS_CLIENTE: { key: TipoCliente; label: string }[] = [
  { key: 'teros', label: 'Clientes Teros' },
  { key: 'olipro', label: 'Clientes Olipro' },
]

const TIPO_CLIENTE_LABEL: Record<TipoCliente, string> = {
  teros: 'Teros',
  olipro: 'Olipro',
}

const ALIASES = {
  nombreComercial: [
    'nombrecomercial',
    'nombrelocal',
    'nombre',
    'nombrecliente',
    'cliente',
    'local',
    'empresa',
    'denominacioncomercial',
  ],
  nombreFiscal: [
    'nombrefiscal',
    'razonsocial',
    'razonsocialfiscal',
    'denominacionfiscal',
    'sociedad',
    'titularfiscal',
  ],
  nombre: [
    'nombre',
    'nombrecliente',
    'cliente',
    'razonsocial',
    'empresa',
    'nombreyapellidos',
    'denominacion',
    'contacto',
  ],
  direccion: ['direccion', 'domicilio', 'direccioncliente', 'calle', 'direccionfiscal'],
  cif: ['cif', 'nif', 'dni', 'vat', 'idfiscal', 'identificacionfiscal', 'idtributario', 'taxid', 'id'],
  telefono: ['telefono', 'telefono1', 'movil', 'celular', 'tlf', 'tlf1', 'telefonoprincipal'],
  movil: ['movil', 'celular', 'telefono2', 'tlf2'],
  email: ['email', 'correo', 'correoelectronico', 'mail', 'email1'],
  notas: ['notas', 'observaciones', 'comentarios', 'nota', 'detalle', 'descripcion'],
  poblacion: ['poblacion', 'ciudad', 'municipio'],
  codigoPostal: ['codigopostal', 'cp', 'postal'],
  provincia: ['provincia', 'estado', 'region'],
  pais: ['pais'],
  tipo: ['tipo', 'tipodecontacto', 'tipocontacto'],
  tipoCliente: ['tipocliente', 'clientegrupo', 'grupo', 'marca', 'empresaorigen', 'linea'],
} as const

function normalizarCabecera(texto: string) {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function valorCelda(fila: unknown[], indice: number) {
  if (indice < 0) return ''
  const valor = fila[indice]
  return String(valor ?? '').trim()
}

function indiceCabecera(cabeceras: string[], opciones: readonly string[]) {
  for (const opcion of opciones) {
    const idx = cabeceras.indexOf(opcion)
    if (idx >= 0) return idx
  }

  for (let i = 0; i < cabeceras.length; i++) {
    const cabecera = cabeceras[i]
    if (!cabecera) continue

    for (const opcion of opciones) {
      if (!opcion) continue
      if (cabecera.length < 4 || opcion.length < 4) continue
      if (cabecera.includes(opcion) || opcion.includes(cabecera)) {
        return i
      }
    }
  }

  return -1
}

function detectarColumnaNombrePorDatos(filas: unknown[][], desdeFila: number) {
  let mejorIndice = -1
  let mejorPuntuacion = -Infinity

  const hastaFila = Math.min(filas.length, desdeFila + 120)
  let maxColumnas = 0
  for (let i = desdeFila; i < hastaFila; i++) {
    maxColumnas = Math.max(maxColumnas, (filas[i] || []).length)
  }

  for (let col = 0; col < maxColumnas; col++) {
    let noVacias = 0
    let textoValido = 0
    let soloNumerico = 0

    for (let i = desdeFila; i < hastaFila; i++) {
      const valor = String((filas[i] || [])[col] ?? '').trim()
      if (!valor) continue

      noVacias++
      if (valor.length >= 3) textoValido++
      if (/^[0-9.,/\-]+$/.test(valor)) soloNumerico++
    }

    if (noVacias === 0) continue
    const puntuacion = textoValido * 2 + noVacias - soloNumerico * 3

    if (puntuacion > mejorPuntuacion) {
      mejorPuntuacion = puntuacion
      mejorIndice = col
    }
  }

  return mejorIndice
}

function construirDireccion(partes: string[]) {
  const limpias = partes.map((p) => String(p || '').trim()).filter(Boolean)
  return Array.from(new Set(limpias)).join(', ')
}

function normalizarClave(valor: string) {
  return normalizarCabecera(valor).trim()
}

function normalizarCif(valor: string) {
  return String(valor || '')
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/-/g, '')
    .trim()
}

function normalizarFrecuenciaRecurrencia(valor: string): FrecuenciaRecurrencia {
  if (valor === '15_dias' || valor === 'mensual' || valor === 'trimestral' || valor === 'anual') {
    return valor
  }
  return 'mensual'
}

function normalizarTipoCliente(valor: unknown): TipoCliente {
  const normalizado = normalizarCabecera(String(valor || ''))
  if (!normalizado) return 'teros'
  if (normalizado.includes('olipro')) return 'olipro'
  if (normalizado.includes('teros')) return 'teros'
  if (normalizado === 'o' || normalizado === 'oli') return 'olipro'
  if (normalizado === 't') return 'teros'
  return 'teros'
}

function nombreComercialCliente(c: any) {
  return String(c?.nombre_comercial || c?.nombre || '').trim()
}

function nombreFiscalCliente(c: any) {
  return String(c?.nombre_fiscal || '').trim()
}

function esTablaServiciosNoDisponible(error: any) {
  const txt = String(error?.message || '').toLowerCase()
  return txt.includes('servicios_clientes') && (txt.includes('does not exist') || txt.includes('relation') || txt.includes('schema cache'))
}

function detectarFilaCabecera(filas: unknown[][]) {
  let mejorIndice = -1
  let mejorPuntuacion = -1
  let mejoresCabeceras: string[] = []

  const limite = Math.min(filas.length, 50)

  for (let i = 0; i < limite; i++) {
    const cabeceras = (filas[i] || []).map((c) => normalizarCabecera(String(c)))
    const celdasConTexto = cabeceras.filter((c) => c !== '').length
    if (celdasConTexto === 0) continue

    const idxNombre = indiceCabecera(cabeceras, ALIASES.nombreComercial) >= 0
      ? indiceCabecera(cabeceras, ALIASES.nombreComercial)
      : indiceCabecera(cabeceras, ALIASES.nombre)
    const idxDireccion = indiceCabecera(cabeceras, ALIASES.direccion)
    const idxTelefono = indiceCabecera(cabeceras, ALIASES.telefono)
    const idxEmail = indiceCabecera(cabeceras, ALIASES.email)
    const idxNotas = indiceCabecera(cabeceras, ALIASES.notas)

    let puntuacion = 0
    if (idxNombre >= 0) puntuacion += 5
    if (idxDireccion >= 0) puntuacion += 1
    if (idxTelefono >= 0) puntuacion += 1
    if (idxEmail >= 0) puntuacion += 1
    if (idxNotas >= 0) puntuacion += 1
    if (celdasConTexto >= 4) puntuacion += 1

    if (puntuacion > mejorPuntuacion) {
      mejorPuntuacion = puntuacion
      mejorIndice = i
      mejoresCabeceras = cabeceras
    }
  }

  return { indice: mejorIndice, cabeceras: mejoresCabeceras, puntuacion: mejorPuntuacion }
}

function detectarMejorHoja(workbook: XLSX.WorkBook) {
  let mejor:
    | {
        hoja: string
        filas: unknown[][]
        deteccion: { indice: number; cabeceras: string[]; puntuacion: number }
        puntuacionTotal: number
      }
    | null = null

  for (const hojaNombre of workbook.SheetNames) {
    const hoja = workbook.Sheets[hojaNombre]
    const filas = XLSX.utils.sheet_to_json<unknown[]>(hoja, { header: 1, defval: '' })
    if (!filas.length) continue

    const deteccion = detectarFilaCabecera(filas)
    if (deteccion.indice < 0) continue

    const idxNombre = indiceCabecera(deteccion.cabeceras, ALIASES.nombreComercial) >= 0
      ? indiceCabecera(deteccion.cabeceras, ALIASES.nombreComercial)
      : indiceCabecera(deteccion.cabeceras, ALIASES.nombre)
    const bonusNombre = idxNombre >= 0 ? 5 : 0
    const bonusFilas = Math.min(Math.floor(filas.length / 20), 3)
    const puntuacionTotal = deteccion.puntuacion + bonusNombre + bonusFilas

    if (!mejor || puntuacionTotal > mejor.puntuacionTotal) {
      mejor = { hoja: hojaNombre, filas, deteccion, puntuacionTotal }
    }
  }

  return mejor
}

export default function Clientes() {
  const [clientes, setClientes] = useState<any[]>([])
  const [historialPorCliente, setHistorialPorCliente] = useState<Map<string, { fecha: Date; diasSinServicio: number; origen: 'ot' | 'factura' }>>(new Map())
  const [loading, setLoading] = useState(true)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [importando, setImportando] = useState(false)
  const [resultadoImport, setResultadoImport] = useState<ResultadoImport | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const [nombre, setNombre] = useState('')
  const [nombreFiscal, setNombreFiscal] = useState('')
  const [cif, setCif] = useState('')
  const [poblacion, setPoblacion] = useState('')
  const [direccion, setDireccion] = useState('')
  const [telefono, setTelefono] = useState('')
  const [movil, setMovil] = useState('')
  const [email, setEmail] = useState('')
  const [notas, setNotas] = useState('')
  const [tipoClienteForm, setTipoClienteForm] = useState<TipoCliente>('teros')
  const [esRecurrente, setEsRecurrente] = useState(false)
  const [frecuenciaRecurrencia, setFrecuenciaRecurrencia] = useState<FrecuenciaRecurrencia>('mensual')
  const [busqueda, setBusqueda] = useState('')
  const [filtroTipoCliente, setFiltroTipoCliente] = useState<'todos' | TipoCliente>('todos')
  const [tipoClienteImport, setTipoClienteImport] = useState<TipoCliente>('teros')
  const [soloSinCif, setSoloSinCif] = useState(false)
  const [agruparPorCif, setAgruparPorCif] = useState(true)
  const [filtroSinServicio, setFiltroSinServicio] = useState(false)

  useEffect(() => {
    const query = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
    const filtroQuery = query?.get('filtro') === 'sin_servicio'
    setFiltroSinServicio(filtroQuery)
    if (filtroQuery) setAgruparPorCif(false)
    verificarSesion()
    cargarClientes()
    // Se ejecuta al montar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function verificarSesion() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }
    const { data } = await supabase.from('perfiles').select('*').eq('id', session.user.id).single()
    if (data?.rol !== 'gerente' && data?.rol !== 'oficina') {
      router.push('/dashboard'); return
    }
  }

  async function cargarClientes() {
    const { data } = await supabase.from('clientes').select('*').order('nombre')
    if (data) setClientes(data)

    const ids = (data || []).map((c: any) => c.id).filter(Boolean)
    const historialMap = new Map<string, { fecha: Date; diasSinServicio: number; origen: 'ot' | 'factura' }>()
    if (ids.length > 0) {
      const [ordenesRes, serviciosRes] = await Promise.all([
        supabase
          .from('ordenes')
          .select('cliente_id, fecha_cierre, fecha_programada, created_at')
          .eq('estado', 'completada')
          .in('cliente_id', ids),
        supabase
          .from('servicios_clientes')
          .select('cliente_id, fecha_servicio')
          .in('cliente_id', ids),
      ])

      for (const ot of ordenesRes.data || []) {
        if (!ot?.cliente_id) continue
        const fechaRef = ot.fecha_cierre || ot.fecha_programada || ot.created_at
        if (!fechaRef) continue
        const fecha = new Date(fechaRef)
        if (Number.isNaN(fecha.getTime())) continue
        const previa = historialMap.get(ot.cliente_id)
        if (!previa || fecha.getTime() > previa.fecha.getTime()) {
          historialMap.set(ot.cliente_id, {
            fecha,
            diasSinServicio: Math.floor((Date.now() - fecha.getTime()) / 86400000),
            origen: 'ot',
          })
        }
      }

      if (!serviciosRes.error || !esTablaServiciosNoDisponible(serviciosRes.error)) {
        for (const srv of serviciosRes.data || []) {
          if (!srv?.cliente_id || !srv?.fecha_servicio) continue
          const fecha = new Date(`${srv.fecha_servicio}T12:00:00`)
          if (Number.isNaN(fecha.getTime())) continue
          const previa = historialMap.get(srv.cliente_id)
          if (!previa || fecha.getTime() > previa.fecha.getTime()) {
            historialMap.set(srv.cliente_id, {
              fecha,
              diasSinServicio: Math.floor((Date.now() - fecha.getTime()) / 86400000),
              origen: 'factura',
            })
          }
        }
      }
    }
    setHistorialPorCliente(historialMap)
    setLoading(false)
  }

  function abrirFormNuevo() {
    setEditandoId(null)
    setNombre(''); setNombreFiscal(''); setCif(''); setPoblacion(''); setDireccion(''); setTelefono(''); setMovil(''); setEmail(''); setNotas('')
    setTipoClienteForm('teros')
    setEsRecurrente(false); setFrecuenciaRecurrencia('mensual')
    setMostrarForm(true)
  }

  function abrirFormEditar(c: any) {
    setEditandoId(c.id)
    setNombre(nombreComercialCliente(c)); setNombreFiscal(c.nombre_fiscal || '')
    setDireccion(c.direccion || ''); setPoblacion(c.poblacion || '')
    setCif(normalizarCif(c.cif || '')); setTelefono(c.telefono || ''); setMovil(c.movil || ''); setEmail(c.email || ''); setNotas(c.notas || '')
    setTipoClienteForm(normalizarTipoCliente(c.tipo_cliente))
    setEsRecurrente(Boolean(c.es_recurrente))
    setFrecuenciaRecurrencia(normalizarFrecuenciaRecurrencia(String(c.frecuencia_recurrencia || 'mensual')))
    setMostrarForm(true)
  }

  async function guardarCliente(e: React.FormEvent) {
    e.preventDefault()
    const nombreComercial = nombre.trim()
    const nombreFiscalNorm = nombreFiscal.trim()
    const poblacionNorm = poblacion.trim()
    const cifNormalizado = normalizarCif(cif)
    const datosBase = {
      nombre: nombreComercial,
      nombre_comercial: nombreComercial,
      nombre_fiscal: nombreFiscalNorm || null,
      poblacion: poblacionNorm || null,
      tipo_cliente: tipoClienteForm,
      cif: cifNormalizado || null,
      direccion,
      telefono,
      movil,
      email,
      notas,
    }
    const datosConRecurrencia = {
      ...datosBase,
      es_recurrente: esRecurrente,
      frecuencia_recurrencia: esRecurrente ? frecuenciaRecurrencia : null,
    }

    const guardarCon = async (datos: any) => {
      if (editandoId) return supabase.from('clientes').update(datos).eq('id', editandoId)
      return supabase.from('clientes').insert(datos)
    }

    let { error } = await guardarCon(datosConRecurrencia)
    if (error && /column .*nombre_comercial|column .*nombre_fiscal|column .*poblacion|column .*movil|does not exist/i.test(String(error.message || ''))) {
      alert('Faltan columnas nuevas de clientes en BD. Ejecuta las migraciones 20260427_clientes_identidad_comercial.sql y 20260427_clientes_movil.sql en Supabase SQL Editor.')
      return
    }
    if (error && /column .*tipo_cliente|tipo_cliente .*does not exist/i.test(String(error.message || ''))) {
      alert('Falta la columna "tipo_cliente" en la BD. Ejecuta la migracion 20260427_clientes_tipo_cliente.sql en Supabase SQL Editor.')
      return
    }
    if (error && /column .*es_recurrente|column .*frecuencia_recurrencia|does not exist/i.test(String(error.message || ''))) {
      const fallback = await guardarCon(datosBase)
      error = fallback.error
      if (!error) {
        alert('Cliente guardado, pero faltan columnas de recurrencia en BD. Ejecuta la migracion de clientes recurrentes en SQL Editor.')
      }
    }
    if (error) {
      alert(`No se pudo guardar el cliente: ${error.message}`)
      return
    }
    setMostrarForm(false); setEditandoId(null); cargarClientes()
  }

  async function eliminarCliente(id: string) {
    if (!confirm('Eliminar este cliente?')) return
    await supabase.from('clientes').delete().eq('id', id)
    cargarClientes()
  }

  function abrirMaps(dir: string) {
    window.open('https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(dir), '_blank')
  }

  async function importarExcel(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setImportando(true)
    setResultadoImport(null)

    try {
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array' })
      const seleccion = detectarMejorHoja(workbook)

      if (!seleccion) {
        setResultadoImport({ error: 'No pude detectar la fila de cabeceras del archivo.' })
        return
      }

      const filas = seleccion.filas
      const deteccion = seleccion.deteccion
      const cabeceras = deteccion.cabeceras
      let idxNombreComercial = indiceCabecera(cabeceras, ALIASES.nombreComercial)
      let idxNombre = idxNombreComercial >= 0 ? idxNombreComercial : indiceCabecera(cabeceras, ALIASES.nombre)
      const idxNombreFiscal = indiceCabecera(cabeceras, ALIASES.nombreFiscal)
      const idxCif = indiceCabecera(cabeceras, ALIASES.cif)
      const idxDireccion = indiceCabecera(cabeceras, ALIASES.direccion)
      const idxTelefono = indiceCabecera(cabeceras, ALIASES.telefono)
      const idxMovil = indiceCabecera(cabeceras, ALIASES.movil)
      const idxEmail = indiceCabecera(cabeceras, ALIASES.email)
      const idxNotas = indiceCabecera(cabeceras, ALIASES.notas)
      const idxPoblacion = indiceCabecera(cabeceras, ALIASES.poblacion)
      const idxCodigoPostal = indiceCabecera(cabeceras, ALIASES.codigoPostal)
      const idxProvincia = indiceCabecera(cabeceras, ALIASES.provincia)
      const idxPais = indiceCabecera(cabeceras, ALIASES.pais)
      const idxTipo = indiceCabecera(cabeceras, ALIASES.tipo)
      const idxTipoCliente = indiceCabecera(cabeceras, ALIASES.tipoCliente)
      const nombreDetectadoAutomaticamente = idxNombre < 0

      if (idxNombre < 0) {
        idxNombre = detectarColumnaNombrePorDatos(filas, deteccion.indice + 1)
        idxNombreComercial = idxNombre
      }

      if (idxNombre < 0 && idxNombreFiscal < 0) {
        setResultadoImport({
          error:
            'No encuentro una columna de nombre valida. Usa cabeceras como "Nombre comercial", "Nombre", "Cliente", "Razon social" o "Nombre fiscal".',
        })
        return
      }

      const { data: existentes } = await supabase
        .from('clientes')
        .select('id, nombre, nombre_comercial, nombre_fiscal, poblacion, cif, direccion, tipo_cliente')
      const existentesPorClave = new Map<string, any>()
      for (const c of existentes || []) {
        const claveNombre = normalizarClave(nombreComercialCliente(c) || String(c?.nombre_fiscal || ''))
        const clave = `${claveNombre}|${normalizarClave(String(c?.direccion || ''))}`
        if (clave && !existentesPorClave.has(clave)) existentesPorClave.set(clave, c)
      }
      const clavesEnArchivo = new Set<string>()
      const actualizaciones: {
        id: string
        cif: string | null
        tipo_cliente: TipoCliente
        nombre_fiscal: string | null
        poblacion: string | null
      }[] = []

      const registros: ClienteImportado[] = []
      let omitidas = 0
      let omitidasDuplicadas = 0
      let omitidasNoCliente = 0

      for (let i = deteccion.indice + 1; i < filas.length; i++) {
        const fila = filas[i] || []
        const nombreComercialFila = valorCelda(fila, idxNombreComercial >= 0 ? idxNombreComercial : idxNombre)
        const nombreFiscalFila = valorCelda(fila, idxNombreFiscal)
        const nombreFila = nombreComercialFila || nombreFiscalFila
        const cifFila = normalizarCif(valorCelda(fila, idxCif))
        const poblacionFila = valorCelda(fila, idxPoblacion)
        const direccionFila = construirDireccion([
          valorCelda(fila, idxDireccion),
          poblacionFila,
          valorCelda(fila, idxCodigoPostal),
          valorCelda(fila, idxProvincia),
          valorCelda(fila, idxPais),
        ])
        const telefonoFila = valorCelda(fila, idxTelefono)
        const movilFila = valorCelda(fila, idxMovil)
        const emailFila = valorCelda(fila, idxEmail)
        const notasFila = valorCelda(fila, idxNotas)
        const tipoFila = normalizarClave(valorCelda(fila, idxTipo))
        const tipoClienteFila = valorCelda(fila, idxTipoCliente)
        const tipoClienteNormalizado = idxTipoCliente >= 0
          ? normalizarTipoCliente(tipoClienteFila)
          : tipoClienteImport

        const filaVacia = !nombreFila && !cifFila && !direccionFila && !telefonoFila && !movilFila && !emailFila && !notasFila
        if (filaVacia) {
          omitidas++
          continue
        }

        if (!nombreFila) {
          omitidas++
          continue
        }

        if (idxTipo >= 0 && tipoFila && tipoFila.includes('proveedor') && !tipoFila.includes('cliente')) {
          omitidasNoCliente++
          continue
        }

        const claveNombre = normalizarClave(nombreFila)
        if (!claveNombre) {
          omitidas++
          continue
        }

        const claveFila = `${claveNombre}|${normalizarClave(direccionFila)}`
        const existente = existentesPorClave.get(claveFila)
        if (existente?.id) {
          const cifActual = normalizarCif(String(existente.cif || ''))
          const tipoActual = normalizarTipoCliente(existente.tipo_cliente)
          const fiscalActual = normalizarClave(String(existente.nombre_fiscal || ''))
          const poblacionActual = normalizarClave(String(existente.poblacion || ''))
          const fiscalNuevo = normalizarClave(nombreFiscalFila)
          const poblacionNueva = normalizarClave(poblacionFila)
          const debeActualizarCif = !!cifFila && (!cifActual || cifActual !== cifFila)
          const debeActualizarTipo = tipoActual !== tipoClienteNormalizado
          const debeActualizarNombreFiscal = !!fiscalNuevo && fiscalNuevo !== fiscalActual
          const debeActualizarPoblacion = !!poblacionNueva && poblacionNueva !== poblacionActual
          if (debeActualizarCif || debeActualizarTipo || debeActualizarNombreFiscal || debeActualizarPoblacion) {
            actualizaciones.push({
              id: existente.id,
              cif: cifFila || null,
              tipo_cliente: tipoClienteNormalizado,
              nombre_fiscal: nombreFiscalFila || null,
              poblacion: poblacionFila || null,
            })
          } else {
            omitidasDuplicadas++
          }
          continue
        }

        if (clavesEnArchivo.has(claveFila)) {
          omitidasDuplicadas++
          continue
        }
        clavesEnArchivo.add(claveFila)

        registros.push({
          nombre: nombreComercialFila || nombreFiscalFila,
          nombre_comercial: nombreComercialFila || nombreFiscalFila,
          nombre_fiscal: nombreFiscalFila,
          poblacion: poblacionFila,
          tipo_cliente: tipoClienteNormalizado,
          cif: cifFila,
          direccion: direccionFila,
          telefono: telefonoFila,
          movil: movilFila,
          email: emailFila,
          notas: notasFila,
        })
      }

      if (registros.length === 0 && actualizaciones.length === 0) {
        const soloDuplicados = omitidasDuplicadas > 0 && omitidas === 0 && omitidasNoCliente === 0
        setResultadoImport(
          soloDuplicados
            ? {
                importados: 0,
                actualizados: 0,
                errores: 0,
                total: Math.max(0, filas.length - (deteccion.indice + 1)),
                omitidas,
                omitidasDuplicadas,
                omitidasNoCliente,
                hoja: seleccion.hoja,
                detalles: ['Aviso: sin cambios, todos los clientes del archivo ya existian en la base de datos.'],
              }
            : {
                error: 'No hay filas validas para importar despues del filtrado.',
              }
        )
        return
      }

      const LOTE = 200
      let importados = 0
      let actualizados = 0
      let errores = 0
      const detalles: string[] = []

      if (nombreDetectadoAutomaticamente) {
        detalles.push('Aviso: la columna de nombre se detecto automaticamente por contenido.')
      }
      if (idxTipoCliente < 0) {
        detalles.push(`Aviso: no se detecto columna de tipo de cliente, se importo todo como ${TIPO_CLIENTE_LABEL[tipoClienteImport]}.`)
      }

      for (let i = 0; i < registros.length; i += LOTE) {
        const lote = registros.slice(i, i + LOTE)
        const { error } = await supabase.from('clientes').insert(lote)

        if (!error) {
          importados += lote.length
          continue
        }

        if (/column .*nombre_comercial|column .*nombre_fiscal|column .*poblacion|column .*movil|does not exist/i.test(String(error.message || ''))) {
          setResultadoImport({
            error: 'Faltan columnas nuevas de clientes en BD. Ejecuta 20260427_clientes_identidad_comercial.sql y 20260427_clientes_movil.sql, y reintenta la importacion.',
          })
          return
        }

        for (const registro of lote) {
          const { error: errorFila } = await supabase.from('clientes').insert(registro)
          if (errorFila) {
            errores++
            if (detalles.length < 5) detalles.push(`${registro.nombre}: ${errorFila.message}`)
          } else {
            importados++
          }
        }
      }

      for (const fila of actualizaciones) {
        const payload: {
          tipo_cliente: TipoCliente
          cif?: string | null
          nombre_fiscal?: string | null
          poblacion?: string | null
        } = { tipo_cliente: fila.tipo_cliente }
        if (fila.cif) payload.cif = fila.cif
        if (fila.nombre_fiscal) payload.nombre_fiscal = fila.nombre_fiscal
        if (fila.poblacion) payload.poblacion = fila.poblacion

        const { error: errorUpdate } = await supabase
          .from('clientes')
          .update(payload)
          .eq('id', fila.id)
        if (errorUpdate) {
          errores++
          if (detalles.length < 5) detalles.push(`No se pudo actualizar cliente existente: ${errorUpdate.message}`)
        } else {
          actualizados++
        }
      }

      setResultadoImport({
        importados,
        actualizados,
        errores,
        total: Math.max(0, filas.length - (deteccion.indice + 1)),
        omitidas,
        omitidasDuplicadas,
        omitidasNoCliente,
        hoja: seleccion.hoja,
        detalles,
      })
      cargarClientes()
    } catch (error) {
      const mensaje = error && typeof error === 'object' && 'message' in error
        ? String((error as { message?: string }).message || '')
        : ''
      setResultadoImport({ error: mensaje || 'Error al leer el archivo Excel/CSV.' })
    } finally {
      setImportando(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  function exportarExcel() {
    const datos = clientes.map((c) => ({
      nombre_comercial: nombreComercialCliente(c),
      nombre_fiscal: c.nombre_fiscal || '',
      cif: c.cif || '',
      direccion: c.direccion || '',
      poblacion: c.poblacion || '',
      telefono: c.telefono || '',
      movil: c.movil || '',
      mail: c.email || '',
      notas: c.notas || '',
    }))
    const ws = XLSX.utils.json_to_sheet(datos)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Clientes')
    XLSX.writeFile(wb, `clientes_los_teros_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  const termino = normalizarClave(busqueda)
  let baseClientes = soloSinCif
    ? clientes.filter((c: any) => !String(c?.cif || '').trim())
    : clientes
  if (filtroTipoCliente !== 'todos') {
    baseClientes = baseClientes.filter((c: any) => normalizarTipoCliente(c?.tipo_cliente) === filtroTipoCliente)
  }
  if (filtroSinServicio) {
    baseClientes = baseClientes.filter((c: any) => historialPorCliente.has(c.id))
  }
  const clientesFiltrados = termino
    ? baseClientes.filter((c: any) =>
        [c?.nombre_comercial, c?.nombre_fiscal, c?.nombre, c?.tipo_cliente, c?.cif, c?.poblacion, c?.telefono, c?.movil, c?.email, c?.direccion]
          .map((v) => normalizarClave(String(v || '')))
          .some((v) => v.includes(termino))
      )
    : baseClientes
  const clientesOrdenados = [...clientesFiltrados].sort((a: any, b: any) => {
    const nombreA = nombreComercialCliente(a)
    const nombreB = nombreComercialCliente(b)
    if (filtroSinServicio) {
      const diasA = historialPorCliente.get(a.id)?.diasSinServicio ?? -1
      const diasB = historialPorCliente.get(b.id)?.diasSinServicio ?? -1
      if (diasA !== diasB) return diasB - diasA
      return nombreA.localeCompare(nombreB, 'es', { sensitivity: 'base' })
    }

    if (!agruparPorCif) {
      return nombreA.localeCompare(nombreB, 'es', { sensitivity: 'base' })
    }

    const cifA = normalizarCif(String(a?.cif || ''))
    const cifB = normalizarCif(String(b?.cif || ''))

    if (!cifA && cifB) return 1
    if (cifA && !cifB) return -1
    if (cifA !== cifB) return cifA.localeCompare(cifB, 'es', { sensitivity: 'base' })

    return nombreA.localeCompare(nombreB, 'es', { sensitivity: 'base' })
  })
  const conteoPorCif = new Map<string, number>()
  if (agruparPorCif && !filtroSinServicio) {
    for (const c of clientesOrdenados) {
      const key = normalizarCif(String(c?.cif || ''))
      if (!key) continue
      conteoPorCif.set(key, (conteoPorCif.get(key) || 0) + 1)
    }
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <AppHeader
        title="Clientes"
        rightSlot={
          <div className="flex items-center gap-3 flex-wrap">
            <a href="/plantilla_clientes_importacion.csv" download className="text-sm px-4 py-2 rounded-xl" style={s.btnSecondary}>
              Plantilla CSV
            </a>
            <button onClick={exportarExcel} className="text-sm px-4 py-2 rounded-xl" style={s.btnSecondary}>
              Exportar Excel
            </button>
            <select
              value={tipoClienteImport}
              onChange={(e) => setTipoClienteImport(normalizarTipoCliente(e.target.value))}
              className="text-sm rounded-xl px-3 py-2 outline-none"
              style={s.inputStyle}
              title="Tipo destino para importacion masiva"
            >
              {TIPOS_CLIENTE.map((tipoItem) => (
                <option key={tipoItem.key} value={tipoItem.key}>{tipoItem.label}</option>
              ))}
            </select>
            <label className="text-sm px-4 py-2 rounded-xl cursor-pointer" style={s.btnSecondary}>
              {importando ? 'Importando...' : 'Importar Excel'}
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={importarExcel} disabled={importando} />
            </label>
            <button onClick={abrirFormNuevo} className="text-sm px-4 py-2 rounded-xl font-medium" style={s.btnPrimary}>
              + Nuevo cliente
            </button>
          </div>
        }
      />

      <div className="p-6 max-w-6xl mx-auto">
        {resultadoImport && (
          <div className="rounded-2xl p-4 mb-6" style={resultadoImport.error
            ? { background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }
            : { background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
            {resultadoImport.error
              ? <p className="text-sm" style={{ color: '#f87171' }}>{resultadoImport.error}</p>
              : <div>
                  <p className="font-semibold mb-1" style={{ color: 'var(--text)' }}>Importacion completada</p>
                  <p className="text-sm" style={{ color: '#34d399' }}>{resultadoImport.importados || 0} clientes importados</p>
                  {!!resultadoImport.actualizados && (
                    <p className="text-sm" style={{ color: '#34d399' }}>{resultadoImport.actualizados} clientes actualizados (CIF/datos fiscales)</p>
                  )}
                  {!!resultadoImport.hoja && (
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Hoja detectada: {resultadoImport.hoja}</p>
                  )}
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    Tipo destino de importacion: {TIPO_CLIENTE_LABEL[tipoClienteImport]}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{resultadoImport.total || 0} filas procesadas</p>
                  {!!resultadoImport.omitidas && (
                    <p className="text-sm" style={{ color: '#fbbf24' }}>{resultadoImport.omitidas} filas omitidas (vacias o sin nombre)</p>
                  )}
                  {!!resultadoImport.omitidasDuplicadas && (
                    <p className="text-sm" style={{ color: '#fbbf24' }}>{resultadoImport.omitidasDuplicadas} filas omitidas por duplicado</p>
                  )}
                  {!!resultadoImport.omitidasNoCliente && (
                    <p className="text-sm" style={{ color: '#fbbf24' }}>{resultadoImport.omitidasNoCliente} filas omitidas por tipo no cliente</p>
                  )}
                  {(resultadoImport.errores || 0) > 0 && <p className="text-sm" style={{ color: '#f87171' }}>{resultadoImport.errores || 0} errores</p>}
                  {(resultadoImport.detalles || []).map((d, i) => (
                    <p
                      key={i}
                      className="text-xs"
                      style={{ color: d.startsWith('Aviso:') ? '#fbbf24' : '#f87171' }}
                    >
                      {d}
                    </p>
                  ))}
                </div>}
            <button onClick={() => setResultadoImport(null)} className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>Cerrar</button>
          </div>
        )}

        <div className="rounded-2xl p-4 mb-6" style={{ background: 'rgba(6,182,212,0.05)', border: '1px solid rgba(6,182,212,0.15)' }}>
          <p className="font-medium text-sm mb-1" style={{ color: '#06b6d4' }}>Formato Excel para importar</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Orden recomendado: Nombre Comercial, Nombre Fiscal, CIF, Direccion, Poblacion, Telefono, Movil, mail y notas.
          </p>
          <div className="flex flex-wrap gap-2 mt-2">
            {['nombre_comercial', 'nombre_fiscal', 'cif', 'direccion', 'poblacion', 'telefono', 'movil', 'mail', 'notas'].map(col => (
              <span key={col} className="text-xs px-2 py-1 rounded-lg font-mono" style={{ background: 'rgba(6,182,212,0.1)', color: '#06b6d4' }}>{col}</span>
            ))}
          </div>
          <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
            El grupo de clientes (Teros/Olipro) se toma del selector de importacion.
          </p>
        </div>

        <div className="rounded-2xl p-4 mb-6" style={s.cardStyle}>
          <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-muted)' }}>
            Buscar cliente
          </label>
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full rounded-xl px-3 py-2 text-sm outline-none"
            style={s.inputStyle}
            placeholder="Nombre comercial o fiscal, CIF, poblacion, telefono, movil..."
          />
          <div className="mt-3 flex gap-2 flex-wrap">
            <button
              onClick={() => setFiltroTipoCliente('todos')}
              className="text-xs px-3 py-1 rounded-lg"
              style={filtroTipoCliente === 'todos' ? s.btnPrimary : s.btnSecondary}
            >
              Todos
            </button>
            <button
              onClick={() => setFiltroTipoCliente('teros')}
              className="text-xs px-3 py-1 rounded-lg"
              style={filtroTipoCliente === 'teros' ? s.btnPrimary : s.btnSecondary}
            >
              Clientes Teros
            </button>
            <button
              onClick={() => setFiltroTipoCliente('olipro')}
              className="text-xs px-3 py-1 rounded-lg"
              style={filtroTipoCliente === 'olipro' ? s.btnPrimary : s.btnSecondary}
            >
              Clientes Olipro
            </button>
            <button
              onClick={() => setSoloSinCif((prev) => !prev)}
              className="text-xs px-3 py-1 rounded-lg"
              style={soloSinCif ? s.btnPrimary : s.btnSecondary}
            >
              {soloSinCif ? 'Mostrando solo sin CIF' : 'Filtrar solo sin CIF'}
            </button>
            <button
              onClick={() => {
                setFiltroSinServicio((prev) => {
                  const next = !prev
                  if (next) setAgruparPorCif(false)
                  return next
                })
              }}
              className="text-xs px-3 py-1 rounded-lg"
              style={filtroSinServicio ? s.btnPrimary : s.btnSecondary}
            >
              {filtroSinServicio ? 'Filtrado: mas tiempo sin servicio' : 'Filtrar por inactividad'}
            </button>
            <button
              onClick={() => setAgruparPorCif((prev) => !prev)}
              disabled={filtroSinServicio}
              className="text-xs px-3 py-1 rounded-lg"
              style={agruparPorCif ? s.btnPrimary : s.btnSecondary}
            >
              {agruparPorCif ? 'Agrupado por CIF' : 'Sin agrupar por CIF'}
            </button>
            {filtroSinServicio && (
              <button
                onClick={() => setFiltroSinServicio(false)}
                className="text-xs px-3 py-1 rounded-lg"
                style={s.btnSecondary}
              >
                Quitar filtro inactividad
              </button>
            )}
          </div>
        </div>

        {mostrarForm && (
          <div className="rounded-2xl p-6 mb-6" style={s.cardStyle}>
            <h2 className="font-semibold mb-5" style={{ color: 'var(--text)' }}>{editandoId ? 'Editar cliente' : 'Nuevo cliente'}</h2>
            <form onSubmit={guardarCliente} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-muted)' }}>Nombre comercial</label>
                <input value={nombre} onChange={e => setNombre(e.target.value)} required className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={s.inputStyle} placeholder="Restaurante La Brasa" />
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-muted)' }}>Nombre fiscal</label>
                <input value={nombreFiscal} onChange={e => setNombreFiscal(e.target.value)} className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={s.inputStyle} placeholder="Los Teros 2022 SL" />
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-muted)' }}>Tipo de cliente</label>
                <select value={tipoClienteForm} onChange={e => setTipoClienteForm(normalizarTipoCliente(e.target.value))} className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={s.inputStyle}>
                  {TIPOS_CLIENTE.map((tipoItem) => (
                    <option key={tipoItem.key} value={tipoItem.key}>{tipoItem.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-muted)' }}>CIF</label>
                <input value={cif} onChange={e => setCif(normalizarCif(e.target.value))} className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={s.inputStyle} placeholder="B12345678" />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-muted)' }}>Direccion</label>
                <input value={direccion} onChange={e => setDireccion(e.target.value)} className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={s.inputStyle} placeholder="Calle, numero, ciudad..." />
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-muted)' }}>Poblacion</label>
                <input value={poblacion} onChange={e => setPoblacion(e.target.value)} className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={s.inputStyle} placeholder="Las Palmas de Gran Canaria" />
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-muted)' }}>Telefono</label>
                <input value={telefono} onChange={e => setTelefono(e.target.value)} className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={s.inputStyle} />
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-muted)' }}>Movil</label>
                <input value={movil} onChange={e => setMovil(e.target.value)} className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={s.inputStyle} />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-muted)' }}>Mail</label>
                <input value={email} onChange={e => setEmail(e.target.value)} type="email" className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={s.inputStyle} />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-muted)' }}>Notas</label>
                <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={2} className="w-full rounded-xl px-3 py-2 text-sm outline-none resize-none" style={s.inputStyle} placeholder="Instrucciones de acceso, contacto..." />
              </div>
              <div className="md:col-span-2 rounded-xl p-3" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                <div className="flex items-center gap-3 flex-wrap">
                  <label className="text-sm flex items-center gap-2 cursor-pointer" style={{ color: 'var(--text)' }}>
                    <input
                      type="checkbox"
                      checked={esRecurrente}
                      onChange={(e) => setEsRecurrente(e.target.checked)}
                      className="w-4 h-4"
                      style={{ accentColor: '#06b6d4' }}
                    />
                    Cliente recurrente
                  </label>

                  <select
                    value={frecuenciaRecurrencia}
                    onChange={(e) => setFrecuenciaRecurrencia(normalizarFrecuenciaRecurrencia(e.target.value))}
                    disabled={!esRecurrente}
                    className="rounded-xl px-3 py-2 text-sm outline-none disabled:opacity-50"
                    style={s.inputStyle}
                  >
                    {FRECUENCIAS_RECURRENCIA.map((f) => (
                      <option key={f.key} value={f.key}>{f.label}</option>
                    ))}
                  </select>
                </div>
                <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                  Sirve para detectar renovaciones automaticas y planificar servicios repetidos.
                </p>
              </div>
              <div className="md:col-span-2 flex gap-3">
                <button type="submit" className="px-5 py-2 rounded-xl text-sm font-medium" style={s.btnPrimary}>
                  {editandoId ? 'Guardar cambios' : 'Guardar cliente'}
                </button>
                <button type="button" onClick={() => { setMostrarForm(false); setEditandoId(null) }} className="text-sm px-5 py-2 rounded-xl" style={s.btnSecondary}>
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
        ) : clientes.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-5xl mb-4">🏢</p>
            <p style={{ color: 'var(--text-muted)' }}>No hay clientes. Añade el primero o importa un Excel.</p>
          </div>
        ) : (
          <div className="rounded-2xl overflow-hidden" style={s.cardStyle}>
            <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                {clientesOrdenados.length} de {clientes.length} clientes
              </p>
            </div>
            {clientesOrdenados.length === 0 ? (
              <div className="p-6">
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No hay resultados para esa busqueda.</p>
              </div>
            ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Cliente', 'Tipo', 'CIF', 'Poblacion', 'Telefono', 'Movil', 'Mail', 'Direccion', 'Recurrencia', 'Ultimo servicio', ''].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {clientesOrdenados.map((c, index) => {
                    const cifActual = normalizarCif(String(c?.cif || ''))
                    const cifPrevio = normalizarCif(String(clientesOrdenados[index - 1]?.cif || ''))
                    const inicioGrupoCif = agruparPorCif && !!cifActual && cifActual !== cifPrevio
                    const inicioGrupoSinCif = agruparPorCif && !cifActual && cifPrevio !== ''

                    return (
                      <Fragment key={c.id}>
                        {inicioGrupoCif && (
                          <tr>
                            <td colSpan={11} className="px-4 py-2 text-xs font-semibold" style={{ background: 'rgba(6,182,212,0.08)', color: '#06b6d4', borderBottom: '1px solid var(--border)' }}>
                              CIF {cifActual} - {conteoPorCif.get(cifActual) || 0} locales
                            </td>
                          </tr>
                        )}
                        {inicioGrupoSinCif && (
                          <tr>
                            <td colSpan={11} className="px-4 py-2 text-xs font-semibold" style={{ background: 'rgba(124,58,237,0.08)', color: '#a78bfa', borderBottom: '1px solid var(--border)' }}>
                              Sin CIF
                            </td>
                          </tr>
                        )}
                    <tr key={c.id} style={{ borderBottom: '1px solid var(--border)' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(124,58,237,0.05)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <td className="px-4 py-3">
                        <Link href={`/clientes/${c.id}`} className="font-medium hover:underline" style={{ color: 'var(--text)' }}>
                          {nombreComercialCliente(c)}
                        </Link>
                        {(nombreFiscalCliente(c) || c.cif) && (
                          <p className="text-xs mt-0.5" style={{ color: 'var(--text-subtle)' }}>
                            {nombreFiscalCliente(c) || 'Sin nombre fiscal'}{c.cif ? ` - ${c.cif}` : ''}
                          </p>
                        )}
                        {c.notas && <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{c.notas.substring(0, 50)}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="text-xs px-2 py-1 rounded-full"
                          style={{
                            background: normalizarTipoCliente(c.tipo_cliente) === 'teros' ? 'rgba(6,182,212,0.12)' : 'rgba(124,58,237,0.12)',
                            color: normalizarTipoCliente(c.tipo_cliente) === 'teros' ? '#06b6d4' : '#a78bfa',
                            border: normalizarTipoCliente(c.tipo_cliente) === 'teros'
                              ? '1px solid rgba(6,182,212,0.25)'
                              : '1px solid rgba(124,58,237,0.25)',
                          }}
                        >
                          {TIPO_CLIENTE_LABEL[normalizarTipoCliente(c.tipo_cliente)]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {c.cif || <span style={{ color: 'var(--text-subtle)' }}>-</span>}
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                        {c.poblacion || <span style={{ color: 'var(--text-subtle)' }}>-</span>}
                      </td>
                      <td className="px-4 py-3">
                        {c.telefono
                          ? <a href={`tel:${c.telefono}`} className="text-sm font-medium" style={{ color: '#34d399' }}>{c.telefono}</a>
                          : <span style={{ color: 'var(--text-subtle)' }}>-</span>}
                      </td>
                      <td className="px-4 py-3">
                        {c.movil
                          ? <a href={`tel:${c.movil}`} className="text-sm font-medium" style={{ color: '#22c55e' }}>{c.movil}</a>
                          : <span style={{ color: 'var(--text-subtle)' }}>-</span>}
                      </td>
                      <td className="px-4 py-3">
                        {c.email
                          ? <a href={`mailto:${c.email}`} className="text-sm" style={{ color: '#06b6d4' }}>{c.email}</a>
                          : <span style={{ color: 'var(--text-subtle)' }}>-</span>}
                      </td>
                      <td className="px-4 py-3 text-xs max-w-xs truncate" style={{ color: 'var(--text-muted)' }}>
                        {c.direccion || '-'}
                      </td>
                      <td className="px-4 py-3">
                        {c.es_recurrente ? (
                          <span className="text-xs px-2 py-1 rounded-full" style={{ background: 'rgba(6,182,212,0.12)', color: '#06b6d4', border: '1px solid rgba(6,182,212,0.25)' }}>
                            {FRECUENCIA_LABEL[normalizarFrecuenciaRecurrencia(String(c.frecuencia_recurrencia || 'mensual'))]}
                          </span>
                        ) : (
                          <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>No</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {(() => {
                          const hist = historialPorCliente.get(c.id)
                          if (!hist) return <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>Sin historial</span>
                          return (
                            <div>
                              <p className="text-xs font-medium" style={{ color: 'var(--text)' }}>
                                {hist.diasSinServicio} dias
                              </p>
                              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                {hist.fecha.toLocaleDateString('es-ES')} - {hist.origen === 'factura' ? 'Factura' : 'OT'}
                              </p>
                            </div>
                          )
                        })()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2 justify-end">
                          {c.direccion && (
                            <button onClick={() => abrirMaps(c.direccion)} className="text-xs px-2 py-1 rounded-lg"
                              style={{ color: '#06b6d4', background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.2)' }}>
                              Maps
                            </button>
                          )}
                          <button onClick={() => abrirFormEditar(c)} className="text-xs px-2 py-1 rounded-lg"
                            style={{ color: '#a78bfa', background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.2)' }}>
                            Editar
                          </button>
                          <button onClick={() => eliminarCliente(c.id)} className="text-xs px-2 py-1 rounded-lg"
                            style={{ color: '#f87171', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
