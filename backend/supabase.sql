-- Run once in your Supabase project's SQL editor. Enable email confirmation and
-- set Site URL + allowed redirect URL to https://mcvbeatz.github.io/MCV-Beatz/.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null check (username ~ '^[A-Za-z0-9_]{3,24}$)
);
create unique index profiles_username_unique on public.profiles(lower(username));
create table public.player_stats (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  kills bigint not null default 0, deaths bigint not null default 0,
  wins bigint not null default 0, losses bigint not null default 0
);
create table public.match_results (
  match_id uuid primary key, user_id uuid not null references public.profiles(id) on delete cascade,
  mode text not null, kills integer not null, deaths integer not null,
  result text not null, duration integer not null, created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
alter table public.player_stats enable row level security;
alter table public.match_results enable row level security;
create policy "Public usernames" on public.profiles for select using (true);
create policy "Public leaderboard stats" on public.player_stats for select using (true);
create policy "Own match history" on public.match_results for select to authenticated using (auth.uid()=user_id);
-- No client insert/update/delete policies: writes go only through the validated RPC.
create function public.create_player_profile() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.profiles(id,username) values(new.id,new.raw_user_meta_data->>'username');
 insert into public.player_stats(user_id) values(new.id);
 return new;
end; $$;
create trigger on_player_created after insert on auth.users for each row execute function public.create_player_profile();
create view public.leaderboard with (security_invoker=true) as
 select p.id as user_id,p.username,s.kills,s.deaths,s.wins,s.losses,
 round(s.kills::numeric/greatest(s.deaths,1),2) as kd_ratio
 from public.profiles p join public.player_stats s on s.user_id=p.id;
grant select on public.profiles, public.player_stats, public.leaderboard to anon,authenticated;
grant select on public.match_results to authenticated;
create function public.record_match(p_match_id uuid,p_mode text,p_kills integer,p_deaths integer,p_result text,p_duration integer)
returns void language plpgsql security definer set search_path='' as $$
declare inserted integer;
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 if p_mode not in ('boss','ctf','domination','gauntlet','gauntlet-team','roulette','ffa','tdm','rush','corruption')
   or p_kills is null or p_kills not between 0 and 10000 or p_deaths is null or p_deaths not between 0 and 1000
   or p_result is null or p_result not in ('victory','defeat','draw') or p_duration is null or p_duration not between 0 and 10800
 then raise exception 'Invalid match result'; end if;
 insert into public.match_results(match_id,user_id,mode,kills,deaths,result,duration)
 values(p_match_id,auth.uid(),p_mode,p_kills,p_deaths,p_result,p_duration) on conflict do nothing;
 get diagnostics inserted = row_count;
 if inserted=1 then
  update public.player_stats set kills=kills+p_kills,deaths=deaths+p_deaths,
   wins=wins+case when p_result='victory' then 1 else 0 end,
   losses=losses+case when p_result='defeat' then 1 else 0 end where user_id=auth.uid();
 end if;
end; $$;
revoke all on function public.record_match(uuid,text,integer,integer,text,integer) from public,anon;
grant execute on function public.record_match(uuid,text,integer,integer,text,integer) to authenticated;
