-- Policy: bullets became (a), (b) sub-items. Run once on 2026-11-18 against the working copies of five Bylaws (not the Constitution, whose two bullet lines are test text).
-- Why: binding provisions must be citable, so plain bullets are not used; the list buttons were removed from the editor.
-- What it does: every nested bullet line ("   - text" or "    * text") becomes a nested numbered line ("   1. text"), which the page shows as an (a), (b), (c) sub-item.
-- Safety: the previous text of each document was saved first in policy_doc_backups ("Before bullets became (a), (b) sub-items"), so it can be put back from "Earlier saves".
-- The published text of "People: roles, fair access and removal" (version 1) is untouched; it shows as unpublished changes until the President publishes.
with d as (select id, slug, working_md, working_rev from activities.policy_docs where slug in ('bylaws-bodies','bylaws-events','bylaws-money','bylaws-people','bylaws-spaces-records')),
b as (insert into activities.policy_doc_backups (doc_id, body_md, saved_by, rev)
      select id, working_md, 'Before bullets became (a), (b) sub-items', working_rev from d returning doc_id)
update activities.policy_docs p
set working_md = regexp_replace(p.working_md, E'(^|\\n)([ \\t]+)[-*+] ', E'\\1\\2' || '1. ', 'g'),
    working_rev = p.working_rev + 1,
    working_by = 'Bullets to sub-items',
    updated_at = now()
from d
where p.id = d.id and d.id in (select doc_id from b);
