-- Add timeline_data column to proyectos_cineasta table
ALTER TABLE public.proyectos_cineasta 
ADD COLUMN IF NOT EXISTS timeline_data JSONB DEFAULT '{}'::jsonb;
