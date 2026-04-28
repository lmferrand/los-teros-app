-- Flota: control de revisiones por kilometraje
-- Ejecutar en Supabase SQL Editor.

alter table public.vehiculos_flota
  add column if not exists ultima_revision_fecha date,
  add column if not exists km_ultima_revision numeric,
  add column if not exists proxima_revision_km numeric;

create index if not exists idx_vehiculos_flota_proxima_revision_km
  on public.vehiculos_flota (proxima_revision_km);

