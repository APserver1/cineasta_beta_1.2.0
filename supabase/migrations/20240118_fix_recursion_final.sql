
-- 1. Ensure functions are owned by postgres (superuser) to bypass RLS reliably
-- We can't execute "ALTER FUNCTION OWNER" if we are not superuser, but usually in Supabase SQL Editor/Migrations we have permissions.
-- If this fails, we rely on creation user being sufficient.

create or replace function public.get_my_project_ids()
returns setof uuid
language sql
security definer
set search_path = public
stable
as $$
  select project_id from public.project_members where user_id = auth.uid()
$$;

create or replace function public.is_project_owner(p_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from public.proyectos_cineasta where id = p_id and user_id = auth.uid())
$$;

-- 2. Backfill: Insert all project owners into project_members with a special 'owner' role
-- First, ensure we have an 'owner' role in project_roles? 
-- Or just use null role for now and rely on is_project_owner logic?
-- Let's just insert them to ensure "membership" queries work.
-- We'll use ON CONFLICT DO NOTHING to avoid duplicates.

insert into public.project_members (project_id, user_id)
select id, user_id from public.proyectos_cineasta
on conflict (project_id, user_id) do nothing;

-- 3. SIMPLIFIED POLICIES (Breaking the Cycle)

-- Proyectos Cineasta
-- Start fresh
drop policy if exists "Select Projects" on public.proyectos_cineasta;
drop policy if exists "Insert Projects" on public.proyectos_cineasta;
drop policy if exists "Update Projects" on public.proyectos_cineasta;
drop policy if exists "Delete Projects" on public.proyectos_cineasta;

-- SELECT: "I am the owner column" OR "I am in the members list"
-- This relies on `get_my_project_ids` which uses `project_members`.
create policy "Select Projects"
on public.proyectos_cineasta for select
using (
  user_id = auth.uid() OR 
  id in (select get_my_project_ids()) OR
  has_pending_invite(id)
);

-- INSERT: Owner only
create policy "Insert Projects"
on public.proyectos_cineasta for insert
with check (auth.uid() = user_id);

-- UPDATE: Owner OR Member
create policy "Update Projects"
on public.proyectos_cineasta for update
using (
  user_id = auth.uid() OR 
  id in (select get_my_project_ids())
);

-- DELETE: Owner only
create policy "Delete Projects"
on public.proyectos_cineasta for delete
using (user_id = auth.uid());


-- Project Members
-- Start fresh
drop policy if exists "Select Own Membership" on public.project_members;
drop policy if exists "Select Project Team" on public.project_members;
drop policy if exists "Manage Members" on public.project_members;

-- SELECT: "It is ME" OR "I am a member of this project"
-- CRITICAL: We avoid checking `is_project_owner` (which checks proyectos_cineasta) to avoid loop.
-- Instead, we assume if you are in the project, you can see the team.
-- `project_id in (select get_my_project_ids())` queries `project_members` inside `get_my_project_ids`.
-- Since `get_my_project_ids` is SECURITY DEFINER, it bypasses THIS policy.
-- This breaks the recursion on `project_members`.

create policy "Select Project Team"
on public.project_members for select
using (
  user_id = auth.uid() OR
  project_id in (select get_my_project_ids())
);

-- MANAGE: Only Owner (checked via function)
-- `is_project_owner` is SECURITY DEFINER. It queries `proyectos_cineasta`.
-- `proyectos_cineasta` policy uses `get_my_project_ids`.
-- `get_my_project_ids` queries `project_members` (Definer -> Bypass).
-- So this path is safe:
-- members -> policy -> is_project_owner(definer) -> projects -> policy -> get_my_project_ids(definer) -> members(bypass) -> DONE.

create policy "Manage Members"
on public.project_members for all
using (
  is_project_owner(project_id)
);

-- Project Roles
drop policy if exists "Select Roles" on public.project_roles;
drop policy if exists "Manage Roles" on public.project_roles;

create policy "Select Roles"
on public.project_roles for select
using (
  is_project_owner(project_id) OR
  project_id in (select get_my_project_ids())
);

create policy "Manage Roles"
on public.project_roles for all
using (
  is_project_owner(project_id)
);

-- Project Invitations
drop policy if exists "Select Received Invites" on public.project_invitations;
drop policy if exists "Select Project Invites" on public.project_invitations;
drop policy if exists "Insert Invites" on public.project_invitations;
drop policy if exists "Update Received Invites" on public.project_invitations;

create policy "Select Received Invites"
on public.project_invitations for select
using (to_user_id = auth.uid());

create policy "Select Project Invites"
on public.project_invitations for select
using (
  is_project_owner(project_id) OR
  project_id in (select get_my_project_ids())
);

create policy "Insert Invites"
on public.project_invitations for insert
with check (
  from_user_id = auth.uid() AND (
    is_project_owner(project_id) OR
    project_id in (select get_my_project_ids())
  )
);

create policy "Update Received Invites"
on public.project_invitations for update
using (to_user_id = auth.uid());
