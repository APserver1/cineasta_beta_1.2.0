ALTER TABLE public.proyectos_cineasta ADD COLUMN IF NOT EXISTS last_state JSONB DEFAULT '{}'::jsonb;
