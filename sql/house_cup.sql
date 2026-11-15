-- ============================================================
-- LKCMedSoc: the House Cup (house points and ranking), one academic year (AY) at a time.
-- Run once in the Supabase SQL editor (project: lkcmedsoc-inventory). Safe to re-run.
-- Needs activities.is_exco() and house rows in records.bodies (level = 'House').
--
-- How it works
--   * Each year ExCo lists its own "reasons" (Sports Day, Quiz Night ...). Every reason has ONE entry: a number for every house.
--   * Every reason has a weight (a percentage). A house's score for a reason is its SHARE of the points all houses earned
--     for that reason, times the weight. So only the ratios matter: 100/50/50 and 10000/5000/5000 give the same result.
--   * A house's total is the sum over reasons, out of 100. Ties share a rank.
--   * Before a year is final, if the weights do not add to 100 they are scaled to 100 for the ranking, and the page warns.
--   * The public sees shares and weighted scores only. Raw points are only returned to ExCo (house_cup_reason_points).
--   * Marking a year final locks it: no reason can be added, changed, re-weighted or deleted until ExCo reopens it.
-- Who may edit: ExCo (activities.is_exco()). Change the check in house_cup_guard() if that should widen.
-- ============================================================

-- Which academic year a date belongs to (a year starts 1 August). Same definition as sql/ay_layer.sql, repeated so this file runs on its own.
create or replace function records.ay_for(d date) returns text
language sql immutable as $$
  select 'AY' || lpad(y::text, 2, '0') || '/' || lpad(((y + 1) % 100)::text, 2, '0')
  from (select (extract(year from d)::int - (extract(month from d) < 8)::int) % 100 as y) s     -- 8 = August
$$;
grant execute on function records.ay_for(date) to public;

create table if not exists activities.house_cup_reasons (
  id uuid primary key default gen_random_uuid(),
  ay text not null check (ay ~ '^AY[0-9]{2}/[0-9]{2}$'),
  name text not null check (length(trim(name)) between 1 and 80),
  weight_pct numeric(5, 2) not null default 0 check (weight_pct >= 0 and weight_pct <= 100),
  awarded_on date not null default ((now() at time zone 'Asia/Singapore')::date),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists house_cup_reasons_name on activities.house_cup_reasons (ay, lower(trim(name)));

create table if not exists activities.house_cup_scores (
  reason_id uuid not null references activities.house_cup_reasons (id) on delete cascade,
  house_id uuid not null references records.bodies (id),
  points numeric(12, 2) not null check (points >= 0),
  primary key (reason_id, house_id)
);

create table if not exists activities.house_cup_years (
  ay text primary key check (ay ~ '^AY[0-9]{2}/[0-9]{2}$'),
  is_final boolean not null default false,
  finalised_at timestamptz
);

-- No direct table access: everything goes through the functions below.
alter table activities.house_cup_reasons enable row level security;
alter table activities.house_cup_scores enable row level security;
alter table activities.house_cup_years enable row level security;
revoke all on activities.house_cup_reasons, activities.house_cup_scores, activities.house_cup_years from public, anon, authenticated;

-- ---------- guards ----------
create or replace function activities.house_cup_guard(p_ay text, p_allow_final boolean default false) returns void
language plpgsql stable security definer set search_path = activities, records, public as $$
begin
  if not activities.is_exco() then raise exception 'ExCo only'; end if;
  if p_ay is null or p_ay !~ '^AY[0-9]{2}/[0-9]{2}$' then raise exception 'Academic year looks like AY26/27'; end if;
  if not p_allow_final and exists (select 1 from house_cup_years where ay = p_ay and is_final) then
    raise exception '% is final. Reopen it to make changes.', p_ay;
  end if;
end $$;

-- ---------- what the public reads ----------
-- The whole table for one year: houses with totals and ranks, reasons with each house's share and weighted score.
create or replace function activities.house_cup(p_ay text default null) returns jsonb
language plpgsql stable security definer set search_path = activities, records, public as $$
declare v_ay text := coalesce(p_ay, records.ay_for(current_date));
        wsum numeric; fin boolean; houses jsonb; reasons jsonb;
begin
  select coalesce(sum(weight_pct), 0) into wsum from house_cup_reasons where ay = v_ay;
  select exists (select 1 from house_cup_years where ay = v_ay and is_final) into fin;

  with hs as (select id, name, color from records.bodies where level = 'House' and status = 'Active'),
  rs as (
    select r.id, r.name, r.weight_pct, r.awarded_on, r.created_at,
           case when wsum > 0 then r.weight_pct * 100 / wsum else 0 end as ew,
           coalesce((select sum(s.points) from house_cup_scores s where s.reason_id = r.id), 0) as pool
      from house_cup_reasons r where r.ay = v_ay),
  cells as (
    select rs.id as rid, hs.id as hid, rs.ew,
           case when rs.pool > 0 then coalesce(s.points, 0) / rs.pool else 0 end as share
      from rs cross join hs
      left join house_cup_scores s on s.reason_id = rs.id and s.house_id = hs.id),
  tot as (select hid, round(sum(share * ew), 2) as t from cells group by hid),
  ranked as (
    select hs.id, hs.name, hs.color, coalesce(tot.t, 0) as t, rank() over (order by coalesce(tot.t, 0) desc) as rk
      from hs left join tot on tot.hid = hs.id)
  select
    (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name, 'color', color, 'total', t, 'rank', rk) order by rk, name), '[]'::jsonb) from ranked),
    (select coalesce(jsonb_agg(jsonb_build_object(
        'id', rs.id, 'name', rs.name, 'weight', rs.weight_pct, 'effective_weight', round(rs.ew, 2), 'awarded_on', rs.awarded_on,
        'cells', (select jsonb_agg(jsonb_build_object('house_id', c.hid, 'share', round(c.share, 4), 'weighted', round(c.share * c.ew, 2)) order by h.name)
                    from cells c join hs h on h.id = c.hid where c.rid = rs.id)
      ) order by rs.awarded_on, rs.created_at), '[]'::jsonb) from rs)
  into houses, reasons;

  return jsonb_build_object('ay', v_ay, 'is_final', fin, 'weights_total', wsum, 'houses', houses, 'reasons', reasons);
