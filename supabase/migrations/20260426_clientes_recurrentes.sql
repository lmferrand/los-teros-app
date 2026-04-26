alter table public.clientes
  add column if not exists es_recurrente boolean not null default false,
  add column if not exists frecuencia_recurrencia text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'clientes_frecuencia_recurrencia_check'
  ) then
    alter table public.clientes
      add constraint clientes_frecuencia_recurrencia_check
      check (
        frecuencia_recurrencia is null
        or frecuencia_recurrencia in ('15_dias', 'mensual', 'trimestral', 'anual')
      );
  end if;
end
$$;

update public.clientes
set frecuencia_recurrencia = null
where es_recurrente = false
  and frecuencia_recurrencia is not null;

create index if not exists idx_clientes_recurrentes
  on public.clientes (es_recurrente, frecuencia_recurrencia);
