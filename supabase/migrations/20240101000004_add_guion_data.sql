-- Añadir columna guion_data a la tabla proyectos_cineasta
ALTER TABLE public.proyectos_cineasta 
ADD COLUMN IF NOT EXISTS guion_data JSONB DEFAULT '{}'::jsonb;