end $$;

-- Years to flip between: every year that has a reason, plus the current year. Newest first.
create or replace function activities.house_cup_years() returns jsonb
language sql stable security definer set search_path = activities, records, public as $$
  select coalesce(jsonb_agg(ay order by ay desc), '[]'::jsonb)
  from (select ay from house_cup_reasons union select records.ay_for(current_date)) t
$$;

-- ---------- what ExCo reads and writes ----------
-- One reason with the raw points per house (for the editor).
create or replace function activities.house_cup_reason_points(p_reason uuid) returns jsonb
language plpgsql stable security definer set search_path = activities, records, public as $$
declare r house_cup_reasons;
begin
  if not activities.is_exco() then raise exception 'ExCo only'; end if;
  select * into r from house_cup_reasons where id = p_reason;
  if not found then raise exception 'Reason not found'; end if;
  return jsonb_build_object('id', r.id, 'ay', r.ay, 'name', r.name, 'weight', r.weight_pct, 'awarded_on', r.awarded_on,
    'scores', (select coalesce(jsonb_object_agg(house_id::text, points), '{}'::jsonb) from house_cup_scores where reason_id = r.id));
end $$;

-- The save itself, with no sign-in check, so it can be tested. Use save_house_cup_reason from the app.
-- p_scores is {"<house id>": number, ...} and must name every active house, once, with a number of 0 or more.
create or replace function activities.house_cup_save_core(p_id uuid, p_ay text, p_name text, p_weight numeric, p_on date, p_scores jsonb) returns uuid
language plpgsql security definer set search_path = activities, records, public as $$
declare v_id uuid := p_id; v_ay text := p_ay; v_name text := trim(coalesce(p_name, '')); hid uuid; k text; v numeric; n int;
begin
  if v_name = '' then raise exception 'Give the reason a name.'; end if;
  if length(v_name) > 80 then raise exception 'The reason name is too long (80 characters at most).'; end if;
  if p_weight is null or p_weight < 0 or p_weight > 100 then raise exception 'The weight must be between 0 and 100.'; end if;
  if p_scores is null or jsonb_typeof(p_scores) <> 'object' then raise exception 'Enter points for every house.'; end if;

  if v_id is not null then
    select ay into v_ay from house_cup_reasons where id = v_id;
    if not found then raise exception 'Reason not found'; end if;
  end if;
  if exists (select 1 from house_cup_years where ay = v_ay and is_final) then raise exception '% is final. Reopen it to make changes.', v_ay; end if;
  if exists (select 1 from house_cup_reasons where ay = v_ay and lower(trim(name)) = lower(v_name) and id is distinct from v_id) then
    raise exception 'This year already has a reason called "%". Open it to change its points.', v_name;
  end if;

  select count(*) into n from records.bodies where level = 'House' and status = 'Active';
  if n = 0 then raise exception 'There are no active houses.'; end if;
  for hid in select id from records.bodies where level = 'House' and status = 'Active' loop
    if not (p_scores ? hid::text) or jsonb_typeof(p_scores -> hid::text) <> 'number' then
      raise exception 'Every house needs a number. % is missing one.', (select name from records.bodies where id = hid);
    end if;
    if (p_scores ->> hid::text)::numeric < 0 then raise exception 'Points cannot be negative.'; end if;
  end loop;
  for k in select jsonb_object_keys(p_scores) loop
    if not exists (select 1 from records.bodies where id::text = k and level = 'House' and status = 'Active') then
      raise exception 'Unknown house in the points.';
    end if;
  end loop;

  if v_id is null then
    insert into house_cup_reasons (ay, name, weight_pct, awarded_on) values (v_ay, v_name, p_weight, coalesce(p_on, (now() at time zone 'Asia/Singapore')::date))
      returning id into v_id;
  else
    update house_cup_reasons set name = v_name, weight_pct = p_weight, awarded_on = coalesce(p_on, awarded_on), updated_at = now() where id = v_id;
    delete from house_cup_scores where reason_id = v_id;
  end if;
  for k, v in select key, value::numeric from jsonb_each_text(p_scores) loop
    insert into house_cup_scores (reason_id, house_id, points) values (v_id, k::uuid, v);
  end loop;
  return v_id;
