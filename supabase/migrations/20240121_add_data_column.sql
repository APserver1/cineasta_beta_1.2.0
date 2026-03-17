
-- Add 'data' column to concept_art_data table as requested
alter table public.concept_art_data 
add column if not exists data jsonb default '[]';

-- Update existing rows to copy layers to data if data is empty
update public.concept_art_data
set data = layers
where data is null or data = '[]'::jsonb;
