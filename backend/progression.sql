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
