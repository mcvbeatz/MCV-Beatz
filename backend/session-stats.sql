-- Existing projects: run once after the original account schema. Safe to rerun.
-- Preserve match history while excluding Dungeon/Zombies eliminations from public overall K/D.
begin;
alter table public.match_results add column if not exists overall_kills_excluded boolean not null default false;
lock table public.match_results in share row exclusive mode;
with excluded as (
 select user_id, sum(kills) as kills from public.match_results
 where mode in ('dungeon','zombies') and not overall_kills_excluded group by user_id
)
update public.player_stats s set kills=greatest(0,s.kills-e.kills)
from excluded e where s.user_id=e.user_id;
update public.match_results set overall_kills_excluded=true
where mode in ('dungeon','zombies') and not overall_kills_excluded;
create or replace function public.record_match(p_match_id uuid,p_mode text,p_kills integer,p_deaths integer,p_result text,p_duration integer)
returns void language plpgsql security definer set search_path='' as $$
declare inserted integer;
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 if p_mode not in ('gridiron','turnpike','zombies','dungeon','boss','ctf','domination','gauntlet','gauntlet-team','roulette','ffa','tdm','war','rush','corruption')
   or p_kills is null or p_kills not between 0 and 10000 or p_deaths is null or p_deaths not between 0 and 1000
   or p_result is null or p_result not in ('victory','defeat','draw') or p_duration is null or p_duration not between 0 and 10800
 then raise exception 'Invalid match result'; end if;
 insert into public.match_results(match_id,user_id,mode,kills,deaths,result,duration,overall_kills_excluded)
 values(p_match_id,auth.uid(),p_mode,p_kills,p_deaths,p_result,p_duration,p_mode in ('dungeon','zombies')) on conflict do nothing;
 get diagnostics inserted = row_count;
 if inserted=1 then
  update public.player_stats set kills=kills+case when p_mode in ('dungeon','zombies') then 0 else p_kills end,deaths=deaths+p_deaths,
   wins=wins+case when p_result='victory' then 1 else 0 end,
   losses=losses+case when p_result='defeat' then 1 else 0 end where user_id=auth.uid();
 end if;
end; $$;
revoke all on function public.record_match(uuid,text,integer,integer,text,integer) from public,anon;
grant execute on function public.record_match(uuid,text,integer,integer,text,integer) to authenticated;

commit;
