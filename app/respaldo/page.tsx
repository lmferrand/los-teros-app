'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import AppHeader from '@/app/components/AppHeader'
import { s } from '@/lib/styles'
import { supabase } from '@/lib/supabase'

const ROLES_PERMITIDOS = new Set(['gerente', 'oficina', 'supervisor'])
type ProveedorNube = 'dropbox' | 'google_drive'

type ResultadoSubida = {
  ok?: boolean
  destino?: string
  error?: string
  [key: string]: any
}

type EstadoConexion = {
  connected: boolean
  account_email?: string | null
  account_name?: string | null
  expires_at?: string | null
  updated_at?: string | null
}

function RespaldoPageClient() {
  const [loading, setLoading] = useState(true)
  const [perfil, setPerfil] = useState<any>(null)
  const [descargando, setDescargando] = useState(false)
  const [subiendoDestino, setSubiendoDestino] = useState<'' | ProveedorNube | 'all'>('')
  const [conectando, setConectando] = useState<'' | ProveedorNube>('')
  const [desconectando, setDesconectando] = useState<'' | ProveedorNube>('')
  const [resumen, setResumen] = useState<any>(null)
  const [resultadosSubida, setResultadosSubida] = useState<ResultadoSubida[]>([])
  const [conexiones, setConexiones] = useState<Record<ProveedorNube, EstadoConexion>>({
    dropbox: { connected: false },
    google_drive: { connected: false },
  })
  const router = useRouter()
  const searchParams = useSearchParams()

  const puedeGestionar = ROLES_PERMITIDOS.has(String(perfil?.rol || ''))

  const cloudOauth = searchParams.get('cloud_oauth')
  const providerQuery = searchParams.get('provider')
  const autoUploadQuery = searchParams.get('auto_upload')
  const mensajeOauth = searchParams.get('mensaje')

  async function getAccessToken() {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    return session?.access_token || ''
  }

  const cargarConexiones = useCallback(async () => {
    const token = await getAccessToken()
    if (!token) return

    const res = await fetch('/api/oauth/cloud/status', {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return
    const data = await res.json().catch(() => ({}))
    if (!data?.conexiones) return
    setConexiones({
      dropbox: data.conexiones.dropbox || { connected: false },
      google_drive: data.conexiones.google_drive || { connected: false },
    })
  }, [])

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }

      const { data: p } = await supabase.from('perfiles').select('id, nombre, rol').eq('id', session.user.id).single()
      setPerfil(p || null)
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    void cargar()
  }, [cargar])

  useEffect(() => {
    if (!puedeGestionar) return
    void cargarConexiones()
  }, [puedeGestionar, cargarConexiones])

  const subirRespaldo = useCallback(
    async (destino: ProveedorNube | 'all') => {
      if (!puedeGestionar) {
        alert('No tienes permisos para subir respaldos.')
        return
      }

      setSubiendoDestino(destino)
      setResultadosSubida([])
      try {
        const token = await getAccessToken()
        const res = await fetch('/api/respaldo', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ destino }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data?.error || `Error ${res.status}`)

        setResumen(data?.resumen || null)
        setResultadosSubida(Array.isArray(data?.resultados) ? data.resultados : [])
      } catch (error: any) {
        alert(`No se pudo subir el respaldo: ${String(error?.message || 'Error desconocido')}`)
      } finally {
        setSubiendoDestino('')
      }
    },
    [puedeGestionar]
  )

  useEffect(() => {
    if (!cloudOauth) return

    let cancelled = false
    const run = async () => {
      if (cloudOauth === 'error') {
        alert(`No se pudo conectar la nube: ${mensajeOauth || 'Error OAuth.'}`)
        router.replace('/respaldo')
        return
      }

      await cargarConexiones()
      if (cancelled) return

      if (cloudOauth === 'ok' && autoUploadQuery === '1') {
        if (providerQuery === 'dropbox' || providerQuery === 'google_drive') {
          await subirRespaldo(providerQuery)
        }
      }
      router.replace('/respaldo')
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [cloudOauth, autoUploadQuery, providerQuery, mensajeOauth, router, cargarConexiones, subirRespaldo])

  function descargarBlob(blob: Blob, nombreArchivo: string) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = nombreArchivo
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  async function descargarRespaldo() {
    if (!puedeGestionar) {
      alert('No tienes permisos para generar respaldos globales.')
      return
    }

    setDescargando(true)
    setResultadosSubida([])
    try {
      const token = await getAccessToken()
      const res = await fetch('/api/respaldo', {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || `Error ${res.status}`)
      }

      const blob = await res.blob()
      const cd = res.headers.get('content-disposition') || ''
      const match = cd.match(/filename="?([^"]+)"?/)
      const nombre = match?.[1] || `los-teros-backup-${Date.now()}.json`
      descargarBlob(blob, nombre)

      const resumenHeader = res.headers.get('x-respaldo-resumen')
      if (resumenHeader) {
        try {
          setResumen(JSON.parse(resumenHeader))
        } catch {
          // Ignorar si el resumen no es JSON valido.
        }
      }
    } catch (error: any) {
      alert(`No se pudo descargar el respaldo: ${String(error?.message || 'Error desconocido')}`)
    } finally {
      setDescargando(false)
    }
  }

  async function iniciarConexion(provider: ProveedorNube, autoUpload = false) {
    if (!puedeGestionar) {
      alert('No tienes permisos para conectar servicios de nube.')
      return
    }

    setConectando(provider)
    try {
      const token = await getAccessToken()
      const res = await fetch('/api/oauth/cloud/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          provider,
          next: '/respaldo',
          auto_upload: autoUpload,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.url) throw new Error(data?.error || `Error ${res.status}`)

      window.location.href = data.url
    } catch (error: any) {
      alert(`No se pudo iniciar sesión con ${provider}: ${String(error?.message || 'Error desconocido')}`)
      setConectando('')
    }
  }

  async function desconectar(provider: ProveedorNube) {
    if (!confirm(`¿Desconectar ${provider === 'dropbox' ? 'Dropbox' : 'Google Drive'}?`)) return
    setDesconectando(provider)
    try {
      const token = await getAccessToken()
      const res = await fetch('/api/oauth/cloud/disconnect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ provider }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || `Error ${res.status}`)

      await cargarConexiones()
    } catch (error: any) {
      alert(`No se pudo desconectar ${provider}: ${String(error?.message || 'Error desconocido')}`)
    } finally {
      setDesconectando('')
    }
  }

  async function asegurarConexionYSubir(provider: ProveedorNube) {
    const conectado = Boolean(conexiones[provider]?.connected)
    if (!conectado) {
      await iniciarConexion(provider, true)
      return
    }
    await subirRespaldo(provider)
  }

  const textoConexiones = useMemo(() => {
    const n = Number(conexiones.dropbox.connected) + Number(conexiones.google_drive.connected)
    if (n === 0) return 'Sin cuentas conectadas'
    if (n === 1) return '1 cuenta conectada'
    return '2 cuentas conectadas'
  }, [conexiones])

  function nombreCuenta(c: EstadoConexion) {
    return c.account_email || c.account_name || 'Cuenta conectada'
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <AppHeader title="Respaldo de Datos" />

      <div className="p-6 max-w-5xl mx-auto">
        <div className="rounded-2xl p-5 mb-4" style={s.cardStyle}>
          <p className="text-sm mb-2" style={{ color: 'var(--text)' }}>
            Respaldo completo de la app (tablas + inventario de archivos). Cada usuario puede conectar su propio Dropbox o Google Drive.
          </p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Estado actual de conexiones: {textoConexiones}.
          </p>
        </div>

        {!puedeGestionar && (
          <div className="rounded-2xl p-4 mb-4" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.28)' }}>
            <p className="text-sm" style={{ color: '#f87171' }}>
              Tu rol no permite generar respaldos globales. Solicita permisos de gerente/oficina/supervisor.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-2xl p-5" style={s.cardStyle}>
            <h2 className="font-semibold mb-3" style={{ color: 'var(--text)' }}>Exportar respaldo</h2>
            <button
              onClick={() => void descargarRespaldo()}
              disabled={descargando || !puedeGestionar}
              className="text-sm px-4 py-2 rounded-xl disabled:opacity-60"
              style={s.btnPrimary}
            >
              {descargando ? 'Generando y descargando...' : 'Descargar respaldo JSON'}
            </button>
            <p className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>
              Puedes guardarlo manualmente en Dropbox/Drive o usar los botones de subida directa con login por usuario.
            </p>
          </div>

          <div className="rounded-2xl p-5" style={s.cardStyle}>
            <h2 className="font-semibold mb-3" style={{ color: 'var(--text)' }}>Conectar cuentas personales</h2>
            <div className="flex flex-col gap-3">
              <div className="rounded-xl p-3" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>Dropbox</p>
                <p className="text-xs mt-1" style={{ color: conexiones.dropbox.connected ? '#34d399' : 'var(--text-muted)' }}>
                  {conexiones.dropbox.connected ? nombreCuenta(conexiones.dropbox) : 'No conectado'}
                </p>
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => void iniciarConexion('dropbox')}
                    disabled={Boolean(conectando) || !puedeGestionar}
                    className="text-xs px-3 py-1.5 rounded-lg disabled:opacity-60"
                    style={s.btnSecondary}
                  >
                    {conectando === 'dropbox' ? 'Abriendo login...' : conexiones.dropbox.connected ? 'Reconectar' : 'Conectar'}
                  </button>
                  {conexiones.dropbox.connected && (
                    <button
                      onClick={() => void desconectar('dropbox')}
                      disabled={desconectando === 'dropbox'}
                      className="text-xs px-3 py-1.5 rounded-lg disabled:opacity-60"
                      style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}
                    >
                      {desconectando === 'dropbox' ? 'Desconectando...' : 'Desconectar'}
                    </button>
                  )}
                </div>
              </div>

              <div className="rounded-xl p-3" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>Google Drive</p>
                <p className="text-xs mt-1" style={{ color: conexiones.google_drive.connected ? '#34d399' : 'var(--text-muted)' }}>
                  {conexiones.google_drive.connected ? nombreCuenta(conexiones.google_drive) : 'No conectado'}
                </p>
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => void iniciarConexion('google_drive')}
                    disabled={Boolean(conectando) || !puedeGestionar}
                    className="text-xs px-3 py-1.5 rounded-lg disabled:opacity-60"
                    style={s.btnSecondary}
                  >
                    {conectando === 'google_drive' ? 'Abriendo login...' : conexiones.google_drive.connected ? 'Reconectar' : 'Conectar'}
                  </button>
                  {conexiones.google_drive.connected && (
                    <button
                      onClick={() => void desconectar('google_drive')}
                      disabled={desconectando === 'google_drive'}
                      className="text-xs px-3 py-1.5 rounded-lg disabled:opacity-60"
                      style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' }}
                    >
                      {desconectando === 'google_drive' ? 'Desconectando...' : 'Desconectar'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl p-5 mt-4" style={s.cardStyle}>
          <h2 className="font-semibold mb-3" style={{ color: 'var(--text)' }}>Subida directa por usuario</h2>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => void asegurarConexionYSubir('dropbox')}
              disabled={Boolean(subiendoDestino) || !puedeGestionar}
              className="text-sm px-3 py-2 rounded-xl disabled:opacity-60"
              style={s.btnSecondary}
            >
              {subiendoDestino === 'dropbox'
                ? 'Subiendo a Dropbox...'
                : conexiones.dropbox.connected
                  ? 'Guardar respaldo en Dropbox'
                  : 'Login Dropbox y guardar'}
            </button>
            <button
              onClick={() => void asegurarConexionYSubir('google_drive')}
              disabled={Boolean(subiendoDestino) || !puedeGestionar}
              className="text-sm px-3 py-2 rounded-xl disabled:opacity-60"
              style={s.btnSecondary}
            >
              {subiendoDestino === 'google_drive'
                ? 'Subiendo a Google Drive...'
                : conexiones.google_drive.connected
                  ? 'Guardar respaldo en Google Drive'
                  : 'Login Google Drive y guardar'}
            </button>
            <button
              onClick={() => void subirRespaldo('all')}
              disabled={Boolean(subiendoDestino) || !puedeGestionar}
              className="text-sm px-3 py-2 rounded-xl disabled:opacity-60"
              style={s.btnSecondary}
              title="Intenta subir a Dropbox y Google Drive usando las conexiones disponibles"
            >
              {subiendoDestino === 'all' ? 'Subiendo a ambos...' : 'Subir a ambos'}
            </button>
          </div>
          <p className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>
            Si una cuenta no está conectada, se abrirá su login OAuth para ese usuario y al volver se subirá automáticamente.
          </p>
        </div>

        {resumen && (
          <div className="rounded-2xl p-5 mt-4" style={s.cardStyle}>
            <h3 className="font-semibold text-sm mb-3" style={{ color: 'var(--text)' }}>Resumen ultimo respaldo</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <div className="rounded-lg p-3" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Tablas</p>
                <p className="font-semibold" style={{ color: 'var(--text)' }}>{resumen.totalTablas || 0}</p>
              </div>
              <div className="rounded-lg p-3" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Filas</p>
                <p className="font-semibold" style={{ color: 'var(--text)' }}>{(resumen.totalFilas || 0).toLocaleString('es-ES')}</p>
              </div>
              <div className="rounded-lg p-3" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Buckets</p>
                <p className="font-semibold" style={{ color: 'var(--text)' }}>{resumen.totalBuckets || 0}</p>
              </div>
              <div className="rounded-lg p-3" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Archivos</p>
                <p className="font-semibold" style={{ color: 'var(--text)' }}>{(resumen.totalObjetosStorage || 0).toLocaleString('es-ES')}</p>
              </div>
            </div>

            {Array.isArray(resumen.advertencias) && resumen.advertencias.length > 0 && (
              <div className="mt-3 rounded-xl p-3" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)' }}>
                <p className="text-xs font-medium mb-1" style={{ color: '#fbbf24' }}>Advertencias</p>
                {resumen.advertencias.slice(0, 8).map((a: string, idx: number) => (
                  <p key={idx} className="text-xs" style={{ color: '#fcd34d' }}>{a}</p>
                ))}
              </div>
            )}
          </div>
        )}

        {resultadosSubida.length > 0 && (
          <div className="rounded-2xl p-5 mt-4" style={s.cardStyle}>
            <h3 className="font-semibold text-sm mb-3" style={{ color: 'var(--text)' }}>Resultado de subida</h3>
            <div className="flex flex-col gap-2">
              {resultadosSubida.map((r, idx) => (
                <div
                  key={`${r.destino || 'destino'}-${idx}`}
                  className="rounded-xl p-3"
                  style={{
                    background: r.ok ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                    border: `1px solid ${r.ok ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                  }}
                >
                  <p className="text-sm font-medium" style={{ color: r.ok ? '#34d399' : '#f87171' }}>
                    {r.destino || 'destino'}: {r.ok ? 'OK' : 'Error'}
                  </p>
                  {r.cuenta && <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Cuenta: {r.cuenta}</p>}
                  {r.path && <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Ruta: {r.path}</p>}
                  {r.webViewLink && (
                    <a href={r.webViewLink} target="_blank" rel="noreferrer" className="text-xs underline mt-1 inline-block" style={{ color: '#06b6d4' }}>
                      Abrir en Google Drive
                    </a>
                  )}
                  {r.error && <p className="text-xs mt-1" style={{ color: '#fca5a5' }}>{r.error}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function RespaldoPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
          <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <RespaldoPageClient />
    </Suspense>
  )
}
