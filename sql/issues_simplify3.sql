-- Third round on feedback and issues. Run after sql/issues_simplify2.sql.
--   * "exco_and_responsible": the person who handles an issue (and ExCo) can see who a student is; "anonymous" stays hidden from everyone
--   * the person responsible must be ExCo, a committee head or a year representative (checked in the database)
--   * no separate SSLG route or workflow: a reply on an issue can be tagged with a meeting ("SSLG 1"). Clicking the tag shows
--     every issue raised at that meeting and the uploaded minutes. Each issue is still followed up in its own conversation.

-- ---------- identity choice ----------
alter table activities.feedback drop constraint feedback_privacy_check;
update activities.feedback set privacy = 'exco_and_responsible' where privacy = 'exco_only';
alter table activities.feedback add constraint feedback_privacy_check check (privacy in ('exco_and_responsible', 'anonymous'));
alter table activities.feedback alter column privacy set default 'exco_and_responsible';

-- ---------- meetings (tags) ----------
create table activities.meetings (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null unique check (char_length(name) between 2 and 80),
  held_on date,
  minutes_path text            -- file inside the private "meeting-minutes" storage bucket
);
alter table activities.meetings enable row level security;
create policy read_all on activities.meetings for select to authenticated using (activities.me() <> '');
create policy exco_all on activities.meetings for all to authenticated using (activities.is_exco()) with check (activities.is_exco());
grant select, insert, update, delete on activities.meetings to authenticated;

alter table activities.issue_notes add column meeting_id uuid references activities.meetings(id) on delete set null;
create index issue_notes_meeting_idx on activities.issue_notes (meeting_id);

-- Minutes are PDFs in a private bucket: any signed-in student can read them, only ExCo can add or change them.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('meeting-minutes', 'meeting-minutes', false, 20971520, array['application/pdf']) on conflict (id) do nothing;
create policy minutes_read on storage.objects for select to authenticated using (bucket_id = 'meeting-minutes' and activities.me() <> '');
create policy minutes_insert on storage.objects for insert to authenticated with check (bucket_id = 'meeting-minutes' and activities.is_exco());
create policy minutes_update on storage.objects for update to authenticated using (bucket_id = 'meeting-minutes' and activities.is_exco());
create policy minutes_delete on storage.objects for delete to authenticated using (bucket_id = 'meeting-minutes' and activities.is_exco());

-- ---------- who can be responsible ----------
create or replace function activities.is_assignable(p_email text) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from records.participation p
    join records.students s on s.matric = p.matric
    join records.academic_years y on y.ay = p.ay and y.is_open
    where lower(s.email) = lower(trim(p_email)) and p.is_top and lower(p.governance_level) in ('exco', 'committee', 'year'))
$$;

create or replace function activities.assignable_people() returns table (email text, name text, positions text)
language sql stable security definer set search_path = '' as $$
  select lower(s.email), initcap(lower(coalesce(nullif(s.preferred_name, ''), s.full_name))), string_agg(distinct p.final_title, ', ')
  from records.participation p
  join records.students s on s.matric = p.matric
  join records.academic_years y on y.ay = p.ay and y.is_open
  where activities.is_exco() and p.is_top and lower(p.governance_level) in ('exco', 'committee', 'year') and coalesce(s.email, '') <> ''
  group by 1, 2
  order by 2
$$;

-- ---------- reshape the functions (no route any more) ----------
drop function activities.triage_feedback(uuid, uuid, text, text, text);
drop function activities.save_issue(uuid, text, text, text, text, boolean);
drop function activities.add_issue_note(uuid, text, text);
drop function activities.issue_thread(uuid);
drop function activities.shared_thread(uuid);
drop function activities.my_issues();
alter table activities.issues drop column route;

