# Los Teros — Control financiero

App interna de **control financiero** para Extracciones Teros (limpieza,
instalaciones y mantenimiento). Gestiona presupuestos aceptados como ventas y
controla **cobros, ejecución, facturación, IVA y márgenes**, para ver de un
vistazo el desfase entre lo vendido, lo ejecutado y lo facturado.

- **Producción:** https://app.extraccionesteros.es
- **Stack:** Next.js 16 (App Router) · TypeScript · Tailwind v4 · Supabase · Vercel

## Puesta en marcha

```bash
npm install
npm run dev          # http://localhost:3000
npm run build        # build + type-check (debe quedar verde antes de push)
```

Variables en `.env.local`: `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY` (y en Vercel además `SUPABASE_SERVICE_ROLE_KEY`,
`GROQ_API_KEY`).

## Base de datos

Ejecuta **`SQL_control_financiero.sql`** en el SQL Editor de Supabase: crea las
tablas `ventas` y `gastos`, sus políticas RLS, el bucket `documentos-ia` y unos
datos de ejemplo realistas para probar.

## Estructura

- `app/dashboard` — KPIs del mes y avisos.
- `app/presupuestos` — lista con filtros, formulario y ficha (IVA, cronología,
  márgenes, gastos).
- `app/facturacion` — pivote por mes (venta/cobro/ejecución/facturación).
- `app/margenes`, `app/alertas` — análisis de márgenes y avisos.
- `app/documentos` — extracción de datos de documentos con IA (simulada en v1).
- `lib/` — `tipos`, `dominio`, `calculos`, `agregados`, `db/`, `ia/`.

## Despliegue

Push a `main` despliega en Vercel sobre `app.extraccionesteros.es`. Flujo:
`npm run build` verde → commit (`tipo(ámbito): resumen`) → push.

> El código operativo anterior (clientes/órdenes/inventario) está archivado en la
> rama `respaldo/operativa-v1` y el tag `v1-operativa`.
