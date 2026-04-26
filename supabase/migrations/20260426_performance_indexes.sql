-- Mejora de rendimiento para consultas frecuentes de la app.
-- Seguro para ejecutar varias veces.

create index if not exists idx_ordenes_estado_fecha_programada
  on public.ordenes (estado, fecha_programada);

create index if not exists idx_ordenes_tecnico_estado
  on public.ordenes (tecnico_id, estado);

create index if not exists idx_ordenes_cliente_estado
  on public.ordenes (cliente_id, estado);

create index if not exists idx_ordenes_tecnicos_ids_gin
  on public.ordenes using gin (tecnicos_ids);

create index if not exists idx_movimientos_material_fecha
  on public.movimientos (material_id, fecha desc);

create index if not exists idx_movimientos_tecnico_fecha
  on public.movimientos (tecnico_id, fecha desc);

create index if not exists idx_movimientos_equipo_fecha
  on public.movimientos (equipo_id, fecha desc);

create index if not exists idx_fotos_ordenes_orden_created
  on public.fotos_ordenes (orden_id, created_at desc);

create index if not exists idx_clientes_nombre_lower
  on public.clientes (lower(nombre));

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'clientes'
      and column_name = 'cif'
  ) then
    execute 'create index if not exists idx_clientes_cif on public.clientes (cif)';
  end if;
end
$$;

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'servicios_clientes'
  ) then
    execute 'create index if not exists idx_servicios_clientes_origen_fecha on public.servicios_clientes (origen, fecha_servicio desc)';
    execute 'create index if not exists idx_servicios_clientes_created_at on public.servicios_clientes (created_at desc)';
  end if;
end
$$;
