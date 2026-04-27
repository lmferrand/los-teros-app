alter table public.clientes
  add column if not exists movil text;

create index if not exists idx_clientes_movil
  on public.clientes (movil);
