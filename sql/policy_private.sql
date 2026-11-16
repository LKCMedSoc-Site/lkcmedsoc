-- Policy is for signed-in members only. Run once in the Supabase SQL editor (after policy.sql).
-- Until now the reading functions could be called by anyone (the public website pages used them). Now they need a sign-in.
-- Documents still only show once ExCo ticks "Visible to members" (the `published` flag); ExCo can still see the unpublished ones.

revoke execute on function
  activities.policy_index(),
  activities.policy_doc(text, integer),
  activities.policy_changelog(text),
  activities.policy_search(text)
  from public, anon;

grant execute on function
  activities.policy_index(),
  activities.policy_doc(text, integer),
  activities.policy_changelog(text),
  activities.policy_search(text)
  to authenticated;

-- Check (should list only `authenticated` and the owner, never `anon`):
-- select p.proname, p.proacl from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--  where n.nspname = 'activities' and p.proname in ('policy_index', 'policy_doc', 'policy_changelog', 'policy_search');
