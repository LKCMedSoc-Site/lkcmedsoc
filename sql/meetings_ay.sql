-- Meetings belong to an academic year (MedSoc term), so the tag list stays short and "SSLG 1" can repeat every year.
-- Run after sql/issues_simplify3.sql.
--   * meetings.ay, e.g. 'AY26/27'. If not given it comes from the meeting date (August to July), or from today.
--   * names are unique within a year, not across all years
--   * the tag shown on replies reads "SSLG 1 · AY26/27"

create or replace function activities.ay_of(d date) returns text language sql immutable as $$
  select 'AY' || lpad((((extract(year from d)::int - case when extract(month from d) >= 8 then 0 else 1 end) % 100))::text, 2, '0')
              || '/' || lpad((((extract(year from d)::int - case when extract(month from d) >= 8 then 0 else 1 end) + 1) % 100)::text, 2, '0')
$$;

alter table activities.meetings add column ay text;
update activities.meetings set ay = activities.ay_of(coalesce(held_on, created_at::date));
alter table activities.meetings alter column ay set not null;
alter table activities.meetings add constraint meetings_ay_check check (ay ~ '^AY[0-9]{2}/[0-9]{2}$');
alter table activities.meetings drop constraint meetings_name_key;
alter table activities.meetings add constraint meetings_ay_name_key unique (ay, name);

create function activities.meeting_default_ay() returns trigger language plpgsql as $$
begin
  if new.ay is null or new.ay = '' then new.ay := activities.ay_of(coalesce(new.held_on, current_date)); end if;
  return new;
end $$;
create trigger meetings_default_ay before insert on activities.meetings for each row execute function activities.meeting_default_ay();
-- the not-null check runs after before-insert triggers, so leaving ay out on insert is fine

-- Threads: the tag now carries the year.
create or replace function activities.issue_thread(p_issue uuid)
returns table (id uuid, happened_at timestamptz, kind text, body text, who text, mine boolean, meeting_id uuid, meeting_name text)
language plpgsql stable security definer set search_path = '' as $$
declare staff boolean := activities.can_edit_issue(p_issue); em text := activities.me();
begin
  if not staff and not exists (select 1 from activities.feedback f where f.issue_id = p_issue and em <> '' and f.submitter_email = em) then return; end if;
  return query
  select t.id, t.happened_at, t.kind, t.body, t.who, t.mine, t.meeting_id, t.meeting_name from (
    select f.id, f.created_at as happened_at, 'feedback'::text as kind, f.message as body,
           (case when em <> '' and f.submitter_email = em then 'You'
                 when staff and f.submitter_email is not null then coalesce(initcap(lower(coalesce(nullif(s.preferred_name, ''), s.full_name))) || ' (' || f.submitter_email || ')', f.submitter_email)
                 when staff then 'Anonymous'
                 else 'A student' end)::text as who,
           (em <> '' and f.submitter_email = em) as mine, null::uuid as meeting_id, null::text as meeting_name
    from activities.feedback f
    left join records.students s on lower(s.email) = f.submitter_email
    where f.issue_id = p_issue and (staff or f.submitter_email = em)
    union all
    select n.id, n.created_at, n.kind, n.body,
           (case when staff then coalesce(initcap(lower(coalesce(nullif(s.preferred_name, ''), s.full_name))), n.author_email) else 'MedSoc' end)::text,
           (em <> '' and n.author_email = em), n.meeting_id, (m.name || ' · ' || m.ay)::text
    from activities.issue_notes n
    left join records.students s on lower(s.email) = n.author_email
    left join activities.meetings m on m.id = n.meeting_id
    where n.issue_id = p_issue and (staff or n.kind <> 'assigned')
  ) t order by t.happened_at, t.id;
end $$;

create or replace function activities.shared_thread(p_issue uuid)
returns table (id uuid, happened_at timestamptz, kind text, body text, who text, mine boolean, meeting_id uuid, meeting_name text)
language plpgsql stable security definer set search_path = '' as $$
declare em text := activities.me();
begin
  if em = '' or not exists (select 1 from activities.issues i where i.id = p_issue and i.show_to_students and i.merged_into is null) then return; end if;
  return query
  select t.id, t.happened_at, t.kind, t.body, t.who, t.mine, t.meeting_id, t.meeting_name from (
    select f.id, f.created_at as happened_at, 'feedback'::text as kind, f.message as body,
           (case when f.submitter_email = em then 'You' else 'A student' end)::text as who, (f.submitter_email = em) as mine,
           null::uuid as meeting_id, null::text as meeting_name
    from activities.feedback f where f.issue_id = p_issue
    union all
    select n.id, n.created_at, n.kind, n.body, 'MedSoc'::text, false, n.meeting_id, (m.name || ' · ' || m.ay)::text
    from activities.issue_notes n left join activities.meetings m on m.id = n.meeting_id
    where n.issue_id = p_issue and n.kind <> 'assigned'
  ) t order by t.happened_at, t.id;
end $$;