create or replace function activities.submit_feedback(p_message text, p_privacy text, p_contact text, p_issue uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare em text := activities.me(); fid uuid;
begin
  if em = '' then raise exception 'Please sign in'; end if;
  if p_privacy not in ('exco_and_responsible', 'anonymous') then raise exception 'Choose who can see your identity'; end if;
  if (select count(*) from activities.suggestion_log where email = em and created_at > now() - interval '1 day') >= 8
  then raise exception 'Daily limit reached, try again tomorrow'; end if;
  if p_issue is not null and not exists (select 1 from activities.issues where id = p_issue and show_to_students and merged_into is null) then
    raise exception 'That issue is not available';
  end if;
  insert into activities.suggestion_log(email) values (em);
  insert into activities.feedback(message, privacy, submitter_email, contact, issue_id)
  values (trim(p_message), p_privacy, case when p_privacy = 'anonymous' then null else em end, nullif(trim(p_contact), ''), p_issue)
  returning id into fid;
  if p_issue is not null then update activities.issues set updated_at = now() where id = p_issue; end if;
  return fid;
end $$;

create function activities.triage_feedback(p_feedback uuid, p_issue uuid, p_new_title text, p_responsible text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare iid uuid := p_issue; resp text := nullif(lower(trim(coalesce(p_responsible, ''))), '');
begin
  if not activities.is_exco() then raise exception 'ExCo only'; end if;
  if not exists (select 1 from activities.feedback where id = p_feedback) then raise exception 'Feedback not found'; end if;
  if iid is null then
    if char_length(trim(coalesce(p_new_title, ''))) < 5 then raise exception 'Give the issue a short title'; end if;
    if resp is not null and not activities.is_assignable(resp) then raise exception 'The person responsible must be ExCo, a committee head or a year representative'; end if;
    insert into activities.issues(title, status, responsible_email) values (trim(p_new_title), 'Open', resp) returning id into iid;
    if resp is not null then insert into activities.issue_notes(issue_id, author_email, kind, body) values (iid, activities.me(), 'assigned', 'Assigned to ' || resp); end if;
  end if;
  update activities.feedback set issue_id = iid where id = p_feedback;
  return iid;
end $$;

create function activities.save_issue(p_id uuid, p_title text, p_status text, p_responsible text, p_show_to_students boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare old activities.issues; exco boolean := activities.is_exco(); resp text := nullif(lower(trim(coalesce(p_responsible, ''))), '');
begin
  select * into old from activities.issues where id = p_id;
  if not found then raise exception 'Issue not found'; end if;
  if not activities.can_edit_issue(p_id) then raise exception 'You cannot edit this issue.'; end if;
  if not exco then resp := old.responsible_email; p_show_to_students := old.show_to_students; end if;
  if resp is distinct from old.responsible_email and resp is not null and not activities.is_assignable(resp) then
    raise exception 'The person responsible must be ExCo, a committee head or a year representative';
  end if;
  update activities.issues set
    title = trim(p_title), status = p_status, responsible_email = resp, show_to_students = p_show_to_students,
    resolved_at = case when p_status = 'Resolved' then coalesce(old.resolved_at, now()) else null end
  where id = p_id;
  if p_status <> old.status then insert into activities.issue_notes(issue_id, author_email, kind, body) values (p_id, activities.me(), 'status', 'Status: ' || old.status || ' to ' || p_status); end if;
  if resp is distinct from old.responsible_email and resp is not null then insert into activities.issue_notes(issue_id, author_email, kind, body) values (p_id, activities.me(), 'assigned', 'Assigned to ' || resp); end if;
end $$;

-- A reply (or a logged email). p_meeting tags it with a meeting, e.g. "SSLG 1".
create function activities.add_issue_note(p_issue uuid, p_kind text, p_body text, p_meeting uuid default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not activities.can_edit_issue(p_issue) then raise exception 'You cannot edit this issue.'; end if;
  if p_kind not in ('note', 'email') then raise exception 'Unknown message type'; end if;
  if p_meeting is not null and not exists (select 1 from activities.meetings where id = p_meeting) then raise exception 'That meeting does not exist'; end if;
  insert into activities.issue_notes(issue_id, author_email, kind, body, meeting_id) values (p_issue, activities.me(), p_kind, trim(p_body), p_meeting);
  update activities.issues set updated_at = now() where id = p_issue;
end $$;

-- ---------- the conversation ----------
-- ExCo and the person responsible see who a student is, unless the student chose to be anonymous. Students see only their own
-- messages, every reply and status changes. Replies tagged with a meeting carry the meeting's name.
create function activities.issue_thread(p_issue uuid)
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
           (em <> '' and n.author_email = em), n.meeting_id, m.name
    from activities.issue_notes n
    left join records.students s on lower(s.email) = n.author_email
    left join activities.meetings m on m.id = n.meeting_id
    where n.issue_id = p_issue and (staff or n.kind <> 'assigned')
  ) t order by t.happened_at, t.id;
end $$;

create function activities.shared_thread(p_issue uuid)
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
    select n.id, n.created_at, n.kind, n.body, 'MedSoc'::text, false, n.meeting_id, m.name
    from activities.issue_notes n left join activities.meetings m on m.id = n.meeting_id
    where n.issue_id = p_issue and n.kind <> 'assigned'
  ) t order by t.happened_at, t.id;
end $$;

-- Issues raised at a meeting: those tagged on at least one reply, as far as the viewer is allowed to see them.
create function activities.meeting_issues(p_meeting uuid)
returns table (id uuid, title text, status text, times_raised bigint, last_update timestamptz, shared boolean, can_edit boolean, mine boolean)
language sql stable security definer set search_path = '' as $$
  select i.id, i.title, i.status, (select count(*) from activities.feedback f where f.issue_id = i.id), i.updated_at,
         i.show_to_students, activities.can_edit_issue(i.id),
         exists (select 1 from activities.feedback f where f.issue_id = i.id and f.submitter_email = activities.me())
  from activities.issues i
  where activities.me() <> '' and i.merged_into is null
    and exists (select 1 from activities.issue_notes n where n.issue_id = i.id and n.meeting_id = p_meeting)
    and (i.show_to_students or activities.can_edit_issue(i.id)
         or exists (select 1 from activities.feedback f where f.issue_id = i.id and f.submitter_email = activities.me()))
  order by i.updated_at desc
$$;

create function activities.my_issues()
returns table (id uuid, title text, status text, updated_at timestamptz, times_raised bigint)
language sql stable security definer set search_path = '' as $$
  select i.id, i.title, i.status, i.updated_at, (select count(*) from activities.feedback f where f.issue_id = i.id)
  from activities.issues i where i.responsible_email = activities.me() and activities.me() <> '' and i.merged_into is null
  order by (i.status = 'Resolved'), i.updated_at desc
$$;

-- ---------- permissions ----------
revoke all on function activities.is_assignable(text) from public;
revoke all on function activities.assignable_people() from public;
revoke all on function activities.triage_feedback(uuid, uuid, text, text) from public;
revoke all on function activities.save_issue(uuid, text, text, text, boolean) from public;
revoke all on function activities.add_issue_note(uuid, text, text, uuid) from public;
revoke all on function activities.issue_thread(uuid) from public;
revoke all on function activities.shared_thread(uuid) from public;
revoke all on function activities.meeting_issues(uuid) from public;
revoke all on function activities.my_issues() from public;
grant execute on function activities.assignable_people() to authenticated;
grant execute on function activities.triage_feedback(uuid, uuid, text, text) to authenticated;
grant execute on function activities.save_issue(uuid, text, text, text, boolean) to authenticated;
grant execute on function activities.add_issue_note(uuid, text, text, uuid) to authenticated;
grant execute on function activities.issue_thread(uuid) to authenticated;
grant execute on function activities.shared_thread(uuid) to authenticated;
grant execute on function activities.meeting_issues(uuid) to authenticated;
grant execute on function activities.my_issues() to authenticated;
