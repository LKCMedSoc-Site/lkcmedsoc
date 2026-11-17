-- Policy: one numbering scheme for every document, the Constitution's: Article 1, clauses 1.1, 1.2, sub-items (a), (b), then (i), (ii).
-- Every document restarts at Article 1. A document can switch numbering off. Safe to read; the conversion below was run once on 2026-11-17.
alter table activities.policy_docs add column if not exists number_prefix text not null default '';   -- unused now, kept so old rows stay valid
alter table activities.policy_docs add column if not exists number_start integer not null default 1;    -- unused now
alter table activities.policy_docs drop constraint if exists policy_docs_numbering_check;
alter table activities.policy_docs add constraint policy_docs_numbering_check check (numbering in ('plain', 'legal', 'sections'));

create or replace function activities.policy_numbering(p_slug text, p_mode text, p_prefix text, p_start integer) returns void
language plpgsql security definer set search_path to 'activities', 'public' as $$
begin
  if not is_exco() then raise exception 'ExCo only'; end if;
  if p_mode not in ('plain', 'legal', 'sections') then raise exception 'Unknown numbering'; end if;
  update policy_docs set numbering = p_mode, number_prefix = left(coalesce(p_prefix, ''), 12), number_start = coalesce(p_start, 1), updated_at = now() where slug = p_slug;
end $$;
grant execute on function activities.policy_numbering(text, text, text, integer) to authenticated;
revoke execute on function activities.policy_numbering(text, text, text, integer) from public, anon;

-- policy_text and policy_work now also return numbering, number_prefix and number_start (see sql/policy_document.sql for the rest of their bodies).

-- The one-off conversion of the five Bylaws: each former "### B-5.2  Title" clause became a numbered clause "1. **Title**" with its text indented under it.
-- Tables sit between clauses (an editor list item cannot hold a table); the clause numbering carries on across them.
create or replace function activities.policy_to_clauses(txt text) returns text
language plpgsql immutable as $$
declare line text; res text := ''; inclause boolean := false; intable boolean := false;
begin
  foreach line in array string_to_array(txt, E'\n') loop
    if line ~ '^### ' then
      res := res || E'\n1. **' || regexp_replace(line, '^### ', '') || E'**\n';
      inclause := true; intable := false;
    elsif line ~ '^#{1,2} ' then
      inclause := false; intable := false; res := res || E'\n' || line || E'\n';
    elsif inclause then
      if line ~ '^\|' then
        if not intable then res := res || E'\n'; end if;
        intable := true; res := res || line || E'\n';
      else
        if intable then res := res || E'\n'; intable := false; end if;
        if line = '' then res := res || E'\n'; else res := res || '   ' || line || E'\n'; end if;
      end if;
    else
      res := res || line || E'\n';
    end if;
  end loop;
  return regexp_replace(trim(both E'\n' from res), E'\n{3,}', E'\n\n', 'g') || E'\n';
end $$;

-- A blank line between two paragraphs inside a numbered clause becomes an empty paragraph in the editor (and a stray <br> in the saved text),
-- so clauses are stored without them. Run once on 2026-11-17 over every document and every published version.
create or replace function activities.policy_tighten(txt text) returns text
language plpgsql immutable as $$
declare ls text[] := string_to_array(txt, E'\n'); n int := coalesce(array_length(ls, 1), 0); i int; res text[] := '{}'; prev text := '';
begin
  for i in 1..n loop
    if ls[i] = '' and i < n and ls[i + 1] ~ '^ {2,}\S' and prev <> '' and prev !~ '^\|' and prev !~ '^#' and prev !~ '^\s+(\d+\.|[-*+])\s' then
      continue;
    end if;
    res := res || ls[i]; prev := ls[i];
  end loop;
  return array_to_string(res, E'\n');
end $$;
-- update activities.policy_doc_versions set body_md = activities.policy_tighten(regexp_replace(body_md, E'(^|\n)[ \t]+(?=\n|$)', E'\\1', 'g'));
-- update activities.policy_docs set working_md = activities.policy_tighten(regexp_replace(working_md, E'(^|\n)[ \t]+(?=\n|$)', E'\\1', 'g')), working_rev = working_rev + 1 where working_md <> '';

-- Tables belong inside the clause they follow (the editor can hold a table inside a numbered clause). Run once on 2026-11-17 over every document and published version.
create or replace function activities.policy_tables_into_clauses(txt text) returns text
language plpgsql immutable as $$
declare line text; res text[] := '{}'; inclause boolean := false;
begin
  foreach line in array string_to_array(txt, E'\n') loop
    if line ~ '^#' then inclause := false;
    elsif line ~ '^\d+\. ' then inclause := true;
    elsif inclause and line ~ '^\|' then line := '   ' || line;
    end if;
    res := res || line;
  end loop;
  return array_to_string(res, E'\n');
end $$;
-- update activities.policy_doc_versions set body_md = activities.policy_tables_into_clauses(body_md);
-- update activities.policy_docs set working_md = activities.policy_tables_into_clauses(working_md), working_rev = working_rev + 1 where working_md <> '';

-- Anything left at the page edge after a clause starts belongs to that clause (two paragraphs after tables in Spaces and records were not indented),
-- so folding a clause hides all of it. Supersedes policy_tables_into_clauses. Run once on 2026-11-17.
create or replace function activities.policy_indent_strays(txt text) returns text
language plpgsql immutable as $$
declare line text; res text[] := '{}'; inclause boolean := false;
begin
  foreach line in array string_to_array(txt, E'\n') loop
    if line ~ '^#' then inclause := false;
    elsif line ~ '^\d+\. ' then inclause := true;
    elsif inclause and line <> '' and line !~ '^ ' then line := '   ' || line;
    end if;
    res := res || line;
  end loop;
  return array_to_string(res, E'\n');
end $$;
-- update activities.policy_doc_versions set body_md = activities.policy_indent_strays(body_md);
-- update activities.policy_docs set working_md = activities.policy_indent_strays(working_md), working_rev = working_rev + 1 where working_md <> '';
