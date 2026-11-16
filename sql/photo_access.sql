-- Widens who sees the "My photo" card in the records app (replaces the rule from sql/leader_photos.sql). Run once in the Supabase SQL editor.
-- Anyone holding one of these posts in the open academic year can add a photo:
--   * any ExCo member
--   * a committee head (top post of a committee)
--   * a house representative (anyone listed under a house)
--   * a year representative
--   * the chair or a vice-chair of a student group (CCA / project)
-- A photo is still public only when its owner ticks "show my photo on the website"; nothing else about visibility changes.
--
-- Year representatives are found by name ("Year ... Rep..." in the governance level, role or title). If the check below shows a year rep missing,
-- tell me how that post is written in the records and I will match it exactly.

create or replace function records.can_have_photo() returns boolean language sql stable security definer set search_path = 'records', 'public' as $$
  select exists (
    select 1 from participation p
    join academic_years y on y.ay = p.ay and y.is_open
    join bodies b on b.id = p.body_id
    where p.matric = my_matric() and (
         lower(p.governance_level) = 'exco'
      or (lower(p.governance_level) = 'committee' and p.is_top)
      or lower(p.governance_level) = 'house'
      or lower(p.governance_level) like 'year%'
      or p.role_tier ilike '%year%rep%' or p.final_title ilike '%year%rep%'
      or (b.level = 'CCA/Project' and (p.is_top or p.role_tier ilike '%chair%'))))
$$;

create or replace function records.save_my_photo(p_url text, p_show boolean) returns void
language plpgsql security definer set search_path = 'records', 'public' as $$
declare m text := my_matric();
begin
  if m is null then raise exception 'Your email is not linked to a student record.'; end if;
  if not can_have_photo() then raise exception 'Photos are for ExCo members, committee heads, year and house representatives, and group chairs and vice-chairs.'; end if;
  if nullif(trim(p_url), '') is not null and trim(p_url) !~ ('^https://[^/]+/storage/v1/object/public/leader-photos/' || m || '/[A-Za-z0-9._-]+$') then
    raise exception 'That photo was not uploaded through this page.';
  end if;
  update students set photo_url = nullif(trim(p_url), ''), show_photo = (coalesce(p_show, false) and nullif(trim(p_url), '') is not null) where matric = m;
end $$;

-- Check (optional): who would now qualify this year, by post. Counts only.
-- select p.governance_level, p.role_tier, count(*) from records.participation p join records.academic_years y on y.ay = p.ay and y.is_open
--   join records.bodies b on b.id = p.body_id
--  where lower(p.governance_level) in ('exco','house') or lower(p.governance_level) like 'year%' or p.role_tier ilike '%year%rep%'
--     or (b.level = 'CCA/Project' and (p.is_top or p.role_tier ilike '%chair%')) group by 1, 2 order by 1, 2;
