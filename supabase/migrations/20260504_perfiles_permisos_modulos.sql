-- Permisos por módulo para cada perfil.
-- Permite dar acceso granular desde el módulo Trabajadores.

alter table public.perfiles
  add column if not exists permisos_modulos jsonb not null default '{}'::jsonb;

