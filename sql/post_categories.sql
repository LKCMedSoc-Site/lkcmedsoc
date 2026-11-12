-- Gazette categories become data: a post_categories table that ExCo edits from the Gazette app, instead of a fixed list in a check constraint.
-- Starting set: Announcements, Activities, Publications, Creative. Run after gazette_public.sql. Safe to run more than once.
-- Impact (16 posts, all project and trip write-ups) and Events (5 posts) become Activities; Stories (none yet) becomes Creative.
-- To undo the Impact part, set those posts back with:
--   update activities.posts set category = 'Impact' where id in ('06a974c8-1f34-503e-aa53-9072df69b16e','21af670a-bee6-5d18-ad9a-c362b2998aa8','2c47c610-837b-52a7-ab51-2b49f8d6634d','3768677c-5809-567d-a452-48ed30f5bcd4','67b40e89-25a5-57fd-a39b-34bb156b356b','7e3cc7a7-2c78-5f4c-a77a-796eabc21702','82c443b6-8ff8-5cce-a7de-0ec6f17f3f4d','8850491f-c1c2-5fb3-a0a7-7aa5eff736fe','a8a29056-5c61-5c2f-a9da-8f18ea1da715','ac90bd78-f81f-5fa2-a2a4-19b79adc0de3','c3438b3d-a8ed-55f9-a3a4-20297c33fe55','c53c3073-f840-5d4c-a1d7-de6012c90785','cc799852-95ff-56b1-a975-9d6b66d5b9d9','e63f4fd3-d7ac-560f-a2f8-89eb66b687da','efabf475-b573-5fc8-aa33-5e807da05c26','f095841e-08bb-503c-ac50-b2c6ce0df31b');
-- (and restore the old posts_category_check; the five Events posts have no recorded ids, they were: Hahahah, Project Prism, Constructing Care, Project Angel, MedFlix).


create table if not exists activities.post_categories (
  name    text primary key check (length(trim(name)) between 2 and 30),
  slug    text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and slug not in ('all', 'topics', 'post')),
  blurb   text check (length(blurb) <= 160),
  ord     integer not null default 100,
  hidden  boolean not null default false,
  tone    smallint not null default 0 check (tone between 0 and 7),   -- which of the eight deepened purples the site uses for its tag colour
  created_at timestamptz not null default now()
);
alter table activities.post_categories enable row level security;
drop policy if exists categories_read on activities.post_categories;
create policy categories_read on activities.post_categories for select using (true);
grant select on activities.post_categories to anon, authenticated;

insert into activities.post_categories (name, slug, blurb, ord, tone) values
  ('Announcements', 'announcements', 'News, calls for applicants and changes you should know about.', 1, 2),
  ('Activities',    'activities',    'Recaps, trip and project write-ups, and photos from what we have been doing.', 2, 0),
  ('Publications',  'publications',  'Quarterly updates, newsletters and reports from MedSoc.', 3, 3),
  ('Creative',      'creative',      'Features, narrative pieces, art and series like Humans of Med.', 4, 1)
on conflict (name) do nothing;

alter table activities.posts drop constraint if exists posts_category_check;
update activities.posts set category = 'Activities' where category in ('Impact', 'Events');
update activities.posts set category = 'Creative' where category = 'Stories';
alter table activities.posts drop constraint if exists posts_category_fkey;
alter table activities.posts add constraint posts_category_fkey
  foreign key (category) references activities.post_categories (name) on update cascade on delete restrict;

