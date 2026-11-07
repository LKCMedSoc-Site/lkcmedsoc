-- Simplify feedback and issues, and make each issue one conversation. Run after sql/issues.sql.
--   * no feedback types, no issue topics/tags/background/outcome: an issue is a title, a status, a route and a person responsible
--   * three statuses: Open, Pending, Resolved ("Tabled at SSLG" becomes the backend route, not a status or a checkbox)
--   * a duplicate that was merged away is hidden by merged_into, not by a status
--   * issue_thread(): the chat-style conversation (people who raised it on one side, responders on the other)
--   * reply_to_issue(): a student adds a follow-up to an issue they raised (reopens it if it was resolved)

drop view activities.public_issues;
drop function activities.issue_feedback(uuid);
drop function activities.my_feedback();
drop function activities.my_issues();
drop function activities.similar_issues(text);
drop function activities.save_issue(uuid, text, text, text, text[], text, text, text, text, text, boolean);
drop function activities.triage_feedback(uuid, uuid, text, text, text, text);
drop function activities.submit_feedback(text, text, text, text, boolean, uuid);

alter table activities.issues drop column search;
alter table activities.issues drop column summary, drop column category, drop column tags, drop column outcome;
alter table activities.issues drop constraint issues_status_check;
update activities.issues set status = case status when 'New' then 'Open' when 'Tabled' then 'Pending' else 'Resolved' end;
alter table activities.issues alter column status set default 'Open';
alter table activities.issues add constraint issues_status_check check (status in ('Open','Pending','Resolved'));
alter table activities.issues add column search tsvector generated always as (
  to_tsvector('english', coalesce(title, '') || ' ' || coalesce(public_answer, ''))
) stored;
create index issues_search_idx on activities.issues using gin (search);
alter table activities.feedback drop column category, drop column wants_sslg;

