-- Integridad OT <-> Inventario/Movimientos
-- Ejecutar en Supabase SQL Editor una sola vez.

alter table public.movimientos
  add column if not exists event_key text;

create unique index if not exists movimientos_event_key_uq
  on public.movimientos(event_key)
  where event_key is not null;

create index if not exists movimientos_orden_id_idx
  on public.movimientos(orden_id);

create or replace function public.registrar_consumo_material_ot(
  p_material_id uuid,
  p_cantidad numeric,
  p_tecnico_id uuid default null,
  p_orden_id uuid default null,
  p_observaciones text default null,
  p_event_key text default null
)
returns table (
  movimiento_id uuid,
  stock_actual numeric
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_stock numeric;
begin
  if auth.role() <> 'authenticated' then
    raise exception 'No autorizado';
  end if;

  if p_cantidad is null or p_cantidad <= 0 then
    raise exception 'La cantidad debe ser mayor que 0';
  end if;

  select coalesce(stock, 0)
    into v_stock
  from public.materiales
  where id = p_material_id
  for update;

  if not found then
    raise exception 'Material no encontrado';
  end if;

  if v_stock < p_cantidad then
    raise exception 'Stock insuficiente';
  end if;

  stock_actual := v_stock - p_cantidad;

  update public.materiales
  set stock = stock_actual
  where id = p_material_id;

  insert into public.movimientos(
    tipo,
    material_id,
    orden_id,
    tecnico_id,
    cantidad,
    observaciones,
    fecha,
    event_key
  )
  values (
    'consumo',
    p_material_id,
    p_orden_id,
    p_tecnico_id,
    p_cantidad,
    p_observaciones,
    now(),
    p_event_key
  )
  returning id into movimiento_id;

  return next;
exception
  when unique_violation then
    if p_event_key is not null then
      select id into movimiento_id
      from public.movimientos
      where event_key = p_event_key
      limit 1;

      select coalesce(stock, 0) into stock_actual
      from public.materiales
      where id = p_material_id;

      return next;
    end if;
    raise;
end;
$$;

create or replace function public.registrar_salida_equipo_ot(
  p_equipo_id uuid,
  p_tecnico_id uuid default null,
  p_orden_id uuid default null,
  p_observaciones text default null,
  p_event_key text default null
)
returns table (
  movimiento_id uuid
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_estado text;
begin
  if auth.role() <> 'authenticated' then
    raise exception 'No autorizado';
  end if;

  select estado
    into v_estado
  from public.equipos
  where id = p_equipo_id
  for update;

  if not found then
    raise exception 'Equipo no encontrado';
  end if;

  if coalesce(v_estado, 'disponible') <> 'disponible' then
    raise exception 'Equipo no disponible';
  end if;

  update public.equipos
  set estado = 'en_cliente',
      fecha_salida = now()
  where id = p_equipo_id;

  insert into public.movimientos(
    tipo,
    equipo_id,
    orden_id,
    tecnico_id,
    cantidad,
    estado_equipo,
    observaciones,
    fecha,
    event_key
  )
  values (
    'salida',
    p_equipo_id,
    p_orden_id,
    p_tecnico_id,
    1,
    'en_cliente',
    p_observaciones,
    now(),
    p_event_key
  )
  returning id into movimiento_id;

  return next;
exception
  when unique_violation then
    if p_event_key is not null then
      select id into movimiento_id
      from public.movimientos
      where event_key = p_event_key
      limit 1;
      return next;
    end if;
    raise;
end;
$$;

create or replace function public.eliminar_movimiento_con_integridad(
  p_movimiento_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_mov public.movimientos%rowtype;
  v_tipo_ultimo text;
begin
  if auth.role() <> 'authenticated' then
    raise exception 'No autorizado';
  end if;

  select *
    into v_mov
  from public.movimientos
  where id = p_movimiento_id
  for update;

  if not found then
    raise exception 'Movimiento no encontrado';
  end if;

  if v_mov.tipo = 'consumo'
     and v_mov.material_id is not null
     and coalesce(v_mov.cantidad, 0) > 0 then
    update public.materiales
    set stock = coalesce(stock, 0) + coalesce(v_mov.cantidad, 0)
    where id = v_mov.material_id;
  end if;

  delete from public.movimientos
  where id = p_movimiento_id;

  if v_mov.equipo_id is not null then
    select tipo
      into v_tipo_ultimo
    from public.movimientos
    where equipo_id = v_mov.equipo_id
    order by fecha desc nulls last
    limit 1;

    if v_tipo_ultimo = 'salida' then
      update public.equipos
      set estado = 'en_cliente'
      where id = v_mov.equipo_id;
    else
      update public.equipos
      set estado = 'disponible',
          fecha_salida = null
      where id = v_mov.equipo_id;
    end if;
  end if;

  return jsonb_build_object(
    'movimiento_id', p_movimiento_id,
    'tipo', v_mov.tipo
  );
end;
$$;

create or replace function public.eliminar_orden_con_integridad(
  p_orden_id uuid
)
returns table (
  orden_id uuid,
  stock_restaurado numeric,
  movimientos_eliminados integer,
  fotos_eliminadas integer,
  albaranes_eliminados integer
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_stock_restaurado numeric := 0;
  v_equipos uuid[];
  v_equipo uuid;
  v_tipo_ultimo text;
begin
  if auth.role() <> 'authenticated' then
    raise exception 'No autorizado';
  end if;

  perform 1
  from public.ordenes
  where id = p_orden_id
  for update;

  if not found then
    raise exception 'OT no encontrada';
  end if;

  with consumos as (
    select material_id, sum(coalesce(cantidad, 0)) as cantidad_total
    from public.movimientos
    where orden_id = p_orden_id
      and tipo = 'consumo'
      and material_id is not null
    group by material_id
  )
  update public.materiales m
  set stock = coalesce(m.stock, 0) + c.cantidad_total
  from consumos c
  where m.id = c.material_id;

  select coalesce(sum(coalesce(cantidad, 0)), 0)
    into v_stock_restaurado
  from public.movimientos
  where orden_id = p_orden_id
    and tipo = 'consumo'
    and material_id is not null;

  select coalesce(array_agg(distinct equipo_id), '{}')
    into v_equipos
  from public.movimientos
  where orden_id = p_orden_id
    and equipo_id is not null;

  select count(*)::int into movimientos_eliminados
  from public.movimientos
  where orden_id = p_orden_id;

  select count(*)::int into fotos_eliminadas
  from public.fotos_ordenes
  where orden_id = p_orden_id;

  select count(*)::int into albaranes_eliminados
  from public.albaranes
  where orden_id = p_orden_id;

  delete from public.movimientos
  where orden_id = p_orden_id;

  if array_length(v_equipos, 1) is not null then
    foreach v_equipo in array v_equipos loop
      select tipo
        into v_tipo_ultimo
      from public.movimientos
      where equipo_id = v_equipo
      order by fecha desc nulls last
      limit 1;

      if v_tipo_ultimo = 'salida' then
        update public.equipos
        set estado = 'en_cliente'
        where id = v_equipo;
      else
        update public.equipos
        set estado = 'disponible',
            fecha_salida = null
        where id = v_equipo;
      end if;
    end loop;
  end if;

  delete from public.fotos_ordenes
  where orden_id = p_orden_id;

  delete from public.albaranes
  where orden_id = p_orden_id;

  delete from public.ordenes
  where id = p_orden_id;

  orden_id := p_orden_id;
  stock_restaurado := v_stock_restaurado;
  return next;
end;
$$;

grant execute on function public.registrar_consumo_material_ot(uuid, numeric, uuid, uuid, text, text) to authenticated;
grant execute on function public.registrar_salida_equipo_ot(uuid, uuid, uuid, text, text) to authenticated;
grant execute on function public.eliminar_movimiento_con_integridad(uuid) to authenticated;
grant execute on function public.eliminar_orden_con_integridad(uuid) to authenticated;
