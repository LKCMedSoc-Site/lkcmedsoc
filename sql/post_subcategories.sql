-- Sub-categories: a category can have sub-categories (one level), and a post can pick one inside its category.
-- Examples: Creative > Humans of Med, Publications > Quarterly update. A sub-category belongs to exactly one category, so it never cuts across.
-- Run after post_categories.sql. Safe to run more than once.

alter table activities.post_categories add column if not exists parent text references activities.post_categories (name) on update cascade on delete restrict;
alter table activities.post_categories drop constraint if exists post_categories_parent_name_key;
alter table activities.post_categories add constraint post_categories_parent_name_key unique (parent, name);
alter table activities.post_categories drop constraint if exists post_categories_no_self_parent;
alter table activities.post_categories add constraint post_categories_no_self_parent check (parent is null or parent <> name);

alter table activities.posts add column if not exists subcategory text;
-- A post's sub-category must belong to the post's category. Deferred so renaming a category (which cascades to both) is checked at the end.
alter table activities.posts drop constraint if exists posts_subcategory_fkey;
alter table activities.posts add constraint posts_subcategory_fkey
  foreign key (category, subcategory) references activities.post_categories (parent, name) on update cascade deferrable initially deferred;
create index if not exists posts_subcategory_idx on activities.posts (category, subcategory) where subcategory is not null;

-- ExCo adds a sub-category by giving the parent. A sub-category takes its parent's colour. The parent cannot be changed afterwards.
drop function if exists activities.save_category(text, text, text, integer, boolean);
create or replace function activities.save_category(p_old text, p_name text, p_blurb text default null, p_ord integer default null, p_hidden boolean default false, p_parent text default null)
returns text language plpgsql security definer set search_path to 'activities', 'public' as $$
declare nm text := trim(coalesce(p_name, '')); sl text; n int; tn smallint; par post_categories%rowtype;
begin
  if not is_exco() then raise exception 'ExCo only'; end if;
  if length(nm) < 2 or length(nm) > 30 then raise exception 'A category name is 2 to 30 characters'; end if;
  if p_old is null then
    sl := trim(both '-' from lower(regexp_replace(nm, '[^a-zA-Z0-9]+', '-', 'g')));
    if sl = '' or sl in ('all', 'topics', 'post') then raise exception 'Pick a different name'; end if;
    if exists (select 1 from post_categories where name = nm or slug = sl) then raise exception 'That name is already used'; end if;
    if p_parent is not null then
      select * into par from post_categories where name = p_parent;
      if not found then raise exception 'Parent category not found'; end if;
      if par.parent is not null then raise exception 'Sub-categories go one level deep'; end if;
      tn := par.tone;
      select count(*) into n from post_categories where parent = p_parent;
    else
      select count(*) into n from post_categories where parent is null;
      tn := (n % 8)::smallint;
    end if;
    insert into post_categories (name, slug, blurb, ord, hidden, tone, parent)
    values (nm, sl, nullif(trim(coalesce(p_blurb, '')), ''), coalesce(p_ord, n + 1), coalesce(p_hidden, false), tn, p_parent);
  else
    if nm <> p_old and exists (select 1 from post_categories where name = nm) then raise exception 'That name is already used'; end if;
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
  if exists (select 1 from post_categories where parent = p_name) then raise exception 'Delete or move its sub-categories first'; end if;
  if exists (select 1 from posts where category = p_name or subcategory = p_name) then raise exception 'Move its posts to another category first'; end if;
  delete from post_categories where name = p_name;
  if not found then raise exception 'Category not found'; end if;
end $$;

-- Saving a post: the editors send category and subcategory together. An editor that sends only a changed category (the Activities app) clears the sub-category.
create or replace function activities.save_post(p_id uuid, s jsonb)
returns uuid language plpgsql security definer set search_path to 'activities', 'public' as $$
declare me text := records.me_email(); p posts%rowtype; act activities%rowtype; aid uuid; bid uuid; is_author boolean;
        new_id uuid; open_n int;
