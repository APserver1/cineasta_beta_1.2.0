
-- Create public_profile table
create table if not exists public.public_profile (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null unique,
  username text,
  banner_url text,
  description text,
  profile_picture_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.public_profile enable row level security;

-- Policies for public_profile
create policy "Public profiles are viewable by everyone"
  on public.public_profile for select
  using ( true );

create policy "Users can insert their own profile"
  on public.public_profile for insert
  with check ( auth.uid() = user_id );

create policy "Users can update their own profile"
  on public.public_profile for update
  using ( auth.uid() = user_id );

-- Storage bucket for profile images (banner, avatar)
insert into storage.buckets (id, name, public)
values ('profile-assets', 'profile-assets', true)
on conflict (id) do nothing;

-- Storage policies
create policy "Profile assets are publicly accessible"
  on storage.objects for select
  using ( bucket_id = 'profile-assets' );

create policy "Users can upload their own profile assets"
  on storage.objects for insert
  with check ( bucket_id = 'profile-assets' and auth.uid() = owner );

create policy "Users can update their own profile assets"
  on storage.objects for update
  using ( bucket_id = 'profile-assets' and auth.uid() = owner );

create policy "Users can delete their own profile assets"
  on storage.objects for delete
  using ( bucket_id = 'profile-assets' and auth.uid() = owner );
