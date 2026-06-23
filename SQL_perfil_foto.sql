-- Foto de perfil de los trabajadores. Ejecutar en el SQL Editor de Supabase.
alter table public.perfiles add column if not exists foto_url text;
