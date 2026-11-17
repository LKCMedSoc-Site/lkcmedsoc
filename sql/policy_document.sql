-- Policy: each document is one piece of text, edited like a Google Doc.
-- policy_docs.working_md is what ExCo edit; policy_doc_versions holds the text of every published version.
-- The old clause tables are left in place, unused. Safe to run more than once.

alter table activities.policy_docs add column if not exists working_md text not null default '';
alter table activities.policy_docs add column if not exists working_rev integer not null default 0;       -- goes up on every save; stops two people overwriting each other
alter table activities.policy_docs add column if not exists working_by text;                                -- who saved last
alter table activities.policy_docs add column if not exists numbering text not null default 'plain' check (numbering in ('plain', 'legal'));   -- legal: Article 1, clauses 1.1 and (a) sub-items

create table if not exists activities.policy_doc_versions (
  doc_id uuid not null references activities.policy_docs (id) on delete cascade,
  version integer not null,
  body_md text not null,
  note text not null default '',
  effective_on date,
  published_by_name text,
  published_at timestamptz not null default now(),
  primary key (doc_id, version)
);
alter table activities.policy_doc_versions enable row level security;

-- ---------- one-off conversion of the clause tables into one text per document ----------
create or replace function activities.policy_clauses_to_md(p_doc uuid, p_version integer) returns text
language sql stable as $$
  select coalesce(string_agg(
    case
      when c.ref ~ '\.0$' then '## ' || cv.heading || E'\n\n'
      when d.numbering = 'legal' then '1. ' || replace(cv.body_md, E'\n', E'\n   ') || E'\n\n'
      else '### ' || c.ref || case when cv.heading <> '' then '  ' || cv.heading else '' end || E'\n\n' || cv.body_md || E'\n\n'
    end, '' order by c.ord, c.ref), '')
  from activities.policy_docs d
  join activities.policy_clauses c on c.doc_id = d.id
  join lateral (
    select heading, body_md, repealed from activities.policy_clause_versions x where x.clause_id = c.id and x.doc_version <= p_version order by x.doc_version desc limit 1
  ) cv on p_version > 0 and not cv.repealed
  where d.id = p_doc
$$;

update activities.policy_docs set numbering = 'legal' where tier = 'constitution';

update activities.policy_docs d set working_md = (
  select coalesce(string_agg(
    case
      when c.ref ~ '\.0$' then '## ' || c.heading || E'\n\n'
      when d.numbering = 'legal' then '1. ' || replace(c.body_md, E'\n', E'\n   ') || E'\n\n'
      else '### ' || c.ref || case when c.heading <> '' then '  ' || c.heading else '' end || E'\n\n' || c.body_md || E'\n\n'
    end, '' order by c.ord, c.ref), '')
  from activities.policy_clauses c where c.doc_id = d.id and not c.repealed)
where d.working_md = '' and exists (select 1 from activities.policy_clauses c where c.doc_id = d.id);

insert into activities.policy_doc_versions (doc_id, version, body_md, note, effective_on, published_by_name, published_at)
select d.id, a.version_after, activities.policy_clauses_to_md(d.id, a.version_after), a.title, a.effective_on, a.proposed_by_name, coalesce(a.published_at, now())
from activities.policy_amendments a join activities.policy_docs d on d.id = a.doc_id
where a.status = 'in_force' and a.version_after is not null
on conflict (doc_id, version) do nothing;

-- ---------- reading ----------
-- Members: the published text of a version of a document they may read.
create or replace function activities.policy_text(p_slug text, p_version integer default null) returns jsonb
language plpgsql stable security definer set search_path to 'activities', 'public' as $$
declare d policy_docs; v integer; txt text;
begin
  select * into d from policy_docs where slug = p_slug and (published or is_exco());
  if not found then return null; end if;
  v := coalesce(p_version, d.version);
  if v > d.version or v < 1 then return null; end if;
  select body_md into txt from policy_doc_versions where doc_id = d.id and version = v;
  return jsonb_build_object(
    'doc', jsonb_build_object('slug', d.slug, 'title', d.title, 'tier', d.tier, 'summary', d.summary, 'status', d.status, 'version', d.version, 'shown_version', v,
                              'effective_on', d.effective_on, 'numbering', d.numbering),
    'body_md', coalesce(txt, ''),
    'versions', coalesce((select jsonb_agg(jsonb_build_object('version', x.version, 'effective_on', x.effective_on, 'note', x.note, 'by', x.published_by_name) order by x.version desc)
                           from policy_doc_versions x where x.doc_id = d.id), '[]'::jsonb));
end $$;

-- ExCo: the working copy, plus the last published text so the page can tell whether anything is unpublished.
create or replace function activities.policy_work(p_slug text) returns jsonb
language plpgsql stable security definer set search_path to 'activities', 'public' as $$
declare d policy_docs; pub text;
begin
  if not is_exco() then raise exception 'ExCo only'; end if;
  select * into d from policy_docs where slug = p_slug;
  if not found then return null; end if;
  select body_md into pub from policy_doc_versions where doc_id = d.id and version = d.version;
  return jsonb_build_object(
    'doc', jsonb_build_object('id', d.id, 'slug', d.slug, 'title', d.title, 'tier', d.tier, 'summary', d.summary, 'status', d.status, 'version', d.version,
                              'effective_on', d.effective_on, 'numbering', d.numbering),
    'working_md', d.working_md, 'published_md', coalesce(pub, ''), 'rev', d.working_rev, 'by', d.working_by,
    'versions', coalesce((select jsonb_agg(jsonb_build_object('version', x.version, 'effective_on', x.effective_on, 'note', x.note, 'by', x.published_by_name) order by x.version desc)
                           from policy_doc_versions x where x.doc_id = d.id), '[]'::jsonb));
