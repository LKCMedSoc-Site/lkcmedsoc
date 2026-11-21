-- The document list shows a Draft pill on a published document whose working copy has changes that are not published yet (ExCo only).
create or replace function activities.policy_docs_with_changes() returns jsonb
language plpgsql stable security definer set search_path to 'activities', 'public' as $$
begin
  if not is_exco() then raise exception 'ExCo only'; end if;
  return coalesce((select jsonb_agg(d.slug order by d.slug) from policy_docs d
    join policy_doc_versions v on v.doc_id = d.id and v.version = d.version
    where d.status = 'in_force' and btrim(d.working_md) is distinct from btrim(v.body_md)), '[]'::jsonb);
end $$;
grant execute on function activities.policy_docs_with_changes() to authenticated;
revoke execute on function activities.policy_docs_with_changes() from public, anon;
