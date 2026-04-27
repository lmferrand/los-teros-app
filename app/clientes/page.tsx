'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import * as XLSX from 'xlsx'
import { s } from '@/lib/styles'

export default function Clientes() {
  const [clientes, setClientes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [importando, setImportando] = useState(false)
  const [resultadoImport, setResultadoImport] = useState<any>(null)
  const [busqueda, setBusqueda] = useState('')
  const [filtroEmpresa, setFiltroEmpresa] = useState('todos')
  const [pagina, setPagina] = useState(0)
  const [totalClientes, setTotalClientes] = useState(0)
  const [seleccionados, setSeleccionados] = useState<string[]>([])
  const [borrandoMasivo, setBorrandoMasivo] = useState(false)
  const POR_PAGINA = 50
  const fileRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const [nombre, setNombre] = useState('')
  const [nombreFiscal, setNombreFiscal] = useState('')
  const [cif, setCif] = useState('')
  const [direccion, setDireccion] = useState('')
  const [poblacion, setPoblacion] = useState('')
  const [telefono, setTelefono] = useState('')
  const [movil, setMovil] = useState('')
  const [email, setEmail] = useState('')
  const [notas, setNotas] = useState('')
  const [empresa, setEmpresa] = useState('teros')

  useEffect(() => { verificarSesion() }, [])
  useEffect(() => { cargarClientes() }, [pagina, busqueda, filtroEmpresa])

  async function verificarSesion() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }
    const { data } = await supabase.from('perfiles').select('*').eq('id', session.user.id).single()
    if (data?.rol !== 'gerente' && data?.rol !== 'oficina') {
      router.push('/dashboard'); return
    }
  }

  async function cargarClientes() {
    setLoading(true)
    let query = (supabase.from('clientes') as any).select('*', { count: 'exact' })
    if (filtroEmpresa !== 'todos') query = query.eq('empresa', filtroEmpresa)
    if (busqueda.trim()) query = query.ilike('nombre', `%${busqueda.trim()}%`)
    const { data, count } = await query.order('nombre').range(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA - 1)
    if (data) setClientes(data)
    if (count !== null) setTotalClientes(count)
    setLoading(false)
  }

  function abrirFormNuevo() {
    setEditandoId(null)
    setNombre(''); setNombreFiscal(''); setCif(''); setDireccion(''); setPoblacion('')
    setTelefono(''); setMovil(''); setEmail(''); setNotas('')
    setEmpresa(filtroEmpresa === 'todos' ? 'teros' : filtroEmpresa)
    setMostrarForm(true)
  }

  function abrirFormEditar(c: any) {
    setEditandoId(c.id)
    setNombre(c.nombre || ''); setNombreFiscal(c.nombre_fiscal || ''); setCif(c.cif || '')
    setDireccion(c.direccion || ''); setPoblacion(c.poblacion || '')
    setTelefono(c.telefono || ''); setMovil(c.movil || ''); setEmail(c.email || '')
    setNotas(c.notas || ''); setEmpresa(c.empresa || 'teros')
    setMostrarForm(true)
  }

  async function guardarCliente(e: React.FormEvent) {
    e.preventDefault()
    const datos = { nombre, nombre_fiscal: nombreFiscal, cif, direccion, poblacion, telefono, movil, email, notas, empresa }
    if (editandoId) {
      await (supabase.from('clientes') as any).update(datos).eq('id', editandoId)
    } else {
      await (supabase.from('clientes') as any).insert(datos)
    }
    setMostrarForm(false); setEditandoId(null); cargarClientes()
  }

  async function eliminarCliente(id: string) {
    if (!confirm('Eliminar este cliente?')) return
    await supabase.from('clientes').delete().eq('id', id)
    cargarClientes()
  }

  async function eliminarSeleccionados() {
    if (seleccionados.length === 0) return
    if (!confirm(`Eliminar ${seleccionados.length} clientes seleccionados?`)) return
    setBorrandoMasivo(true)
    await supabase.from('clientes').delete().in('id', seleccionados)
    setSeleccionados([])
    setBorrandoMasivo(false)
    cargarClientes()
  }

  async function eliminarTodosEmpresa() {
    const label = filtroEmpresa === 'todos' ? 'TODOS los clientes' : `todos los clientes de ${filtroEmpresa === 'teros' ? 'Los Teros' : 'Olipro'}`
    if (!confirm(`Eliminar ${label}? Esta accion no se puede deshacer.`)) return
    setBorrandoMasivo(true)
    if (filtroEmpresa === 'todos') {
      await supabase.from('clientes').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    } else {
      await (supabase.from('clientes') as any).delete().eq('empresa', filtroEmpresa)
    }
    setSeleccionados([])
    setBorrandoMasivo(false)
    cargarClientes()
  }

  function toggleSeleccion(id: string) {
    setSeleccionados(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  function toggleTodos() {
    if (seleccionados.length === clientes.length) {
      setSeleccionados([])
    } else {
      setSeleccionados(clientes.map(c => c.id))
    }
  }

  function abrirMaps(dir: string) {
    window.open('https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(dir), '_blank')
  }

  async function importarExcel(e: React.ChangeEvent<HTMLInputElement>, empresaImport: string) {
    const file = e.target.files?.[0]
    if (!file) return
    setImportando(true); setResultadoImport(null)
    try {
      const buffer = await file.arrayBuffer()
      const workbook = XLSX.read(buffer, { type: 'array' })
      const hoja = workbook.Sheets[workbook.SheetNames[0]]
      const todasFilas = XLSX.utils.sheet_to_json(hoja, { defval: '', header: 1 }) as any[][]

      // Detectar fila de cabeceras
      let filaHeader = 0
      for (let i = 0; i < Math.min(10, todasFilas.length); i++) {
        const fila = todasFilas[i].map((c: any) => String(c || '').toLowerCase())
        if (fila.some(c => c.includes('nombre') || c.includes('name'))) {
          filaHeader = i
          break
        }
      }

      const headers = todasFilas[filaHeader].map((h: any) => String(h || '').toLowerCase().trim())
      const datos = todasFilas.slice(filaHeader + 1)

      function getCol(fila: any[], buscar: string[]): string {
        for (const b of buscar) {
          const idx = headers.findIndex((h: string) => h.includes(b))
          if (idx !== -1 && fila[idx] !== undefined) return String(fila[idx] || '').trim()
        }
        return ''
      }

      const registros = datos
        .filter((fila: any[]) => {
          const n = getCol(fila, ['nombre'])
          return n !== '' && n !== 'undefined'
        })
        .map((fila: any[]) => ({
          nombre: getCol(fila, ['nombre comercial', 'nombre', 'name']),
          nombre_fiscal: getCol(fila, ['nombre fiscal', 'fiscal']),
          cif: getCol(fila, ['cif', 'nif', 'id']),
          direccion: getCol(fila, ['direcci', 'address']),
          poblacion: getCol(fila, ['poblaci', 'ciudad', 'city', 'localidad']),
          telefono: getCol(fila, ['tel', 'phone']),
          movil: getCol(fila, ['movil', 'móvil', 'mobile', 'celular']),
          email: getCol(fila, ['mail', 'email', 'correo']),
          notas: getCol(fila, ['nota', 'note', 'observ']),
          empresa: empresaImport,
        }))
        .filter(r => r.nombre !== '')

      const LOTE = 100
      let importados = 0; let errores = 0
      for (let i = 0; i < registros.length; i += LOTE) {
        const lote = registros.slice(i, i + LOTE)
        const { error } = await (supabase.from('clientes') as any).insert(lote)
        if (error) errores += lote.length
        else importados += lote.length
      }
      setResultadoImport({ importados, errores, total: registros.length, empresa: empresaImport })
      setPagina(0); cargarClientes()
    } catch (err) {
      setResultadoImport({ error: 'Error al leer el archivo Excel.' })
    }
    setImportando(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  function exportarExcel() {
    const datos = clientes.map(c => ({
      'Nombre Comercial': c.nombre || '',
      'Nombre Fiscal': c.nombre_fiscal || '',
      'CIF': c.cif || '',
      'Direccion': c.direccion || '',
      'Poblacion': c.poblacion || '',
      'Telefono': c.telefono || '',
      'Movil': c.movil || '',
      'Email': c.email || '',
      'Notas': c.notas || '',
      'Empresa': c.empresa || '',
    }))
    const ws = XLSX.utils.json_to_sheet(datos)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Clientes')
    XLSX.writeFile(wb, `clientes_${filtroEmpresa}_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  const totalPaginas = Math.ceil(totalClientes / POR_PAGINA)

  const EMPRESAS = [
    { key: 'todos', label: 'Todos', color: '#34d399', bg: 'rgba(16,185,129,0.15)' },
    { key: 'teros', label: 'Los Teros', color: '#06b6d4', bg: 'rgba(6,182,212,0.15)' },
    { key: 'olipro', label: 'Olipro', color: '#a78bfa', bg: 'rgba(124,58,237,0.15)' },
  ]

  const labelEmpresa = filtroEmpresa === 'todos' ? 'todos' : filtroEmpresa === 'teros' ? 'Los Teros' : 'Olipro'

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
          <button onClick={abrirFormNuevo} className="text-sm px-4 py-2 rounded-xl font-medium" style={s.btnPrimary}>
            + Nuevo cliente
          </button>
        </div>
      </div>

      <div className="p-6 max-w-6xl mx-auto">

        <div className="flex gap-2 mb-6">
          {EMPRESAS.map(emp => (
            <button key={emp.key} onClick={() => { setFiltroEmpresa(emp.key); setPagina(0); setBusqueda(''); setSeleccionados([]) }}
              className="px-5 py-2 rounded-xl text-sm font-semibold transition-all"
              style={filtroEmpresa === emp.key
                ? { background: emp.bg, color: emp.color, border: `1px solid ${emp.color}` }
                : s.btnSecondary}>
              {emp.label}
            </button>
          ))}
        </div>

        <div className="rounded-2xl p-4 mb-6 flex flex-wrap gap-3 items-center" style={{ background: 'rgba(6,182,212,0.05)', border: '1px solid rgba(6,182,212,0.15)' }}>
          <p className="text-sm font-medium" style={{ color: '#06b6d4' }}>Importar Excel:</p>
          {EMPRESAS.filter(e => e.key !== 'todos').map(emp => (
            <label key={emp.key} className="text-sm px-4 py-2 rounded-xl cursor-pointer font-medium"
              style={{ background: emp.bg, color: emp.color, border: `1px solid ${emp.color}`, opacity: importando ? 0.5 : 1 }}>
              {importando ? 'Importando...' : `Importar ${emp.label}`}
              <input type="file" accept=".xlsx,.xls,.csv" className="hidden"
                onChange={e => importarExcel(e, emp.key)} disabled={importando} />
            </label>
          ))}
          <p className="text-xs w-full mt-1" style={{ color: 'var(--text-muted)' }}>
            Columnas: Nombre Comercial, Nombre Fiscal, CIF, Direccion, Poblacion, Telefono, Movil, Email, Notas
          </p>
        </div>

        {resultadoImport && (
          <div className="rounded-2xl p-4 mb-6" style={resultadoImport.error
            ? { background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }
            : { background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
            {resultadoImport.error
              ? <p className="text-sm" style={{ color: '#f87171' }}>{resultadoImport.error}</p>
              : <div>
                  <p className="font-semibold mb-1" style={{ color: 'var(--text)' }}>Importacion completada — {resultadoImport.empresa === 'teros' ? 'Los Teros' : 'Olipro'}</p>
                  <p className="text-sm" style={{ color: '#34d399' }}>{resultadoImport.importados} clientes importados</p>
                  {resultadoImport.errores > 0 && <p className="text-sm" style={{ color: '#f87171' }}>{resultadoImport.errores} errores</p>}
                </div>}
            <button onClick={() => setResultadoImport(null)} className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>Cerrar</button>
          </div>
        )}

        <div className="mb-4 flex gap-3 items-center flex-wrap">
          <input
            value={busqueda}
            onChange={e => { setBusqueda(e.target.value); setPagina(0) }}
            placeholder={`Buscar cliente...`}
            className="flex-1 rounded-xl px-4 py-2 text-sm outline-none"
            style={s.inputStyle}
          />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{totalClientes} clientes</p>
        </div>

        {seleccionados.length > 0 && (
          <div className="rounded-2xl p-3 mb-4 flex items-center gap-3 flex-wrap" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <p className="text-sm font-medium" style={{ color: '#f87171' }}>{seleccionados.length} seleccionados</p>
            <button onClick={eliminarSeleccionados} disabled={borrandoMasivo}
              className="text-sm px-4 py-1.5 rounded-xl font-medium disabled:opacity-50"
              style={{ background: 'rgba(239,68,68,0.2)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}>
              {borrandoMasivo ? 'Eliminando...' : 'Eliminar seleccionados'}
            </button>
            <button onClick={() => setSeleccionados([])} className="text-sm px-4 py-1.5 rounded-xl" style={s.btnSecondary}>
              Cancelar seleccion
            </button>
          </div>
        )}

        <div className="mb-4 flex justify-end">
          <button onClick={eliminarTodosEmpresa} disabled={borrandoMasivo}
            className="text-xs px-3 py-1.5 rounded-xl disabled:opacity-50"
            style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171', border: '1px solid rgba(239,68,68,0.15)' }}>
            Borrar {labelEmpresa}
          </button>
        </div>

        {mostrarForm && (
          <div className="rounded-2xl p-6 mb-6" style={s.cardStyle}>
            <h2 className="font-semibold mb-5" style={{ color: 'var(--text)' }}>{editandoId ? 'Editar cliente' : 'Nuevo cliente'}</h2>
            <form onSubmit={guardarCliente} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-muted)' }}>Empresa</label>
                <select value={empresa} onChange={e => setEmpresa(e.target.value)} className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={s.inputStyle}>
                  <option value="teros">Los Teros</option>
                  <option value="olipro">Olipro</option>
                </select>
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-muted)' }}>Nombre Comercial</label>
                <input value={nombre} onChange={e => setNombre(e.target.value)} required className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={s.inputStyle} placeholder="Restaurante La Brasa" />
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-muted)' }}>Nombre Fiscal</label>
                <input value={nombreFiscal} onChange={e => setNombreFiscal(e.target.value)} className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={s.inputStyle} placeholder="La Brasa SL" />
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-muted)' }}>CIF</label>
                <input value={cif} onChange={e => setCif(e.target.value)} className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={s.inputStyle} placeholder="B12345678" />
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-muted)' }}>Direccion</label>
                <input value={direccion} onChange={e => setDireccion(e.target.value)} className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={s.inputStyle} placeholder="Calle Mayor 1" />
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-muted)' }}>Poblacion</label>
                <input value={poblacion} onChange={e => setPoblacion(e.target.value)} className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={s.inputStyle} placeholder="Elche" />
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-muted)' }}>Telefono</label>
                <input value={telefono} onChange={e => setTelefono(e.target.value)} className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={s.inputStyle} />
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider mb-2 block" style={{ color: 'var(--text-muted)' }}>Movil</label>
                <input value={movil} onChange={e => setMovil(e.target.value)} className="w-full rounded-xl px-3 py-2 text-sm outline-none" style={s.inputStyle} />
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
            <p style={{ color: 'var(--text-muted)' }}>{busqueda ? 'No se encontraron clientes.' : `No hay clientes de ${labelEmpresa}.`}</p>
          </div>
        ) : (
          <>
            <div className="rounded-2xl overflow-hidden mb-4" style={s.cardStyle}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <th className="px-4 py-3">
                        <input type="checkbox" checked={seleccionados.length === clientes.length && clientes.length > 0}
                          onChange={toggleTodos} className="w-4 h-4" style={{ accentColor: '#7c3aed' }} />
                      </th>
                      {['Nombre Comercial', 'Nombre Fiscal', 'CIF', 'Poblacion', 'Telefono', 'Empresa', ''].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {clientes.map(c => (
                      <tr key={c.id}
                        style={{ borderBottom: '1px solid var(--border)', background: seleccionados.includes(c.id) ? 'rgba(239,68,68,0.05)' : 'transparent' }}
                        onMouseEnter={e => { if (!seleccionados.includes(c.id)) e.currentTarget.style.background = 'rgba(124,58,237,0.05)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = seleccionados.includes(c.id) ? 'rgba(239,68,68,0.05)' : 'transparent' }}>
                        <td className="px-4 py-3">
                          <input type="checkbox" checked={seleccionados.includes(c.id)}
                            onChange={() => toggleSeleccion(c.id)} className="w-4 h-4" style={{ accentColor: '#7c3aed' }} />
                        </td>
                        <td className="px-4 py-3">
                          <a href={`/clientes/${c.id}`} className="font-medium hover:underline" style={{ color: 'var(--text)' }}>{c.nombre}</a>
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>{c.nombre_fiscal || '—'}</td>
                        <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>{c.cif || '—'}</td>
                        <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>{c.poblacion || '—'}</td>
                        <td className="px-4 py-3">
                          {c.telefono
                            ? <a href={`tel:${c.telefono}`} className="text-sm font-medium" style={{ color: '#34d399' }}>📞 {c.telefono}</a>
                            : c.movil
                            ? <a href={`tel:${c.movil}`} className="text-sm font-medium" style={{ color: '#34d399' }}>📱 {c.movil}</a>
                            : <span style={{ color: 'var(--text-subtle)' }}>—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs px-2 py-0.5 rounded-full"
                            style={c.empresa === 'teros'
                              ? { background: 'rgba(6,182,212,0.15)', color: '#06b6d4' }
                              : { background: 'rgba(124,58,237,0.15)', color: '#a78bfa' }}>
                            {c.empresa === 'teros' ? 'Teros' : 'Olipro'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2 justify-end">
                            {(c.direccion || c.poblacion) && (
                              <button onClick={() => abrirMaps(`${c.direccion} ${c.poblacion}`)} className="text-xs px-2 py-1 rounded-lg"
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
            </div>

            <div className="flex items-center justify-between flex-wrap gap-3">
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Pagina {pagina + 1} de {totalPaginas} — {clientes.length} de {totalClientes}
              </p>
              <div className="flex gap-2">
                <button onClick={() => setPagina(p => Math.max(0, p - 1))} disabled={pagina === 0}
                  className="text-sm px-4 py-2 rounded-xl disabled:opacity-40" style={s.btnSecondary}>
                  Anterior
                </button>
                <button onClick={() => setPagina(p => Math.min(totalPaginas - 1, p + 1))} disabled={pagina >= totalPaginas - 1}
                  className="text-sm px-4 py-2 rounded-xl disabled:opacity-40" style={s.btnSecondary}>
                  Siguiente
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}