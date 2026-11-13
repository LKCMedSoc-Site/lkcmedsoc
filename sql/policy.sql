-- MedSoc policy: the Constitution, Bylaws and Guides as numbered clauses, changed only through approved amendments.
-- Run once in the Supabase SQL editor (project: lkcmedsoc-inventory). Safe to run more than once. Needs activities.is_exco() from the other set-up files.
-- Everything lives in the activities schema (already exposed to the API); the site and the Policy app talk to it through the policy_* functions below.
--
-- How it fits together
--   policy_docs              one row per document: a Constitution, a Bylaw document, a Guide, or a pointer to an NTU/School rule.
--   policy_clauses           the text as it stands now. Each clause has a ref (B-3.2) that is never reused.
--   policy_clause_versions   a frozen copy of every clause for each version of its document: "the text as at version 3".
--   policy_amendments        a proposed change: the reason, the clauses it touches, who proposed it, where it stands.
--   policy_amendment_changes the old and new text of each clause an amendment touches.
--   policy_votes / policy_comments  the recorded decision and the discussion.
-- A document that has never been adopted is a draft: ExCo can edit its clauses directly. Once adopted it only changes through an amendment.

create table if not exists activities.policy_settings (
  key text primary key, value jsonb not null
);
insert into activities.policy_settings (key, value) values
  ('exco_seats', '8'::jsonb),          -- how many officers have a vote
  ('publish_within_days', '7'::jsonb)  -- Bylaws are published within this many days of approval
on conflict (key) do nothing;

