-- Lets each body (a committee or a CCA) choose its own colour for the website: its filter chip, badge and card.
-- Run once in the Supabase SQL editor. Depends on sql/body_editor.sql (records.can_edit_body and the public_bodies view).
--
-- The column holds a colour NAME or any #rrggbb hex. Names live in site/src/lib/tones.ts; a hex is darkened there if white text on it
-- would be hard to read, so nobody can choose an unreadable colour. None of the names are purple: purple is the site's own colour.
-- A body with no colour set gets a stable one picked from its name, so nothing breaks while colours are being chosen.
-- A CCA with no colour of its own takes its committee's.
-- Keep this list in step with TONE_SLOTS in site/src/lib/tones.ts and the swatches in records/pages.js.

alter table records.bodies add column if not exists color text;

alter table records.bodies drop constraint if exists bodies_color_check;
alter table records.bodies add constraint bodies_color_check
  check (color is null or color in ('blue', 'cyan', 'teal', 'green', 'amber', 'orange', 'red', 'slate') or color ~ '^#[0-9a-f]{6}$');

-- Same columns as before, plus color. (create or replace can add a column at the end.)
create or replace view records.public_bodies as
 select name, level, parent_committee, description, logo_url, instagram, website, recruitment_url, header_url, about_md, color
   from records.bodies
  where status = 'Active';

-- One safe door for managers to set the colour of a body they manage. Pass null to clear it.
create or replace function records.save_my_body_color(b uuid, p_color text)
returns void
language plpgsql security definer set search_path = records, public as $$
begin
  if not can_edit_body(b) then raise exception 'You cannot edit this group.'; end if;
  p_color := lower(nullif(trim(p_color), ''));
  if p_color is not null and p_color not in ('blue', 'cyan', 'teal', 'green', 'amber', 'orange', 'red', 'slate') and p_color !~ '^#[0-9a-f]{6}$' then
    raise exception 'Pick a colour from the picker.';
  end if;
  update bodies set color = p_color where id = b;
end $$;
revoke all on function records.save_my_body_color(uuid, text) from public;
grant execute on function records.save_my_body_color(uuid, text) to authenticated;
