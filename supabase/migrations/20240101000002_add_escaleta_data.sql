ALTER TABLE public.proyectos_cineasta ADD COLUMN IF NOT EXISTS escaleta_data JSONB DEFAULT '[]'::jsonb;
