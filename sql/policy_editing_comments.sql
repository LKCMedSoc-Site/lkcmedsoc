-- Policy: edit in place, publish changes, comments on passages.
-- Any ExCo member edits the working copy (policy_clauses). The President publishes: that freezes a new version and records what changed.
-- Anyone signed in can comment on a passage of a document they can read. Safe to run more than once.

-- ---------- editing the working copy (draft or in force) ----------
create or replace function activities.policy_clause_save(p_clause uuid, p_heading text, p_body text) returns void
language plpgsql security definer set search_path to 'activities', 'public' as $$
begin
  if not is_exco() then raise exception 'ExCo only'; end if;
  update policy_clauses set heading = trim(coalesce(p_heading, '')), body_md = coalesce(p_body, ''), updated_at = now() where id = p_clause;
  if not found then raise exception 'Clause not found'; end if;
end $$;

create or replace function activities.policy_clause_add(p_doc uuid, p_ref text, p_heading text, p_body text) returns uuid
language plpgsql security definer set search_path to 'activities', 'public' as $$
declare nid uuid;
begin
  if not is_exco() then raise exception 'ExCo only'; end if;
  if not exists (select 1 from policy_docs where id = p_doc) then raise exception 'Document not found'; end if;
  insert into policy_clauses (doc_id, ref, ord, heading, body_md)
  values (p_doc, upper(trim(p_ref)), coalesce((select max(ord) + 10 from policy_clauses where doc_id = p_doc), 10), trim(coalesce(p_heading, '')), coalesce(p_body, '')) returning id into nid;
  return nid;
end $$;

-- Remove a clause. In a draft it is deleted; in a document in force it is marked repealed (its number is never reused) until the next publish.
create or replace function activities.policy_clause_repeal(p_clause uuid) returns void
language plpgsql security definer set search_path to 'activities', 'public' as $$
declare d policy_docs; c policy_clauses;
begin
  if not is_exco() then raise exception 'ExCo only'; end if;
  select * into c from policy_clauses where id = p_clause;
  if not found then raise exception 'Clause not found'; end if;
  select * into d from policy_docs where id = c.doc_id;
  if d.status = 'draft' then delete from policy_clauses where id = p_clause;
  else update policy_clauses set repealed = true, updated_at = now() where id = p_clause; end if;
end $$;

create or replace function activities.policy_clause_restore(p_clause uuid) returns void
language plpgsql security definer set search_path to 'activities', 'public' as $$
begin
  if not is_exco() then raise exception 'ExCo only'; end if;
  update policy_clauses set repealed = false, updated_at = now() where id = p_clause;
end $$;

-- What differs between the working copy and the last published version of a document in force.
create or replace function activities.policy_unpublished(p_slug text) returns jsonb
language plpgsql stable security definer set search_path to 'activities', 'public' as $$
declare d policy_docs;
begin
  if not is_exco() then raise exception 'ExCo only'; end if;
  select * into d from policy_docs where slug = p_slug;
  if not found or d.status <> 'in_force' then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('ref', c.ref, 'action', case when cv.clause_id is null then 'add' when c.repealed and not cv.repealed then 'repeal' else 'edit' end) order by c.ord)
    from policy_clauses c
    left join lateral (select * from policy_clause_versions x where x.clause_id = c.id and x.doc_version <= d.version order by x.doc_version desc limit 1) cv on true
    where c.doc_id = d.id
      and ((cv.clause_id is null and not c.repealed) or (cv.clause_id is not null and (c.repealed <> cv.repealed or c.heading <> cv.heading or c.body_md <> cv.body_md)))
  ), '[]'::jsonb);
end $$;

-- Publish the working copy of a document in force: freeze it as the next version and record what changed.
create or replace function activities.policy_publish_changes(p_doc uuid, p_note text, p_effective date default current_date, p_name text default null) returns integer
language plpgsql security definer set search_path to 'activities', 'public' as $$
declare d policy_docs; aid uuid; v int; n int := 0; c policy_clauses; cv record; act text;
begin
  if not is_exco() then raise exception 'ExCo only'; end if;
  if not policy_is_confirmer() then raise exception 'Only the President can publish changes'; end if;
  select * into d from policy_docs where id = p_doc for update;
  if not found or d.status <> 'in_force' then raise exception 'Only a document in force has changes to publish'; end if;
  v := d.version + 1;
  insert into policy_amendments (doc_id, kind, title, reason, status, proposed_by, proposed_by_name, decided_at, published_at, effective_on, version_after)
  values (p_doc, 'change', coalesce(nullif(left(trim(coalesce(p_note, '')), 140), ''), 'Changes to the wording'), coalesce(nullif(trim(coalesce(p_note, '')), ''), 'Changes to the wording'), 'in_force',
          auth.uid(), coalesce(nullif(trim(p_name), ''), auth.jwt() ->> 'email'), now(), now(), p_effective, v) returning id into aid;
  for c in select * from policy_clauses where doc_id = p_doc order by ord loop
    select * into cv from policy_clause_versions x where x.clause_id = c.id and x.doc_version <= d.version order by x.doc_version desc limit 1;
    act := null;
    if not found then if not c.repealed then act := 'add'; end if;
    elsif c.repealed and not cv.repealed then act := 'repeal';
    elsif c.heading <> cv.heading or c.body_md <> cv.body_md then act := 'edit'; end if;
    if act is not null then
      n := n + 10;
      insert into policy_amendment_changes (amendment_id, clause_id, ref, action, old_heading, old_body_md, new_heading, new_body_md, ord)
      values (aid, case when act = 'add' then null else c.id end, c.ref, act,
              case when act <> 'add' then cv.heading end, case when act <> 'add' then cv.body_md end,
              case when act <> 'repeal' then c.heading end, case when act <> 'repeal' then c.body_md end, n);
    end if;
  end loop;
  if n = 0 then raise exception 'Nothing has changed since the last published version'; end if;
  insert into policy_clause_versions (clause_id, doc_version, heading, body_md, repealed, amendment_id)
  select c.id, v, c.heading, c.body_md, c.repealed, aid from policy_clauses c where c.doc_id = p_doc;
  update policy_docs set version = v, effective_on = p_effective, updated_at = now() where id = p_doc;
  return v;
