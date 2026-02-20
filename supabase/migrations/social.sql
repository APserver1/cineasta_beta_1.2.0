-- Social: posts, follows, post_media + storage bucket post-images

-- 1) Ensure counters exist in public.users
alter table if exists public.users
  add column if not exists seguidos integer not null default 0,
  add column if not exists seguidores integer not null default 0;

-- 2) Posts
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null,
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists idx_posts_created_at_desc on public.posts (created_at desc);
create index if not exists idx_posts_author_created_at_desc on public.posts (author_id, created_at desc);

alter table public.posts enable row level security;

grant select on public.posts to anon;
grant select, insert, update, delete on public.posts to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'posts' and policyname = 'posts_select_public'
  ) then
    create policy "posts_select_public" on public.posts
      for select using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'posts' and policyname = 'posts_insert_own'
  ) then
    create policy "posts_insert_own" on public.posts
      for insert to authenticated
      with check (auth.uid() = author_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'posts' and policyname = 'posts_update_own'
  ) then
    create policy "posts_update_own" on public.posts
      for update to authenticated
      using (auth.uid() = author_id)
      with check (auth.uid() = author_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'posts' and policyname = 'posts_delete_own'
  ) then
    create policy "posts_delete_own" on public.posts
      for delete to authenticated
      using (auth.uid() = author_id);
  end if;
end $$;

-- 3) Post media
create table if not exists public.post_media (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null,
  owner_id uuid not null,
  storage_path text not null,
  public_url text not null,
  mime_type text,
  size_bytes integer,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists idx_post_media_post_id on public.post_media (post_id);

alter table public.post_media enable row level security;

grant select on public.post_media to anon;
grant select, insert, update, delete on public.post_media to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'post_media' and policyname = 'post_media_select_public'
  ) then
    create policy "post_media_select_public" on public.post_media
      for select using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'post_media' and policyname = 'post_media_insert_own'
  ) then
    create policy "post_media_insert_own" on public.post_media
      for insert to authenticated
      with check (auth.uid() = owner_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'post_media' and policyname = 'post_media_delete_own'
  ) then
    create policy "post_media_delete_own" on public.post_media
      for delete to authenticated
      using (auth.uid() = owner_id);
  end if;
end $$;

-- 4) Follows
create table if not exists public.follows (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid not null,
  followed_id uuid not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (follower_id, followed_id)
);

create index if not exists idx_follows_follower_id on public.follows (follower_id);
create index if not exists idx_follows_followed_id on public.follows (followed_id);

alter table public.follows enable row level security;

grant select, insert, delete on public.follows to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'follows' and policyname = 'follows_select_authenticated'
  ) then
    create policy "follows_select_authenticated" on public.follows
      for select to authenticated using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'follows' and policyname = 'follows_insert_own'
  ) then
    create policy "follows_insert_own" on public.follows
      for insert to authenticated
      with check (
        auth.uid() = follower_id
        and follower_id <> followed_id
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'follows' and policyname = 'follows_delete_own'
  ) then
    create policy "follows_delete_own" on public.follows
      for delete to authenticated
      using (auth.uid() = follower_id);
  end if;
end $$;

-- 5) Follow counters trigger (updates public.users.seguidos/seguidores)
create or replace function public.social_update_follow_counters()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.users
      set seguidos = greatest(seguidos + 1, 0)
      where id = new.follower_id;

    update public.users
      set seguidores = greatest(seguidores + 1, 0)
      where id = new.followed_id;

    return new;
  end if;

  if tg_op = 'DELETE' then
    update public.users
      set seguidos = greatest(seguidos - 1, 0)
      where id = old.follower_id;

    update public.users
      set seguidores = greatest(seguidores - 1, 0)
      where id = old.followed_id;

    return old;
  end if;

  return null;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'trg_social_follow_counters'
  ) then
    create trigger trg_social_follow_counters
      after insert or delete on public.follows
      for each row execute function public.social_update_follow_counters();
  end if;
end $$;

-- 6) Storage bucket for post images
insert into storage.buckets (id, name, public)
values ('post-images', 'post-images', true)
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'post_images_read_public'
  ) then
    create policy "post_images_read_public"
      on storage.objects for select
      using (bucket_id = 'post-images');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'post_images_insert_own_folder'
  ) then
    create policy "post_images_insert_own_folder"
      on storage.objects for insert to authenticated
      with check (
        bucket_id = 'post-images'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'post_images_delete_own_folder'
  ) then
    create policy "post_images_delete_own_folder"
      on storage.objects for delete to authenticated
      using (
        bucket_id = 'post-images'
        and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;
end $$;

-- 7) Likes
create table if not exists public.post_likes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (post_id, user_id)
);

