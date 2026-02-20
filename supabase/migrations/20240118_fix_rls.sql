
-- Fix RLS for proyectos_cineasta
alter table public.proyectos_cineasta enable row level security;

-- Drop existing policies to start clean (avoid conflicts)
drop policy if exists "Users can view own projects" on public.proyectos_cineasta;
drop policy if exists "Users can create own projects" on public.proyectos_cineasta;
drop policy if exists "Users can update own projects" on public.proyectos_cineasta;
drop policy if exists "Users can delete own projects" on public.proyectos_cineasta;
drop policy if exists "Members can view projects" on public.proyectos_cineasta;
drop policy if exists "Members can update projects" on public.proyectos_cineasta;
drop policy if exists "Users can view projects" on public.proyectos_cineasta;
drop policy if exists "Users can create projects" on public.proyectos_cineasta;
drop policy if exists "Users can update projects" on public.proyectos_cineasta;
drop policy if exists "Users can delete projects" on public.proyectos_cineasta;

-- Re-create comprehensive policies

-- 1. SELECT: Owners and Members
create policy "Users can view projects"
on public.proyectos_cineasta for select
using (
  auth.uid() = user_id OR 
  exists (select 1 from public.project_members where project_id = id and user_id = auth.uid())
);

-- 2. INSERT: Authenticated users can create projects for themselves
create policy "Users can create projects"
on public.proyectos_cineasta for insert
with check (
  auth.uid() = user_id
);

-- 3. UPDATE: Owners and Members
create policy "Users can update projects"
on public.proyectos_cineasta for update
using (
  auth.uid() = user_id OR 
  exists (select 1 from public.project_members where project_id = id and user_id = auth.uid())
);

-- 4. DELETE: Owners only
create policy "Users can delete projects"
on public.proyectos_cineasta for delete
using (
  auth.uid() = user_id
);

-- Fix RLS for series_cineasta (Assuming similar issues)
alter table public.series_cineasta enable row level security;

drop policy if exists "Users can view own series" on public.series_cineasta;
drop policy if exists "Users can create own series" on public.series_cineasta;
drop policy if exists "Users can update own series" on public.series_cineasta;
drop policy if exists "Users can delete own series" on public.series_cineasta;

-- Policies for Series (Owner only for now usually, unless we want shared series later)
create policy "Users can view own series"
on public.series_cineasta for select
using (auth.uid() = user_id);

create policy "Users can create own series"
on public.series_cineasta for insert
with check (auth.uid() = user_id);

create policy "Users can update own series"
on public.series_cineasta for update
using (auth.uid() = user_id);

create policy "Users can delete own series"
on public.series_cineasta for delete
using (auth.uid() = user_id);