end $$;

-- ---------- comments on passages ----------
create table if not exists activities.policy_notes (
  id uuid primary key default gen_random_uuid(),
  doc_id uuid not null references activities.policy_docs (id) on delete cascade,
  ref text not null,                                   -- the clause the passage is in
  quote text not null default '' check (length(quote) <= 400),   -- the highlighted words ('' = the whole clause)
  prefix text not null default '' check (length(prefix) <= 80),  -- a few words before it, to find the right place if the quote repeats
  body text not null check (length(trim(body)) between 1 and 2000),
  parent_id uuid references activities.policy_notes (id) on delete cascade,   -- a reply
  author uuid not null,
  author_name text not null,
  created_at timestamptz not null default now(),
  resolved boolean not null default false,
  resolved_by_name text,
  resolved_at timestamptz
);
create index if not exists policy_notes_doc on activities.policy_notes (doc_id, created_at);
alter table activities.policy_notes enable row level security;

create or replace function activities.policy_note_list(p_slug text) returns jsonb
language plpgsql stable security definer set search_path to 'activities', 'public' as $$
declare d policy_docs;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  select * into d from policy_docs where slug = p_slug and (published or is_exco());
  if not found then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', n.id, 'ref', n.ref, 'quote', n.quote, 'prefix', n.prefix, 'body', n.body, 'parent_id', n.parent_id,
           'author_name', n.author_name, 'created_at', n.created_at, 'resolved', n.resolved, 'resolved_by_name', n.resolved_by_name, 'mine', n.author = auth.uid()) order by n.created_at)
           from policy_notes n where n.doc_id = d.id), '[]'::jsonb);
end $$;

create or replace function activities.policy_note_add(p_slug text, p_ref text, p_quote text, p_prefix text, p_body text, p_parent uuid default null, p_name text default null) returns uuid
language plpgsql security definer set search_path to 'activities', 'public' as $$
declare d policy_docs; nid uuid; par policy_notes;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  select * into d from policy_docs where slug = p_slug and (published or is_exco());
  if not found then raise exception 'Document not found'; end if;
  if not exists (select 1 from policy_clauses where doc_id = d.id and ref = upper(p_ref)) then raise exception 'That part of the document does not exist'; end if;
  if p_parent is not null then
    select * into par from policy_notes where id = p_parent and doc_id = d.id;
    if not found or par.parent_id is not null then raise exception 'Reply to the first comment in the thread'; end if;
  end if;
  insert into policy_notes (doc_id, ref, quote, prefix, body, parent_id, author, author_name)
  values (d.id, upper(p_ref), left(coalesce(p_quote, ''), 400), right(coalesce(p_prefix, ''), 80), p_body, p_parent, auth.uid(), coalesce(nullif(trim(p_name), ''), auth.jwt() ->> 'email'))
  returning id into nid;
  return nid;
end $$;

create or replace function activities.policy_note_resolve(p_id uuid, p_resolved boolean, p_name text default null) returns void
language plpgsql security definer set search_path to 'activities', 'public' as $$
declare n policy_notes;
begin
  select * into n from policy_notes where id = p_id;
  if not found then raise exception 'Comment not found'; end if;
  if n.parent_id is not null then raise exception 'Resolve the first comment in the thread'; end if;
  if n.author <> auth.uid() and not is_exco() then raise exception 'Only the person who wrote it, or ExCo, can resolve this'; end if;
  update policy_notes set resolved = p_resolved, resolved_by_name = case when p_resolved then coalesce(nullif(trim(p_name), ''), auth.jwt() ->> 'email') end, resolved_at = case when p_resolved then now() end where id = p_id;
end $$;

create or replace function activities.policy_note_delete(p_id uuid) returns void
language plpgsql security definer set search_path to 'activities', 'public' as $$
declare n policy_notes;
begin
  select * into n from policy_notes where id = p_id;
  if not found then return; end if;
  if n.author <> auth.uid() and not is_exco() then raise exception 'Only the person who wrote it, or ExCo, can delete this'; end if;
  delete from policy_notes where id = p_id;
end $$;

grant execute on function activities.policy_clause_save(uuid, text, text), activities.policy_clause_add(uuid, text, text, text), activities.policy_clause_repeal(uuid),
  activities.policy_clause_restore(uuid), activities.policy_unpublished(text), activities.policy_publish_changes(uuid, text, date, text),
  activities.policy_note_list(text), activities.policy_note_add(text, text, text, text, text, uuid, text), activities.policy_note_resolve(uuid, boolean, text), activities.policy_note_delete(uuid) to authenticated;
revoke execute on function activities.policy_clause_save(uuid, text, text), activities.policy_clause_add(uuid, text, text, text), activities.policy_clause_repeal(uuid),
  activities.policy_clause_restore(uuid), activities.policy_unpublished(text), activities.policy_publish_changes(uuid, text, date, text),
  activities.policy_note_list(text), activities.policy_note_add(text, text, text, text, text, uuid, text), activities.policy_note_resolve(uuid, boolean, text), activities.policy_note_delete(uuid) from public, anon;
