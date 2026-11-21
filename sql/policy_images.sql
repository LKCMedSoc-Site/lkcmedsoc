-- Images in policy documents (diagrams, flowcharts). Files live in a PRIVATE storage bucket, one folder per document (the document's id), and are never changed or deleted once uploaded
-- so a published version keeps showing the same picture. The page asks for a short-lived signed link to show each one.
--   read:  ExCo, people the document is shared with, and anyone once the document is published
--   write: ExCo and people the document is shared with as Editor
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('policy-images', 'policy-images', false, 5242880, array['image/webp', 'image/png', 'image/jpeg'])
on conflict (id) do nothing;

create or replace function activities.policy_images_can_read(p_folder text) returns boolean
language sql stable security definer set search_path to 'activities', 'public' as $$
  select exists (select 1 from policy_docs d where d.id::text = p_folder and (is_exco() or policy_live_access(d.id) is not null or d.published))
$$;
create or replace function activities.policy_images_can_write(p_folder text) returns boolean
language sql stable security definer set search_path to 'activities', 'public' as $$
  select exists (select 1 from policy_docs d where d.id::text = p_folder and policy_can_work(d.id))
$$;
grant execute on function activities.policy_images_can_read(text), activities.policy_images_can_write(text) to authenticated;
revoke execute on function activities.policy_images_can_read(text), activities.policy_images_can_write(text) from public, anon;

drop policy if exists policy_images_read on storage.objects;
create policy policy_images_read on storage.objects for select to authenticated
  using (bucket_id = 'policy-images' and activities.policy_images_can_read((storage.foldername(name))[1]));
drop policy if exists policy_images_write on storage.objects;
create policy policy_images_write on storage.objects for insert to authenticated
  with check (bucket_id = 'policy-images' and activities.policy_images_can_write((storage.foldername(name))[1]));
