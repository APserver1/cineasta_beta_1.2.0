
-- NUCLEAR OPTION: Drop ALL policies on related tables to ensure no recursive leftovers
-- Then re-apply the SAFE policies using Security Definer functions.

-- 1. DROP ALL POLICIES
drop policy if exists "Users can view projects" on public.proyectos_cineasta;
drop policy if exists "Users can create projects" on public.proyectos_cineasta;
drop policy if exists "Users can update projects" on public.proyectos_cineasta;
drop policy if exists "Users can delete projects" on public.proyectos_cineasta;
drop policy if exists "Members can view projects" on public.proyectos_cineasta;
drop policy if exists "Members can update projects" on public.proyectos_cineasta;
drop policy if exists "Users can view own projects" on public.proyectos_cineasta;

drop policy if exists "Users can view own membership" on public.project_members;
drop policy if exists "View team members" on public.project_members;
drop policy if exists "Project members can view other members" on public.project_members;
drop policy if exists "Project owners can manage members" on public.project_members;

drop policy if exists "View project roles" on public.project_roles;
drop policy if exists "Manage project roles" on public.project_roles;
drop policy if exists "Project members can view roles" on public.project_roles;
drop policy if exists "Project owners can manage roles" on public.project_roles;

drop policy if exists "View sent invitations" on public.project_invitations;
drop policy if exists "Users can view invitations sent to them" on public.project_invitations;
drop policy if exists "Project owners/members can view invitations sent from project" on public.project_invitations;

-- 2. ENSURE FUNCTIONS EXIST (Idempotent)
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

-- 3. RE-CREATE POLICIES (SAFE VERSIONS)

-- PROYECTOS_CINEASTA
create policy "Select Projects"
on public.proyectos_cineasta for select
using (
  auth.uid() = user_id OR 
  id in (select get_my_project_ids())
);

create policy "Insert Projects"
on public.proyectos_cineasta for insert
with check (auth.uid() = user_id);

create policy "Update Projects"
on public.proyectos_cineasta for update
using (
  auth.uid() = user_id OR 
  id in (select get_my_project_ids())
);

create policy "Delete Projects"
on public.proyectos_cineasta for delete
using (auth.uid() = user_id);

-- PROJECT_MEMBERS
-- Users can see their own membership row (needed to know they are members)
create policy "Select Own Membership"
on public.project_members for select
using (user_id = auth.uid());

-- Users can see other members IF they are owner OR member of that project
-- Using functions to avoid recursion
create policy "Select Project Team"
on public.project_members for select
using (
  is_project_owner(project_id) OR
  project_id in (select get_my_project_ids())
);

-- Only owners can add/remove members
create policy "Manage Members"
on public.project_members for all
using (
  is_project_owner(project_id)
);

-- PROJECT_ROLES
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

-- PROJECT_INVITATIONS
-- Users see invites sent TO them
create policy "Select Received Invites"
on public.project_invitations for select
using (to_user_id = auth.uid());

-- Users see invites sent FROM them (as owner/member)
create policy "Select Project Invites"
on public.project_invitations for select
using (
  is_project_owner(project_id) OR
  project_id in (select get_my_project_ids())
);

-- Allow creating invites (members/owners)
create policy "Insert Invites"
on public.project_invitations for insert
with check (
  from_user_id = auth.uid() AND (
    is_project_owner(project_id) OR
    project_id in (select get_my_project_ids())
  )
);

-- Allow updating invites (accept/reject by recipient)
create policy "Update Received Invites"
on public.project_invitations for update
using (to_user_id = auth.uid());

