
-- Break RLS Recursion using Security Definer function

-- 1. Create helper function to get project IDs where user is a member
-- This runs with elevated privileges (security definer) to bypass RLS on project_members
-- when called from projects policy.
create or replace function public.get_my_project_ids()
returns setof uuid
language sql
security definer
set search_path = public
stable
as $$
  select project_id from public.project_members where user_id = auth.uid()
$$;

-- 2. Update Proyectos Cineasta Policy
drop policy if exists "Users can view projects" on public.proyectos_cineasta;

create policy "Users can view projects"
on public.proyectos_cineasta for select
using (
  auth.uid() = user_id OR 
  id in (select get_my_project_ids())
);

-- 3. Update Project Members Policy to be safer
-- We also need to fix project_members policy to avoid recursion when querying projects
-- But getting my project IDs handles the projects side.
-- For project_members side, we can keep the logic but maybe optimize.

drop policy if exists "Project members can view other members" on public.project_members;
drop policy if exists "Project owners can manage members" on public.project_members;
drop policy if exists "Project members can view other members" on public.project_members; -- duplicate check

-- Split into simple policies
create policy "Users can view own membership"
on public.project_members for select
using (user_id = auth.uid());

-- Allow members to view other members in the same project
-- This is self-referential but safe(r) if projects policy is fixed? 
-- Actually, let's use a function for "is project owner" too if needed, but let's try just the project policy fix first.
-- But wait, if we query project_members, we need to be able to see rows.

-- Let's create a helper for "Am I project owner?"
create or replace function public.is_project_owner(p_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from public.proyectos_cineasta where id = p_id and user_id = auth.uid())
$$;

create policy "View team members"
on public.project_members for select
using (
  is_project_owner(project_id) OR
  project_id in (select get_my_project_ids())
);

-- 4. Re-apply other policies just in case
-- INSERT projects
drop policy if exists "Users can create projects" on public.proyectos_cineasta;
create policy "Users can create projects"
on public.proyectos_cineasta for insert
with check (auth.uid() = user_id);

-- UPDATE projects
drop policy if exists "Users can update projects" on public.proyectos_cineasta;
create policy "Users can update projects"
on public.proyectos_cineasta for update
using (
  auth.uid() = user_id OR 
  id in (select get_my_project_ids())
);

-- DELETE projects
drop policy if exists "Users can delete projects" on public.proyectos_cineasta;
create policy "Users can delete projects"
on public.proyectos_cineasta for delete
using (auth.uid() = user_id);

-- 5. Fix Project Roles Policies (Circular dependency risk too)
drop policy if exists "Project members can view roles" on public.project_roles;
drop policy if exists "Project owners can manage roles" on public.project_roles;

create policy "View project roles"
on public.project_roles for select
using (
  is_project_owner(project_id) OR
  project_id in (select get_my_project_ids())
);

create policy "Manage project roles"
on public.project_roles for all
using (
  is_project_owner(project_id)
);

-- 6. Project Invitations (Already safe-ish, but let's standardize)
-- "Users can view invitations sent to them" -> Safe
-- "Project owners/members can view invitations sent from project" -> Risk if checking projects RLS

drop policy if exists "Project owners/members can view invitations sent from project" on public.project_invitations;

create policy "View sent invitations"
on public.project_invitations for select
using (
  auth.uid() = from_user_id OR
  is_project_owner(project_id) OR
  project_id in (select get_my_project_ids())
);

