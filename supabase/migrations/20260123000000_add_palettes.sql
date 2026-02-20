ALTER TABLE public.arttab ADD COLUMN IF NOT EXISTS paletas JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.proyectos_cineasta ADD COLUMN IF NOT EXISTS paletas_globales JSONB DEFAULT '[]'::jsonb;
