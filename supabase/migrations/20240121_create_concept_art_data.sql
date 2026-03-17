
-- Create new table for Concept Art Data as requested
create table if not exists public.concept_art_data (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.proyectos_cineasta(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete set null,
  name text not null default 'Nuevo Lienzo',
  tags text[] default '{}',
  width integer not null default 1280,
  height integer not null default 720,
  aspect_ratio text not null default '16/9',
  layers jsonb default '[]', -- Stores the base64 layer data
  versions jsonb default '[]', -- For version history
  created_at timestamptz default now()
);

-- Enable RLS
alter table public.concept_art_data enable row level security;

-- Policies (Reusing logic from concept_art)

-- View: Project members can view
create policy "View Concept Art Data"
on public.concept_art_data for select
using (
  project_id in (select get_my_project_ids())
  or
  exists (
    select 1 from public.proyectos_cineasta p
    where p.id = project_id and p.user_id = auth.uid()
  )
);

-- Insert: Members can insert
create policy "Insert Concept Art Data"
on public.concept_art_data for insert
with check (
  project_id in (select get_my_project_ids())
  or
  exists (
    select 1 from public.proyectos_cineasta p
    where p.id = project_id and p.user_id = auth.uid()
  )
);

-- Update: Owner, Creator, or Editor (via permission table - we need to link this)
-- For now, let's allow project members to update for simplicity based on "Test de compartido" context,
-- or strictly follow the previous permissions.
-- The user said "adapta el proyecto para que esto funcione con el resto de funciones".
-- We should probably migrate permissions too, or just check project ownership/creator.
-- Let's stick to: Creator or Project Owner. (And we can add the granular permissions later if needed, but for now ensure SAVING works).
create policy "Update Concept Art Data"
on public.concept_art_data for update
using (
  user_id = auth.uid()
  or
  exists (
    select 1 from public.proyectos_cineasta p
    where p.id = project_id and p.user_id = auth.uid()
  )
  -- Add granular permission check if needed:
  -- or exists (select 1 from concept_art_canvas_permissions where canvas_id = id and user_id = auth.uid() and permission = 'edit')
  -- Note: We'd need to migrate the permissions table to point to this new table or just use ID.
);

-- Delete: Owner or Creator
create policy "Delete Concept Art Data"
on public.concept_art_data for delete
using (
  user_id = auth.uid()
  or
  exists (
    select 1 from public.proyectos_cineasta p
    where p.id = project_id and p.user_id = auth.uid()
  )
);
