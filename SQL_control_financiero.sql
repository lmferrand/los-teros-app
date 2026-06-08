-- ============================================================================
--  Los Teros — Control financiero
--  Ejecutar este script en el SQL Editor de Supabase (proyecto actual).
--  Crea las tablas `ventas` y `gastos`, su RLS, el bucket de documentos IA
--  y datos de ejemplo realistas (en euros) para probar.
--  Es idempotente: se puede ejecutar varias veces sin duplicar.
-- ============================================================================

-- ----------------------------- TABLA ventas ---------------------------------
create table if not exists public.ventas (
  id                          uuid primary key default gen_random_uuid(),
  numero                      text,
  -- Cliente (denormalizado en la venta). cliente_id es opcional para enlazar
  -- con la tabla `clientes` existente (sin FK estricta para evitar acoplamiento).
  cliente                     text,
  cliente_id                  uuid,
  empresa_local               text,
  contacto                    text,
  telefono                    text,
  email                       text,
  direccion                   text,

  tipo_trabajo                text,         -- limpieza|instalacion|reparacion|sustitucion_turbina|otro
  responsable                 text,
  estado                      text not null default 'presupuesto_aceptado',
  observaciones               text,

  -- Económico
  base_imponible              numeric(12,2),
  iva_porcentaje              numeric(5,2) default 21,
  iva_importe                 numeric(12,2),
  total_con_iva               numeric(12,2),
  importe_cobrado             numeric(12,2) default 0,
  fecha_cobro                 date,
  forma_cobro                 text,
  ref_bancaria                text,

  -- Fechas
  fecha_aceptacion            date,
  fecha_prevista_ejecucion    date,
  fecha_inicio_real           date,
  fecha_fin_real              date,
  fecha_prevista_facturacion  date,
  fecha_real_facturacion      date,
  numero_factura              text,

  -- Operativo (informativo)
  tecnicos                    text,
  horas_previstas             numeric(7,2),
  horas_reales                numeric(7,2),
  dias_previstos              numeric(6,2),
  dias_reales                 numeric(6,2),
  requiere_turbina            boolean default false,
  turbina_instalada           boolean default false,
  turbina_devuelta            boolean default false,

  creado_por                  uuid,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz
);

create index if not exists idx_ventas_estado      on public.ventas(estado);
create index if not exists idx_ventas_aceptacion   on public.ventas(fecha_aceptacion);

-- ----------------------------- TABLA gastos ---------------------------------
create table if not exists public.gastos (
  id                uuid primary key default gen_random_uuid(),
  venta_id          uuid not null references public.ventas(id) on delete cascade,
  fecha             date,
  categoria         text,   -- mano_obra|material|turbina|desplazamiento|dietas|subcontrata|software|compra_puntual|otro
  descripcion       text,
  proveedor         text,
  estimado_sin_iva  numeric(12,2),
  estimado_con_iva  numeric(12,2),
  iva_porcentaje    numeric(5,2) default 21,
  real_sin_iva      numeric(12,2),
  real_con_iva      numeric(12,2),
  pagado            boolean default false,
  observaciones     text,
  created_at        timestamptz not null default now()
);

create index if not exists idx_gastos_venta on public.gastos(venta_id);

-- -------------------------------- RLS ---------------------------------------
alter table public.ventas enable row level security;
alter table public.gastos enable row level security;

drop policy if exists ventas_authenticated on public.ventas;
create policy ventas_authenticated on public.ventas
  for all to authenticated using (true) with check (true);

drop policy if exists gastos_authenticated on public.gastos;
create policy gastos_authenticated on public.gastos
  for all to authenticated using (true) with check (true);

-- --------------------- Bucket de documentos para IA -------------------------
insert into storage.buckets (id, name, public)
values ('documentos-ia', 'documentos-ia', true)
on conflict (id) do nothing;

drop policy if exists docia_select on storage.objects;
create policy docia_select on storage.objects
  for select to authenticated using (bucket_id = 'documentos-ia');

drop policy if exists docia_insert on storage.objects;
create policy docia_insert on storage.objects
  for insert to authenticated with check (bucket_id = 'documentos-ia');

drop policy if exists docia_delete on storage.objects;
create policy docia_delete on storage.objects
  for delete to authenticated using (bucket_id = 'documentos-ia');

-- ============================================================================
--  DATOS DE EJEMPLO (idempotentes por id fijo)
--  Contexto: hoy es junio de 2026. Cubren todos los casos del prompt.
-- ============================================================================

insert into public.ventas
  (id, numero, cliente, empresa_local, contacto, telefono, email, direccion,
   tipo_trabajo, responsable, estado, observaciones,
   base_imponible, iva_porcentaje, iva_importe, total_con_iva,
   importe_cobrado, fecha_cobro, forma_cobro,
   fecha_aceptacion, fecha_prevista_ejecucion, fecha_inicio_real, fecha_fin_real,
   fecha_prevista_facturacion, fecha_real_facturacion, numero_factura,
   tecnicos, horas_previstas, horas_reales, dias_previstos, dias_reales,
   requiere_turbina, turbina_instalada, turbina_devuelta)
