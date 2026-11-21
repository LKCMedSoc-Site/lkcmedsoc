-- Policy: live (Google-Docs-style) editing of the working copy. NOT YET APPLIED: review first.
-- Model: each document has the LIVE version (policy_doc_versions, only the President publishes) and ONE shared WORKING version edited by ExCo and invited people at once.
-- The working version is a Yjs document: policy_live_state holds a snapshot, policy_live_updates the small changes since. Browsers also pass changes to each other
-- straight away over a private Supabase Realtime channel named 'policy-live:<slug>'. Comments stay in policy_notes (shared by the working and the published view).
-- Documents only go live-edited when policy_docs.live is true (off by default), so the other writers of working_md (the chat session, the connector) are not overwritten
-- by accident; while live is true, working_md is a markdown copy refreshed by the editor so that publish, search, backups and reading keep working.

alter table activities.policy_docs add column if not exists live boolean not null default false;

create table if not exists activities.policy_editors (
  doc_id uuid not null references activities.policy_docs (id) on delete cascade,
  email text not null,                                   -- lower case
  can_edit boolean not null default true,                -- false: may read the working copy and comment only
  added_by text,
  added_at timestamptz not null default now(),
  primary key (doc_id, email)
);
alter table activities.policy_editors enable row level security;

create table if not exists activities.policy_live_state (
  doc_id uuid primary key references activities.policy_docs (id) on delete cascade,
  state text not null,                                   -- base64 Yjs snapshot
  updated_at timestamptz not null default now()
);
alter table activities.policy_live_state enable row level security;

create table if not exists activities.policy_live_updates (
  id bigserial primary key,
  doc_id uuid not null references activities.policy_docs (id) on delete cascade,
  upd text not null,                                     -- base64 Yjs update
  by_name text,
  at timestamptz not null default now()
);
create index if not exists policy_live_updates_doc on activities.policy_live_updates (doc_id, id);
alter table activities.policy_live_updates enable row level security;

-- who may read / edit the working copy of a document: ExCo, or an invited email
create or replace function activities.policy_live_access(p_doc uuid) returns text
language sql stable security definer set search_path to 'activities', 'public' as $$
  select case when is_exco() then 'edit'
    else (select case when e.can_edit then 'edit' else 'read' end from policy_editors e where e.doc_id = p_doc and e.email = lower(auth.jwt() ->> 'email')) end
$$;

-- the topic is 'policy-live:<slug>'
create or replace function activities.policy_live_topic_access(p_topic text) returns text
language sql stable security definer set search_path to 'activities', 'public' as $$
  select policy_live_access(d.id) from policy_docs d where p_topic = 'policy-live:' || d.slug and d.live
$$;

-- Open a document for live editing: the snapshot and the updates since. state is null until the first person opens it (then the page seeds it from working_md).
create or replace function activities.policy_live_open(p_slug text) returns jsonb
language plpgsql stable security definer set search_path to 'activities', 'public' as $$
declare d policy_docs; acc text; s policy_live_state;
begin
  select * into d from policy_docs where slug = p_slug;
  if not found or not d.live then return null; end if;
  acc := policy_live_access(d.id);
  if acc is null then raise exception 'You have not been invited to edit this document'; end if;
  select * into s from policy_live_state where doc_id = d.id;
  return jsonb_build_object('doc', jsonb_build_object('id', d.id, 'slug', d.slug, 'title', d.title, 'status', d.status, 'version', d.version),
    'access', acc, 'working_md', d.working_md, 'state', s.state,
    'updates', coalesce((select jsonb_agg(u.upd order by u.id) from policy_live_updates u where u.doc_id = d.id), '[]'::jsonb),
    'last_id', coalesce((select max(u.id) from policy_live_updates u where u.doc_id = d.id), 0));
end $$;

-- The first person to open a document seeds it. If someone else already did, nothing changes and the caller reloads.
create or replace function activities.policy_live_init(p_slug text, p_state text) returns boolean
language plpgsql security definer set search_path to 'activities', 'public' as $$
declare d policy_docs; n int;
begin
  select * into d from policy_docs where slug = p_slug and live for update;
  if not found then raise exception 'Document not found'; end if;
  if policy_live_access(d.id) is distinct from 'edit' then raise exception 'You may not edit this document'; end if;
  insert into policy_live_state (doc_id, state) values (d.id, p_state) on conflict do nothing;
  get diagnostics n = row_count;
  return n > 0;
end $$;

-- Keep a change (and the markdown it produces, for publishing and reading). Called a second or two after typing stops.
create or replace function activities.policy_live_push(p_slug text, p_update text, p_md text default null, p_name text default null) returns bigint
language plpgsql security definer set search_path to 'activities', 'public' as $$
declare d policy_docs; nid bigint; who text;
begin
  select * into d from policy_docs where slug = p_slug and live;
  if not found then raise exception 'Document not found'; end if;
  if policy_live_access(d.id) is distinct from 'edit' then raise exception 'You may not edit this document'; end if;
  who := coalesce(nullif(trim(p_name), ''), auth.jwt() ->> 'email');
  insert into policy_live_updates (doc_id, upd, by_name) values (d.id, p_update, who) returning id into nid;
  if p_md is not null then
    if d.working_md <> '' and d.working_md <> p_md
       and not exists (select 1 from policy_doc_backups b where b.doc_id = d.id and b.saved_at > now() - interval '60 seconds') then
      insert into policy_doc_backups (doc_id, body_md, saved_by, rev) values (d.id, d.working_md, d.working_by, d.working_rev);
      delete from policy_doc_backups where doc_id = d.id and id not in (select id from policy_doc_backups where doc_id = d.id order by saved_at desc limit 80);
    end if;
    update policy_docs set working_md = p_md, working_rev = d.working_rev + 1, working_by = who, updated_at = now() where id = d.id;
  end if;
  return nid;
