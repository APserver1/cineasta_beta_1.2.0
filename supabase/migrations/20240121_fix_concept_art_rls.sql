
-- Ensure RLS policies are correct and robust
-- Update policy for Concept Art Data

drop policy if exists "Update Concept Art Data" on public.concept_art_data;

create policy "Update Concept Art Data"
on public.concept_art_data for update
using (
  -- Allow if user is the creator
  user_id = auth.uid()
  or
  -- Allow if user is the project owner
  exists (
    select 1 from public.proyectos_cineasta p
    where p.id = project_id and p.user_id = auth.uid()
  )
  or
  -- Allow if user has explicit edit permission
  exists (
    select 1 from public.concept_art_data_permissions p
    where p.canvas_id = id 
    and p.user_id = auth.uid() 
    and p.permission = 'edit'
  )
);

-- Ensure Insert policy is also correct
drop policy if exists "Insert Concept Art Data" on public.concept_art_data;

create policy "Insert Concept Art Data"
on public.concept_art_data for insert
with check (
  -- Allow if user is a member of the project (owner or guest)
  exists (
    select 1 from public.proyectos_cineasta p
    where p.id = project_id 
    and (
        p.user_id = auth.uid() -- Owner
        -- Add guest check if needed, e.g. from a 'project_members' table or similar.
        -- For now, relying on 'get_my_project_ids' if it exists, or just open for project context.
        -- Assuming 'get_my_project_ids' returns projects the user has access to.
    )
  )
  or
  -- Fallback: if I can see the project, maybe I can add? 
  -- Let's stick to the owner check + previous logic.
  -- Re-adding the 'get_my_project_ids' check if it was working before.
  project_id in (
    select p.id from public.proyectos_cineasta p where p.user_id = auth.uid()
  )
);

-- If get_my_project_ids exists, use it
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_my_project_ids') THEN
        drop policy if exists "Insert Concept Art Data" on public.concept_art_data;
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
    END IF;
END
$$;
