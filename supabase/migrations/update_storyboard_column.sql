-- SQL para añadir la columna de storyboard a la tabla de proyectos
ALTER TABLE proyectos_cineasta 
ADD COLUMN IF NOT EXISTS storyboard_data JSONB DEFAULT '{"frames": []}'::jsonb;

-- Comentario: La estructura del JSONB será:
-- {
--   "frames": [
--     {
--       "id": "uuid",
--       "drawing": "base64_string",
--       "caption": "string",
--       "order": integer
--     }
--   ]
-- }