values
  -- V1 · Desfase: vendida y cobrada en mayo, se factura en julio
  ('11111111-0000-0000-0000-000000000001','P-2026-0142','Mercadona Logística','CD Sant Sadurní','Marta Ruiz','961112233','marta@mercadona.es','Pol. Ind. Sant Sadurní',
   'limpieza','Fede','cobrado_total','Limpieza integral campanas y conductos.',
   8200,21,1722,9922, 9922,'2026-05-20','Transferencia',
   '2026-05-08','2026-06-15',null,null,'2026-07-05',null,null,
   'Juan, Pedro',40,null,5,null,false,false,false),

  -- V2 · Cobrada al 100% pero NO programada (alerta)
  ('11111111-0000-0000-0000-000000000002','P-2026-0150','Bodegas Torres','Bodega Vilafranca','Jordi Pla','938901122','jordi@torres.es','Finca El Maset',
   'instalacion','Valentina','pendiente_programar','Pendiente de fijar fecha con cliente.',
   5400,21,1134,6534, 6534,'2026-05-28','Transferencia',
   '2026-05-22',null,null,null,null,null,null,
   null,32,null,4,null,false,false,false),

  -- V3 · Trabajo terminado, listo para facturar pero SIN facturar (alerta)
  ('11111111-0000-0000-0000-000000000003','P-2026-0131','Hospital General','Bloque quirúrgico','Ana Gómez','965334455','ana@hgeneral.es','Av. Pintor Baeza 12',
   'limpieza','Fede','listo_facturar','Trabajo cerrado, esperando emitir factura.',
   12000,21,2520,14520, 0,null,null,
   '2026-04-30','2026-05-12','2026-05-12','2026-05-16','2026-06-01',null,null,
   'Juan, Pedro, Luis',80,82,10,10,false,false,false),

  -- V4 · Margen bajo (<30%) → alerta roja
  ('11111111-0000-0000-0000-000000000004','P-2026-0155','Aldi Supermercados','Tienda Alicante 3','Sergio Vidal','965667788','sergio@aldi.es','C/ Garbinet 4',
   'reparacion','Fede','programado','Reparación de extracción cocina.',
   3000,21,630,3630, 0,null,null,
   '2026-05-30','2026-06-20',null,null,'2026-06-30',null,null,
   'Pedro',16,null,2,null,false,false,false),

  -- V5 · Sobrecoste: gastos reales > previstos (y margen real bajo)
  ('11111111-0000-0000-0000-000000000005','P-2026-0120','Leroy Merlin','Centro Murcia','Nuria Cano','968223344','nuria@leroy.es','Av. Juan Carlos I',
   'instalacion','Valentina','trabajo_terminado','Complicaciones en obra, más horas de las previstas.',
   9500,21,1995,11495, 5747,'2026-05-31','Transferencia',
   '2026-04-18','2026-05-05','2026-05-05','2026-05-14','2026-06-10',null,null,
   'Juan, Luis',60,84,8,11,false,false,false),

  -- V6 · Turbina instalada pendiente de devolver (alerta) + pendiente de cierre
  ('11111111-0000-0000-0000-000000000006','P-2026-0160','Cárnicas del Sur','Planta Orihuela','Paco Soler','966112299','paco@carnicas.es','Pol. Puente Alto',
   'sustitucion_turbina','Fede','pendiente_cierre','Turbina de sustitución colocada; falta devolver la retirada.',
   6800,21,1428,8228, 8228,'2026-05-30','Confirming',
   '2026-05-15','2026-05-26','2026-05-26','2026-05-27','2026-06-15',null,null,
   'Juan',24,26,3,3,true,true,false),

  -- V7 · Facturada en junio (sano, margen alto)
  ('11111111-0000-0000-0000-000000000007','P-2026-0110','Decathlon','Tienda Elche','Laura Mas','966778899','laura@decathlon.es','C/ Aspe 20',
   'limpieza','Valentina','facturado','Servicio mensual.',
   4200,21,882,5082, 5082,'2026-06-04','Transferencia',
   '2026-04-10','2026-05-02','2026-05-02','2026-05-03','2026-06-01','2026-06-03','F-2026-0301',
   'Pedro',12,12,1.5,1.5,false,false,false),

  -- V8 · En ejecución, cobro parcial, se factura en julio (desfase, margen correcto)
  ('11111111-0000-0000-0000-000000000008','P-2026-0165','IKEA','Centro logístico Valencia','Erik Holm','961445566','erik@ikea.es','CD Riba-roja',
   'instalacion','Fede','en_ejecucion','Instalación nueva línea de extracción.',
   15000,21,3150,18150, 9075,'2026-06-02','Transferencia',
   '2026-05-25','2026-06-05','2026-06-05',null,'2026-07-10',null,null,
   'Juan, Pedro, Luis',100,40,12,5,false,false,false)
