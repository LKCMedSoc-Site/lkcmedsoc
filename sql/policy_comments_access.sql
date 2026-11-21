-- Comments on policy documents belong to the people working on them: ExCo and the people a document is shared with. Members who only read published versions
-- can no longer read or write comments (before, any signed-in member could on a published document).
create or replace function activities.policy_note_list(p_slug text) returns jsonb
language plpgsql stable security definer set search_path to 'activities', 'public' as $$
declare d policy_docs;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  select * into d from policy_docs where slug = p_slug and (is_exco() or policy_live_access(id) is not null);
  if not found then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id', n.id, 'ref', n.ref, 'quote', n.quote, 'prefix', n.prefix, 'body', n.body, 'parent_id', n.parent_id,
           'author_name', n.author_name, 'created_at', n.created_at, 'resolved', n.resolved, 'resolved_by_name', n.resolved_by_name, 'mine', n.author = auth.uid()) order by n.created_at)
           from policy_notes n where n.doc_id = d.id), '[]'::jsonb);
end $$;

create or replace function activities.policy_note_add(p_slug text, p_ref text, p_quote text, p_prefix text, p_body text, p_parent uuid default null, p_name text default null) returns uuid
language plpgsql security definer set search_path to 'activities', 'public' as $$
declare d policy_docs; nid uuid; par policy_notes;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  select * into d from policy_docs where slug = p_slug and (is_exco() or policy_live_access(id) is not null);
  if not found then raise exception 'Document not found'; end if;
  if p_parent is not null then
    select * into par from policy_notes where id = p_parent and doc_id = d.id;
    if not found or par.parent_id is not null then raise exception 'Reply to the first comment in the thread'; end if;
  end if;
  insert into policy_notes (doc_id, ref, quote, prefix, body, parent_id, author, author_name)
  values (d.id, coalesce(p_ref, ''), left(coalesce(p_quote, ''), 400), right(coalesce(p_prefix, ''), 80), p_body, p_parent, auth.uid(), coalesce(nullif(trim(p_name), ''), auth.jwt() ->> 'email'))
  returning id into nid;
  return nid;
end $$;
