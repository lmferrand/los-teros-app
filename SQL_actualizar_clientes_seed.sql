-- Cambia los 8 PRESUPUESTOS DE EJEMPLO (clientes ficticios) por clientes REALES
-- de tu tabla `clientes`. Conserva importes, fechas y estados; solo cambia el
-- cliente y copia sus datos de contacto. Ejecutar en el SQL Editor de Supabase.

with seeds as (
  select id, row_number() over (order by numero) as rn
  from public.ventas
  where id in (
    '11111111-0000-0000-0000-000000000001',
    '11111111-0000-0000-0000-000000000002',
    '11111111-0000-0000-0000-000000000003',
    '11111111-0000-0000-0000-000000000004',
    '11111111-0000-0000-0000-000000000005',
    '11111111-0000-0000-0000-000000000006',
    '11111111-0000-0000-0000-000000000007',
    '11111111-0000-0000-0000-000000000008'
  )
),
cli as (
  -- 8 clientes reales al azar (con nombre y CIF para que sean "de verdad").
  select id, nombre, telefono, movil, email, direccion, poblacion,
         row_number() over (order by random()) as rn
  from public.clientes
  where nombre is not null and coalesce(cif, '') <> ''
  limit 8
)
update public.ventas v
set cliente       = cli.nombre,
    cliente_id    = cli.id,
    empresa_local = cli.poblacion,
    contacto      = null,
    telefono      = coalesce(cli.telefono, cli.movil),
    email         = cli.email,
    direccion     = cli.direccion
from seeds
join cli on cli.rn = seeds.rn
where v.id = seeds.id;

-- Comprobar el resultado:
-- select numero, cliente, cliente_id from public.ventas
-- where id like '11111111-0000-0000-0000-0000000000%' order by numero;
