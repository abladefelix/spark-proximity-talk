import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
const { PGlite } = await import(process.env.PGLITE_MODULE || "@electric-sql/pglite");
const db = new PGlite();
const older = readFileSync(new URL("./review-activity.mjs", import.meta.url), "utf8");
const bootstrap = older.slice(
  older.indexOf("await db.exec(`") + "await db.exec(`".length,
  older.indexOf("`);"),
);
await db.exec(bootstrap);
await db.exec(`
alter table profiles add display_name text,add bio text,add avatar_url text,add verified boolean default false,add gender text,add beacon_style text,add intent_expires_at timestamptz,add intent text,add intent_note text,add mood text;
alter table locations add primary key(user_id),add accuracy_m double precision,add is_visible boolean default true,add updated_at timestamptz default now();
alter table messages add kind text default 'text';
alter table reports add id uuid primary key default gen_random_uuid();
create table app_settings(id text primary key,presence_timeout_min integer,max_radius_m integer,support_email text);
insert into app_settings values('global',5,2000,'');
create table pro_features(key text,pro_only boolean);
create table billing_settings(id text, free_max_radius_m integer,pro_extended_radius boolean,enabled boolean,pro_custom_beacon boolean);
create table subscriptions(user_id uuid,status text,expires_at timestamptz);
create table help_beacons(id uuid,user_id uuid,note text);
create function private.is_pro(uuid) returns boolean language sql as $$select false$$;
create function private.is_staff(uuid) returns boolean language sql as $$select $1='99999999-9999-4999-8999-999999999999'::uuid$$;
create function public.admin_set_ban(uuid,boolean,text) returns void language sql as $$update profiles set banned=$2 where id=$1$$;
create function extensions.ST_Azimuth(extensions.geography,extensions.geography) returns double precision language sql immutable as $$select 0::double precision$$;
alter table locations enable row level security;
create policy own_loc on locations for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
grant all on locations to authenticated;
`);
const harden = readFileSync(
  new URL(
    "../../supabase/migrations/20261006013000_harden_broadcast_ugc_for_apple_review.sql",
    import.meta.url,
  ),
  "utf8",
);
await db.exec(
  harden.slice(
    harden.indexOf("create or replace function private.is_objectionable_text"),
    harden.indexOf("create or replace function public.post_broadcast"),
  ),
);
const fixtures = readFileSync(
  new URL("../../supabase/migrations/20261028015428_populate_review_account.sql", import.meta.url),
  "utf8",
);
await db.exec(fixtures);
await db.exec(
  readFileSync(
    new URL(
      "../../supabase/migrations/20261111172711_manual_checkin_and_ugc_safety.sql",
      import.meta.url,
    ),
    "utf8",
  ),
);
await db.exec(readFileSync(new URL("../../supabase/migrations/20261111190027_configurable_checkin_duration.sql", import.meta.url), "utf8"));
const alice = "11111111-1111-4111-8111-111111111111",
  bob = "22222222-2222-4222-8222-222222222222";
for (const [id, name] of [
  [alice, "alice"],
  [bob, "bob"],
]) {
  await db.query("insert into auth.users values($1)", [id]);
  await db.query("insert into profiles(id,username) values($1,$2)", [id, name]);
}
await db.query("select set_config('request.jwt.claim.sub',$1,false)", [alice]);
await db.exec("set role authenticated");
await db.query("insert into locations(user_id,lat,lng,is_visible) values($1,5,0,true)", [alice]);
assert.equal(
  (await db.query("select is_visible from locations")).rows[0].is_visible,
  false,
  "old client cannot auto check in",
);
await assert.rejects(
  () => db.query("insert into private.location_checkins values($1,5,0,1,now())", [alice]),
  /permission denied/,
);
await db.query("select begin_location_checkin(5,0,3)");
assert.equal((await db.query("select is_visible from locations")).rows[0].is_visible, true);
await db.exec("reset role");
const expiry = (await db.query("select expires_at from private.location_checkins")).rows[0]
  .expires_at;