-- ExCo adds, renames, reorders and hides categories. A rename keeps the address (slug) so links do not break.
create or replace function activities.save_category(p_old text, p_name text, p_blurb text default null, p_ord integer default null, p_hidden boolean default false)
returns text language plpgsql security definer set search_path to 'activities', 'public' as $$
declare nm text := trim(coalesce(p_name, '')); sl text; n int;
begin
  if not is_exco() then raise exception 'ExCo only'; end if;
  if length(nm) < 2 or length(nm) > 30 then raise exception 'A category name is 2 to 30 characters'; end if;
  if p_old is null then
    sl := trim(both '-' from lower(regexp_replace(nm, '[^a-zA-Z0-9]+', '-', 'g')));
    if sl = '' or sl in ('all', 'topics', 'post') then raise exception 'Pick a different name'; end if;
    if exists (select 1 from post_categories where name = nm or slug = sl) then raise exception 'That category already exists'; end if;
    select count(*) into n from post_categories;
    insert into post_categories (name, slug, blurb, ord, hidden, tone)
    values (nm, sl, nullif(trim(coalesce(p_blurb, '')), ''), coalesce(p_ord, n + 1), coalesce(p_hidden, false), (n % 8)::smallint);
  else
    if nm <> p_old and exists (select 1 from post_categories where name = nm) then raise exception 'That category already exists'; end if;
    update post_categories set name = nm, blurb = nullif(trim(coalesce(p_blurb, '')), ''), ord = coalesce(p_ord, ord), hidden = coalesce(p_hidden, false)
     where name = p_old;
    if not found then raise exception 'Category not found'; end if;
  end if;
  return nm;
end $$;

create or replace function activities.delete_category(p_name text)
returns void language plpgsql security definer set search_path to 'activities', 'public' as $$
begin
  if not is_exco() then raise exception 'ExCo only'; end if;
  if exists (select 1 from posts where category = p_name) then raise exception 'Move its posts to another category first'; end if;
  delete from post_categories where name = p_name;
  if not found then raise exception 'Category not found'; end if;
end $$;

-- The categories for the public site's section bar, in order, without the hidden ones.
create or replace function activities.public_categories()
returns jsonb language sql stable security definer set search_path to 'activities', 'public' as $$
  select coalesce(jsonb_agg(jsonb_build_object('name', name, 'slug', slug, 'blurb', blurb, 'tone', tone) order by ord, name), '[]'::jsonb)
  from post_categories where not hidden
$$;

-- A post card now carries its category's address and colour.
create or replace function activities.post_card(p activities.posts)
returns jsonb language sql stable security definer set search_path to 'activities', 'public' as $$
  select jsonb_build_object(
    'slug', p.slug, 'title', p.title, 'summary', p.summary, 'category', p.category, 'ay', p.ay,
    'category_slug', (select slug from activities.post_categories where name = p.category),
    'category_tone', (select tone from activities.post_categories where name = p.category),
    'published_at', p.published_at, 'featured', p.featured, 'tags', to_jsonb(p.tags),
    'body', (select name from records.bodies where id = p.body_id),
    'author', case when p.show_author then p.author_name end,
    'cover', (select path from activities.post_photos where post_id = p.id order by ord, created_at limit 1),
    'event', (select jsonb_build_object('id', a.id, 'title', a.title, 'start_date', a.start_date)
              from activities.activities a where a.id = p.activity_id and a.status in ('Approved', 'Completed') and a.visibility = 'Public'))
$$;

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
        'category', c.name, 'slug', c.slug, 'blurb', c.blurb, 'tone', c.tone,
        'total', (select count(*) from posts where status = 'Published' and category = c.name),
        'items', (select coalesce(jsonb_agg(post_card(p) order by p.published_at desc, p.slug), '[]'::jsonb) from (
                    select * from posts where status = 'Published' and category = c.name order by published_at desc, slug limit nc) p)
      ) order by c.ord, c.name), '[]'::jsonb) from post_categories c where not c.hidden),
    'years', public_post_years());
end $$;

revoke all on function activities.save_category(text, text, text, integer, boolean) from public;
revoke all on function activities.delete_category(text) from public;
grant execute on function activities.save_category(text, text, text, integer, boolean) to authenticated;
grant execute on function activities.delete_category(text) to authenticated;
grant execute on function activities.public_categories() to anon, authenticated;
grant execute on function activities.public_gazette_home(integer, integer, integer) to anon, authenticated;
