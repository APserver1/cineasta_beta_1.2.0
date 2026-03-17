-- Añadir columna tratamiento_data a la tabla proyectos_cineasta
ALTER TABLE public.proyectos_cineasta 
ADD COLUMN IF NOT EXISTS tratamiento_data JSONB DEFAULT '{}'::jsonb;

-- Comentario: En PostgreSQL no se puede especificar la posición de la columna (AFTER escaleta_data) 
-- con un simple ALTER TABLE. La nueva columna se añadirá al final. 
-- Sin embargo, esto no afecta el funcionamiento de la aplicación.
