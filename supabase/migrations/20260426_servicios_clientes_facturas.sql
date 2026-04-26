create table if not exists public.servicios_clientes (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  fecha_servicio date not null,
  origen text not null default 'factura_importada',
  numero_documento text,
  descripcion text,
  importe numeric not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.perfiles(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_servicios_clientes_cliente_fecha
  on public.servicios_clientes (cliente_id, fecha_servicio desc);

create index if not exists idx_servicios_clientes_fecha
  on public.servicios_clientes (fecha_servicio desc);

alter table public.servicios_clientes enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'servicios_clientes'
      and policyname = 'servicios_clientes autenticados all'
  ) then
    create policy "servicios_clientes autenticados all"
      on public.servicios_clientes
      for all
      to public
      using (auth.role() = 'authenticated')
      with check (auth.role() = 'authenticated');
  end if;
end
$$;
