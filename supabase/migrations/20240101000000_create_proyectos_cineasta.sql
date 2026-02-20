-- Create table
create table if not exists public.proyectos_cineasta (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.proyectos_cineasta enable row level security;

-- Create policies
create policy "Users can view their own projects"
  on public.proyectos_cineasta for select
  using (auth.uid() = user_id);

create policy "Users can create their own projects"
  on public.proyectos_cineasta for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own projects"
  on public.proyectos_cineasta for update
  using (auth.uid() = user_id);

create policy "Users can delete their own projects"
  on public.proyectos_cineasta for delete
  using (auth.uid() = user_id);

-- Grant permissions
grant select, insert, update, delete on public.proyectos_cineasta to authenticated;
grant select, insert, update, delete on public.proyectos_cineasta to anon;