end $$;

-- Fold the updates up to p_upto into a new snapshot (the page sends the state it computed from exactly those updates).
create or replace function activities.policy_live_compact(p_slug text, p_state text, p_upto bigint) returns void
language plpgsql security definer set search_path to 'activities', 'public' as $$
declare d policy_docs;
begin
  select * into d from policy_docs where slug = p_slug and live;
  if not found then raise exception 'Document not found'; end if;
  if policy_live_access(d.id) is distinct from 'edit' then raise exception 'You may not edit this document'; end if;
  update policy_live_state set state = p_state, updated_at = now() where doc_id = d.id;
  delete from policy_live_updates where doc_id = d.id and id <= p_upto;
end $$;

-- Invites (ExCo only). An invited email is also added to the sign-in list so the person can create an account.
create or replace function activities.policy_editor_list(p_slug text) returns jsonb
language plpgsql stable security definer set search_path to 'activities', 'public' as $$
begin
  if not is_exco() then raise exception 'ExCo only'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('email', e.email, 'can_edit', e.can_edit, 'added_by', e.added_by) order by e.added_at)
    from policy_editors e join policy_docs d on d.id = e.doc_id where d.slug = p_slug), '[]'::jsonb);
end $$;

create or replace function activities.policy_editor_add(p_slug text, p_email text, p_can_edit boolean default true, p_name text default null) returns void
language plpgsql security definer set search_path to 'activities', 'public' as $$
declare d policy_docs; em text := lower(trim(p_email));
begin
  if not is_exco() then raise exception 'ExCo only'; end if;
  if em !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'That is not an email address'; end if;
  select * into d from policy_docs where slug = p_slug;
  if not found then raise exception 'Document not found'; end if;
  insert into policy_editors (doc_id, email, can_edit, added_by) values (d.id, em, coalesce(p_can_edit, true), coalesce(nullif(trim(p_name), ''), auth.jwt() ->> 'email'))
  on conflict (doc_id, email) do update set can_edit = excluded.can_edit;
  if not records.email_allowed(em) then insert into records.signin_allowlist (entry) values (em) on conflict do nothing; end if;
end $$;

create or replace function activities.policy_editor_remove(p_slug text, p_email text) returns void
language plpgsql security definer set search_path to 'activities', 'public' as $$
begin
  if not is_exco() then raise exception 'ExCo only'; end if;
  delete from policy_editors where doc_id = (select id from policy_docs where slug = p_slug) and email = lower(trim(p_email));
end $$;

-- Realtime: only people with access to a document may join its private channel; only editors may send.
drop policy if exists policy_live_read on realtime.messages;
create policy policy_live_read on realtime.messages for select to authenticated
  using (realtime.messages.extension in ('broadcast', 'presence') and activities.policy_live_topic_access((select realtime.topic())) is not null);
drop policy if exists policy_live_write on realtime.messages;
create policy policy_live_write on realtime.messages for insert to authenticated
  with check (realtime.messages.extension in ('broadcast', 'presence') and activities.policy_live_topic_access((select realtime.topic())) = 'edit');

grant execute on function activities.policy_live_access(uuid), activities.policy_live_topic_access(text), activities.policy_live_open(text), activities.policy_live_init(text, text),
  activities.policy_live_push(text, text, text, text), activities.policy_live_compact(text, text, bigint), activities.policy_editor_list(text),
  activities.policy_editor_add(text, text, boolean, text), activities.policy_editor_remove(text, text) to authenticated;
revoke execute on function activities.policy_live_access(uuid), activities.policy_live_topic_access(text), activities.policy_live_open(text), activities.policy_live_init(text, text),
  activities.policy_live_push(text, text, text, text), activities.policy_live_compact(text, text, bigint), activities.policy_editor_list(text),
  activities.policy_editor_add(text, text, boolean, text), activities.policy_editor_remove(text, text) from public, anon;

-- A scratch document for trying it out (not part of the policy; delete it when done): the real documents stay on the old editor until you switch them with
--   update activities.policy_docs set live = true where slug = '...';
insert into activities.policy_docs (slug, title, tier, summary, status, version, published, ord)
values ('live-test', 'Live editing test (scratch)', 'guide', 'Scratch document for trying live editing. Safe to delete.', 'draft', 0, false, 999)
on conflict (slug) do nothing;
update activities.policy_docs set live = true, working_md = case when working_md = '' then E'## Article 1: Test\n\n1. First clause of the test document.\n   1. A sub-item.\n   2. Another sub-item.\n\n1. Second clause.\n' else working_md end where slug = 'live-test';
