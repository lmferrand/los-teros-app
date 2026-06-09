-- Tabla de TAREAS para el planificador. Ejecutar en el SQL Editor de Supabase.

create table if not exists public.tareas (
  id          uuid primary key default gen_random_uuid(),
  titulo      text not null,
  descripcion text,
  fecha       date,
  prioridad   text default '2',        -- '1' baja | '2' media | '3' alta
  hecha       boolean not null default false,
  asignado_a  uuid,                    -- perfiles.id (sin FK estricta)
  cliente_id  uuid,
  orden_id    uuid,
  creado_por  uuid,
  created_at  timestamptz not null default now()
);

create index if not exists idx_tareas_fecha on public.tareas(fecha);
create index if not exists idx_tareas_hecha on public.tareas(hecha);

alter table public.tareas enable row level security;
drop policy if exists tareas_authenticated on public.tareas;
create policy tareas_authenticated on public.tareas
  for all to authenticated using (true) with check (true);
