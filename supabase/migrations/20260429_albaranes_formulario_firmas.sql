-- Albaranes: ficha rellenable + firmas empleado/cliente
-- Ejecutar en Supabase SQL Editor.

alter table public.albaranes
  add column if not exists razon_social text,
  add column if not exists cif text,
  add column if not exists domicilio text,
  add column if not exists localidad text,
  add column if not exists provincia text,
  add column if not exists telefono text,
  add column if not exists email text,
  add column if not exists responsable text,
  add column if not exists instalacion text,
  add column if not exists firma_empleado_url text,
  add column if not exists firma_cliente_url text,
  add column if not exists firmado_empleado_at timestamptz,
  add column if not exists firmado_cliente_at timestamptz;

create index if not exists idx_albaranes_orden_estado
  on public.albaranes (orden_id, estado);

create index if not exists idx_albaranes_firmado_cliente
  on public.albaranes (firmado, firmado_cliente_at desc);
