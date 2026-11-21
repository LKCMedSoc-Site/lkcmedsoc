-- Documents shared with the signed-in account (Share dialog invites). They appear in that person's list when they sign in; no link needed.
create or replace function activities.policy_shared_with_me() returns jsonb
language plpgsql stable security definer set search_path to 'activities', 'public' as $$
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('slug', d.slug, 'title', d.title, 'summary', d.summary, 'status', d.status, 'version', d.version, 'can_edit', e.can_edit) order by d.title)
    from policy_editors e join policy_docs d on d.id = e.doc_id where e.email = lower(auth.jwt() ->> 'email') and d.live), '[]'::jsonb);
end $$;
grant execute on function activities.policy_shared_with_me() to authenticated;
revoke execute on function activities.policy_shared_with_me() from public, anon;
