-- Policy: trust-based publishing. No vote. Any ExCo member can edit and suggest; the President confirms and publishes.
-- Who may confirm: the President of the latest year in the Records data. If Records has none, any ExCo member (so a data gap cannot lock everyone out).
-- This includes the Constitution: it works like any other document. Safe to run more than once.
create or replace function activities.policy_is_confirmer() returns boolean
language plpgsql stable security definer set search_path to 'activities', 'public' as $$
declare pres text[];
begin
  if not is_exco() then return false; end if;
  -- the President of the latest year on record, read from the Records data
  select coalesce(array_agg(lower(s.email)), '{}') into pres
  from records.participation p
  join records.bodies b on b.id = p.body_id
  join records.students s on s.matric = p.matric
  where lower(b.level) = 'exco' and coalesce(p.final_title, p.custom_text, p.role_tier) = 'President'
    and p.ay = (select max(p2.ay) from records.participation p2 join records.bodies b2 on b2.id = p2.body_id where lower(b2.level) = 'exco')
    and coalesce(s.email, '') <> '';
  if cardinality(pres) = 0 then return true; end if;   -- no President on record: any ExCo member
  return lower(records.me_email()) = any(pres);
end $$;
grant execute on function activities.policy_is_confirmer() to authenticated;
revoke execute on function activities.policy_is_confirmer() from public, anon;

create or replace function activities.policy_publish(p_id uuid, p_effective date default current_date) returns integer
language plpgsql security definer set search_path to 'activities', 'public' as $$
declare a policy_amendments; d policy_docs; ch policy_amendment_changes; v int; mx int;
begin
  if not is_exco() then raise exception 'ExCo only'; end if;
  if not policy_is_confirmer() then raise exception 'Only the President can confirm a change'; end if;
  select * into a from policy_amendments where id = p_id for update;
  if not found then raise exception 'That proposal does not exist'; end if;
  select * into d from policy_docs where id = a.doc_id for update;
  if a.status not in ('proposed', 'approved') then raise exception 'Only an open proposal can be published'; end if;
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
  insert into policy_clause_versions (clause_id, doc_version, heading, body_md, repealed, amendment_id)
  select c.id, v, c.heading, c.body_md, c.repealed, p_id from policy_clauses c where c.doc_id = d.id;
  -- publishing also shows the document to members: a draft is for ExCo only
  update policy_docs set status = 'in_force', version = v, effective_on = p_effective, published = true, updated_at = now() where id = d.id;
  update policy_amendments set status = 'in_force', decided_at = coalesce(decided_at, now()), published_at = now(), effective_on = p_effective, version_after = v where id = p_id;
  return v;
end $$;

-- Rename a document and change its description. Allowed at any time, draft or in force (neither is a binding provision).
create or replace function activities.policy_doc_save(p_slug text, p_title text, p_summary text) returns void
language plpgsql security definer set search_path to 'activities', 'public' as $$
begin
  if not is_exco() then raise exception 'ExCo only'; end if;
  update policy_docs set title = trim(p_title), summary = coalesce(trim(p_summary), ''), updated_at = now() where slug = p_slug;
end $$;
grant execute on function activities.policy_doc_save(text, text, text) to authenticated;
revoke execute on function activities.policy_doc_save(text, text, text) from public, anon;

-- Members see exactly the documents in force; drafts are ExCo only. The separate "shown to members" switch is gone.
update activities.policy_docs set published = (status = 'in_force');
drop function if exists activities.policy_set_published(text, boolean);
