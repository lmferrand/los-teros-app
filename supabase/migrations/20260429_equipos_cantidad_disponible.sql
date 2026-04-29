-- Cantidad disponible por equipo en inventario.

alter table public.equipos
  add column if not exists cantidad_disponible integer not null default 1;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'equipos_cantidad_disponible_nonnegative'
  ) then
    alter table public.equipos
      add constraint equipos_cantidad_disponible_nonnegative
      check (cantidad_disponible >= 0);
  end if;
end
$$;
