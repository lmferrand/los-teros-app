-- Ejecutar SOLO si al subir fotos/firmas de un albarán da error de bucket.
-- Crea el bucket fotos-albaranes (fotos y firmas) y sus políticas. Idempotente.

insert into storage.buckets (id, name, public)
values ('fotos-albaranes', 'fotos-albaranes', true)
on conflict (id) do nothing;

drop policy if exists alb_select on storage.objects;
create policy alb_select on storage.objects
  for select to authenticated using (bucket_id = 'fotos-albaranes');

drop policy if exists alb_insert on storage.objects;
create policy alb_insert on storage.objects
  for insert to authenticated with check (bucket_id = 'fotos-albaranes');

drop policy if exists alb_delete on storage.objects;
create policy alb_delete on storage.objects
  for delete to authenticated using (bucket_id = 'fotos-albaranes');
