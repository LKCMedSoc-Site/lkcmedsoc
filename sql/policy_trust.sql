-- Policy: trust-based publishing. No vote is needed to publish a proposal:
-- any ExCo member can publish any proposal once ExCo has agreed it among themselves (objections are handled in conversation, not in the app).
-- This includes the Constitution: it works like any other document. Safe to run more than once.
create or replace function activities.policy_publish(p_id uuid, p_effective date default current_date) returns integer
language plpgsql security definer set search_path to 'activities', 'public' as $$
declare a policy_amendments; d policy_docs; ch policy_amendment_changes; v int; mx int;
begin
  if not is_exco() then raise exception 'ExCo only'; end if;
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
  update policy_docs set status = 'in_force', version = v, effective_on = p_effective, updated_at = now() where id = d.id;
  update policy_amendments set status = 'in_force', decided_at = coalesce(decided_at, now()), published_at = now(), effective_on = p_effective, version_after = v where id = p_id;
  return v;
end $$;
