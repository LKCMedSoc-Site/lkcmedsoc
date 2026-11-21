-- Version history preview: the text of one earlier save (ExCo only), so the page can show it before restoring.
create or replace function activities.policy_backup_text(p_slug text, p_id bigint) returns text
language plpgsql stable security definer set search_path to 'activities', 'public' as $$
begin
  if not is_exco() then raise exception 'ExCo only'; end if;
  return (select b.body_md from policy_doc_backups b join policy_docs d on d.id = b.doc_id where d.slug = p_slug and b.id = p_id);
end $$;
grant execute on function activities.policy_backup_text(text, bigint) to authenticated;
revoke execute on function activities.policy_backup_text(text, bigint) from public, anon;
