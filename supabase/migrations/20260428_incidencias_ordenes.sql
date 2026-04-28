-- Incidencias de OT con audio + foto
-- Ejecutar en Supabase SQL Editor.

create table if not exists public.incidencias_ordenes (
  id uuid primary key default gen_random_uuid(),
  orden_id uuid not null references public.ordenes(id) on delete cascade,
  tecnico_id uuid references public.perfiles(id),
  estado_orden text,
  descripcion text,
  audio_url text not null,
  foto_url text,
  created_at timestamptz not null default now()
);

create index if not exists idx_incidencias_ordenes_orden_created
  on public.incidencias_ordenes (orden_id, created_at desc);

create index if not exists idx_incidencias_ordenes_tecnico
  on public.incidencias_ordenes (tecnico_id, created_at desc);

alter table public.incidencias_ordenes enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'incidencias_ordenes'
      and policyname = 'incidencias_ordenes_auth_all'
  ) then
    create policy "incidencias_ordenes_auth_all"
      on public.incidencias_ordenes
      for all
      to public
      using (auth.role() = 'authenticated')
      with check (auth.role() = 'authenticated');
  end if;
end
$$;

