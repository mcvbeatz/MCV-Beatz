-- Fusion Throwdown v0.58: run this ENTIRE file in Supabase SQL Editor as project owner.
-- Works for new or existing Fusion Throwdown databases. Safe to rerun.
-- Includes progression.sql, repairs the leaderboard view/grants, corrects history,
-- and installs authenticated self-deletion. Does not delete accounts when installed.
begin;
-- Run once in your Supabase project's SQL editor. Enable email confirmation and
-- set Site URL + allowed redirect URL to https://mcvbeatz.github.io/MCV-Beatz/.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null check (username ~ '^[A-Za-z0-9_]{3,24}$')
);
create unique index if not exists profiles_username_unique on public.profiles(lower(username));
create table if not exists public.player_stats (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  kills bigint not null default 0, deaths bigint not null default 0,
  wins bigint not null default 0, losses bigint not null default 0
);
create table if not exists public.match_results (
  match_id uuid primary key, user_id uuid not null references public.profiles(id) on delete cascade,
  mode text not null, kills integer not null, deaths integer not null,
  result text not null, duration integer not null, overall_kills_excluded boolean not null default false, created_at timestamptz not null default now()
);
alter table public.player_stats add column if not exists kills bigint not null default 0;
alter table public.player_stats add column if not exists deaths bigint not null default 0;
alter table public.player_stats add column if not exists wins bigint not null default 0;
alter table public.player_stats add column if not exists losses bigint not null default 0;
alter table public.match_results add column if not exists overall_kills_excluded boolean not null default false;
alter table public.match_results add column if not exists overall_match_excluded boolean not null default false;
grant usage on schema public to anon, authenticated;
revoke insert,update,delete on public.profiles, public.player_stats, public.match_results from anon,authenticated;
alter table public.profiles enable row level security;
alter table public.player_stats enable row level security;
alter table public.match_results enable row level security;
drop policy if exists "Public usernames" on public.profiles;
create policy "Public usernames" on public.profiles for select using (true);
drop policy if exists "Public leaderboard stats" on public.player_stats;
create policy "Public leaderboard stats" on public.player_stats for select using (true);
drop policy if exists "Own match history" on public.match_results;
create policy "Own match history" on public.match_results for select to authenticated using (auth.uid()=user_id);
-- No client insert/update/delete policies: writes go only through the validated RPC.
create or replace function public.create_player_profile() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.profiles(id,username) values(new.id,new.raw_user_meta_data->>'username');
 insert into public.player_stats(user_id) values(new.id);
 return new;
end; $$;
drop trigger if exists on_player_created on auth.users;
create trigger on_player_created after insert on auth.users for each row execute function public.create_player_profile();
drop view if exists public.leaderboard;
create view public.leaderboard with (security_invoker=true) as
 select p.id as user_id,p.username,s.kills,s.deaths,s.wins,s.losses,
 round(s.kills::numeric/greatest(s.deaths,1),2) as kd_ratio
 from public.profiles p join public.player_stats s on s.user_id=p.id;
grant select on public.profiles, public.player_stats, public.leaderboard to anon,authenticated;
grant select on public.match_results to authenticated;

-- Restore missing profile/stat rows without overwriting any existing rows.
do $$
declare u record; candidate text; suffix integer;
begin
 for u in select * from auth.users where id not in (select id from public.profiles) loop
  candidate := u.raw_user_meta_data->>'username';
  if candidate is null or candidate !~ '^[A-Za-z0-9_]{3,24}$'
     or exists(select 1 from public.profiles where lower(username)=lower(candidate)) then
   suffix := 0;
   loop
    candidate := 'Player_' || substr(md5(u.id::text || ':' || suffix::text),1,17);
    exit when not exists(select 1 from public.profiles where lower(username)=lower(candidate));
    suffix := suffix + 1;
   end loop;
  end if;
  insert into public.profiles(id,username) values(u.id,candidate);
 end loop;
end; $$;
insert into public.player_stats(user_id)
select id from public.profiles on conflict do nothing;

-- Correct only known historical receipts. Markers make this safe to rerun,
-- including after the v0.57 session-stats migration. Preserve all other totals.
lock table public.match_results in share row exclusive mode;
with corrections as (
 select user_id,
   sum(case when not overall_kills_excluded then kills else 0 end) as kills,
   sum(case when mode in ('gauntlet','gauntlet-team') and not overall_match_excluded then deaths else 0 end) as deaths,
   count(*) filter (where mode in ('gauntlet','gauntlet-team') and not overall_match_excluded and result='victory') as wins,
   count(*) filter (where mode in ('gauntlet','gauntlet-team') and not overall_match_excluded and result='defeat') as losses
 from public.match_results where mode in ('dungeon','zombies','gauntlet','gauntlet-team') group by user_id
)
update public.player_stats s set kills=greatest(0,s.kills-c.kills), deaths=greatest(0,s.deaths-c.deaths),
 wins=greatest(0,s.wins-c.wins), losses=greatest(0,s.losses-c.losses)
from corrections c where s.user_id=c.user_id;
update public.match_results set overall_kills_excluded=true where mode in ('dungeon','zombies','gauntlet','gauntlet-team');
update public.match_results set overall_match_excluded=true where mode in ('gauntlet','gauntlet-team');

