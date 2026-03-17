
-- Add cover_url to proyectos_cineasta
alter table public.proyectos_cineasta
add column if not exists cover_url text;

-- Add cover_url to series_cineasta
alter table public.series_cineasta
add column if not exists cover_url text;

-- Create bucket for project covers if it doesn't exist
insert into storage.buckets (id, name, public)
values ('project-assets', 'project-assets', true)
on conflict (id) do nothing;

-- Storage policies for project-assets
create policy "Project assets are publicly accessible"
  on storage.objects for select
  using ( bucket_id = 'project-assets' );

create policy "Users can upload their own project assets"
  on storage.objects for insert
  with check ( bucket_id = 'project-assets' and auth.uid() = owner );

create policy "Users can update their own project assets"
  on storage.objects for update
  using ( bucket_id = 'project-assets' and auth.uid() = owner );

create policy "Users can delete their own project assets"
  on storage.objects for delete
  using ( bucket_id = 'project-assets' and auth.uid() = owner );
