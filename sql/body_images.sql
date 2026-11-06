-- Header images for bodies (CCAs, committees, houses), shown as the card photo and page banner on the website.
-- records.bodies already has logo_url (paste-a-link text, empty for every body today). This adds header_url
-- and a public storage bucket to hold uploaded logos and headers. Run once in the Supabase SQL editor.

alter table records.bodies add column if not exists header_url text;

-- Same columns as before, plus header_url at the end (CREATE OR REPLACE VIEW can only append columns).
create or replace view records.public_bodies as
 select name, level, parent_committee, description, logo_url, instagram, website, recruitment_url, header_url
   from records.bodies
  where status = 'Active';

-- A public bucket for the files themselves. Paste the file's public link into Logo URL / Header URL in the records app.
-- (Uploading straight from the records app needs a small upload control added there; until then, upload in the
-- Supabase dashboard under Storage > body-images.)
insert into storage.buckets (id, name, public) values ('body-images', 'body-images', true) on conflict (id) do nothing;
