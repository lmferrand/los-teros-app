'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function Dashboard() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.push('/login')
      } else {
        setUser(session.user)
        setLoading(false)
      }
    })
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <p className="text-white">Cargando...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-950">
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">LOS TEROS</h1>
        <div className="flex items-center gap-4">
          <span className="text-gray-400 text-sm">{user?.email}</span>
          <button
            onClick={handleLogout}
            className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm"
          >
            Cerrar sesion
          </button>
        </div>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <p className="text-gray-400 text-xs uppercase mb-2">OT Activas</p>
            <p className="text-3xl font-bold text-white">0</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <p className="text-gray-400 text-xs uppercase mb-2">Clientes</p>
            <p className="text-3xl font-bold text-white">0</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <p className="text-gray-400 text-xs uppercase mb-2">Stock bajo</p>
            <p className="text-3xl font-bold text-yellow-400">0</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <p className="text-gray-400 text-xs uppercase mb-2">Equipos fuera</p>
            <p className="text-3xl font-bold text-red-400">0</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <a href="/ordenes" className="bg-gray-900 border border-gray-800 hover:border-blue-500 rounded-xl p-6 block">
            <div className="text-2xl mb-3">📋</div>
            <h2 className="text-white font-semibold text-lg">Ordenes de trabajo</h2>
            <p className="text-gray-400 text-sm mt-1">Crear y gestionar ordenes</p>
          </a>
          <a href="/clientes" className="bg-gray-900 border border-gray-800 hover:border-blue-500 rounded-xl p-6 block">
            <div className="text-2xl mb-3">🏢</div>
            <h2 className="text-white font-semibold text-lg">Clientes</h2>
            <p className="text-gray-400 text-sm mt-1">Fichas y historial</p>
          </a>
          <a href="/inventario" className="bg-gray-900 border border-gray-800 hover:border-blue-500 rounded-xl p-6 block">
            <div className="text-2xl mb-3">📦</div>
            <h2 className="text-white font-semibold text-lg">Inventario</h2>
            <p className="text-gray-400 text-sm mt-1">Stock y materiales</p>
          </a>
          <a href="/equipos" className="bg-gray-900 border border-gray-800 hover:border-blue-500 rounded-xl p-6 block">
            <div className="text-2xl mb-3">⚙️</div>
            <h2 className="text-white font-semibold text-lg">Equipos</h2>
            <p className="text-gray-400 text-sm mt-1">Turbinas y motores</p>
          </a>
          <a href="/planificacion" className="bg-gray-900 border border-gray-800 hover:border-blue-500 rounded-xl p-6 block">
            <div className="text-2xl mb-3">📅</div>
            <h2 className="text-white font-semibold text-lg">Planificacion</h2>
            <p className="text-gray-400 text-sm mt-1">Calendario de trabajos</p>
          </a>
          <a href="/trabajadores" className="bg-gray-900 border border-gray-800 hover:border-blue-500 rounded-xl p-6 block">
            <div className="text-2xl mb-3">👷</div>
            <h2 className="text-white font-semibold text-lg">Trabajadores</h2>
            <p className="text-gray-400 text-sm mt-1">Gestion de personal</p>
          </a>
        </div>
      </div>
    </div>
  )
}