-- Version history grouped by published version: every published version of a document with the exact time it was published (ExCo only).
create or replace function activities.policy_versions(p_slug text) returns jsonb
language plpgsql stable security definer set search_path to 'activities', 'public' as $$
begin
  if not is_exco() then raise exception 'ExCo only'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('version', v.version, 'published_at', v.published_at, 'effective_on', v.effective_on, 'note', v.note, 'by', v.published_by_name) order by v.version desc)
    from policy_doc_versions v join policy_docs d on d.id = v.doc_id where d.slug = p_slug), '[]'::jsonb);
end $$;
grant execute on function activities.policy_versions(text) to authenticated;
revoke execute on function activities.policy_versions(text) from public, anon;
