-- Modulo Flota de Vehiculos + documentos y vencimientos
-- Ejecutar en Supabase SQL Editor.

create table if not exists public.vehiculos_flota (
  id uuid primary key default gen_random_uuid(),
  matricula text not null unique,
  alias text,
  marca text,
  modelo text,
  tipo text default 'furgon',
  combustible text,
  anio integer,
  km_actual numeric default 0,
  proxima_itv date,
  vencimiento_itc date,
  vencimiento_seguro date,
  vencimiento_impuesto date,
  compania_seguro text,
  numero_poliza text,
  notas text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.touch_vehiculos_flota_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_vehiculos_flota_updated_at on public.vehiculos_flota;
create trigger trg_vehiculos_flota_updated_at
before update on public.vehiculos_flota
for each row
execute function public.touch_vehiculos_flota_updated_at();

create table if not exists public.vehiculos_documentos (
  id uuid primary key default gen_random_uuid(),
  vehiculo_id uuid not null references public.vehiculos_flota(id) on delete cascade,
  tipo text not null default 'otro',
  nombre_archivo text not null,
  mime_type text,
  url text not null,
  fecha_emision date,
  fecha_caducidad date,
  proveedor text,
  numero_documento text,
  metadata jsonb not null default '{}'::jsonb,
  analisis_ia jsonb not null default '{}'::jsonb,
  created_by uuid references public.perfiles(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_vehiculos_flota_activo
  on public.vehiculos_flota (activo);

create index if not exists idx_vehiculos_flota_vencimientos
  on public.vehiculos_flota (proxima_itv, vencimiento_itc, vencimiento_seguro, vencimiento_impuesto);

create index if not exists idx_vehiculos_documentos_vehiculo_created
  on public.vehiculos_documentos (vehiculo_id, created_at desc);

create index if not exists idx_vehiculos_documentos_caducidad
  on public.vehiculos_documentos (fecha_caducidad);

alter table public.vehiculos_flota enable row level security;
alter table public.vehiculos_documentos enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'vehiculos_flota'
      and policyname = 'vehiculos_flota autenticados all'
  ) then
    create policy "vehiculos_flota autenticados all"
      on public.vehiculos_flota
      for all
      to public
      using (auth.role() = 'authenticated')
      with check (auth.role() = 'authenticated');
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'vehiculos_documentos'
      and policyname = 'vehiculos_documentos autenticados all'
  ) then
    create policy "vehiculos_documentos autenticados all"
      on public.vehiculos_documentos
      for all
      to public
      using (auth.role() = 'authenticated')
      with check (auth.role() = 'authenticated');
  end if;
end
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'vehiculos-documentos',
  'vehiculos-documentos',
  true,
  20971520,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']::text[]
)
on conflict (id) do update
set public = excluded.public;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'vehiculos_documentos_select_public'
  ) then
    create policy "vehiculos_documentos_select_public"
      on storage.objects
      for select
      to public
      using (bucket_id = 'vehiculos-documentos');
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'vehiculos_documentos_insert_auth'
  ) then
    create policy "vehiculos_documentos_insert_auth"
      on storage.objects
      for insert
      to public
      with check (bucket_id = 'vehiculos-documentos' and auth.role() = 'authenticated');
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'vehiculos_documentos_update_auth'
  ) then
    create policy "vehiculos_documentos_update_auth"
      on storage.objects
      for update
      to public
      using (bucket_id = 'vehiculos-documentos' and auth.role() = 'authenticated')
      with check (bucket_id = 'vehiculos-documentos' and auth.role() = 'authenticated');
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'vehiculos_documentos_delete_auth'
  ) then
    create policy "vehiculos_documentos_delete_auth"
      on storage.objects
      for delete
      to public
      using (bucket_id = 'vehiculos-documentos' and auth.role() = 'authenticated');
  end if;
end
$$;

alter table public.ordenes
  add column if not exists vehiculo_id uuid,
  add column if not exists tecnico_vehiculo_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'ordenes_vehiculo_id_fkey'
  ) then
    alter table public.ordenes
      add constraint ordenes_vehiculo_id_fkey
      foreign key (vehiculo_id)
      references public.vehiculos_flota(id);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'ordenes_tecnico_vehiculo_id_fkey'
  ) then
    alter table public.ordenes
      add constraint ordenes_tecnico_vehiculo_id_fkey
      foreign key (tecnico_vehiculo_id)
      references public.perfiles(id);
  end if;
end
$$;

create index if not exists idx_ordenes_vehiculo
  on public.ordenes (vehiculo_id);

create index if not exists idx_ordenes_tecnico_vehiculo
  on public.ordenes (tecnico_vehiculo_id);
