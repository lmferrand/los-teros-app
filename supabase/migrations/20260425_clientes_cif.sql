-- Campo CIF para clientes
-- Ejecutar una sola vez en Supabase SQL Editor.

alter table public.clientes
  add column if not exists cif text;

create index if not exists clientes_cif_idx
  on public.clientes(cif);