create or replace function public.record_match(p_match_id uuid,p_mode text,p_kills integer,p_deaths integer,p_result text,p_duration integer)
returns void language plpgsql security definer set search_path='' as $$
declare inserted integer;
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 if p_mode is null or p_mode not in ('gridiron','turnpike','zombies','dungeon','boss','ctf','gauntlet','gauntlet-team','roulette','ffa','tdm','war','rush','corruption')
   or p_kills is null or p_kills not between 0 and 10000 or p_deaths is null or p_deaths not between 0 and 1000
   or p_result is null or p_result not in ('victory','defeat','draw') or p_duration is null or p_duration not between 0 and 10800
 then raise exception 'Invalid match result'; end if;
 insert into public.match_results(match_id,user_id,mode,kills,deaths,result,duration,overall_kills_excluded,overall_match_excluded)
 values(p_match_id,auth.uid(),p_mode,p_kills,p_deaths,p_result,p_duration,p_mode in ('dungeon','zombies','gauntlet','gauntlet-team'),p_mode in ('gauntlet','gauntlet-team')) on conflict do nothing;
 get diagnostics inserted = row_count;
 if inserted=1 and p_mode not in ('gauntlet','gauntlet-team') then
  update public.player_stats set kills=kills+case when p_mode in ('dungeon','zombies') then 0 else p_kills end,deaths=deaths+p_deaths,
   wins=wins+case when p_result='victory' then 1 else 0 end,
   losses=losses+case when p_result='defeat' then 1 else 0 end where user_id=auth.uid();
 end if;
end; $$;
revoke all on function public.record_match(uuid,text,integer,integer,text,integer) from public,anon;
grant execute on function public.record_match(uuid,text,integer,integer,text,integer) to authenticated;

create or replace function public.delete_own_account()
returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 delete from auth.users where id=auth.uid();
 if not found then raise exception 'Account no longer exists'; end if;
end; $$;
revoke all on function public.delete_own_account() from public,anon;
grant execute on function public.delete_own_account() to authenticated;

-- Non-destructive migration: run AFTER supabase.sql, including on existing projects.
-- Private client-reported progression. This is NOT a trusted competitive ranking.
create table if not exists public.progression_matches (
  user_id uuid not null references auth.users(id) on delete cascade,
  match_id uuid not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  primary key(user_id, match_id),
  constraint progression_payload_valid check ((
    jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 64000
    and payload->>'id' = match_id::text
    and payload->>'completed' = 'true' and payload->>'practice' = 'false'
    and payload->>'result' in ('victory','defeat','draw')
    and payload->>'mode' in ('gridiron','turnpike','zombies','dungeon','boss','ctf','gauntlet','gauntlet-team','roulette','ffa','tdm','war','rush','corruption')
    and jsonb_typeof(payload->'stats') = 'object'
    and jsonb_typeof(payload->'forms') = 'object'
    and jsonb_typeof(payload->'objectives') = 'object'
  ) is true)
);
create table if not exists public.progression_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  earned jsonb not null default '{"achievements":{},"unlocks":{}}'::jsonb check(jsonb_typeof(earned)='object' and octet_length(earned::text)<=32000),
  equipped jsonb not null default '{}'::jsonb check(jsonb_typeof(equipped)='object' and octet_length(equipped::text)<=4096),
  updated_at timestamptz not null default now()
);
alter table public.progression_matches enable row level security;
alter table public.progression_preferences enable row level security;
drop policy if exists "Read own progression" on public.progression_matches;
create policy "Read own progression" on public.progression_matches for select to authenticated using(auth.uid()=user_id);
drop policy if exists "Append own completed matches" on public.progression_matches;
create policy "Append own completed matches" on public.progression_matches for insert to authenticated with check(auth.uid()=user_id);
-- No update/delete policies: completed match receipts are immutable and idempotent.
drop policy if exists "Read own cosmetics" on public.progression_preferences;
create policy "Read own cosmetics" on public.progression_preferences for select to authenticated using(auth.uid()=user_id);
revoke all on public.progression_matches, public.progression_preferences from public, anon, authenticated;
grant select,insert on public.progression_matches to authenticated;
grant select on public.progression_preferences to authenticated;
create or replace function public.save_progression_cosmetics(p_user_id uuid,p_equipped jsonb,p_updated_at timestamptz,p_earned jsonb)
returns void language plpgsql security definer set search_path='' as $$
begin
  if p_user_id is null or auth.uid() is distinct from p_user_id then raise exception 'Account changed'; end if;
  if p_equipped is null or jsonb_typeof(p_equipped)<>'object' or octet_length(p_equipped::text)>4096
     or p_earned is null or (jsonb_typeof(p_earned->'achievements') = 'object' and jsonb_typeof(p_earned->'unlocks') = 'object') is not true or octet_length(p_earned::text)>32000
     or p_updated_at is null or p_updated_at>now()+interval '5 minutes'
  then raise exception 'Invalid cosmetics'; end if;
  insert into public.progression_preferences(user_id,equipped,updated_at,earned)
  values(auth.uid(),p_equipped,p_updated_at,p_earned)
  on conflict(user_id) do update set
    equipped=case when public.progression_preferences.updated_at < excluded.updated_at then excluded.equipped else public.progression_preferences.equipped end,
    updated_at=greatest(public.progression_preferences.updated_at,excluded.updated_at),
    earned=jsonb_build_object(
      'achievements',(excluded.earned->'achievements') || (public.progression_preferences.earned->'achievements'),
      'unlocks',(excluded.earned->'unlocks') || (public.progression_preferences.earned->'unlocks')
    );
end; $$;
revoke all on function public.save_progression_cosmetics(uuid,jsonb,timestamptz,jsonb) from public,anon;
grant execute on function public.save_progression_cosmetics(uuid,jsonb,timestamptz,jsonb) to authenticated;

notify pgrst, 'reload schema';
commit;

-- Verification: both rows must say true; counts may legitimately be zero.
select to_regclass('public.leaderboard') is not null as leaderboard_ready,
       to_regclass('public.progression_matches') is not null as progression_ready,
       to_regprocedure('public.delete_own_account()') is not null as deletion_ready;
select user_id,username,kills,deaths,wins,losses,kd_ratio from public.leaderboard limit 5;
