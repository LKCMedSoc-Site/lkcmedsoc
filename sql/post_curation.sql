-- Gazette curation: a featured flag and free-form tags on posts, set by ExCo from the Gazette's "All posts" tab.
-- Safe to run more than once. Run in the Supabase SQL editor. The Gazette works without it (the Feature and Tags buttons stay hidden).
-- Nothing on the public website reads these two columns yet.

alter table activities.posts add column if not exists featured boolean not null default false;
alter table activities.posts add column if not exists tags text[] not null default '{}';
create index if not exists posts_featured_idx on activities.posts (featured) where featured;
create index if not exists posts_tags_idx on activities.posts using gin (tags);

create or replace function activities.set_post_curation(p_id uuid, p_featured boolean, p_tags text[])
returns void language plpgsql security definer set search_path to 'activities', 'public' as $$
declare clean text[];
begin
  if not is_exco() then raise exception 'ExCo only'; end if;
  select coalesce(array_agg(distinct t), '{}') into clean
    from (select left(trim(x), 40) as t from unnest(coalesce(p_tags, '{}')) x) q where t <> '';
  if array_length(clean, 1) > 10 then raise exception 'Use at most 10 tags'; end if;
  update posts set featured = coalesce(p_featured, false), tags = clean, updated_at = now() where id = p_id;
  if not found then raise exception 'Post not found'; end if;
end $$;

revoke all on function activities.set_post_curation(uuid, boolean, text[]) from public;
grant execute on function activities.set_post_curation(uuid, boolean, text[]) to authenticated;