-- ---------- sending ----------
create function activities.submit_feedback(p_message text, p_privacy text, p_contact text, p_issue uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare em text := activities.me(); fid uuid;
begin
  if em = '' then raise exception 'Please sign in'; end if;
  if p_privacy not in ('named','hidden_from_staff','anonymous') then raise exception 'Choose how your name is shown'; end if;
  if (select count(*) from activities.suggestion_log where email = em and created_at > now() - interval '1 day') >= 8
  then raise exception 'Daily limit reached, try again tomorrow'; end if;
  if p_issue is not null and not exists (select 1 from activities.issues where id = p_issue and show_public and merged_into is null) then
    raise exception 'That issue is not available';
  end if;
  insert into activities.suggestion_log(email) values (em);
  insert into activities.feedback(message, privacy, submitter_email, contact, issue_id)
  values (trim(p_message), p_privacy, case when p_privacy = 'anonymous' then null else em end, nullif(trim(p_contact), ''), p_issue)
  returning id into fid;
  if p_issue is not null then update activities.issues set updated_at = now() where id = p_issue; end if;
  return fid;
end $$;

create function activities.reply_to_issue(p_issue uuid, p_message text) returns void language plpgsql security definer set search_path = '' as $$
declare em text := activities.me(); pv text; st text;
begin
  if em = '' then raise exception 'Please sign in'; end if;
  select f.privacy into pv from activities.feedback f where f.issue_id = p_issue and f.submitter_email = em order by f.created_at desc limit 1;
  if pv is null then raise exception 'You can only reply to an issue you raised.'; end if;
  if (select count(*) from activities.suggestion_log where email = em and created_at > now() - interval '1 day') >= 20
  then raise exception 'Daily limit reached, try again tomorrow'; end if;
  insert into activities.suggestion_log(email) values (em);
  insert into activities.feedback(issue_id, message, privacy, submitter_email) values (p_issue, trim(p_message), pv, em);
  select status into st from activities.issues where id = p_issue;
  if st = 'Resolved' then
    update activities.issues set status = 'Open', resolved_at = null where id = p_issue;
    insert into activities.issue_notes(issue_id, author_email, kind, body) values (p_issue, em, 'status', 'Reopened by a follow-up');
  else
    update activities.issues set updated_at = now() where id = p_issue;
  end if;
end $$;

create function activities.similar_issues(p_text text)
returns table (id uuid, title text, status text, public_answer text, times_raised bigint)
language sql stable security definer set search_path = '' as $$
  select i.id, i.title, i.status, i.public_answer, (select count(*) from activities.feedback f where f.issue_id = i.id)
  from activities.issues i, websearch_to_tsquery('english', left(coalesce(p_text, ''), 300)) q
  where i.show_public and i.merged_into is null and char_length(trim(coalesce(p_text, ''))) >= 4 and i.search @@ q
  order by ts_rank(i.search, q) desc
  limit 5
$$;

-- ---------- ExCo ----------
create function activities.triage_feedback(p_feedback uuid, p_issue uuid, p_new_title text, p_route text, p_responsible text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare iid uuid := p_issue; resp text := nullif(lower(trim(coalesce(p_responsible, ''))), '');
begin
  if not activities.is_exco() then raise exception 'ExCo only'; end if;
  if not exists (select 1 from activities.feedback where id = p_feedback) then raise exception 'Feedback not found'; end if;
  if iid is null then
    if char_length(trim(coalesce(p_new_title, ''))) < 5 then raise exception 'Give the issue a short title'; end if;
    insert into activities.issues(title, status, route, responsible_email)
    values (trim(p_new_title), 'Open', nullif(p_route, ''), resp) returning id into iid;
    if resp is not null then insert into activities.issue_notes(issue_id, author_email, kind, body) values (iid, activities.me(), 'assigned', 'Assigned to ' || resp); end if;
  end if;
  update activities.feedback set issue_id = iid where id = p_feedback;
  return iid;
end $$;

create or replace function activities.merge_issues(p_from uuid, p_into uuid) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not activities.is_exco() then raise exception 'ExCo only'; end if;
  if p_from = p_into then raise exception 'Choose two different issues'; end if;
  update activities.feedback set issue_id = p_into where issue_id = p_from;
  update activities.issues set merged_into = p_into, show_public = false, status = 'Resolved' where id = p_from;
  insert into activities.issue_notes(issue_id, author_email, kind, body) values (p_from, activities.me(), 'status', 'Merged into another issue');
end $$;

-- ExCo or the person responsible. The responsible person cannot change the route, who is responsible, or whether it is public.
create function activities.save_issue(p_id uuid, p_title text, p_status text, p_route text, p_responsible text, p_public_answer text, p_show_public boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare old activities.issues; exco boolean := activities.is_exco(); resp text := nullif(lower(trim(coalesce(p_responsible, ''))), '');
begin
  select * into old from activities.issues where id = p_id;
  if not found then raise exception 'Issue not found'; end if;
  if not activities.can_edit_issue(p_id) then raise exception 'You cannot edit this issue.'; end if;
  if not exco then p_route := old.route; resp := old.responsible_email; p_show_public := old.show_public; end if;
  if resp is not null and resp !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Enter a full email address for the person responsible'; end if;
  update activities.issues set
    title = trim(p_title), status = p_status, route = nullif(p_route, ''), responsible_email = resp,
    public_answer = nullif(trim(p_public_answer), ''), show_public = p_show_public,
    resolved_at = case when p_status = 'Resolved' then coalesce(old.resolved_at, now()) else null end
  where id = p_id;
  if p_status <> old.status then insert into activities.issue_notes(issue_id, author_email, kind, body) values (p_id, activities.me(), 'status', 'Status: ' || old.status || ' to ' || p_status); end if;
  if resp is distinct from old.responsible_email and resp is not null then insert into activities.issue_notes(issue_id, author_email, kind, body) values (p_id, activities.me(), 'assigned', 'Assigned to ' || resp); end if;
end $$;

-- ---------- the conversation ----------
-- Staff (ExCo or the person responsible) see everything; names follow each sender's privacy choice.
-- A student sees only their own messages, replies marked visible to them, and status changes.
create function activities.issue_thread(p_issue uuid)
returns table (id uuid, happened_at timestamptz, kind text, body text, who text, internal boolean, mine boolean)
language plpgsql stable security definer set search_path = '' as $$
declare staff boolean := activities.can_edit_issue(p_issue); ex boolean := activities.is_exco(); em text := activities.me();
begin
  if not staff and not exists (select 1 from activities.feedback f where f.issue_id = p_issue and em <> '' and f.submitter_email = em) then return; end if;
  return query
  select t.id, t.happened_at, t.kind, t.body, t.who, t.internal, t.mine from (
    select f.id, f.created_at as happened_at, 'feedback'::text as kind, f.message as body,
           (case when em <> '' and f.submitter_email = em then 'You'
                 when ex or f.privacy = 'named' then coalesce(f.submitter_email, 'Anonymous')
                 else 'Hidden from staff' end)::text as who,
           false as internal, (em <> '' and f.submitter_email = em) as mine
    from activities.feedback f
    where f.issue_id = p_issue and (staff or f.submitter_email = em)
    union all
    select n.id, n.created_at, n.kind, n.body,
           (case when staff then n.author_email else 'MedSoc' end)::text,
           (n.kind in ('note','email','outcome') and not n.visible_to_submitters), (em <> '' and n.author_email = em)
    from activities.issue_notes n
    where n.issue_id = p_issue and (staff or n.kind = 'status' or (n.visible_to_submitters and n.kind <> 'assigned'))
  ) t order by t.happened_at, t.id;
end $$;

create function activities.my_feedback()
returns table (id uuid, created_at timestamptz, message text, privacy text, issue_id uuid, issue_title text, issue_status text, last_update timestamptz)
language sql stable security definer set search_path = '' as $$
  select f.id, f.created_at, f.message, f.privacy, i.id, i.title, i.status,
         greatest(f.created_at, i.updated_at)
  from activities.feedback f left join activities.issues i on i.id = f.issue_id
  where f.submitter_email = activities.me() and activities.me() <> ''
  order by f.created_at desc
$$;

create function activities.my_issues()
returns table (id uuid, title text, status text, route text, updated_at timestamptz, times_raised bigint)
language sql stable security definer set search_path = '' as $$
  select i.id, i.title, i.status, i.route, i.updated_at, (select count(*) from activities.feedback f where f.issue_id = i.id)
  from activities.issues i where i.responsible_email = activities.me() and activities.me() <> '' and i.merged_into is null
  order by (i.status = 'Resolved'), i.updated_at desc
$$;

create view activities.public_issues as
  select i.id, i.title, i.status, i.public_answer, i.resolved_at, i.created_at,
         (select count(*) from activities.feedback f where f.issue_id = i.id) as times_raised
  from activities.issues i where i.show_public and i.merged_into is null;

-- ---------- permissions ----------
revoke all on function activities.submit_feedback(text, text, text, uuid) from public;
revoke all on function activities.reply_to_issue(uuid, text) from public;
revoke all on function activities.similar_issues(text) from public;
revoke all on function activities.triage_feedback(uuid, uuid, text, text, text) from public;
revoke all on function activities.merge_issues(uuid, uuid) from public;
revoke all on function activities.save_issue(uuid, text, text, text, text, text, boolean) from public;
revoke all on function activities.issue_thread(uuid) from public;
revoke all on function activities.my_feedback() from public;
revoke all on function activities.my_issues() from public;
grant execute on function activities.submit_feedback(text, text, text, uuid) to authenticated;
grant execute on function activities.reply_to_issue(uuid, text) to authenticated;
grant execute on function activities.similar_issues(text) to anon, authenticated;
grant execute on function activities.triage_feedback(uuid, uuid, text, text, text) to authenticated;
grant execute on function activities.merge_issues(uuid, uuid) to authenticated;
grant execute on function activities.save_issue(uuid, text, text, text, text, text, boolean) to authenticated;
grant execute on function activities.issue_thread(uuid) to authenticated;
grant execute on function activities.my_feedback() to authenticated;
grant execute on function activities.my_issues() to authenticated;
grant select on activities.public_issues to anon, authenticated;
