-- Policy: copies of a document's text as it was before recent saves, so any save can be undone. Run on 2026-11-17.
-- policy_text_save keeps the previous text at most once a minute (newest 80 per document); policy_backups lists them; policy_restore_backup puts one back
-- (and keeps the text it replaces). The page shows these under "Earlier saves".
create table if not exists activities.policy_doc_backups (
  id bigserial primary key,
  doc_id uuid not null references activities.policy_docs (id) on delete cascade,
  body_md text not null,
  saved_by text,
  rev integer,
  saved_at timestamptz not null default now()
);
create index if not exists policy_doc_backups_doc on activities.policy_doc_backups (doc_id, saved_at desc);
alter table activities.policy_doc_backups enable row level security;

create or replace function activities.policy_text_save(p_slug text, p_body text, p_base_rev integer, p_name text default null) returns integer
language plpgsql security definer set search_path to 'activities', 'public' as $$
declare d policy_docs;
begin
  if not is_exco() then raise exception 'ExCo only'; end if;
  select * into d from policy_docs where slug = p_slug for update;
  if not found then raise exception 'Document not found'; end if;
  if d.working_rev <> p_base_rev then raise exception 'CONFLICT: % saved a newer copy', coalesce(d.working_by, 'Someone'); end if;
  if d.working_md <> '' and d.working_md <> coalesce(p_body, '')
     and not exists (select 1 from policy_doc_backups b where b.doc_id = d.id and b.saved_at > now() - interval '60 seconds') then
    insert into policy_doc_backups (doc_id, body_md, saved_by, rev) values (d.id, d.working_md, d.working_by, d.working_rev);
    delete from policy_doc_backups where doc_id = d.id and id not in (select id from policy_doc_backups where doc_id = d.id order by saved_at desc limit 80);
  end if;
  update policy_docs set working_md = coalesce(p_body, ''), working_rev = d.working_rev + 1, working_by = coalesce(nullif(trim(p_name), ''), auth.jwt() ->> 'email'), updated_at = now() where id = d.id;
  return d.working_rev + 1;
end $$;

create or replace function activities.policy_backups(p_slug text) returns jsonb
language plpgsql stable security definer set search_path to 'activities', 'public' as $$
begin
  if not is_exco() then raise exception 'ExCo only'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', b.id, 'saved_at', b.saved_at, 'by', b.saved_by, 'chars', length(b.body_md), 'preview', left(regexp_replace(b.body_md, E'[#*|\\\\]+|\n+', ' ', 'g'), 80)) order by b.saved_at desc)
    from policy_doc_backups b join policy_docs d on d.id = b.doc_id where d.slug = p_slug), '[]'::jsonb);
end $$;

create or replace function activities.policy_restore_backup(p_slug text, p_id bigint, p_name text default null) returns integer
language plpgsql security definer set search_path to 'activities', 'public' as $$
declare d policy_docs; b policy_doc_backups;
begin
  if not is_exco() then raise exception 'ExCo only'; end if;
  select * into d from policy_docs where slug = p_slug for update;
  select * into b from policy_doc_backups where id = p_id and doc_id = d.id;
  if not found then raise exception 'That earlier save no longer exists'; end if;
  insert into policy_doc_backups (doc_id, body_md, saved_by, rev) values (d.id, d.working_md, d.working_by, d.working_rev);
  update policy_docs set working_md = b.body_md, working_rev = d.working_rev + 1, working_by = coalesce(nullif(trim(p_name), ''), auth.jwt() ->> 'email'), updated_at = now() where id = d.id;
  return d.working_rev + 1;
end $$;

grant execute on function activities.policy_text_save(text, text, integer, text), activities.policy_backups(text), activities.policy_restore_backup(text, bigint, text) to authenticated;
revoke execute on function activities.policy_backups(text), activities.policy_restore_backup(text, bigint, text) from public, anon;
