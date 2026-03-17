
-- Permissions for the new Concept Art Data table
create table if not exists public.concept_art_data_permissions (
  id uuid primary key default gen_random_uuid(),
  canvas_id uuid not null references public.concept_art_data(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  permission text not null check (permission in ('edit')),
  created_at timestamptz not null default timezone('utc'::text, now())
);

create unique index if not exists concept_art_data_permissions_unique
on public.concept_art_data_permissions(canvas_id, user_id);

alter table public.concept_art_data_permissions enable row level security;

-- Policies for Permissions

-- View: If you can view the canvas (via project), you can view its permissions
create policy "Select Data Permissions"
on public.concept_art_data_permissions for select
using (
  exists (
    select 1
    from public.concept_art_data ca
    where ca.id = canvas_id
      and (
        ca.project_id in (select get_my_project_ids())
        or
        exists (select 1 from public.proyectos_cineasta p where p.id = ca.project_id and p.user_id = auth.uid())
      )
  )
);

-- Manage: Only canvas owner or project owner
create policy "Manage Data Permissions"
on public.concept_art_data_permissions for all
using (
  exists (
    select 1
    from public.concept_art_data ca
    where ca.id = canvas_id
      and (ca.user_id = auth.uid() or exists (select 1 from public.proyectos_cineasta p where p.id = ca.project_id and p.user_id = auth.uid()))
  )
);
