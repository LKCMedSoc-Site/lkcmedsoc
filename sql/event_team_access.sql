-- Let members of a CCA or committee create and work on its events.
-- Only the events side changes. Editing a body's own records still needs a manager (records.can_edit_body is untouched).
-- Spending entries stay visible to leaders and ExCo only.

-- 1. Who counts as the event team: leaders/managers as before, plus anyone listed as a member of that body in an open year
create or replace function activities.is_event_team(b uuid) returns boolean
language sql stable security definer set search_path to 'activities','public' as $$
  select records.can_edit_body(b)
      or exists (
        select 1 from records.participation p
        where p.body_id = b and p.matric = records.my_matric() and records.ay_open(p.ay)
      )
$$;

-- 2. The old "leaders only" check, kept for spending
create or replace function activities.can_lead_activity(aid uuid) returns boolean
language sql stable security definer set search_path to 'activities','public' as $$
  select exists (select 1 from activities a where a.id = aid and (is_exco() or records.can_edit_body(a.body_id)))
$$;

-- 3. Screens the portal needs
create or replace function activities.my_event_bodies()
returns table(id uuid, name text, level text, parent_committee text)
language sql stable security definer set search_path to 'activities','public' as $$
  select b.id, b.name, b.level, b.parent_committee
  from records.bodies b
  where b.status = 'Active' and activities.is_event_team(b.id)
  order by b.level, b.name
$$;
create or replace function activities.can_file_events() returns boolean
language sql stable security definer set search_path to 'activities','public' as $$
  select exists (select 1 from records.bodies b where b.status = 'Active' and activities.is_event_team(b.id))
$$;
grant execute on function activities.my_event_bodies() to authenticated;
grant execute on function activities.can_file_events() to authenticated;

-- 4. Existing checks now use the event team
create or replace function activities.can_work_activity(aid uuid) returns boolean
language sql stable security definer set search_path to 'activities','public' as $$
  select exists (select 1 from activities a where a.id = aid
    and (is_exco() or (activities.is_event_team(a.body_id) and records.ay_open(a.ay) and a.status <> 'Cancelled')))
$$;
create or replace function activities.can_see_activity(aid uuid) returns boolean
language sql stable security definer set search_path to 'activities','public' as $$
  select exists (select 1 from activities a where a.id = aid and (is_exco() or activities.is_event_team(a.body_id)))
$$;
create or replace function activities.can_edit_plan(aid uuid) returns boolean
language sql stable security definer set search_path to 'activities','public' as $$
  select exists (select 1 from activities a where a.id = aid
    and (is_exco() or (activities.is_event_team(a.body_id) and records.ay_open(a.ay) and a.status in ('Draft','Changes requested'))))
$$;

create or replace function activities.cancel_activity(aid uuid) returns void
language plpgsql security definer set search_path to 'activities','public' as $f$
declare a activities%rowtype;
begin
  select * into a from activities where id = aid;
  if not found then raise exception 'Activity not found'; end if;
  if a.status in ('Completed','Cancelled') then raise exception 'This activity is already %', a.status; end if;
  if not (is_exco() or (activities.is_event_team(a.body_id) and records.ay_open(a.ay)
                        and a.status in ('Draft','Changes requested','Rejected'))) then
    raise exception 'Not allowed';
  end if;
  update activities set status = 'Cancelled' where id = aid;
end $f$;

create or replace function activities.mark_completed(aid uuid) returns void
language plpgsql security definer set search_path to 'activities','public' as $f$
declare a activities%rowtype;
begin
  select * into a from activities where id = aid;
  if not found then raise exception 'Activity not found'; end if;
  if not (is_exco() or (activities.is_event_team(a.body_id) and records.ay_open(a.ay))) then raise exception 'Not allowed'; end if;
  if a.status <> 'Approved' then raise exception 'Only an approved activity can be completed'; end if;
  if coalesce(a.end_date, a.start_date) is null or coalesce(a.end_date, a.start_date) > current_date then
    raise exception 'The activity has not taken place yet';
  end if;
  update activities set status = 'Completed' where id = aid;
end $f$;

create or replace function activities.submit_activity(aid uuid) returns jsonb
language plpgsql security definer set search_path to 'activities','public' as $f$
declare a activities%rowtype; blockers text[]; tr text; want_sao boolean;
begin
  select * into a from activities where id = aid;
  if not found then raise exception 'Activity not found'; end if;
  if not (is_exco() or (activities.is_event_team(a.body_id) and records.ay_open(a.ay))) then
    raise exception 'Not allowed';
  end if;
  if a.status not in ('Draft','Changes requested') then
    raise exception 'Only a draft or an activity with changes requested can be submitted';
  end if;
  select array_agg(b) into blockers from submission_blockers(aid) b;
  if blockers is not null then
    raise exception 'Cannot submit yet: %', array_to_string(blockers, ' ');
  end if;
  tr := activity_track(a);
  want_sao := tr <> 'NO_SAO';
  update activities set status = 'Submitted', submitted_at = now() where id = aid;
  insert into approvals (activity_id, step, ord) values
    (aid, 'COMMITTEE_HEAD', 1), (aid, 'EXCO_ATTACHE', 2), (aid, 'SLS', 3)
  on conflict (activity_id, step) do update
    set status = 'Pending', decided_by = null, decided_at = null, note = null;
  if want_sao then
    insert into approvals (activity_id, step, ord) values (aid, 'SAO', 4)
    on conflict (activity_id, step) do update
      set status = 'Pending', decided_by = null, decided_at = null, note = null;
  else
    delete from approvals where activity_id = aid and step = 'SAO';
  end if;
  update checklist_items set status = 'Submitted'
   where activity_id = aid and doc_code in ('A1','A2','A3') and status in ('Not started','Drafting');
  return jsonb_build_object('status', 'Submitted', 'track', tr);
end $f$;

-- 5. Row rules on activities: event team instead of leaders only
drop policy act_read on activities.activities;
drop policy act_insert on activities.activities;
drop policy act_update on activities.activities;
drop policy act_delete on activities.activities;
create policy act_read on activities.activities for select to authenticated
  using (activities.is_exco() or activities.is_event_team(body_id));
create policy act_insert on activities.activities for insert to authenticated
  with check (activities.is_exco() or (activities.is_event_team(body_id) and records.ay_open(ay)));
create policy act_update on activities.activities for update to authenticated
  using (activities.is_exco() or (activities.is_event_team(body_id) and records.ay_open(ay) and status in ('Draft','Changes requested')))
  with check (activities.is_exco() or (activities.is_event_team(body_id) and records.ay_open(ay) and status in ('Draft','Changes requested')));
create policy act_delete on activities.activities for delete to authenticated
  using (activities.is_exco() or (activities.is_event_team(body_id) and records.ay_open(ay) and status = 'Draft'));

-- 6. Spending stays leaders and ExCo only
drop policy sp_read on activities.spending_entries;
create policy sp_read on activities.spending_entries for select to authenticated
  using (activities.can_lead_activity(activity_id));
