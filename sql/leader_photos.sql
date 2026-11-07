-- Photos for ExCo members and committee heads, uploaded by the people themselves in the records app ("My record").
-- Run once in the Supabase SQL editor.
--   * only people who hold an ExCo or committee-head post in the open academic year can add a photo (checked in the database)
--   * a photo is public only if its owner ticks "show my photo on the website"; the public view never shows anyone else's
--   * a person can write only into their own folder of the leader-photos bucket (<matric>/file)

alter table records.students add column if not exists photo_url text;
alter table records.students add column if not exists show_photo boolean not null default false;

-- Who is allowed to have a photo: top post at ExCo or committee level, this academic year.
create or replace function records.can_have_photo() returns boolean language sql stable security definer set search_path = 'records', 'public' as $$
  select exists (
    select 1 from participation p
    join academic_years y on y.ay = p.ay and y.is_open
    where p.matric = my_matric() and p.is_top and lower(p.governance_level) in ('exco', 'committee'))
$$;

-- What the "My photo" card needs.
create or replace function records.my_photo() returns table (eligible boolean, photo_url text, show_photo boolean)
language sql stable security definer set search_path = 'records', 'public' as $$
  select can_have_photo(), s.photo_url, s.show_photo from students s where s.matric = my_matric()
$$;

-- Save (or remove, with null) my photo. The link must point into my own folder of the bucket.
create or replace function records.save_my_photo(p_url text, p_show boolean) returns void
language plpgsql security definer set search_path = 'records', 'public' as $$
declare m text := my_matric();
begin
  if m is null then raise exception 'Your email is not linked to a student record.'; end if;
  if not can_have_photo() then raise exception 'Photos are for ExCo members and committee heads.'; end if;
  if nullif(trim(p_url), '') is not null and trim(p_url) !~ ('^https://[^/]+/storage/v1/object/public/leader-photos/' || m || '/[A-Za-z0-9._-]+$') then
    raise exception 'That photo was not uploaded through this page.';
  end if;
  update students set photo_url = nullif(trim(p_url), ''), show_photo = (coalesce(p_show, false) and nullif(trim(p_url), '') is not null) where matric = m;
end $$;
revoke all on function records.can_have_photo(), records.my_photo(), records.save_my_photo(text, boolean) from public;
grant execute on function records.can_have_photo(), records.my_photo(), records.save_my_photo(text, boolean) to authenticated;

-- The bucket: public to read (the website shows the photos), writable only by the owner, only while they hold the post.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('leader-photos', 'leader-photos', true, 3145728, array['image/jpeg', 'image/png', 'image/webp']) on conflict (id) do nothing;
create policy leader_photos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'leader-photos' and (storage.foldername(name))[1] = records.my_matric() and records.can_have_photo());
create policy leader_photos_update on storage.objects for update to authenticated
  using (bucket_id = 'leader-photos' and (storage.foldername(name))[1] = records.my_matric() and records.can_have_photo());
create policy leader_photos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'leader-photos' and (storage.foldername(name))[1] = records.my_matric());

-- The public leadership view gains photo_url: set only for ExCo and committee heads whose owner chose to show it.
create or replace view records.public_leadership as
 select p.ay,
        p.governance_level as level,
        b.name as body,
        b.parent_committee,
        p.final_title as title,
        s.full_name,
        s.preferred_name,
        case when s.show_photo and p.is_top and lower(p.governance_level) in ('exco', 'committee') then s.photo_url end as photo_url
   from records.participation p
   join records.bodies b on b.id = p.body_id
   join records.students s on s.matric = p.matric
  where (p.is_top or p.final_title ilike '%stream representative%')
    and b.status = 'Active';
