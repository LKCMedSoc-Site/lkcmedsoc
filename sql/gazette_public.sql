-- Public Gazette data: featured and tags on the public post functions, and one call that returns everything the Gazette home page needs.
-- Run after post_curation.sql, then run post_categories.sql, which replaces post_card and public_gazette_home from this file. Safe to run more than once. Existing callers keep working: the post functions only gain extra keys
-- ('featured', 'tags', 'ay') and keep their signatures.

-- One card's worth of a published post, shared by the list functions so they stay identical.
create or replace function activities.post_card(p activities.posts)
returns jsonb language sql stable security definer set search_path to 'activities', 'public' as $$
  select jsonb_build_object(
    'slug', p.slug, 'title', p.title, 'summary', p.summary, 'category', p.category, 'ay', p.ay,
    'published_at', p.published_at, 'featured', p.featured, 'tags', to_jsonb(p.tags),
    'body', (select name from records.bodies where id = p.body_id),
    'author', case when p.show_author then p.author_name end,
    'cover', (select path from activities.post_photos where post_id = p.id order by ord, created_at limit 1),
    'event', (select jsonb_build_object('id', a.id, 'title', a.title, 'start_date', a.start_date)
              from activities.activities a where a.id = p.activity_id and a.status in ('Approved', 'Completed') and a.visibility = 'Public'))
$$;
revoke all on function activities.post_card(activities.posts) from public;

create or replace function activities.public_posts(p_limit integer default 12, p_offset integer default 0, p_category text default null, p_activity uuid default null)
returns jsonb language plpgsql stable security definer set search_path to 'activities', 'public' as $$
declare lim int := least(greatest(coalesce(p_limit, 12), 1), 50); off int := greatest(coalesce(p_offset, 0), 0); tot int; items jsonb;
begin
  select count(*) into tot from posts
   where status = 'Published' and (p_category is null or category = p_category) and (p_activity is null or activity_id = p_activity);
  select coalesce(jsonb_agg(j order by pa desc, sl), '[]'::jsonb) into items from (
    select post_card(p) as j, p.published_at as pa, p.slug as sl from posts p
     where p.status = 'Published' and (p_category is null or p.category = p_category) and (p_activity is null or p.activity_id = p_activity)
     order by p.published_at desc, p.slug limit lim offset off) q;
  return jsonb_build_object('total', tot, 'items', items);
end $$;

create or replace function activities.public_posts_ay(p_ay text default null, p_limit integer default 12, p_offset integer default 0, p_category text default null)
returns jsonb language plpgsql stable security definer set search_path to 'activities', 'records', 'public' as $$
declare lim int := least(greatest(coalesce(p_limit, 12), 1), 50); off int := greatest(coalesce(p_offset, 0), 0); tot int; items jsonb;
begin
  select count(*) into tot from posts
   where status = 'Published' and (p_ay is null or ay = p_ay) and (p_category is null or category = p_category);
  select coalesce(jsonb_agg(j order by pa desc, sl), '[]'::jsonb) into items from (
    select post_card(p) as j, p.published_at as pa, p.slug as sl from posts p
     where p.status = 'Published' and (p_ay is null or p.ay = p_ay) and (p_category is null or p.category = p_category)
     order by p.published_at desc, p.slug limit lim offset off) q;
  return jsonb_build_object('total', tot, 'items', items);
end $$;

-- Single post: add featured and tags.
create or replace function activities.public_post(p_slug text)
returns jsonb language plpgsql stable security definer set search_path to 'activities', 'public' as $$
declare p posts%rowtype;
begin
  select * into p from posts where slug = p_slug and status = 'Published';
  if not found then return null; end if;
  return post_card(p) || jsonb_build_object(
    'body_md', p.body_md, 'updated_at', p.updated_at,
    'photos', coalesce((select jsonb_agg(jsonb_build_object('path', f.path, 'caption', f.caption) order by f.ord, f.created_at)
                        from post_photos f where f.post_id = p.id), '[]'::jsonb));
end $$;

-- Gazette home: the featured posts, the latest posts not already featured, the top posts of every category, and the years.
create or replace function activities.public_gazette_home(p_featured integer default 4, p_latest integer default 6, p_per_category integer default 4)
returns jsonb language plpgsql stable security definer set search_path to 'activities', 'public' as $$
declare nf int := least(greatest(coalesce(p_featured, 4), 0), 10); nl int := least(greatest(coalesce(p_latest, 6), 0), 20);
        nc int := least(greatest(coalesce(p_per_category, 4), 1), 12); feat jsonb; fids uuid[];
begin
  select coalesce(array_agg(id), '{}') into fids from (
    select id from posts where status = 'Published' and featured order by published_at desc, slug limit nf) f;
  select coalesce(jsonb_agg(post_card(p) order by p.published_at desc, p.slug), '[]'::jsonb) into feat from posts p where p.id = any(fids);
  return jsonb_build_object(
    'featured', feat,
    'latest', (select coalesce(jsonb_agg(post_card(p) order by p.published_at desc, p.slug), '[]'::jsonb) from (
                 select * from posts where status = 'Published' and not (id = any(fids)) order by published_at desc, slug limit nl) p),
    'categories', (select coalesce(jsonb_agg(jsonb_build_object(
        'category', c.category,
        'total', (select count(*) from posts where status = 'Published' and category = c.category),
        'items', (select coalesce(jsonb_agg(post_card(p) order by p.published_at desc, p.slug), '[]'::jsonb) from (
                    select * from posts where status = 'Published' and category = c.category order by published_at desc, slug limit nc) p)
      ) order by c.ord), '[]'::jsonb)
      from (values ('Announcements', 1), ('Activities', 2), ('Publications', 3), ('Creative', 4)) as c(category, ord)),
    'years', public_post_years());
end $$;

grant execute on function activities.public_posts(integer, integer, text, uuid) to anon, authenticated;
grant execute on function activities.public_posts_ay(text, integer, integer, text) to anon, authenticated;
grant execute on function activities.public_post(text) to anon, authenticated;
grant execute on function activities.public_gazette_home(integer, integer, integer) to anon, authenticated;
