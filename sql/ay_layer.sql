-- ============================================================
-- LKCMedSoc: tie every write-up to an ExCo year (academic year), and let the website filter news by it.
-- Run AFTER activities_posts.sql (and again after any re-run of that file only if posts_set_ay goes missing). Safe to re-run.
--
-- The rule for "which year does something belong to" lives in ONE place: records.ay_for(date) below.
-- As written, a new year starts on 1 August (AY26/27 = 1 Aug 2026 to 31 Jul 2027). If your ExCo hands over on a
-- different date, change the number 8 in that function and re-run the backfill at the bottom.
-- A post belongs to the year of its event (if it is linked to one), otherwise the year it was published.
-- ExCo can correct any post with  select activities.set_post_ay('<post id>', 'AY24/25');
-- ============================================================

-- The earlier draft of the honour roll table is no longer used. Drop it only if it is empty.
do $$ begin
  if to_regclass('records.honour_roll') is not null and not exists (select 1 from records.honour_roll) then
    drop view if exists records.public_honour_roll;
    drop table records.honour_roll;
  end if;
end $$;

create or replace function records.ay_for(d date) returns text
language sql immutable as $$
  select 'AY' || lpad(y::text, 2, '0') || '/' || lpad(((y + 1) % 100)::text, 2, '0')
  from (select (extract(year from d)::int - (extract(month from d) < 8)::int) % 100 as y) s     -- 8 = August
$$;
grant execute on function records.ay_for(date) to public;

alter table activities.posts add column if not exists ay text;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'posts_ay_format') then
    alter table activities.posts add constraint posts_ay_format check (ay is null or ay ~ '^AY[0-9]{2}/[0-9]{2}$');
  end if;
end $$;
create index if not exists posts_ay_idx on activities.posts (ay, published_at desc);

-- Set the year automatically when a post is published (only if it has none yet)
create or replace function activities.posts_set_ay() returns trigger
language plpgsql security definer set search_path = activities, records, public as $$
declare d date;
begin
  if new.status = 'Published' and new.ay is null then
    select a.start_date::date into d from activities.activities a where a.id = new.activity_id;
    new.ay := records.ay_for(coalesce(d, (coalesce(new.published_at, now()) at time zone 'Asia/Singapore')::date));
  end if;
  return new;
end $$;
drop trigger if exists posts_set_ay on activities.posts;
create trigger posts_set_ay before insert or update on activities.posts for each row execute function activities.posts_set_ay();

-- Backfill: every published post that has no year yet
update activities.posts p set ay = records.ay_for(coalesce(
    (select a.start_date::date from activities.activities a where a.id = p.activity_id),
    (p.published_at at time zone 'Asia/Singapore')::date))
where p.status = 'Published' and p.ay is null;

-- ExCo can correct a post's year
create or replace function activities.set_post_ay(p_id uuid, p_ay text) returns void
language plpgsql security definer set search_path = activities, records, public as $$
begin
  if not activities.is_exco() then raise exception 'ExCo only'; end if;
  if p_ay !~ '^AY[0-9]{2}/[0-9]{2}$' then raise exception 'Academic year looks like AY25/26'; end if;
  update activities.posts set ay = p_ay, updated_at = now() where id = p_id;
  if not found then raise exception 'Post not found'; end if;
end $$;

-- ---------- What the public website reads ----------
create or replace function activities.public_posts_ay(p_ay text default null, p_limit int default 12, p_offset int default 0,
                                                      p_category text default null) returns jsonb
language plpgsql stable security definer set search_path = activities, records, public as $$
declare lim int := least(greatest(coalesce(p_limit, 12), 1), 50); off int := greatest(coalesce(p_offset, 0), 0);
        tot int; items jsonb;
begin
  select count(*) into tot from posts
   where status = 'Published' and (p_ay is null or ay = p_ay) and (p_category is null or category = p_category);
  select coalesce(jsonb_agg(j order by pa desc, sl), '[]'::jsonb) into items from (
    select jsonb_build_object(
             'slug', p.slug, 'title', p.title, 'summary', p.summary, 'category', p.category, 'ay', p.ay,
             'published_at', p.published_at,
             'body', (select name from records.bodies where id = p.body_id),
             'author', case when p.show_author then p.author_name end,
             'cover', (select path from post_photos where post_id = p.id order by ord, created_at limit 1),
             'event', (select jsonb_build_object('id', a.id, 'title', a.title, 'start_date', a.start_date)
                       from activities a where a.id = p.activity_id and a.status in ('Approved', 'Completed') and a.visibility = 'Public')
           ) as j, p.published_at as pa, p.slug as sl
    from posts p
    where p.status = 'Published' and (p_ay is null or p.ay = p_ay) and (p_category is null or p.category = p_category)
    order by p.published_at desc, p.slug limit lim offset off) q;
  return jsonb_build_object('total', tot, 'items', items);
end $$;

-- The year of one published post (for the "AY25/26 · 13th ExCo" line on the post page)
create or replace function activities.public_post_ay(p_slug text) returns text
language sql stable security definer set search_path = activities, public as $$
  select ay from posts where slug = p_slug and status = 'Published'
$$;

-- Years that have published posts, with counts (for the year filter on the News page)
create or replace function activities.public_post_years() returns jsonb
language sql stable security definer set search_path = activities, public as $$
  select coalesce(jsonb_agg(jsonb_build_object('ay', ay, 'n', n) order by ay desc), '[]'::jsonb)
  from (select ay, count(*) as n from posts where status = 'Published' and ay is not null group by ay) t
$$;

revoke execute on function activities.public_posts_ay(text, int, int, text), activities.public_post_ay(text),
  activities.public_post_years(), activities.set_post_ay(uuid, text) from public, anon, authenticated;
grant execute on function activities.public_posts_ay(text, int, int, text), activities.public_post_ay(text),
  activities.public_post_years() to anon, authenticated;
grant execute on function activities.set_post_ay(uuid, text) to authenticated;

-- Review: what year did each post get?
select slug, published_at::date as published, ay from activities.posts where status = 'Published' order by published_at desc;
