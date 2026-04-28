-- Trazabilidad de sugerencias de planificacion (determinista + IA)
-- Ejecutar en Supabase SQL Editor.

create table if not exists public.planificacion_sugerencias (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('dia', 'semana', 'mes')),
  fecha_base date not null,
  rango_desde date not null,
  rango_hasta date not null,
  status text not null default 'generated' check (status in ('generated', 'applied', 'applied_partial', 'rejected')),
  input_payload jsonb not null default '{}'::jsonb,
  deterministic_payload jsonb not null default '{}'::jsonb,
  ai_payload jsonb not null default '{}'::jsonb,
  final_payload jsonb not null default '{}'::jsonb,
  applied_changes jsonb not null default '[]'::jsonb,
  ai_error text,
  created_by uuid references public.perfiles(id),
  created_at timestamptz not null default now(),
  applied_at timestamptz,
  rejected_at timestamptz
);

create index if not exists idx_planif_sugerencias_created
  on public.planificacion_sugerencias (created_at desc);

create index if not exists idx_planif_sugerencias_scope_fecha
  on public.planificacion_sugerencias (scope, fecha_base desc);

create index if not exists idx_planif_sugerencias_status
  on public.planificacion_sugerencias (status);

alter table public.planificacion_sugerencias enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'planificacion_sugerencias'
      and policyname = 'planificacion_sugerencias_auth_all'
  ) then
    create policy "planificacion_sugerencias_auth_all"
      on public.planificacion_sugerencias
      for all
      to public
      using (auth.role() = 'authenticated')
      with check (auth.role() = 'authenticated');
  end if;
end
$$;

