-- Second simplification of feedback and issues. Run after sql/issues_simplify.sql.
--   * two privacy choices only: "exco_only" (ExCo can see who you are) and "anonymous". Staff never see a student's identity.
--   * no public answer and no internal-only notes: everything said on an issue is the conversation, visible to the students
--     who raised it, and to every signed-in student when ExCo ticks "show to student body"
--   * the person responsible is chosen from the current leaders, and shown with their position
--   * matching, the shared list and shared conversations are for signed-in students (not the open internet)

-- ---------- privacy values ----------
alter table activities.feedback drop constraint feedback_privacy_check;
update activities.feedback set privacy = 'exco_only' where privacy in ('named', 'hidden_from_staff');
alter table activities.feedback add constraint feedback_privacy_check check (privacy in ('exco_only', 'anonymous'));
alter table activities.feedback alter column privacy set default 'exco_only';

-- ---------- issues and notes ----------
drop view activities.public_issues;
drop function activities.similar_issues(text);
drop function activities.save_issue(uuid, text, text, text, text, text, boolean);
drop function activities.add_issue_note(uuid, text, text, boolean);
drop function activities.issue_thread(uuid);

alter table activities.issues drop column search, drop column public_answer;
alter table activities.issues rename column show_public to show_to_students;
alter table activities.issue_notes drop column visible_to_submitters;

