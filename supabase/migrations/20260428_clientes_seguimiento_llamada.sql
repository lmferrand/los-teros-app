alter table public.clientes
  add column if not exists seguimiento_llamada_ok boolean not null default false,
  add column if not exists seguimiento_llamada_at timestamptz;

