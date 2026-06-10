-- Vincula una OT con un presupuesto (venta), para que los gastos añadidos en la
-- OT cuenten en el margen de ese presupuesto. Ejecutar en el SQL Editor de Supabase.

alter table public.ordenes add column if not exists venta_id uuid;
create index if not exists idx_ordenes_venta on public.ordenes(venta_id);
