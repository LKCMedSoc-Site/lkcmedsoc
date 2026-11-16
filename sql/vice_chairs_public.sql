-- Shows each CCA's vice-chairperson(s) on its public page, next to the chairperson(s).
-- Run once in the Supabase SQL editor. Names only (the same fields already public for chairs): no emails, no matric numbers.
-- Committee members and directors stay private. A photo shows for anyone listed here whose owner ticked "show my photo" (no level restriction).
--
-- This replaces records.public_leadership with the definition from sql/leader_photos.sql plus one extra condition.

create or replace view records.public_leadership as
 select p.ay,
        p.governance_level as level,
        b.name as body,
        b.parent_committee,
        p.final_title as title,
        s.full_name,
        s.preferred_name,
        case when s.show_photo then s.photo_url end as photo_url
   from records.participation p
   join records.bodies b on b.id = p.body_id
   join records.students s on s.matric = p.matric
  where (p.is_top
         or p.final_title ilike '%stream representative%'
         or (b.level = 'CCA/Project' and p.role_tier = 'Vice-Chairperson'))
    and b.status = 'Active';