create table if not exists activities.policy_docs (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (length(trim(title)) between 3 and 120),
  tier text not null check (tier in ('constitution', 'bylaw', 'guide', 'external')),
  summary text not null default '' check (length(summary) <= 400),
  owner text not null default 'ExCo',            -- who may change it: ExCo, a General Meeting, or the owning officer
  ord integer not null default 100,
  status text not null default 'draft' check (status in ('draft', 'in_force')),
  version integer not null default 0,            -- 0 while a draft; 1, 2, 3... once in force
  effective_on date,                             -- when the current version took effect
  published boolean not null default false,      -- shown on the public site
  source_url text,                               -- external entries: where the official text lives
  last_checked date,                             -- external entries: when someone last confirmed it is current
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists activities.policy_clauses (
  id uuid primary key default gen_random_uuid(),
  doc_id uuid not null references activities.policy_docs (id) on delete cascade,
  ref text not null unique check (ref ~ '^[A-Z]{1,3}-[0-9]+\.[0-9]+$'),   -- B-3.2: never reused, even after the clause is repealed
  ord integer not null default 100,
  heading text not null check (length(trim(heading)) between 1 and 160),
  body_md text not null default '',
  repealed boolean not null default false,
  updated_at timestamptz not null default now()
);
create index if not exists policy_clauses_doc on activities.policy_clauses (doc_id, ord);

create table if not exists activities.policy_amendments (
  id uuid primary key default gen_random_uuid(),
  number serial,                                   -- A-001, A-002 ...
  doc_id uuid not null references activities.policy_docs (id) on delete cascade,
  kind text not null default 'change' check (kind in ('change', 'adopt')),   -- adopt = bring a draft document into force
  title text not null check (length(trim(title)) between 3 and 140),
  reason text not null default '',
  status text not null default 'proposed' check (status in ('proposed', 'approved', 'rejected', 'withdrawn', 'in_force')),
  proposed_by uuid,
  proposed_by_name text,
  proposed_at timestamptz not null default now(),
  decided_at timestamptz,
  publish_by date,                                 -- approval date + publish_within_days
  published_at timestamptz,
  effective_on date,
  version_after integer,                           -- the document version this amendment created
  meeting_date date,                               -- Constitution only: the General Meeting that voted
  meeting_for integer, meeting_against integer,
  sao_confirmed boolean
);
create index if not exists policy_amendments_doc on activities.policy_amendments (doc_id, status);

create table if not exists activities.policy_amendment_changes (
  id uuid primary key default gen_random_uuid(),
  amendment_id uuid not null references activities.policy_amendments (id) on delete cascade,
  clause_id uuid references activities.policy_clauses (id),   -- null when the clause is new
  ref text not null,
  action text not null check (action in ('edit', 'add', 'repeal')),
  old_heading text, old_body_md text,
  new_heading text, new_body_md text,
  ord integer not null default 100
);
create index if not exists policy_changes_am on activities.policy_amendment_changes (amendment_id);

create table if not exists activities.policy_clause_versions (
  clause_id uuid not null references activities.policy_clauses (id) on delete cascade,
  doc_version integer not null,
  heading text not null,
  body_md text not null,
  repealed boolean not null default false,
  amendment_id uuid references activities.policy_amendments (id),
  primary key (clause_id, doc_version)
);

create table if not exists activities.policy_votes (
  amendment_id uuid not null references activities.policy_amendments (id) on delete cascade,
  voter uuid not null,
  voter_name text,
  vote text not null check (vote in ('for', 'against', 'abstain', 'recused')),
  comment text,
  voted_at timestamptz not null default now(),
  primary key (amendment_id, voter)
);

create table if not exists activities.policy_comments (
  id uuid primary key default gen_random_uuid(),
  amendment_id uuid not null references activities.policy_amendments (id) on delete cascade,
  author uuid not null,
  author_name text,
  body text not null check (length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);

-- Nobody reads or writes these tables directly: every action goes through the functions below, which check who is asking.
alter table activities.policy_settings enable row level security;
alter table activities.policy_docs enable row level security;
alter table activities.policy_clauses enable row level security;
alter table activities.policy_amendments enable row level security;
alter table activities.policy_amendment_changes enable row level security;
alter table activities.policy_clause_versions enable row level security;
alter table activities.policy_votes enable row level security;
alter table activities.policy_comments enable row level security;

-- ---------- reading: public ----------
-- The documents people may see, newest tier order first.
create or replace function activities.policy_index() returns jsonb
language sql stable security definer set search_path to 'activities', 'public' as $$
  select coalesce(jsonb_agg(to_jsonb(x) order by x.tier_ord, x.ord), '[]'::jsonb) from (
    select d.slug, d.title, d.tier, d.summary, d.owner, d.status, d.version, d.effective_on, d.source_url, d.last_checked, d.ord,
           case d.tier when 'constitution' then 1 when 'bylaw' then 2 when 'guide' then 3 else 4 end as tier_ord,
           (select count(*) from policy_clauses c where c.doc_id = d.id and not c.repealed) as clauses
      from policy_docs d where d.published
  ) x
$$;

-- One document. p_version null = the version in force (or the working draft if it has never been adopted).
create or replace function activities.policy_doc(p_slug text, p_version integer default null) returns jsonb
language plpgsql stable security definer set search_path to 'activities', 'public' as $$
declare d policy_docs; v integer; res jsonb;
begin
  select * into d from policy_docs where slug = p_slug and (published or is_exco());
  if not found then return null; end if;
  v := coalesce(p_version, d.version);
  if v > d.version then return null; end if;
  if v = 0 then
    select jsonb_agg(jsonb_build_object('ref', c.ref, 'heading', c.heading, 'body_md', c.body_md) order by c.ord, c.ref) into res
      from policy_clauses c where c.doc_id = d.id and not c.repealed;
  else
    select jsonb_agg(jsonb_build_object('ref', c.ref, 'heading', cv.heading, 'body_md', cv.body_md) order by c.ord, c.ref) into res
      from policy_clauses c
      join lateral (select * from policy_clause_versions x where x.clause_id = c.id and x.doc_version <= v order by x.doc_version desc limit 1) cv on true
     where c.doc_id = d.id and not cv.repealed;
  end if;
  return jsonb_build_object(
    'doc', jsonb_build_object('slug', d.slug, 'title', d.title, 'tier', d.tier, 'summary', d.summary, 'owner', d.owner, 'status', d.status,
                              'version', d.version, 'shown_version', v, 'effective_on', d.effective_on, 'source_url', d.source_url, 'last_checked', d.last_checked),
    'clauses', coalesce(res, '[]'::jsonb),
    'versions', coalesce((select jsonb_agg(jsonb_build_object('version', a.version_after, 'effective_on', a.effective_on, 'title', a.title, 'number', a.number) order by a.version_after desc)
                           from policy_amendments a where a.doc_id = d.id and a.status = 'in_force'), '[]'::jsonb));
end $$;

-- The public changelog: every amendment that came into force, with who decided it and how.
create or replace function activities.policy_changelog(p_slug text default null) returns jsonb
language sql stable security definer set search_path to 'activities', 'public' as $$
  select coalesce(jsonb_agg(to_jsonb(x) order by x.effective_on desc, x.number desc), '[]'::jsonb) from (
    select a.number, a.title, a.reason, a.kind, a.effective_on, a.decided_at, a.version_after as version, a.meeting_date, a.meeting_for, a.meeting_against, a.sao_confirmed,
           d.slug as doc_slug, d.title as doc_title, d.tier,
           (select jsonb_build_object('for', count(*) filter (where v.vote = 'for'), 'against', count(*) filter (where v.vote = 'against'),
                                      'abstain', count(*) filter (where v.vote = 'abstain'), 'recused', count(*) filter (where v.vote = 'recused'))
              from policy_votes v where v.amendment_id = a.id) as votes,
           coalesce((select jsonb_agg(jsonb_build_object('ref', c.ref, 'action', c.action, 'old_heading', c.old_heading, 'old_body_md', c.old_body_md,
                                                         'new_heading', c.new_heading, 'new_body_md', c.new_body_md) order by c.ord, c.ref)
                       from policy_amendment_changes c where c.amendment_id = a.id), '[]'::jsonb) as changes
      from policy_amendments a join policy_docs d on d.id = a.doc_id
     where a.status = 'in_force' and d.published and (p_slug is null or d.slug = p_slug)
  ) x
$$;

create or replace function activities.policy_search(p_q text) returns jsonb
language sql stable security definer set search_path to 'activities', 'public' as $$
  select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from (
    select d.slug as doc_slug, d.title as doc_title, c.ref, c.heading, left(c.body_md, 220) as snippet
      from policy_clauses c join policy_docs d on d.id = c.doc_id
     where d.published and not c.repealed and length(trim(coalesce(p_q, ''))) >= 2
       and (c.heading ilike '%' || trim(p_q) || '%' or c.body_md ilike '%' || trim(p_q) || '%' or c.ref ilike trim(p_q))
     order by d.ord, c.ord limit 30
  ) x
$$;

grant execute on function activities.policy_index(), activities.policy_doc(text, integer), activities.policy_changelog(text), activities.policy_search(text) to anon, authenticated;

-- ---------- ExCo: the working view ----------
create or replace function activities.policy_all() returns jsonb
language plpgsql stable security definer set search_path to 'activities', 'public' as $$
begin
  if not is_exco() then raise exception 'ExCo only'; end if;
  return coalesce((select jsonb_agg(to_jsonb(x) order by x.ord) from (
    select d.id, d.slug, d.title, d.tier, d.summary, d.owner, d.status, d.version, d.effective_on, d.published, d.source_url, d.last_checked, d.ord,
           (select count(*) from policy_clauses c where c.doc_id = d.id and not c.repealed) as clauses,
           (select count(*) from policy_amendments a where a.doc_id = d.id and a.status in ('proposed', 'approved')) as open_amendments
      from policy_docs d) x), '[]'::jsonb);
end $$;

-- The clauses as they stand now (not a past version), with ids, for editing.
create or replace function activities.policy_working(p_slug text) returns jsonb
language plpgsql stable security definer set search_path to 'activities', 'public' as $$
declare d policy_docs;
begin
  if not is_exco() then raise exception 'ExCo only'; end if;
  select * into d from policy_docs where slug = p_slug;
  if not found then return null; end if;
  return jsonb_build_object('doc', to_jsonb(d),
    'clauses', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'ref', c.ref, 'heading', c.heading, 'body_md', c.body_md, 'repealed', c.repealed) order by c.ord, c.ref)
                           from policy_clauses c where c.doc_id = d.id), '[]'::jsonb));
