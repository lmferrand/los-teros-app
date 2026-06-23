-- Plazo de cobro por presupuesto. Ejecutar en el SQL Editor de Supabase.
alter table public.ventas add column if not exists fecha_limite_cobro date;
