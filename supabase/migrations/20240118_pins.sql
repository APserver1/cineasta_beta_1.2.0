alter table public.proyectos_cineasta
add column if not exists pins_data jsonb not null default '{"pins":[]}'::jsonb;