end $$;

create or replace function activities.save_house_cup_reason(p_id uuid, p_ay text, p_name text, p_weight numeric, p_on date, p_scores jsonb) returns uuid
language plpgsql security definer set search_path = activities, records, public as $$
declare v_ay text := p_ay;
begin
  if p_id is not null then select ay into v_ay from house_cup_reasons where id = p_id; end if;
  perform activities.house_cup_guard(v_ay);
  return activities.house_cup_save_core(p_id, p_ay, p_name, p_weight, p_on, p_scores);
end $$;

-- Change several weights at once. p_weights is {"<reason id>": number, ...}.
create or replace function activities.save_house_cup_weights(p_ay text, p_weights jsonb) returns void
language plpgsql security definer set search_path = activities, records, public as $$
declare k text; v numeric;
begin
  perform activities.house_cup_guard(p_ay);
  for k, v in select key, value::numeric from jsonb_each_text(p_weights) loop
    if v < 0 or v > 100 then raise exception 'A weight must be between 0 and 100.'; end if;
    update house_cup_reasons set weight_pct = v, updated_at = now() where id = k::uuid and ay = p_ay;
  end loop;
end $$;

create or replace function activities.delete_house_cup_reason(p_id uuid) returns void
language plpgsql security definer set search_path = activities, records, public as $$
declare v_ay text;
begin
  select ay into v_ay from house_cup_reasons where id = p_id;
  if not found then raise exception 'Reason not found'; end if;
  perform activities.house_cup_guard(v_ay);
  delete from house_cup_reasons where id = p_id;
end $$;

-- Lock or reopen a year. Locking needs at least one reason and weights that add to 100.
create or replace function activities.set_house_cup_final(p_ay text, p_final boolean) returns void
language plpgsql security definer set search_path = activities, records, public as $$
declare wsum numeric; n int;
begin
  perform activities.house_cup_guard(p_ay, true);
  if p_final then
    select coalesce(sum(weight_pct), 0), count(*) into wsum, n from house_cup_reasons where ay = p_ay;
    if n = 0 then raise exception 'Add at least one reason first.'; end if;
    if round(wsum, 2) <> 100 then raise exception 'The weights add to %, not 100. Fix them before marking the year final.', wsum; end if;
  end if;
  insert into house_cup_years (ay, is_final, finalised_at) values (p_ay, p_final, case when p_final then now() end)
    on conflict (ay) do update set is_final = excluded.is_final, finalised_at = excluded.finalised_at;
end $$;

-- ---------- permissions ----------
revoke execute on function
  activities.house_cup_guard(text, boolean), activities.house_cup(text), activities.house_cup_years(),
  activities.house_cup_reason_points(uuid), activities.house_cup_save_core(uuid, text, text, numeric, date, jsonb),
  activities.save_house_cup_reason(uuid, text, text, numeric, date, jsonb), activities.save_house_cup_weights(text, jsonb),
  activities.delete_house_cup_reason(uuid), activities.set_house_cup_final(text, boolean)
  from public, anon, authenticated;
grant execute on function activities.house_cup(text), activities.house_cup_years() to anon, authenticated;
grant execute on function activities.house_cup_reason_points(uuid), activities.save_house_cup_reason(uuid, text, text, numeric, date, jsonb),
  activities.save_house_cup_weights(text, jsonb), activities.delete_house_cup_reason(uuid), activities.set_house_cup_final(text, boolean)
  to authenticated;

-- Review: the current year as the public sees it
select activities.house_cup();
