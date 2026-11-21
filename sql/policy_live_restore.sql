-- Policy live editing, part 2: restoring an Earlier save on a live document. Each live document has an epoch; a restore starts a new one (the shared state is
-- dropped and re-seeded from the restored text), and pages still holding the old epoch are refused and told to reload.
alter table activities.policy_docs add column if not exists live_epoch integer not null default 1;

drop function if exists activities.policy_live_push(text, text, text, text);
drop function if exists activities.policy_live_compact(text, text, bigint);
drop function if exists activities.policy_live_init(text, text);

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
    'access', acc, 'epoch', d.live_epoch, 'working_md', d.working_md, 'state', s.state,
    'updates', coalesce((select jsonb_agg(u.upd order by u.id) from policy_live_updates u where u.doc_id = d.id), '[]'::jsonb),
    'last_id', coalesce((select max(u.id) from policy_live_updates u where u.doc_id = d.id), 0));
end $$;

create or replace function activities.policy_live_init(p_slug text, p_state text, p_epoch integer) returns boolean
language plpgsql security definer set search_path to 'activities', 'public' as $$
declare d policy_docs; n int;
begin
  select * into d from policy_docs where slug = p_slug and live for update;
  if not found then raise exception 'Document not found'; end if;
  if policy_live_access(d.id) is distinct from 'edit' then raise exception 'You may not edit this document'; end if;
  if d.live_epoch <> p_epoch then raise exception 'EPOCH: this document was restored; reload the page'; end if;
  insert into policy_live_state (doc_id, state) values (d.id, p_state) on conflict do nothing;
  get diagnostics n = row_count;
  return n > 0;
end $$;

create or replace function activities.policy_live_push(p_slug text, p_update text, p_md text, p_name text, p_epoch integer) returns bigint
language plpgsql security definer set search_path to 'activities', 'public' as $$
declare d policy_docs; nid bigint; who text;
begin
  select * into d from policy_docs where slug = p_slug and live for update;
  if not found then raise exception 'Document not found'; end if;
  if policy_live_access(d.id) is distinct from 'edit' then raise exception 'You may not edit this document'; end if;
  if d.live_epoch <> p_epoch then raise exception 'EPOCH: this document was restored; reload the page'; end if;
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

create or replace function activities.policy_live_compact(p_slug text, p_state text, p_upto bigint, p_epoch integer) returns void
language plpgsql security definer set search_path to 'activities', 'public' as $$
declare d policy_docs;
begin
  select * into d from policy_docs where slug = p_slug and live for update;
  if not found then raise exception 'Document not found'; end if;
  if policy_live_access(d.id) is distinct from 'edit' then raise exception 'You may not edit this document'; end if;
  if d.live_epoch <> p_epoch then raise exception 'EPOCH: this document was restored; reload the page'; end if;
  update policy_live_state set state = p_state, updated_at = now() where doc_id = d.id;
  delete from policy_live_updates where doc_id = d.id and id <= p_upto;
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
  update policy_docs set working_md = b.body_md, working_rev = d.working_rev + 1, working_by = coalesce(nullif(trim(p_name), ''), auth.jwt() ->> 'email'),
    live_epoch = case when d.live then d.live_epoch + 1 else d.live_epoch end, updated_at = now() where id = d.id;
  if d.live then delete from policy_live_updates where doc_id = d.id; delete from policy_live_state where doc_id = d.id; end if;
  return d.working_rev + 1;
end $$;

grant execute on function activities.policy_live_open(text), activities.policy_live_init(text, text, integer), activities.policy_live_push(text, text, text, text, integer),
  activities.policy_live_compact(text, text, bigint, integer), activities.policy_restore_backup(text, bigint, text) to authenticated;
revoke execute on function activities.policy_live_init(text, text, integer), activities.policy_live_push(text, text, text, text, integer), activities.policy_live_compact(text, text, bigint, integer) from public, anon;
