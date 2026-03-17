
-- 1. Project Invitations Table
create table if not exists public.project_invitations (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.proyectos_cineasta(id) on delete cascade not null,
  from_user_id uuid references auth.users(id) on delete cascade not null,
  to_user_id uuid references auth.users(id) on delete cascade not null,
  status text check (status in ('pending', 'accepted', 'rejected')) default 'pending',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Project Roles Table
create table if not exists public.project_roles (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.proyectos_cineasta(id) on delete cascade not null,
  name text not null,
  permissions jsonb default '{}'::jsonb, -- { "tabId": "edit" | "view" | "none" }
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Project Members Table
create table if not exists public.project_members (
  id uuid default gen_random_uuid() primary key,
  project_id uuid references public.proyectos_cineasta(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  role_id uuid references public.project_roles(id) on delete set null,
  joined_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(project_id, user_id)
);

-- RLS Policies

-- Project Invitations
alter table public.project_invitations enable row level security;

create policy "Users can view invitations sent to them"
  on public.project_invitations for select
  using (auth.uid() = to_user_id);

create policy "Project owners/members can view invitations sent from project"
  on public.project_invitations for select
  using (
    auth.uid() = from_user_id OR 
    exists (select 1 from public.proyectos_cineasta where id = project_id and user_id = auth.uid())
  );

create policy "Users can create invitations"
  on public.project_invitations for insert
  with check (auth.uid() = from_user_id);

create policy "Users can update their own invitations (accept/reject)"
  on public.project_invitations for update
  using (auth.uid() = to_user_id);

-- Project Roles
alter table public.project_roles enable row level security;

create policy "Project members can view roles"
  on public.project_roles for select
  using (
    exists (select 1 from public.proyectos_cineasta where id = project_id and user_id = auth.uid()) OR
    exists (select 1 from public.project_members where project_id = public.project_roles.project_id and user_id = auth.uid())
  );

create policy "Project owners can manage roles"
  on public.project_roles for all
  using (
    exists (select 1 from public.proyectos_cineasta where id = project_id and user_id = auth.uid())
  );

-- Project Members
alter table public.project_members enable row level security;

create policy "Project members can view other members"
  on public.project_members for select
  using (
    exists (select 1 from public.proyectos_cineasta where id = project_id and user_id = auth.uid()) OR
    exists (select 1 from public.project_members pm where pm.project_id = public.project_members.project_id and pm.user_id = auth.uid())
  );

create policy "Project owners can manage members"
  on public.project_members for all
  using (
    exists (select 1 from public.proyectos_cineasta where id = project_id and user_id = auth.uid())
  );
  
-- Allow members to insert themselves (when accepting invite) - verified by application logic usually, but here we can trust authenticated user accepting their own invite via function or direct insert if policy allows. 
-- Better: Use a secure function to accept invite.

-- Function to accept invitation
create or replace function public.accept_project_invitation(invitation_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  inv_record record;
begin
  select * into inv_record from public.project_invitations where id = invitation_id;
  
  if inv_record is null then
    raise exception 'Invitation not found';
  end if;
  
  if inv_record.to_user_id != auth.uid() then
    raise exception 'Not authorized';
  end if;
  
  if inv_record.status != 'pending' then
    raise exception 'Invitation already processed';
  end if;
  
  -- Update invitation status
  update public.project_invitations set status = 'accepted' where id = invitation_id;
  
  -- Add to members
  insert into public.project_members (project_id, user_id)
  values (inv_record.project_id, inv_record.to_user_id)
  on conflict (project_id, user_id) do nothing;
  
end;
$$;

-- UPDATE Project Access Policy
-- We need to allow project members to SELECT and UPDATE the project they are part of.
-- Existing policy probably only checks owner (user_id = auth.uid()).

create policy "Members can view projects"
  on public.proyectos_cineasta for select
  using (
    user_id = auth.uid() OR
    exists (select 1 from public.project_members where project_id = id and user_id = auth.uid())
  );

create policy "Members can update projects"
  on public.proyectos_cineasta for update
  using (
    user_id = auth.uid() OR
    exists (select 1 from public.project_members where project_id = id and user_id = auth.uid())
  );
  
-- NOTE: We might have duplicate policies if we just run this. Supabase handles duplicates usually by error or just existing.
-- But standard `create policy` fails if exists. I should drop if exists or use "create policy if not exists" (not standard SQL).
-- For this environment, I'll rely on unique names or failure is fine if policy exists (I'll check existing policies first? No, I'll just run it, usually I can't check easily without querying pg_policies).
-- Actually, let's wrap in DO block or just try.

