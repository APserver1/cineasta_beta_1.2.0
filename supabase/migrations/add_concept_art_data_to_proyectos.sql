ALTER TABLE public.proyectos_cineasta ADD COLUMN IF NOT EXISTS concept_art_data JSONB DEFAULT '{}'::jsonb;
