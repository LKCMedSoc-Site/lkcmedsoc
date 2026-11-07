-- Feedback and issues (phase 1). Paste into the Supabase SQL Editor and run once.
--
-- One process for suggestions, complaints and papers for the Student-Staff Liaison Group (SSLG):
--   feedback  = one message from one person (who sent it, how private, what they wrote)
--   issues    = a topic that many feedback messages can point at ("raised 14 times"), with a status,
--               a route (resolve directly, or table at SSLG), a person responsible and an outcome
--   issue_notes = dated timeline per issue (emails sent, decisions, updates)
-- Access: ExCo can do everything. The person responsible for an issue can edit that issue and add notes,
-- but never sees who sent hidden-from-staff feedback. Students see their own feedback and its outcome.
-- The public sees only issues ExCo marks public, with the public answer.
-- Meetings, minutes and actions come in phase 2. The old suggestions tables are left untouched.

-- ---------- tables ----------
create table activities.issues (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  title text not null check (char_length(title) between 5 and 200),
  summary text check (char_length(summary) <= 4000),
  category text not null default 'Other' check (category in ('Academic','Welfare','Facilities','Administrative','Website','Other')),
  tags text[] not null default '{}',
  status text not null default 'New' check (status in ('New','Open','Tabled','Resolved','Declined','Duplicate')),
  route text check (route in ('Direct','SSLG')),
  responsible_email text check (responsible_email = lower(responsible_email)),
  merged_into uuid references activities.issues(id),
  outcome text check (char_length(outcome) <= 4000),
  public_answer text check (char_length(public_answer) <= 4000),
  show_public boolean not null default false,
  resolved_at timestamptz,
  search tsvector generated always as (
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(summary, '') || ' ' || coalesce(public_answer, ''))
  ) stored
);
create index issues_search_idx on activities.issues using gin (search);
create index issues_responsible_idx on activities.issues (responsible_email);

create table activities.feedback (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  issue_id uuid references activities.issues(id) on delete set null,   -- empty until ExCo triages it (or the sender picked a match)
  category text not null check (category in ('Suggestion','Complaint','Website problem','Welfare / other','Paper for SSLG')),
  message text not null check (char_length(message) between 5 and 3000),
  -- named: staff and ExCo can see who sent it.  hidden_from_staff: only ExCo can.  anonymous: nobody can, no email is stored.
  privacy text not null default 'named' check (privacy in ('named','hidden_from_staff','anonymous')),
  submitter_email text,
  contact text,
  wants_sslg boolean not null default false,
  source text not null default 'web form' check (source in ('web form','paper','email','suggestion box')),
  check ((privacy = 'anonymous') = (submitter_email is null))
);
create index feedback_issue_idx on activities.feedback (issue_id);
create index feedback_email_idx on activities.feedback (submitter_email);

create table activities.issue_notes (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references activities.issues(id) on delete cascade,
  created_at timestamptz not null default now(),
  author_email text not null,
  kind text not null default 'note' check (kind in ('note','email','status','outcome','assigned')),
  body text not null check (char_length(body) between 1 and 4000),
  visible_to_submitters boolean not null default false
);
create index issue_notes_issue_idx on activities.issue_notes (issue_id, created_at);

alter table activities.issues enable row level security;
alter table activities.feedback enable row level security;
alter table activities.issue_notes enable row level security;

-- ExCo: everything. Responsible person: read their own issues and notes. Students: read their own feedback.
-- All changes by anyone but ExCo go through the functions below.
create policy exco_all on activities.issues for all to authenticated using (activities.is_exco()) with check (activities.is_exco());
create policy responsible_read on activities.issues for select to authenticated using (responsible_email = lower(coalesce(auth.jwt() ->> 'email', '')));
create policy exco_all on activities.feedback for all to authenticated using (activities.is_exco()) with check (activities.is_exco());
create policy own_read on activities.feedback for select to authenticated using (submitter_email = lower(coalesce(auth.jwt() ->> 'email', '')));
create policy exco_all on activities.issue_notes for all to authenticated using (activities.is_exco()) with check (activities.is_exco());
create policy responsible_read on activities.issue_notes for select to authenticated using (
  exists (select 1 from activities.issues i where i.id = issue_id and i.responsible_email = lower(coalesce(auth.jwt() ->> 'email', ''))));

