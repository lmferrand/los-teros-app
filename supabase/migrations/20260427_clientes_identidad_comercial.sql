alter table public.clientes
  add column if not exists nombre_comercial text,
  add column if not exists nombre_fiscal text,
  add column if not exists poblacion text;

update public.clientes
set nombre_comercial = coalesce(nullif(btrim(nombre_comercial), ''), nombre)
where nombre_comercial is null or btrim(nombre_comercial) = '';

create index if not exists idx_clientes_nombre_comercial_lower
  on public.clientes (lower(nombre_comercial));

create index if not exists idx_clientes_nombre_fiscal_lower
  on public.clientes (lower(nombre_fiscal));

create index if not exists idx_clientes_poblacion_lower
  on public.clientes (lower(poblacion));
