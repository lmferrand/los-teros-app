alter table public.clientes
  add column if not exists tipo_cliente text not null default 'teros';

update public.clientes
set tipo_cliente = 'teros'
where tipo_cliente is null or btrim(tipo_cliente) = '';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'clientes_tipo_cliente_check'
  ) then
    alter table public.clientes
      add constraint clientes_tipo_cliente_check
      check (tipo_cliente in ('teros', 'olipro'));
  end if;
end
$$;

create index if not exists idx_clientes_tipo_cliente
  on public.clientes (tipo_cliente);
