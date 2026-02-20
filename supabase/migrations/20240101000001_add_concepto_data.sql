ALTER TABLE public.proyectos_cineasta ADD COLUMN IF NOT EXISTS concepto_data JSONB DEFAULT '{}'::jsonb;
