
-- Add unique constraint to public_profile username
alter table public.public_profile add constraint public_profile_username_key unique (username);

-- Function to check if username exists
create or replace function public.check_username_availability(username_to_check text)
returns boolean
language plpgsql
security definer
as $$
begin
  return not exists (
    select 1 from public.users where lower(username) = lower(username_to_check)
  );
end;
$$;
