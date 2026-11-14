-- Social and contact links for each body (CCA, committee, house), shown as icons on its public page.
-- Run once in the Supabase SQL editor, after sql/body_color.sql.
--
-- Stored as a small list: [{"kind": "instagram", "url": "https://instagram.com/lkc.psych"}, {"kind": "telegram", "url": "https://t.me/..."}].
-- The icon for each kind lives on the website (site/src/components/groups/GroupIcon.tsx). Keep the list of kinds in step with
-- SOCIAL_KINDS there and in records/pages.js. Instagram, website and the join link keep their own columns; this list is for the rest
-- (and the page also shows those three as icons).

alter table records.bodies add column if not exists socials jsonb not null default '[]'::jsonb;

-- Same columns as before, plus socials at the end (CREATE OR REPLACE VIEW can only append columns).
create or replace view records.public_bodies as
 select name, level, parent_committee, description, logo_url, instagram, website, recruitment_url, header_url, about_md, color, socials
   from records.bodies
  where status = 'Active';

-- One safe door for managers to save their links. Only known kinds, https or mailto addresses, at most 10.
create or replace function records.save_my_body_socials(b uuid, p_socials jsonb)
returns void
language plpgsql security definer set search_path = records, public as $$
declare
  item jsonb;
  clean jsonb := '[]'::jsonb;
  k text; u text;
begin
  if not can_edit_body(b) then raise exception 'You cannot edit this group.'; end if;
  if p_socials is null or jsonb_typeof(p_socials) <> 'array' then p_socials := '[]'::jsonb; end if;
  if jsonb_array_length(p_socials) > 10 then raise exception 'Ten links at most.'; end if;
  for item in select * from jsonb_array_elements(p_socials) loop
    k := lower(trim(coalesce(item ->> 'kind', '')));
    u := trim(coalesce(item ->> 'url', ''));
    if u = '' then continue; end if;
    if k not in ('instagram', 'telegram', 'tiktok', 'youtube', 'facebook', 'linkedin', 'whatsapp', 'discord', 'x', 'email', 'website') then
      raise exception 'Unknown link type: %', k;
    end if;
    if k = 'email' and u !~* '^(mailto:)?[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'That email address does not look right.'; end if;
    if k <> 'email' and u !~* '^https://\S+$' then raise exception 'Links must start with https://'; end if;
    if length(u) > 300 then raise exception 'That link is too long.'; end if;
    if k = 'email' then u := regexp_replace(u, '^mailto:', '', 'i'); end if;
    clean := clean || jsonb_build_array(jsonb_build_object('kind', k, 'url', u));
  end loop;
  update bodies set socials = clean where id = b;
end $$;
revoke all on function records.save_my_body_socials(uuid, jsonb) from public;
grant execute on function records.save_my_body_socials(uuid, jsonb) to authenticated;
