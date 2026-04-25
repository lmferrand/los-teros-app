'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import * as XLSX from 'xlsx'
import { s } from '@/lib/styles'

type ClienteImportado = {
  nombre: string
  cif: string
  direccion: string
  telefono: string
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

const ALIASES = {
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

function detectarFilaCabecera(filas: unknown[][]) {
  let mejorIndice = -1
  let mejorPuntuacion = -1
  let mejoresCabeceras: string[] = []

  const limite = Math.min(filas.length, 50)

  for (let i = 0; i < limite; i++) {
    const cabeceras = (filas[i] || []).map((c) => normalizarCabecera(String(c)))
    const celdasConTexto = cabeceras.filter((c) => c !== '').length
    if (celdasConTexto === 0) continue

    const idxNombre = indiceCabecera(cabeceras, ALIASES.nombre)
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

    const idxNombre = indiceCabecera(deteccion.cabeceras, ALIASES.nombre)
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
  const [loading, setLoading] = useState(true)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [importando, setImportando] = useState(false)
  const [resultadoImport, setResultadoImport] = useState<ResultadoImport | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const [nombre, setNombre] = useState('')
  const [cif, setCif] = useState('')
  const [direccion, setDireccion] = useState('')
  const [telefono, setTelefono] = useState('')
  const [email, setEmail] = useState('')
  const [notas, setNotas] = useState('')
  const [busqueda, setBusqueda] = useState('')

  useEffect(() => {
    verificarSesion()
    cargarClientes()
    // Se ejecuta solo al montar; estas funciones internas no deben disparar re-ejecuciones.
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
    setLoading(false)
  }

  function abrirFormNuevo() {
    setEditandoId(null)
    setNombre(''); setCif(''); setDireccion(''); setTelefono(''); setEmail(''); setNotas('')
    setMostrarForm(true)
  }

  function abrirFormEditar(c: any) {
    setEditandoId(c.id)
    setNombre(c.nombre || ''); setDireccion(c.direccion || '')
    setCif(c.cif || ''); setTelefono(c.telefono || ''); setEmail(c.email || ''); setNotas(c.notas || '')
    setMostrarForm(true)
  }

  async function guardarCliente(e: React.FormEvent) {
    e.preventDefault()
    const datos = { nombre, cif, direccion, telefono, email, notas }
    if (editandoId) {
      await supabase.from('clientes').update(datos).eq('id', editandoId)
    } else {
      await supabase.from('clientes').insert(datos)
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
      let idxNombre = indiceCabecera(cabeceras, ALIASES.nombre)
      const idxCif = indiceCabecera(cabeceras, ALIASES.cif)
      const idxDireccion = indiceCabecera(cabeceras, ALIASES.direccion)
      const idxTelefono = indiceCabecera(cabeceras, ALIASES.telefono)
      const idxTelefonoMovil = indiceCabecera(cabeceras, ALIASES.movil)
      const idxEmail = indiceCabecera(cabeceras, ALIASES.email)
      const idxNotas = indiceCabecera(cabeceras, ALIASES.notas)
      const idxPoblacion = indiceCabecera(cabeceras, ALIASES.poblacion)
      const idxCodigoPostal = indiceCabecera(cabeceras, ALIASES.codigoPostal)
      const idxProvincia = indiceCabecera(cabeceras, ALIASES.provincia)
      const idxPais = indiceCabecera(cabeceras, ALIASES.pais)
      const idxTipo = indiceCabecera(cabeceras, ALIASES.tipo)
      const nombreDetectadoAutomaticamente = idxNombre < 0

      if (idxNombre < 0) {
        idxNombre = detectarColumnaNombrePorDatos(filas, deteccion.indice + 1)
      }

      if (idxNombre < 0) {
        setResultadoImport({
          error:
            'No encuentro una columna de nombre valida. Prueba con cabecera "Nombre", "Cliente", "Razon social" o "Empresa".',
        })
        return
      }

      const { data: existentes } = await supabase.from('clientes').select('id, nombre, cif')
      const existentesPorNombre = new Map<string, any>()
      const existentesPorCif = new Map<string, any>()
      for (const c of existentes || []) {
        const claveNombre = normalizarClave(String(c?.nombre || ''))
        if (claveNombre && !existentesPorNombre.has(claveNombre)) existentesPorNombre.set(claveNombre, c)
        const claveCif = normalizarClave(String(c?.cif || ''))
        if (claveCif && !existentesPorCif.has(claveCif)) existentesPorCif.set(claveCif, c)
      }
      const nombresExistentes = new Set(
        (existentes || []).map((c: any) => normalizarClave(String(c?.nombre || ''))).filter(Boolean)
      )
      const cifsExistentes = new Set(
        (existentes || []).map((c: any) => normalizarClave(String(c?.cif || ''))).filter(Boolean)
      )
      const nombresEnArchivo = new Set<string>()
      const cifsEnArchivo = new Set<string>()
      const actualizaciones: { id: string; cif: string }[] = []

      const registros: ClienteImportado[] = []
      let omitidas = 0
      let omitidasDuplicadas = 0
      let omitidasNoCliente = 0

      for (let i = deteccion.indice + 1; i < filas.length; i++) {
        const fila = filas[i] || []
        const nombreFila = valorCelda(fila, idxNombre)
        const cifFila = valorCelda(fila, idxCif)
        const direccionFila = construirDireccion([
          valorCelda(fila, idxDireccion),
          valorCelda(fila, idxPoblacion),
          valorCelda(fila, idxCodigoPostal),
          valorCelda(fila, idxProvincia),
          valorCelda(fila, idxPais),
        ])
        const telefonoFila = valorCelda(fila, idxTelefono) || valorCelda(fila, idxTelefonoMovil)
        const emailFila = valorCelda(fila, idxEmail)
        const notasFila = valorCelda(fila, idxNotas)
        const tipoFila = normalizarClave(valorCelda(fila, idxTipo))

        const filaVacia = !nombreFila && !cifFila && !direccionFila && !telefonoFila && !emailFila && !notasFila
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
        const claveCif = normalizarClave(cifFila)
        if (!claveNombre) {
          omitidas++
          continue
        }

        const duplicadoNombre = nombresExistentes.has(claveNombre) || nombresEnArchivo.has(claveNombre)
        const duplicadoCif = !!claveCif && (cifsExistentes.has(claveCif) || cifsEnArchivo.has(claveCif))
        if (duplicadoNombre || duplicadoCif) {
          const existentePorNombre = existentesPorNombre.get(claveNombre)
          const existentePorCif = claveCif ? existentesPorCif.get(claveCif) : null
          const existente = existentePorNombre || existentePorCif

          if (existente?.id && claveCif) {
            const cifActual = normalizarClave(String(existente.cif || ''))
            if (!cifActual || cifActual !== claveCif) {
              actualizaciones.push({ id: existente.id, cif: cifFila })
              if (!cifsExistentes.has(claveCif)) cifsExistentes.add(claveCif)
              continue
            }
          }

          omitidasDuplicadas++
          continue
        }
        nombresEnArchivo.add(claveNombre)
        if (claveCif) cifsEnArchivo.add(claveCif)

        registros.push({
          nombre: nombreFila,
          cif: cifFila,
          direccion: direccionFila,
          telefono: telefonoFila,
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

      for (let i = 0; i < registros.length; i += LOTE) {
        const lote = registros.slice(i, i + LOTE)
        const { error } = await supabase.from('clientes').insert(lote)

        if (!error) {
          importados += lote.length
          continue
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
        const { error: errorUpdate } = await supabase
          .from('clientes')
          .update({ cif: fila.cif })
          .eq('id', fila.id)
        if (errorUpdate) {
          errores++
          if (detalles.length < 5) detalles.push(`No se pudo actualizar CIF: ${errorUpdate.message}`)
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
    const datos = clientes.map(c => ({ nombre: c.nombre, cif: c.cif || '', direccion: c.direccion || '', telefono: c.telefono || '', email: c.email || '', notas: c.notas || '' }))
    const ws = XLSX.utils.json_to_sheet(datos)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Clientes')
    XLSX.writeFile(wb, `clientes_los_teros_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  const termino = normalizarClave(busqueda)
  const clientesFiltrados = termino
    ? clientes.filter((c: any) =>
        [c?.nombre, c?.cif, c?.telefono, c?.email, c?.direccion]
          .map((v) => normalizarClave(String(v || '')))
          .some((v) => v.includes(termino))
      )
    : clientes

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <div className="px-6 py-4 flex items-center justify-between flex-wrap gap-3" style={s.headerStyle}>
        <div className="flex items-center gap-4">
          <a href="/dashboard" className="text-sm transition-colors" style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => e.currentTarget.style.color = '#06b6d4'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>Dashboard</a>
          <h1 className="font-bold text-lg" style={{ color: 'var(--text)' }}>Clientes</h1>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={exportarExcel} className="text-sm px-4 py-2 rounded-xl" style={s.btnSecondary}>
            Exportar Excel
          </button>
          <label className="text-sm px-4 py-2 rounded-xl cursor-pointer" style={s.btnSecondary}>
            {importando ? 'Importando...' : 'Importar Excel'}
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={importarExcel} disabled={importando} />
          </label>
          <button onClick={abrirFormNuevo} className="text-sm px-4 py-2 rounded-xl font-medium" style={s.btnPrimary}>
            + Nuevo cliente
          </button>
        </div>
      </div>

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
                    <p className="text-sm" style={{ color: '#34d399' }}>{resultadoImport.actualizados} clientes actualizados (CIF)</p>
                  )}
                  {!!resultadoImport.hoja && (
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Hoja detectada: {resultadoImport.hoja}</p>
                  )}
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
            Detecta automaticamente la hoja y cabeceras (Nombre, Cliente, Razon social, Empresa, etc.).
          </p>
          <div className="flex flex-wrap gap-2 mt-2">
            {['nombre', 'cif', 'direccion', 'telefono', 'email', 'notas'].map(col => (
              <span key={col} className="text-xs px-2 py-1 rounded-lg font-mono" style={{ background: 'rgba(6,182,212,0.1)', color: '#06b6d4' }}>{col}</span>
            ))}
          </div>
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
            placeholder="Nombre, CIF, telefono, email..."
          />
        </div>

        {mostrarForm && (
          <div className="rounded-2xl p-6 mb-6" style={s.cardStyle}>
            <h2 className="font-semibold mb-5" style={{ color: 'var(--text)' }}>{editandoId ? 'Editar cliente' : 'Nuevo cliente'}</h2>
            <form onSubmit={guardarCliente} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-muted)' }}>Nombre</label>
                <input value={nombre} onChange={e => setNombre(e.target.value)} required className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={s.inputStyle} placeholder="Restaurante La Brasa" />
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-muted)' }}>CIF</label>
                <input value={cif} onChange={e => setCif(e.target.value)} className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={s.inputStyle} placeholder="B12345678" />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-muted)' }}>Direccion</label>
                <input value={direccion} onChange={e => setDireccion(e.target.value)} className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={s.inputStyle} placeholder="Calle, numero, ciudad..." />
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-muted)' }}>Telefono</label>
                <input value={telefono} onChange={e => setTelefono(e.target.value)} className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={s.inputStyle} />
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-muted)' }}>Email</label>
                <input value={email} onChange={e => setEmail(e.target.value)} type="email" className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={s.inputStyle} />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-muted)' }}>Notas</label>
                <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={2} className="w-full rounded-xl px-3 py-2 text-sm outline-none resize-none" style={s.inputStyle} placeholder="Instrucciones de acceso, contacto..." />
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
                {clientesFiltrados.length} de {clientes.length} clientes
              </p>
            </div>
            {clientesFiltrados.length === 0 ? (
              <div className="p-6">
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No hay resultados para esa busqueda.</p>
              </div>
            ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Nombre', 'CIF', 'Telefono', 'Email', 'Direccion', ''].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {clientesFiltrados.map(c => (
                    <tr key={c.id} style={{ borderBottom: '1px solid var(--border)' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(124,58,237,0.05)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <td className="px-4 py-3">
                        <a href={`/clientes/${c.id}`} className="font-medium hover:underline" style={{ color: 'var(--text)' }}>{c.nombre}</a>
                        {c.notas && <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{c.notas.substring(0, 50)}</p>}
                      </td>
                      <td className="px-4 py-3">
                        {c.cif || <span style={{ color: 'var(--text-subtle)' }}>-</span>}
                      </td>
                      <td className="px-4 py-3">
                        {c.telefono
                          ? <a href={`tel:${c.telefono}`} className="text-sm font-medium" style={{ color: '#34d399' }}>📞 {c.telefono}</a>
                          : <span style={{ color: 'var(--text-subtle)' }}>—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {c.email
                          ? <a href={`mailto:${c.email}`} className="text-sm" style={{ color: '#06b6d4' }}>✉️ {c.email}</a>
                          : <span style={{ color: 'var(--text-subtle)' }}>—</span>}
                      </td>
                      <td className="px-4 py-3 text-xs max-w-xs truncate" style={{ color: 'var(--text-muted)' }}>
                        {c.direccion || '—'}
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
                  ))}
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
