-- Make the records database the single source for who may do what in the inventory.
-- Safe to read first: nothing here deletes inventory items, places, photos or the activity log.

-- PART A. Body contact addresses (CCA, house and year-group Gmail accounts) get the same rights as leaders.
-- ExCo and Committee contact addresses are left out on purpose: a manager of a Committee approves its CCAs' events,
-- and a manager of the ExCo body counts as ExCo.
insert into records.body_managers (body_id, email, source)
select b.id, lower(trim(b.contact_email)), 'manual'
from records.bodies b
where b.status = 'Active'
  and b.contact_email is not null and trim(b.contact_email) <> ''
  and b.level in ('CCA/Project', 'House', 'Year')
  and not exists (select 1 from records.body_managers m where m.body_id = b.id and lower(m.email) = lower(trim(b.contact_email)));

-- PART B. The inventory's list of bodies and people is rebuilt from records.
-- Contact address -> column 1, managers (leaders) -> column 2, members of the open year -> column 3.
-- The rights given to each column (the perms_ columns) are NOT touched, so super admins and special cases stay as they are.
create or replace function app.refresh_bodies() returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into app.bodies (name, ord, category, col_c, parent, emails_1, emails_2, emails_3, perms_1, perms_2, perms_3)
  select b.name,
         1000 + row_number() over (order by b.name),
         b.level, b.status, b.parent_committee,
         coalesce(lower(trim(b.contact_email)), ''),
         coalesce((select string_agg(distinct lower(m.email), ', ')
                   from records.body_managers m
                   where m.body_id = b.id and lower(m.email) <> lower(coalesce(trim(b.contact_email), ''))), ''),
         coalesce((select string_agg(distinct lower(s.email), ', ')
                   from records.participation p
                   join records.students s on s.matric = p.matric
                   where p.body_id = b.id and records.ay_open(p.ay) and s.status in ('Active', 'LOA')
                     and not exists (select 1 from records.body_managers m where m.body_id = b.id and lower(m.email) = lower(s.email))), ''),
         'Edit Own Inventory, Edit Assigned Rooms, Edit Child CCAs',
         'Edit Own Inventory, Edit Assigned Rooms, Edit Child CCAs',
         'Edit Own Inventory'
  from records.bodies b
  on conflict (name) do update set
    category = excluded.category, col_c = excluded.col_c, parent = excluded.parent,
    emails_1 = excluded.emails_1, emails_2 = excluded.emails_2, emails_3 = excluded.emails_3;
  delete from app.bodies where name not in (select name from records.bodies);
end $$;

-- Keep it in step automatically whenever records change. A failure here never blocks a records edit.
create or replace function app.refresh_bodies_trg() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  begin perform app.refresh_bodies(); exception when others then raise warning 'inventory refresh failed: %', sqlerrm; end;
  return null;
end $$;

create trigger refresh_inventory_bodies after insert or update or delete on records.bodies
  for each statement execute function app.refresh_bodies_trg();
create trigger refresh_inventory_bodies after insert or update or delete on records.body_managers
  for each statement execute function app.refresh_bodies_trg();
create trigger refresh_inventory_bodies after insert or update or delete on records.participation
  for each statement execute function app.refresh_bodies_trg();
create trigger refresh_inventory_bodies after insert or update or delete on records.students
  for each statement execute function app.refresh_bodies_trg();

-- PART C. Retire the Google Sheet sync for bodies (otherwise the Sheet's timer would overwrite this every 10 minutes).
-- The Sheet can no longer change people or permissions. Rooms still need a decision (see the chat).
create or replace function app.sync_bodies(p_bodies jsonb, p_rooms jsonb) returns jsonb
language sql as $$
  select jsonb_build_object('bodies', 0, 'rooms', 0, 'note', 'Bodies now come from the records database. This sync is retired.')
$$;

-- Run it once now so Part A shows up right away.
select app.refresh_bodies();
