import type { MetadataRoute } from 'next'

// Manifest PWA: define cómo se ve la app al "añadir a pantalla de inicio".
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Los Teros — Gestión',
    short_name: 'Los Teros',
    description: 'Gestión integral de la empresa: financiero, clientes, órdenes, inventario y más.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f5f7fa',
    theme_color: '#0ea5e9',
    icons: [
      { src: '/icono-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icono-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icono-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