begin
  if me = '' then raise exception 'Not allowed'; end if;

  if p_id is null then
    if not can_write_posts() then raise exception 'Not allowed'; end if;
    select count(*) into open_n from posts
     where author_email = me and status in ('Draft', 'Submitted', 'Changes requested', 'Unpublished');
    if open_n >= 30 then raise exception 'You have 30 unfinished posts. Finish or delete some first.'; end if;
    if nullif(trim(coalesce(s ->> 'title', '')), '') is null then raise exception 'Give the post a title'; end if;
    insert into posts (title, author_email, author_name)
    values (trim(s ->> 'title'), me, student_name(me)) returning id into new_id;
    p_id := new_id;
  end if;

  select * into p from posts where id = p_id for update;
  if not found then raise exception 'Post not found'; end if;
  is_author := (p.author_email = me);

  if not ((is_author and can_write_posts() and p.status in ('Draft', 'Changes requested', 'Unpublished'))
          or (can_approve_body(p.body_id, p.author_email) and p.status in ('Submitted', 'Published'))) then
    raise exception 'You cannot edit this post now';
  end if;

  if (s ? 'activity_id' or s ? 'body_id') and not (is_author and p.status in ('Draft', 'Changes requested', 'Unpublished')) then
    raise exception 'Only the author can change what the post is about';
  end if;
  if s ? 'show_author' and not is_author then raise exception 'Only the author can change whether their name is shown'; end if;

  aid := p.activity_id; bid := p.body_id;
  if s ? 'activity_id' then
    aid := nullif(s ->> 'activity_id', '')::uuid;
    if aid is not null then
      select * into act from activities where id = aid;
      if not found or not (can_see_activity(aid) or act.status in ('Approved', 'Completed')) then
        raise exception 'That event cannot be linked';
      end if;
      bid := act.body_id;
    elsif not (s ? 'body_id') then
      bid := null;
    end if;
  end if;
  if s ? 'body_id' and aid is null then
    bid := nullif(s ->> 'body_id', '')::uuid;
    if bid is not null and not (is_exco() or records.can_edit_body(bid)) then
      raise exception 'Pick a body you manage, or leave it empty';
    end if;
  end if;

  update posts set
    title       = case when s ? 'title' then coalesce(nullif(trim(s ->> 'title'), ''), title) else title end,
    summary     = case when s ? 'summary' then nullif(trim(coalesce(s ->> 'summary', '')), '') else summary end,
    body_md     = case when s ? 'body_md' then coalesce(s ->> 'body_md', '') else body_md end,
    category    = case when s ? 'category' then s ->> 'category' else category end,
    subcategory = case when s ? 'subcategory' then nullif(s ->> 'subcategory', '')
                       when s ? 'category' and (s ->> 'category') is distinct from category then null
                       else subcategory end,
    show_author = case when s ? 'show_author' then (s ->> 'show_author')::boolean else show_author end,
    activity_id = aid,
    body_id     = bid,
    updated_at  = now()
  where id = p_id;
  return p_id;
end $$;

-- The section list for the public site: top-level categories in order, each with its visible sub-categories.
create or replace function activities.public_categories()
returns jsonb language sql stable security definer set search_path to 'activities', 'public' as $$
  select coalesce(jsonb_agg(jsonb_build_object('name', c.name, 'slug', c.slug, 'blurb', c.blurb, 'tone', c.tone,
      'children', (select coalesce(jsonb_agg(jsonb_build_object('name', k.name, 'slug', k.slug, 'blurb', k.blurb) order by k.ord, k.name), '[]'::jsonb)
                   from post_categories k where k.parent = c.name and not k.hidden)) order by c.ord, c.name), '[]'::jsonb)
  from post_categories c where c.parent is null and not c.hidden
$$;

create or replace function activities.post_card(p activities.posts)
returns jsonb language sql stable security definer set search_path to 'activities', 'public' as $$
  select jsonb_build_object(
    'slug', p.slug, 'title', p.title, 'summary', p.summary, 'category', p.category, 'ay', p.ay,
    'category_slug', (select slug from activities.post_categories where name = p.category),
    'category_tone', (select tone from activities.post_categories where name = p.category),
    'subcategory', p.subcategory,
    'subcategory_slug', (select slug from activities.post_categories where name = p.subcategory),
    'published_at', p.published_at, 'featured', p.featured, 'tags', to_jsonb(p.tags),
    'body', (select name from records.bodies where id = p.body_id),
    'author', case when p.show_author then p.author_name end,
    'cover', (select path from activities.post_photos where post_id = p.id order by ord, created_at limit 1),
    'event', (select jsonb_build_object('id', a.id, 'title', a.title, 'start_date', a.start_date)
              from activities.activities a where a.id = p.activity_id and a.status in ('Approved', 'Completed') and a.visibility = 'Public'))
$$;

-- The Gazette home lists top-level categories only.
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
      ) order by c.ord, c.name), '[]'::jsonb) from post_categories c where not c.hidden and c.parent is null),
    'years', public_post_years());
end $$;

-- Posts in one sub-category (a sub-category page).
create or replace function activities.public_posts_sub(p_category text, p_sub text, p_limit integer default 12, p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path to 'activities', 'public' as $$
declare lim int := least(greatest(coalesce(p_limit, 12), 1), 50); off int := greatest(coalesce(p_offset, 0), 0); tot int; items jsonb;
begin
  select count(*) into tot from posts where status = 'Published' and category = p_category and subcategory = p_sub;
  select coalesce(jsonb_agg(j order by pa desc, sl), '[]'::jsonb) into items from (
    select post_card(p) as j, p.published_at as pa, p.slug as sl from posts p
     where p.status = 'Published' and p.category = p_category and p.subcategory = p_sub
     order by p.published_at desc, p.slug limit lim offset off) q;
  return jsonb_build_object('total', tot, 'items', items);
end $$;

-- Public (anon) post detail already comes from post_card, which now carries subcategory.
revoke all on function activities.save_category(text, text, text, integer, boolean, text) from public;
grant execute on function activities.save_category(text, text, text, integer, boolean, text) to authenticated;
grant execute on function activities.public_categories() to anon, authenticated;
grant execute on function activities.public_gazette_home(integer, integer, integer) to anon, authenticated;
grant execute on function activities.public_posts_sub(text, text, integer, integer) to anon, authenticated;
