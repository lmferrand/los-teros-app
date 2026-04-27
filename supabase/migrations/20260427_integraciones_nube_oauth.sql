-- Integraciones OAuth por usuario para respaldos en Dropbox / Google Drive
-- Ejecutar en Supabase SQL Editor.

create table if not exists public.integraciones_nube (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.perfiles(id) on delete cascade,
  proveedor text not null check (proveedor in ('dropbox', 'google_drive')),
  access_token text not null,
  refresh_token text,
  scope text,
  token_type text,
  expires_at timestamptz,
  account_email text,
  account_name text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, proveedor)
);

create index if not exists idx_integraciones_nube_user
  on public.integraciones_nube (user_id);

create index if not exists idx_integraciones_nube_proveedor
  on public.integraciones_nube (proveedor);

create or replace function public.touch_integraciones_nube_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_integraciones_nube_updated_at on public.integraciones_nube;
create trigger trg_integraciones_nube_updated_at
before update on public.integraciones_nube
for each row
execute function public.touch_integraciones_nube_updated_at();

alter table public.integraciones_nube enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'integraciones_nube'
      and policyname = 'integraciones_nube_select_owner'
  ) then
    create policy "integraciones_nube_select_owner"
      on public.integraciones_nube
      for select
      to public
      using (auth.uid() = user_id);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'integraciones_nube'
      and policyname = 'integraciones_nube_insert_owner'
  ) then
    create policy "integraciones_nube_insert_owner"
      on public.integraciones_nube
      for insert
      to public
      with check (auth.uid() = user_id);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'integraciones_nube'
      and policyname = 'integraciones_nube_update_owner'
  ) then
    create policy "integraciones_nube_update_owner"
      on public.integraciones_nube
      for update
      to public
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'integraciones_nube'
      and policyname = 'integraciones_nube_delete_owner'
  ) then
    create policy "integraciones_nube_delete_owner"
      on public.integraciones_nube
      for delete
      to public
      using (auth.uid() = user_id);
  end if;
end
$$;