end $$;

create or replace function activities.policy_rev(p_slug text) returns jsonb
language plpgsql stable security definer set search_path to 'activities', 'public' as $$
declare d policy_docs;
begin
  if not is_exco() then raise exception 'ExCo only'; end if;
  select * into d from policy_docs where slug = p_slug;
  return jsonb_build_object('rev', d.working_rev, 'by', d.working_by);
end $$;

-- ---------- writing ----------
create or replace function activities.policy_text_save(p_slug text, p_body text, p_base_rev integer, p_name text default null) returns integer
language plpgsql security definer set search_path to 'activities', 'public' as $$
declare d policy_docs;
begin
  if not is_exco() then raise exception 'ExCo only'; end if;
  select * into d from policy_docs where slug = p_slug for update;
  if not found then raise exception 'Document not found'; end if;
  if d.working_rev <> p_base_rev then raise exception 'CONFLICT: % saved a newer copy', coalesce(d.working_by, 'Someone'); end if;
  update policy_docs set working_md = coalesce(p_body, ''), working_rev = d.working_rev + 1, working_by = coalesce(nullif(trim(p_name), ''), auth.jwt() ->> 'email'), updated_at = now() where id = d.id;
  return d.working_rev + 1;
end $$;

-- Publish the working copy: a draft comes into force as version 1; a document in force gets its next version.
create or replace function activities.policy_text_publish(p_slug text, p_note text, p_effective date default current_date, p_name text default null) returns integer
language plpgsql security definer set search_path to 'activities', 'public' as $$
declare d policy_docs; v int; last_txt text;
begin
  if not is_exco() then raise exception 'ExCo only'; end if;
  if not policy_is_confirmer() then raise exception 'Only the President can publish'; end if;
  select * into d from policy_docs where slug = p_slug for update;
  if not found then raise exception 'Document not found'; end if;
  if length(trim(d.working_md)) = 0 then raise exception 'The document is empty'; end if;
  v := d.version + 1;
  if d.status = 'in_force' then
    select body_md into last_txt from policy_doc_versions where doc_id = d.id and version = d.version;
    if last_txt is not distinct from d.working_md then raise exception 'Nothing has changed since the last published version'; end if;
  end if;
  insert into policy_doc_versions (doc_id, version, body_md, note, effective_on, published_by_name)
  values (d.id, v, d.working_md, coalesce(nullif(left(trim(coalesce(p_note, '')), 140), ''), case when v = 1 then 'First publication' else 'Changes to the wording' end), p_effective,
          coalesce(nullif(trim(p_name), ''), auth.jwt() ->> 'email'));
  update policy_docs set status = 'in_force', version = v, effective_on = p_effective, published = true, updated_at = now() where id = d.id;
  return v;
end $$;

-- ---------- search ----------
create or replace function activities.policy_search(p_q text) returns jsonb
language plpgsql stable security definer set search_path to 'activities', 'public' as $$
declare q text := trim(coalesce(p_q, ''));
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if length(q) < 2 then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(x order by x.doc_title) from (
    select d.slug as doc_slug, d.title as doc_title, '' as ref, '' as heading, d.tier,
           substr(t.txt, greatest(position(lower(q) in lower(t.txt)) - 60, 1), 200) as snippet, q as find
    from policy_docs d
    join lateral (select case when is_exco() then d.working_md else coalesce((select body_md from policy_doc_versions v where v.doc_id = d.id and v.version = d.version), '') end as txt) t on true
    where (d.published or is_exco()) and (position(lower(q) in lower(t.txt)) > 0 or lower(d.title) like '%' || lower(q) || '%')
  ) x), '[]'::jsonb);
end $$;

-- ---------- comments no longer belong to a clause ----------
create or replace function activities.policy_note_add(p_slug text, p_ref text, p_quote text, p_prefix text, p_body text, p_parent uuid default null, p_name text default null) returns uuid
language plpgsql security definer set search_path to 'activities', 'public' as $$
declare d policy_docs; nid uuid; par policy_notes;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  select * into d from policy_docs where slug = p_slug and (published or is_exco());
  if not found then raise exception 'Document not found'; end if;
  if p_parent is not null then
    select * into par from policy_notes where id = p_parent and doc_id = d.id;
    if not found or par.parent_id is not null then raise exception 'Reply to the first comment in the thread'; end if;
  end if;
  insert into policy_notes (doc_id, ref, quote, prefix, body, parent_id, author, author_name)
  values (d.id, coalesce(p_ref, ''), left(coalesce(p_quote, ''), 400), right(coalesce(p_prefix, ''), 80), p_body, p_parent, auth.uid(), coalesce(nullif(trim(p_name), ''), auth.jwt() ->> 'email'))
  returning id into nid;
  return nid;
end $$;

grant execute on function activities.policy_text(text, integer), activities.policy_work(text), activities.policy_rev(text), activities.policy_text_save(text, text, integer, text),
  activities.policy_text_publish(text, text, date, text), activities.policy_search(text) to authenticated;
revoke execute on function activities.policy_text(text, integer), activities.policy_work(text), activities.policy_rev(text), activities.policy_text_save(text, text, integer, text),
  activities.policy_text_publish(text, text, date, text), activities.policy_search(text) from public, anon;
