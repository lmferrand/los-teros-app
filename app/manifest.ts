import type { MetadataRoute } from 'next'

// Manifest PWA: define cómo se ve la app al "añadir a pantalla de inicio".
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Los Teros — Control financiero',
    short_name: 'Los Teros',
    description: 'Control de ventas, cobros, facturación, IVA, márgenes e inventario.',
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
