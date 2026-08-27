create or replace view public.leaderboard_profiles
with (security_invoker = false)
as
select
  user_id,
  username,
  avatar,
  xp,
  level,
  streak
from public.profiles;

grant select on public.leaderboard_profiles to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.profiles;
    exception
      when duplicate_object then null;
    end;
  end if;
end;
$$;