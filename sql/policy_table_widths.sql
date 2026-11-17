-- Policy: table column widths you can drag. The document text (markdown) has no place for widths, so they are kept beside it:
-- policy_docs.table_widths is an object {"<first-row header text>#<n>": [percent, percent, ...]}. Run on 2026-11-17.
-- policy_text and policy_work now also return table_widths in the doc object (see sql/policy_document.sql for the rest of their bodies).
alter table activities.policy_docs add column if not exists table_widths jsonb not null default '{}'::jsonb;

create or replace function activities.policy_table_widths(p_slug text, p_widths jsonb) returns void
language plpgsql security definer set search_path to 'activities', 'public' as $$
begin
  if not is_exco() then raise exception 'ExCo only'; end if;
  if jsonb_typeof(p_widths) <> 'object' then raise exception 'Widths must be an object'; end if;
  update policy_docs set table_widths = p_widths, updated_at = now() where slug = p_slug;
end $$;
grant execute on function activities.policy_table_widths(text, jsonb) to authenticated;
revoke execute on function activities.policy_table_widths(text, jsonb) from public, anon;

-- Every document is numbered the same way now; the "No numbering" choice was removed from the page.
update activities.policy_docs set numbering = 'legal' where numbering <> 'legal';
