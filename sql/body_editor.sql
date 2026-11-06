-- Lets the people who manage a body edit its public page from the records app:
-- logo, header image, short blurb, links and a rich write-up, plus uploading the images.
-- Run once in the Supabase SQL editor. Depends on sql/body_images.sql (header_url and the body-images bucket).
-- Managers are the existing records.body_managers links (records.can_edit_body decides who can edit what).
-- Nothing else about a body (name, committee, status, official email) can be changed by a manager.

alter table records.bodies add column if not exists about_md text;

create or replace view records.public_bodies as
 select name, level, parent_committee, description, logo_url, instagram, website, recruitment_url, header_url, about_md
   from records.bodies
  where status = 'Active';

-- One safe door for managers to save the public fields of a body they manage.
create or replace function records.save_my_body(
  b uuid, p_description text, p_about_md text, p_logo_url text, p_header_url text,
  p_instagram text, p_website text, p_recruitment_url text
) returns void
language plpgsql security definer set search_path = records, public as $$
begin
  if not can_edit_body(b) then raise exception 'You cannot edit this group.'; end if;
  if length(coalesce(p_description, '')) > 400 then raise exception 'The short description is too long (400 characters at most).'; end if;
  if length(coalesce(p_about_md, '')) > 30000 then raise exception 'The write-up is too long.'; end if;
  if nullif(trim(p_logo_url), '') is not null and trim(p_logo_url) !~* '^https://' then raise exception 'The logo must be a web link or an upload.'; end if;
  if nullif(trim(p_header_url), '') is not null and trim(p_header_url) !~* '^https://' then raise exception 'The header image must be a web link or an upload.'; end if;
  if nullif(trim(p_website), '') is not null and trim(p_website) !~* '^https?://' then raise exception 'The website must start with http:// or https://'; end if;
  if nullif(trim(p_recruitment_url), '') is not null and trim(p_recruitment_url) !~* '^https?://' then raise exception 'The join link must start with http:// or https://'; end if;
  if nullif(trim(p_instagram), '') is not null and trim(p_instagram) !~* '^(@?[a-z0-9._]{1,30}|https?://\S+)$' then raise exception 'Instagram should be a handle like @name or a link.'; end if;
  update bodies set
    description = nullif(trim(p_description), ''), about_md = nullif(trim(p_about_md), ''),
    logo_url = nullif(trim(p_logo_url), ''), header_url = nullif(trim(p_header_url), ''),
    instagram = nullif(trim(p_instagram), ''), website = nullif(trim(p_website), ''),
    recruitment_url = nullif(trim(p_recruitment_url), '')
  where id = b;
end $$;
revoke all on function records.save_my_body(uuid, text, text, text, text, text, text, text) from public;
grant execute on function records.save_my_body(uuid, text, text, text, text, text, text, text) to authenticated;

-- Uploads: a manager can add, replace or delete files only inside their own body's folder (<body id>/file).
create policy body_images_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'body-images' and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
              and records.can_edit_body(((storage.foldername(name))[1])::uuid));
create policy body_images_update on storage.objects for update to authenticated
  using (bucket_id = 'body-images' and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
         and records.can_edit_body(((storage.foldername(name))[1])::uuid));
create policy body_images_delete on storage.objects for delete to authenticated
  using (bucket_id = 'body-images' and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
         and records.can_edit_body(((storage.foldername(name))[1])::uuid));