on conflict (id) do nothing;

-- ------------------------------- Gastos -------------------------------------
insert into public.gastos
  (id, venta_id, fecha, categoria, descripcion, proveedor,
   estimado_sin_iva, estimado_con_iva, iva_porcentaje, real_sin_iva, real_con_iva, pagado)
values
  -- V1
  ('22222222-0000-0000-0000-000000000001','11111111-0000-0000-0000-000000000001','2026-05-08','mano_obra','5 jornadas equipo',null, 3000, 3000*1.21,21, null,null,false),
  ('22222222-0000-0000-0000-000000000002','11111111-0000-0000-0000-000000000001','2026-05-08','material','Desengrasante y consumibles','Quimxel', 800, 800*1.21,21, null,null,false),
  -- V2
  ('22222222-0000-0000-0000-000000000003','11111111-0000-0000-0000-000000000002','2026-05-22','material','Conductos y rejillas','Suminco', 2200, 2200*1.21,21, null,null,false),
  ('22222222-0000-0000-0000-000000000004','11111111-0000-0000-0000-000000000002','2026-05-22','mano_obra','4 jornadas',null, 1500, 1500*1.21,21, null,null,false),
  -- V3
  ('22222222-0000-0000-0000-000000000005','11111111-0000-0000-0000-000000000003','2026-05-16','mano_obra','10 jornadas equipo',null, 5000, 5000*1.21,21, 5200, 5200*1.21,true),
  ('22222222-0000-0000-0000-000000000006','11111111-0000-0000-0000-000000000003','2026-05-16','material','Productos especiales hospital','Quimxel', 1200, 1200*1.21,21, 1300, 1300*1.21,true),
  ('22222222-0000-0000-0000-000000000007','11111111-0000-0000-0000-000000000003','2026-05-16','desplazamiento','Combustible furgonetas',null, 300, 300*1.21,21, 300, 300*1.21,true),
  -- V4 (margen bajo)
  ('22222222-0000-0000-0000-000000000008','11111111-0000-0000-0000-000000000004','2026-05-30','mano_obra','2 jornadas',null, 1800, 1800*1.21,21, null,null,false),
  ('22222222-0000-0000-0000-000000000009','11111111-0000-0000-0000-000000000004','2026-05-30','material','Recambios motor','Soler Palau', 600, 600*1.21,21, null,null,false),
  ('22222222-0000-0000-0000-000000000010','11111111-0000-0000-0000-000000000004','2026-05-30','subcontrata','Grúa acceso cubierta','Gruas Levante', 200, 200*1.21,21, null,null,false),
  -- V5 (sobrecoste)
  ('22222222-0000-0000-0000-000000000011','11111111-0000-0000-0000-000000000005','2026-05-14','mano_obra','Horas previstas vs reales',null, 4000, 4000*1.21,21, 5200, 5200*1.21,true),
  ('22222222-0000-0000-0000-000000000012','11111111-0000-0000-0000-000000000005','2026-05-14','material','Material adicional imprevisto','Suminco', 1500, 1500*1.21,21, 2100, 2100*1.21,true),
  -- V6 (turbina)
  ('22222222-0000-0000-0000-000000000013','11111111-0000-0000-0000-000000000006','2026-05-27','turbina','Turbina de sustitución','Soler Palau', 2500, 2500*1.21,21, 2500, 2500*1.21,true),
  ('22222222-0000-0000-0000-000000000014','11111111-0000-0000-0000-000000000006','2026-05-27','mano_obra','3 jornadas',null, 900, 900*1.21,21, 1000, 1000*1.21,true),
  -- V7 (facturada, sano)
  ('22222222-0000-0000-0000-000000000015','11111111-0000-0000-0000-000000000007','2026-05-03','mano_obra','Servicio mensual',null, 1200, 1200*1.21,21, 1200, 1200*1.21,true),
  ('22222222-0000-0000-0000-000000000016','11111111-0000-0000-0000-000000000007','2026-05-03','material','Consumibles',null, 300, 300*1.21,21, 280, 280*1.21,true),
  -- V8 (en ejecución, parcial)
  ('22222222-0000-0000-0000-000000000017','11111111-0000-0000-0000-000000000008','2026-06-05','mano_obra','Mano de obra instalación',null, 5000, 5000*1.21,21, 2500, 2500*1.21,false),
  ('22222222-0000-0000-0000-000000000018','11111111-0000-0000-0000-000000000008','2026-06-05','material','Línea de extracción','Soler Palau', 3000, 3000*1.21,21, 1500, 1500*1.21,false)
on conflict (id) do nothing;

-- Fin del script.