await db.query("update locations set lat=6,updated_at=now(),is_visible=true where user_id=$1", [
  alice,
]);
assert.equal(
  String((await db.query("select expires_at from private.location_checkins")).rows[0].expires_at),
  String(expiry),
  "heartbeat never renews consent",
);
assert.equal(
  (await db.query("select lat from private.location_checkins")).rows[0].lat,
  5,
  "displayed location remains manually chosen snapshot",
);
await db.query("insert into locations(user_id,lat,lng) values($1,5,0)", [bob]);
await db.query("select set_config('request.jwt.claim.sub',$1,false)", [bob]);
assert.equal((await db.query("select * from nearby_people(1000)")).rows.length, 1);
await db.query("update private.location_checkins set expires_at=now()-interval '1 second'");
assert.equal(
  (await db.query("select * from nearby_people(1000)")).rows.length,
  0,
  "expiry prevents display even without client checkout",
);
await db.query("select set_config('request.jwt.claim.sub',$1,false)", [alice]);
await db.query("select begin_location_checkin(5,0,3)");
await db.query("select end_location_checkin()");
await db.query("update locations set is_visible=true where user_id=$1", [alice]);
assert.equal(
  (await db.query("select is_visible from locations where user_id=$1", [alice])).rows[0].is_visible,
  false,
  "cannot restore revoked lease",
);
await assert.rejects(
  () =>
    db.query(
      "insert into broadcasts(user_id,question,options) values($1,'Coffee?',array['Yes','No'])",
      [alice],
    ),
  /Accept the community rules/,
);
await db.query("select accept_community_rules('2026-11-11')");
await assert.rejects(
  () =>
    db.query(
      "insert into broadcasts(user_id,question,options) values($1,'kill yourself',array['Yes','No'])",
      [alice],
    ),
  /content_not_allowed/,
);
const q = (
  await db.query(
    "insert into broadcasts(user_id,question,options,lat,lng,expires_at) values($1,'Coffee?',array['Yes','No'],5,0,now()+interval '15 minutes') returning id",
    [alice],
  )
).rows[0].id;
await db.query("select set_config('request.jwt.claim.sub',$1,false)", [bob]);
await db.query("select accept_community_rules('2026-11-11')");
assert.equal((await db.query("select * from nearby_broadcasts()")).rows.length, 1);
await db.query("select report_broadcast($1,'Offensive question test')", [q]);
assert.equal(
  (await db.query("select * from nearby_broadcasts()")).rows.length,
  0,
  "report immediately removes post from reporter feed",
);
await db.query("select set_config('request.jwt.claim.sub',$1,false)", [alice]);
assert.equal(
  (await db.query("select * from nearby_broadcasts()")).rows.length,
  1,
  "hide does not delete another person post",
);
const m = (
  await db.query("insert into matches(user_a,user_b) values($1,$2) returning id", [alice, bob])
).rows[0].id;
await assert.rejects(
  () =>
    db.query("insert into messages(match_id,sender_id,content) values($1,$2,'kill yourself')", [
      m,
      alice,
    ]),
  /content_not_allowed/,
);
await db.query("update profiles set banned=true where id=$1", [alice]);
await assert.rejects(
  () =>
    db.query("insert into messages(match_id,sender_id,content) values($1,$2,'hello')", [m, alice]),
  /Account suspended/,
);
await assert.rejects(() => db.query("select begin_location_checkin(5,0,3)"), /Account suspended/);
// The combined moderation action must be staff-only and remove the offender's content.
const reportId = (await db.query('select id from reports limit 1')).rows[0].id;
await assert.rejects(() => db.query('select admin_enforce_content_report($1)', [reportId]), /not authorized/);
await db.query("select set_config('request.jwt.claim.sub','99999999-9999-4999-8999-999999999999',false)");
await db.query('select admin_enforce_content_report($1)', [reportId]);
assert.equal((await db.query('select * from broadcasts where user_id=$1', [alice])).rows.length, 0);
assert.equal((await db.query('select banned from profiles where id=$1', [alice])).rows[0].banned, true);
assert.ok((await db.query('select actioned_at from reports where id=$1', [reportId])).rows[0].actioned_at);
// Members cannot forge another member's agreement or hidden-post preferences.
await db.query("select set_config('request.jwt.claim.sub',$1,false)", [bob]);
await db.exec('set role authenticated');
assert.equal((await db.query('select * from community_acceptances')).rows.length, 1);
await assert.rejects(() => db.query("update community_acceptances set version='forged'"), /permission denied/);
await db.exec('reset role');
// Server age gate cannot be lowered through settings.
await db.exec(`alter table app_settings add min_age integer default 13;
alter table profiles add date_of_birth date;
create trigger test_age before update of date_of_birth on profiles for each row execute function enforce_min_age();`);
await assert.rejects(() => db.query("update profiles set date_of_birth=current_date-interval '17 years' where id=$1", [bob]), /at least 18/);
await db.query("update profiles set date_of_birth=current_date-interval '20 years' where id=$1", [bob]);
// A chosen duration is applied only by the next explicit check-in.
await db.query("select set_config('request.jwt.claim.sub',$1,false)", [bob]);
for (const minutes of [15,30,60,120]) {
  await db.query('update profiles set checkin_duration_minutes=$1 where id=$2', [minutes,bob]);
  await db.query('select begin_location_checkin(5,0,3)');
  const remaining = Number((await db.query('select extract(epoch from (expires_at-now())) as seconds from private.location_checkins where user_id=$1',[bob])).rows[0].seconds);
  assert.ok(remaining > minutes*60-5 && remaining <= minutes*60, 'selected duration is honored');
}
const longExpiry = (await db.query('select expires_at from private.location_checkins where user_id=$1',[bob])).rows[0].expires_at;
await db.query('update profiles set checkin_duration_minutes=15 where id=$1',[bob]);
assert.equal(String((await db.query('select expires_at from private.location_checkins where user_id=$1',[bob])).rows[0].expires_at),String(longExpiry),'preference changes never modify an active check-in');
await assert.rejects(()=>db.query('update profiles set checkin_duration_minutes=0 where id=$1',[bob]),/check constraint/);
await assert.rejects(()=>db.query('update profiles set checkin_duration_minutes=240 where id=$1',[bob]),/check constraint/);
// A long check-in is not silently hidden by the old heartbeat grace period.
await db.query("update locations set updated_at=now()-interval '45 minutes' where user_id=$1",[bob]);
await db.query('update profiles set banned=false where id=$1',[alice]);
await db.query("select set_config('request.jwt.claim.sub',$1,false)",[alice]);
assert.equal((await db.query('select * from nearby_people(1000)')).rows[0].is_online,true);
await db.query("update private.location_checkins set expires_at=now()-interval '1 second' where user_id=$1",[bob]);
assert.equal((await db.query('select * from nearby_people(1000)')).rows.length,0,'long check-ins still expire');
await db.exec(`alter table profiles enable row level security;
create policy test_own_duration on profiles for all to authenticated using(id=auth.uid()) with check(id=auth.uid());
grant select(id) on profiles to authenticated;`);
await db.query("select set_config('request.jwt.claim.sub',$1,false)",[bob]);
await db.exec('set role authenticated');
assert.equal((await db.query('update profiles set checkin_duration_minutes=60 where id=$1 returning checkin_duration_minutes',[alice])).rows.length,0,'members cannot change another member duration');
assert.equal((await db.query('update profiles set checkin_duration_minutes=60 where id=$1 returning checkin_duration_minutes',[bob])).rows[0].checkin_duration_minutes,60);
await db.exec('reset role');
await db.close();
console.log(
  "PASS: default hidden, direct-write guard, manual snapshot, no renewal, expiry, revocation, EULA, filtering, immediate report hiding and banned-user posting",
);