grant select, insert, update, delete on activities.issues, activities.feedback, activities.issue_notes to authenticated;

-- ---------- helpers ----------
create function activities.me() returns text language sql stable security definer set search_path = '' as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''))
$$;

create function activities.can_edit_issue(p_issue uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select activities.is_exco() or exists (select 1 from activities.issues i where i.id = p_issue and i.responsible_email = activities.me() and activities.me() <> '')
$$;

create function activities.touch_issue() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger issues_touch before update on activities.issues for each row execute function activities.touch_issue();

-- ---------- sending feedback ----------
-- Any signed-in student. p_issue = the student picked "this is my question" on an existing public issue:
-- the feedback joins that issue straight away and counts towards "raised N times".
create function activities.submit_feedback(p_category text, p_message text, p_privacy text, p_contact text, p_wants_sslg boolean, p_issue uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare em text := activities.me(); fid uuid;
begin
  if em = '' then raise exception 'Please sign in'; end if;
  if p_privacy not in ('named','hidden_from_staff','anonymous') then raise exception 'Choose how your name is shown'; end if;
  if (select count(*) from activities.suggestion_log where email = em and created_at > now() - interval '1 day') >= 8
  then raise exception 'Daily limit reached, try again tomorrow'; end if;
  if p_issue is not null and not exists (select 1 from activities.issues where id = p_issue and show_public and status <> 'Duplicate') then
    raise exception 'That issue is not available';
  end if;
  insert into activities.suggestion_log(email) values (em);
  insert into activities.feedback(category, message, privacy, submitter_email, contact, wants_sslg, issue_id)
  values (p_category, trim(p_message), p_privacy, case when p_privacy = 'anonymous' then null else em end, nullif(trim(p_contact), ''), coalesce(p_wants_sslg, false), p_issue)
  returning id into fid;
  if p_issue is not null then update activities.issues set updated_at = now() where id = p_issue; end if;
  return fid;
end $$;

-- Matching while typing: public issues ranked by how well they fit the text.
create function activities.similar_issues(p_text text)
returns table (id uuid, title text, status text, public_answer text, times_raised bigint)
language sql stable security definer set search_path = '' as $$
  select i.id, i.title, i.status, i.public_answer, (select count(*) from activities.feedback f where f.issue_id = i.id)
  from activities.issues i, websearch_to_tsquery('english', left(coalesce(p_text, ''), 300)) q
  where i.show_public and i.status <> 'Duplicate' and char_length(trim(coalesce(p_text, ''))) >= 4 and i.search @@ q
  order by ts_rank(i.search, q) desc
  limit 5
$$;

-- ---------- triage (ExCo) ----------
-- Link a piece of feedback to an existing issue (p_issue) or start a new one (p_new_title).
create function activities.triage_feedback(p_feedback uuid, p_issue uuid, p_new_title text, p_category text, p_route text, p_responsible text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare iid uuid := p_issue; f activities.feedback; resp text := nullif(lower(trim(coalesce(p_responsible, ''))), '');
begin
  if not activities.is_exco() then raise exception 'ExCo only'; end if;
  select * into f from activities.feedback where id = p_feedback;
  if not found then raise exception 'Feedback not found'; end if;
  if iid is null then
    if char_length(trim(coalesce(p_new_title, ''))) < 5 then raise exception 'Give the issue a short title'; end if;
    insert into activities.issues(title, summary, category, status, route, responsible_email)
    values (trim(p_new_title), f.message, coalesce(p_category, 'Other'), case when nullif(p_route, '') is null then 'New' else 'Open' end, nullif(p_route, ''), resp)
    returning id into iid;
    if resp is not null then insert into activities.issue_notes(issue_id, author_email, kind, body) values (iid, activities.me(), 'assigned', 'Assigned to ' || resp); end if;
  end if;
  update activities.feedback set issue_id = iid where id = p_feedback;
  return iid;
end $$;

-- Combine a duplicate issue into another: its feedback moves across.
create function activities.merge_issues(p_from uuid, p_into uuid) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not activities.is_exco() then raise exception 'ExCo only'; end if;
  if p_from = p_into then raise exception 'Choose two different issues'; end if;
  update activities.feedback set issue_id = p_into where issue_id = p_from;
  update activities.issues set status = 'Duplicate', merged_into = p_into, show_public = false where id = p_from;
  insert into activities.issue_notes(issue_id, author_email, kind, body) values (p_from, activities.me(), 'status', 'Merged into another issue');
end $$;

-- ---------- editing an issue (ExCo, or the person responsible) ----------
-- The responsible person can change the write-up, status, outcome, public answer text and tags.
-- Only ExCo can change the route, who is responsible, whether it is public, and mark it Tabled or Duplicate.
create function activities.save_issue(
  p_id uuid, p_title text, p_summary text, p_category text, p_tags text[], p_status text, p_route text,
  p_responsible text, p_outcome text, p_public_answer text, p_show_public boolean
) returns void language plpgsql security definer set search_path = '' as $$
declare old activities.issues; exco boolean := activities.is_exco(); resp text := nullif(lower(trim(coalesce(p_responsible, ''))), '');
begin
  select * into old from activities.issues where id = p_id;
  if not found then raise exception 'Issue not found'; end if;
  if not activities.can_edit_issue(p_id) then raise exception 'You cannot edit this issue.'; end if;
  if not exco and (p_status in ('Tabled','Duplicate') and p_status <> old.status) then raise exception 'Only ExCo can set that status'; end if;
  if not exco then
    p_route := old.route; resp := old.responsible_email; p_show_public := old.show_public;
  end if;
  if resp is not null and resp !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'Enter a full email address for the person responsible'; end if;
  update activities.issues set
    title = trim(p_title), summary = nullif(trim(p_summary), ''), category = p_category, tags = coalesce(p_tags, '{}'),
    status = p_status, route = nullif(p_route, ''), responsible_email = resp,
    outcome = nullif(trim(p_outcome), ''), public_answer = nullif(trim(p_public_answer), ''), show_public = p_show_public,
    resolved_at = case when p_status = 'Resolved' then coalesce(old.resolved_at, now()) else null end
  where id = p_id;
  if p_status <> old.status then insert into activities.issue_notes(issue_id, author_email, kind, body) values (p_id, activities.me(), 'status', 'Status: ' || old.status || ' to ' || p_status); end if;
  if resp is distinct from old.responsible_email and resp is not null then insert into activities.issue_notes(issue_id, author_email, kind, body) values (p_id, activities.me(), 'assigned', 'Assigned to ' || resp); end if;
end $$;

create function activities.add_issue_note(p_issue uuid, p_kind text, p_body text, p_visible boolean) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not activities.can_edit_issue(p_issue) then raise exception 'You cannot edit this issue.'; end if;
  if p_kind not in ('note','email','outcome') then raise exception 'Unknown note type'; end if;
  insert into activities.issue_notes(issue_id, author_email, kind, body, visible_to_submitters) values (p_issue, activities.me(), p_kind, trim(p_body), coalesce(p_visible, false));
  update activities.issues set updated_at = now() where id = p_issue;
end $$;

-- ---------- reading ----------
-- Who sent the feedback on an issue. The person responsible sees names only for "named" feedback.
create function activities.issue_feedback(p_issue uuid)
returns table (id uuid, created_at timestamptz, category text, message text, privacy text, who text, contact text, wants_sslg boolean, source text)
language sql stable security definer set search_path = '' as $$
  select f.id, f.created_at, f.category, f.message, f.privacy,
         case when activities.is_exco() or f.privacy = 'named' then coalesce(f.submitter_email, 'Anonymous') else 'Hidden from staff' end,
         case when activities.is_exco() or f.privacy = 'named' then f.contact else null end,
         f.wants_sslg, f.source
  from activities.feedback f
  where f.issue_id = p_issue and activities.can_edit_issue(p_issue)
  order by f.created_at
$$;

-- A student's own feedback and what became of it (only notes marked "visible to submitters").
create function activities.my_feedback()
returns table (id uuid, created_at timestamptz, category text, message text, privacy text, issue_id uuid, issue_title text, issue_status text, outcome text, updates jsonb)
language sql stable security definer set search_path = '' as $$
  select f.id, f.created_at, f.category, f.message, f.privacy, i.id, i.title, i.status, i.outcome,
         coalesce((select jsonb_agg(jsonb_build_object('at', n.created_at, 'body', n.body) order by n.created_at)
                   from activities.issue_notes n where n.issue_id = i.id and n.visible_to_submitters), '[]'::jsonb)
  from activities.feedback f left join activities.issues i on i.id = f.issue_id
  where f.submitter_email = activities.me()
  order by f.created_at desc
$$;

-- Issues the signed-in person is responsible for.
create function activities.my_issues()
returns table (id uuid, title text, status text, route text, category text, updated_at timestamptz, times_raised bigint)
language sql stable security definer set search_path = '' as $$
  select i.id, i.title, i.status, i.route, i.category, i.updated_at, (select count(*) from activities.feedback f where f.issue_id = i.id)
  from activities.issues i where i.responsible_email = activities.me() and activities.me() <> '' and i.status <> 'Duplicate'
  order by (i.status in ('Resolved','Declined')), i.updated_at desc
$$;

-- The public index of issues: only those ExCo ticked "show publicly", with the public answer.
create view activities.public_issues as
  select i.id, i.title, i.category, i.tags, i.status, i.public_answer, i.resolved_at, i.created_at,
         (select count(*) from activities.feedback f where f.issue_id = i.id) as times_raised
  from activities.issues i where i.show_public and i.status <> 'Duplicate';

-- ---------- permissions ----------
revoke all on function activities.me(), activities.can_edit_issue(uuid), activities.touch_issue() from public;
revoke all on function activities.submit_feedback(text, text, text, text, boolean, uuid) from public;
revoke all on function activities.similar_issues(text) from public;
revoke all on function activities.triage_feedback(uuid, uuid, text, text, text, text) from public;
revoke all on function activities.merge_issues(uuid, uuid) from public;
revoke all on function activities.save_issue(uuid, text, text, text, text[], text, text, text, text, text, boolean) from public;
revoke all on function activities.add_issue_note(uuid, text, text, boolean) from public;
revoke all on function activities.issue_feedback(uuid) from public;
revoke all on function activities.my_feedback() from public;
revoke all on function activities.my_issues() from public;
grant execute on function activities.me(), activities.can_edit_issue(uuid) to authenticated;
grant execute on function activities.submit_feedback(text, text, text, text, boolean, uuid) to authenticated;
grant execute on function activities.similar_issues(text) to anon, authenticated;
grant execute on function activities.triage_feedback(uuid, uuid, text, text, text, text) to authenticated;
grant execute on function activities.merge_issues(uuid, uuid) to authenticated;
grant execute on function activities.save_issue(uuid, text, text, text, text[], text, text, text, text, text, boolean) to authenticated;
grant execute on function activities.add_issue_note(uuid, text, text, boolean) to authenticated;
grant execute on function activities.issue_feedback(uuid) to authenticated;
grant execute on function activities.my_feedback() to authenticated;
grant execute on function activities.my_issues() to authenticated;
grant select on activities.public_issues to anon, authenticated;

-- ---------- bring across what is already in the suggestion box ----------
insert into activities.feedback(created_at, category, message, privacy, submitter_email, contact, source)
select s.created_at, s.category, s.message,
       case when s.submitter_email is null then 'anonymous' else 'named' end, lower(s.submitter_email), s.contact, 'suggestion box'
from activities.suggestions s;
