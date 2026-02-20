alter table public.arttab add column if not exists etiquetas jsonb default '[]'::jsonb;
