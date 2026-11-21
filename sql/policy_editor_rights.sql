-- People a document is shared with as Editor can also use its version history, restore an earlier save and rename it, like ExCo. Publishing stays with the President,
-- and inviting people stays with ExCo. policy_live_info gives the live page the title, description and published versions to anyone who has access to the document.
create or replace function activities.policy_can_work(p_doc uuid) returns boolean
language sql stable security definer set search_path to 'activities', 'public' as $$
  select is_exco() or policy_live_access(p_doc) = 'edit'
$$;

create or replace function activities.policy_backups(p_slug text) returns jsonb
language plpgsql stable security definer set search_path to 'activities', 'public' as $$
declare did uuid;
begin
  select id into did from policy_docs where slug = p_slug;
  if did is null or not policy_can_work(did) then raise exception 'You may not do this on this document'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', b.id, 'saved_at', b.saved_at, 'by', b.saved_by, 'chars', length(b.body_md), 'preview', left(regexp_replace(b.body_md, E'[#*|\\\\]+|\n+', ' ', 'g'), 80)) order by b.saved_at desc)
    from policy_doc_backups b where b.doc_id = did), '[]'::jsonb);
end $$;

create or replace function activities.policy_backup_text(p_slug text, p_id bigint) returns text
language plpgsql stable security definer set search_path to 'activities', 'public' as $$
declare did uuid;
begin
  select id into did from policy_docs where slug = p_slug;
  if did is null or not policy_can_work(did) then raise exception 'You may not do this on this document'; end if;
  return (select b.body_md from policy_doc_backups b where b.doc_id = did and b.id = p_id);
end $$;

create or replace function activities.policy_versions(p_slug text) returns jsonb
language plpgsql stable security definer set search_path to 'activities', 'public' as $$
declare did uuid;
begin
  select id into did from policy_docs where slug = p_slug;
  if did is null or not policy_can_work(did) then raise exception 'You may not do this on this document'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('version', v.version, 'published_at', v.published_at, 'effective_on', v.effective_on, 'note', v.note, 'by', v.published_by_name) order by v.version desc)
    from policy_doc_versions v where v.doc_id = did), '[]'::jsonb);
end $$;

create or replace function activities.policy_restore_backup(p_slug text, p_id bigint, p_name text default null) returns integer
language plpgsql security definer set search_path to 'activities', 'public' as $$
declare d policy_docs; b policy_doc_backups;
begin
  select * into d from policy_docs where slug = p_slug for update;
  if not found or not policy_can_work(d.id) then raise exception 'You may not do this on this document'; end if;
  select * into b from policy_doc_backups where id = p_id and doc_id = d.id;
  if not found then raise exception 'That earlier save no longer exists'; end if;
  insert into policy_doc_backups (doc_id, body_md, saved_by, rev) values (d.id, d.working_md, d.working_by, d.working_rev);
  update policy_docs set working_md = b.body_md, working_rev = d.working_rev + 1, working_by = coalesce(nullif(trim(p_name), ''), auth.jwt() ->> 'email'),
    live_epoch = case when d.live then d.live_epoch + 1 else d.live_epoch end, updated_at = now() where id = d.id;
  if d.live then delete from policy_live_updates where doc_id = d.id; delete from policy_live_state where doc_id = d.id; end if;
  return d.working_rev + 1;
end $$;

create or replace function activities.policy_doc_save(p_slug text, p_title text, p_summary text) returns void
language plpgsql security definer set search_path to 'activities', 'public' as $$
declare did uuid;
begin
  select id into did from policy_docs where slug = p_slug;
  if did is null or not policy_can_work(did) then raise exception 'You may not do this on this document'; end if;
  update policy_docs set title = trim(p_title), summary = coalesce(trim(p_summary), ''), updated_at = now() where id = did;
end $$;

create or replace function activities.policy_live_info(p_slug text) returns jsonb
language plpgsql stable security definer set search_path to 'activities', 'public' as $$
declare d policy_docs; pub text;
begin
  select * into d from policy_docs where slug = p_slug and live;
  if not found then return null; end if;
  if policy_live_access(d.id) is null then raise exception 'You have not been invited to this document'; end if;
  select body_md into pub from policy_doc_versions where doc_id = d.id and version = d.version;
  return jsonb_build_object('doc', jsonb_build_object('slug', d.slug, 'title', d.title, 'summary', d.summary, 'status', d.status, 'version', d.version, 'effective_on', d.effective_on),
    'published_md', coalesce(pub, ''),
    'versions', coalesce((select jsonb_agg(jsonb_build_object('version', x.version, 'effective_on', x.effective_on, 'note', x.note, 'by', x.published_by_name, 'published_at', x.published_at) order by x.version desc)
                          from policy_doc_versions x where x.doc_id = d.id), '[]'::jsonb));
end $$;

grant execute on function activities.policy_can_work(uuid), activities.policy_live_info(text) to authenticated;
revoke execute on function activities.policy_can_work(uuid), activities.policy_live_info(text) from public, anon;