-- ---------- sending ----------
create or replace function activities.submit_feedback(p_message text, p_privacy text, p_contact text, p_issue uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare em text := activities.me(); fid uuid;
begin
  if em = '' then raise exception 'Please sign in'; end if;
  if p_privacy not in ('exco_only', 'anonymous') then raise exception 'Choose who can see your identity'; end if;
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

-- Matching while typing: issues ExCo has shared with the student body, ranked by how well they fit what was typed.
create function activities.similar_issues(p_text text)
returns table (id uuid, title text, status text, times_raised bigint)
language sql stable security definer set search_path = '' as $$
  select i.id, i.title, i.status, (select count(*) from activities.feedback f where f.issue_id = i.id)
  from activities.issues i
  cross join websearch_to_tsquery('english', left(coalesce(p_text, ''), 300)) q
  cross join lateral (
    select to_tsvector('english', i.title || ' ' ||
      coalesce((select string_agg(f.message, ' ') from activities.feedback f where f.issue_id = i.id), '') || ' ' ||
      coalesce((select string_agg(n.body, ' ') from activities.issue_notes n where n.issue_id = i.id and n.kind in ('note', 'email')), '')) as v
  ) s
  where activities.me() <> '' and i.show_to_students and i.merged_into is null
    and char_length(trim(coalesce(p_text, ''))) >= 4 and s.v @@ q
  order by ts_rank(s.v, q) desc
  limit 5
$$;

-- ---------- ExCo ----------
create or replace function activities.merge_issues(p_from uuid, p_into uuid) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not activities.is_exco() then raise exception 'ExCo only'; end if;
  if p_from = p_into then raise exception 'Choose two different issues'; end if;
  update activities.feedback set issue_id = p_into where issue_id = p_from;
  update activities.issues set merged_into = p_into, show_to_students = false, status = 'Resolved' where id = p_from;
  insert into activities.issue_notes(issue_id, author_email, kind, body) values (p_from, activities.me(), 'status', 'Merged into another issue');
end $$;

create function activities.save_issue(p_id uuid, p_title text, p_status text, p_route text, p_responsible text, p_show_to_students boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare old activities.issues; exco boolean := activities.is_exco(); resp text := nullif(lower(trim(coalesce(p_responsible, ''))), '');
begin
  select * into old from activities.issues where id = p_id;
  if not found then raise exception 'Issue not found'; end if;
  if not activities.can_edit_issue(p_id) then raise exception 'You cannot edit this issue.'; end if;
  if not exco then p_route := old.route; resp := old.responsible_email; p_show_to_students := old.show_to_students; end if;
  if resp is not null and resp !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Choose the person responsible from the list'; end if;
  update activities.issues set
    title = trim(p_title), status = p_status, route = nullif(p_route, ''), responsible_email = resp,
    show_to_students = p_show_to_students,
    resolved_at = case when p_status = 'Resolved' then coalesce(old.resolved_at, now()) else null end
  where id = p_id;
  if p_status <> old.status then insert into activities.issue_notes(issue_id, author_email, kind, body) values (p_id, activities.me(), 'status', 'Status: ' || old.status || ' to ' || p_status); end if;
  if resp is distinct from old.responsible_email and resp is not null then insert into activities.issue_notes(issue_id, author_email, kind, body) values (p_id, activities.me(), 'assigned', 'Assigned to ' || resp); end if;
end $$;

create function activities.add_issue_note(p_issue uuid, p_kind text, p_body text) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not activities.can_edit_issue(p_issue) then raise exception 'You cannot edit this issue.'; end if;
  if p_kind not in ('note', 'email') then raise exception 'Unknown message type'; end if;
  insert into activities.issue_notes(issue_id, author_email, kind, body) values (p_issue, activities.me(), p_kind, trim(p_body));
  update activities.issues set updated_at = now() where id = p_issue;
end $$;

-- Current leaders ExCo can hand an issue to, with their positions.
create function activities.assignable_people() returns table (email text, name text, positions text)
language sql stable security definer set search_path = '' as $$
  select lower(s.email), initcap(lower(coalesce(nullif(s.preferred_name, ''), s.full_name))), string_agg(distinct p.final_title, ', ')
  from records.participation p
  join records.students s on s.matric = p.matric
  join records.academic_years y on y.ay = p.ay and y.is_open
  where activities.is_exco() and p.is_top and coalesce(s.email, '') <> ''
  group by 1, 2
  order by 2
$$;

-- Who is responsible for an issue, with their position (for ExCo and the person responsible).
create function activities.responsible_of(p_issue uuid) returns table (email text, name text, positions text)
language sql stable security definer set search_path = '' as $$
  select i.responsible_email,
         initcap(lower(coalesce(nullif(s.preferred_name, ''), s.full_name))),
         (select string_agg(distinct p.final_title, ', ') from records.participation p
            join records.academic_years y on y.ay = p.ay and y.is_open where p.matric = s.matric and p.is_top)
  from activities.issues i left join records.students s on lower(s.email) = i.responsible_email
  where i.id = p_issue and i.responsible_email is not null and activities.can_edit_issue(p_issue)
$$;

-- ---------- the conversation ----------
-- Staff (ExCo or the person responsible) see everything. Only ExCo ever sees who a student is.
-- A student sees their own messages, every reply, and status changes.
create function activities.issue_thread(p_issue uuid)
returns table (id uuid, happened_at timestamptz, kind text, body text, who text, mine boolean)
language plpgsql stable security definer set search_path = '' as $$
declare staff boolean := activities.can_edit_issue(p_issue); ex boolean := activities.is_exco(); em text := activities.me();
begin
  if not staff and not exists (select 1 from activities.feedback f where f.issue_id = p_issue and em <> '' and f.submitter_email = em) then return; end if;
  return query
  select t.id, t.happened_at, t.kind, t.body, t.who, t.mine from (
    select f.id, f.created_at as happened_at, 'feedback'::text as kind, f.message as body,
           (case when em <> '' and f.submitter_email = em then 'You'
                 when ex then coalesce(f.submitter_email, 'Anonymous')
                 else 'A student' end)::text as who,
           (em <> '' and f.submitter_email = em) as mine
    from activities.feedback f
    where f.issue_id = p_issue and (staff or f.submitter_email = em)
    union all
    select n.id, n.created_at, n.kind, n.body,
           (case when staff then coalesce(initcap(lower(coalesce(nullif(s.preferred_name, ''), s.full_name))), n.author_email) else 'MedSoc' end)::text,
           (em <> '' and n.author_email = em)
    from activities.issue_notes n
    left join records.students s on lower(s.email) = n.author_email
    where n.issue_id = p_issue and (staff or n.kind <> 'assigned')
  ) t order by t.happened_at, t.id;
end $$;

-- An issue ExCo has shared with the student body: any signed-in student can read the conversation.
create function activities.shared_thread(p_issue uuid)
returns table (id uuid, happened_at timestamptz, kind text, body text, who text, mine boolean)
language plpgsql stable security definer set search_path = '' as $$
declare em text := activities.me();
begin
  if em = '' or not exists (select 1 from activities.issues i where i.id = p_issue and i.show_to_students and i.merged_into is null) then return; end if;
  return query
  select t.id, t.happened_at, t.kind, t.body, t.who, t.mine from (
    select f.id, f.created_at as happened_at, 'feedback'::text as kind, f.message as body,
           (case when f.submitter_email = em then 'You' else 'A student' end)::text as who, (f.submitter_email = em) as mine
    from activities.feedback f where f.issue_id = p_issue
    union all
    select n.id, n.created_at, n.kind, n.body, 'MedSoc'::text, false
    from activities.issue_notes n where n.issue_id = p_issue and n.kind <> 'assigned'
  ) t order by t.happened_at, t.id;
end $$;

create view activities.shared_issues as
  select i.id, i.title, i.status, i.resolved_at, i.created_at, i.updated_at,
         (select count(*) from activities.feedback f where f.issue_id = i.id) as times_raised
  from activities.issues i where i.show_to_students and i.merged_into is null;

-- ---------- permissions ----------
revoke all on function activities.similar_issues(text) from public;
revoke all on function activities.save_issue(uuid, text, text, text, text, boolean) from public;
revoke all on function activities.add_issue_note(uuid, text, text) from public;
revoke all on function activities.assignable_people() from public;
revoke all on function activities.responsible_of(uuid) from public;
revoke all on function activities.issue_thread(uuid) from public;
revoke all on function activities.shared_thread(uuid) from public;
grant execute on function activities.similar_issues(text) to authenticated;
grant execute on function activities.save_issue(uuid, text, text, text, text, boolean) to authenticated;
grant execute on function activities.add_issue_note(uuid, text, text) to authenticated;
grant execute on function activities.assignable_people() to authenticated;
grant execute on function activities.responsible_of(uuid) to authenticated;
grant execute on function activities.issue_thread(uuid) to authenticated;
grant execute on function activities.shared_thread(uuid) to authenticated;
revoke all on activities.shared_issues from public, anon;
grant select on activities.shared_issues to authenticated;
