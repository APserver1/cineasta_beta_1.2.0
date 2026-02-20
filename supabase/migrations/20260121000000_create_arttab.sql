create table if not exists public.arttab (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.proyectos_cineasta(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  data jsonb default '{}'::jsonb,
  nombres_de_lienzos text,
  capas jsonb default '[]'::jsonb,
  aspecto_ratio text,
  resolucion_del_lienzo jsonb,
  versiones jsonb default '[]'::jsonb,
  permisos jsonb default '{}'::jsonb,
  referencias jsonb default '[]'::jsonb,
  registro jsonb default '[]'::jsonb,
  fecha_de_creacion timestamp with time zone default timezone('utc'::text, now()) not null,
  fecha_de_modificacion timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists arttab_project_id_idx on public.arttab (project_id);
create index if not exists arttab_project_user_idx on public.arttab (project_id, user_id);
create index if not exists arttab_modified_idx on public.arttab (fecha_de_modificacion desc);

alter table public.arttab enable row level security;

create policy "arttab_select_project_members"
  on public.arttab for select
  using (
    exists (select 1 from public.proyectos_cineasta p where p.id = project_id and p.user_id = auth.uid())
    or exists (select 1 from public.project_members pm where pm.project_id = project_id and pm.user_id = auth.uid())
  );

create policy "arttab_insert_own_rows"
  on public.arttab for insert
  with check (
    auth.uid() = user_id
    and (
      exists (select 1 from public.proyectos_cineasta p where p.id = project_id and p.user_id = auth.uid())
      or exists (select 1 from public.project_members pm where pm.project_id = project_id and pm.user_id = auth.uid())
    )
  );

create policy "arttab_update_own_or_project_owner"
  on public.arttab for update
  using (
    auth.uid() = user_id
    or exists (select 1 from public.proyectos_cineasta p where p.id = project_id and p.user_id = auth.uid())
  );

create policy "arttab_delete_own_or_project_owner"
  on public.arttab for delete
  using (
    auth.uid() = user_id
    or exists (select 1 from public.proyectos_cineasta p where p.id = project_id and p.user_id = auth.uid())
  );

create or replace function public.set_arttab_fecha_de_modificacion()
returns trigger
language plpgsql
as $$
begin
  new.fecha_de_modificacion = timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists set_arttab_fecha_de_modificacion on public.arttab;
create trigger set_arttab_fecha_de_modificacion
before update on public.arttab
for each row
execute function public.set_arttab_fecha_de_modificacion();

