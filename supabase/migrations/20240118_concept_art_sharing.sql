-- Shared Concept Art canvases within a project

-- 1) Per-canvas edit grants
create table if not exists public.concept_art_canvas_permissions (
  id uuid primary key default gen_random_uuid(),
  canvas_id uuid not null references public.concept_art(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  permission text not null check (permission in ('edit')),
  created_at timestamptz not null default timezone('utc'::text, now())
);

create unique index if not exists concept_art_canvas_permissions_unique
on public.concept_art_canvas_permissions(canvas_id, user_id);

alter table public.concept_art_canvas_permissions enable row level security;

-- 2) Drop existing policies (unknown names) safely
do $$
declare
  pol record;
begin
  for pol in (select schemaname, tablename, policyname from pg_policies where schemaname = 'public' and tablename in ('concept_art', 'concept_art_references', 'concept_art_canvas_permissions')) loop
    execute format('drop policy if exists %I on %I.%I', pol.policyname, pol.schemaname, pol.tablename);
  end loop;
end$$;

-- 3) concept_art policies
-- Everyone in the project can VIEW all canvases.
create policy "Select Concept Art"
on public.concept_art for select
using (
  is_project_owner(project_id) or project_id in (select get_my_project_ids())
);

-- Members can create their own canvases in the project.
create policy "Insert Concept Art"
on public.concept_art for insert
with check (
  user_id = auth.uid() and (is_project_owner(project_id) or project_id in (select get_my_project_ids()))
);

-- Only canvas owner, project owner, or explicit editor can UPDATE.
create policy "Update Concept Art"
on public.concept_art for update
using (
  user_id = auth.uid()
  or is_project_owner(project_id)
  or exists (
    select 1 from public.concept_art_canvas_permissions cap
    where cap.canvas_id = id and cap.user_id = auth.uid() and cap.permission = 'edit'
  )
);

-- Only canvas owner or project owner can DELETE.
create policy "Delete Concept Art"
on public.concept_art for delete
using (
  user_id = auth.uid() or is_project_owner(project_id)
);

-- 4) concept_art_references policies (shared view; creator/owner manage)
create policy "Select Concept Art References"
on public.concept_art_references for select
using (
  is_project_owner(project_id) or project_id in (select get_my_project_ids())
);

create policy "Insert Concept Art References"
on public.concept_art_references for insert
with check (
  user_id = auth.uid() and (is_project_owner(project_id) or project_id in (select get_my_project_ids()))
);

create policy "Update Concept Art References"
on public.concept_art_references for update
using (
  user_id = auth.uid() or is_project_owner(project_id)
);

create policy "Delete Concept Art References"
on public.concept_art_references for delete
using (
  user_id = auth.uid() or is_project_owner(project_id)
);

-- 5) concept_art_canvas_permissions policies
-- Team can view permissions for canvases in projects they belong to.
create policy "Select Canvas Permissions"
on public.concept_art_canvas_permissions for select
using (
  exists (
    select 1
    from public.concept_art ca
    where ca.id = canvas_id
      and (is_project_owner(ca.project_id) or ca.project_id in (select get_my_project_ids()))
  )
);

-- Only canvas owner or project owner can manage edit grants.
create policy "Manage Canvas Permissions"
on public.concept_art_canvas_permissions for all
using (
  exists (
    select 1
    from public.concept_art ca
    where ca.id = canvas_id
      and (ca.user_id = auth.uid() or is_project_owner(ca.project_id))
  )
)
with check (
  exists (
    select 1
    from public.concept_art ca
    where ca.id = canvas_id
      and (ca.user_id = auth.uid() or is_project_owner(ca.project_id))
  )
);