end $$;

create or replace function activities.policy_amendments(p_status text default null) returns jsonb
language plpgsql stable security definer set search_path to 'activities', 'public' as $$
begin
  if not is_exco() then raise exception 'ExCo only'; end if;
  return coalesce((select jsonb_agg(to_jsonb(x) order by x.proposed_at desc) from (
    select a.id, a.number, a.title, a.kind, a.status, a.proposed_by_name, a.proposed_at, a.decided_at, a.publish_by, a.effective_on,
           d.slug as doc_slug, d.title as doc_title, d.tier,
           (select count(*) from policy_amendment_changes c where c.amendment_id = a.id) as changes,
           (select count(*) from policy_votes v where v.amendment_id = a.id and v.vote = 'for') as votes_for,
           (select count(*) from policy_votes v where v.amendment_id = a.id and v.vote = 'against') as votes_against
      from policy_amendments a join policy_docs d on d.id = a.doc_id
     where p_status is null or a.status = p_status) x), '[]'::jsonb);
end $$;

create or replace function activities.policy_amendment(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path to 'activities', 'public' as $$
declare a policy_amendments; d policy_docs;
begin
  if not is_exco() then raise exception 'ExCo only'; end if;
  select * into a from policy_amendments where id = p_id;
  if not found then return null; end if;
  select * into d from policy_docs where id = a.doc_id;
  return jsonb_build_object('amendment', to_jsonb(a), 'doc', jsonb_build_object('slug', d.slug, 'title', d.title, 'tier', d.tier, 'owner', d.owner, 'status', d.status, 'version', d.version),
    'changes', coalesce((select jsonb_agg(to_jsonb(c) order by c.ord, c.ref) from policy_amendment_changes c where c.amendment_id = a.id), '[]'::jsonb),
    'votes', coalesce((select jsonb_agg(jsonb_build_object('voter', v.voter, 'name', v.voter_name, 'vote', v.vote, 'comment', v.comment, 'at', v.voted_at) order by v.voted_at) from policy_votes v where v.amendment_id = a.id), '[]'::jsonb),
    'comments', coalesce((select jsonb_agg(jsonb_build_object('name', c.author_name, 'body', c.body, 'at', c.created_at) order by c.created_at) from policy_comments c where c.amendment_id = a.id), '[]'::jsonb),
    'me', auth.uid(),
    'seats', (select value from policy_settings where key = 'exco_seats'),
    'needed', policy_needed(d.tier));
end $$;

-- How many "for" votes an amendment needs: a majority of the seats for a Bylaw, one officer for a Guide. A Constitution change is decided at a General Meeting and recorded, not voted here.
create or replace function activities.policy_needed(p_tier text) returns integer
language sql stable set search_path to 'activities', 'public' as $$
  select case p_tier
    when 'bylaw' then (select (value #>> '{}')::int / 2 + 1 from policy_settings where key = 'exco_seats')
    when 'guide' then 1
    else null end
$$;

-- ---------- ExCo: editing a draft document directly ----------
create or replace function activities.policy_draft_save(p_clause uuid, p_heading text, p_body text) returns void
language plpgsql security definer set search_path to 'activities', 'public' as $$
declare d policy_docs;
begin
  if not is_exco() then raise exception 'ExCo only'; end if;
  select pd.* into d from policy_docs pd join policy_clauses c on c.doc_id = pd.id where c.id = p_clause;
  if not found then raise exception 'Clause not found'; end if;
  if d.status <> 'draft' then raise exception 'This document is in force: propose an amendment instead'; end if;
  update policy_clauses set heading = trim(p_heading), body_md = p_body, updated_at = now() where id = p_clause;
end $$;

create or replace function activities.policy_draft_add(p_doc uuid, p_ref text, p_heading text, p_body text) returns uuid
language plpgsql security definer set search_path to 'activities', 'public' as $$
declare d policy_docs; nid uuid;
begin
  if not is_exco() then raise exception 'ExCo only'; end if;
  select * into d from policy_docs where id = p_doc;
  if not found then raise exception 'Document not found'; end if;
  if d.status <> 'draft' then raise exception 'This document is in force: propose an amendment instead'; end if;
  insert into policy_clauses (doc_id, ref, ord, heading, body_md)
  values (p_doc, upper(trim(p_ref)), coalesce((select max(ord) + 10 from policy_clauses where doc_id = p_doc), 10), trim(p_heading), p_body) returning id into nid;
  return nid;
end $$;

create or replace function activities.policy_set_published(p_slug text, p_on boolean) returns void
language plpgsql security definer set search_path to 'activities', 'public' as $$
begin
  if not is_exco() then raise exception 'ExCo only'; end if;
  update policy_docs set published = p_on, updated_at = now() where slug = p_slug;
end $$;

-- ---------- ExCo: proposing and deciding ----------
-- p_changes: [{"ref":"B-9.4","action":"edit","heading":"...","body_md":"..."}, {"ref":"B-9.7","action":"add",...}, {"ref":"B-9.2","action":"repeal"}]. Empty for kind 'adopt'.
create or replace function activities.policy_propose(p_doc uuid, p_kind text, p_title text, p_reason text, p_changes jsonb, p_name text default null) returns uuid
language plpgsql security definer set search_path to 'activities', 'public' as $$
declare d policy_docs; aid uuid; ch jsonb; c policy_clauses; n int := 0;
begin
  if not is_exco() then raise exception 'ExCo only'; end if;
  select * into d from policy_docs where id = p_doc;
  if not found then raise exception 'Document not found'; end if;
  if d.tier = 'external' then raise exception 'NTU and School rules are not amended here'; end if;
  if p_kind = 'adopt' and d.status <> 'draft' then raise exception 'This document is already in force'; end if;
  if p_kind = 'change' and d.status <> 'in_force' then raise exception 'A draft is edited directly; propose its adoption instead'; end if;
  if p_kind = 'change' and coalesce(jsonb_array_length(p_changes), 0) = 0 then raise exception 'Name at least one clause to change'; end if;
  if length(trim(coalesce(p_reason, ''))) < 5 then raise exception 'Say why the change is needed'; end if;
  insert into policy_amendments (doc_id, kind, title, reason, proposed_by, proposed_by_name)
  values (p_doc, p_kind, trim(p_title), trim(p_reason), auth.uid(), coalesce(nullif(trim(p_name), ''), auth.jwt() ->> 'email')) returning id into aid;
  for ch in select * from jsonb_array_elements(coalesce(p_changes, '[]'::jsonb)) loop
    n := n + 10;
    select * into c from policy_clauses where doc_id = p_doc and ref = ch ->> 'ref';
    if (ch ->> 'action') = 'add' then
      if found then raise exception 'Clause % already exists', ch ->> 'ref'; end if;
      insert into policy_amendment_changes (amendment_id, ref, action, new_heading, new_body_md, ord)
      values (aid, upper(ch ->> 'ref'), 'add', ch ->> 'heading', ch ->> 'body_md', n);
    else
      if not found then raise exception 'Clause % not found', ch ->> 'ref'; end if;
      insert into policy_amendment_changes (amendment_id, clause_id, ref, action, old_heading, old_body_md, new_heading, new_body_md, ord)
      values (aid, c.id, c.ref, ch ->> 'action', c.heading, c.body_md, case when (ch ->> 'action') = 'edit' then ch ->> 'heading' end, case when (ch ->> 'action') = 'edit' then ch ->> 'body_md' end, n);
    end if;
  end loop;
  return aid;
end $$;

create or replace function activities.policy_vote(p_id uuid, p_vote text, p_comment text default null, p_name text default null) returns void
language plpgsql security definer set search_path to 'activities', 'public' as $$
declare a policy_amendments; t text;
begin
  if not is_exco() then raise exception 'ExCo only'; end if;
  select * into a from policy_amendments where id = p_id;
  if not found then raise exception 'Amendment not found'; end if;
  if a.status <> 'proposed' then raise exception 'Voting is closed on this amendment'; end if;
  select tier into t from policy_docs where id = a.doc_id;
  if t = 'constitution' then raise exception 'A Constitution change is decided at a General Meeting: record the result instead'; end if;
  insert into policy_votes (amendment_id, voter, voter_name, vote, comment)
  values (p_id, auth.uid(), coalesce(nullif(trim(p_name), ''), auth.jwt() ->> 'email'), p_vote, nullif(trim(p_comment), ''))
  on conflict (amendment_id, voter) do update set vote = excluded.vote, comment = excluded.comment, voted_at = now();
end $$;

create or replace function activities.policy_comment(p_id uuid, p_body text, p_name text default null) returns void
language plpgsql security definer set search_path to 'activities', 'public' as $$
begin
  if not is_exco() then raise exception 'ExCo only'; end if;
  insert into policy_comments (amendment_id, author, author_name, body) values (p_id, auth.uid(), coalesce(nullif(trim(p_name), ''), auth.jwt() ->> 'email'), p_body);
end $$;

-- Close the vote: approved when enough "for" votes are in, rejected when approval can no longer be reached.
create or replace function activities.policy_close_vote(p_id uuid) returns text
language plpgsql security definer set search_path to 'activities', 'public' as $$
declare a policy_amendments; d policy_docs; need int; seats int; yes int; no int; wait int;
begin
  if not is_exco() then raise exception 'ExCo only'; end if;
  select * into a from policy_amendments where id = p_id;
  if not found or a.status <> 'proposed' then raise exception 'Nothing to decide'; end if;
  select * into d from policy_docs where id = a.doc_id;
  need := policy_needed(d.tier);
  if need is null then raise exception 'A Constitution change is decided at a General Meeting: record the result instead'; end if;
  select (value #>> '{}')::int into seats from policy_settings where key = 'exco_seats';
  select count(*) filter (where vote = 'for'), count(*) filter (where vote = 'against') into yes, no from policy_votes where amendment_id = p_id;
  select seats - count(*) filter (where vote <> 'recused') into wait from policy_votes where amendment_id = p_id;
  if yes >= need then
    update policy_amendments set status = 'approved', decided_at = now(),
           publish_by = current_date + (select (value #>> '{}')::int from policy_settings where key = 'publish_within_days') where id = p_id;
    return 'approved';
  elsif yes + greatest(wait, 0) < need then
    update policy_amendments set status = 'rejected', decided_at = now() where id = p_id;
    return 'rejected';
  end if;
  raise exception 'Not decided yet: % for, % against, % needed', yes, no, need;
end $$;

-- A Constitution change: the General Meeting voted; record the result.
create or replace function activities.policy_record_meeting(p_id uuid, p_date date, p_for integer, p_against integer, p_sao boolean) returns text
language plpgsql security definer set search_path to 'activities', 'public' as $$
declare a policy_amendments; ok boolean;
begin
  if not is_exco() then raise exception 'ExCo only'; end if;
  select * into a from policy_amendments where id = p_id;
  if not found or a.status <> 'proposed' then raise exception 'Nothing to decide'; end if;
  ok := p_for * 3 >= (p_for + p_against) * 2 and p_for > 0;     -- two-thirds
  update policy_amendments set meeting_date = p_date, meeting_for = p_for, meeting_against = p_against, sao_confirmed = p_sao,
         status = case when ok and coalesce(p_sao, false) then 'approved' else 'rejected' end, decided_at = now() where id = p_id;
  return case when ok and coalesce(p_sao, false) then 'approved' else 'rejected' end;
end $$;

create or replace function activities.policy_withdraw(p_id uuid) returns void
language plpgsql security definer set search_path to 'activities', 'public' as $$
begin
  if not is_exco() then raise exception 'ExCo only'; end if;
  update policy_amendments set status = 'withdrawn', decided_at = now() where id = p_id and status = 'proposed';
end $$;

-- Bring an approved amendment into force: write the new clause text, freeze a new version of the document, and enter it in the changelog.
create or replace function activities.policy_publish(p_id uuid, p_effective date default current_date) returns integer
language plpgsql security definer set search_path to 'activities', 'public' as $$
declare a policy_amendments; d policy_docs; ch policy_amendment_changes; v int; cid uuid; mx int;
begin
  if not is_exco() then raise exception 'ExCo only'; end if;
  select * into a from policy_amendments where id = p_id for update;
  if not found or a.status <> 'approved' then raise exception 'Only an approved amendment can be published'; end if;
  select * into d from policy_docs where id = a.doc_id for update;
  v := d.version + 1;
  for ch in select * from policy_amendment_changes where amendment_id = p_id order by ord loop
    if ch.action = 'add' then
      select coalesce(max(ord), 0) + 10 into mx from policy_clauses where doc_id = d.id;
      insert into policy_clauses (doc_id, ref, ord, heading, body_md) values (d.id, ch.ref, mx, ch.new_heading, ch.new_body_md);
    elsif ch.action = 'edit' then
      update policy_clauses set heading = ch.new_heading, body_md = ch.new_body_md, updated_at = now() where id = ch.clause_id;
    else
      update policy_clauses set repealed = true, updated_at = now() where id = ch.clause_id;
    end if;
  end loop;
  -- freeze every clause of the document at this version
  insert into policy_clause_versions (clause_id, doc_version, heading, body_md, repealed, amendment_id)
  select c.id, v, c.heading, c.body_md, c.repealed, p_id from policy_clauses c where c.doc_id = d.id;
  update policy_docs set status = 'in_force', version = v, effective_on = p_effective, updated_at = now() where id = d.id;
  update policy_amendments set status = 'in_force', published_at = now(), effective_on = p_effective, version_after = v where id = p_id;
  return v;
end $$;

grant execute on function activities.policy_all(), activities.policy_working(text), activities.policy_amendments(text), activities.policy_amendment(uuid),
  activities.policy_draft_save(uuid, text, text), activities.policy_draft_add(uuid, text, text, text), activities.policy_set_published(text, boolean),
  activities.policy_propose(uuid, text, text, text, jsonb, text), activities.policy_vote(uuid, text, text, text), activities.policy_comment(uuid, text, text),
  activities.policy_close_vote(uuid), activities.policy_record_meeting(uuid, date, integer, integer, boolean), activities.policy_withdraw(uuid),
  activities.policy_publish(uuid, date) to authenticated;

-- The ExCo functions check is_exco() themselves, but they should not even be callable by someone who is signed out.
revoke execute on function activities.policy_all(), activities.policy_working(text), activities.policy_amendments(text), activities.policy_amendment(uuid),
  activities.policy_draft_save(uuid, text, text), activities.policy_draft_add(uuid, text, text, text), activities.policy_set_published(text, boolean),
  activities.policy_propose(uuid, text, text, text, jsonb, text), activities.policy_vote(uuid, text, text, text), activities.policy_comment(uuid, text, text),
  activities.policy_close_vote(uuid), activities.policy_record_meeting(uuid, date, integer, integer, boolean), activities.policy_withdraw(uuid),
  activities.policy_publish(uuid, date) from public, anon;
