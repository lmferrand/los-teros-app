'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { cerrarSesion, type Perfil } from '@/lib/sesion'
import { useTheme } from '@/lib/useTheme'
import { useAyuda } from '@/lib/ayuda'
import { comprimirImagen } from '@/lib/imagen'

function iniciales(n: string | null | undefined) {
  return (n || '?').split(' ').map((x) => x[0]).join('').toUpperCase().slice(0, 2)
}

export default function BotonPerfil({ perfil, onVerTutorial }: { perfil: Perfil | null; onVerTutorial: () => void }) {
  const router = useRouter()
  const { tema, toggleTema } = useTheme()
  const { activa, toggle } = useAyuda()
  const [abierto, setAbierto] = useState(false)
  const [foto, setFoto] = useState(perfil?.foto_url || '')
  const [subiendo, setSubiendo] = useState(false)
  const [aviso, setAviso] = useState('')

  async function onFoto(file: File) {
    setSubiendo(true); setAviso('')
    try {
      const blob = await comprimirImagen(file, 512)
      const path = `avatares/${perfil?.id}-${Date.now()}.jpg`
      const { error } = await supabase.storage.from('fotos-ordenes').upload(path, blob, { contentType: 'image/jpeg', upsert: true })
      if (error) throw error
      const url = supabase.storage.from('fotos-ordenes').getPublicUrl(path).data.publicUrl
      const { error: e2 } = await (supabase as any).from('perfiles').update({ foto_url: url }).eq('id', perfil?.id)
      if (e2) throw e2
      setFoto(url)
    } catch {
      setAviso('No se pudo guardar la foto. ¿Ejecutaste SQL_perfil_foto.sql?')
    } finally { setSubiendo(false) }
  }

  async function salir() {
    await cerrarSesion()
    router.replace('/login')
  }

  const oscuro = tema === 'dark'

  return (
    <>
      <button
        onClick={() => setAbierto(true)}
        aria-label="Perfil"
        className="fixed top-3 right-3 z-50 rounded-full overflow-hidden grid place-items-center"
        style={{ width: 40, height: 40, background: foto ? 'transparent' : 'var(--brand-1)', color: 'white', border: '2px solid var(--bg-card)', boxShadow: 'var(--shadow-md)', fontWeight: 700, fontSize: 13 }}
      >
        {foto
          /* eslint-disable-next-line @next/next/no-img-element */
          ? <img src={foto} alt="perfil" style={{ width: 40, height: 40, objectFit: 'cover' }} />
          : iniciales(perfil?.nombre)}
      </button>

      {abierto && (
        <div className="fixed inset-0 z-50" onClick={() => setAbierto(false)} style={{ background: 'rgba(0,0,0,0.3)' }}>
          <div className="absolute top-14 right-3 w-72 rounded-2xl p-4 animar-entrada" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)' }} onClick={(e) => e.stopPropagation()}>
            {/* Datos */}
            <div className="flex items-center gap-3 mb-1">
              <div className="rounded-full overflow-hidden grid place-items-center shrink-0" style={{ width: 52, height: 52, background: foto ? 'transparent' : 'var(--brand-1)', color: 'white', fontWeight: 700 }}>
                {foto
                  /* eslint-disable-next-line @next/next/no-img-element */
                  ? <img src={foto} alt="perfil" style={{ width: 52, height: 52, objectFit: 'cover' }} />
                  : iniciales(perfil?.nombre)}
              </div>
              <div className="min-w-0">
                <div className="font-semibold truncate" style={{ color: 'var(--text)' }}>{perfil?.nombre || 'Usuario'}</div>
                <div className="text-xs capitalize" style={{ color: 'var(--text-subtle)' }}>{perfil?.rol || 'interno'}</div>
                {perfil?.email && <div className="text-xs truncate" style={{ color: 'var(--text-subtle)' }}>{perfil.email}</div>}
              </div>
            </div>
            <label className="block text-xs font-semibold rounded-lg px-3 py-1.5 cursor-pointer text-center mb-3" style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--brand-1)' }}>
              {subiendo ? 'Subiendo…' : (foto ? 'Cambiar foto' : 'Poner foto de perfil')}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFoto(f) }} />
            </label>
            {aviso && <div className="text-xs mb-3" style={{ color: 'var(--red)' }}>{aviso}</div>}

            <div className="flex flex-col gap-1" style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
              {/* Tema */}
              <Fila label={oscuro ? 'Modo oscuro' : 'Modo claro'} on={toggleTema} activa={oscuro} icono={
                oscuro
                  ? <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
                  : <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4m11.4-11.4 1.4-1.4" /></>
              } />
              {/* Ayuda */}
              <Fila label="Ayuda en pantalla" on={toggle} activa={activa} icono={<><circle cx="12" cy="12" r="10" /><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01" /></>} />
              {/* Tutorial */}
              <button onClick={() => { setAbierto(false); onVerTutorial() }} className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm" style={{ color: 'var(--text)' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m10 8 6 4-6 4V8Z" /><circle cx="12" cy="12" r="10" /></svg>
                Ver tutorial
              </button>
            </div>

            <button onClick={salir} className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm w-full mt-2" style={{ color: 'var(--red)', borderTop: '1px solid var(--border)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4m7 14 5-5-5-5m5 5H9" /></svg>
              Cerrar sesión
            </button>
          </div>
        </div>
      )}
    </>
  )
}

function Fila({ label, on, activa, icono }: { label: string; on: () => void; activa: boolean; icono: React.ReactNode }) {
  return (
    <button onClick={on} className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 text-sm" style={{ color: 'var(--text)' }}>
      <span className="flex items-center gap-3">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{icono}</svg>
        {label}
      </span>
      <span className="rounded-full p-0.5 flex" style={{ width: 38, background: activa ? 'var(--brand-1)' : 'var(--bg-subtle)', border: '1px solid var(--border)' }}>
        <span className="rounded-full" style={{ width: 16, height: 16, background: 'white', transform: activa ? 'translateX(18px)' : 'translateX(0)', transition: 'transform 160ms ease', boxShadow: 'var(--shadow-sm)' }} />
      </span>
    </button>
  )
}
