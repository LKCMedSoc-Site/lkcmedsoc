-- Lets the people who manage a body see and change its official email (the "Manage body" screen in the records app).
-- Run once in the Supabase SQL editor. Depends on sql/body_editor.sql (records.can_edit_body).
--
-- The official email is the body's contact address: the records app adds it to the body's email group. It is NOT shown on the website.
-- A manager may set up to 5 addresses; each is checked and written in lower case. Admins can still edit it in the body's record.
-- Who may edit a body (the managers list) is still admin-only.

create or replace function records.my_body_contact(b uuid)
returns text
language sql stable security definer set search_path = records, public as $$
  select case when can_edit_body(b) then (select contact_email from bodies where id = b) end
$$;
revoke all on function records.my_body_contact(uuid) from public;
grant execute on function records.my_body_contact(uuid) to authenticated;

create or replace function records.save_my_body_contact(b uuid, p_emails text)
returns void
language plpgsql security definer set search_path = records, public as $$
declare
  parts text[];
  e text;
  clean text[] := '{}';
begin
  if not can_edit_body(b) then raise exception 'You cannot edit this group.'; end if;
  parts := regexp_split_to_array(lower(coalesce(p_emails, '')), '[,;\s]+');
  foreach e in array parts loop
    e := trim(e);
    if e = '' then continue; end if;
    if e !~ '^[^@\s,;]+@[^@\s,;]+\.[^@\s,;]+$' or length(e) > 120 then raise exception '"%" does not look like an email address.', e; end if;
    if not (e = any(clean)) then clean := clean || e; end if;
  end loop;
  if coalesce(array_length(clean, 1), 0) > 5 then raise exception 'Five email addresses at most.'; end if;
  update bodies set contact_email = nullif(array_to_string(clean, ', '), '') where id = b;
end $$;
revoke all on function records.save_my_body_contact(uuid, text) from public;
grant execute on function records.save_my_body_contact(uuid, text) to authenticated;