create index if not exists idx_post_likes_post_id on public.post_likes(post_id);
create index if not exists idx_post_likes_user_id on public.post_likes(user_id);

alter table public.post_likes enable row level security;

grant select, insert, delete on public.post_likes to authenticated;
grant select on public.post_likes to anon;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'post_likes' and policyname = 'post_likes_select_public'
  ) then
    create policy "post_likes_select_public" on public.post_likes
      for select using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'post_likes' and policyname = 'post_likes_insert_own'
  ) then
    create policy "post_likes_insert_own" on public.post_likes
      for insert to authenticated
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'post_likes' and policyname = 'post_likes_delete_own'
  ) then
    create policy "post_likes_delete_own" on public.post_likes
      for delete to authenticated
      using (auth.uid() = user_id);
  end if;
end $$;

-- Add likes_count to posts to avoid heavy counts
alter table public.posts add column if not exists likes_count integer not null default 0;

create or replace function public.social_update_likes_count()
returns trigger
language plpgsql
security definer
as $$
begin
  if tg_op = 'INSERT' then
    update public.posts
      set likes_count = likes_count + 1
      where id = new.post_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.posts
      set likes_count = greatest(likes_count - 1, 0)
      where id = old.post_id;
    return old;
  end if;
  return null;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'trg_social_likes_count'
  ) then
    create trigger trg_social_likes_count
      after insert or delete on public.post_likes
      for each row execute function public.social_update_likes_count();
  end if;
end $$;

-- 8) Bookmarks
create table if not exists public.post_bookmarks (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (post_id, user_id)
);

create index if not exists idx_post_bookmarks_user_id on public.post_bookmarks(user_id);

alter table public.post_bookmarks enable row level security;

grant select, insert, delete on public.post_bookmarks to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'post_bookmarks' and policyname = 'post_bookmarks_select_own'
  ) then
    create policy "post_bookmarks_select_own" on public.post_bookmarks
      for select to authenticated
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'post_bookmarks' and policyname = 'post_bookmarks_insert_own'
  ) then
    create policy "post_bookmarks_insert_own" on public.post_bookmarks
      for insert to authenticated
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'post_bookmarks' and policyname = 'post_bookmarks_delete_own'
  ) then
    create policy "post_bookmarks_delete_own" on public.post_bookmarks
      for delete to authenticated
      using (auth.uid() = user_id);
  end if;
end $$;

-- 9) Replies (Comments)
create table if not exists public.post_replies (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  parent_reply_id uuid references public.post_replies(id) on delete cascade,
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists idx_post_replies_post_id on public.post_replies(post_id);
create index if not exists idx_post_replies_parent_id on public.post_replies(parent_reply_id);

alter table public.post_replies enable row level security;

grant select on public.post_replies to anon;
grant select, insert, update, delete on public.post_replies to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'post_replies' and policyname = 'post_replies_select_public'
  ) then
    create policy "post_replies_select_public" on public.post_replies
      for select using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'post_replies' and policyname = 'post_replies_insert_auth'
  ) then
    create policy "post_replies_insert_auth" on public.post_replies
      for insert to authenticated
      with check (auth.uid() = author_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'post_replies' and policyname = 'post_replies_delete_own'
  ) then
    create policy "post_replies_delete_own" on public.post_replies
      for delete to authenticated
      using (auth.uid() = author_id);
  end if;
end $$;

-- Add replies_count to posts
alter table public.posts add column if not exists replies_count integer not null default 0;

create or replace function public.social_update_replies_count()
returns trigger
language plpgsql
security definer
as $$
begin
  if tg_op = 'INSERT' then
    update public.posts
      set replies_count = replies_count + 1
      where id = new.post_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.posts
      set replies_count = greatest(replies_count - 1, 0)
      where id = old.post_id;
    return old;
  end if;
  return null;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_trigger where tgname = 'trg_social_replies_count'
  ) then
    create trigger trg_social_replies_count
      after insert or delete on public.post_replies
      for each row execute function public.social_update_replies_count();
  end if;
end $$;

