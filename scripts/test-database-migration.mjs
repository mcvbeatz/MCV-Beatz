const { PGlite } = await import(
  process.env.PGLITE_MODULE || "@electric-sql/pglite"
);
import fs from "node:fs";
import assert from "node:assert/strict";
const root = new URL("../", import.meta.url).pathname;
const sql = fs.readFileSync(root + "backend/update-v058.sql", "utf8");
const bootstrap = `create role anon; create role authenticated; create schema auth;
create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}'::jsonb);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;`;
const id = "00000000-0000-4000-8000-000000000001",
  other = "00000000-0000-4000-8000-000000000002";
for (const prior of ["fresh", "legacy", "v057", "broken-view"]) {
  const db = new PGlite();
  await db.exec(bootstrap);
  if (prior !== "fresh") {
    const original = fs.readFileSync(root + "backend/supabase.sql", "utf8");
    await db.exec(original);
    await db.exec(`insert into auth.users values('${id}','{"username":"Tester"}');
   update public.player_stats set kills=150,deaths=15,wins=4,losses=1;
   insert into public.match_results(match_id,user_id,mode,kills,deaths,result,duration) values
   ('10000000-0000-4000-8000-000000000001','${id}','ffa',10,1,'victory',180),
   ('10000000-0000-4000-8000-000000000002','${id}','dungeon',20,2,'victory',180),
   ('10000000-0000-4000-8000-000000000003','${id}','zombies',30,3,'defeat',180),
   ('10000000-0000-4000-8000-000000000004','${id}','gauntlet',40,4,'victory',180),
   ('10000000-0000-4000-8000-000000000005','${id}','gauntlet-team',50,5,'victory',180);`);
    if (prior === "v057")
      await db.exec(
        fs.readFileSync(root + "backend/session-stats.sql", "utf8"),
      );
  }
  if (prior === "broken-view")
    await db.exec(
      "drop view public.leaderboard; create view public.leaderboard as select 0 as old_column;",
    );
  await db.exec(sql);
  await db.exec(sql);
  if (prior === "fresh")
    await db.exec(
      `insert into auth.users values('${id}','{"username":"Tester"}');`,
    );
  else {
    const [s] = (
      await db.query("select kills,deaths,wins,losses from public.player_stats")
    ).rows;
    assert.deepEqual(s, { kills: 10, deaths: 6, wins: 2, losses: 1 });
  }
  await db.exec(`insert into auth.users values('${other}','{"username":"Other"}');
 set role authenticated; select set_config('request.jwt.claim.sub','${id}',false);`);
  await db.query(
    "select user_id,username,kills,deaths,wins,losses,kd_ratio from public.leaderboard",
  );
  const before = (
    await db.query(`select * from public.player_stats where user_id='${id}'`)
  ).rows[0];
  await db.exec(
    `select public.record_match('20000000-0000-4000-8000-000000000001','gauntlet',50,5,'victory',100);`,
  );
  assert.deepEqual(
    (await db.query(`select * from public.player_stats where user_id='${id}'`))
      .rows[0],
    before,
  );
  const payload = JSON.stringify({
    id: "30000000-0000-4000-8000-000000000001",
    completed: true,
    practice: false,
    result: "victory",
    mode: "ffa",
    stats: {},
    forms: {},
    objectives: {},
  });
  await db.query(
    "insert into public.progression_matches(user_id,match_id,payload) values($1,$2,$3)",
    [id, "30000000-0000-4000-8000-000000000001", payload],
  );
  await assert.rejects(
    db.query(
      "insert into public.progression_matches(user_id,match_id,payload) values($1,$2,$3)",
      [other, "30000000-0000-4000-8000-000000000001", payload],
    ),
    /row-level security/,
  );
  await db.exec("set role anon");
  await assert.rejects(
    db.query("select public.delete_own_account()"),
    /permission denied/,
  );
  await db.exec(
    `set role authenticated; select public.delete_own_account(); reset role;`,
  );
  assert.equal(
    (await db.query(`select * from auth.users where id='${id}'`)).rows.length,
    0,
  );
  assert.equal(
    (
      await db.query(
        `select * from public.progression_matches where user_id='${id}'`,
      )
    ).rows.length,
    0,
  );
  assert.equal(
    (await db.query(`select * from public.profiles where id='${other}'`)).rows
      .length,
    1,
  );
  await db.close();
  console.log(
    prior +
      ": migration, repeat safety, public view, waves exclusion, RLS and self-deletion passed",
  );
}
