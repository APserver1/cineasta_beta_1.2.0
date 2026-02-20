
-- Allow users with PENDING invitations to view the project (Title only mainly, but row access needed)
-- We need to update the "Select Projects" policy in `proyectos_cineasta`.

-- Helper to check if I have a pending invite
create or replace function public.has_pending_invite(p_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.project_invitations 
    where project_id = p_id 
    and to_user_id = auth.uid() 
    and status = 'pending'
  )
$$;

-- Update Policy
drop policy if exists "Select Projects" on public.proyectos_cineasta;

create policy "Select Projects"
on public.proyectos_cineasta for select
using (
  auth.uid() = user_id OR 
  id in (select get_my_project_ids()) OR
  has_pending_invite(id)
);
